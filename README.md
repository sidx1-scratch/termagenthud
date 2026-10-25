# 🚀 TermAgentHUD (JARVIS Tactical Fighter-Jet HUD)

A high-tech, tactical fighter-jet and JARVIS-inspired Terminal HUD for AI agents (such as Google Antigravity CLI, OpenAI Codex CLI, Claude CLI, or custom agents) built using the **Model Context Protocol (MCP)** with **Open-Source Voice AI** (Whisper Tiny for STT, Piper ONNX for TTS).

![HUD Demo](https://raw.githubusercontent.com/sidx1-scratch/termagenthud/main/docs/hud-preview.png)

---

## ✨ Features

- 🛩️ **Fighter-Jet / JARVIS Tactical HUD**: Real-time 360° sweeping tactical radar, horizon/pitch indicators, audio stream waveform, and mission telemetry.
- 🎙️ **Voice Control & Wake-Words**: Hands-free voice recognition with wake words:
  - `"Jarvis"`
  - `"Computer"`
  - `"Agent"`
- 🔊 **Voice Command & Approval Flow**: Prompts you aloud via **Piper TTS** when the agent wants to execute a sensitive command or edit files. Authorize by saying *"Jarvis, approve"*, *"Computer, execute"*, or abort by saying *"Agent, cancel"*.
- 🤖 **MCP Protocol Integration**: Exposes standard MCP tools over Stdio and local WebSocket bridge:
  - `request_voice_approval`: Prompts for voice authorization before executing critical commands.
  - `speak_hud_announcement`: Speaks tactical updates out loud and logs on HUD.
  - `update_hud_telemetry`: Streams active tool, agent status, and progress.
- ⚡ **Lightweight Open-Source Models**:
  - **Whisper Tiny**: Ultra-fast local Speech-to-Text inference without cloud keys.
  - **Piper TTS (en_US Lessac Medium ONNX)**: Real-time, natural sounding voice synthesis running directly on CPU.

---

## 🛠️ Architecture

```
                    ┌─────────────────────────┐
                    │    Terminal AI Agent    │
                    │ (Antigravity/Codex CLI) │
                    └───────────┬─────────────┘
                                │ (MCP Stdio / Tools)
                                ▼
                    ┌─────────────────────────┐
                    │   TermAgentHUD MCP      │
                    │      (mcp-server)       │
                    └───────────┬─────────────┘
                                │ (Local WS :19842)
                                ▼
       ┌──────────────────────────────────────────────────┐
       │             JARVIS Tactical HUD (TUI)            │
       │                                                  │
       │  [ Tactical Radar ]      [ Comms Stream ]        │
       │  [ Telemetry / Horizon ] [ Voice Approval Bay ]  │
       └──────────────┬────────────────────┬──────────────┘
                      │                    │
              (Audio In / STT)     (Audio Out / TTS)
                      ▼                    ▼
             [ Whisper Tiny ]     [ Piper ONNX Engine ]
```

---

## 📦 Installation & Setup

### 1. Automatic Voice Engine Setup
To install Whisper Tiny and Piper voice models automatically:
```bash
npm run setup-models
# or run the helper script directly:
bash scripts/setup_voice.sh
```

### 2. Build from Source
```bash
npm install
npm run build
```

### 3. Run Unit Tests
```bash
npm test
```

---

## 🚀 Usage

### Launch the HUD
```bash
# Via npm
npm run hud

# Or via binary (if npm link is used)
termagenthud
```

### Connect with Antigravity CLI / Codex CLI (MCP Configuration)
Add `termagenthud` to your agent's MCP configuration file (e.g. `mcp.json` or `.gemini/antigravity-cli/mcp.json`):

```json
{
  "mcpServers": {
    "jarvis-hud": {
      "command": "node",
      "args": ["/path/to/termagenthud/dist/mcp-server.js"]
    }
  }
}
```

---

## ⌨️ Controls & Hotkeys

| Key / Voice Command | Action |
| --- | --- |
| `Jarvis, approve` / `[Y]` | Approve pending agent command/operation |
| `Computer, reject` / `[N]` | Reject pending agent command/operation |
| `Jarvis, status report` | Voice report on system status & radar |
| `[S]` | Simulate an incoming MCP voice authorization request |
| `[Q]` / `Esc` | Quit HUD |

---

## 📜 License
MIT License. Built for autonomous AI agents and pilots.
