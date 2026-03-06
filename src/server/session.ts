import { Session } from '../shared/types';
import { PTYProcess, createClaudePTY } from './pty';
import * as storage from './storage';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

export interface SessionWithPTY {
  session: Session;
  pty: PTYProcess;
}

class SessionManager {
  private sessions: Map<string, SessionWithPTY> = new Map();

  async createSession(
    projectPath: string,
    claudeOptions: string[] = []
  ): Promise<SessionWithPTY> {
    const sessionId = uuidv4();
    const projectName = path.basename(projectPath);

    const session: Session = {
      id: sessionId,
      projectPath,
      projectName,
      claudeOptions,
      status: 'running',
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    };

    // Create PTY process
    const pty = createClaudePTY(sessionId, projectPath, claudeOptions);

    const sessionWithPTY: SessionWithPTY = { session, pty };
    this.sessions.set(sessionId, sessionWithPTY);

    // Save to storage
    await storage.saveSession(session);
    await storage.addRecentProject(projectPath);

    // Start PTY
    pty.start();

    // Handle PTY exit
    pty.on('exit', async () => {
      session.status = 'stopped';
      await storage.saveSession(session);
      this.sessions.delete(sessionId);
    });

    return sessionWithPTY;
  }

  async getSession(sessionId: string): Promise<SessionWithPTY | null> {
    // First check memory
    const inMemory = this.sessions.get(sessionId);
    if (inMemory) {
      return inMemory;
    }

    // Try to load from storage and restore
    const session = await storage.loadSession(sessionId);
    if (!session || session.status === 'stopped') {
      return null;
    }

    // Restore PTY connection to existing process if possible
    // For now, we'll mark as stopped since we can't reattach to a process
    session.status = 'stopped';
    await storage.saveSession(session);
    return null;
  }

  async reconnectSession(sessionId: string): Promise<SessionWithPTY | null> {
    const session = await storage.loadSession(sessionId);
    if (!session) {
      return null;
    }

    // Check if already connected in memory
    const existing = this.sessions.get(sessionId);
    if (existing && existing.pty.isRunning()) {
      existing.session.lastActiveAt = Date.now();
      return existing;
    }

    // If session was stopped or PTY not running, create new PTY
    if (session.status === 'stopped' || !existing) {
      // Create new PTY with same options
      const pty = createClaudePTY(sessionId, session.projectPath, session.claudeOptions);

      session.status = 'running';
      session.lastActiveAt = Date.now();

      const sessionWithPTY: SessionWithPTY = { session, pty };
      this.sessions.set(sessionId, sessionWithPTY);

      await storage.saveSession(session);

      pty.start();

      pty.on('exit', async () => {
        session.status = 'stopped';
        await storage.saveSession(session);
        this.sessions.delete(sessionId);
      });

      return sessionWithPTY;
    }

    return existing;
  }

  async terminateSession(sessionId: string): Promise<boolean> {
    const sessionWithPTY = this.sessions.get(sessionId);

    if (sessionWithPTY) {
      sessionWithPTY.pty.kill('SIGTERM');
      sessionWithPTY.session.status = 'stopped';
      await storage.saveSession(sessionWithPTY.session);
      this.sessions.delete(sessionId);
      return true;
    }

    // Update storage even if not in memory
    const session = await storage.loadSession(sessionId);
    if (session) {
      session.status = 'stopped';
      await storage.saveSession(session);
    }

    return false;
  }

  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values())
      .filter(s => s.pty.isRunning())
      .map(s => s.session);
  }

  async getAllSessions(): Promise<Session[]> {
    return storage.listSessions();
  }

  updateActivity(sessionId: string): void {
    const sessionWithPTY = this.sessions.get(sessionId);
    if (sessionWithPTY) {
      sessionWithPTY.session.lastActiveAt = Date.now();
      storage.saveSession(sessionWithPTY.session).catch(console.error);
    }
  }
}

export const sessionManager = new SessionManager();
