import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import {
  WSClient,
  WSMessage,
  WSMessageHandler,
  WSConnectionHandler,
  WSDisconnectionHandler,
  WSErrorHandler,
  WSManagerConfig,
  WSError
} from './types';

/**
 * WebSocket Manager
 * Handles WebSocket connections, messages, and broadcasting
 */
export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private handlers: Map<string, WSMessageHandler> = new Map();
  private connectionHandler: WSConnectionHandler | null = null;
  private disconnectionHandler: WSDisconnectionHandler | null = null;
  private errorHandler: WSErrorHandler | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: WSManagerConfig = {}) {}

  /**
   * Attach to an existing HTTP server
   */
  attach(server: import('http').Server, path: string = '/ws'): void {
    this.wss = new WebSocketServer({ server, path });

    this.wss.on('connection', (ws: WSClient, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    // Start heartbeat
    this.startHeartbeat();
  }

  /**
   * Handle new connection
   */
  private async handleConnection(ws: WSClient, req: IncomingMessage): Promise<void> {
    ws.isAlive = true;

    // Parse URL
    const url = new URL(
      req.url || '/',
      `http://${req.headers.host || 'localhost'}`
    );

    // Call connection handler
    if (this.connectionHandler) {
      try {
        await this.connectionHandler(ws, url);
      } catch (error) {
        console.error('Connection handler error:', error);
        ws.close(1011, 'Connection handler error');
        return;
      }
    }

    // Set up message handler
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        await this.handleMessage(ws, message);
      } catch (error) {
        console.error('Failed to parse message:', error);
        if (this.errorHandler) {
          await this.errorHandler(ws, error as Error);
        }
      }
    });

    // Set up pong handler for heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Set up close handler
    ws.on('close', async (code: number, reason: Buffer) => {
      if (this.disconnectionHandler) {
        await this.disconnectionHandler(ws, code, reason);
      }
    });

    // Set up error handler
    ws.on('error', async (error: Error) => {
      console.error('WebSocket error:', error);
      if (this.errorHandler) {
        await this.errorHandler(ws, error);
      }
    });
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(client: WSClient, message: WSMessage): Promise<void> {
    const handler = this.handlers.get(message.type);

    if (handler) {
      try {
        await handler(client, message);
      } catch (error) {
        console.error(`Handler error for message type "${message.type}":`, error);
        throw new WSError(
          `Handler error: ${(error as Error).message}`,
          'MESSAGE_ERROR'
        );
      }
    } else {
      console.warn(`No handler for message type: ${message.type}`);
    }
  }

  /**
   * Register a message handler
   */
  onMessage(type: string, handler: WSMessageHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Register connection handler
   */
  onConnection(handler: WSConnectionHandler): void {
    this.connectionHandler = handler;
  }

  /**
   * Register disconnection handler
   */
  onDisconnection(handler: WSDisconnectionHandler): void {
    this.disconnectionHandler = handler;
  }

  /**
   * Register error handler
   */
  onError(handler: WSErrorHandler): void {
    this.errorHandler = handler;
  }

  /**
   * Send message to a specific client
   */
  send(client: WSClient, message: WSMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: WSMessage): void {
    if (!this.wss) return;

    const data = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  /**
   * Broadcast to clients matching a filter
   */
  broadcastTo(
    filter: (client: WSClient) => boolean,
    message: WSMessage
  ): void {
    if (!this.wss) return;

    const data = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      const wsClient = client as WSClient;
      if (client.readyState === WebSocket.OPEN && filter(wsClient)) {
        client.send(data);
      }
    });
  }

  /**
   * Get all connected clients
   */
  getClients(): WSClient[] {
    if (!this.wss) return [];
    return Array.from(this.wss.clients) as WSClient[];
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.wss?.clients.size ?? 0;
  }

  /**
   * Start heartbeat to detect stale connections
   */
  private startHeartbeat(): void {
    const interval = this.config.heartbeatInterval ?? 30000;

    this.heartbeatTimer = setInterval(() => {
      if (!this.wss) return;

      this.wss.clients.forEach((client) => {
        const wsClient = client as WSClient;
        if (wsClient.isAlive === false) {
          return wsClient.terminate();
        }

        wsClient.isAlive = false;
        wsClient.ping();
      });
    }, interval);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Close all connections and stop server
   */
  close(): Promise<void> {
    this.stopHeartbeat();

    return new Promise((resolve, reject) => {
      if (!this.wss) {
        resolve();
        return;
      }

      this.wss.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
