#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$DIR/.venv"
MODELS_DIR="$DIR/models"

echo "=== TermAgentHUD Voice Engine Installer ==="
mkdir -p "$MODELS_DIR"

if [ ! -d "$VENV_DIR" ]; then
    echo "[1/4] Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

echo "[2/4] Installing Whisper and Piper in virtual environment..."
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install openai-whisper piper-tts sounddevice numpy scipy

echo "[3/4] Downloading Whisper Tiny model..."
"$VENV_DIR/bin/python" -c "import whisper; whisper.load_model('tiny')"

echo "[4/4] Downloading Piper Voice (en_US-lessac-medium)..."
PIPER_MODEL_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx"
PIPER_CONFIG_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json"

if [ ! -f "$MODELS_DIR/voice.onnx" ]; then
    echo "Downloading voice.onnx..."
    curl -L "$PIPER_MODEL_URL" -o "$MODELS_DIR/voice.onnx"
fi

if [ ! -f "$MODELS_DIR/voice.onnx.json" ]; then
    echo "Downloading voice.onnx.json..."
    curl -L "$PIPER_CONFIG_URL" -o "$MODELS_DIR/voice.onnx.json"
fi

echo "=== Voice Engine Setup Complete! ==="
