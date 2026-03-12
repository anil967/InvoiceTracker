// lib/logger.js
/**
 * Production-grade logging utility
 */

const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

class Logger {
    constructor(context = 'App') {
        this.context = context;
    }

    _log(level, message, data = {}) {
        if (LOG_LEVELS[level] > currentLevel) return;

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            context: this.context,
            message,
            ...data,
        };

        // In production, send to monitoring service
        if (process.env.NODE_ENV === 'production') {
            // TODO: Send to monitoring service (e.g., Sentry, LogRocket, etc.)
            console.log(JSON.stringify(logEntry));
        } else {
            // Development: pretty print
            const color = {
                ERROR: '\x1b[31m',
                WARN: '\x1b[33m',
                INFO: '\x1b[36m',
                DEBUG: '\x1b[90m',
            }[level];
            const reset = '\x1b[0m';

            console.log(`${color}[${level}]${reset} ${timestamp} [${this.context}] ${message}`, data);
        }
    }

    error(message, data) {
        this._log('ERROR', message, data);
    }

    warn(message, data) {
        this._log('WARN', message, data);
    }

    info(message, data) {
        this._log('INFO', message, data);
    }

    debug(message, data) {
        this._log('DEBUG', message, data);
    }
}

// Export singleton instance
export const logger = new Logger();

// Export factory for context-specific loggers
export const createLogger = (context) => new Logger(context);
