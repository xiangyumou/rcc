import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { Session, SessionWithPTY, SessionWithState, SessionError, SessionManagerConfig } from './types';
import { StorageAdapter, JSONStorageAdapter } from '../../core/storage';
import { PTYAdapter, NodePTYFactory } from '../../core/pty';

/**
 * Default Claude command path
 */
const DEFAULT_CLAUDE_PATH = '/opt/homebrew/bin/claude';

/**
 * Session Manager
 * Manages session lifecycle: create, get, reconnect, terminate
 */
export class SessionManager {
  private sessions: Map<string, SessionWithPTY> = new Map();
  private storage: StorageAdapter<Session>;
  private claudePath: string;

  constructor(private readonly config: SessionManagerConfig) {
    this.storage = new JSONStorageAdapter<Session>({
      baseDir: config.dataDir
    });
    this.claudePath = config.claudePath || DEFAULT_CLAUDE_PATH;
  }

  /**
   * Create a new session
   */
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
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    };

    try {
      // Create PTY process
      const pty = this.createPTY(sessionId, projectPath, claudeOptions);

      const sessionWithPTY: SessionWithPTY = { session, pty };
      this.sessions.set(sessionId, sessionWithPTY);

      // Save to storage
      await this.storage.write(sessionId, session);

      // Start PTY and handle exit
      this.setupPTYHandlers(sessionWithPTY);
      pty.start();

      return sessionWithPTY;
    } catch (error) {
      throw new SessionError(
        `Failed to create session: ${(error as Error).message}`,
        'CREATE_ERROR'
      );
    }
  }

  /**
   * Get session by ID (only returns in-memory/running sessions)
   */
  async getSession(sessionId: string): Promise<SessionWithPTY | null> {
    // Only return in-memory sessions (running)
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Reconnect to existing session (returns in-memory session if exists)
   */
  async reconnectSession(sessionId: string): Promise<SessionWithPTY | null> {
    // Return in-memory session if exists
    const existing = this.sessions.get(sessionId);
    if (existing && existing.pty.isRunning()) {
      existing.session.lastActiveAt = Date.now();
      return existing;
    }

    // Try to load from storage and restart
    const session = await this.storage.read(sessionId);
    if (!session) {
      return null;
    }

    const pty = this.createPTY(sessionId, session.projectPath, session.claudeOptions);
    session.lastActiveAt = Date.now();

    const sessionWithPTY: SessionWithPTY = { session, pty };
    this.sessions.set(sessionId, sessionWithPTY);

    await this.storage.write(sessionId, session);

    this.setupPTYHandlers(sessionWithPTY);
    pty.start();

    return sessionWithPTY;
  }

  /**
   * Terminate a session
   */
  async terminateSession(sessionId: string): Promise<boolean> {
    const sessionWithPTY = this.sessions.get(sessionId);

    if (sessionWithPTY) {
      sessionWithPTY.pty.kill('SIGTERM');
      this.sessions.delete(sessionId);
      return true;
    }

    return false;
  }

  /**
   * Get all active (in-memory) sessions with their current state
   */
  getActiveSessions(): SessionWithState[] {
    return Array.from(this.sessions.values())
      .filter(s => s.pty.isRunning())
      .map(s => ({
        ...s.session,
        state: s.currentState
      }));
  }

  /**
   * Get all active sessions (in-memory only, no storage)
   */
  async getAllSessions(): Promise<SessionWithState[]> {
    return this.getActiveSessions();
  }

  /**
   * Update session state
   */
  updateSessionState(sessionId: string, state: string): void {
    const sessionWithPTY = this.sessions.get(sessionId);
    if (sessionWithPTY) {
      sessionWithPTY.currentState = state;
    }
  }

  /**
   * Update last active timestamp
   */
  async updateActivity(sessionId: string): Promise<void> {
    const sessionWithPTY = this.sessions.get(sessionId);
    if (sessionWithPTY) {
      sessionWithPTY.session.lastActiveAt = Date.now();
      await this.storage.write(sessionId, sessionWithPTY.session);
    }
  }

  /**
   * Create a PTY for a session
   */
  private createPTY(
    sessionId: string,
    cwd: string,
    options: string[]
  ): PTYAdapter {
    const command = process.env.CLAUDE_PATH || this.claudePath;
    const factory = new NodePTYFactory();

    return factory.create(sessionId, command, options, {
      cwd,
      cols: 80,
      rows: 24,
      env: {
        ...process.env,
        TERM: 'xterm-256color'
      }
    });
  }

  /**
   * Set up PTY event handlers
   */
  private setupPTYHandlers(sessionWithPTY: SessionWithPTY): void {
    const { session, pty } = sessionWithPTY;

    pty.on('exit', () => {
      // Remove from memory, no need to write status to storage
      this.sessions.delete(session.id);
    });
  }
}
