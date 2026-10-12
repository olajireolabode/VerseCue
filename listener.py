
import sounddevice as sd
import numpy as np
import whisper
import time
import threading
import queue
import requests

from scipy.io.wavfile import write
from bible_api import BibleClient
from verse_detector import find_valid_references


DEVICE_ID = 1
SAMPLE_RATE = 44100
CHUNK_DURATION = 5
API_URL = "http://127.0.0.1:8000/api/history"
STATUS_URL = "http://127.0.0.1:8000/api/status/listener"

print("Loading Whisper model...")
model = whisper.load_model("base")
print("Whisper model loaded.")

bible_client = BibleClient()
recent_references = {}
COOLDOWN_SECONDS = 30

audio_queue = queue.Queue(maxsize=3)
stop_event = threading.Event()


def record_audio_continuously():
    """Record audio chunks without waiting for Whisper."""
    while not stop_event.is_set():
        try:
            audio = sd.rec(
                int(CHUNK_DURATION * SAMPLE_RATE),
                samplerate=SAMPLE_RATE,
                channels=1,
                dtype="int16",
                device=DEVICE_ID
            )

            sd.wait()

            if stop_event.is_set():
                break

            audio = audio.flatten()

            # Keep the newest audio if processing falls behind.
            if audio_queue.full():
                try:
                    audio_queue.get_nowait()
                except queue.Empty:
                    pass

            try:
                audio_queue.put_nowait(audio)
            except queue.Full:
                pass

        except Exception as error:
            print(f"Recording error: {error}")
            stop_event.set()
            break


def process_audio_chunk(audio):
    write("last_live_chunk.wav", SAMPLE_RATE, audio)

    print("\nTranscribing captured audio...")

    result = model.transcribe(
        "last_live_chunk.wav",
        fp16=False,
        language="en",
        temperature=0
    )

    transcript = result["text"].strip()
    print(f"Transcript: {transcript}")

    if not transcript:
        return

    references = find_valid_references(
        transcript,
        bible_client
    )

    for reference in references:
        key = reference.reference.lower()
        current_time = time.time()

        last_detected = recent_references.get(key, 0)

        if current_time - last_detected < COOLDOWN_SECONDS:
            print(f"Duplicate ignored: {reference.reference}")
            continue

        passage = bible_client.get_passage_from_text(
            reference.reference
        )

        recent_references[key] = current_time

        print(f"\nDetected: {passage.reference}")
        print(passage.text)

        try:
            response = requests.post(
                API_URL,
                json={
                    "reference": passage.reference,
                    "text": passage.text,
                    "confidence": reference.confidence
                },
                timeout=3
            )
            response.raise_for_status()
            print("Saved to detection history.")

        except requests.RequestException as error:
            print(f"Could not save to history: {error}")

def send_listener_heartbeat():
    while not stop_event.is_set():
        try:
            requests.post(STATUS_URL, timeout=3)
        except requests.RequestException:
            pass

        stop_event.wait(5)

def main():
    print("\nVerseCue is listening. Press Ctrl+C to stop.")

    heartbeat_thread = threading.Thread(
    target=send_listener_heartbeat,
    daemon=True
    )
    heartbeat_thread.start()

    recorder = threading.Thread(
        target=record_audio_continuously,
        daemon=True
    )

    recorder.start()

    try:
        while True:
            audio = audio_queue.get()
            process_audio_chunk(audio)

    except KeyboardInterrupt:
        print("\nStopping VerseCue...")
        stop_event.set()
        print("VerseCue stopped.")

    except Exception as error:
        print(f"\nProcessing error: {error}")
        stop_event.set()


def test_saved_audio():
    print("Transcribing saved microphone recording...")

    result = model.transcribe(
        "mic_test.wav",
        fp16=False,
        language="en",
        temperature=0
    )

    print("\nWhisper heard:")
    print(result["text"])


if __name__ == "__main__":
    main()
