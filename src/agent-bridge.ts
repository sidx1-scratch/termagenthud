import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface ApprovalPromptEvent {
  promptText: string;
  rawLine: string;
}

export class AgentSessionBridge extends EventEmitter {
  private child: ChildProcess | null = null;
  private buffer = '';
  private currentTool: string = 'IDLE';
  private workingDir: string = process.cwd();

  constructor(workingDir?: string) {
    super();
    if (workingDir) {
      this.workingDir = workingDir;
    }
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

  public startAgent(command = 'agy', args: string[] = [], cwd?: string) {
    if (this.child) {
      try { this.child.kill(); } catch {}
    }

    const runDir = cwd || this.workingDir || process.cwd();

    // Spawn agent process in the target project directory with full pipe control
    this.child = spawn(command, args, {
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

    this.emit('started', { command, pid: this.child.pid });
  }

  public writeInput(input: string) {
    if (!this.child || !this.child.stdin || this.child.stdin.destroyed) {
      // If agent is not spawned yet, start it with this task
      this.startAgent('agy', [input]);
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

    // Detect Interactive Agent Prompts & Confirmations
    // Examples: "Proceed? [y/N]", "Allow command? (y/n)", "Approve changes? [Y/n]"
    const confirmPatterns = [
      /\[y\/n\]/i,
      /\(y\/n\)/i,
      /proceed\?/i,
      /approve/i,
      /permission check/i,
      /confirm\?/i,
      /allow execution\?/i,
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

      // Detect subagent invocations (e.g. invoke_subagent, research subagent, etc.)
      if (line.includes('invoke_subagent') || line.includes('Subagent') || line.includes('Subtask')) {
        this.emit('subagent', {
          name: 'Subagent Worker',
          action: line.trim().replace(/\x1b\[[0-9;]*m/g, ''),
        });
      }

      // Detect active tool invocation
      if (line.includes('call:') || line.includes('Tool:')) {
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
