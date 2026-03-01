/**
 * Logging configuration using loglevel with categorized loggers
 *
 * Categories:
 * - TREEVIEW:DATA: Data insertion, tree manipulation, node operations
 * - TREEVIEW:INDEX: Search indexing operations
 * - TREEVIEW:PERF: Performance timing (via perf-logger.ts)
 *
 * Usage:
 * - By default, all logging is disabled (silent mode) for production
 * - Enable logging in browser console:
 *   ```javascript
 *   import { enableLogging, setLogLevel, setCategoryLevel } from '@keenmate/web-treeview';
 *
 *   // Enable all logging at debug level
 *   enableLogging();
 *
 *   // Or set a specific log level for all categories
 *   setLogLevel('info');  // 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'
 *
 *   // Or enable/disable specific categories
 *   disableLogging();  // First disable all
 *   setCategoryLevel('TREEVIEW:INDEX', 'debug');  // Enable only index logs
 *   ```
 */

// Import vendored libraries via ES module wrappers
import log from './vendor/loglevel/index.js';
import prefix from './vendor/loglevel/prefix.js';

type Logger = typeof log;

// Define color scheme
const COLORS: Record<string, string> = {
    trace: '#9ca3af',  // Gray
    debug: '#0ea5e9',  // Blue
    info: '#10b981',   // Green
    warn: '#f59e0b',   // Orange
    error: '#ef4444'   // Red
};

// Register prefix plugin with the root logger
prefix.reg(log);

// Set default log level to silent (production mode)
log.setLevel('silent');

// Prefix format options that include %c markers
const prefixOptions = {
    format(level: string, name: string | undefined, timestamp: string) {
        return `%c[${timestamp}]%c %c[${level.toUpperCase()}]%c %c[${name}]%c`;
    },
    timestampFormatter(date: Date) {
        return date.toTimeString().split(' ')[0] + '.' + date.getMilliseconds().toString().padStart(3, '0');
    }
};

/**
 * Create a color-aware method factory that intercepts %c codes and adds CSS styles
 */
function createColorMethodFactory(originalFactory: any) {
    return function(methodName: string, logLevel: number, loggerName: string) {
        const rawMethod = originalFactory(methodName, logLevel, loggerName);

        return function(...args: any[]) {
            // If first arg contains %c color codes, inject the color styles
            if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('%c')) {
                const color = COLORS[methodName] || '#666';
                // Count how many %c markers we have (should be 6 for our format)
                const numMarkers = (args[0].match(/%c/g) || []).length;
                const colorStyles: string[] = [];
                for (let i = 0; i < numMarkers; i++) {
                    // Alternate between color and reset
                    colorStyles.push(i % 2 === 0 ? `color: ${color}; font-weight: bold;` : 'color: inherit;');
                }
                rawMethod(args[0], ...colorStyles, ...args.slice(1));
            } else {
                rawMethod(...args);
            }
        };
    };
}

// Create category-specific loggers
export const initLogger: Logger = log.getLogger('TREEVIEW:INIT');
export const dataLogger: Logger = log.getLogger('TREEVIEW:DATA');
export const indexLogger: Logger = log.getLogger('TREEVIEW:INDEX');
export const uiLogger: Logger = log.getLogger('TREEVIEW:UI');
export const dragLogger: Logger = log.getLogger('TREEVIEW:DRAG');
export const renderLogger: Logger = log.getLogger('TREEVIEW:RENDER');

// Apply prefix and color styling to all category loggers
const allLoggers: Logger[] = [
    initLogger,
    dataLogger,
    indexLogger,
    uiLogger,
    dragLogger,
    renderLogger
];

allLoggers.forEach(logger => {
    const originalFactory = logger.methodFactory;
    logger.methodFactory = createColorMethodFactory(originalFactory);
    prefix.apply(logger, prefixOptions);
    logger.setLevel('silent');
});

// INIT logger is enabled by default at debug level
initLogger.setLevel('debug');

// Export the default logger
export default log;

/**
 * List of all logging categories
 */
export const LOGGING_CATEGORIES = [
    'TREEVIEW:INIT',
    'TREEVIEW:DATA',
    'TREEVIEW:INDEX',
    'TREEVIEW:UI',
    'TREEVIEW:DRAG',
    'TREEVIEW:RENDER'
];

/**
 * Enable logging for all loggers
 */
export const setLogLevel = (level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent') => {
    log.setLevel(level);
    allLoggers.forEach(logger => logger.setLevel(level));
};

/**
 * Enable all logging (set to debug level)
 */
export const enableLogging = () => {
    setLogLevel('debug');
};

/**
 * Disable all logging (set to silent level)
 */
export const disableLogging = () => {
    setLogLevel('silent');
};

/**
 * Set log level for a specific category
 */
export const setCategoryLevel = (
    category: 'TREEVIEW:INIT' | 'TREEVIEW:DATA' | 'TREEVIEW:INDEX' | 'TREEVIEW:UI' | 'TREEVIEW:DRAG' | 'TREEVIEW:RENDER',
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent' = 'debug'
) => {
    const loggerMap: Record<string, Logger> = {
        'TREEVIEW:INIT': initLogger,
        'TREEVIEW:DATA': dataLogger,
        'TREEVIEW:INDEX': indexLogger,
        'TREEVIEW:UI': uiLogger,
        'TREEVIEW:DRAG': dragLogger,
        'TREEVIEW:RENDER': renderLogger
    };
    loggerMap[category]?.setLevel(level);
};
