/**
 * Command definition
 */
export interface Command {
  id: string;
  label: string;
  text: string;
  category: CommandCategory;
  icon?: string;
}

/**
 * Command category
 */
export type CommandCategory = 'navigation' | 'utility' | 'custom';

/**
 * Quick command preset
 */
export interface QuickCommandPreset {
  name: string;
  commands: Command[];
}

/**
 * Custom command request
 */
export interface SaveCustomCommandRequest {
  label: string;
  text: string;
}

/**
 * Built-in quick commands
 */
export const BUILTIN_COMMANDS: Command[] = [
  { id: 'clear', label: '/clear', text: '/clear', category: 'utility' },
  { id: 'help', label: '/help', text: '/help', category: 'utility' },
  { id: 'compact', label: '/compact', text: '/compact', category: 'utility' },
  { id: 'cost', label: '/cost', text: '/cost', category: 'utility' },
  { id: 'exit', label: '/exit', text: '/exit', category: 'navigation' },
  { id: 'enter', label: '↵ Enter', text: '\r', category: 'utility' },
  { id: 'y', label: '✓ Yes', text: 'y\r', category: 'utility' },
  { id: 'n', label: '✗ No', text: 'n\r', category: 'utility' }
];
