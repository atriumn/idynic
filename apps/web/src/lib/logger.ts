import { Logger as AxiomLogger } from "next-axiom";
import { getRequestContext } from "./request-context";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogData {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  userId?: string;
  durationMs?: number;
  [key: string]: unknown;
}

// Axiom logger instance for sending logs to Axiom
let axiomLogger: AxiomLogger | null = null;

function getAxiomLogger(): AxiomLogger {
  if (!axiomLogger) {
    axiomLogger = new AxiomLogger();
  }
  return axiomLogger;
}

/**
 * Structured logger with automatic correlation ID injection
 *
 * Usage:
 *   log.info("Processing resume", { fileName: "resume.pdf" });
 *   log.error("PDF parsing failed", { error: err.message });
 *
 * All logs automatically include:
 * - timestamp
 * - level
 * - requestId (from AsyncLocalStorage if available)
 * - userId (from AsyncLocalStorage if available)
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  data?: LogData
): LogEntry {
  const context = getRequestContext();

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };

  // Add context if available
  if (context) {
    entry.requestId = context.requestId;
    if (context.userId) {
      entry.userId = context.userId;
    }
    // Add duration if we have a start time
    entry.durationMs = Date.now() - context.startTime;
  }

  return entry;
}

function formatForConsole(entry: LogEntry): string {
  const { message, requestId, userId, durationMs } = entry;

  // Extract extra data (everything except the standard fields)
  const extraData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (!["timestamp", "level", "message", "requestId", "userId", "durationMs"].includes(key)) {
      extraData[key] = value;
    }
  }

  const prefix = requestId
    ? `[${requestId.slice(0, 8)}]`
    : "";

  const userStr = userId ? ` user=${userId.slice(0, 8)}` : "";
  const durationStr = durationMs !== undefined ? ` +${durationMs}ms` : "";

  const dataStr = Object.keys(extraData).length > 0
    ? ` ${JSON.stringify(extraData)}`
    : "";

  return `${prefix} ${message}${userStr}${durationStr}${dataStr}`;
}

function logToConsole(entry: LogEntry): void {
  const formatted = formatForConsole(entry);

  // Log to console for local development
  switch (entry.level) {
    case "debug":
      console.debug(formatted);
      break;
    case "info":
      console.log(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "error":
      console.error(formatted);
      break;
  }

  // Also send to Axiom for production
  try {
    const axiom = getAxiomLogger();
    const { level, ...data } = entry;
    switch (level) {
      case "debug":
        axiom.debug(entry.message, data);
        break;
      case "info":
        axiom.info(entry.message, data);
        break;
      case "warn":
        axiom.warn(entry.message, data);
        break;
      case "error":
        axiom.error(entry.message, data);
        break;
    }
  } catch {
    // Silently ignore Axiom errors - don't break the app
  }
}

export const log = {
  debug(message: string, data?: LogData): void {
    const entry = createLogEntry("debug", message, data);
    logToConsole(entry);
  },

  info(message: string, data?: LogData): void {
    const entry = createLogEntry("info", message, data);
    logToConsole(entry);
  },

  warn(message: string, data?: LogData): void {
    const entry = createLogEntry("warn", message, data);
    logToConsole(entry);
  },

  error(message: string, data?: LogData): void {
    const entry = createLogEntry("error", message, data);
    logToConsole(entry);
  },

  /**
   * Flush logs to Axiom. Call this at the end of API route handlers
   * to ensure logs are sent before the response completes.
   */
  async flush(): Promise<void> {
    if (axiomLogger) {
      await axiomLogger.flush();
    }
  },
};

/**
 * Create a child logger with additional context
 * Useful for adding consistent fields across related log calls
 */
export function createLogger(baseData: LogData) {
  return {
    debug(message: string, data?: LogData): void {
      log.debug(message, { ...baseData, ...data });
    },
    info(message: string, data?: LogData): void {
      log.info(message, { ...baseData, ...data });
    },
    warn(message: string, data?: LogData): void {
      log.warn(message, { ...baseData, ...data });
    },
    error(message: string, data?: LogData): void {
      log.error(message, { ...baseData, ...data });
    },
  };
}
