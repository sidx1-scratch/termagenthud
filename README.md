# 🚀 TermAgentHUD (JARVIS Tactical Fighter-Jet HUD)

A high-tech, tactical fighter-jet and JARVIS-inspired Terminal HUD for any Terminal AI Agent (such as **Google Antigravity CLI**, **OpenAI Codex CLI**, **Claude Code**, or custom agents). 

Featuring **Zero-Dependency Native WebSocket & HTTP servers**, **Open-Source Voice AI** (Whisper Tiny STT + Piper TTS) with ultra-low RAM usage (~140MB), and complete interactive terminal agent control.

![HUD Tactical Deck](https://raw.githubusercontent.com/sidx1-scratch/termagenthud/main/docs/hud-preview.png)

---

## ⚡ 1-Step Fully Automatic Installation

Run the automatic installer (use `sudo` so `npm link` can install the `termagenthud` command globally across your system):

```bash
# Clone the repository
git clone https://github.com/sidx1-scratch/termagenthud.git
cd termagenthud

# Run fully automatic setup (with sudo for npm link global install)
sudo ./scripts/install.sh
```

### What the Automatic Installer Does:
1. **Compiles TypeScript core** into high-performance JS.
2. **Runs `npm link`** to provide the global `termagenthud` command.
3. **Sets up an isolated Python virtual environment** (`.venv`).
4. **Downloads Whisper Tiny (INT8 Quantized)** for instant, low-latency Speech-to-Text with negligible memory usage (~140MB).
5. **Downloads Piper Voice Engine & the best default voice** (`en_US-lessac-low`, ~28MB) for natural JARVIS vocal synthesis.

---

## 🚀 Running the HUD

Simply open any terminal and execute:
```bash
termagenthud
```
- The HUD automatically starts the background engine and opens **`http://localhost:3000`** in your default web browser.
- You can keep your terminal minimized or running in the background.

To run directly inside the terminal as an ASCII TUI:
```bash
termagenthud --terminal
```

---

## 🎙️ Full Agent Control with Voice Commands

TermAgentHUD controls **every feature** of your terminal AI agent:

### 1. Build Any App Idea
Say:
> *"Jarvis, build a real-time weather app with React"*  
> *"Computer, create a CLI pomodoro timer in Go"*

The HUD transcribes your speech via Whisper Tiny, routes the prompt into the agent's input stream, and the agent begins coding immediately while telemetry streams to the HUD.

### 2. Slash Commands (`/model`, `/plan`, `/goal`, etc.)
Say:
> *"Jarvis, /model gemini-3.8-flash"*  
> *"Computer, /plan create new authentication flow"*  
> *"Agent, /goal finish all unit tests"*

Every slash command is recognized and directly executed by the agent without manual typing.

### 3. Voice Confirmations & Interactive Approvals
When an agent encounters a confirmation check (e.g., `Proceed? [y/N]`, `Allow command? (y/n)`, `Approve changes?`):
- **JARVIS prompts you aloud** via Piper TTS: *"Commander, confirmation requested: [command]. Do you want to approve?"*
- Say **"yes"**, **"approve"**, or **"proceed"** ➔ `y` is sent to the agent.
- Say **"no"**, **"reject"**, or **"cancel"** ➔ `n` is sent to the agent.
- Alternatively, click the green/red buttons on the HUD or press `Y`/`N`.

### 4. Universal Multi-Agent Support & Changing Target Agents

TermAgentHUD natively supports every terminal AI coder on the market:
- **Google Antigravity CLI** (`agy` / `antigravity`)
- **Claude Code** (`claude`)
- **OpenCode CLI** (`opencode`)
- **OpenClaw CLI** (`openclaw`)
- **OpenAI Codex CLI** (`codex`)
- **Aider AI** (`aider`)
- **Cursor CLI** (`cursor-agent`)
- **Gemini CLI** (`gemini`)
- **GitHub Copilot CLI** (`gh copilot`)
- **Custom Terminal Agent**

#### How to Switch or Change the Target Agent Command:
1. **Via the Browser HUD Selector**:
   - In the top navigation bar of the Web HUD (`http://localhost:3000`), click the **`TARGET: ...`** dropdown to switch between any agent instantly.
2. **Via Voice Command**:
   - Say: *"Jarvis, switch agent to opencode"* or *"Computer, set agent to openclaw"*.
3. **Specifying a Custom Agent Binary or Wrapper**:
   - In the Web HUD, choose **`TARGET: Custom Shell Agent`**.
   - Or send an API request:
     ```bash
     curl -X POST http://localhost:3000/api/start-agent \
       -H "Content-Type: application/json" \
       -d '{"command": "openclaw", "args": ["--interactive"], "cwd": "/path/to/project"}'
     ```
   - Alternatively, pass the agent command directly when starting:
     ```bash
     termagenthud --agent=openclaw
     # or
     termagenthud --agent="opencode --model deepseek-coder"
     ```

### 5. Subagent Tracking
Whenever the main agent spawns subagents (e.g. `invoke_subagent`, Research Subagents, background testers), they are detected and displayed as blips on the 360° tactical radar.

---

## 📡 Model Context Protocol (MCP) Server Integration

TermAgentHUD includes a first-class Model Context Protocol (MCP) server that any terminal AI agent (Google Antigravity CLI, Claude Code, Cursor, Codex CLI) can connect to for spoken alerts and tactical voice authorization.

### 1. Configuration for AI Agents

Add `jarvis-hud` to your agent's MCP configuration file (e.g., `~/.gemini/antigravity-cli/mcp.json`, `~/.claude/claude_desktop_config.json`, or `.cursor/mcp.json`):

#### Global Binary Configuration:
```json
{
  "mcpServers": {
    "jarvis-hud": {
      "command": "node",
      "args": ["/home/sidx1/termagenthud/dist/mcp-server.js"]
    }
  }
}
```

Or using the globally linked executable:
```json
{
  "mcpServers": {
    "jarvis-hud": {
      "command": "termagenthud",
      "args": ["--mcp"]
    }
  }
}
```

---

### 2. Available MCP Tools

Once linked, your AI agent gains access to 3 tactical HUD tools:

| MCP Tool Name | Description | Parameters |
| --- | --- | --- |
| `request_voice_approval` | Asks the user for vocal approval before executing a sensitive shell command or writing destructive file edits. Speaks the prompt aloud via Piper TTS, flashes the HUD red, and waits for a spoken *"Jarvis, approve"* or *"Computer, reject"*. | `command` (string), `explanation` (string), `timeoutSec` (number) |
| `speak_hud_announcement` | Announces mission status, task completions, or errors through Piper voice synthesis while logging to the HUD stream. | `message` (string), `level` (`info` \| `warning` \| `critical` \| `success`) |
| `update_hud_telemetry` | Streams real-time operational status (e.g., `ENGAGED`, `ANALYZING`, `IDLE`), current active tool, and progress % to the tactical HUD dials. | `status` (string), `activeTool` (string), `progress` (number) |

---

### 3. Example Agent Prompt

You can prompt your AI agent to utilize the HUD tools directly:

```
"Before executing any bash command that modifies files or makes git commits, call the request_voice_approval tool on the jarvis-hud MCP server so I can confirm it by voice."
```

---

## 🧪 Testing

Run comprehensive zero-dependency unit tests:
```bash
npm test
```

---

## 📜 License
MIT License. Built for autonomous AI agents and pilots.
