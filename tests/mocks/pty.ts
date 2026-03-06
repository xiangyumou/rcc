import { EventEmitter } from 'events';
import {
  PTYAdapter,
  PTYOptions,
  PTYExitInfo,
  PTYError
} from '../../src/core/pty/types';

/**
 * Mock PTY adapter for testing
 */
export class MockPTYAdapter extends EventEmitter implements PTYAdapter {
  private running = false;
  private buffer = '';
  private pid?: number;

  constructor(
    private readonly sessionId: string,
    private readonly command: string,
    private readonly args: string[],
    private readonly options: PTYOptions
  ) {
    super();
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.pid = Math.floor(Math.random() * 100000);

    // Simulate async start
    setTimeout(() => {
      this.emit('data', `Mock PTY started: ${this.command} ${this.args.join(' ')}\r\n`);
    }, 0);
  }

  write(data: string): void {
    if (!this.running) {
      throw new PTYError('PTY not running', 'WRITE_ERROR');
    }

    // Echo the input back
    this.buffer += data;

    if (data.includes('\r') || data.includes('\n')) {
      this.emit('data', `\r\necho: ${this.buffer.trim()}\r\n`);
      this.buffer = '';

      // Simulate command completion
      if (data.trim() === 'exit') {
        this.simulateExit(0);
      }
    }
  }

  resize(_cols: number, _rows: number): void {
    if (!this.running) {
      throw new PTYError('PTY not running', 'RESIZE_ERROR');
    }
    // Mock resize does nothing
  }

  kill(_signal?: string): void {
    if (this.running) {
      this.simulateExit(0);
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getPid(): number | undefined {
    return this.pid;
  }

  getBuffer(): string {
    return this.buffer;
  }

  clearBuffer(): void {
    this.buffer = '';
  }

  /**
   * Simulate receiving data from PTY
   */
  simulateData(data: string): void {
    if (this.running) {
      this.emit('data', data);
    }
  }

  /**
   * Simulate PTY exit
   */
  simulateExit(exitCode: number, signal?: number): void {
    if (this.running) {
      this.running = false;
      const exitInfo: PTYExitInfo = { exitCode, signal };
      this.emit('exit', exitInfo);
    }
  }

  /**
   * Get options for assertions
   */
  getOptions(): PTYOptions {
    return this.options;
  }

  /**
   * Get command for assertions
   */
  getCommand(): string {
    return this.command;
  }

  /**
   * Get args for assertions
   */
  getArgs(): string[] {
    return this.args;
  }
}

/**
 * Mock PTY factory
 */
export class MockPTYFactory {
  private adapters: MockPTYAdapter[] = [];

  create(
    sessionId: string,
    command: string,
    args: string[],
    options: PTYOptions
  ): MockPTYAdapter {
    const adapter = new MockPTYAdapter(sessionId, command, args, options);
    this.adapters.push(adapter);
    return adapter;
  }

  /**
   * Get all created adapters (for assertions)
   */
  getAdapters(): MockPTYAdapter[] {
    return [...this.adapters];
  }

  /**
   * Clear all adapters
   */
  clear(): void {
    this.adapters = [];
  }
}

/**
 * Create a fresh mock PTY factory
 */
export function createMockPTYFactory(): MockPTYFactory {
  return new MockPTYFactory();
}
