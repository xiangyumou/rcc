import express, { Express, Request, Response, NextFunction } from 'express';
import * as http from 'http';
import * as path from 'path';
import { FeatureRouter, sendError } from './router';
import { WebSocketManager } from './websocket';

export * from './storage';
export * from './pty';
export * from './websocket';
export * from './router';

/**
 * Server configuration options
 */
export interface ServerConfig {
  /** Feature routers to register */
  features?: FeatureRouter[];

  /** Static files directory */
  staticDir?: string;

  /** Enable WebSocket support */
  enableWebSocket?: boolean;
}

/**
 * Application server with HTTP and WebSocket support
 */
export interface AppServer {
  /** Express app instance */
  app: Express;

  /** HTTP server instance */
  server: http.Server;

  /** WebSocket manager (if enabled) */
  wsManager?: WebSocketManager;

  /** Start the server */
  start(port: number): Promise<void>;

  /** Stop the server */
  stop(): Promise<void>;
}

/**
 * Create an application server with feature-based routing
 */
export function createServer(config: ServerConfig = {}): AppServer {
  const app = express();
  const server = http.createServer(app);

  // Enable JSON parsing
  app.use(express.json());

  // Register feature routers
  if (config.features && config.features.length > 0) {
    for (const feature of config.features) {
      const basePath = feature.getBasePath();

      if (feature.getRouter) {
        // Use custom router if provided
        app.use(basePath, feature.getRouter());
      } else {
        // Register individual routes
        const routes = feature.getRoutes();
        for (const route of routes) {
          const handlers = [
            ...(route.middleware || []),
            wrapAsync(route.handler)
          ];
          app[route.method](basePath + route.path, ...handlers);
        }
      }
    }
  }

  // Serve static files
  if (config.staticDir) {
    app.use(express.static(config.staticDir));
  }

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error:', err);
    sendError(res, 'INTERNAL_ERROR', err.message || 'Internal server error', 500);
  });

  // WebSocket support
  let wsManager: WebSocketManager | undefined;
  if (config.enableWebSocket) {
    wsManager = new WebSocketManager();
    wsManager.attach(server);
  }

  return {
    app,
    server,
    wsManager,

    async start(port: number): Promise<void> {
      return new Promise((resolve) => {
        server.listen(port, () => {
          console.log(`Server running on http://localhost:${port}`);
          if (wsManager) {
            console.log(`WebSocket endpoint: ws://localhost:${port}/ws`);
          }
          resolve();
        });
      });
    },

    async stop(): Promise<void> {
      if (wsManager) {
        await wsManager.close();
      }
      return new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  };
}

/**
 * Wrap async handler to catch errors
 */
function wrapAsync(
  fn: (req: Request, res: Response, next: NextFunction) => void | Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
