import { PTYAdapter } from '../../core/pty';

/**
 * Session status
 */
export type SessionStatus = 'running' | 'paused' | 'stopped';

/**
 * Session data (stored in JSON, no status field)
 */
export interface Session {
  id: string;
  projectPath: string;
  projectName: string;
  claudeOptions: string[];
  createdAt: number;
  lastActiveAt: number;
}

/**
 * Session with runtime state (for API responses)
 */
export interface SessionWithState extends Session {
  state?: string;
}

/**
 * Session with its PTY process
 */
export interface SessionWithPTY {
  session: Session;
  pty: PTYAdapter;
  currentState?: string;
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
 * Session list item (API response)
 */
export interface SessionListItem extends SessionWithState {
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
