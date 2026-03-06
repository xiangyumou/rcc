import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

// Mock TerminalManager class
class MockTerminalManager {
  init = vi.fn();
  connect = vi.fn();
  disconnect = vi.fn();
  sendCommand = vi.fn();
  focus = vi.fn();
  onStateChange = vi.fn();
  term = {
    clear: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    onData: vi.fn(),
    onResize: vi.fn(),
  };
}

// Mock terminal module
vi.mock('../../../src/client/terminal.js', () => ({
  TerminalManager: MockTerminalManager,
}));

// Mock theme module
vi.mock('../../../src/client/theme.js', () => ({
  themeManager: {
    init: vi.fn(),
    onThemeChange: vi.fn(),
  },
}));

// Mock DOM APIs
document.body.innerHTML = `
  <div id="welcome-screen"></div>
  <div id="terminal-container"></div>
  <div id="project-list"></div>
  <div id="session-list"></div>
  <div id="current-project"></div>
  <div id="connection-status"></div>
  <div id="state-indicator"><span class="state-icon"></span><span class="state-text"></span></div>
  <div id="status-text"></div>
  <div id="session-info"></div>
  <button id="new-project-btn"></button>
  <button id="welcome-new-btn"></button>
  <button id="close-session-btn"></button>
  <button id="add-cmd-btn"></button>
  <div id="settings-modal" class="hidden"></div>
  <div id="add-cmd-modal" class="hidden"></div>
  <div id="custom-commands-list"></div>
  <div id="project-list-empty" class="hidden"></div>
  <div id="session-list-empty" class="hidden"></div>
  <div id="file-browser-modal" class="hidden"></div>
  <div id="fb-current-path"></div>
  <button id="fb-go-up"></button>
  <div id="fb-quick-access"></div>
  <div id="file-list"></div>
  <button id="fb-confirm"></button>
  <div id="fb-selected-path"></div>
  <button id="start-with-options"></button>
  <button id="add-custom-cmd"></button>
  <button id="confirm-add-cmd"></button>
`;

// Mock fetch globally - must be before App import
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import App after mocks are set up
let App: any;

describe('App - API Response Format Handling', () => {
  beforeEach(async () => {
    // Reset mocks
    mockFetch.mockClear();
    localStorageMock.getItem.mockReturnValue(null);

    // Clear module cache to get fresh instance
    vi.resetModules();

    // Set default mock for constructor API calls
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [],
        error: null,
      }),
    });

    // Import App fresh for each test
    const module = await import('../../../src/client/app.js');
    App = module.App;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loadRecentProjects', () => {
    it('should extract data from API envelope format', async () => {
      const projects = [
        { name: 'Project 1', path: '/path/1' },
        { name: 'Project 2', path: '/path/2' },
      ];

      // Reset mock to return specific data for this test
      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: projects,
          error: null,
        }),
      });

      const app = new App();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(app.recentProjects).toEqual(projects);
    });

    it('should handle API error response', async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          data: null,
          error: 'Failed to fetch projects',
        }),
      });

      const app = new App();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(app.recentProjects).toEqual([]);
    });

    it('should handle HTTP error status', async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({}),
      });

      const app = new App();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(app.recentProjects).toEqual([]);
    });

    it('should handle missing data field', async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          // data field missing
          error: null,
        }),
      });

      const app = new App();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(app.recentProjects).toEqual([]);
    });
  });

  describe('loadActiveSessions', () => {
    it('should extract data from API envelope format', async () => {
      const sessions = [
        { id: '1', projectName: 'Session 1', status: 'running' },
        { id: '2', projectName: 'Session 2', status: 'stopped' },
      ];

      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: sessions,
          error: null,
        }),
      });

      const app = new App();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(app.activeSessions).toEqual(sessions);
    });

    it('should handle empty sessions array', async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          error: null,
        }),
      });

      const app = new App();

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(app.activeSessions).toEqual([]);
    });
  });

  describe('loadDirectory', () => {
    it('should extract data from API envelope format', async () => {
      const dirData = {
        currentPath: '/test/path',
        items: [
          { name: 'file1.txt', type: 'file', path: '/test/path/file1.txt', size: 1024 },
          { name: 'folder1', type: 'directory', path: '/test/path/folder1' },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: dirData,
          error: null,
        }),
      });

      const app = new App();

      // Manually trigger loadDirectory
      await app.loadDirectory('/test/path');

      expect(app.fbCurrentPath).toBe('/test/path');
    });

    it('should handle error with fallback data', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({}),
      });

      const app = new App();

      await app.loadDirectory('/nonexistent');

      // Should fallback to provided path
      expect(app.fbCurrentPath).toBe('/'); // initial value, unchanged since error
    });

    it('should handle API error response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          data: null,
          error: 'Permission denied',
        }),
      });

      const app = new App();

      await app.loadDirectory('/protected');

      expect(app.fbCurrentPath).toBe('/'); // initial value
    });
  });

  describe('loadQuickAccess', () => {
    it('should extract data from API envelope format', async () => {
      const quickAccessDirs = [
        { name: 'Home', path: '/home/user' },
        { name: 'Projects', path: '/home/user/projects' },
        { name: 'Documents', path: '/home/user/documents' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: quickAccessDirs,
          error: null,
        }),
      });

      const app = new App();

      await app.loadQuickAccess();

      const quickAccessHtml = document.getElementById('fb-quick-access')!.innerHTML;
      expect(quickAccessHtml).toContain('Home');
      expect(quickAccessHtml).toContain('/home/user');
    });

    it('should handle missing data gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          // data field missing
          error: null,
        }),
      });

      const app = new App();

      await app.loadQuickAccess();

      const quickAccessHtml = document.getElementById('fb-quick-access')!.innerHTML;
      expect(quickAccessHtml).toBe('');
    });
  });

  describe('createSession', () => {
    it('should extract session from API envelope format', async () => {
      const session = {
        id: 'test-session-id',
        projectName: 'Test Project',
        projectPath: '/test/project',
        status: 'running',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { session },
          error: null,
        }),
      });

      const app = new App();

      await app.createSession('/test/project', ['-r']);

      expect(app.currentSession).toEqual(session);
    });

    it('should handle API error in envelope', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          data: null,
          error: 'Invalid project path',
        }),
      });

      const app = new App();

      // Should not throw, but log error
      await expect(app.createSession('/invalid', [])).resolves.not.toThrow();
      expect(app.currentSession).toBeNull();
    });

    it('should handle HTTP error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({}),
      });

      const app = new App();

      await expect(app.createSession('/test', [])).resolves.not.toThrow();
      expect(app.currentSession).toBeNull();
    });
  });

  describe('connectToSession', () => {
    it('should extract session from API envelope format', async () => {
      const session = {
        id: 'reconnect-id',
        projectName: 'Existing Project',
        projectPath: '/existing/project',
        status: 'running',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { session },
          error: null,
        }),
      });

      const app = new App();

      await app.connectToSession('reconnect-id');

      expect(app.currentSession).toEqual(session);
    });

    it('should handle failed reconnection', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          data: null,
          error: 'Session not found',
        }),
      });

      const app = new App();

      await expect(app.connectToSession('nonexistent')).resolves.not.toThrow();
      expect(app.currentSession).toBeNull();
    });
  });
});
