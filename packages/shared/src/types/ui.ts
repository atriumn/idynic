/**
 * Shared UI constants for consistent styling across web and mobile
 */

/**
 * Color tokens for job progress UI
 * These ensure visual consistency between React and React Native components
 */
export const PROGRESS_COLORS = {
  // Phase indicator colors
  completed: {
    text: '#22c55e', // green-500
    icon: '#22c55e',
  },
  active: {
    text: '#14b8a6', // teal-500
    spinner: '#14b8a6',
  },
  pending: {
    text: '#64748b', // slate-500
    opacity: 0.4,
  },

  // Highlight feed colors
  highlight: {
    primary: '#e2e8f0', // slate-200 (light mode: slate-800)
    secondary: '#94a3b8', // slate-400
    muted: '#64748b', // slate-500
  },

  // Status colors
  success: {
    background: 'rgba(20, 184, 166, 0.1)', // teal-500/10
    border: '#0d9488', // teal-600
    text: '#2dd4bf', // teal-400
  },
  warning: {
    text: '#eab308', // yellow-500
  },
  error: {
    text: '#ef4444', // red-500
  },
} as const;

/**
 * Message fade opacity values for highlights feed
 * Index corresponds to position in the list (0 = newest)
 */
export const MESSAGE_FADE_OPACITY = [1, 0.6, 0.4, 0.2] as const;

/**
 * Animation timing constants
 */
export const ANIMATION_TIMING = {
  /** Ticker message interval in milliseconds */
  tickerInterval: 4000,
  /** Transition duration for message fade */
  messageFade: 500,
} as const;

/**
 * Phase indicator symbols (for consistency)
 */
export const PHASE_SYMBOLS = {
  completed: '✓',
  pending: '○',
} as const;
