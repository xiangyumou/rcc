import { STATE_PATTERNS, DetectedState, TerminalState } from './types';

/**
 * Detect the current terminal state based on output
 */
export function detectState(output: string): DetectedState {
  // Check each pattern in order of priority

  // Permission prompts are highest priority
  if (STATE_PATTERNS.PERMISSION_PROMPT.test(output)) {
    return {
      type: 'PERMISSION_PROMPT',
      match: output.match(STATE_PATTERNS.PERMISSION_PROMPT)
    };
  }

  // Choice prompts
  if (STATE_PATTERNS.CHOICE_PROMPT.test(output)) {
    return {
      type: 'CHOICE_PROMPT',
      match: output.match(STATE_PATTERNS.CHOICE_PROMPT)
    };
  }

  // Plan mode
  if (STATE_PATTERNS.PLAN_MODE.test(output)) {
    return {
      type: 'PLAN_MODE',
      match: output.match(STATE_PATTERNS.PLAN_MODE)
    };
  }

  // Tool execution
  if (STATE_PATTERNS.TOOL_EXECUTION.test(output)) {
    return {
      type: 'TOOL_EXECUTION',
      match: output.match(STATE_PATTERNS.TOOL_EXECUTION)
    };
  }

  // Session end
  if (STATE_PATTERNS.SESSION_END.test(output)) {
    return {
      type: 'SESSION_END',
      match: output.match(STATE_PATTERNS.SESSION_END)
    };
  }

  // User input prompt (check last characters)
  const lastLine = output.split('\n').pop() || '';
  if (STATE_PATTERNS.USER_INPUT.test(lastLine)) {
    return {
      type: 'USER_INPUT',
      match: lastLine.match(STATE_PATTERNS.USER_INPUT)
    };
  }

  return { type: 'normal' };
}

/**
 * Get a user-friendly description of the state
 */
export function getStateDescription(state: DetectedState): string {
  switch (state.type) {
    case 'PERMISSION_PROMPT':
      return 'Waiting for permission confirmation (y/n)';
    case 'CHOICE_PROMPT':
      return 'Waiting for option selection';
    case 'PLAN_MODE':
      return 'Plan mode is active';
    case 'TOOL_EXECUTION':
      return 'Executing tool...';
    case 'SESSION_END':
      return 'Session ended';
    case 'USER_INPUT':
      return 'Ready for input';
    case 'normal':
    default:
      return 'Processing...';
  }
}

/**
 * Check if the state requires user interaction
 */
export function requiresUserInteraction(state: DetectedState): boolean {
  return [
    'PERMISSION_PROMPT',
    'CHOICE_PROMPT',
    'USER_INPUT'
  ].includes(state.type);
}
