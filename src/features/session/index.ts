import * as path from 'path';
import { FeatureRouter } from '../../core/router';
import { createSessionRouter } from './api';
import { SessionManager } from './manager';
import { WebSocketManager, WSClient } from '../../core/websocket';
import { ServerWSMessage } from './types';

export * from './types';
export * from './manager';
export * from './api';

const SESSIONS_DIR = path.join(process.cwd(), 'data', 'sessions');

/**
 * Create session feature
 */
export function createSessionFeature(): {
  manager: SessionManager;
  router: FeatureRouter;
  setupWebSocket: (wsManager: WebSocketManager) => void;
} {
  const manager = new SessionManager({
    dataDir: SESSIONS_DIR
  });

  const router: FeatureRouter = {
    getBasePath: () => '/api/sessions',
    getRouter: () => createSessionRouter(manager),
    getRoutes: () => []
  };

  /**
   * Setup WebSocket handlers for session terminal
   */
  const setupWebSocket = (wsManager: WebSocketManager): void => {
    wsManager.onConnection(async (client: WSClient, url: URL) => {
      const sessionId = url.searchParams.get('sessionId');

      if (!sessionId) {
        const errorMsg: ServerWSMessage = {
          type: 'error',
          message: 'Session ID is required'
        };
        wsManager.send(client, errorMsg);
        client.close();
        return;
      }

      const sessionWithPTY = await manager.reconnectSession(sessionId);
      if (!sessionWithPTY) {
        const errorMsg: ServerWSMessage = {
          type: 'error',
          message: 'Session not found'
        };
        wsManager.send(client, errorMsg);
        client.close();
        return;
      }

      client.sessionId = sessionId;
      client.userData = { sessionId };

      const { session, pty } = sessionWithPTY;

      // Send connection message
      const connectMsg: ServerWSMessage = {
        type: 'connected',
        sessionId,
        message: `Connected to session: ${session.projectName}`
      };
      wsManager.send(client, connectMsg);

      // Send existing buffer
      const buffer = pty.getBuffer();
      if (buffer) {
        const outputMsg: ServerWSMessage = {
          type: 'output',
          data: buffer
        };
        wsManager.send(client, outputMsg);
      }

      // Handle PTY output
      const onData = (data: string) => {
        const msg: ServerWSMessage = { type: 'output', data };
        wsManager.send(client, msg);
      };

      // Handle PTY state changes
      const onStateChange = (state: { type: string }) => {
        const msg: ServerWSMessage = {
          type: 'state',
          state: { type: state.type, match: null }
        };
        wsManager.send(client, msg);
      };

      // Handle PTY exit
      const onExit = () => {
        const msg: ServerWSMessage = {
          type: 'state',
          state: { type: 'SESSION_END', match: null }
        };
        wsManager.send(client, msg);
        client.close();
      };

      pty.on('data', onData);
      pty.on('stateChange', onStateChange);
      pty.on('exit', onExit);

      // Handle client disconnect
      client.on('close', () => {
        pty.off('data', onData);
        pty.off('stateChange', onStateChange);
        pty.off('exit', onExit);
      });
    });

    wsManager.onMessage('input', (client: WSClient, message) => {
      const sessionId = client.sessionId;
      if (!sessionId) return;

      const data = message.data as string;
      if (data) {
        manager.getSession(sessionId).then((sessionWithPTY) => {
          if (sessionWithPTY) {
            sessionWithPTY.pty.write(data);
            manager.updateActivity(sessionId);
          }
        });
      }
    });

    wsManager.onMessage('resize', (client: WSClient, message) => {
      const sessionId = client.sessionId;
      if (!sessionId) return;

      const { cols, rows } = message as { cols?: number; rows?: number };
      if (cols && rows) {
        manager.getSession(sessionId).then((sessionWithPTY) => {
          if (sessionWithPTY) {
            sessionWithPTY.pty.resize(cols, rows);
          }
        });
      }
    });
  };

  return { manager, router, setupWebSocket };
}
