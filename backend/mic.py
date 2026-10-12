
import sounddevice as sd
from scipy.io.wavfile import write

DEVICE_ID = 1
DURATION = 5
SAMPLE_RATE = 44100

print("Recording for 5 seconds...")
print("Speak a sentence containing a Bible reference.")

audio = sd.rec(
    int(DURATION * SAMPLE_RATE),
    samplerate=SAMPLE_RATE,
    channels=1,
    dtype="int16",
    device=DEVICE_ID
)

sd.wait()

write("mic_test.wav", SAMPLE_RATE, audio)

print("Recording saved to mic_test.wav")
