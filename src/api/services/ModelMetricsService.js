import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ModelMetricsService {
  constructor() {
    this.dataDir = path.join(__dirname, '../../../data/metrics');
    this.modelsDir = path.join(this.dataDir, 'models');
    this.usageDir = path.join(this.dataDir, 'usage');
    this.ensureDirectories();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.dataDir);
    await fs.ensureDir(this.modelsDir);
    await fs.ensureDir(this.usageDir);
  }

  async recordModelUsage(modelId, usage) {
    try {
      const {
        userId,
        requestId,
        promptTokens = 0,
        completionTokens = 0,
        totalTokens = 0,
        cost = 0,
        responseTime = 0,
        success = true,
        errorType = null
      } = usage;

      const timestamp = new Date().toISOString();
      const date = timestamp.split('T')[0];

      // Record to daily metrics file
      await this.recordDailyMetrics(modelId, date, {
        requestId,
        userId,
        promptTokens,
        completionTokens,
        totalTokens,
        cost,
        responseTime,
        success,
        errorType,
        timestamp
      });

      // Update aggregated metrics
      await this.updateAggregatedMetrics(modelId, {
        promptTokens,
        completionTokens,
        totalTokens,
        cost,
        responseTime,
        success,
        errorType
      });

      // Record user-specific usage
      await this.recordUserUsage(userId, modelId, {
        promptTokens,
        completionTokens,
        totalTokens,
        cost,
        responseTime,
        success,
        timestamp
      });

    } catch (error) {
      logger.error('Failed to record model usage', {
        modelId,
        error: error.message
      });
    }
  }

  async recordDailyMetrics(modelId, date, usage) {
    const filePath = path.join(this.modelsDir, modelId, `${date}.json`);
    await fs.ensureDir(path.dirname(filePath));

    let dailyData = { date, requests: [] };
    if (await fs.pathExists(filePath)) {
      dailyData = await fs.readJson(filePath);
    }

    dailyData.requests.push(usage);
    await fs.writeJson(filePath, dailyData, { spaces: 2 });
  }

  async updateAggregatedMetrics(modelId, usage) {
    const filePath = path.join(this.modelsDir, modelId, 'aggregated.json');
    await fs.ensureDir(path.dirname(filePath));

    let aggregated = {
      modelId,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      successRate: 0,
      errors: {},
      firstRequest: null,
      lastRequest: new Date().toISOString()
    };

    if (await fs.pathExists(filePath)) {
      aggregated = await fs.readJson(filePath);
    }

    // Update counters
    aggregated.totalRequests++;
    aggregated.totalTokens += usage.totalTokens;
    aggregated.totalCost += usage.cost;
    aggregated.totalResponseTime += usage.responseTime;

    if (usage.success) {
      aggregated.successfulRequests++;
    } else {
      aggregated.failedRequests++;
      if (usage.errorType) {
        aggregated.errors[usage.errorType] = (aggregated.errors[usage.errorType] || 0) + 1;
      }
    }

    // Calculate averages
    aggregated.averageResponseTime = aggregated.totalResponseTime / aggregated.totalRequests;
    aggregated.successRate = (aggregated.successfulRequests / aggregated.totalRequests) * 100;

    // Set first request time if not set
    if (!aggregated.firstRequest) {
      aggregated.firstRequest = new Date().toISOString();
    }

    aggregated.lastRequest = new Date().toISOString();

    await fs.writeJson(filePath, aggregated, { spaces: 2 });
  }

  async recordUserUsage(userId, modelId, usage) {
    const filePath = path.join(this.usageDir, userId, `${modelId}.json`);
    await fs.ensureDir(path.dirname(filePath));

    let userUsage = {
      userId,
      modelId,
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      firstUsage: null,
      lastUsage: null,
      dailyUsage: {}
    };

    if (await fs.pathExists(filePath)) {
      userUsage = await fs.readJson(filePath);
    }

    const date = usage.timestamp.split('T')[0];

    // Update totals
    userUsage.totalRequests++;
    userUsage.totalTokens += usage.totalTokens;
    userUsage.totalCost += usage.cost;

    // Update daily usage
    if (!userUsage.dailyUsage[date]) {
      userUsage.dailyUsage[date] = {
        requests: 0,
        tokens: 0,
        cost: 0
      };
    }
    userUsage.dailyUsage[date].requests++;
    userUsage.dailyUsage[date].tokens += usage.totalTokens;
    userUsage.dailyUsage[date].cost += usage.cost;

    // Set timestamps
    if (!userUsage.firstUsage) {
      userUsage.firstUsage = usage.timestamp;
    }
    userUsage.lastUsage = usage.timestamp;

    await fs.writeJson(filePath, userUsage, { spaces: 2 });
  }

  async getRecentMetrics(modelId, hours = 24) {
    try {
      const aggregatedPath = path.join(this.modelsDir, modelId, 'aggregated.json');
      
      if (!(await fs.pathExists(aggregatedPath))) {
        return {
          averageResponseTime: 0,
          successRate: 0,
          requestsLast24h: 0
        };
      }

      const aggregated = await fs.readJson(aggregatedPath);
      
      // Get recent requests count
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      let recentRequests = 0;

      // Count requests in recent daily files
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      for (const date of [today, yesterday]) {
        const dailyPath = path.join(this.modelsDir, modelId, `${date}.json`);
        if (await fs.pathExists(dailyPath)) {
          const dailyData = await fs.readJson(dailyPath);
          recentRequests += dailyData.requests.filter(req => 
            new Date(req.timestamp) > cutoffTime
          ).length;
        }
      }

      return {
        averageResponseTime: Math.round(aggregated.averageResponseTime || 0),
        successRate: Math.round(aggregated.successRate || 0),
        requestsLast24h: recentRequests
      };
    } catch (error) {
      logger.error('Failed to get recent metrics', { modelId, error: error.message });
      return {
        averageResponseTime: 0,
        successRate: 0,
        requestsLast24h: 0
      };
    }
  }

  async getDetailedMetrics(modelId, timeframe = 'week') {
    try {
      const aggregatedPath = path.join(this.modelsDir, modelId, 'aggregated.json');
      
      if (!(await fs.pathExists(aggregatedPath))) {
        return null;
      }

      const aggregated = await fs.readJson(aggregatedPath);
      const timeframeDays = this.getTimeframeDays(timeframe);
      
      // Get detailed stats for timeframe
      const dailyStats = await this.getDailyStats(modelId, timeframeDays);
      
      return {
        ...aggregated,
        timeframe,
        dailyStats,
        trends: this.calculateTrends(dailyStats)
      };
    } catch (error) {
      logger.error('Failed to get detailed metrics', { modelId, error: error.message });
      return null;
    }
  }

  async getUsageHistory(modelId, timeframe = 'week') {
    try {
      const timeframeDays = this.getTimeframeDays(timeframe);
      return await this.getDailyStats(modelId, timeframeDays);
    } catch (error) {
      logger.error('Failed to get usage history', { modelId, error: error.message });
      return [];
    }
  }

  async getMetrics(modelId, timeframe = 'day') {
    try {
      const timeframeDays = this.getTimeframeDays(timeframe);
      const dailyStats = await this.getDailyStats(modelId, timeframeDays);
      
      // Aggregate metrics for timeframe
      const totalRequests = dailyStats.reduce((sum, day) => sum + day.requests, 0);
      const totalTokens = dailyStats.reduce((sum, day) => sum + day.tokens, 0);
      const totalCost = dailyStats.reduce((sum, day) => sum + day.cost, 0);
      const totalResponseTime = dailyStats.reduce((sum, day) => sum + day.totalResponseTime, 0);
      const successfulRequests = dailyStats.reduce((sum, day) => sum + day.successfulRequests, 0);

      return {
        timeframe,
        totalRequests,
        totalTokens,
        totalCost,
        averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
        successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
        averageCostPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0,
        averageTokensPerRequest: totalRequests > 0 ? totalTokens / totalRequests : 0,
        dailyBreakdown: dailyStats
      };
    } catch (error) {
      logger.error('Failed to get metrics', { modelId, error: error.message });
      throw error;
    }
  }

  async getUserModelUsage(userId, modelId, timeframe = 'day') {
    try {
      const filePath = path.join(this.usageDir, userId, `${modelId}.json`);
      
      if (!(await fs.pathExists(filePath))) {
        return {
          totalRequests: 0,
          totalTokens: 0,
          totalCost: 0,
          dailyUsage: {}
        };
      }

      const userUsage = await fs.readJson(filePath);
      const timeframeDays = this.getTimeframeDays(timeframe);
      
      // Filter daily usage by timeframe
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);
      const cutoffString = cutoffDate.toISOString().split('T')[0];
      
      const filteredDailyUsage = {};
      Object.entries(userUsage.dailyUsage || {}).forEach(([date, usage]) => {
        if (date >= cutoffString) {
          filteredDailyUsage[date] = usage;
        }
      });

      // Calculate totals for timeframe
      const timeframeRequests = Object.values(filteredDailyUsage).reduce((sum, day) => sum + day.requests, 0);
      const timeframeTokens = Object.values(filteredDailyUsage).reduce((sum, day) => sum + day.tokens, 0);
      const timeframeCost = Object.values(filteredDailyUsage).reduce((sum, day) => sum + day.cost, 0);

      return {
        ...userUsage,
        timeframe,
        timeframeRequests,
        timeframeTokens,
        timeframeCost,
        dailyUsage: filteredDailyUsage
      };
    } catch (error) {
      logger.error('Failed to get user model usage', { userId, modelId, error: error.message });
      throw error;
    }
  }

  async getCostAnalytics(options) {
    const { userId, timeframe = 'month', groupBy = 'model' } = options;

    try {
      if (groupBy === 'model') {
        return await this.getCostAnalyticsByModel(userId, timeframe);
      } else if (groupBy === 'day') {
        return await this.getCostAnalyticsByDay(userId, timeframe);
      } else if (groupBy === 'user') {
        return await this.getCostAnalyticsByUser(timeframe);
      }
    } catch (error) {
      logger.error('Failed to get cost analytics', { userId, timeframe, groupBy, error: error.message });
      throw error;
    }
  }

  async getCostAnalyticsByModel(userId, timeframe) {
    const userDir = path.join(this.usageDir, userId);
    
    if (!(await fs.pathExists(userDir))) {
      return { models: [], totalCost: 0 };
    }

    const files = await fs.readdir(userDir);
    const modelCosts = [];
    let totalCost = 0;

    for (const file of files) {
      if (file.endsWith('.json')) {
        const modelId = file.replace('.json', '');
        const usage = await this.getUserModelUsage(userId, modelId, timeframe);
        
        modelCosts.push({
          modelId,
          cost: usage.timeframeCost || 0,
          requests: usage.timeframeRequests || 0,
          tokens: usage.timeframeTokens || 0
        });
        
        totalCost += usage.timeframeCost || 0;
      }
    }

    return {
      models: modelCosts.sort((a, b) => b.cost - a.cost),
      totalCost,
      timeframe
    };
  }

  async compareModelPerformance(options) {
    const { modelIds, timeframe = 'week', metric = 'response_time' } = options;

    try {
      const comparisons = [];

      for (const modelId of modelIds) {
        const metrics = await this.getMetrics(modelId, timeframe);
        comparisons.push({
          modelId,
          metrics: {
            averageResponseTime: metrics.averageResponseTime,
            successRate: metrics.successRate,
            totalRequests: metrics.totalRequests,
            averageCostPerRequest: metrics.averageCostPerRequest,
            tokensPerSecond: metrics.totalRequests > 0 ? metrics.totalTokens / (metrics.totalRequests * metrics.averageResponseTime / 1000) : 0
          }
        });
      }

      return {
        models: comparisons,
        bestPerformer: this.findBestPerformer(comparisons, metric),
        summary: this.generatePerformanceSummary(comparisons, metric)
      };
    } catch (error) {
      logger.error('Failed to compare model performance', { modelIds, error: error.message });
      throw error;
    }
  }

  async getModelRecommendations(options) {
    const { useCase = 'general', prioritizeBy = 'quality', userUsagePatterns } = options;

    // This is a simplified recommendation engine
    // In production, this would use ML models and more sophisticated analysis
    
    try {
      const modelScores = [];
      
      // Define model characteristics (this would come from actual data analysis)
      const modelCharacteristics = {
        'gpt-4': { quality: 0.95, speed: 0.6, cost: 0.3 },
        'gpt-4-turbo': { quality: 0.9, speed: 0.8, cost: 0.4 },
        'gpt-3.5-turbo': { quality: 0.75, speed: 0.9, cost: 0.9 },
        'claude-3-opus': { quality: 0.97, speed: 0.5, cost: 0.2 },
        'claude-3-sonnet': { quality: 0.85, speed: 0.75, cost: 0.6 },
        'claude-3-haiku': { quality: 0.7, speed: 0.95, cost: 0.95 }
      };

      Object.entries(modelCharacteristics).forEach(([modelId, characteristics]) => {
        let score = 0;
        
        // Weight based on priority
        switch (prioritizeBy) {
          case 'cost':
            score = characteristics.cost * 0.6 + characteristics.quality * 0.3 + characteristics.speed * 0.1;
            break;
          case 'speed':
            score = characteristics.speed * 0.6 + characteristics.quality * 0.3 + characteristics.cost * 0.1;
            break;
          case 'quality':
          default:
            score = characteristics.quality * 0.6 + characteristics.speed * 0.3 + characteristics.cost * 0.1;
            break;
        }

        // Adjust based on use case
        if (useCase === 'coding') {
          score += characteristics.quality * 0.1; // Coding benefits from higher quality
        } else if (useCase === 'creative') {
          score += characteristics.quality * 0.1; // Creative work benefits from quality
        } else if (useCase === 'conversation') {
          score += characteristics.speed * 0.1; // Conversation benefits from speed
        }

        modelScores.push({
          modelId,
          score,
          characteristics
        });
      });

      return modelScores
        .sort((a, b) => b.score - a.score)
        .slice(0, 3) // Top 3 recommendations
        .map(item => ({
          id: item.modelId,
          score: Math.round(item.score * 100),
          ...item.characteristics
        }));
    } catch (error) {
      logger.error('Failed to get model recommendations', { useCase, prioritizeBy, error: error.message });
      throw error;
    }
  }

  async getUserUsagePatterns(userId) {
    try {
      const userDir = path.join(this.usageDir, userId);
      
      if (!(await fs.pathExists(userDir))) {
        return { models: [], totalUsage: 0 };
      }

      const files = await fs.readdir(userDir);
      const patterns = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const modelId = file.replace('.json', '');
          const usage = await fs.readJson(path.join(userDir, file));
          patterns.push({
            modelId,
            totalRequests: usage.totalRequests,
            totalCost: usage.totalCost,
            firstUsage: usage.firstUsage,
            lastUsage: usage.lastUsage
          });
        }
      }

      return {
        models: patterns.sort((a, b) => b.totalRequests - a.totalRequests),
        totalUsage: patterns.reduce((sum, p) => sum + p.totalRequests, 0)
      };
    } catch (error) {
      logger.error('Failed to get user usage patterns', { userId, error: error.message });
      return { models: [], totalUsage: 0 };
    }
  }

  // Helper methods
  getTimeframeDays(timeframe) {
    switch (timeframe) {
      case 'hour': return 1;
      case 'day': return 1;
      case 'week': return 7;
      case 'month': return 30;
      case 'year': return 365;
      default: return 7;
    }
  }

  async getDailyStats(modelId, days) {
    const stats = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      const dailyPath = path.join(this.modelsDir, modelId, `${dateString}.json`);
      
      if (await fs.pathExists(dailyPath)) {
        const dailyData = await fs.readJson(dailyPath);
        const requests = dailyData.requests || [];
        
        const dayStats = {
          date: dateString,
          requests: requests.length,
          successfulRequests: requests.filter(r => r.success).length,
          tokens: requests.reduce((sum, r) => sum + (r.totalTokens || 0), 0),
          cost: requests.reduce((sum, r) => sum + (r.cost || 0), 0),
          totalResponseTime: requests.reduce((sum, r) => sum + (r.responseTime || 0), 0)
        };
        
        stats.push(dayStats);
      } else {
        stats.push({
          date: dateString,
          requests: 0,
          successfulRequests: 0,
          tokens: 0,
          cost: 0,
          totalResponseTime: 0
        });
      }
    }

    return stats.reverse(); // Return in chronological order
  }

  calculateTrends(dailyStats) {
    if (dailyStats.length < 2) return {};

    const recent = dailyStats.slice(-3); // Last 3 days
    const previous = dailyStats.slice(-6, -3); // Previous 3 days

    const recentAvg = {
      requests: recent.reduce((sum, day) => sum + day.requests, 0) / recent.length,
      cost: recent.reduce((sum, day) => sum + day.cost, 0) / recent.length
    };

    const previousAvg = {
      requests: previous.reduce((sum, day) => sum + day.requests, 0) / previous.length,
      cost: previous.reduce((sum, day) => sum + day.cost, 0) / previous.length
    };

    return {
      requestsTrend: previousAvg.requests > 0 ? ((recentAvg.requests - previousAvg.requests) / previousAvg.requests) * 100 : 0,
      costTrend: previousAvg.cost > 0 ? ((recentAvg.cost - previousAvg.cost) / previousAvg.cost) * 100 : 0
    };
  }

  findBestPerformer(comparisons, metric) {
    if (comparisons.length === 0) return null;

    switch (metric) {
      case 'response_time':
        return comparisons.reduce((best, current) => 
          current.metrics.averageResponseTime < best.metrics.averageResponseTime ? current : best
        );
      case 'cost_efficiency':
        return comparisons.reduce((best, current) => 
          current.metrics.averageCostPerRequest < best.metrics.averageCostPerRequest ? current : best
        );
      case 'tokens_per_second':
      default:
        return comparisons.reduce((best, current) => 
          current.metrics.tokensPerSecond > best.metrics.tokensPerSecond ? current : best
        );
    }
  }

  generatePerformanceSummary(comparisons, metric) {
    const metricValues = comparisons.map(c => {
      switch (metric) {
        case 'response_time': return c.metrics.averageResponseTime;
        case 'cost_efficiency': return c.metrics.averageCostPerRequest;
        case 'tokens_per_second': return c.metrics.tokensPerSecond;
        default: return 0;
      }
    });

    const avg = metricValues.reduce((sum, val) => sum + val, 0) / metricValues.length;
    const min = Math.min(...metricValues);
    const max = Math.max(...metricValues);

    return { average: avg, minimum: min, maximum: max, range: max - min };
  }
}