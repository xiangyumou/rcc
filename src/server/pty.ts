import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { detectState } from './state-detector';
import { DetectedState } from '../shared/types';

export interface PTYOptions {
  cwd: string;
  cols?: number;
  rows?: number;
  env?: { [key: string]: string | undefined };
}

export class PTYProcess extends EventEmitter {
  private process: pty.IPty | null = null;
  private buffer: string = '';
  private currentState: DetectedState = { type: 'normal' };
  private commandBuffer: string = '';

  constructor(
    private sessionId: string,
    private shell: string,
    private args: string[],
    private options: PTYOptions
  ) {
    super();
  }

  start(): void {
    if (this.process) {
      return;
    }

    const env = {
      ...process.env,
      ...this.options.env,
      TERM: 'xterm-256color'
    };

    this.process = pty.spawn(this.shell, this.args, {
      name: 'xterm-256color',
      cols: this.options.cols || 80,
      rows: this.options.rows || 24,
      cwd: this.options.cwd,
      env: env as { [key: string]: string }
    });

    this.process.onData((data: string) => {
      this.buffer += data;

      // Keep buffer size manageable (last 10KB)
      if (this.buffer.length > 10240) {
        this.buffer = this.buffer.slice(-10240);
      }

      // Detect state changes
      const newState = detectState(data);
      if (newState.type !== 'normal' && newState.type !== this.currentState.type) {
        this.currentState = newState;
        this.emit('stateChange', newState);
      }

      this.emit('data', data);
    });

    this.process.onExit(({ exitCode, signal }) => {
      this.emit('exit', { exitCode, signal });
      this.process = null;
    });
  }

  write(data: string): void {
    if (this.process) {
      this.process.write(data);

      // Track command buffer for local echo detection
      if (data === '\r' || data === '\n') {
        this.commandBuffer = '';
      } else if (data === '\u007f' || data === '\b') {
        // Backspace
        this.commandBuffer = this.commandBuffer.slice(0, -1);
      } else if (data.charCodeAt(0) >= 32) {
        this.commandBuffer += data;
      }
    }
  }

  resize(cols: number, rows: number): void {
    if (this.process) {
      this.process.resize(cols, rows);
    }
  }

  kill(signal?: string): void {
    if (this.process) {
      this.process.kill(signal);
      this.process = null;
    }
  }

  getPid(): number | undefined {
    return this.process?.pid;
  }

  isRunning(): boolean {
    return this.process !== null;
  }

  getBuffer(): string {
    return this.buffer;
  }

  getCurrentState(): DetectedState {
    return this.currentState;
  }

  clearBuffer(): void {
    this.buffer = '';
  }
}

// Default claude command path - can be overridden by CLAUDE_PATH env var
// On macOS with Homebrew: /opt/homebrew/bin/claude (Apple Silicon) or /usr/local/bin/claude (Intel)
const DEFAULT_CLAUDE_PATH = '/opt/homebrew/bin/claude';

export function createClaudePTY(
  sessionId: string,
  cwd: string,
  options: string[] = [],
  ptyOptions: Partial<PTYOptions> = {}
): PTYProcess {
  // Use environment variable or default path
  const command = process.env.CLAUDE_PATH || DEFAULT_CLAUDE_PATH;
  const args = [...options];

  return new PTYProcess(sessionId, command, args, {
    cwd,
    cols: 80,
    rows: 24,
    ...ptyOptions
  });
}

export function createShellPTY(
  sessionId: string,
  cwd: string,
  ptyOptions: Partial<PTYOptions> = {}
): PTYProcess {
  const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash';
  const args: string[] = [];

  return new PTYProcess(sessionId, shell, args, {
    cwd,
    cols: 80,
    rows: 24,
    ...ptyOptions
  });
}
