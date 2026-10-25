import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { NativeWebSocketServer, NativeWebSocket } from './zero-ws.js';
import { AgentSessionBridge } from './agent-bridge.js';
import { VoiceEngine, VoiceEvent } from './voice-engine.js';
import { autoInstallVoice } from './setup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
};

export class NativeJarvisWebServer extends EventEmitter {
  private server: http.Server;
  private wss: NativeWebSocketServer;
  private agentBridge: AgentSessionBridge;
  private voice: VoiceEngine;
  private port: number;
  private wsPort: number = Number(process.env.TERMAGENTHUD_WS_PORT || 19842);
  private pendingApproval: { promptText: string; rawLine: string; requestId?: string } | null = null;

  constructor(port = 3000) {
    super();
    this.port = port;
    this.voice = new VoiceEngine();
    this.agentBridge = new AgentSessionBridge();

    // 100% Zero-Dependency HTTP Static File & API Server
    this.server = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    // 100% Zero-Dependency RFC6455 WebSocket Server
    this.wss = new NativeWebSocketServer(this.wsPort);
    this.initWebSocketEvents();
    this.initAgentEvents();
    // Finish voice setup before starting Whisper, otherwise the first launch
    // can start a listener with missing dependencies and never recover.
    autoInstallVoice();
    this.initVoiceEvents();
  }

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    let pathname = url.pathname;

    // REST API routes
    if (pathname.startsWith('/api/')) {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            this.handleApiRoute(pathname, data, res);
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
      } else if (req.method === 'GET' && pathname === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          running: this.agentBridge.isRunning(),
          pid: this.agentBridge.getPid(),
        }));
      } else {
        res.writeHead(404);
        res.end();
      }
      return;
    }

    // Static Assets from /public
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.normalize(path.join(publicDir, pathname));

    // Security check to avoid path traversal
    if (!filePath.startsWith(publicDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
  }

  private handleApiRoute(endpoint: string, data: any, res: http.ServerResponse) {
    if (endpoint === '/api/start-agent') {
      const cmd = data.command || this.agentBridge.getActiveAgent().binaries[0];
      const args = data.args || [];
      const cwd = data.cwd || process.cwd();
      this.agentBridge.setWorkingDir(cwd);
      this.agentBridge.startAgent(cmd, args, cwd);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'started', command: cmd, cwd }));
    } else if (endpoint === '/api/select-agent') {
      if (data.agentId) {
        this.agentBridge.setAgent(data.agentId);
        this.agentBridge.startAgent(this.agentBridge.getActiveAgent().binaries[0], [], this.agentBridge.getWorkingDir());
        this.voice.speak(`Target agent switched to ${this.agentBridge.getActiveAgent().name}`);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'agent_selected', agent: this.agentBridge.getActiveAgent() }));
    } else if (endpoint === '/api/set-cwd') {
      const newCwd = data.cwd || process.cwd();
      this.agentBridge.setWorkingDir(newCwd);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'cwd_updated', cwd: newCwd }));
    } else if (endpoint === '/api/send-command') {
      this.agentBridge.writeInput(data.command);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'sent' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }
  }

  private initWebSocketEvents() {
    this.wss.on('connection', (ws: NativeWebSocket) => {
      // Send current agent status & working directory
      ws.send(JSON.stringify({
        type: 'AGENT_STATUS',
        running: this.agentBridge.isRunning(),
        cwd: this.agentBridge.getWorkingDir(),
        agent: this.agentBridge.getActiveAgent(),
      }));

      ws.on('message', (message: string) => {
        try {
          const payload = JSON.parse(message);
          this.handleClientMessage(payload);
        } catch {}
      });
    });
  }

  private initAgentEvents() {
    this.agentBridge.on('output', (text: string) => {
      this.wss.broadcast(JSON.stringify({
        type: 'AGENT_OUTPUT',
        data: text,
      }));
    });

    this.agentBridge.on('approval_required', (info: { promptText: string; rawLine: string }) => {
      this.pendingApproval = info;
      this.wss.broadcast(JSON.stringify({
        type: 'APPROVAL_REQUEST',
        requestId: undefined,
        command: info.promptText,
        explanation: 'Confirmation required by terminal agent',
      }));

      this.voice.speak(`Commander, confirmation requested: ${info.promptText}. Do you want to approve?`);
    });

    this.agentBridge.on('subagent', (info: { name: string; action: string }) => {
      this.wss.broadcast(JSON.stringify({
        type: 'SUBAGENT_ACTIVITY',
        name: info.name,
        action: info.action,
      }));
      this.voice.speak(`Subagent ${info.name} initiated: ${info.action}`);
    });

    this.agentBridge.on('exit', (code: number | null) => {
      this.wss.broadcast(JSON.stringify({
        type: 'AGENT_EXIT',
        code,
      }));
    });
  }

  private initVoiceEvents() {
    this.voice.on('transcript', (evt: VoiceEvent) => {
      this.wss.broadcast(JSON.stringify({
        type: 'LOG',
        text: `[VOICE-TRANSCRIPT] "${evt.raw}"`,
      }));
    });

    this.voice.on('command', (evt: VoiceEvent) => {
      this.handleVoiceCommand(evt);
    });

    this.voice.startListening();
  }

  private handleVoiceCommand(evt: VoiceEvent) {
    const raw = (evt.command || '').trim();
    const lower = raw.toLowerCase();

    // 1. Approval Resolution
    if (this.pendingApproval) {
      if (lower.includes('yes') || lower.includes('approve') || lower.includes('confirm') || lower.includes('do it') || lower.includes('proceed')) {
        this.resolveApproval(true);
        return;
      }
      if (lower.includes('no') || lower.includes('reject') || lower.includes('cancel') || lower.includes('abort') || lower.includes('deny')) {
        this.resolveApproval(false);
        return;
      }
    }

    // 2. Direct AI Instruction e.g.: "Jarvis build a weather app" or "Jarvis change model to flash"
    let task = raw;
    if (lower.startsWith('build ') || lower.startsWith('create ') || lower.startsWith('make ') || lower.startsWith('run ') || lower.startsWith('execute ')) {
      task = raw;
    }

    if (lower.startsWith('/model') || lower.startsWith('model ')) {
      // Model change slash command
      const modelTarget = raw.replace(/^(?:\/model|model)\s*/i, '');
      this.agentBridge.writeInput(`/model ${modelTarget}`);
      this.voice.speak(`Switching model configuration to ${modelTarget}`);
      return;
    }

    if (lower.startsWith('/')) {
      // Direct pass-through of any slash commands (/goal, /plan, /compact, /schedule, etc.)
      this.agentBridge.writeInput(raw);
      this.voice.speak(`Executing slash command ${raw.split(' ')[0]}`);
      return;
    }

    // Otherwise pass voice converted text prompt to agent
    this.voice.speak(`Acknowledged. Instructing agent: ${task}`);
    this.agentBridge.writeInput(task);
  }

  private resolveApproval(approved: boolean) {
    if (!this.pendingApproval) return;
    const requestId = this.pendingApproval.requestId;
    this.agentBridge.sendApproval(approved);
    this.pendingApproval = null;
    this.wss.broadcast(JSON.stringify({
      type: 'APPROVAL_RESPONSE',
      approved,
      requestId,
    }));
    this.voice.speak(approved ? 'Command approved. Executing.' : 'Command rejected.');
  }

  private handleClientMessage(msg: any) {
    if (msg.type === 'APPROVAL_REQUEST') {
      this.pendingApproval = {
        promptText: msg.command || 'Approval requested',
        rawLine: msg.explanation || '',
        requestId: msg.requestId,
      };
      this.wss.broadcast(JSON.stringify(msg));
      this.voice.speak(`Commander, approval requested: ${msg.explanation || msg.command}. Do you authorize?`);
    } else if (msg.type === 'APPROVAL_RESPONSE') {
      this.resolveApproval(!!msg.approved);
    } else if (msg.type === 'TRANSMIT_COMMAND') {
      this.agentBridge.writeInput(msg.command);
    } else if (msg.type === 'START_AGENT') {
      const cwd = msg.cwd || this.agentBridge.getWorkingDir();
      this.agentBridge.setWorkingDir(cwd);
      this.agentBridge.startAgent(msg.command || this.agentBridge.getActiveAgent().binaries[0], msg.args || [], cwd);
    } else if (msg.type === 'SELECT_AGENT') {
      if (msg.agentId) {
        this.agentBridge.setAgent(msg.agentId);
        // A selection is operational: immediately attach the selected agent to the HUD.
        this.agentBridge.startAgent(this.agentBridge.getActiveAgent().binaries[0], [], this.agentBridge.getWorkingDir());
        this.voice.speak(`Active agent switched to ${this.agentBridge.getActiveAgent().name}`);
        this.wss.broadcast(JSON.stringify({
          type: 'AGENT_STATUS',
          running: this.agentBridge.isRunning(),
          cwd: this.agentBridge.getWorkingDir(),
          agent: this.agentBridge.getActiveAgent(),
        }));
      }
    } else if (msg.type === 'SET_CWD') {
      if (msg.cwd) {
        this.agentBridge.setWorkingDir(msg.cwd);
        this.voice.speak(`Working directory updated.`);
      }
    }
  }

  public start(autoOpen = true): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        const url = `http://localhost:${this.port}`;
        console.log(`\n===============================================================`);
        console.log(`🚀 ZERO-DEPENDENCY JARVIS TACTICAL HUD ONLINE!`);
        console.log(`🌐 Web HUD Dashboard: ${url}`);
        console.log(`⚡ Zero-Dep Native RFC6455 WebSocket: port ${this.wsPort}`);
        console.log(`🎙️ Voice Engine: Whisper Tiny INT8 + Piper Lessac (low-RAM)`);
        console.log(`⚡ Full Terminal AI Agent Control (Slash commands, Prompts, Subagents)`);
        console.log(`===============================================================\n`);

        if (autoOpen) {
          // Zero-dependency browser opener using standard linux/mac/windows commands
          const opener = process.platform === 'darwin' ? 'open' : (process.platform === 'win32' ? 'start' : 'xdg-open');
          try {
            spawn(opener, [url], { detached: true, stdio: 'ignore' }).unref();
          } catch {}
        }

        // Auto-detect and connect to agent session if active
        resolve();
      });
    });
  }
}
