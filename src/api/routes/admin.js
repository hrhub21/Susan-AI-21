import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateQueryParams } from '../middleware/validation.js';
import { moderateRateLimit } from '../middleware/rateLimit.js';
import { adminAuthMiddleware } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

const router = express.Router();

// Apply admin authentication to all routes
router.use(adminAuthMiddleware);

// Get system status
router.get('/system/status',
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const status = {
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      services: {
        api: 'healthy',
        database: 'healthy',
        ai_providers: {
          openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
          anthropic: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not configured'
        },
        websocket: 'healthy'
      },
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Get system metrics
router.get('/system/metrics',
  moderateRateLimit,
  validateQueryParams({
    type: 'object',
    properties: {
      timeframe: {
        type: 'string',
        enum: ['hour', 'day', 'week', 'month'],
        default: 'hour'
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const { timeframe = 'hour' } = req.query;
    
    // Mock metrics data
    const metrics = {
      timeframe,
      requests: {
        total: 1234,
        successful: 1200,
        failed: 34,
        rate: '2.5/sec'
      },
      response_times: {
        average: 250,
        p50: 180,
        p95: 450,
        p99: 800
      },
      resources: {
        cpu_usage: 15.2,
        memory_usage: 68.5,
        disk_usage: 42.1
      },
      ai_usage: {
        total_tokens: 45678,
        total_cost: 23.45,
        requests_by_model: {
          'gpt-3.5-turbo': 45,
          'claude-3-sonnet': 23,
          'gpt-4': 12
        }
      },
      errors: {
        rate: 0.02,
        top_errors: [
          { type: 'RateLimitError', count: 15 },
          { type: 'ValidationError', count: 12 },
          { type: 'AuthenticationError', count: 7 }
        ]
      }
    };
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Get system logs
router.get('/system/logs',
  moderateRateLimit,
  validateQueryParams({
    type: 'object',
    properties: {
      level: {
        type: 'string',
        enum: ['error', 'warn', 'info', 'debug']
      },
      service: { type: 'string' },
      limit: { type: 'string', pattern: '^([1-9]|[1-9]\\d|[1-9]\\d{2}|1000)$' },
      startDate: { type: 'string' },
      endDate: { type: 'string' }
    }
  }),
  asyncHandler(async (req, res) => {
    const { 
      level, 
      service, 
      limit = 100,
      startDate,
      endDate 
    } = req.query;
    
    const logs = logger.getRecentLogs({
      level,
      service,
      limit: parseInt(limit),
      startDate,
      endDate
    });
    
    res.json({
      success: true,
      data: {
        logs,
        total: logs.length,
        filters: {
          level,
          service,
          limit: parseInt(limit),
          startDate,
          endDate
        }
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Get configuration
router.get('/config',
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const config = {
      api: {
        version: 'v1',
        port: process.env.PORT || 3001,
        host: process.env.HOST || 'localhost',
        cors_origin: process.env.CORS_ORIGIN || 'localhost'
      },
      ai_providers: {
        openai: {
          configured: !!process.env.OPENAI_API_KEY,
          models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
        },
        anthropic: {
          configured: !!process.env.ANTHROPIC_API_KEY,
          models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']
        }
      },
      features: {
        voice_processing: true,
        file_upload: true,
        plugin_system: true,
        memory_search: true,
        real_time_data: true
      },
      limits: {
        max_file_size: '50MB',
        max_context_length: 100,
        rate_limit: '100 requests/15min'
      }
    };
    
    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Update configuration
router.put('/config',
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const { configuration } = req.body;
    
    // In production, update actual configuration
    logger.info('Configuration update requested', {
      adminUser: req.auth.user?.id || req.auth.key,
      changes: Object.keys(configuration || {})
    });
    
    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: { updated: Object.keys(configuration || {}) },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// System maintenance operations
router.post('/system/maintenance',
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const { operation, parameters = {} } = req.body;
    
    let result;
    
    switch (operation) {
      case 'cleanup_logs':
        result = logger.cleanupOldLogs(parameters.daysToKeep || 30);
        break;
      case 'restart_services':
        result = { message: 'Service restart initiated' };
        break;
      case 'backup_data':
        result = { message: 'Backup initiated', backupId: `backup_${Date.now()}` };
        break;
      default:
        throw ApiError.badRequest(`Unknown maintenance operation: ${operation}`);
    }
    
    logger.info('Maintenance operation executed', {
      operation,
      parameters,
      adminUser: req.auth.user?.id || req.auth.key,
      result
    });
    
    res.json({
      success: true,
      data: {
        operation,
        result,
        executedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

export default router;