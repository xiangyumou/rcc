export interface Session {
  id: string;
  projectPath: string;
  projectName: string;
  claudeOptions: string[];
  status: 'running' | 'paused' | 'stopped';
  createdAt: number;
  lastActiveAt: number;
}

export interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
  openCount: number;
}

export interface RecentProjectsData {
  projects: RecentProject[];
}

export interface DetectedState {
  type: string;
  match?: RegExpMatchArray | null;
}

// Client -> Server WebSocket messages
export interface ClientWSMessage {
  type: 'input' | 'resize' | 'ping';
  data?: string;
  cols?: number;
  rows?: number;
}

// Server -> Client WebSocket messages
export interface ServerWSMessage {
  type: 'output' | 'state' | 'error' | 'connected';
  data?: string;
  state?: DetectedState;
  sessionId?: string;
  message?: string;
}

// HTTP API types
export interface CreateSessionRequest {
  projectPath: string;
  claudeOptions?: string[];
}

export interface CreateSessionResponse {
  session: Session;
  wsUrl: string;
}

// Claude state detection patterns
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
