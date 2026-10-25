import { spawn, ChildProcess, execSync } from 'child_process';
import { EventEmitter } from 'events';

export interface ApprovalPromptEvent {
  promptText: string;
  rawLine: string;
}

export interface SupportedAgent {
  id: string;
  name: string;
  binaries: string[];
  defaultArgs?: string[];
  description: string;
}

// Built-in registry of every major AI CLI Coder
export const KNOWN_AGENTS: SupportedAgent[] = [
  {
    id: 'antigravity',
    name: 'Google Antigravity CLI',
    binaries: ['agy', 'antigravity'],
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
    id: 'cursor-cli',
    name: 'Cursor CLI',
    binaries: ['cursor-agent', 'cursor'],
    description: 'Cursor agent command line bridge',
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    binaries: ['gemini', 'gemini-cli'],
    description: 'Google Gemini CLI developer assistant',
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot CLI',
    binaries: ['copilot', 'gh copilot'],
    description: 'GitHub Copilot in the CLI',
  },
  {
    id: 'custom',
    name: 'Custom Shell / Terminal Agent',
    binaries: ['bash', 'sh'],
    description: 'Any arbitrary terminal agent or shell wrapper',
  },
];

export class AgentSessionBridge extends EventEmitter {
  private child: ChildProcess | null = null;
  private buffer = '';
  private currentTool: string = 'IDLE';
  private workingDir: string = process.cwd();
  private activeAgent: SupportedAgent = KNOWN_AGENTS[0];

  constructor(workingDir?: string) {
    super();
    if (workingDir) {
      this.workingDir = workingDir;
    }
    this.detectInstalledAgent();
  }

  public detectInstalledAgent(): SupportedAgent {
    for (const agent of KNOWN_AGENTS) {
      for (const bin of agent.binaries) {
        try {
          execSync(`which ${bin.split(' ')[0]} 2>/dev/null`);
          this.activeAgent = agent;
          return agent;
        } catch {}
      }
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
    return this.child !== null && !this.child.killed;
  }

  public getPid(): number | undefined {
    return this.child?.pid;
  }

  public startAgent(command?: string, args: string[] = [], cwd?: string) {
    if (this.child) {
      try { this.child.kill(); } catch {}
    }

    const runDir = cwd || this.workingDir || process.cwd();
    const cmdToRun = command || this.activeAgent.binaries[0];

    // Spawn agent process in target project directory with full interactive pipe control
    this.child = spawn(cmdToRun, args, {
      cwd: runDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' },
      shell: true,
    });

    this.child.stdout?.on('data', (data) => {
      const text = data.toString('utf8');
      this.handleOutput(text);
    });

    this.child.stderr?.on('data', (data) => {
      const text = data.toString('utf8');
      this.handleOutput(text);
    });

    this.child.on('exit', (code) => {
      this.emit('exit', code);
      this.child = null;
    });

    this.child.on('error', (err) => {
      this.emit('error', err);
    });

    this.emit('started', { command: cmdToRun, pid: this.child.pid, agent: this.activeAgent });
  }

  public writeInput(input: string) {
    if (!this.child || !this.child.stdin || this.child.stdin.destroyed) {
      // Auto-launch current agent with initial prompt
      this.startAgent(this.activeAgent.binaries[0], [input]);
      return;
    }

    const cleanInput = input.endsWith('\n') ? input : input + '\n';
    this.child.stdin.write(cleanInput);
  }

  public sendApproval(approved: boolean) {
    if (!this.child || !this.child.stdin) return;
    const key = approved ? 'y\n' : 'n\n';
    this.child.stdin.write(key);
  }

  private handleOutput(chunk: string) {
    this.emit('output', chunk);
    this.buffer += chunk;

    // Universal confirmation detector across all AI terminal agents
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
      /do you want to execute/i,
    ];

    const lines = chunk.split('\n');
    for (const line of lines) {
      for (const pattern of confirmPatterns) {
        if (pattern.test(line)) {
          this.emit('approval_required', {
            promptText: line.trim().replace(/\x1b\[[0-9;]*m/g, ''), // Strip ANSI
            rawLine: line,
          });
          break;
        }
      }

      // Universal Subagent detector
      if (
        line.includes('invoke_subagent') ||
        line.includes('Subagent') ||
        line.includes('Subtask') ||
        line.includes('worker') ||
        line.includes('spawn agent')
      ) {
        this.emit('subagent', {
          name: this.activeAgent.name,
          action: line.trim().replace(/\x1b\[[0-9;]*m/g, ''),
        });
      }

      // Tool Call detector
      if (line.includes('call:') || line.includes('Tool:') || line.includes('Action:')) {
        this.emit('tool_call', line.trim());
      }
    }
  }

  public kill() {
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
  }
}
