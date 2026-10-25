# 🚀 TermAgentHUD (JARVIS Tactical Fighter-Jet HUD)

A high-tech, tactical fighter-jet and JARVIS-inspired Terminal HUD for any Terminal AI Agent (such as **Google Antigravity CLI**, **OpenAI Codex CLI**, **Claude Code**, or custom agents). 

Featuring **Zero-Dependency Native WebSocket & HTTP servers**, **Open-Source Voice AI** (Whisper Tiny STT + Piper TTS) with ultra-low RAM usage (~140MB), and complete interactive terminal agent control.

![HUD Tactical Deck](https://raw.githubusercontent.com/sidx1-scratch/termagenthud/main/docs/hud-preview.png)

---

## ⚡ 1-Line Universal Install (Zero Setup Needed)

Anyone can install the full JARVIS Tactical HUD with **a single command**. You don't even need to clone the repository manually—the bootstrap script does everything:

```bash
curl -sSL https://raw.githubusercontent.com/sidx1-scratch/termagenthud/main/install.sh | sudo bash
```

### What the 1-Line Script Automatically Does:
1. Detects your OS and ensures system audio/build tools are installed.
2. Clones the latest TermAgentHUD engine into `~/.local/share/termagenthud`.
3. Prompts you to pick your default terminal AI agent (**Antigravity, Claude Code, OpenCode, OpenClaw, Codex, Cursor**).
4. **Auto-injects the MCP server** into your chosen agent's configuration file.
5. Pre-downloads **Whisper Tiny INT8** and **Piper Lessac ONNX** models (~140MB RAM).
6. Links `termagenthud` into `/usr/local/bin` and `~/.local/bin` so you can run it from **any folder**.

---

## 🚀 Running TermAgentHUD

Open any terminal in any directory and run:
```bash
termagenthud
```

- **Runs attached to the terminal** so the selected agent, voice engine, and MCP bridge stay visible and connected. Use your terminal supervisor if you want daemon mode.
- **Pops open the Cybernetic HUD** in your default browser at `http://localhost:3000`.
- **Starts Whisper Tiny STT + Piper TTS** with wake words *"Jarvis"*, *"Computer"*, or *"Agent"*.
- **Launches your agent** (`agy`, `claude`, etc.) in an interactive real pseudo-terminal (PTY).

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
> *"Jarvis, /model your-model"*
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

#### Global Binary Configuration (Recommended - works anywhere on any system):
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

Or using an environment variable / relative path:
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
