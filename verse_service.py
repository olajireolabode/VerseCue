
import whisper

from bible_api import BibleClient
from verse_detector import find_valid_references


class VerseService:
    def __init__(self):
        print("Loading Whisper model...")
        self.model = whisper.load_model("base")
        print("Whisper model loaded.")

        self.bible_client = BibleClient()

    def process_audio(self, audio_path):
        result = self.model.transcribe(
            audio_path,
            fp16=False,
            language="en",
            temperature=0
        )

        transcript = result.get("text", "").strip()

        references = find_valid_references(
            transcript,
            self.bible_client
        )

        verses = []
        seen = set()

        for reference in references:
            try:
                passage = self.bible_client.get_passage_from_text(
                    reference.reference
                )

                key = passage.reference.lower()
                if key in seen:
                    continue

                seen.add(key)

                verses.append({
                    "reference": passage.reference,
                    "text": passage.text,
                    "confidence": reference.confidence
                })

            except Exception as error:
                print(
                    f"Could not retrieve {reference.reference}: {error}"
                )

        return {
            "transcript": transcript,
            "references": verses
        }
