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

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Render custom commands
    this.renderCustomCommands();
  }

  setupEventListeners() {
    // New project buttons - open file browser
    this.ui.newProjectBtn.addEventListener('click', () => this.openFileBrowser());
    this.ui.welcomeNewBtn.addEventListener('click', () => this.openFileBrowser());

    // File browser navigation
    this.ui.fbGoUp.addEventListener('click', () => this.navigateUp());
    this.ui.fbConfirm.addEventListener('click', () => this.confirmFileSelection());

    // Close session
    this.ui.closeSessionBtn.addEventListener('click', () => this.closeCurrentSession());

    // Settings
    this.ui.settingsBtn.addEventListener('click', () => this.showSettingsModal());

    // Add custom command
    this.ui.addCmdBtn.addEventListener('click', () => this.showAddCommandModal());

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.add('hidden');
      });
    });

    // Start with options button
    document.getElementById('start-with-options').addEventListener('click', () => {
      this.startSessionWithOptions();
    });

    // Add custom command confirm
    document.getElementById('confirm-add-cmd').addEventListener('click', () => {
      this.addCustomCommand();
    });

    // Quick command buttons
    document.querySelectorAll('.cmd-btn[data-cmd]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cmd = e.target.dataset.cmd;
        this.sendQuickCommand(cmd);
      });
    });

    // Terminal state changes
    this.terminal.onStateChange((state) => {
      this.handleStateChange(state);
    });
  }

  // ============== File Browser Methods ==============

  async openFileBrowser() {
    this.ui.fileBrowserModal.classList.remove('hidden');
    this.fbSelectedPath = null;
    this.updateFbSelectedPath();

    // Load quick access directories
    await this.loadQuickAccess();

    // Try to get home directory first, fallback to /
    try {
      const response = await fetch('/api/fs/home');
      const data = await response.json();
      this.fbCurrentPath = data.path || '/';
    } catch (error) {
      console.error('Failed to get home directory:', error);
      this.fbCurrentPath = '/';
    }

    await this.loadDirectory(this.fbCurrentPath);
  }

  async loadQuickAccess() {
    try {
      const response = await fetch('/api/fs/quick-access');
      const dirs = await response.json();

      this.ui.fbQuickAccess.innerHTML = dirs.map(dir => `
        <button class="quick-dir-btn" data-path="${dir.path}">${dir.name}</button>
      `).join('');

      // Add click handlers
      this.ui.fbQuickAccess.querySelectorAll('.quick-dir-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.loadDirectory(btn.dataset.path);
        });
      });
    } catch (error) {
      console.error('Failed to load quick access:', error);
    }
  }

  async loadDirectory(dirPath) {
    try {
      this.ui.fileList.innerHTML = '<div class="loading">加载中...</div>';

      const response = await fetch(`/api/fs/list?path=${encodeURIComponent(dirPath)}`);
      const data = await response.json();

      this.fbCurrentPath = data.currentPath;
      this.ui.fbCurrentPath.textContent = data.currentPath;

      // Update go up button
      this.ui.fbGoUp.disabled = !data.parentPath;
      this.ui.fbGoUp.onclick = () => {
        if (data.parentPath) {
          this.loadDirectory(data.parentPath);
        }
      };

      // Render file list
      if (data.items.length === 0) {
        this.ui.fileList.innerHTML = '<div class="empty-dir">空文件夹</div>';
        return;
      }

      this.ui.fileList.innerHTML = data.items.map(item => `
        <div class="file-item ${item.type}" data-path="${item.path}" data-type="${item.type}">
          <span class="file-icon">${item.type === 'directory' ? '📁' : '📄'}</span>
          <span class="file-name">${item.name}</span>
          <span class="file-meta">${item.type === 'file' ? this.formatFileSize(item.size) : ''}</span>
        </div>
      `).join('');

      // Add click handlers
      this.ui.fileList.querySelectorAll('.file-item').forEach(item => {
        item.addEventListener('click', (e) => {
          const path = item.dataset.path;
          const type = item.dataset.type;

          if (type === 'directory') {
            // Double click to enter, single click to select
            if (e.detail === 2) {
              this.loadDirectory(path);
            } else {
              this.selectFileItem(item, path);
            }
          } else {
            this.selectFileItem(item, path);
          }
        });
      });
    } catch (error) {
      console.error('Failed to load directory:', error);
      this.ui.fileList.innerHTML = `<div class="loading">加载失败: ${error.message}</div>`;
    }
  }

  selectFileItem(element, path) {
    // Remove previous selection
    this.ui.fileList.querySelectorAll('.file-item').forEach(item => {
      item.classList.remove('selected');
    });

    // Add selection to clicked item
    element.classList.add('selected');
    this.fbSelectedPath = path;
    this.updateFbSelectedPath();
  }

  navigateUp() {
    // This is handled by the go up button onclick
  }

  updateFbSelectedPath() {
    this.ui.fbSelectedPath.textContent = this.fbSelectedPath || '';
    this.ui.fbConfirm.disabled = !this.fbSelectedPath;
  }

  confirmFileSelection() {
    if (!this.fbSelectedPath) return;

    this.pendingProjectPath = this.fbSelectedPath;
    this.ui.fileBrowserModal.classList.add('hidden');
    this.showSettingsModal();
  }

  formatFileSize(bytes) {
    if (bytes === undefined) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  // ============== Settings and Session Methods ==============

  showSettingsModal() {
    this.ui.settingsModal.classList.remove('hidden');
    this.renderCustomCommandsList();
  }

  showAddCommandModal() {
    this.ui.addCmdModal.classList.remove('hidden');
    document.getElementById('quick-cmd-input').focus();
  }

  getSelectedOptions() {
    const options = [];
    if (document.getElementById('opt-resume').checked) {
      options.push('-r');
    }
    if (document.getElementById('opt-verbose').checked) {
      options.push('--verbose');
    }
    if (document.getElementById('opt-debug').checked) {
      options.push('--debug');
    }
    return options;
  }

  async startSessionWithOptions() {
    if (!this.pendingProjectPath) {
      this.ui.settingsModal.classList.add('hidden');
      return;
    }

    const options = this.getSelectedOptions();

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: this.pendingProjectPath,
          claudeOptions: options
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      this.connectToSession(data.session);

      this.pendingProjectPath = null;
      this.ui.settingsModal.classList.add('hidden');

      // Clear checkboxes
      document.querySelectorAll('#settings-modal input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
      });

    } catch (error) {
      console.error('Failed to start session:', error);
      alert('Failed to start session. Please try again.');
    }
  }

  async connectToSession(session) {
    this.currentSession = session;

    // Update UI
    this.ui.welcomeScreen.classList.add('hidden');
    this.ui.terminalContainer.classList.remove('hidden');
    this.ui.currentProject.textContent = session.projectName;
    this.ui.connectionStatus.className = 'status connected';
    this.ui.connectionStatus.title = '已连接';

    // Update sidebar selection
    this.updateSidebarSelection(session.id);

    // Connect terminal
    this.terminal.connect(session.id);

    // Update status
    this.ui.statusText.textContent = `会话: ${session.projectName}`;
    this.ui.sessionInfo.textContent = new Date().toLocaleTimeString();

    // Refresh active sessions
    this.loadActiveSessions();
  }

  async reconnectToSession(sessionId) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/reconnect`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to reconnect');
      }

      const data = await response.json();
      this.connectToSession(data.session);
    } catch (error) {
      console.error('Failed to reconnect:', error);
      alert('Failed to reconnect to session. It may have been terminated.');
      this.loadActiveSessions();
    }
  }

  closeCurrentSession() {
    if (!this.currentSession) return;

    if (confirm('确定要关闭当前会话吗？')) {
      fetch(`/api/sessions/${this.currentSession.id}`, {
        method: 'DELETE'
      }).then(() => {
        this.terminal.disconnect();
        this.currentSession = null;
        this.showWelcomeScreen();
        this.loadActiveSessions();
      });
    }
  }

  showWelcomeScreen() {
    this.ui.welcomeScreen.classList.remove('hidden');
    this.ui.terminalContainer.classList.add('hidden');
    this.ui.currentProject.textContent = '-';
    this.ui.connectionStatus.className = 'status disconnected';
    this.ui.connectionStatus.title = '未连接';
    this.ui.statusText.textContent = '就绪';
    this.updateSidebarSelection(null);
  }

  async loadRecentProjects() {
    try {
      const response = await fetch('/api/recent-projects');
      this.recentProjects = await response.json();
      this.renderRecentProjects();
    } catch (error) {
      console.error('Failed to load recent projects:', error);
    }
  }

  async loadActiveSessions() {
    try {
      const response = await fetch('/api/sessions');
      this.activeSessions = await response.json();
      this.renderActiveSessions();
    } catch (error) {
      console.error('Failed to load active sessions:', error);
    }
  }

  renderRecentProjects() {
    if (this.recentProjects.length === 0) {
      this.ui.projectList.innerHTML = '<li class="empty-message">没有最近项目</li>';
      return;
    }

    this.ui.projectList.innerHTML = this.recentProjects.map(project => `
      <li data-path="${project.path}">
        <span class="icon">📁</span>
        <span class="name">${project.name}</span>
        <span class="remove" title="从列表移除">×</span>
      </li>
    `).join('');

    // Add click handlers
    this.ui.projectList.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove')) {
          e.stopPropagation();
          this.removeRecentProject(li.dataset.path);
        } else {
          this.pendingProjectPath = li.dataset.path;
          this.showSettingsModal();
        }
      });
    });
  }

  renderActiveSessions() {
    const runningSessions = this.activeSessions.filter(s => s.status === 'running');

    if (runningSessions.length === 0) {
      this.ui.sessionList.innerHTML = '<li class="empty-message">没有活动会话</li>';
      return;
    }

    this.ui.sessionList.innerHTML = runningSessions.map(session => `
      <li data-id="${session.id}" class="${session.id === this.currentSession?.id ? 'active' : ''}">
        <span class="icon">🖥️</span>
        <span class="name">${session.projectName}</span>
      </li>
    `).join('');

    // Add click handlers
    this.ui.sessionList.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => {
        const sessionId = li.dataset.id;
        if (sessionId !== this.currentSession?.id) {
          if (this.currentSession) {
            this.terminal.disconnect();
          }
          this.reconnectToSession(sessionId);
        }
      });
    });
  }

  updateSidebarSelection(sessionId) {
    document.querySelectorAll('#session-list li').forEach(li => {
      li.classList.toggle('active', li.dataset.id === sessionId);
    });
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

  sendQuickCommand(cmd) {
    if (!this.currentSession) {
      alert('请先启动一个会话');
      return;
    }
    this.terminal.sendCommand(cmd);
    this.terminal.focus();
  }

  handleStateChange(state) {
    const indicator = this.ui.stateIndicator;
    const icon = indicator.querySelector('.state-icon');
    const text = indicator.querySelector('.state-text');

    indicator.className = 'state-indicator';

    switch (state.type) {
      case 'PERMISSION_PROMPT':
        indicator.classList.add('waiting');
        icon.textContent = '⚠️';
        text.textContent = '需要权限确认 (y/n)';
        break;

      case 'CHOICE_PROMPT':
        indicator.classList.add('waiting');
        icon.textContent = '🔢';
        text.textContent = '请选择选项';
        break;

      case 'PLAN_MODE':
        indicator.classList.add('active');
        icon.textContent = '📝';
        text.textContent = '计划模式已激活';
        break;

      case 'TOOL_EXECUTION':
        icon.textContent = '⚙️';
        text.textContent = '正在执行工具...';
        break;

      case 'SESSION_END':
        icon.textContent = '🛑';
        text.textContent = '会话已结束';
        break;

      case 'USER_INPUT':
        indicator.classList.add('active');
        icon.textContent = '✓';
        text.textContent = '准备就绪';
        break;

      default:
        icon.textContent = '⏳';
        text.textContent = '处理中...';
    }
  }

  focusSidebar() {
    const firstProject = this.ui.projectList.querySelector('li:not(.empty-message)');
    if (firstProject) {
      firstProject.focus();
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        this.focusSidebar();
      }

      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        this.closeCurrentSession();
      }

      if (e.ctrlKey && e.key === 'l') {
        this.terminal.focus();
      }

      if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
          modal.classList.add('hidden');
        });
      }
    });
  }

  // Custom commands management
  loadCustomCommands() {
    try {
      const saved = localStorage.getItem('ccwm-custom-commands');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  saveCustomCommands() {
    localStorage.setItem('ccwm-custom-commands', JSON.stringify(this.customCommands));
  }

  renderCustomCommands() {
    const container = document.querySelector('.quick-commands');
    const addBtn = document.getElementById('add-cmd-btn');

    container.querySelectorAll('.cmd-btn-custom').forEach(btn => btn.remove());

    this.customCommands.forEach(cmd => {
      const btn = document.createElement('button');
      btn.className = 'cmd-btn cmd-btn-custom';
      btn.textContent = cmd;
      btn.dataset.cmd = cmd;
      btn.addEventListener('click', () => this.sendQuickCommand(cmd));
      container.insertBefore(btn, addBtn);
    });
  }

  renderCustomCommandsList() {
    this.ui.customCommandsList.innerHTML = this.customCommands.map(cmd => `
      <div class="custom-cmd-item">
        <span>${cmd}</span>
        <span class="remove-cmd" data-cmd="${cmd}">×</span>
      </div>
    `).join('');

    this.ui.customCommandsList.querySelectorAll('.remove-cmd').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cmd = e.target.dataset.cmd;
        this.customCommands = this.customCommands.filter(c => c !== cmd);
        this.saveCustomCommands();
        this.renderCustomCommandsList();
        this.renderCustomCommands();
      });
    });
  }

  addCustomCommand() {
    const nameInput = document.getElementById('new-cmd-name');
    const valueInput = document.getElementById('new-cmd-value');

    const name = nameInput.value.trim();
    const value = valueInput.value.trim();

    if (!name) return;

    const cmd = value || name;
    if (!this.customCommands.includes(cmd)) {
      this.customCommands.push(cmd);
      this.saveCustomCommands();
      this.renderCustomCommands();

      nameInput.value = '';
      valueInput.value = '';

      if (!this.ui.settingsModal.classList.contains('hidden')) {
        this.renderCustomCommandsList();
      }
    }

    this.ui.addCmdModal.classList.add('hidden');
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
