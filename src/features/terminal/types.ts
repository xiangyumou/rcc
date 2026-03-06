import { PTYAdapter } from '../../core/pty';

/**
 * Terminal configuration
 */
export interface TerminalConfig {
  cols: number;
  rows: number;
}

/**
 * Terminal instance
 */
export interface Terminal {
  id: string;
  pty: PTYAdapter;
  config: TerminalConfig;
}

/**
 * Terminal state
 */
export type TerminalState =
  | 'PERMISSION_PROMPT'
  | 'CHOICE_PROMPT'
  | 'PLAN_MODE'
  | 'TOOL_EXECUTION'
  | 'SESSION_END'
  | 'USER_INPUT'
  | 'normal';

/**
 * Detected state with match info
 */
export interface DetectedState {
  type: TerminalState;
  match?: RegExpMatchArray | null;
}

/**
 * State detection patterns
 */
export const STATE_PATTERNS: Record<string, RegExp> = {
  // Permission request (y/n)
  PERMISSION_PROMPT: /\(y\/n\)|\[y\/N\]|allow\?|permit\?/i,

  // Multiple choice prompt
  CHOICE_PROMPT: /\(\d+(-\d+)?\)|select.*option|choose.*number/i,

  // Tool execution waiting
  TOOL_EXECUTION: /Executing.*\.\.\.|Running.*command/i,

  // Session end
  SESSION_END: /Goodbye!|Session ended|Exiting\.\.\./i,

  // User input needed
  USER_INPUT: />\s*$|:\s*$|\$\s*$/,

  // Plan mode active
  PLAN_MODE: /Plan mode is active|Entering plan mode/i
};

/**
 * Server to client WebSocket message
 */
export interface ServerWSMessage {
  type: 'output' | 'state' | 'error' | 'connected';
  data?: string;
  state?: DetectedState;
  sessionId?: string;
  message?: string;
}

/**
 * Client to server WebSocket message
 */
export interface ClientWSMessage {
  type: 'input' | 'resize' | 'ping';
  data?: string;
  cols?: number;
  rows?: number;
}
