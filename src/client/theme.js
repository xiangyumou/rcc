/**
 * Theme Manager - Handles light/dark/auto theme switching
 * Supports system preference detection and localStorage persistence
 */

export const THEME_MODES = {
  AUTO: 'auto',
  LIGHT: 'light',
  DARK: 'dark'
};

export class ThemeManager {
  constructor() {
    this.STORAGE_KEY = 'theme-preference';
    this.THEME_ATTRIBUTE = 'data-theme';
    this.THEME_CLASS = 'dark';
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this._listeners = [];
  }

  /**
   * Initialize theme on page load
   */
  init() {
    const savedTheme = this.getSavedTheme();
    if (savedTheme) {
      this.applyTheme(savedTheme);
    } else {
      // Default to auto
      this.applyTheme(THEME_MODES.AUTO);
    }

    // Listen for system theme changes
    this.mediaQuery.addEventListener('change', (e) => {
      // Only apply system theme if in auto mode
      if (this.getCurrentTheme() === THEME_MODES.AUTO) {
        this._applyEffectiveTheme(e.matches ? 'dark' : 'light');
      }
    });

    // Listen for storage changes (sync across tabs)
    window.addEventListener('storage', (e) => {
      if (e.key === this.STORAGE_KEY) {
        const newTheme = e.newValue || THEME_MODES.AUTO;
        this.applyTheme(newTheme, false);
      }
    });
  }

  /**
   * Get saved theme from localStorage
   * @returns {string|null} 'auto', 'dark', 'light', or null
   */
  getSavedTheme() {
    try {
      return localStorage.getItem(this.STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to read theme from localStorage:', e);
      return null;
    }
  }

  /**
   * Get system preferred theme
   * @returns {string} 'dark' or 'light'
   */
  getSystemTheme() {
    return this.mediaQuery.matches ? 'dark' : 'light';
  }

  /**
   * Get current theme mode (auto/light/dark)
   * @returns {string} 'auto', 'dark', or 'light'
   */
  getCurrentTheme() {
    const saved = this.getSavedTheme();
    if (saved === THEME_MODES.DARK || saved === THEME_MODES.LIGHT) {
      return saved;
    }
    return THEME_MODES.AUTO;
  }

  /**
   * Get effective theme (actual color scheme applied)
   * @returns {string} 'dark' or 'light'
   */
  getEffectiveTheme() {
    const current = this.getCurrentTheme();
    if (current === THEME_MODES.AUTO) {
      return this.getSystemTheme();
    }
    return current;
  }

  /**
   * Apply theme to document
   * @param {string} theme - 'auto', 'dark', or 'light'
   * @param {boolean} save - Whether to save to localStorage
   */
  applyTheme(theme, save = false) {
    if (!Object.values(THEME_MODES).includes(theme)) {
      theme = THEME_MODES.AUTO;
    }

    if (save) {
      this.saveTheme(theme);
    }

    // Calculate effective theme
    const effectiveTheme = theme === THEME_MODES.AUTO
      ? this.getSystemTheme()
      : theme;

    this._applyEffectiveTheme(effectiveTheme);

    // Notify listeners
    this._notifyListeners(theme, effectiveTheme);
  }

  /**
   * Apply the actual color scheme
   * @private
   * @param {string} effectiveTheme - 'dark' or 'light'
   */
  _applyEffectiveTheme(effectiveTheme) {
    if (effectiveTheme === 'dark') {
      document.documentElement.setAttribute(this.THEME_ATTRIBUTE, 'dark');
      document.body.classList.add(this.THEME_CLASS);
    } else {
      document.documentElement.removeAttribute(this.THEME_ATTRIBUTE);
      document.body.classList.remove(this.THEME_CLASS);
    }
  }

  /**
   * Save theme preference to localStorage
   * @param {string} theme - 'auto', 'dark', or 'light'
   */
  saveTheme(theme) {
    try {
      localStorage.setItem(this.STORAGE_KEY, theme);
    } catch (e) {
      console.warn('Failed to save theme to localStorage:', e);
    }
  }

  /**
   * Set theme mode
   * @param {string} theme - 'auto', 'dark', or 'light'
   */
  setTheme(theme) {
    this.applyTheme(theme, true);
  }

  /**
   * Cycle through themes: auto -> light -> dark -> auto
   * @returns {string} The new theme mode
   */
  toggle() {
    const current = this.getCurrentTheme();
    let newTheme;

    switch (current) {
      case THEME_MODES.AUTO:
        newTheme = THEME_MODES.LIGHT;
        break;
      case THEME_MODES.LIGHT:
        newTheme = THEME_MODES.DARK;
        break;
      case THEME_MODES.DARK:
        newTheme = THEME_MODES.AUTO;
        break;
      default:
        newTheme = THEME_MODES.AUTO;
    }

    this.setTheme(newTheme);
    return newTheme;
  }

  /**
   * Subscribe to theme changes
   * @param {Function} callback - (themeMode, effectiveTheme) => void
   * @returns {Function} Unsubscribe function
   */
  onChange(callback) {
    this._listeners.push(callback);
    return () => {
      const index = this._listeners.indexOf(callback);
      if (index > -1) {
        this._listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners
   * @private
   */
  _notifyListeners(themeMode, effectiveTheme) {
    this._listeners.forEach(callback => {
      try {
        callback(themeMode, effectiveTheme);
      } catch (e) {
        console.error('Theme change listener error:', e);
      }
    });

    // Dispatch custom event
    document.dispatchEvent(new CustomEvent('themechange', {
      detail: { themeMode, effectiveTheme }
    }));
  }
}

// Create singleton instance
export const themeManager = new ThemeManager();

// Default export for convenience
export default themeManager;
