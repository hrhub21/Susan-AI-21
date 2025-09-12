import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateQueryParams, validateParams, schemas } from '../middleware/validation.js';
import { moderateRateLimit } from '../middleware/rateLimit.js';
import { ModelController } from '../controllers/ModelController.js';

const router = express.Router();
const modelController = new ModelController();

// Get list of available AI models
router.get('/',
  moderateRateLimit,
  asyncHandler(modelController.listModels.bind(modelController))
);

// Get specific model details
router.get('/:modelId',
  moderateRateLimit,
  validateParams({
    type: 'object',
    required: ['modelId'],
    properties: {
      modelId: { type: 'string', minLength: 1 }
    }
  }),
  asyncHandler(modelController.getModelDetails.bind(modelController))
);

// Get model performance metrics
router.get('/:modelId/metrics',
  moderateRateLimit,
  validateParams({
    type: 'object',
    required: ['modelId'],
    properties: {
      modelId: { type: 'string', minLength: 1 }
    }
  }),
  validateQueryParams({
    type: 'object',
    properties: {
      timeframe: {
        type: 'string',
        enum: ['hour', 'day', 'week', 'month'],
        default: 'day'
      },
      includeDetails: { type: 'string', enum: ['true', 'false'] }
    }
  }),
  asyncHandler(modelController.getModelMetrics.bind(modelController))
);

// Get model usage statistics
router.get('/:modelId/usage',
  moderateRateLimit,
  validateParams({
    type: 'object',
    required: ['modelId'],
    properties: {
      modelId: { type: 'string', minLength: 1 }
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
  asyncHandler(modelController.getModelUsage.bind(modelController))
);

// Get cost analysis for models
router.get('/analytics/costs',
  moderateRateLimit,
  validateQueryParams({
    type: 'object',
    properties: {
      timeframe: {
        type: 'string',
        enum: ['day', 'week', 'month', 'year'],
        default: 'month'
      },
      groupBy: {
        type: 'string',
        enum: ['model', 'day', 'user'],
        default: 'model'
      }
    }
  }),
  asyncHandler(modelController.getCostAnalytics.bind(modelController))
);

// Get performance comparison between models
router.get('/analytics/performance',
  moderateRateLimit,
  validateQueryParams({
    type: 'object',
    properties: {
      models: { type: 'string' }, // comma-separated model IDs
      timeframe: {
        type: 'string',
        enum: ['day', 'week', 'month'],
        default: 'week'
      },
      metric: {
        type: 'string',
        enum: ['response_time', 'tokens_per_second', 'cost_efficiency'],
        default: 'response_time'
      }
    }
  }),
  asyncHandler(modelController.getPerformanceComparison.bind(modelController))
);

// Get model recommendations based on usage patterns
router.get('/recommendations',
  moderateRateLimit,
  validateQueryParams({
    type: 'object',
    properties: {
      useCase: {
        type: 'string',
        enum: ['general', 'coding', 'creative', 'analysis', 'conversation']
      },
      prioritizeBy: {
        type: 'string',
        enum: ['cost', 'speed', 'quality'],
        default: 'quality'
      }
    }
  }),
  asyncHandler(modelController.getModelRecommendations.bind(modelController))
);

export default router;