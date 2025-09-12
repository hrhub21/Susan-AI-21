import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateJsonSchema, validateQueryParams, schemas } from '../middleware/validation.js';
import { moderateRateLimit } from '../middleware/rateLimit.js';
import { MemoryController } from '../controllers/MemoryController.js';

const router = express.Router();
const memoryController = new MemoryController();

// Search through memory and context
router.post('/search',
  moderateRateLimit,
  validateJsonSchema({
    type: 'object',
    required: ['query'],
    properties: {
      query: { type: 'string', minLength: 1, maxLength: 500 },
      filters: {
        type: 'object',
        properties: {
          conversationId: { type: 'string' },
          timeframe: {
            type: 'string',
            enum: ['day', 'week', 'month', 'year', 'all']
          },
          messageType: {
            type: 'string',
            enum: ['user', 'assistant', 'all']
          }
        }
      },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
      includeContext: { type: 'boolean' }
    },
    additionalProperties: false
  }),
  asyncHandler(memoryController.searchMemory.bind(memoryController))
);

// Get context for a conversation or query
router.get('/context',
  moderateRateLimit,
  validateQueryParams({
    type: 'object',
    properties: {
      conversationId: { type: 'string' },
      query: { type: 'string' },
      depth: { type: 'string', pattern: '^([1-9]|[1-4][0-9]|50)$' },
      includeGlobal: { type: 'string', enum: ['true', 'false'] }
    }
  }),
  asyncHandler(memoryController.getContext.bind(memoryController))
);

// Get memory analytics and insights
router.get('/analytics',
  moderateRateLimit,
  validateQueryParams({
    type: 'object',
    properties: {
      timeframe: {
        type: 'string',
        enum: ['week', 'month', 'year'],
        default: 'month'
      },
      includeConversations: { type: 'string', enum: ['true', 'false'] },
      groupBy: {
        type: 'string',
        enum: ['day', 'week', 'month'],
        default: 'day'
      }
    }
  }),
  asyncHandler(memoryController.getAnalytics.bind(memoryController))
);

// Get memory insights and patterns
router.get('/insights',
  moderateRateLimit,
  validateQueryParams({
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['topics', 'patterns', 'summary', 'all'],
        default: 'all'
      },
      timeframe: {
        type: 'string',
        enum: ['week', 'month', 'year'],
        default: 'month'
      }
    }
  }),
  asyncHandler(memoryController.getInsights.bind(memoryController))
);

// Export memory data
router.post('/export',
  moderateRateLimit,
  validateJsonSchema({
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['json', 'csv', 'txt'],
        default: 'json'
      },
      includeContext: { type: 'boolean', default: true },
      timeframe: {
        type: 'string',
        enum: ['week', 'month', 'year', 'all'],
        default: 'all'
      },
      filters: {
        type: 'object',
        properties: {
          conversationIds: {
            type: 'array',
            items: { type: 'string' }
          },
          keywords: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    },
    additionalProperties: false
  }),
  asyncHandler(memoryController.exportMemory.bind(memoryController))
);

// Clear memory (with filters)
router.delete('/clear',
  moderateRateLimit,
  validateJsonSchema({
    type: 'object',
    properties: {
      timeframe: {
        type: 'string',
        enum: ['week', 'month', 'year']
      },
      conversationIds: {
        type: 'array',
        items: { type: 'string' }
      },
      confirmationToken: { type: 'string' }
    },
    additionalProperties: false
  }),
  asyncHandler(memoryController.clearMemory.bind(memoryController))
);

// Get memory statistics
router.get('/stats',
  moderateRateLimit,
  asyncHandler(memoryController.getMemoryStats.bind(memoryController))
);

// Optimize memory (cleanup and reorganization)
router.post('/optimize',
  moderateRateLimit,
  validateJsonSchema({
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['cleanup', 'reorganize', 'full'],
        default: 'cleanup'
      },
      daysToKeep: { type: 'integer', minimum: 1, maximum: 365 },
      maxInteractions: { type: 'integer', minimum: 100, maximum: 10000 }
    },
    additionalProperties: false
  }),
  asyncHandler(memoryController.optimizeMemory.bind(memoryController))
);

export default router;