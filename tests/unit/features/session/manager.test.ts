import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SessionManager } from '../../../../src/features/session/manager';
import { CreateSessionRequest } from '../../../../src/features/session/types';

describe('SessionManager', () => {
  let manager: SessionManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'session-test-'));
    manager = new SessionManager({ dataDir: tempDir });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('createSession', () => {
    it('should create session with correct structure', async () => {
      const { session } = await manager.createSession('/test/project', ['-r']);

      expect(session).toMatchObject({
        projectPath: '/test/project',
        projectName: 'project',
        claudeOptions: ['-r'],
        status: 'running'
      });
      expect(session.id).toBeDefined();
      expect(session.createdAt).toBeDefined();
      expect(session.lastActiveAt).toBeDefined();
    });

    it('should store session in memory', async () => {
      const { session } = await manager.createSession('/test/project');
      const retrieved = await manager.getSession(session.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.session.id).toBe(session.id);
    });

    it('should use default options when not provided', async () => {
      const { session } = await manager.createSession('/test/project');
      expect(session.claudeOptions).toEqual([]);
    });
  });

  describe('getSession', () => {
    it('should return null for non-existent session', async () => {
      const result = await manager.getSession('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return stopped session from storage', async () => {
      const { session } = await manager.createSession('/test/project');

      // Terminate the session
      await manager.terminateSession(session.id);

      // Should return null since session is stopped
      const retrieved = await manager.getSession(session.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('reconnectSession', () => {
    it('should reconnect to stopped session', async () => {
      const { session } = await manager.createSession('/test/project');
      await manager.terminateSession(session.id);

      const reconnected = await manager.reconnectSession(session.id);
      expect(reconnected).not.toBeNull();
      expect(reconnected?.session.status).toBe('running');
      expect(reconnected?.session.id).toBe(session.id);
    });

    it('should return null for non-existent session', async () => {
      const result = await manager.reconnectSession('non-existent');
      expect(result).toBeNull();
    });

    it('should return existing active session', async () => {
      const { session } = await manager.createSession('/test/project');

      const reconnected = await manager.reconnectSession(session.id);
      expect(reconnected?.session.id).toBe(session.id);
    });
  });

  describe('terminateSession', () => {
    it('should terminate active session', async () => {
      const { session } = await manager.createSession('/test/project');
      const terminated = await manager.terminateSession(session.id);

      expect(terminated).toBe(true);
      const retrieved = await manager.getSession(session.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent session', async () => {
      const result = await manager.terminateSession('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getAllSessions', () => {
    it('should return all sessions sorted by lastActiveAt', async () => {
      await manager.createSession('/test/project1');
      await new Promise(r => setTimeout(r, 10));
      await manager.createSession('/test/project2');

      const sessions = await manager.getAllSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions[0].lastActiveAt).toBeGreaterThanOrEqual(sessions[1].lastActiveAt);
    });
  });

  describe('updateActivity', () => {
    it('should update lastActiveAt without error', async () => {
      const { session } = await manager.createSession('/test/project');

      // Should not throw error
      await expect(manager.updateActivity(session.id)).resolves.not.toThrow();

      // Should update the in-memory session
      const { session: updated } = await manager.getSession(session.id) || {};
      expect(updated?.lastActiveAt).toBeGreaterThanOrEqual(session.lastActiveAt);
    });
  });
});
