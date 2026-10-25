#!/usr/bin/env bash
set -e

# ==============================================================================
# TermAgentHUD — Standalone 1-Click Bootstrap Installer
# Downloads, clones, installs Whisper & Piper, links binary, and injects MCP!
# ==============================================================================

echo ""
echo "======================================================================="
echo "⚡  TermAgentHUD — 1-Click Universal Bootstrap Installer (JARVIS AI)   ⚡"
echo "======================================================================="
echo ""

# 1. Determine Target User & Home Directory
if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
    TARGET_USER="$SUDO_USER"
    USER_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
    [ -z "$USER_HOME" ] && USER_HOME="/home/$SUDO_USER"
else
    TARGET_USER="$(whoami)"
    USER_HOME="${HOME:-/root}"
fi

REPO_URL="https://github.com/sidx1-scratch/termagenthud.git"
INSTALL_DIR="$USER_HOME/.local/share/termagenthud"
BIN_DIR="$USER_HOME/.local/bin"
GLOBAL_BIN="/usr/local/bin"
APP_CONFIG_DIR="$USER_HOME/.config/termagenthud"
MODELS_DIR="$APP_CONFIG_DIR/models"

echo "[1/6] Target User: $TARGET_USER ($USER_HOME)"

# 2. Install Core System Prerequisites (git, curl, nodejs, python3)
echo "[2/6] Checking system tools (git, node, python3, audio)..."
if command -v apt-get &> /dev/null; then
    apt-get update -qq && apt-get install -y -qq git curl nodejs npm python3 python3-pip python3-venv alsa-utils ffmpeg 2>/dev/null || true
elif command -v dnf &> /dev/null; then
    dnf install -y -q git curl nodejs npm python3 python3-pip alsa-utils ffmpeg 2>/dev/null || true
elif command -v pacman &> /dev/null; then
    pacman -Sy --noconfirm git curl nodejs npm python python-pip alsa-utils ffmpeg 2>/dev/null || true
fi

# 3. Clone / Update Repository
echo "[3/6] Downloading TermAgentHUD into $INSTALL_DIR..."
mkdir -p "$(dirname "$INSTALL_DIR")"

if [ -d "$INSTALL_DIR/.git" ]; then
    cd "$INSTALL_DIR"
    git fetch --all --quiet
    git reset --hard origin/main --quiet
else
    rm -rf "$INSTALL_DIR"
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" --quiet
fi

# 4. Interactive Agent Selection for MCP Configuration
echo ""
echo "Select your default Terminal AI Agent to auto-configure MCP:"
echo "  [1] Google Antigravity CLI (agy / antigravity)"
echo "  [2] Anthropic Claude Code (claude)"
echo "  [3] OpenCode CLI (opencode)"
echo "  [4] OpenClaw CLI (openclaw)"
echo "  [5] OpenAI Codex CLI (codex)"
echo "  [6] Cursor CLI / Aider / Custom"
echo ""

if [ -t 0 ]; then
    read -p "Select [1-6] (Default is 1): " AGENT_CHOICE
else
    AGENT_CHOICE="1"
fi

case "$AGENT_CHOICE" in
    2) AGENT_NAME="claude" ;;
    3) AGENT_NAME="opencode" ;;
    4) AGENT_NAME="openclaw" ;;
    5) AGENT_NAME="codex" ;;
    6) AGENT_NAME="cursor" ;;
    *) AGENT_NAME="antigravity" ;;
esac
echo "Target agent selected: $AGENT_NAME"
echo ""

# 5. Build and Install Node Dependencies
echo "[4/6] Building high-performance core engine..."
cd "$INSTALL_DIR"

if [ "$TARGET_USER" != "root" ]; then
    chown -R "$TARGET_USER:$TARGET_USER" "$INSTALL_DIR"
    su - "$TARGET_USER" -c "cd '$INSTALL_DIR' && npm install --silent && npm run build"
else
    npm install --silent
    npm run build
fi

# Make binary accessible everywhere
mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/bin/termagenthud.js" "$BIN_DIR/termagenthud"
if [ -d "$GLOBAL_BIN" ]; then
    ln -sf "$INSTALL_DIR/bin/termagenthud.js" "$GLOBAL_BIN/termagenthud"
fi

# 6. Auto-Inject MCP configuration for Selected Terminal Agent
echo "[5/6] Injecting JARVIS HUD MCP server into $AGENT_NAME..."
node -e "
import('$INSTALL_DIR/dist/mcp-configurator.js').then(({ configureAgentMcp }) => {
  const configs = configureAgentMcp('$AGENT_NAME', '$INSTALL_DIR/dist/mcp-server.js');
  configs.forEach(c => console.log('  ✔ Configured in: ' + c));
});
"

# 7. Install Voice AI Engines (Whisper Tiny INT8 + Piper ONNX)
echo "[6/6] Installing Whisper Tiny & Piper Voice Models..."
mkdir -p "$MODELS_DIR"

# Download Piper model if missing
PIPER_MODEL_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/low/en_US-lessac-low.onnx"
PIPER_CONFIG_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/low/en_US-lessac-low.onnx.json"

if [ ! -f "$MODELS_DIR/voice.onnx" ]; then
    curl -L -s "$PIPER_MODEL_URL" -o "$MODELS_DIR/voice.onnx"
fi
if [ ! -f "$MODELS_DIR/voice.onnx.json" ]; then
    curl -L -s "$PIPER_CONFIG_URL" -o "$MODELS_DIR/voice.onnx.json"
fi

# Install Python Voice packages into user environment
if [ "$TARGET_USER" != "root" ]; then
    su - "$TARGET_USER" -c "python3 -m pip install faster-whisper piper-tts sounddevice numpy scipy -q 2>/dev/null || true"
    su - "$TARGET_USER" -c "python3 -c \"from faster_whisper import WhisperModel; WhisperModel('tiny.en', device='cpu', compute_type='int8')\" 2>/dev/null || true"
    chown -R "$TARGET_USER:$TARGET_USER" "$APP_CONFIG_DIR" 2>/dev/null || true
else
    python3 -m pip install faster-whisper piper-tts sounddevice numpy scipy -q 2>/dev/null || true
    python3 -c "from faster_whisper import WhisperModel; WhisperModel('tiny.en', device='cpu', compute_type='int8')" 2>/dev/null || true
fi

echo ""
echo "======================================================================="
echo "✅  TERMAGENTHUD 1-CLICK INSTALLATION COMPLETE!                         "
echo "======================================================================="
echo "You can now run 'termagenthud' from ANY directory!"
echo "It will:"
echo "  1. Run attached to your terminal with the selected agent active"
echo "  2. Pop open the JARVIS HUD in your browser (http://localhost:3000)"
echo "  3. Start live Whisper Tiny STT + Piper TTS"
echo "  4. Launch $AGENT_NAME connected with MCP"
echo "======================================================================="
echo ""
