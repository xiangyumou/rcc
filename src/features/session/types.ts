import { PTYAdapter } from '../../core/pty';

/**
 * Session status
 */
export type SessionStatus = 'running' | 'paused' | 'stopped';

/**
 * Session data
 */
export interface Session {
  id: string;
  projectPath: string;
  projectName: string;
  claudeOptions: string[];
  status: SessionStatus;
  createdAt: number;
  lastActiveAt: number;
}

/**
 * Session with its PTY process
 */
export interface SessionWithPTY {
  session: Session;
  pty: PTYAdapter;
}

/**
 * Create session request
 */
export interface CreateSessionRequest {
  projectPath: string;
  claudeOptions?: string[];
}

/**
 * Create session response
 */
export interface CreateSessionResponse {
  session: Session;
  wsUrl: string;
}

/**
 * Session list item
 */
export interface SessionListItem extends Session {
  isConnected: boolean;
}

/**
 * Session manager configuration
 */
export interface SessionManagerConfig {
  dataDir: string;
  claudePath?: string;
}

/**
 * Session error
 */
export class SessionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'CREATE_ERROR'
      | 'NOT_FOUND'
      | 'TERMINATE_ERROR'
      | 'RECONNECT_ERROR'
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

/**
 * Server to client WebSocket message
 */
export interface ServerWSMessage {
  type: 'output' | 'state' | 'error' | 'connected';
  data?: string;
  state?: { type: string; match?: null };
  sessionId?: string;
  message?: string;
  [key: string]: unknown;
}
