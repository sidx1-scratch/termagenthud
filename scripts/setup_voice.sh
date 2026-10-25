#!/usr/bin/env bash
set -e

# TermAgentHUD Voice Model Setup Script
# Determines true user home (even if invoked via sudo)
if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
    USER_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
    [ -z "$USER_HOME" ] && USER_HOME="/home/$SUDO_USER"
else
    USER_HOME="${HOME:-$USERPROFILE}"
fi

APP_DIR="$USER_HOME/.config/termagenthud"
VENV_DIR="$APP_DIR/venv"
MODELS_DIR="$APP_DIR/models"

mkdir -p "$MODELS_DIR"

# Ensure non-root ownership if run via sudo
if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
    chown -R "$SUDO_USER:$SUDO_USER" "$APP_DIR" 2>/dev/null || true
fi

echo "[HUD-SETUP] Installing Python virtual environment in $VENV_DIR..."
if [ ! -d "$VENV_DIR" ]; then
    if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
        su - "$SUDO_USER" -c "python3 -m venv '$VENV_DIR'"
    else
        python3 -m venv "$VENV_DIR"
    fi
fi

echo "[HUD-SETUP] Installing faster-whisper & piper-tts..."
PIP_CMD="$VENV_DIR/bin/pip"
if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
    su - "$SUDO_USER" -c "'$PIP_CMD' install --upgrade pip -q && '$PIP_CMD' install faster-whisper piper-tts sounddevice numpy scipy -q"
else
    "$PIP_CMD" install --upgrade pip -q
    "$PIP_CMD" install faster-whisper piper-tts sounddevice numpy scipy -q
fi

echo "[HUD-SETUP] Pre-caching Whisper Tiny (int8 quantized)..."
PYTHON_CMD="$VENV_DIR/bin/python"
if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
    su - "$SUDO_USER" -c "'$PYTHON_CMD' -c \"from faster_whisper import WhisperModel; WhisperModel('tiny.en', device='cpu', compute_type='int8')\""
else
    "$PYTHON_CMD" -c "from faster_whisper import WhisperModel; WhisperModel('tiny.en', device='cpu', compute_type='int8')"
fi

echo "[HUD-SETUP] Downloading Piper voice model (lessac-low)..."
PIPER_MODEL_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/low/en_US-lessac-low.onnx"
PIPER_CONFIG_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/low/en_US-lessac-low.onnx.json"

if [ ! -f "$MODELS_DIR/voice.onnx" ]; then
    curl -L --progress-bar "$PIPER_MODEL_URL" -o "$MODELS_DIR/voice.onnx"
fi

if [ ! -f "$MODELS_DIR/voice.onnx.json" ]; then
    curl -L --progress-bar "$PIPER_CONFIG_URL" -o "$MODELS_DIR/voice.onnx.json"
fi

if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
    chown -R "$SUDO_USER:$SUDO_USER" "$APP_DIR" 2>/dev/null || true
fi

echo "[HUD-SETUP] Voice models ready at $APP_DIR!"
