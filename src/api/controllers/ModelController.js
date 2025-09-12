import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { AIService } from '../services/AIService.js';
import { ModelMetricsService } from '../services/ModelMetricsService.js';

export class ModelController {
  constructor() {
    this.aiService = new AIService();
    this.metricsService = new ModelMetricsService();
  }

  async listModels(req, res) {
    try {
      const models = this.aiService.getAvailableModels();
      
      // Enhance with current status and metrics
      const enhancedModels = await Promise.all(
        models.map(async (model) => {
          const recentMetrics = await this.metricsService.getRecentMetrics(model.id);
          return {
            ...model,
            status: 'available',
            recentMetrics: {
              averageResponseTime: recentMetrics.averageResponseTime || 0,
              successRate: recentMetrics.successRate || 0,
              requestsLast24h: recentMetrics.requestsLast24h || 0
            }
          };
        })
      );

      res.json({
        success: true,
        data: {
          models: enhancedModels,
          total: enhancedModels.length
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getModelDetails(req, res) {
    const { modelId } = req.params;

    try {
      const models = this.aiService.getAvailableModels();
      const model = models.find(m => m.id === modelId);

      if (!model) {
        throw ApiError.notFound(`Model '${modelId}' not found`);
      }

      // Get detailed metrics
      const detailedMetrics = await this.metricsService.getDetailedMetrics(modelId);
      const usageHistory = await this.metricsService.getUsageHistory(modelId, 'week');

      res.json({
        success: true,
        data: {
          model: {
            ...model,
            status: 'available',
            detailedMetrics,
            usageHistory
          }
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getModelMetrics(req, res) {
    const { modelId } = req.params;
    const { timeframe = 'day', includeDetails = 'false' } = req.query;

    try {
      // Verify model exists
      const models = this.aiService.getAvailableModels();
      const model = models.find(m => m.id === modelId);

      if (!model) {
        throw ApiError.notFound(`Model '${modelId}' not found`);
      }

      const metrics = await this.metricsService.getMetrics(modelId, timeframe);
      
      if (includeDetails === 'true') {
        metrics.details = await this.metricsService.getDetailedMetrics(modelId, timeframe);
      }

      res.json({
        success: true,
        data: {
          modelId,
          timeframe,
          metrics
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getModelUsage(req, res) {
    const { modelId } = req.params;
    const { timeframe = 'day' } = req.query;
    const userId = this.getUserId(req);

    try {
      // Verify model exists
      const models = this.aiService.getAvailableModels();
      const model = models.find(m => m.id === modelId);

      if (!model) {
        throw ApiError.notFound(`Model '${modelId}' not found`);
      }

      const usage = await this.metricsService.getUserModelUsage(userId, modelId, timeframe);

      res.json({
        success: true,
        data: {
          modelId,
          userId,
          timeframe,
          usage
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getCostAnalytics(req, res) {
    const { timeframe = 'month', groupBy = 'model' } = req.query;
    const userId = this.getUserId(req);

    try {
      const costAnalytics = await this.metricsService.getCostAnalytics({
        userId,
        timeframe,
        groupBy
      });

      res.json({
        success: true,
        data: {
          timeframe,
          groupBy,
          analytics: costAnalytics
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getPerformanceComparison(req, res) {
    const { 
      models: modelsParam,
      timeframe = 'week', 
      metric = 'response_time' 
    } = req.query;

    try {
      let modelIds = [];
      
      if (modelsParam) {
        modelIds = modelsParam.split(',').map(id => id.trim());
      } else {
        // Default to top 3 most used models
        const allModels = this.aiService.getAvailableModels();
        modelIds = allModels.slice(0, 3).map(m => m.id);
      }

      // Verify all models exist
      const availableModels = this.aiService.getAvailableModels();
      const invalidModels = modelIds.filter(id => 
        !availableModels.find(m => m.id === id)
      );

      if (invalidModels.length > 0) {
        throw ApiError.badRequest(`Invalid models: ${invalidModels.join(', ')}`);
      }

      const comparison = await this.metricsService.compareModelPerformance({
        modelIds,
        timeframe,
        metric
      });

      res.json({
        success: true,
        data: {
          models: modelIds,
          timeframe,
          metric,
          comparison
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getModelRecommendations(req, res) {
    const { 
      useCase = 'general', 
      prioritizeBy = 'quality' 
    } = req.query;
    const userId = this.getUserId(req);

    try {
      const userUsagePatterns = await this.metricsService.getUserUsagePatterns(userId);
      const recommendations = await this.metricsService.getModelRecommendations({
        useCase,
        prioritizeBy,
        userUsagePatterns
      });

      res.json({
        success: true,
        data: {
          useCase,
          prioritizeBy,
          recommendations,
          reasoning: this.generateRecommendationReasoning(recommendations, prioritizeBy)
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  generateRecommendationReasoning(recommendations, prioritizeBy) {
    const topModel = recommendations[0];
    if (!topModel) return 'No recommendations available';

    const reasoningMap = {
      cost: `${topModel.id} is recommended for its cost-effectiveness at $${topModel.avgCostPer1k?.toFixed(4)} per 1k tokens`,
      speed: `${topModel.id} is recommended for its fast response time averaging ${topModel.avgResponseTime}ms`,
      quality: `${topModel.id} is recommended for its high-quality responses and reliability`
    };

    return reasoningMap[prioritizeBy] || `${topModel.id} is recommended based on overall performance`;
  }

  getUserId(req) {
    if (req.auth?.user?.id) {
      return req.auth.user.id;
    }
    
    if (req.auth?.key) {
      return `api_user_${req.auth.key.slice(-8)}`;
    }
    
    throw ApiError.unauthorized('User identification required');
  }
}