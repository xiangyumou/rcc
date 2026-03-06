import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as path from 'path';
import { sessionManager } from './session';
import * as storage from './storage';
import {
  CreateSessionRequest,
  CreateSessionResponse,
  ClientWSMessage,
  ServerWSMessage,
  Session
} from '../shared/types';
import { getStateDescription } from './state-detector';
import * as fileBrowser from './file-browser';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// ============== HTTP API Routes ==============

// Get recent projects
app.get('/api/recent-projects', async (req, res) => {
  try {
    const data = await storage.loadRecentProjects();
    res.json(data.projects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load recent projects' });
  }
});

// Add/update recent project
app.post('/api/recent-projects', async (req, res) => {
  try {
    const { path: projectPath } = req.body;
    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    await storage.addRecentProject(projectPath);
    const data = await storage.loadRecentProjects();
    res.json(data.projects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add recent project' });
  }
});

// Remove recent project
app.delete('/api/recent-projects/:projectPath(*)', async (req, res) => {
  try {
    const projectPath = req.params.projectPath;
    await storage.removeRecentProject(projectPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove recent project' });
  }
});

// List all sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await sessionManager.getAllSessions();
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Create new session
app.post('/api/sessions', async (req, res) => {
  try {
    const { projectPath, claudeOptions = [] }: CreateSessionRequest = req.body;

    if (!projectPath) {
      return res.status(400).json({ error: 'Project path is required' });
    }

    const sessionWithPTY = await sessionManager.createSession(projectPath, claudeOptions);

    const response: CreateSessionResponse = {
      session: sessionWithPTY.session,
      wsUrl: `/ws?sessionId=${sessionWithPTY.session.id}`
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Failed to create session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get session details
app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionWithPTY = await sessionManager.getSession(sessionId);

    if (!sessionWithPTY) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(sessionWithPTY.session);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Terminate session
app.delete('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const terminated = await sessionManager.terminateSession(sessionId);

    if (!terminated) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to terminate session' });
  }
});

// Reconnect to existing session
app.post('/api/sessions/:sessionId/reconnect', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionWithPTY = await sessionManager.reconnectSession(sessionId);

    if (!sessionWithPTY) {
      return res.status(404).json({ error: 'Session not found or cannot be reconnected' });
    }

    const response: CreateSessionResponse = {
      session: sessionWithPTY.session,
      wsUrl: `/ws?sessionId=${sessionWithPTY.session.id}`
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to reconnect session:', error);
    res.status(500).json({ error: 'Failed to reconnect session' });
  }
});

// ============== File Browser API ==============

// Get home directory
app.get('/api/fs/home', async (req, res) => {
  try {
    const homePath = await fileBrowser.getHomeDirectory();
    res.json({ path: homePath });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get home directory' });
  }
});

// List directory contents
app.get('/api/fs/list', async (req, res) => {
  try {
    const defaultPath = await fileBrowser.getHomeDirectory();
    const dirPath = (req.query.path as string) || defaultPath;

    // Security: prevent escaping root
    if (dirPath.includes('..')) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    const listing = await fileBrowser.listDirectory(dirPath);
    res.json(listing);
  } catch (error) {
    console.error('Failed to list directory:', error);
    res.status(500).json({
      error: 'Failed to list directory',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get quick access directories
app.get('/api/fs/quick-access', async (req, res) => {
  try {
    const home = await fileBrowser.getHomeDirectory();
    const dirs = [
      { name: 'Home', path: home },
      { name: 'Root', path: '/' }
    ];

    // Add common dev directories if they exist
    const commonDirs = ['Projects', 'project', 'workspace', 'Workspace', 'dev', 'code'];
    for (const dir of commonDirs) {
      dirs.push({ name: dir, path: require('path').join(home, dir) });
    }

    // Filter to only existing directories
    const existingDirs = [];
    for (const dir of dirs) {
      const exists = await fileBrowser.validateProjectDir(dir.path);
      if (exists) {
        existingDirs.push(dir);
      }
    }
    res.json(existingDirs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get quick access directories' });
  }
});

// Validate project directory
app.get('/api/fs/validate', async (req, res) => {
  try {
    const dirPath = req.query.path as string;
    if (!dirPath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const isValid = await fileBrowser.validateProjectDir(dirPath);
    res.json({ valid: isValid, path: dirPath });
  } catch (error) {
    res.status(500).json({ error: 'Failed to validate path' });
  }
});

// ============== WebSocket Handler ==============

interface WSClient extends WebSocket {
  sessionId?: string;
  isAlive?: boolean;
}

wss.on('connection', async (ws: WSClient, req) => {
  // Parse session ID from query string
  const url = new URL(req.url || '', `http://localhost:${PORT}`);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    const errorMsg: ServerWSMessage = {
      type: 'error',
      message: 'Session ID is required'
    };
    ws.send(JSON.stringify(errorMsg));
    ws.close();
    return;
  }

  // Get or reconnect session
  const sessionWithPTY = await sessionManager.reconnectSession(sessionId);
  if (!sessionWithPTY) {
    const errorMsg: ServerWSMessage = {
      type: 'error',
      message: 'Session not found'
    };
    ws.send(JSON.stringify(errorMsg));
    ws.close();
    return;
  }

  ws.sessionId = sessionId;
  ws.isAlive = true;

  const { session, pty } = sessionWithPTY;

  // Send initial connection message
  const connectMsg: ServerWSMessage = {
    type: 'connected',
    sessionId,
    message: `Connected to session: ${session.projectName}`
  };
  ws.send(JSON.stringify(connectMsg));

  // Send any existing buffer content
  const buffer = pty.getBuffer();
  if (buffer) {
    const outputMsg: ServerWSMessage = {
      type: 'output',
      data: buffer
    };
    ws.send(JSON.stringify(outputMsg));
  }

  // Handle PTY output
  const onData = (data: string) => {
    const msg: ServerWSMessage = { type: 'output', data };
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  // Handle PTY state changes
  const onStateChange = (state: { type: string }) => {
    const msg: ServerWSMessage = {
      type: 'state',
      state: { type: state.type, match: null }
    };
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
    console.log(`[${session.projectName}] State: ${getStateDescription({ type: state.type, match: null })}`);
  };

  // Handle PTY exit
  const onExit = () => {
    const msg: ServerWSMessage = {
      type: 'state',
      state: { type: 'SESSION_END', match: null }
    };
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      ws.close();
    }
  };

  pty.on('data', onData);
  pty.on('stateChange', onStateChange);
  pty.on('exit', onExit);

  // Handle client messages
  ws.on('message', (message: Buffer) => {
    try {
      const msg: ClientWSMessage = JSON.parse(message.toString());

      switch (msg.type) {
        case 'input':
          if (msg.data) {
            pty.write(msg.data);
            sessionManager.updateActivity(sessionId);
          }
          break;

        case 'resize':
          if (msg.cols && msg.rows) {
            pty.resize(msg.cols, msg.rows);
          }
          break;

        case 'ping':
          ws.isAlive = true;
          break;
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  });

  // Handle WebSocket close
  ws.on('close', () => {
    pty.off('data', onData);
    pty.off('stateChange', onStateChange);
    pty.off('exit', onExit);
    console.log(`Client disconnected from session: ${session.projectName}`);
  });

  // Heartbeat
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  console.log(`Client connected to session: ${session.projectName}`);
});

// Heartbeat interval to check for stale connections
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws: WSClient) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeat);
});

// Start server
server.listen(PORT, () => {
  console.log(`Claude Code Web Manager server running on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
