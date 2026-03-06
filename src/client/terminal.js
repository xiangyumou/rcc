/**
 * Terminal wrapper using xterm.js
 */
class TerminalManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.term = null;
    this.fitAddon = null;
    this.ws = null;
    this.sessionId = null;
    this.onDataCallback = null;
    this.onStateChangeCallback = null;
  }

  init() {
    // Create xterm instance
    this.term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#e0e0e0',
        cursor: '#e0e0e0',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      },
      scrollback: 10000,
      allowProposedApi: true
    });

    // Add fit addon
    this.fitAddon = new FitAddon.FitAddon();
    this.term.loadAddon(this.fitAddon);

    // Open terminal
    this.term.open(this.container);
    this.fitAddon.fit();

    // Handle terminal input
    this.term.onData((data) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'input', data });
      }
      if (this.onDataCallback) {
        this.onDataCallback(data);
      }
    });

    // Handle resize
    window.addEventListener('resize', () => {
      this.resize();
    });

    return this;
  }

  connect(sessionId) {
    this.sessionId = sessionId;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?sessionId=${sessionId}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.sendMessage({
        type: 'resize',
        cols: this.term.cols,
        rows: this.term.rows
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.showDisconnectMessage();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return this;
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'output':
        if (msg.data) {
          this.term.write(msg.data);
        }
        break;

      case 'state':
        if (this.onStateChangeCallback && msg.state) {
          this.onStateChangeCallback(msg.state);
        }
        break;

      case 'connected':
        console.log('Connected to session:', msg.message);
        break;

      case 'error':
        console.error('Server error:', msg.message);
        this.term.writeln(`\r\n\x1b[31mError: ${msg.message}\x1b[0m\r\n`);
        break;
    }
  }

  sendMessage(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  resize() {
    if (this.fitAddon) {
      this.fitAddon.fit();
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({
          type: 'resize',
          cols: this.term.cols,
          rows: this.term.rows
        });
      }
    }
  }

  write(data) {
    if (this.term) {
      this.term.write(data);
    }
  }

  writeln(data) {
    if (this.term) {
      this.term.writeln(data);
    }
  }

  clear() {
    if (this.term) {
      this.term.clear();
    }
  }

  focus() {
    if (this.term) {
      this.term.focus();
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  showDisconnectMessage() {
    this.term.writeln('\r\n\x1b[33m[Disconnected from session]\x1b[0m\r\n');
  }

  onData(callback) {
    this.onDataCallback = callback;
  }

  onStateChange(callback) {
    this.onStateChangeCallback = callback;
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // Send a command to the terminal
  sendCommand(cmd) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendMessage({ type: 'input', data: cmd + '\r' });
    }
  }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TerminalManager };
}
