#!/usr/bin/env python3
import sys
import json
import tempfile
import os
import numpy as np

def emit(type_str, **kwargs):
    kwargs["type"] = type_str
    print(json.dumps(kwargs), flush=True)

try:
    import whisper
    import sounddevice as sd
    from scipy.io.wavfile import write
except ImportError as e:
    emit("status", message=f"Missing python dependencies: {e}")
    sys.exit(1)

SAMPLE_RATE = 16000
DURATION = 3.5  # Chunk duration in seconds

emit("status", message="Loading Whisper Tiny engine...")
model = whisper.load_model("tiny")
emit("status", message="Whisper Tiny online. Listening for wake words (Jarvis, Computer, Agent)...")

def record_and_transcribe():
    while True:
        try:
            # Record audio chunk
            audio = sd.rec(int(DURATION * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1, dtype='int16')
            sd.wait()
            
            # Simple energy threshold check (ignore pure silence)
            audio_data = np.frombuffer(audio, dtype=np.int16)
            rms = np.sqrt(np.mean(audio_data.astype(np.float32)**2))
            if rms < 350:
                continue

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                temp_filename = tmp.name

            write(temp_filename, SAMPLE_RATE, audio)

            # Transcribe
            result = model.transcribe(temp_filename, fp16=False, language="en")
            text = result.get("text", "").strip()

            if os.path.exists(temp_filename):
                os.remove(temp_filename)

            if text and len(text) > 1:
                emit("transcript", text=text)

        except Exception as e:
            emit("status", message=f"Audio error: {str(e)}")
            break

if __name__ == "__main__":
    record_and_transcribe()
