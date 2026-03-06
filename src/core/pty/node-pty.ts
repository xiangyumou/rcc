import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import {
  PTYAdapter,
  PTYOptions,
  PTYExitInfo,
  PTYError
} from './types';

/**
 * node-pty implementation of PTYAdapter
 */
export class NodePTYAdapter extends EventEmitter implements PTYAdapter {
  private process: pty.IPty | null = null;
  private buffer: string = '';

  constructor(
    private readonly sessionId: string,
    private readonly command: string,
    private readonly args: string[],
    private readonly options: PTYOptions
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

    try {
      this.process = pty.spawn(this.command, this.args, {
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

        this.emit('data', data);
      });

      this.process.onExit(({ exitCode, signal }) => {
        this.emit('exit', { exitCode, signal });
        this.process = null;
      });
    } catch (error) {
      throw new PTYError(
        `Failed to spawn PTY: ${(error as Error).message}`,
        'SPAWN_ERROR'
      );
    }
  }

  write(data: string): void {
    if (this.process) {
      try {
        this.process.write(data);
      } catch (error) {
        throw new PTYError(
          `Failed to write to PTY: ${(error as Error).message}`,
          'WRITE_ERROR'
        );
      }
    }
  }

  resize(cols: number, rows: number): void {
    if (this.process) {
      try {
        this.process.resize(cols, rows);
      } catch (error) {
        throw new PTYError(
          `Failed to resize PTY: ${(error as Error).message}`,
          'RESIZE_ERROR'
        );
      }
    }
  }

  kill(signal?: string): void {
    if (this.process) {
      this.process.kill(signal);
      this.process = null;
    }
  }

  isRunning(): boolean {
    return this.process !== null;
  }

  getPid(): number | undefined {
    return this.process?.pid;
  }

  getBuffer(): string {
    return this.buffer;
  }

  clearBuffer(): void {
    this.buffer = '';
  }
}

/**
 * Factory for creating NodePTYAdapter instances
 */
export class NodePTYFactory {
  create(
    sessionId: string,
    command: string,
    args: string[],
    options: PTYOptions
  ): PTYAdapter {
    return new NodePTYAdapter(sessionId, command, args, options);
  }
}

export const nodePTYFactory = new NodePTYFactory();
