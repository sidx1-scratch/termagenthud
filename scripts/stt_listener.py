#!/usr/bin/env python3
import sys
import json
import tempfile
import os
import io
import re
import numpy as np

def emit(type_str, **kwargs):
    kwargs["type"] = type_str
    print(json.dumps(kwargs), flush=True)

try:
    from faster_whisper import WhisperModel
    import sounddevice as sd
    from scipy.io.wavfile import write
    use_standard_whisper = False
except ImportError:
    try:
        import whisper
        import sounddevice as sd
        from scipy.io.wavfile import write
        use_standard_whisper = True
    except ImportError as e:
        emit("status", message=f"Missing python dependencies: {e}")
        sys.exit(1)

SAMPLE_RATE = 16000
DURATION = 2.5  # 2.5s snappy audio window for fast response

emit("status", message="Initializing Whisper Tiny engine...")

if not use_standard_whisper:
    model = WhisperModel("tiny.en", device="cpu", compute_type="int8", cpu_threads=2)
else:
    model = whisper.load_model("tiny.en")

emit("status", message="Whisper Tiny online! Microphone listening for: Jarvis, Computer, Agent")

def clean_text(t):
    return re.sub(r'[^\w\s]', '', t).strip().lower()

def record_and_transcribe():
    while True:
        try:
            # Record chunk
            audio = sd.rec(int(DURATION * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1, dtype='int16')
            sd.wait()

            # Dynamic RMS check - lowered threshold to 50 so quiet voices and distant mics aren't ignored
            audio_data = np.frombuffer(audio, dtype=np.int16)
            rms = np.sqrt(np.mean(audio_data.astype(np.float32)**2))
            if rms < 50:
                continue

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                temp_filename = tmp.name

            write(temp_filename, SAMPLE_RATE, audio)

            if not use_standard_whisper:
                segments, _ = model.transcribe(
                    temp_filename,
                    language="en",
                    beam_size=1,
                    vad_filter=False  # Disabled aggressive VAD to avoid cutting off wake words
                )
                text = " ".join([seg.text for seg in segments]).strip()
            else:
                result = model.transcribe(temp_filename, fp16=False, language="en")
                text = result.get("text", "").strip()

            if os.path.exists(temp_filename):
                try:
                    os.remove(temp_filename)
                except:
                    pass

            if text and len(text) > 1:
                cleaned = clean_text(text)
                emit("transcript", text=text, cleaned=cleaned)

        except Exception as e:
            emit("status", message=f"Microphone input note: {str(e)}")
            break

if __name__ == "__main__":
    record_and_transcribe()
