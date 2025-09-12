import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { MemoryService } from '../services/MemoryService.js';

export class MemoryController {
  constructor() {
    this.memoryService = new MemoryService();
  }

  async searchMemory(req, res) {
    const { 
      query, 
      filters = {}, 
      limit = 10, 
      includeContext = false 
    } = req.body;
    const userId = this.getUserId(req);

    try {
      const results = await this.memoryService.searchMemories(query, {
        ...filters,
        limit,
        userId,
        includeContext
      });

      res.json({
        success: true,
        data: {
          query,
          results,
          total: results.length,
          filters
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getContext(req, res) {
    const { 
      conversationId, 
      query, 
      depth = 10, 
      includeGlobal = true 
    } = req.query;
    const userId = this.getUserId(req);

    try {
      let context;

      if (conversationId) {
        context = await this.memoryService.getConversationContext(conversationId, {
          depth: parseInt(depth)
        });
      } else if (query) {
        context = await this.memoryService.getRelevantContext(null, query, {
          depth: parseInt(depth),
          includeGlobal: includeGlobal === 'true'
        });
      } else {
        throw ApiError.badRequest('Either conversationId or query is required');
      }

      res.json({
        success: true,
        data: {
          context,
          depth: parseInt(depth),
          conversationId,
          query
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getAnalytics(req, res) {
    const { 
      timeframe = 'month', 
      includeConversations = false,
      groupBy = 'day'
    } = req.query;
    const userId = this.getUserId(req);

    try {
      const analytics = await this.memoryService.getMemoryAnalytics({
        timeframe,
        includeConversations: includeConversations === 'true',
        groupBy,
        userId
      });

      res.json({
        success: true,
        data: {
          analytics,
          timeframe,
          groupBy
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getInsights(req, res) {
    const { 
      type = 'all', 
      timeframe = 'month' 
    } = req.query;
    const userId = this.getUserId(req);

    try {
      const insights = await this.generateInsights(userId, { type, timeframe });

      res.json({
        success: true,
        data: {
          insights,
          type,
          timeframe
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async exportMemory(req, res) {
    const { 
      format = 'json', 
      includeContext = true, 
      timeframe = 'all',
      filters = {}
    } = req.body;
    const userId = this.getUserId(req);

    try {
      const exportData = await this.memoryService.exportMemoryData({
        userId,
        format,
        includeContext,
        timeframe,
        filters
      });

      // Set appropriate headers for download
      const filename = `memory_export_${userId}_${new Date().toISOString().split('T')[0]}.${format}`;
      
      res.set({
        'Content-Type': this.getContentType(format),
        'Content-Disposition': `attachment; filename="${filename}"`
      });

      if (format === 'json') {
        res.json(exportData);
      } else {
        res.send(exportData);
      }
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async clearMemory(req, res) {
    const { 
      timeframe, 
      conversationIds, 
      confirmationToken 
    } = req.body;
    const userId = this.getUserId(req);

    try {
      // Validate confirmation token (simple check - in production use proper tokens)
      const expectedToken = `clear_${userId}_${new Date().toISOString().split('T')[0]}`;
      if (confirmationToken !== expectedToken) {
        throw ApiError.badRequest('Invalid confirmation token');
      }

      const result = await this.memoryService.clearMemoryData({
        userId,
        timeframe,
        conversationIds
      });

      logger.info('Memory cleared', {
        userId,
        timeframe,
        conversationIds,
        itemsRemoved: result.itemsRemoved
      });

      res.json({
        success: true,
        data: result,
        message: 'Memory cleared successfully',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getMemoryStats(req, res) {
    const userId = this.getUserId(req);

    try {
      const stats = await this.memoryService.getMemoryStatistics(userId);

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async optimizeMemory(req, res) {
    const { 
      mode = 'cleanup', 
      daysToKeep = 90, 
      maxInteractions = 5000 
    } = req.body;
    const userId = this.getUserId(req);

    try {
      let result;

      switch (mode) {
        case 'cleanup':
          result = await this.memoryService.cleanupMemory({
            userId,
            daysToKeep,
            maxInteractions
          });
          break;
        case 'reorganize':
          result = await this.memoryService.reorganizeMemory(userId);
          break;
        case 'full':
          const cleanupResult = await this.memoryService.cleanupMemory({
            userId,
            daysToKeep,
            maxInteractions
          });
          const reorganizeResult = await this.memoryService.reorganizeMemory(userId);
          result = {
            cleanup: cleanupResult,
            reorganize: reorganizeResult
          };
          break;
        default:
          throw ApiError.badRequest(`Invalid optimization mode: ${mode}`);
      }

      logger.info('Memory optimized', {
        userId,
        mode,
        result
      });

      res.json({
        success: true,
        data: {
          mode,
          result
        },
        message: 'Memory optimization completed',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  // Helper methods
  async generateInsights(userId, options) {
    const { type, timeframe } = options;

    try {
      const insights = {};

      if (type === 'topics' || type === 'all') {
        insights.topics = await this.generateTopicInsights(userId, timeframe);
      }

      if (type === 'patterns' || type === 'all') {
        insights.patterns = await this.generatePatternInsights(userId, timeframe);
      }

      if (type === 'summary' || type === 'all') {
        insights.summary = await this.generateSummaryInsights(userId, timeframe);
      }

      return insights;
    } catch (error) {
      logger.error('Failed to generate insights', { userId, type, timeframe, error: error.message });
      throw error;
    }
  }

  async generateTopicInsights(userId, timeframe) {
    // This is a simplified topic analysis
    // In production, use proper NLP libraries for topic modeling
    const analytics = await this.memoryService.getMemoryAnalytics({ timeframe, userId });
    
    // Extract common keywords and topics
    const topicFrequency = {};
    
    // This would analyze conversation content for topics
    // For now, return mock data
    return {
      mostDiscussedTopics: [
        { topic: 'programming', frequency: 45, trend: 'increasing' },
        { topic: 'AI and technology', frequency: 38, trend: 'stable' },
        { topic: 'productivity', frequency: 22, trend: 'decreasing' }
      ],
      emergingTopics: [
        { topic: 'machine learning', frequency: 15, growth: '200%' }
      ],
      timeframe
    };
  }

  async generatePatternInsights(userId, timeframe) {
    const analytics = await this.memoryService.getMemoryAnalytics({ timeframe, userId });
    
    return {
      conversationPatterns: {
        averageLength: analytics.totalInteractions / Object.keys(analytics.conversationStats || {}).length || 0,
        peakUsageHours: ['14:00', '15:00', '16:00'], // Would analyze actual timestamps
        preferredModels: Object.entries(analytics.modelUsage || {})
          .sort(([,a], [,b]) => b.count - a.count)
          .slice(0, 3)
          .map(([model]) => model)
      },
      usagePatterns: {
        totalInteractions: analytics.totalInteractions,
        averageDaily: analytics.totalInteractions / this.getTimeframeDays(timeframe),
        costTrend: analytics.totalCost > 0 ? 'tracked' : 'unknown'
      },
      timeframe
    };
  }

  async generateSummaryInsights(userId, timeframe) {
    const analytics = await this.memoryService.getMemoryAnalytics({ timeframe, userId });
    
    return {
      overview: {
        totalInteractions: analytics.totalInteractions,
        totalCost: analytics.totalCost,
        activeConversations: Object.keys(analytics.conversationStats || {}).length,
        timeframe
      },
      highlights: [
        `You've had ${analytics.totalInteractions} AI interactions in the past ${timeframe}`,
        `Your most used model was ${Object.keys(analytics.modelUsage || {})[0] || 'unknown'}`,
        `Total cost: $${analytics.totalCost?.toFixed(2) || '0.00'}`
      ],
      recommendations: this.generateRecommendations(analytics)
    };
  }

  generateRecommendations(analytics) {
    const recommendations = [];
    
    if (analytics.totalCost > 50) {
      recommendations.push('Consider using more cost-effective models for simpler queries');
    }
    
    if (analytics.totalInteractions > 100) {
      recommendations.push('Your usage patterns suggest you might benefit from conversation templates');
    }
    
    return recommendations;
  }

  getContentType(format) {
    switch (format) {
      case 'json': return 'application/json';
      case 'csv': return 'text/csv';
      case 'txt': return 'text/plain';
      default: return 'application/octet-stream';
    }
  }

  getTimeframeDays(timeframe) {
    switch (timeframe) {
      case 'week': return 7;
      case 'month': return 30;
      case 'year': return 365;
      default: return 30;
    }
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