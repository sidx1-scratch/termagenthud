#!/usr/bin/env bash
set -e

# TermAgentHUD All-in-One Automated Setup Script
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$DIR/.venv"
MODELS_DIR="$DIR/models"

echo ""
echo "================================================================="
echo "⚡  TermAgentHUD — Fully Automated Installer (JARVIS AI Engine)  ⚡"
echo "================================================================="
echo ""

# 1. System Package Check / Dependencies
echo "[1/6] Checking system audio tools (aplay/paplay/ffmpeg/curl)..."
if ! command -v curl &> /dev/null; then
    echo "curl not found. Installing..."
    if command -v apt-get &> /dev/null; then
        apt-get update -qq && apt-get install -y -qq curl
    elif command -v dnf &> /dev/null; then
        dnf install -y curl
    elif command -v pacman &> /dev/null; then
        pacman -Sy --noconfirm curl
    fi
fi

# 2. Build TypeScript Core
echo "[2/6] Compiling TypeScript HUD engine..."
cd "$DIR"
npm run build

# 3. Global CLI Installation (npm link)
echo "[3/6] Installing 'termagenthud' command globally via npm link..."
if [ "$EUID" -eq 0 ]; then
    npm link
else
    echo "Notice: Non-root detected. If npm link fails, run 'sudo ./scripts/install.sh'"
    npm link 2>/dev/null || (mkdir -p "$HOME/.local/bin" && ln -sf "$DIR/bin/termagenthud.js" "$HOME/.local/bin/termagenthud")
fi

# 4. Create Isolated Python Virtual Environment
echo "[4/6] Setting up ultra-low RAM Python virtual environment in $VENV_DIR..."
mkdir -p "$MODELS_DIR"

if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
fi

"$VENV_DIR/bin/pip" install --upgrade pip -q
"$VENV_DIR/bin/pip" install faster-whisper piper-tts sounddevice numpy scipy -q

# 5. Download and Pre-Cache Whisper Tiny (INT8 Quantized - ~140MB RAM)
echo "[5/6] Downloading Whisper Tiny model (int8 quantized for ultra-low RAM & CPU speed)..."
"$VENV_DIR/bin/python" -c "from faster_whisper import WhisperModel; WhisperModel('tiny.en', device='cpu', compute_type='int8')"

# 6. Download Default Premium Piper Voice (en_US Lessac Low - 28MB)
echo "[6/6] Downloading best default voice: en_US-lessac-low (Crisp JARVIS response, ~28MB)..."
PIPER_MODEL_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/low/en_US-lessac-low.onnx"
PIPER_CONFIG_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/low/en_US-lessac-low.onnx.json"

if [ ! -f "$MODELS_DIR/voice.onnx" ]; then
    curl -L --progress-bar "$PIPER_MODEL_URL" -o "$MODELS_DIR/voice.onnx"
fi

if [ ! -f "$MODELS_DIR/voice.onnx.json" ]; then
    curl -L --progress-bar "$PIPER_CONFIG_URL" -o "$MODELS_DIR/voice.onnx.json"
fi

echo ""
echo "================================================================="
echo "✅  TermAgentHUD Fully Configured & Ready!                      "
echo "================================================================="
echo "Run 'termagenthud' from any terminal to launch your JARVIS HUD!"
echo "Browser will open automatically at http://localhost:3000"
echo "================================================================="
echo ""
