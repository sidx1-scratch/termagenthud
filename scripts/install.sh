#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "================================================================="
echo "⚡  TermAgentHUD — Fully Automated Setup (MCP & Voice Engine)  ⚡"
echo "================================================================="
echo ""

# 1. Ask user which terminal AI agent they want to configure
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

echo "Selected Agent: $AGENT_NAME"
echo ""

# 2. Build TypeScript Core
echo "[1/4] Compiling TypeScript HUD core..."
cd "$DIR"
npm run build

# 3. Global CLI Linking
echo "[2/4] Linking termagenthud binary globally..."
if [ "$EUID" -eq 0 ]; then
    npm link --force
else
    mkdir -p "$HOME/.local/bin"
    ln -sf "$DIR/bin/termagenthud.js" "$HOME/.local/bin/termagenthud"
fi

# 4. Auto-Configure MCP in Target Agent Config
echo "[3/4] Auto-injecting JARVIS HUD MCP server into $AGENT_NAME configuration..."
node -e "
import('./dist/mcp-configurator.js').then(({ configureAgentMcp }) => {
  const root = '$DIR';
  const mcpServer = root + '/dist/mcp-server.js';
  const configs = configureAgentMcp('$AGENT_NAME', mcpServer);
  console.log('  ✔ MCP successfully configured in:');
  configs.forEach(c => console.log('    -> ' + c));
});
"

# 5. Pre-warm Python Whisper Tiny and Piper
echo "[4/4] Setting up Whisper Tiny & Piper Voice Models..."
bash "$DIR/scripts/setup_voice.sh"

echo ""
echo "================================================================="
echo "✅  SETUP COMPLETE!                                             "
echo "================================================================="
echo "Running 'termagenthud' will now:"
echo "  1. Launch background server with zero terminal blockage"
echo "  2. Automatically pop open index.html in your browser"
echo "  3. Start live Whisper STT + Piper TTS"
echo "  4. Launch '$AGENT_NAME' inside a real pseudo-terminal (PTY)"
echo "================================================================="
echo ""
