from datetime import datetime, timezone, timedelta
import os
import tempfile

import requests
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from bible_api import BibleClient
from verse_service import VerseService

app = FastAPI(
    title="VerseCue",
    description="VerseCue to the rescue. Get your verses right on cue",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

bible_client = BibleClient()
verse_service = VerseService()
listener_last_seen = None
detection_history = []
current_projection = None


class DetectionRecord(BaseModel):
    reference: str
    text: str
    confidence: float = 1.0


class ProjectionSelection(BaseModel):
    reference: str
    text: str
    translation: str = "NKJV"


def add_history_entry(reference: str, text: str, confidence: float = 1.0):
    """Store one detection in memory and return its history record."""
    entry = {
        "id": max((item["id"] for item in detection_history), default=0) + 1,
        "reference": reference,
        "text": text,
        "confidence": confidence,
        "detected_at": datetime.now(timezone.utc).isoformat(),
    }
    detection_history.append(entry)
    return entry


@app.get("/")
def home():
    return {"app": "VerseCue", "status": "online", "message": "Welcome to VerseCue!"}


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "VerseCue"}


@app.post("/api/history")
def add_detection(record: DetectionRecord):
    entry = add_history_entry(record.reference, record.text, record.confidence)
    return {"message": "Detection added", "detection": entry}


@app.get("/api/history")
def get_detection_history():
    history = list(reversed(detection_history))
    return {"count": len(history), "history": history}


@app.delete("/api/history")
def clear_detection_history():
    detection_history.clear()
    return {"message": "Detection history cleared"}


@app.get("/api/projection")
def get_projection():
    return {"projection": current_projection}


@app.post("/api/projection")
def set_projection(selection: ProjectionSelection):
    global current_projection
    current_projection = {
        "reference": selection.reference,
        "text": selection.text,
        "translation": selection.translation,
    }
    return {"message": "Verse approved for projection", "projection": current_projection}


@app.delete("/api/projection")
def clear_projection():
    global current_projection
    current_projection = None
    return {"message": "Projection cleared"}


@app.get("/api/bible/{reference}")
def get_bible_passage(reference: str, bible_id: str = None):
    try:
        client = BibleClient(bible_id=bible_id)
        passage = client.get_passage_from_text(reference)
        return {"reference": passage.reference, "text": passage.text, "bible_id": client.bible_id}
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="Unable to retrieve passage from API.Bible.") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to retrieve the requested Bible passage.") from exc


@app.post("/api/detect")
async def detect_verse(audio: UploadFile = File(...)):
    audio_path = None
    try:
        suffix = os.path.splitext(audio.filename or "")[1].lower()
        if suffix not in {".wav", ".mp3", ".m4a", ".webm", ".ogg"}:
            suffix = ".webm"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
            audio_path = temp_file.name
            while True:
                chunk = await audio.read(1024 * 1024)
                if not chunk:
                    break
                temp_file.write(chunk)

        result = verse_service.process_audio(audio_path)
        references = result.get("references", []) or []

        # Persist each unique reference once per recording. This powers History,
        # Total Detections, and Latest Reference without restoring live transcription.
        saved_this_recording = set()
        for item in references:
            reference = str(item.get("reference", "")).strip()
            if not reference:
                continue
            key = reference.casefold()
            if key in saved_this_recording:
                continue
            saved_this_recording.add(key)
            add_history_entry(
                reference=reference,
                text=str(item.get("text", "") or ""),
                confidence=float(item.get("confidence", 1.0) or 1.0),
            )

        return {"transcript": result.get("transcript", ""), "references": references}
    except HTTPException:
        raise
    except Exception as error:
        print(f"Audio processing error: {error}")
        raise HTTPException(status_code=500, detail="Could not process the recording. Please try again.") from error
    finally:
        await audio.close()
        if audio_path and os.path.exists(audio_path):
            try:
                os.remove(audio_path)
            except OSError as error:
                print(f"Could not remove temporary audio file: {error}")


@app.post("/api/status/listener")
def update_listener_status():
    global listener_last_seen
    listener_last_seen = datetime.now(timezone.utc).isoformat()
    return {"status": "ok"}


@app.get("/api/status")
def get_system_status():
    listener_active = False
    if listener_last_seen is not None:
        last_seen = datetime.fromisoformat(listener_last_seen)
        listener_active = (datetime.now(timezone.utc) - last_seen) < timedelta(seconds=15)
    return {"backend": "online", "listener": "active" if listener_active else "offline"}


@app.get("/api/bibles")
def list_available_bibles():
    try:
        result = BibleClient().get_bibles()
        bibles = result.get("data", [])
        return {
            "count": len(bibles),
            "bibles": [
                {
                    "id": bible.get("id"),
                    "name": bible.get("nameLocal") or bible.get("name"),
                    "abbreviation": bible.get("abbreviationLocal") or bible.get("abbreviation"),
                    "language": bible.get("language", {}).get("name"),
                    "copyright": bible.get("copyright"),
                }
                for bible in bibles if bible.get("id")
            ],
        }
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="Could not retrieve Bible translations from API.Bible.") from exc


@app.get("/api/context-search")
def context_search(query: str, bible_id: str = None, limit: int = 10):
    query = query.strip()
    if len(query) < 3:
        raise HTTPException(status_code=400, detail="Enter at least 3 characters to search.")
    if len(query) > 200:
        raise HTTPException(status_code=400, detail="Search text must be 200 characters or fewer.")
    limit = max(1, min(limit, 25))
    try:
        client = BibleClient(bible_id=bible_id)
        result = client.search_text(query=query, limit=limit, fuzziness=1)
        data = result.get("data", {})
        verses = data.get("verses", [])
        return {
            "query": query,
            "bible_id": client.bible_id,
            "count": len(verses),
            "total": data.get("total", len(verses)),
            "results": [
                {"reference": verse.get("reference", ""), "text": verse.get("text", ""), "id": verse.get("id", "")}
                for verse in verses
            ],
        }
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="Bible text search failed. Check API.Bible access.") from exc
