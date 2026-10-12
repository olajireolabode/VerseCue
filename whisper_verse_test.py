import whisper

from bible_api import BibleClient
from verse_detector import find_valid_references


print("Loading Whisper model...")

model = whisper.load_model("base")

print("Model loaded.")
print("Transcribing audio...")

result = model.transcribe("test_audio.mp3")

transcript = result["text"].strip()

print("\nTranscript:")
print(transcript)

print("\nDetecting Bible references...")

bible_client = BibleClient()

references = find_valid_references(
    transcript,
    bible_client
)

if not references:
    print("No valid Bible references detected.")
else:
    print("Detected references:")

    for reference in references:
        print(
            f"\nReference: {reference.reference}"
            f"\nConfidence: {reference.confidence}"
        )

        passage = bible_client.get_passage_from_text(
            reference.reference
        )

        print(f"Verse: {passage.text}")