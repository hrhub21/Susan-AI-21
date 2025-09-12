import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateJsonSchema, validateQueryParams, validateParams, schemas } from '../middleware/validation.js';
import { moderateRateLimit, strictRateLimit } from '../middleware/rateLimit.js';
import { PluginController } from '../controllers/PluginController.js';

const router = express.Router();
const pluginController = new PluginController();

// List all plugins (installed and available)
router.get('/',
  moderateRateLimit,
  validateQueryParams({
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['all', 'active', 'inactive', 'available', 'installed'],
        default: 'all'
      },
      category: { type: 'string' },
      search: { type: 'string' }
    }
  }),
  asyncHandler(pluginController.listPlugins.bind(pluginController))
);

// Get plugin marketplace/registry
router.get('/marketplace',
  moderateRateLimit,
  validateQueryParams({
    type: 'object',
    properties: {
      category: { type: 'string' },
      search: { type: 'string' },
      sortBy: {
        type: 'string',
        enum: ['name', 'downloads', 'rating', 'updated'],
        default: 'name'
      }
    }
  }),
  asyncHandler(pluginController.getMarketplace.bind(pluginController))
);

// Install a plugin
router.post('/install',
  strictRateLimit,
  validateJsonSchema(schemas.installPlugin),
  asyncHandler(pluginController.installPlugin.bind(pluginController))
);

// Get specific plugin details
router.get('/:pluginId',
  moderateRateLimit,
  validateParams({
    type: 'object',
    required: ['pluginId'],
    properties: {
      pluginId: { type: 'string', minLength: 1 }
    }
  }),
  asyncHandler(pluginController.getPlugin.bind(pluginController))
);

// Update plugin configuration or status
router.put('/:pluginId',
  moderateRateLimit,
  validateParams({
    type: 'object',
    required: ['pluginId'],
    properties: {
      pluginId: { type: 'string', minLength: 1 }
    }
  }),
  validateJsonSchema({
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['active', 'inactive']
      },
      configuration: { type: 'object' },
      settings: { type: 'object' }
    },
    additionalProperties: false
  }),
  asyncHandler(pluginController.updatePlugin.bind(pluginController))
);

// Uninstall a plugin
router.delete('/:pluginId',
  moderateRateLimit,
  validateParams({
    type: 'object',
    required: ['pluginId'],
    properties: {
      pluginId: { type: 'string', minLength: 1 }
    }
  }),
  asyncHandler(pluginController.uninstallPlugin.bind(pluginController))
);

// Execute a plugin function
router.post('/:pluginId/execute',
  moderateRateLimit,
  validateParams({
    type: 'object',
    required: ['pluginId'],
    properties: {
      pluginId: { type: 'string', minLength: 1 }
    }
  }),
  validateJsonSchema({
    type: 'object',
    required: ['function'],
    properties: {
      function: { type: 'string', minLength: 1 },
      parameters: { type: 'object' },
      timeout: { type: 'integer', minimum: 1000, maximum: 30000 }
    },
    additionalProperties: false
  }),
  asyncHandler(pluginController.executePlugin.bind(pluginController))
);

// Get plugin execution logs
router.get('/:pluginId/logs',
  moderateRateLimit,
  validateParams({
    type: 'object',
    required: ['pluginId'],
    properties: {
      pluginId: { type: 'string', minLength: 1 }
    }
  }),
  validateQueryParams({
    type: 'object',
    properties: {
      limit: { type: 'string', pattern: '^([1-9]|[1-9]\\d|100)$' },
      level: {
        type: 'string',
        enum: ['error', 'warn', 'info', 'debug']
      },
      startDate: { type: 'string' },
      endDate: { type: 'string' }
    }
  }),
  asyncHandler(pluginController.getPluginLogs.bind(pluginController))
);

// Get plugin metrics and performance data
router.get('/:pluginId/metrics',
  moderateRateLimit,
  validateParams({
    type: 'object',
    required: ['pluginId'],
    properties: {
      pluginId: { type: 'string', minLength: 1 }
    }
  }),
  validateQueryParams({
    type: 'object',
    properties: {
      timeframe: {
        type: 'string',
        enum: ['hour', 'day', 'week', 'month'],
        default: 'day'
      }
    }
  }),
  asyncHandler(pluginController.getPluginMetrics.bind(pluginController))
);

// Test plugin functionality
router.post('/:pluginId/test',
  moderateRateLimit,
  validateParams({
    type: 'object',
    required: ['pluginId'],
    properties: {
      pluginId: { type: 'string', minLength: 1 }
    }
  }),
  validateJsonSchema({
    type: 'object',
    properties: {
      testType: {
        type: 'string',
        enum: ['health', 'function', 'integration'],
        default: 'health'
      },
      parameters: { type: 'object' }
    },
    additionalProperties: false
  }),
  asyncHandler(pluginController.testPlugin.bind(pluginController))
);

export default router;