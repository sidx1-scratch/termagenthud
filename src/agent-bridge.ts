import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const ptyBridgeScript = path.join(rootDir, 'scripts', 'pty_bridge.py');

export interface SupportedAgent {
  id: string;
  name: string;
  binaries: string[];
  description: string;
}

export const KNOWN_AGENTS: SupportedAgent[] = [
  {
    id: 'antigravity',
    name: 'Google Antigravity CLI',
    binaries: ['agy', 'antigravity', '/home/sidx1/.local/bin/agy'],
    description: 'Google Antigravity autonomous agent CLI',
  },
  {
    id: 'claude-code',
    name: 'Claude Code CLI',
    binaries: ['claude'],
    description: 'Anthropic Claude Code autonomous terminal assistant',
  },
  {
    id: 'opencode',
    name: 'OpenCode CLI',
    binaries: ['opencode', 'open-code'],
    description: 'Open-source local & API coding agent',
  },
  {
    id: 'openclaw',
    name: 'OpenClaw CLI',
    binaries: ['openclaw', 'claw'],
    description: 'OpenClaw terminal AI coding engine',
  },
  {
    id: 'codex',
    name: 'OpenAI Codex CLI',
    binaries: ['codex', 'openai-codex'],
    description: 'OpenAI Codex command line agent',
  },
  {
    id: 'aider',
    name: 'Aider AI Pair Programmer',
    binaries: ['aider'],
    description: 'Terminal AI pair programming with git sync',
  },
  {
    id: 'custom',
    name: 'Custom Shell / Terminal Agent',
    binaries: ['bash', 'sh'],
    description: 'Any arbitrary terminal agent or shell wrapper',
  },
];

export class AgentSessionBridge extends EventEmitter {
  private ptyProcess: ChildProcess | null = null;
  private buffer = '';
  private workingDir: string = process.cwd();
  private activeAgent: SupportedAgent = KNOWN_AGENTS[0];
  private currentPid: number | undefined;

  constructor(workingDir?: string) {
    super();
    if (workingDir) {
      this.workingDir = workingDir;
    }
    this.detectInstalledAgent();
  }

  public detectInstalledAgent(): SupportedAgent {
    // Check if agy exists in PATH or user local bin
    if (fs.existsSync('/home/sidx1/.local/bin/agy')) {
      this.activeAgent = KNOWN_AGENTS[0];
      return this.activeAgent;
    }
    this.activeAgent = KNOWN_AGENTS[0];
    return this.activeAgent;
  }

  public setAgent(agentId: string) {
    const found = KNOWN_AGENTS.find((a) => a.id === agentId || a.binaries.includes(agentId));
    if (found) {
      this.activeAgent = found;
      this.emit('agent_changed', found);
    }
  }

  public getActiveAgent(): SupportedAgent {
    return this.activeAgent;
  }

  public setWorkingDir(dir: string) {
    this.workingDir = dir;
  }

  public getWorkingDir(): string {
    return this.workingDir;
  }

  public isRunning(): boolean {
    return this.ptyProcess !== null && !this.ptyProcess.killed;
  }

  public getPid(): number | undefined {
    return this.currentPid;
  }

  public startAgent(command?: string, args: string[] = [], cwd?: string) {
    if (this.ptyProcess) {
      try {
        this.writePtyAction({ action: 'kill' });
        this.ptyProcess.kill();
      } catch {}
    }

    const runDir = cwd || this.workingDir || process.cwd();
    let targetBin = command || this.activeAgent.binaries[0];

    // Resolve full path if available
    if (targetBin === 'agy' && fs.existsSync('/home/sidx1/.local/bin/agy')) {
      targetBin = '/home/sidx1/.local/bin/agy';
    }

    const fullCmd = [targetBin, ...args];

    // Spawn via Python pty_bridge to allocate a real pseudo-terminal
    this.ptyProcess = spawn('python3', [ptyBridgeScript, ...fullCmd], {
      cwd: runDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        FORCE_COLOR: '1',
      },
    });

    this.ptyProcess.stdout?.on('data', (data) => {
      const lines = data.toString('utf8').split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'started') {
            this.currentPid = parsed.pid;
            this.emit('started', { command: parsed.command, pid: parsed.pid, agent: this.activeAgent });
          } else if (parsed.type === 'output') {
            this.handleOutput(parsed.data);
          } else if (parsed.type === 'exit') {
            this.emit('exit', parsed.code);
            this.ptyProcess = null;
          }
        } catch {
          this.handleOutput(line + '\n');
        }
      }
    });

    this.ptyProcess.stderr?.on('data', (data) => {
      this.handleOutput(data.toString('utf8'));
    });

    this.ptyProcess.on('exit', (code) => {
      this.emit('exit', code);
      this.ptyProcess = null;
    });
  }

  private writePtyAction(payload: any) {
    if (this.ptyProcess && this.ptyProcess.stdin && !this.ptyProcess.stdin.destroyed) {
      this.ptyProcess.stdin.write(JSON.stringify(payload) + '\n');
    }
  }

  public writeInput(input: string) {
    if (!this.isRunning()) {
      // Auto-launch the agent with the provided task
      this.startAgent(this.activeAgent.binaries[0], [input]);
      return;
    }

    const cleanInput = input.endsWith('\n') ? input : input + '\n';
    this.writePtyAction({ action: 'write', data: cleanInput });
  }

  public sendApproval(approved: boolean) {
    if (!this.isRunning()) return;
    const key = approved ? 'y\n' : 'n\n';
    this.writePtyAction({ action: 'write', data: key });
  }

  private handleOutput(chunk: string) {
    this.emit('output', chunk);
    this.buffer += chunk;

    // Check for interactive confirmations
    const confirmPatterns = [
      /\[y\/n\]/i,
      /\(y\/n\)/i,
      /\[yes\/no\]/i,
      /proceed\?/i,
      /approve/i,
      /permission check/i,
      /confirm\?/i,
      /allow execution\?/i,
      /apply this change\?/i,
      /run this command\?/i,
    ];

    const lines = chunk.split('\n');
    for (const line of lines) {
      for (const pattern of confirmPatterns) {
        if (pattern.test(line)) {
          this.emit('approval_required', {
            promptText: line.trim().replace(/\x1b\[[0-9;]*m/g, ''),
            rawLine: line,
          });
          break;
        }
      }

      if (line.includes('invoke_subagent') || line.includes('Subagent') || line.includes('Subtask')) {
        this.emit('subagent', {
          name: this.activeAgent.name,
          action: line.trim().replace(/\x1b\[[0-9;]*m/g, ''),
        });
      }
    }
  }

  public kill() {
    if (this.ptyProcess) {
      this.writePtyAction({ action: 'kill' });
      this.ptyProcess.kill();
      this.ptyProcess = null;
    }
  }
}
