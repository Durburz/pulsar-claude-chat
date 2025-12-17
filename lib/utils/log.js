/** @babel */

/**
 * Debug logging utility for claude-chat
 * Only logs when debugMode config is enabled
 */

const PREFIX = "[claude-chat]";

/**
 * Check if debug mode is enabled
 */
function isDebugEnabled() {
  return atom.config.get("claude-chat.debugMode") === true;
}

/**
 * Format arguments for logging
 */
function formatArgs(args) {
  return args.map((arg) => {
    if (typeof arg === "object" && arg !== null) {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return arg;
  });
}

/**
 * Debug log - only outputs when debugMode is enabled
 */
export function debug(category, ...args) {
  if (!isDebugEnabled()) return;
  console.log(`${PREFIX} [${category}]`, ...formatArgs(args));
}

/**
 * Info log - always outputs
 */
export function info(category, ...args) {
  console.log(`${PREFIX} [${category}]`, ...args);
}

/**
 * Warning log - always outputs
 */
export function warn(category, ...args) {
  console.warn(`${PREFIX} [${category}]`, ...args);
}

/**
 * Error log - always outputs
 */
export function error(category, ...args) {
  console.error(`${PREFIX} [${category}]`, ...args);
}

/**
 * Create a scoped logger for a specific category
 */
export function createLogger(category) {
  return {
    debug: (...args) => debug(category, ...args),
    info: (...args) => info(category, ...args),
    warn: (...args) => warn(category, ...args),
    error: (...args) => error(category, ...args),
  };
}

/**
 * Log with timing - useful for performance debugging
 */
export function debugTimed(category, label, fn) {
  if (!isDebugEnabled()) return fn();

  const start = performance.now();
  const result = fn();

  if (result instanceof Promise) {
    return result.finally(() => {
      const duration = (performance.now() - start).toFixed(2);
      debug(category, `${label} completed in ${duration}ms`);
    });
  }

  const duration = (performance.now() - start).toFixed(2);
  debug(category, `${label} completed in ${duration}ms`);
  return result;
}

export default {
  debug,
  info,
  warn,
  error,
  createLogger,
  debugTimed,
  isDebugEnabled,
};
