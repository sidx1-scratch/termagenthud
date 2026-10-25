import express from 'express';
import * as http from 'http';
import * as path from 'path';
import open from 'open';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { VoiceEngine, VoiceEvent } from './voice-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export class JarvisWebServer {
  private app: express.Express;
  private server: http.Server;
  private wss: WebSocketServer;
  private voice: VoiceEngine;
  private port: number;
  private wsPort: number = 19842;
  private clients: Set<WebSocket> = new Set();
  private pendingApproval: { command: string; explanation: string } | null = null;

  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.voice = new VoiceEngine();

    // Serve HUD static assets
    this.app.use(express.static(path.join(rootDir, 'public')));
    this.app.use(express.json());

    // REST endpoints for external scripts or CLI pipes
    this.app.post('/api/approve-request', (req, res) => {
      const { command, explanation } = req.body;
      this.broadcast({
        type: 'APPROVAL_REQUEST',
        command: command || 'unspecified command',
        explanation: explanation || 'Verification required by agent',
      });
      this.voice.speak(`Commander, approval requested: ${explanation || command}. Do you authorize?`);
      res.json({ status: 'broadcasted' });
    });

    this.app.post('/api/speak', (req, res) => {
      const { message } = req.body;
      this.broadcast({ type: 'SPEAK', message });
      this.voice.speak(message);
      res.json({ status: 'spoken' });
    });

    // WebSocket Server on Port 19842 (shared with MCP)
    this.wss = new WebSocketServer({ port: this.wsPort });
    this.initWebSocket();
    this.initVoice();
  }

  private initWebSocket() {
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);

      ws.on('message', (data) => {
        try {
          const payload = JSON.parse(data.toString());
          this.handleClientMessage(payload, ws);
        } catch {}
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });
    });
  }

  private handleClientMessage(msg: any, sender: WebSocket) {
    if (msg.type === 'APPROVAL_RESPONSE') {
      const statusText = msg.approved ? 'authorized' : 'aborted';
      this.voice.speak(`Command ${statusText}.`);
      this.broadcast({
        type: 'TELEMETRY',
        status: msg.approved ? 'COMMAND EXECUTED' : 'COMMAND ABORTED',
      });
    } else if (msg.type === 'TRANSMIT_COMMAND') {
      this.voice.speak(`Tactical instruction received.`);
      this.broadcast({
        type: 'SPEAK',
        message: `Agent executing instruction: "${msg.command}"`,
      });
    } else {
      // Re-broadcast MCP approval requests or tool telemetry
      this.broadcast(msg, sender);
    }
  }

  private initVoice() {
    this.voice.on('status', (msg) => {
      this.broadcast({ type: 'LOG', text: `[VOICE-SYS] ${msg}` });
    });

    this.voice.on('speaking', (text) => {
      this.broadcast({ type: 'LOG', text: `[JARVIS-SPEAK] ${text}` });
    });

    this.voice.on('command', (evt: VoiceEvent) => {
      this.broadcast({
        type: 'LOG',
        text: `[VOICE-DETECTED] Wake: ${evt.wakeWord} | Action: ${evt.command}`,
      });
      const cmd = evt.command?.toLowerCase() || '';
      if (cmd.includes('approve') || cmd.includes('yes') || cmd.includes('execute')) {
        this.broadcast({ type: 'APPROVAL_RESPONSE', approved: true });
        this.voice.speak('Voice authorization confirmed.');
      } else if (cmd.includes('reject') || cmd.includes('no') || cmd.includes('abort') || cmd.includes('cancel')) {
        this.broadcast({ type: 'APPROVAL_RESPONSE', approved: false });
        this.voice.speak('Operation aborted by commander.');
      }
    });

    this.voice.startListening();
  }

  public broadcast(data: any, exclude?: WebSocket) {
    const raw = JSON.stringify(data);
    for (const client of this.clients) {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    }
  }

  public start(autoOpen = true): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, async () => {
        const url = `http://localhost:${this.port}`;
        console.log(`\n======================================================`);
        console.log(`🚀 JARVIS Fighter-Jet Tactical HUD Server Online!`);
        console.log(`🌐 Web HUD URL: ${url}`);
        console.log(`⚡ MCP Bridge Port: ${this.wsPort}`);
        console.log(`🎧 Wake words: "Jarvis", "Computer", "Agent"`);
        console.log(`======================================================\n`);

        if (autoOpen) {
          try {
            await open(url);
          } catch {
            // Silently continue if headless / terminal only
          }
        }
        resolve();
      });
    });
  }
}
