import { describe, it, expect, beforeEach } from 'vitest';
import { MockPTYAdapter, MockPTYFactory } from '../../mocks/pty';

function waitForEvent<T>(emitter: MockPTYAdapter, event: string, timeout = 1000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    emitter.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe('PTY', () => {
  describe('MockPTYAdapter', () => {
    let pty: MockPTYAdapter;

    beforeEach(() => {
      pty = new MockPTYAdapter(
        'session-1',
        '/bin/test',
        ['arg1', 'arg2'],
        { cwd: '/test/dir', cols: 100, rows: 30 }
      );
    });

    it('should start PTY', () => {
      expect(pty.isRunning()).toBe(false);
      pty.start();
      expect(pty.isRunning()).toBe(true);
    });

    it('should have PID after start', () => {
      pty.start();
      expect(pty.getPid()).toBeDefined();
      expect(typeof pty.getPid()).toBe('number');
    });

    it('should emit data on start', async () => {
      const dataPromise = waitForEvent<string>(pty, 'data');
      pty.start();
      const data = await dataPromise;
      expect(data).toContain('Mock PTY started');
    });

    it('should write data', () => {
      pty.start();
      pty.write('hello');
      expect(pty.getBuffer()).toBe('hello');
    });

    it('should echo written data on newline', async () => {
      pty.start();

      const dataPromise = waitForEvent<string>(pty, 'data');
      pty.write('hello\r');
      const data = await dataPromise;
      expect(data).toContain('echo: hello');
    });

    it('should exit on exit command', async () => {
      pty.start();

      const exitPromise = waitForEvent<{ exitCode: number }>(pty, 'exit');
      pty.write('exit\r');
      const { exitCode } = await exitPromise;
      expect(exitCode).toBe(0);
      expect(pty.isRunning()).toBe(false);
    });

    it('should kill PTY', async () => {
      pty.start();

      const exitPromise = waitForEvent(pty, 'exit');
      pty.kill();
      await exitPromise;
      expect(pty.isRunning()).toBe(false);
    });

    it('should emit simulated data', async () => {
      pty.start();

      const dataPromise = waitForEvent<string>(pty, 'data');
      pty.simulateData('test data');
      const data = await dataPromise;
      expect(data).toBe('test data');
    });

    it('should clear buffer', () => {
      pty.start();
      pty.write('test');
      expect(pty.getBuffer()).toBe('test');

      pty.clearBuffer();
      expect(pty.getBuffer()).toBe('');
    });

    it('should expose options', () => {
      expect(pty.getOptions()).toEqual({
        cwd: '/test/dir',
        cols: 100,
        rows: 30
      });
    });
  });

  describe('MockPTYFactory', () => {
    let factory: MockPTYFactory;

    beforeEach(() => {
      factory = new MockPTYFactory();
    });

    it('should create PTY adapters', () => {
      const pty = factory.create('session-1', '/bin/test', ['-a'], { cwd: '/' });
      expect(pty).toBeInstanceOf(MockPTYAdapter);
    });

    it('should track created adapters', () => {
      factory.create('session-1', '/bin/test', [], { cwd: '/' });
      factory.create('session-2', '/bin/other', [], { cwd: '/' });

      expect(factory.getAdapters()).toHaveLength(2);
    });

    it('should clear adapters', () => {
      factory.create('session-1', '/bin/test', [], { cwd: '/' });
      factory.clear();
      expect(factory.getAdapters()).toHaveLength(0);
    });
  });
});
