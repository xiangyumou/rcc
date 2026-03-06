import { WebSocket } from 'ws';

/**
 * WebSocket message types
 */
export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * WebSocket client with extended properties
 */
export interface WSClient extends WebSocket {
  sessionId?: string;
  isAlive?: boolean;
  userData?: Record<string, unknown>;
}

/**
 * WebSocket handler function type
 */
export type WSMessageHandler = (
  client: WSClient,
  message: WSMessage
) => void | Promise<void>;

/**
 * WebSocket connection handler
 */
export type WSConnectionHandler = (
  client: WSClient,
  requestUrl: URL
) => void | Promise<void>;

/**
 * WebSocket disconnection handler
 */
export type WSDisconnectionHandler = (
  client: WSClient,
  code: number,
  reason: Buffer
) => void | Promise<void>;

/**
 * WebSocket error handler
 */
export type WSErrorHandler = (
  client: WSClient,
  error: Error
) => void | Promise<void>;

/**
 * WebSocket manager configuration
 */
export interface WSManagerConfig {
  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number;

  /** Heartbeat timeout in milliseconds */
  heartbeatTimeout?: number;
}

/**
 * WebSocket error
 */
export class WSError extends Error {
  constructor(
    message: string,
    public readonly code: 'CONNECTION_ERROR' | 'MESSAGE_ERROR' | 'BROADCAST_ERROR'
  ) {
    super(message);
    this.name = 'WSError';
  }
}
