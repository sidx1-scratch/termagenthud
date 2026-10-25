#!/usr/bin/env python3
import sys
import json
import tempfile
import os
import io
import gc
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
DURATION = 3.0  # 3-second audio window for low latency

emit("status", message="Initializing low-RAM STT engine (int8 quantized)...")

if not use_standard_whisper:
    # faster-whisper with int8 CPU compute uses only ~120-150MB RAM
    model = WhisperModel("tiny.en", device="cpu", compute_type="int8", cpu_threads=2)
else:
    model = whisper.load_model("tiny.en")

emit("status", message="Whisper Tiny online (~150MB RAM). Wake words: Jarvis, Computer, Agent.")

def record_and_transcribe():
    while True:
        try:
            # Record chunk
            audio = sd.rec(int(DURATION * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1, dtype='int16')
            sd.wait()
            
            # Silence detection (energy gate to avoid transcribing dead air and save CPU/RAM)
            audio_data = np.frombuffer(audio, dtype=np.int16)
            rms = np.sqrt(np.mean(audio_data.astype(np.float32)**2))
            if rms < 350:
                continue

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                temp_filename = tmp.name

            write(temp_filename, SAMPLE_RATE, audio)

            if not use_standard_whisper:
                segments, _ = model.transcribe(
                    temp_filename,
                    language="en",
                    beam_size=1,  # Greedy search: lowest RAM & fastest inference
                    vad_filter=True  # Voice Activity Detection
                )
                text = " ".join([seg.text for seg in segments]).strip()
            else:
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
