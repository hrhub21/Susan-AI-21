import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../../..', 'logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };

    return JSON.stringify(logEntry) + '\n';
  }

  writeToFile(level, message, meta = {}) {
    const filename = `${new Date().toISOString().split('T')[0]}.log`;
    const filepath = path.join(this.logDir, filename);
    const formattedMessage = this.formatMessage(level, message, meta);

    fs.appendFileSync(filepath, formattedMessage);
  }

  writeToConsole(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const colors = {
      error: '\x1b[31m',   // Red
      warn: '\x1b[33m',    // Yellow
      info: '\x1b[36m',    // Cyan
      debug: '\x1b[35m',   // Magenta
      reset: '\x1b[0m'     // Reset
    };

    const color = colors[level] || colors.reset;
    const levelStr = level.toUpperCase().padEnd(5);
    
    console.log(
      `${color}[${timestamp}] ${levelStr}${colors.reset} ${message}`,
      Object.keys(meta).length > 0 ? meta : ''
    );
  }

  log(level, message, meta = {}) {
    // Always write to file
    this.writeToFile(level, message, meta);

    // Write to console based on environment and log level
    const shouldLogToConsole = this.shouldLogToConsole(level);
    if (shouldLogToConsole) {
      this.writeToConsole(level, message, meta);
    }
  }

  shouldLogToConsole(level) {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex <= currentLevelIndex;
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  // API-specific logging methods
  apiRequest(req, res, duration) {
    this.info('API Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      auth: req.auth ? req.auth.type : 'none'
    });
  }

  apiError(error, req) {
    this.error('API Error', {
      error: error.message,
      statusCode: error.statusCode || 500,
      stack: error.stack,
      method: req.method,
      path: req.path,
      requestId: req.requestId,
      ip: req.ip,
      auth: req.auth ? req.auth.type : 'none'
    });
  }

  modelUsage(modelId, tokensUsed, cost, duration) {
    this.info('Model Usage', {
      modelId,
      tokensUsed,
      cost,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  }

  pluginExecution(pluginId, functionName, success, duration, error = null) {
    this.info('Plugin Execution', {
      pluginId,
      functionName,
      success,
      duration: `${duration}ms`,
      error: error ? error.message : null
    });
  }

  securityEvent(event, details) {
    this.warn('Security Event', {
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  // Method to get recent logs (for admin API)
  getRecentLogs(options = {}) {
    const {
      level = null,
      limit = 100,
      service = null,
      startDate = null,
      endDate = null
    } = options;

    try {
      const files = fs.readdirSync(this.logDir);
      const logFiles = files
        .filter(file => file.endsWith('.log'))
        .sort()
        .reverse(); // Most recent first

      const logs = [];
      
      for (const file of logFiles) {
        const filepath = path.join(this.logDir, file);
        const content = fs.readFileSync(filepath, 'utf8');
        const lines = content.trim().split('\n').filter(line => line);
        
        for (const line of lines) {
          try {
            const logEntry = JSON.parse(line);
            
            // Apply filters
            if (level && logEntry.level.toLowerCase() !== level.toLowerCase()) {
              continue;
            }
            
            if (service && (!logEntry.service || logEntry.service !== service)) {
              continue;
            }
            
            if (startDate && new Date(logEntry.timestamp) < new Date(startDate)) {
              continue;
            }
            
            if (endDate && new Date(logEntry.timestamp) > new Date(endDate)) {
              continue;
            }
            
            logs.push(logEntry);
            
            if (logs.length >= limit) {
              break;
            }
          } catch (parseError) {
            // Skip malformed log entries
            continue;
          }
        }
        
        if (logs.length >= limit) {
          break;
        }
      }
      
      return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      this.error('Failed to read logs', { error: error.message });
      return [];
    }
  }

  // Method to clean up old logs
  cleanupOldLogs(daysToKeep = 30) {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      let deletedCount = 0;
      
      for (const file of files) {
        if (!file.endsWith('.log')) continue;
        
        const filepath = path.join(this.logDir, file);
        const stats = fs.statSync(filepath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filepath);
          deletedCount++;
        }
      }
      
      this.info('Log Cleanup', {
        deletedFiles: deletedCount,
        daysToKeep,
        cutoffDate: cutoffDate.toISOString()
      });
      
      return deletedCount;
    } catch (error) {
      this.error('Log cleanup failed', { error: error.message });
      return 0;
    }
  }
}

export const logger = new Logger();

// Request logging middleware
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.apiRequest(req, res, duration);
  });
  
  next();
};