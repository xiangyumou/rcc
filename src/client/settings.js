import { themeManager, THEME_MODES } from './theme.js';

/**
 * Settings Manager - Handles all application settings
 */
class SettingsManager {
  constructor() {
    this.SHORTCUTS_KEY = 'custom-shortcuts';
    this.COMMANDS_KEY = 'custom-commands';

    this.DEFAULT_COMMANDS = [
      { id: 'cmd_clear', label: '/clear', value: '/clear', default: true },
      { id: 'cmd_help', label: '/help', value: '/help', default: true },
      { id: 'cmd_compact', label: '/compact', value: '/compact', default: true },
      { id: 'cmd_cost', label: '/cost', value: '/cost', default: true }
    ];

    this.DEFAULT_SHORTCUTS = [
      { id: 'shortcut_exit', action: '/exit', name: '退出会话', keys: 'Ctrl+D', default: true },
      { id: 'shortcut_clear', action: '/clear', name: '清屏', keys: 'Ctrl+L', default: true },
      { id: 'shortcut_switch', action: 'switch', name: '切换项目', keys: 'Shift+Tab', default: true }
    ];

    this.shortcuts = this.loadShortcuts();
    this.commands = this.loadCommands();
    this.currentRecording = null;

    this.init();
  }

  init() {
    themeManager.init();
    this.setupNavigation();
    this.setupThemeSelector();
    this.setupShortcuts();
    this.setupCommands();
    this.updateThemeUI(themeManager.getCurrentTheme());

    themeManager.onChange((mode) => {
      this.updateThemeUI(mode);
    });
  }

  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.settings-section');

    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetSection = item.dataset.section;

        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        sections.forEach(section => {
          section.classList.remove('active');
          if (section.id === targetSection) {
            section.classList.add('active');
          }
        });

        history.pushState(null, null, `#${targetSection}`);
      });
    });

    const hash = window.location.hash.slice(1);
    if (hash) {
      const targetNav = document.querySelector(`[data-section="${hash}"]`);
      if (targetNav) targetNav.click();
    }
  }

  setupThemeSelector() {
    const themeBtns = document.querySelectorAll('.theme-btn');
    const currentTheme = themeManager.getCurrentTheme();

    themeBtns.forEach(btn => {
      const theme = btn.dataset.theme;
      if (theme === currentTheme) {
        btn.classList.add('active');
      }

      btn.addEventListener('click', () => {
        themeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        themeManager.setTheme(theme);
      });
    });
  }

  updateThemeUI(mode) {
    const themeBtns = document.querySelectorAll('.theme-btn');
    themeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === mode);
    });
  }

  loadShortcuts() {
    try {
      const stored = localStorage.getItem(this.SHORTCUTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  saveShortcuts() {
    localStorage.setItem(this.SHORTCUTS_KEY, JSON.stringify(this.shortcuts));
  }

  setupShortcuts() {
    this.renderDefaultShortcuts();
    this.renderCustomShortcuts();
    this.setupShortcutForm();
  }

  renderDefaultShortcuts() {
    const container = document.getElementById('default-shortcuts-list');
    container.innerHTML = this.DEFAULT_SHORTCUTS.map(s => `
      <div class="shortcut-item">
        <div class="shortcut-info">
          <span class="shortcut-name">${s.name}</span>
          <span class="shortcut-default-badge">默认</span>
        </div>
        <div class="shortcut-keys">
          ${this.formatKeys(s.keys)}
        </div>
      </div>
    `).join('');
  }

  renderCustomShortcuts() {
    const container = document.getElementById('custom-shortcuts-list');
    if (this.shortcuts.length === 0) {
      container.innerHTML = '<div class="shortcut-empty">暂无自定义快捷键</div>';
      return;
    }

    container.innerHTML = this.shortcuts.map(s => `
      <div class="shortcut-item" data-id="${s.id}">
        <div class="shortcut-info">
          <span class="shortcut-name">${s.name}</span>
        </div>
        <div class="shortcut-keys">
          ${this.formatKeys(s.keys)}
          <button class="shortcut-remove-btn" data-id="${s.id}" title="删除">
            <i data-lucide="x"></i>
          </button>
        </div>
      </div>
    `).join('');

    lucide.createIcons();

    container.querySelectorAll('.shortcut-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => this.removeShortcut(btn.dataset.id));
    });
  }

  formatKeys(keys) {
    return keys.split('+').map(k =>
      `<kbd class="shortcut-key">${k.trim()}</kbd>`
    ).join('');
  }

  setupShortcutForm() {
    const addBtn = document.getElementById('add-shortcut-btn');
    const formCard = document.getElementById('shortcut-form-card');
    const cancelBtn = document.getElementById('cancel-shortcut');
    const saveBtn = document.getElementById('save-shortcut');
    const clearBtn = document.getElementById('clear-shortcut-input');
    const actionSelect = document.getElementById('shortcut-action');
    const keysInput = document.getElementById('shortcut-keys');

    const allCommands = [...this.DEFAULT_COMMANDS, ...this.commands];
    actionSelect.innerHTML = '<option value="">选择命令...</option>' +
      allCommands.map(cmd => `<option value="${cmd.value}">${cmd.label}</option>`).join('');

    addBtn.addEventListener('click', () => {
      formCard.classList.remove('hidden');
      addBtn.classList.add('hidden');
    });

    cancelBtn.addEventListener('click', () => {
      formCard.classList.add('hidden');
      addBtn.classList.remove('hidden');
      this.resetForm();
    });

    keysInput.addEventListener('keydown', (e) => {
      e.preventDefault();
      const keys = [];
      if (e.ctrlKey) keys.push('Ctrl');
      if (e.altKey) keys.push('Alt');
      if (e.shiftKey) keys.push('Shift');
      if (e.metaKey) keys.push('Meta');
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        keys.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      }
      if (keys.length > 0) {
        this.currentRecording = keys.join('+');
        keysInput.value = this.currentRecording;
      }
    });

    keysInput.addEventListener('focus', () => keysInput.classList.add('recording'));
    keysInput.addEventListener('blur', () => keysInput.classList.remove('recording'));

    clearBtn.addEventListener('click', () => {
      this.currentRecording = null;
      keysInput.value = '';
    });

    saveBtn.addEventListener('click', () => {
      const action = actionSelect.value;
      const keys = this.currentRecording;

      if (!action || !keys) {
        alert('请选择命令并设置快捷键');
        return;
      }

      const existing = [...this.DEFAULT_SHORTCUTS, ...this.shortcuts].find(s => s.keys === keys);
      if (existing) {
        alert(`快捷键 "${keys}" 已被使用`);
        return;
      }

      const command = allCommands.find(c => c.value === action);
      this.shortcuts.push({
        id: `shortcut_${Date.now()}`,
        action,
        name: command ? command.label : action,
        keys,
        editable: true
      });

      this.saveShortcuts();
      this.renderCustomShortcuts();
      formCard.classList.add('hidden');
      addBtn.classList.remove('hidden');
      this.resetForm();
    });
  }

  resetForm() {
    document.getElementById('shortcut-action').value = '';
    document.getElementById('shortcut-keys').value = '';
    this.currentRecording = null;
  }

  removeShortcut(id) {
    this.shortcuts = this.shortcuts.filter(s => s.id !== id);
    this.saveShortcuts();
    this.renderCustomShortcuts();
  }

  loadCommands() {
    try {
      const stored = localStorage.getItem(this.COMMANDS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  saveCommands() {
    localStorage.setItem(this.COMMANDS_KEY, JSON.stringify(this.commands));
  }

  setupCommands() {
    this.renderDefaultCommands();
    this.renderCustomCommands();

    const labelInput = document.getElementById('cmd-label');
    const valueInput = document.getElementById('cmd-value');
    const addBtn = document.getElementById('add-cmd-btn');

    addBtn.addEventListener('click', () => {
      const label = labelInput.value.trim();
      const value = valueInput.value.trim();

      if (!label || !value) {
        alert('请输入命令名称和内容');
        return;
      }

      this.commands.push({
        id: `cmd_${Date.now()}`,
        label,
        value
      });

      this.saveCommands();
      this.renderCustomCommands();
      labelInput.value = '';
      valueInput.value = '';
    });
  }

  renderDefaultCommands() {
    const container = document.getElementById('default-commands-list');
    container.innerHTML = this.DEFAULT_COMMANDS.map(cmd => `
      <div class="command-item">
        <div class="command-info">
          <span class="command-label">${cmd.label}</span>
          <span class="shortcut-default-badge">默认</span>
        </div>
        <span class="command-value">${cmd.value}</span>
      </div>
    `).join('');
  }

  renderCustomCommands() {
    const container = document.getElementById('custom-commands-list');
    if (this.commands.length === 0) {
      container.innerHTML = '<div class="command-empty">暂无自定义命令</div>';
      return;
    }

    container.innerHTML = this.commands.map(cmd => `
      <div class="command-item" data-id="${cmd.id}">
        <div class="command-info">
          <span class="command-label">${cmd.label}</span>
          <span class="command-value">${cmd.value}</span>
        </div>
        <button class="command-remove-btn" data-id="${cmd.id}" title="删除">
          <i data-lucide="x"></i>
        </button>
      </div>
    `).join('');

    lucide.createIcons();

    container.querySelectorAll('.command-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => this.removeCommand(btn.dataset.id));
    });
  }

  removeCommand(id) {
    this.commands = this.commands.filter(c => c.id !== id);
    this.saveCommands();
    this.renderCustomCommands();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.settingsManager = new SettingsManager();
});
