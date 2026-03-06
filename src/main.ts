import * as path from 'path';
import { createServer } from './core';
import { createSessionFeature } from './features/session';
import { createProjectFeature } from './features/project';
import { createFileBrowserFeature } from './features/file-browser';
import { createCommandsFeature } from './features/commands';

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = path.join(__dirname, 'client');

async function main() {
  // Create feature instances
  const sessionFeature = createSessionFeature();
  const projectFeature = createProjectFeature();
  const fileBrowserFeature = createFileBrowserFeature();
  const commandsFeature = createCommandsFeature();

  // Initialize commands registry
  await commandsFeature.registry.initialize();

  // Create server with features
  const server = createServer({
    staticDir: CLIENT_DIR,
    enableWebSocket: true,
    features: [
      sessionFeature.router,
      projectFeature.router,
      fileBrowserFeature.router,
      commandsFeature.router
    ]
  });

  // Setup WebSocket handlers
  if (server.wsManager) {
    sessionFeature.setupWebSocket(server.wsManager);
  }

  // Start server
  await server.start(Number(PORT));

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
