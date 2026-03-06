import { Command, SaveCustomCommandRequest, BUILTIN_COMMANDS } from './types';
import { StorageAdapter, JSONStorageAdapter } from '../../core/storage';

const CUSTOM_COMMANDS_KEY = 'custom-commands';

/**
 * Command Registry
 * Manages built-in and custom commands
 */
export class CommandRegistry {
  private customStorage: StorageAdapter<Command[]>;
  private customCommands: Command[] = [];

  constructor(dataDir: string) {
    this.customStorage = new JSONStorageAdapter<Command[]>({
      baseDir: dataDir
    });
  }

  /**
   * Initialize and load custom commands
   */
  async initialize(): Promise<void> {
    const stored = await this.customStorage.read(CUSTOM_COMMANDS_KEY);
    if (stored) {
      this.customCommands = stored;
    }
  }

  /**
   * Get all available commands (built-in + custom)
   */
  getAllCommands(): Command[] {
    return [...BUILTIN_COMMANDS, ...this.customCommands];
  }

  /**
   * Get built-in commands
   */
  getBuiltinCommands(): Command[] {
    return [...BUILTIN_COMMANDS];
  }

  /**
   * Get custom commands
   */
  getCustomCommands(): Command[] {
    return [...this.customCommands];
  }

  /**
   * Add a custom command
   */
  async addCustomCommand(request: SaveCustomCommandRequest): Promise<Command> {
    const command: Command = {
      id: `custom-${Date.now()}`,
      label: request.label,
      text: request.text,
      category: 'custom'
    };

    this.customCommands.push(command);
    await this.saveCustomCommands();

    return command;
  }

  /**
   * Remove a custom command
   */
  async removeCustomCommand(commandId: string): Promise<boolean> {
    const initialLength = this.customCommands.length;
    this.customCommands = this.customCommands.filter(c => c.id !== commandId);

    if (this.customCommands.length !== initialLength) {
      await this.saveCustomCommands();
      return true;
    }

    return false;
  }

  /**
   * Get commands by category
   */
  getCommandsByCategory(category: Command['category']): Command[] {
    return this.getAllCommands().filter(c => c.category === category);
  }

  /**
   * Find command by ID
   */
  findCommand(id: string): Command | undefined {
    return this.getAllCommands().find(c => c.id === id);
  }

  /**
   * Save custom commands to storage
   */
  private async saveCustomCommands(): Promise<void> {
    await this.customStorage.write(CUSTOM_COMMANDS_KEY, this.customCommands);
  }
}

export * from './types';
