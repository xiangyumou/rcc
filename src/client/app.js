import { TerminalManager } from './terminal.js';

/**
 * Main application logic for Claude Code Web Manager
 */
class App {
  constructor() {
    this.terminal = null;
    this.currentSession = null;
    this.recentProjects = [];
    this.activeSessions = [];
    this.customCommands = this.loadCustomCommands();
    this.pendingProjectPath = null;

    // File browser state
    this.fbCurrentPath = '/';
    this.fbSelectedPath = null;

    // UI elements
    this.ui = {
      welcomeScreen: document.getElementById('welcome-screen'),
      terminalContainer: document.getElementById('terminal-container'),
      projectList: document.getElementById('project-list'),
      sessionList: document.getElementById('session-list'),
      newProjectBtn: document.getElementById('new-project-btn'),
      welcomeNewBtn: document.getElementById('welcome-new-btn'),
      currentProject: document.getElementById('current-project'),
      connectionStatus: document.getElementById('connection-status'),
      stateIndicator: document.getElementById('state-indicator'),
      statusText: document.getElementById('status-text'),
      sessionInfo: document.getElementById('session-info'),
      closeSessionBtn: document.getElementById('close-session-btn'),
      settingsBtn: document.getElementById('settings-btn'),
      settingsModal: document.getElementById('settings-modal'),
      addCmdModal: document.getElementById('add-cmd-modal'),
      addCmdBtn: document.getElementById('add-cmd-btn'),
      customCommandsList: document.getElementById('custom-commands-list'),
      // File browser elements
      fileBrowserModal: document.getElementById('file-browser-modal'),
      fbCurrentPath: document.getElementById('fb-current-path'),
      fbGoUp: document.getElementById('fb-go-up'),
      fbQuickAccess: document.getElementById('fb-quick-access'),
      fileList: document.getElementById('file-list'),
      fbConfirm: document.getElementById('fb-confirm'),
      fbSelectedPath: document.getElementById('fb-selected-path')
    };

    this.init();
  }

  init() {
    // Initialize terminal
    this.terminal = new TerminalManager('terminal');
    this.terminal.init();

    // Setup event listeners
    this.setupEventListeners();

    // Load initial data
    this.loadRecentProjects();
    this.loadActiveSessions();
  }

  setupEventListeners() {
    // New project buttons
    this.ui.newProjectBtn.addEventListener('click', () => this.openFileBrowser());
    this.ui.welcomeNewBtn.addEventListener('click', () => this.openFileBrowser());

    // Close session button
    this.ui.closeSessionBtn.addEventListener('click', () => this.closeCurrentSession());

    // Settings button
    this.ui.settingsBtn.addEventListener('click', () => this.openSettingsModal());

    // Add command button
    this.ui.addCmdBtn.addEventListener('click', () => this.openAddCommandModal());

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.add('hidden');
      });
    });

    // File browser events
    this.ui.fbGoUp.addEventListener('click', () => this.navigateUp());
    this.ui.fbConfirm.addEventListener('click', () => this.confirmProjectSelection());

    // Settings modal events
    document.getElementById('start-with-options').addEventListener('click', () => this.startWithOptions());

    // Custom command events
    document.getElementById('add-custom-cmd').addEventListener('click', () => this.addCustomCommand());
    document.getElementById('confirm-add-cmd').addEventListener('click', () => this.confirmAddCommand());

    // Quick command buttons
    document.querySelectorAll('.cmd-btn[data-cmd]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cmd = e.target.dataset.cmd;
        if (this.currentSession) {
          this.terminal.sendCommand(cmd);
        }
      });
    });

    // Terminal state change
    this.terminal.onStateChange((state) => {
      this.updateStateIndicator(state);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+D to exit
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        if (this.currentSession) {
          this.terminal.sendCommand('/exit');
        }
      }

      // Ctrl+L to clear
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        if (this.currentSession) {
          this.terminal.sendCommand('/clear');
        }
      }

      // Shift+Tab to switch projects
      if (e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        this.switchToNextProject();
      }
    });
  }

  async loadRecentProjects() {
    try {
      const response = await fetch('/api/recent-projects');
      this.recentProjects = await response.json();
      this.renderProjectList();
    } catch (error) {
      console.error('Failed to load recent projects:', error);
    }
  }

  async loadActiveSessions() {
    try {
      const response = await fetch('/api/sessions');
      this.activeSessions = await response.json();
      this.renderSessionList();
    } catch (error) {
      console.error('Failed to load active sessions:', error);
    }
  }

  renderProjectList() {
    this.ui.projectList.innerHTML = this.recentProjects.map(project => `
      <li class="project-item" data-path="${project.path}">
        <span class="project-name">${project.name}</span>
        <span class="project-path">${project.path}</span>
        <button class="btn btn-small remove-project" data-path="${project.path}">×</button>
      </li>
    `).join('');

    // Add click handlers
    this.ui.projectList.querySelectorAll('.project-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('remove-project')) {
          const path = item.dataset.path;
          this.openProject(path);
        }
      });
    });

    // Add remove handlers
    this.ui.projectList.querySelectorAll('.remove-project').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const path = btn.dataset.path;
        this.removeRecentProject(path);
      });
    });
  }

  renderSessionList() {
    this.ui.sessionList.innerHTML = this.activeSessions.map(session => `
      <li class="session-item ${session.status === 'running' ? 'active' : ''}" data-id="${session.id}">
        <span class="session-name">${session.projectName}</span>
        <span class="session-status">${session.status}</span>
      </li>
    `).join('');

    // Add click handlers
    this.ui.sessionList.querySelectorAll('.session-item').forEach(item => {
      item.addEventListener('click', () => {
        const sessionId = item.dataset.id;
        this.connectToSession(sessionId);
      });
    });
  }

  async openFileBrowser() {
    this.ui.fileBrowserModal.classList.remove('hidden');
    await this.loadDirectory('/');
    await this.loadQuickAccess();
  }

  async loadDirectory(path) {
    try {
      const response = await fetch(`/api/fs/list?path=${encodeURIComponent(path)}`);
      const data = await response.json();

      this.fbCurrentPath = data.currentPath;
      this.ui.fbCurrentPath.textContent = data.currentPath;

      this.renderFileList(data.items);
    } catch (error) {
      console.error('Failed to load directory:', error);
    }
  }

  renderFileList(items) {
    this.ui.fileList.innerHTML = items.map(item => `
      <div class="file-item ${item.type}" data-path="${item.path}" data-type="${item.type}">
        <span class="file-icon">${item.type === 'directory' ? '' : ''}</span>
        <span class="file-name">${item.name}</span>
        ${item.size ? `<span class="file-size">${this.formatSize(item.size)}</span>` : ''}
      </div>
    `).join('');

    // Add click handlers
    this.ui.fileList.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', () => {
        const path = item.dataset.path;
        const type = item.dataset.type;

        if (type === 'directory') {
          this.loadDirectory(path);
        } else {
          this.fbSelectedPath = path;
          this.ui.fbSelectedPath.textContent = path;
          this.ui.fbConfirm.disabled = true;
        }
      });

      // Double-click to select directory
      item.addEventListener('dblclick', () => {
        const path = item.dataset.path;
        const type = item.dataset.type;

        if (type === 'directory') {
          this.fbSelectedPath = path;
          this.ui.fbSelectedPath.textContent = path;
          this.ui.fbConfirm.disabled = false;
        }
      });
    });
  }

  async loadQuickAccess() {
    try {
      const response = await fetch('/api/fs/quick-access');
      const dirs = await response.json();

      this.ui.fbQuickAccess.innerHTML = dirs.map(dir => `
        <button class="quick-access-item" data-path="${dir.path}">${dir.name}</button>
      `).join('');

      this.ui.fbQuickAccess.querySelectorAll('.quick-access-item').forEach(btn => {
        btn.addEventListener('click', () => {
          this.loadDirectory(btn.dataset.path);
        });
      });
    } catch (error) {
      console.error('Failed to load quick access:', error);
    }
  }

  navigateUp() {
    const parent = this.fbCurrentPath.split('/').slice(0, -1).join('/') || '/';
    this.loadDirectory(parent);
  }

  confirmProjectSelection() {
    if (this.fbSelectedPath) {
      this.ui.fileBrowserModal.classList.add('hidden');
      this.pendingProjectPath = this.fbSelectedPath;
      this.openSettingsModal();
    }
  }

  openSettingsModal() {
    this.ui.settingsModal.classList.remove('hidden');
    this.renderCustomCommands();
  }

  openAddCommandModal() {
    this.ui.addCmdModal.classList.remove('hidden');
  }

  renderCustomCommands() {
    this.ui.customCommandsList.innerHTML = this.customCommands.map((cmd, index) => `
      <div class="custom-command-item">
        <span>${cmd.label}</span>
        <button class="btn btn-small remove-cmd" data-index="${index}">删除</button>
      </div>
    `).join('');

    this.ui.customCommandsList.querySelectorAll('.remove-cmd').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        this.customCommands.splice(index, 1);
        this.saveCustomCommands();
        this.renderCustomCommands();
      });
    });
  }

  addCustomCommand() {
    const nameInput = document.getElementById('new-cmd-name');
    const valueInput = document.getElementById('new-cmd-value');

    const label = nameInput.value.trim();
    const text = valueInput.value.trim();

    if (label && text) {
      this.customCommands.push({ label, text });
      this.saveCustomCommands();
      nameInput.value = '';
      valueInput.value = '';
      this.renderCustomCommands();
    }
  }

  confirmAddCommand() {
    const input = document.getElementById('quick-cmd-input');
    const text = input.value.trim();

    if (text) {
      this.customCommands.push({
        label: text,
        text: text + '\r'
      });
      this.saveCustomCommands();
      input.value = '';
      this.ui.addCmdModal.classList.add('hidden');
    }
  }

  loadCustomCommands() {
    const stored = localStorage.getItem('customCommands');
    return stored ? JSON.parse(stored) : [];
  }

  saveCustomCommands() {
    localStorage.setItem('customCommands', JSON.stringify(this.customCommands));
  }

  async startWithOptions() {
    const options = [];
    if (document.getElementById('opt-resume').checked) options.push('-r');
    if (document.getElementById('opt-verbose').checked) options.push('--verbose');
    if (document.getElementById('opt-debug').checked) options.push('--debug');

    this.ui.settingsModal.classList.add('hidden');

    if (this.pendingProjectPath) {
      await this.createSession(this.pendingProjectPath, options);
      this.pendingProjectPath = null;
    }
  }

  async createSession(projectPath, options = []) {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, claudeOptions: options })
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      this.currentSession = data.session;

      // Update UI
      this.showTerminal();
      this.ui.currentProject.textContent = this.currentSession.projectName;
      this.updateConnectionStatus(true);

      // Connect to session
      this.terminal.connect(this.currentSession.id);
      this.terminal.focus();

      // Update session list
      this.loadActiveSessions();

      // Add to recent projects
      this.addRecentProject(projectPath);
    } catch (error) {
      console.error('Failed to create session:', error);
      alert('Failed to create session: ' + error.message);
    }
  }

  async connectToSession(sessionId) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/reconnect`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to reconnect to session');
      }

      const data = await response.json();
      this.currentSession = data.session;

      // Update UI
      this.showTerminal();
      this.ui.currentProject.textContent = this.currentSession.projectName;
      this.updateConnectionStatus(true);

      // Connect to session
      this.terminal.connect(this.currentSession.id);
      this.terminal.focus();
    } catch (error) {
      console.error('Failed to reconnect:', error);
      alert('Failed to reconnect to session');
    }
  }

  async closeCurrentSession() {
    if (!this.currentSession) return;

    try {
      await fetch(`/api/sessions/${this.currentSession.id}`, {
        method: 'DELETE'
      });

      this.terminal.disconnect();
      this.currentSession = null;
      this.showWelcome();
      this.loadActiveSessions();
    } catch (error) {
      console.error('Failed to close session:', error);
    }
  }

  async openProject(path) {
    this.pendingProjectPath = path;
    this.openSettingsModal();
  }

  async removeRecentProject(path) {
    try {
      await fetch(`/api/recent-projects/${encodeURIComponent(path)}`, {
        method: 'DELETE'
      });
      this.loadRecentProjects();
    } catch (error) {
      console.error('Failed to remove project:', error);
    }
  }

  async addRecentProject(path) {
    try {
      await fetch('/api/recent-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      this.loadRecentProjects();
    } catch (error) {
      console.error('Failed to add recent project:', error);
    }
  }

  showTerminal() {
    this.ui.welcomeScreen.classList.add('hidden');
    this.ui.terminalContainer.classList.remove('hidden');
  }

  showWelcome() {
    this.ui.welcomeScreen.classList.remove('hidden');
    this.ui.terminalContainer.classList.add('hidden');
    this.ui.currentProject.textContent = '-';
    this.updateConnectionStatus(false);
  }

  updateConnectionStatus(connected) {
    this.ui.connectionStatus.classList.toggle('connected', connected);
    this.ui.connectionStatus.classList.toggle('disconnected', !connected);
    this.ui.statusText.textContent = connected ? '已连接' : '就绪';
  }

  updateStateIndicator(state) {
    const indicator = this.ui.stateIndicator;
    const icon = indicator.querySelector('.state-icon');
    const text = indicator.querySelector('.state-text');

    switch (state.type) {
      case 'PERMISSION_PROMPT':
        icon.textContent = '⚠️';
        text.textContent = '等待确认 (y/n)';
        break;
      case 'CHOICE_PROMPT':
        icon.textContent = '🔢';
        text.textContent = '选择选项';
        break;
      case 'PLAN_MODE':
        icon.textContent = '';
        text.textContent = '计划模式';
        break;
      case 'TOOL_EXECUTION':
        icon.textContent = '⚙️';
        text.textContent = '执行中...';
        break;
      case 'SESSION_END':
        icon.textContent = '';
        text.textContent = '会话结束';
        break;
      case 'USER_INPUT':
        icon.textContent = '✏️';
        text.textContent = '等待输入';
        break;
      default:
        icon.textContent = '⏳';
        text.textContent = '准备就绪';
    }
  }

  switchToNextProject() {
    // Implementation for project switching
    console.log('Switch to next project');
  }

  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
