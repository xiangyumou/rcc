import { EventEmitter } from 'events';

/**
 * PTY Process Options
 */
export interface PTYOptions {
  /** Current working directory */
  cwd: string;

  /** Number of columns */
  cols?: number;

  /** Number of rows */
  rows?: number;

  /** Environment variables */
  env?: { [key: string]: string | undefined };
}

/**
 * PTY Process Exit Information
 */
export interface PTYExitInfo {
  exitCode: number;
  signal?: number;
}

/**
 * PTY Adapter Interface
 * Abstracts PTY operations for different implementations
 */
export interface PTYAdapter extends EventEmitter {
  /** Start the PTY process */
  start(): void;

  /** Write data to PTY */
  write(data: string): void;

  /** Resize PTY */
  resize(cols: number, rows: number): void;

  /** Kill PTY process */
  kill(signal?: string): void;

  /** Check if process is running */
  isRunning(): boolean;

  /** Get process ID */
  getPid(): number | undefined;

  /** Get current buffer content */
  getBuffer(): string;

  /** Clear the buffer */
  clearBuffer(): void;
}

/**
 * PTY Factory Interface
 * Creates PTY instances
 */
export interface PTYFactory {
  create(
    sessionId: string,
    command: string,
    args: string[],
    options: PTYOptions
  ): PTYAdapter;
}

/**
 * PTY Events
 */
export interface PTYEvents {
  /** Data received from PTY */
  data: (data: string) => void;

  /** PTY process exited */
  exit: (info: PTYExitInfo) => void;

  /** State changed (Claude-specific) */
  stateChange: (state: { type: string }) => void;
}

/**
 * PTY Error
 */
export class PTYError extends Error {
  constructor(
    message: string,
    public readonly code: 'SPAWN_ERROR' | 'WRITE_ERROR' | 'RESIZE_ERROR'
  ) {
    super(message);
    this.name = 'PTYError';
  }
}
