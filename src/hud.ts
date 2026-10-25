import blessed from 'blessed';
import { WebSocketServer, WebSocket } from 'ws';
import { VoiceEngine, VoiceEvent } from './voice-engine.js';
import chalk from 'chalk';

export class JarvisFighterHud {
  private screen: blessed.Widgets.Screen;
  private voice: VoiceEngine;
  private wss: WebSocketServer | null = null;
  private logsBox!: blessed.Widgets.Log;
  private telemetryBox!: blessed.Widgets.BoxElement;
  private approvalBox!: blessed.Widgets.BoxElement;
  private radarBox!: blessed.Widgets.BoxElement;
  private statusLine!: blessed.Widgets.BoxElement;
  private commandInput!: blessed.Widgets.TextboxElement;
  private radarAngle = 0;
  private radarTimer: NodeJS.Timeout | null = null;
  private pendingApproval: { command: string; explanation: string } | null = null;

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'JARVIS // FIGHTER-JET TACTICAL HUD (MCP)',
      cursor: {
        artificial: true,
        shape: 'line',
        blink: true,
        color: '#00ffff',
      },
    });

    this.voice = new VoiceEngine();
    this.initLayout();
    this.initVoiceEvents();
    this.initWebSocketServer();
    this.initRadarLoop();
  }

  private initLayout() {
    // Top HUD Title Header
    const header = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: ` {bold}{cyan-fg}◆◆◆ JARVIS TACTICAL FIGHTER-JET HUD ◆◆◆{/cyan-fg}{/bold}  |  SYSTEM: {green-fg}ONLINE{/green-fg}  |  VOICE: {yellow-fg}WHISPER-TINY + PIPER{/yellow-fg}  |  MCP: {cyan-fg}PORT 19842{/cyan-fg}`,
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        bg: 'black',
      },
    });

    // Left Tactical Radar & Pitch/Roll Artificial Horizon
    this.radarBox = blessed.box({
      parent: this.screen,
      top: 3,
      left: 0,
      width: '32%',
      height: '50%',
      label: ' [ TACTICAL RADAR / PITCH ] ',
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
      },
    });

    // Telemetry & Pitch ladder
    this.telemetryBox = blessed.box({
      parent: this.screen,
      top: '53%',
      left: 0,
      width: '32%',
      height: '35%',
      label: ' [ AGENT TELEMETRY ] ',
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
      },
      content: `  ALTITUDE : 32,000 FT\n  AIRSPEED : MACH 1.84\n  ENGINE   : 100% REHEAT\n  WEAPONS  : ARMED (MCP)\n  STT ENG  : WHISPER-TINY\n  TTS ENG  : PIPER LESSAC\n  STATUS   : COMBAT PATROL`,
    });

    // Central Mission Logs & Audio Waveform Feed
    this.logsBox = blessed.log({
      parent: this.screen,
      top: 3,
      left: '32%',
      width: '68%',
      height: '55%',
      label: ' [ JARVIS COMMS & AGENT ACTIVITY STREAM ] ',
      tags: true,
      scrollable: true,
      scrollbar: {
        ch: '█',
        track: { bg: 'black' },
        style: { inverse: true },
      },
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
      },
    });

    // Tactical Approval Bay (Center Bottom)
    this.approvalBox = blessed.box({
      parent: this.screen,
      top: '58%',
      left: '32%',
      width: '68%',
      height: '30%',
      label: ' [ TACTICAL VOICE APPROVAL BAY ] ',
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: 'yellow' },
      },
      content: `  {green-fg}SYSTEM READY.{/green-fg} Waiting for MCP approval requests...\n\n  Say {bold}"Jarvis, approve"{/bold} or {bold}"Computer, reject"{/bold} or press [Y] / [N] to override.`,
    });

    // Bottom Command / Voice Input bar
    this.statusLine = blessed.box({
      parent: this.screen,
      top: '88%',
      left: 0,
      width: '100%',
      height: 3,
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
      },
      content: ' {cyan-fg}WAKE WORDS:{/cyan-fg} "Jarvis" | "Computer" | "Agent"   {yellow-fg}[Keys:{/yellow-fg} [q]=Quit | [y]=Approve | [n]=Reject | [s]=Simulate MCP]',
    });

    // Keyboard Shortcuts
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.cleanup();
      process.exit(0);
    });

    this.screen.key(['y', 'Y'], () => {
      this.resolveApproval(true, 'User manual key override [Y]');
    });

    this.screen.key(['n', 'N'], () => {
      this.resolveApproval(false, 'User manual key override [N]');
    });

    this.screen.key(['s', 'S'], () => {
      this.simulateMcpRequest();
    });

    this.screen.render();
  }

  private initVoiceEvents() {
    this.voice.on('status', (msg) => {
      this.log(`{gray-fg}[VOICE-SYS]{/gray-fg} ${msg}`);
    });

    this.voice.on('speaking', (text) => {
      this.log(`{magenta-fg}[JARVIS-SPEAK]{/magenta-fg} "${text}"`);
    });

    this.voice.on('transcript', (evt: VoiceEvent) => {
      this.log(`{cyan-fg}[EAR]{/cyan-fg} "${evt.raw}"`);
    });

    this.voice.on('command', (evt: VoiceEvent) => {
      this.handleVoiceCommand(evt);
    });

    this.voice.startListening();
  }

  private initWebSocketServer() {
    try {
      this.wss = new WebSocketServer({ port: 19842 });
      this.wss.on('connection', (ws) => {
        this.log('{green-fg}[MCP-LINK]{/green-fg} Terminal Agent MCP client connected.');

        ws.on('message', (data) => {
          try {
            const payload = JSON.parse(data.toString());
            this.handleMcpMessage(payload);
          } catch (e) {
            // Ignore non-json
          }
        });

        ws.on('close', () => {
          this.log('{yellow-fg}[MCP-LINK]{/yellow-fg} Terminal Agent disconnected.');
        });
      });
    } catch (e) {
      this.log(`{red-fg}[MCP-ERR]{/red-fg} WebSocket bind failed: ${e}`);
    }
  }

  private handleMcpMessage(msg: any) {
    if (msg.type === 'APPROVAL_REQUEST') {
      this.pendingApproval = { command: msg.command, explanation: msg.explanation };
      this.approvalBox.setContent(
        `  {red-fg}{bold}⚡ TARGET LOCK: AUTHORIZATION REQUIRED ⚡{/bold}{/red-fg}\n\n` +
        `  COMMAND: {bold}{yellow-fg}${msg.command}{/yellow-fg}{/bold}\n` +
        `  REASON : ${msg.explanation}\n\n` +
        `  {cyan-fg}SAY:{/cyan-fg} "Jarvis, approve" or "Computer, reject"  |  Press [Y] or [N]`
      );
      this.voice.speak(`Commander, approval requested: ${msg.explanation}. Do you authorize?`);
      this.screen.render();
    } else if (msg.type === 'SPEAK') {
      this.log(`{yellow-fg}[MCP-ANNOUNCE]{/yellow-fg} ${msg.message}`);
      this.voice.speak(msg.message);
    } else if (msg.type === 'TELEMETRY') {
      this.log(`{cyan-fg}[TELEMETRY]{/cyan-fg} Status: ${msg.status || 'ACTIVE'}`);
      this.screen.render();
    }
  }

  public simulateMcpRequest() {
    this.handleMcpMessage({
      type: 'APPROVAL_REQUEST',
      command: 'git push origin main --force',
      explanation: 'Deploying high-velocity tactical patch to production main.',
    });
  }

  private handleVoiceCommand(evt: VoiceEvent) {
    const cmd = evt.command?.toLowerCase() || '';
    this.log(`{yellow-fg}[VOICE-CMD]{/yellow-fg} Wake: ${evt.wakeWord} | Action: "${cmd}"`);

    if (this.pendingApproval) {
      if (cmd.includes('approve') || cmd.includes('yes') || cmd.includes('proceed') || cmd.includes('execute') || cmd.includes('do it')) {
        this.resolveApproval(true, `Voice confirmed by ${evt.wakeWord}`);
        return;
      }
      if (cmd.includes('reject') || cmd.includes('no') || cmd.includes('abort') || cmd.includes('cancel')) {
        this.resolveApproval(false, `Voice aborted by ${evt.wakeWord}`);
        return;
      }
    }

    if (cmd.includes('status') || cmd.includes('report')) {
      this.voice.speak('All systems combat operational, sir. Tactical radar clear.');
    } else if (cmd.includes('clear')) {
      this.logsBox.setContent('');
      this.screen.render();
    } else {
      this.voice.speak(`Acknowledged, ${evt.wakeWord}. Command ${cmd} registered.`);
    }
  }

  private resolveApproval(approved: boolean, reason: string) {
    if (!this.pendingApproval) {
      this.log(`{gray-fg}No pending authorization.{/gray-fg}`);
      return;
    }

    if (approved) {
      this.log(`{green-fg}{bold}[AUTHORIZED]{/bold}{/green-fg} ${this.pendingApproval.command} (${reason})`);
      this.voice.speak('Command authorized. Executing tactical sequence.');
      this.approvalBox.setContent(`  {green-fg}{bold}✔ AUTHORIZATION GRANTED{/bold}{/green-fg}\n  Reason: ${reason}\n\n  Waiting for next tactical vector...`);
    } else {
      this.log(`{red-fg}{bold}[ABORTED]{/bold}{/red-fg} ${this.pendingApproval.command} (${reason})`);
      this.voice.speak('Command aborted.');
      this.approvalBox.setContent(`  {red-fg}{bold}✖ AUTHORIZATION DENIED{/bold}{/red-fg}\n  Reason: ${reason}\n\n  Waiting for next tactical vector...`);
    }

    this.pendingApproval = null;
    this.screen.render();
  }

  private initRadarLoop() {
    const sweepChars = ['/', '—', '\\', '|'];
    let tick = 0;

    this.radarTimer = setInterval(() => {
      tick++;
      const sweep = sweepChars[tick % sweepChars.length];
      const pitchOffset = Math.sin(tick * 0.1) * 3;

      let radarArt = `
      {cyan-fg}+-----------[ 360° RADAR ]-----------+{/cyan-fg}
               .  :  |  :  .
           .      \\  |  /      .
                 . \\ | / .
         - - - - - -${sweep}- - - - - -
                 . / | \\ .
           .      /  |  \\      .
               .  :  |  :  .
      {cyan-fg}+------------------------------------+{/cyan-fg}
       {bold}{yellow-fg}TARGET LOCK:{/yellow-fg}{/bold} 1 BOGEY DETECTED [AI_AGENT]
       {green-fg}ALT:{/green-fg} 32,450 FT | {green-fg}HEADING:{/green-fg} 042° TACTICAL
       {cyan-fg}STT:{/cyan-fg} WHISPER TINY  | {magenta-fg}TTS:{/magenta-fg} PIPER ONNX`;

      this.radarBox.setContent(radarArt);
      this.screen.render();
    }, 400);
  }

  public log(msg: string) {
    this.logsBox.log(`  ${msg}`);
    this.screen.render();
  }

  public cleanup() {
    if (this.radarTimer) clearInterval(this.radarTimer);
    if (this.wss) this.wss.close();
    this.voice.stopListening();
  }
}
