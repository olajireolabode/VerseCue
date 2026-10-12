import whisper


print("Loading Whisper model...")

model = whisper.load_model("base")

print("Model loaded.")
print("Transcribing audio...")

result = model.transcribe("test_audio.mp3")

print("\nTranscript:")
print(result["text"])