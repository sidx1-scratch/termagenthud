#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$DIR/.venv"
MODELS_DIR="$DIR/models"

echo "=== TermAgentHUD Voice Engine Installer ==="
mkdir -p "$MODELS_DIR"

if [ ! -d "$VENV_DIR" ]; then
    echo "[1/4] Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

echo "[2/4] Installing high-efficiency, low-RAM STT (faster-whisper) & TTS (piper-tts)..."
"$VENV_DIR/bin/pip" install --upgrade pip
# faster-whisper uses CTranslate2 (int8 quantization, ~150MB RAM vs standard PyTorch >1GB)
"$VENV_DIR/bin/pip" install faster-whisper piper-tts sounddevice numpy scipy

echo "[3/4] Pre-caching Whisper Tiny (int8 quantized)..."
"$VENV_DIR/bin/python" -c "from faster_whisper import WhisperModel; WhisperModel('tiny.en', device='cpu', compute_type='int8')"

echo "[4/4] Downloading Piper Voice (en_US-lessac-low, ~28MB)..."
# Using 'low' quality instead of medium: cuts model size from 65MB to ~28MB and halves ONNX RAM usage with crisp speech
PIPER_MODEL_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/low/en_US-lessac-low.onnx"
PIPER_CONFIG_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/low/en_US-lessac-low.onnx.json"

if [ ! -f "$MODELS_DIR/voice.onnx" ]; then
    echo "Downloading voice.onnx..."
    curl -L "$PIPER_MODEL_URL" -o "$MODELS_DIR/voice.onnx"
fi

if [ ! -f "$MODELS_DIR/voice.onnx.json" ]; then
    echo "Downloading voice.onnx.json..."
    curl -L "$PIPER_CONFIG_URL" -o "$MODELS_DIR/voice.onnx.json"
fi

echo "=== Voice Engine Setup Complete! ==="
