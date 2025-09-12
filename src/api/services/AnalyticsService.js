import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AnalyticsService extends EventEmitter {
  constructor() {
    super();
    this.dataDir = path.join(__dirname, '../../../data/analytics');
    this.metricsDir = path.join(this.dataDir, 'metrics');
    this.reportsDir = path.join(this.dataDir, 'reports');
    this.eventsDir = path.join(this.dataDir, 'events');
    
    // In-memory metrics for real-time processing
    this.realtimeMetrics = new Map();
    this.eventBuffer = [];
    this.aggregatedData = new Map();
    this.alertRules = new Map();
    this.dashboards = new Map();
    
    // Performance tracking
    this.performanceMetrics = {
      apiRequests: new Map(),
      responseTime: new Map(),
      errorRates: new Map(),
      throughput: new Map(),
      resourceUsage: new Map()
    };

    // User analytics
    this.userMetrics = {
      sessions: new Map(),
      behavior: new Map(),
      engagement: new Map(),
      retention: new Map()
    };

    // Business metrics
    this.businessMetrics = {
      usage: new Map(),
      costs: new Map(),
      revenue: new Map(),
      growth: new Map()
    };

    this.ensureDirectories();
    this.setupEventProcessing();
    this.setupMetricAggregation();
    this.setupAlertSystem();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.dataDir);
    await fs.ensureDir(this.metricsDir);
    await fs.ensureDir(this.reportsDir);
    await fs.ensureDir(this.eventsDir);
  }

  /**
   * Track API request metrics
   */
  trackApiRequest(requestData) {
    const {
      method,
      endpoint,
      statusCode,
      responseTime,
      userId,
      userAgent,
      ipAddress,
      requestSize,
      responseSize,
      timestamp = new Date()
    } = requestData;

    try {
      const event = {
        type: 'api_request',
        timestamp,
        data: {
          method,
          endpoint,
          statusCode,
          responseTime,
          userId,
          userAgent,
          ipAddress,
          requestSize,
          responseSize
        }
      };

      this.recordEvent(event);

      // Update real-time metrics
      this.updateApiMetrics(event.data);

      // Check for performance alerts
      this.checkPerformanceAlerts(event.data);

    } catch (error) {
      logger.error('Failed to track API request', {
        endpoint,
        error: error.message
      });
    }
  }

  /**
   * Track AI model usage and performance
   */
  trackModelUsage(usageData) {
    const {
      model,
      provider,
      tokensUsed,
      cost,
      responseTime,
      userId,
      conversationId,
      inputTokens,
      outputTokens,
      timestamp = new Date()
    } = usageData;

    try {
      const event = {
        type: 'model_usage',
        timestamp,
        data: {
          model,
          provider,
          tokensUsed,
          cost,
          responseTime,
          userId,
          conversationId,
          inputTokens,
          outputTokens
        }
      };

      this.recordEvent(event);

      // Update model metrics
      this.updateModelMetrics(event.data);

      // Track cost metrics
      this.updateCostMetrics(event.data);

    } catch (error) {
      logger.error('Failed to track model usage', {
        model,
        error: error.message
      });
    }
  }

  /**
   * Track user behavior and engagement
   */
  trackUserBehavior(behaviorData) {
    const {
      userId,
      action,
      feature,
      duration,
      metadata = {},
      sessionId,
      timestamp = new Date()
    } = behaviorData;

    try {
      const event = {
        type: 'user_behavior',
        timestamp,
        data: {
          userId,
          action,
          feature,
          duration,
          metadata,
          sessionId
        }
      };

      this.recordEvent(event);

      // Update user metrics
      this.updateUserMetrics(event.data);

      // Update engagement metrics
      this.updateEngagementMetrics(event.data);

    } catch (error) {
      logger.error('Failed to track user behavior', {
        userId,
        action,
        error: error.message
      });
    }
  }

  /**
   * Track system performance metrics
   */
  trackSystemMetrics(systemData) {
    const {
      cpuUsage,
      memoryUsage,
      diskUsage,
      networkIO,
      activeConnections,
      queueLength,
      cacheHitRate,
      timestamp = new Date()
    } = systemData;

    try {
      const event = {
        type: 'system_metrics',
        timestamp,
        data: {
          cpuUsage,
          memoryUsage,
          diskUsage,
          networkIO,
          activeConnections,
          queueLength,
          cacheHitRate
        }
      };

      this.recordEvent(event);

      // Update system performance metrics
      this.updateSystemMetrics(event.data);

      // Check for system alerts
      this.checkSystemAlerts(event.data);

    } catch (error) {
      logger.error('Failed to track system metrics', {
        error: error.message
      });
    }
  }

  /**
   * Track business metrics
   */
  trackBusinessMetrics(businessData) {
    const {
      metric,
      value,
      userId,
      tenantId,
      category,
      metadata = {},
      timestamp = new Date()
    } = businessData;

    try {
      const event = {
        type: 'business_metrics',
        timestamp,
        data: {
          metric,
          value,
          userId,
          tenantId,
          category,
          metadata
        }
      };

      this.recordEvent(event);

      // Update business metrics
      this.updateBusinessMetrics(event.data);

    } catch (error) {
      logger.error('Failed to track business metrics', {
        metric,
        error: error.message
      });
    }
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateReport(options = {}) {
    const {
      type = 'comprehensive',
      timeframe = 'week',
      filters = {},
      includeComparisons = true,
      includeForecasts = false,
      format = 'json'
    } = options;

    try {
      const reportId = this.generateReportId();
      const startTime = Date.now();

      // Define time ranges
      const timeRanges = this.calculateTimeRanges(timeframe);

      const report = {
        id: reportId,
        type,
        timeframe,
        generatedAt: new Date(),
        timeRanges,
        data: {}
      };

      // Generate different report sections based on type
      switch (type) {
        case 'comprehensive':
          report.data = await this.generateComprehensiveReport(timeRanges, filters);
          break;
        case 'performance':
          report.data = await this.generatePerformanceReport(timeRanges, filters);
          break;
        case 'usage':
          report.data = await this.generateUsageReport(timeRanges, filters);
          break;
        case 'business':
          report.data = await this.generateBusinessReport(timeRanges, filters);
          break;
        case 'user_analytics':
          report.data = await this.generateUserAnalyticsReport(timeRanges, filters);
          break;
        default:
          throw new Error(`Unknown report type: ${type}`);
      }

      // Add comparisons if requested
      if (includeComparisons) {
        report.comparisons = await this.generateComparisons(report.data, timeRanges);
      }

      // Add forecasts if requested
      if (includeForecasts) {
        report.forecasts = await this.generateForecasts(report.data, timeRanges);
      }

      // Calculate processing time
      report.processingTime = Date.now() - startTime;

      // Save report
      await this.saveReport(report, format);

      logger.info('Analytics report generated', {
        reportId,
        type,
        timeframe,
        processingTime: report.processingTime,
        dataPoints: this.countDataPoints(report.data)
      });

      return report;

    } catch (error) {
      logger.error('Failed to generate analytics report', {
        type,
        timeframe,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get real-time metrics dashboard data
   */
  async getDashboardData(dashboardId = 'default') {
    try {
      const dashboard = this.dashboards.get(dashboardId) || this.createDefaultDashboard();

      const data = {
        id: dashboardId,
        lastUpdated: new Date(),
        widgets: {}
      };

      // Process each widget
      for (const [widgetId, widget] of Object.entries(dashboard.widgets)) {
        data.widgets[widgetId] = await this.processWidget(widget);
      }

      return data;

    } catch (error) {
      logger.error('Failed to get dashboard data', {
        dashboardId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create custom analytics alert
   */
  async createAlert(alertConfig) {
    const {
      name,
      description,
      metric,
      condition,
      threshold,
      timeWindow = '5m',
      severity = 'medium',
      channels = ['email'],
      enabled = true,
      userId
    } = alertConfig;

    try {
      const alertId = this.generateAlertId();
      
      const alert = {
        id: alertId,
        name,
        description,
        metric,
        condition, // 'gt', 'lt', 'eq', 'gte', 'lte'
        threshold,
        timeWindow,
        severity,
        channels,
        enabled,
        createdBy: userId,
        createdAt: new Date(),
        lastTriggered: null,
        triggerCount: 0
      };

      this.alertRules.set(alertId, alert);

      logger.info('Analytics alert created', {
        alertId,
        name,
        metric,
        condition,
        threshold,
        userId
      });

      return { alertId, status: 'created' };

    } catch (error) {
      logger.error('Failed to create alert', {
        name,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get analytics insights using AI
   */
  async generateInsights(options = {}) {
    const {
      timeframe = 'week',
      focus = 'all', // 'performance', 'usage', 'business', 'anomalies'
      includeRecommendations = true
    } = options;

    try {
      const data = await this.getAnalyticsData(timeframe);
      const insights = {
        timeframe,
        generatedAt: new Date(),
        insights: [],
        anomalies: [],
        recommendations: []
      };

      // Detect trends and patterns
      insights.insights = await this.detectInsights(data, focus);

      // Detect anomalies
      insights.anomalies = await this.detectAnomalies(data);

      // Generate recommendations
      if (includeRecommendations) {
        insights.recommendations = await this.generateRecommendations(data, insights);
      }

      return insights;

    } catch (error) {
      logger.error('Failed to generate insights', {
        timeframe,
        focus,
        error: error.message
      });
      throw error;
    }
  }

  // Helper methods for metrics updates

  updateApiMetrics(data) {
    const { endpoint, statusCode, responseTime } = data;
    
    // Update request count
    const requestKey = `requests:${endpoint}`;
    this.incrementMetric(requestKey, 1);

    // Update response time
    const responseTimeKey = `response_time:${endpoint}`;
    this.updateAverageMetric(responseTimeKey, responseTime);

    // Update error rate
    if (statusCode >= 400) {
      const errorKey = `errors:${endpoint}`;
      this.incrementMetric(errorKey, 1);
    }

    // Update status code distribution
    const statusKey = `status:${statusCode}`;
    this.incrementMetric(statusKey, 1);
  }

  updateModelMetrics(data) {
    const { model, provider, tokensUsed, cost, responseTime } = data;

    // Update model usage
    const usageKey = `model_usage:${model}`;
    this.incrementMetric(usageKey, 1);

    // Update token consumption
    const tokenKey = `tokens:${model}`;
    this.incrementMetric(tokenKey, tokensUsed);

    // Update cost
    const costKey = `cost:${model}`;
    this.incrementMetric(costKey, cost);

    // Update response time
    const timeKey = `model_response_time:${model}`;
    this.updateAverageMetric(timeKey, responseTime);

    // Update provider metrics
    const providerKey = `provider_usage:${provider}`;
    this.incrementMetric(providerKey, 1);
  }

  updateUserMetrics(data) {
    const { userId, action, feature, duration, sessionId } = data;

    // Update user activity
    const activityKey = `user_activity:${userId}`;
    this.incrementMetric(activityKey, 1);

    // Update feature usage
    const featureKey = `feature_usage:${feature}`;
    this.incrementMetric(featureKey, 1);

    // Update session data
    if (sessionId) {
      this.updateSessionMetrics(userId, sessionId, data);
    }

    // Update action metrics
    const actionKey = `actions:${action}`;
    this.incrementMetric(actionKey, 1);
  }

  updateEngagementMetrics(data) {
    const { userId, duration, feature, action } = data;

    // Update time spent
    const timeKey = `time_spent:${userId}`;
    this.incrementMetric(timeKey, duration || 0);

    // Update feature engagement
    const engagementKey = `engagement:${feature}`;
    this.incrementMetric(engagementKey, 1);

    // Track user retention data
    this.updateRetentionMetrics(userId);
  }

  updateSystemMetrics(data) {
    const { cpuUsage, memoryUsage, diskUsage, activeConnections } = data;

    // Update system metrics
    this.updateGaugeMetric('system:cpu_usage', cpuUsage);
    this.updateGaugeMetric('system:memory_usage', memoryUsage);
    this.updateGaugeMetric('system:disk_usage', diskUsage);
    this.updateGaugeMetric('system:active_connections', activeConnections);
  }

  updateCostMetrics(data) {
    const { model, cost, tokensUsed } = data;

    // Update total cost
    this.incrementMetric('total_cost', cost);

    // Update cost per model
    const modelCostKey = `model_cost:${model}`;
    this.incrementMetric(modelCostKey, cost);

    // Calculate cost per token
    if (tokensUsed > 0) {
      const costPerToken = cost / tokensUsed;
      const costPerTokenKey = `cost_per_token:${model}`;
      this.updateAverageMetric(costPerTokenKey, costPerToken);
    }
  }

  updateBusinessMetrics(data) {
    const { metric, value, category, tenantId } = data;

    // Update business metric
    const businessKey = `business:${metric}`;
    this.incrementMetric(businessKey, value);

    // Update by category
    if (category) {
      const categoryKey = `business_category:${category}`;
      this.incrementMetric(categoryKey, value);
    }

    // Update by tenant
    if (tenantId) {
      const tenantKey = `business_tenant:${tenantId}`;
      this.incrementMetric(tenantKey, value);
    }
  }

  // Metric helper methods

  incrementMetric(key, value = 1) {
    const current = this.realtimeMetrics.get(key) || { count: 0, total: 0 };
    current.count += 1;
    current.total += value;
    current.lastUpdated = new Date();
    this.realtimeMetrics.set(key, current);
  }

  updateAverageMetric(key, value) {
    const current = this.realtimeMetrics.get(key) || { count: 0, total: 0, average: 0 };
    current.count += 1;
    current.total += value;
    current.average = current.total / current.count;
    current.lastUpdated = new Date();
    this.realtimeMetrics.set(key, current);
  }

  updateGaugeMetric(key, value) {
    this.realtimeMetrics.set(key, {
      value,
      lastUpdated: new Date()
    });
  }

  // Event processing

  recordEvent(event) {
    // Add to event buffer
    this.eventBuffer.push(event);

    // Emit event for real-time processing
    this.emit('analytics:event', event);

    // Flush buffer if it gets too large
    if (this.eventBuffer.length >= 1000) {
      this.flushEventBuffer();
    }
  }

  setupEventProcessing() {
    // Process events every 30 seconds
    setInterval(() => {
      this.flushEventBuffer();
    }, 30000);

    // Process aggregations every 5 minutes
    setInterval(() => {
      this.processAggregations();
    }, 5 * 60 * 1000);
  }

  async flushEventBuffer() {
    if (this.eventBuffer.length === 0) return;

    try {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];

      // Save events to disk
      await this.saveEvents(events);

      // Process events for aggregations
      this.processEventsForAggregation(events);

    } catch (error) {
      logger.error('Failed to flush event buffer', {
        eventCount: this.eventBuffer.length,
        error: error.message
      });
    }
  }

  async saveEvents(events) {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const eventsFile = path.join(this.eventsDir, `events-${timestamp}.json`);

    let existingEvents = [];
    if (await fs.pathExists(eventsFile)) {
      existingEvents = await fs.readJson(eventsFile);
    }

    existingEvents.push(...events);

    await fs.writeJson(eventsFile, existingEvents);
  }

  // Report generation methods

  async generateComprehensiveReport(timeRanges, filters) {
    return {
      summary: await this.generateSummaryData(timeRanges, filters),
      performance: await this.generatePerformanceData(timeRanges, filters),
      usage: await this.generateUsageData(timeRanges, filters),
      users: await this.generateUserData(timeRanges, filters),
      business: await this.generateBusinessData(timeRanges, filters),
      trends: await this.generateTrendData(timeRanges, filters)
    };
  }

  async generatePerformanceReport(timeRanges, filters) {
    return {
      apiPerformance: await this.getApiPerformanceData(timeRanges, filters),
      systemMetrics: await this.getSystemMetricsData(timeRanges, filters),
      modelPerformance: await this.getModelPerformanceData(timeRanges, filters),
      bottlenecks: await this.identifyBottlenecks(timeRanges, filters),
      recommendations: await this.generatePerformanceRecommendations(timeRanges, filters)
    };
  }

  async generateUsageReport(timeRanges, filters) {
    return {
      apiUsage: await this.getApiUsageData(timeRanges, filters),
      modelUsage: await this.getModelUsageData(timeRanges, filters),
      featureUsage: await this.getFeatureUsageData(timeRanges, filters),
      userActivity: await this.getUserActivityData(timeRanges, filters),
      costs: await this.getCostData(timeRanges, filters)
    };
  }

  // Alert system

  setupAlertSystem() {
    // Check alerts every minute
    setInterval(() => {
      this.checkAlerts();
    }, 60 * 1000);
  }

  checkAlerts() {
    for (const [alertId, alert] of this.alertRules) {
      if (!alert.enabled) continue;

      try {
        this.evaluateAlert(alert);
      } catch (error) {
        logger.error('Failed to evaluate alert', {
          alertId,
          name: alert.name,
          error: error.message
        });
      }
    }
  }

  async evaluateAlert(alert) {
    const metricValue = await this.getMetricValue(alert.metric, alert.timeWindow);
    
    let triggered = false;
    
    switch (alert.condition) {
      case 'gt':
        triggered = metricValue > alert.threshold;
        break;
      case 'lt':
        triggered = metricValue < alert.threshold;
        break;
      case 'gte':
        triggered = metricValue >= alert.threshold;
        break;
      case 'lte':
        triggered = metricValue <= alert.threshold;
        break;
      case 'eq':
        triggered = metricValue === alert.threshold;
        break;
    }

    if (triggered) {
      await this.triggerAlert(alert, metricValue);
    }
  }

  async triggerAlert(alert, currentValue) {
    alert.lastTriggered = new Date();
    alert.triggerCount += 1;

    const alertData = {
      alertId: alert.id,
      name: alert.name,
      metric: alert.metric,
      currentValue,
      threshold: alert.threshold,
      condition: alert.condition,
      severity: alert.severity,
      triggeredAt: alert.lastTriggered
    };

    // Send alert through configured channels
    for (const channel of alert.channels) {
      await this.sendAlert(channel, alertData);
    }

    logger.warn('Analytics alert triggered', alertData);

    this.emit('analytics:alert', alertData);
  }

  async sendAlert(channel, alertData) {
    // Implementation would send alerts via email, Slack, webhooks, etc.
    logger.info(`Alert sent via ${channel}`, {
      alertId: alertData.alertId,
      name: alertData.name
    });
  }

  // Utility methods

  calculateTimeRanges(timeframe) {
    const now = new Date();
    const ranges = { current: {}, previous: {} };

    switch (timeframe) {
      case 'hour':
        ranges.current.start = new Date(now.getTime() - 60 * 60 * 1000);
        ranges.current.end = now;
        ranges.previous.start = new Date(ranges.current.start.getTime() - 60 * 60 * 1000);
        ranges.previous.end = ranges.current.start;
        break;
      case 'day':
        ranges.current.start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        ranges.current.end = now;
        ranges.previous.start = new Date(ranges.current.start.getTime() - 24 * 60 * 60 * 1000);
        ranges.previous.end = ranges.current.start;
        break;
      case 'week':
        ranges.current.start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        ranges.current.end = now;
        ranges.previous.start = new Date(ranges.current.start.getTime() - 7 * 24 * 60 * 60 * 1000);
        ranges.previous.end = ranges.current.start;
        break;
      case 'month':
        ranges.current.start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        ranges.current.end = now;
        ranges.previous.start = new Date(ranges.current.start.getTime() - 30 * 24 * 60 * 60 * 1000);
        ranges.previous.end = ranges.current.start;
        break;
    }

    return ranges;
  }

  createDefaultDashboard() {
    return {
      id: 'default',
      name: 'Default Dashboard',
      widgets: {
        api_requests: {
          type: 'counter',
          title: 'API Requests',
          metric: 'total_requests',
          timeframe: '1h'
        },
        response_time: {
          type: 'gauge',
          title: 'Avg Response Time',
          metric: 'avg_response_time',
          timeframe: '1h'
        },
        error_rate: {
          type: 'percentage',
          title: 'Error Rate',
          metric: 'error_rate',
          timeframe: '1h'
        },
        active_users: {
          type: 'counter',
          title: 'Active Users',
          metric: 'active_users',
          timeframe: '1h'
        },
        model_usage: {
          type: 'chart',
          title: 'Model Usage',
          metric: 'model_requests',
          timeframe: '24h',
          chartType: 'line'
        },
        cost_tracking: {
          type: 'currency',
          title: 'Total Cost',
          metric: 'total_cost',
          timeframe: '24h'
        }
      }
    };
  }

  async processWidget(widget) {
    const value = await this.getMetricValue(widget.metric, widget.timeframe);
    
    return {
      ...widget,
      value,
      lastUpdated: new Date()
    };
  }

  async getMetricValue(metric, timeframe) {
    // Get metric value from real-time metrics or aggregated data
    const realtimeValue = this.realtimeMetrics.get(metric);
    
    if (realtimeValue) {
      return realtimeValue.total || realtimeValue.value || realtimeValue.average || 0;
    }

    return 0;
  }

  generateReportId() {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  countDataPoints(data) {
    let count = 0;
    
    function countRecursive(obj) {
      if (Array.isArray(obj)) {
        count += obj.length;
        obj.forEach(countRecursive);
      } else if (obj && typeof obj === 'object') {
        Object.values(obj).forEach(countRecursive);
      }
    }
    
    countRecursive(data);
    return count;
  }

  async saveReport(report, format) {
    const filename = `${report.id}.${format}`;
    const filepath = path.join(this.reportsDir, filename);
    
    if (format === 'json') {
      await fs.writeJson(filepath, report, { spaces: 2 });
    } else {
      // Handle other formats (CSV, PDF, etc.)
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    }
  }

  // Public API methods

  getRealtimeMetrics() {
    return Object.fromEntries(this.realtimeMetrics);
  }

  getAggregatedData(timeframe = 'hour') {
    return this.aggregatedData.get(timeframe) || {};
  }

  async clearMetrics(options = {}) {
    const { olderThan, metrics } = options;
    
    if (metrics) {
      // Clear specific metrics
      metrics.forEach(metric => {
        this.realtimeMetrics.delete(metric);
      });
    } else if (olderThan) {
      // Clear metrics older than specified time
      const cutoff = new Date(olderThan);
      
      for (const [key, value] of this.realtimeMetrics) {
        if (value.lastUpdated && value.lastUpdated < cutoff) {
          this.realtimeMetrics.delete(key);
        }
      }
    } else {
      // Clear all metrics
      this.realtimeMetrics.clear();
    }
  }

  getAnalyticsStats() {
    return {
      realtimeMetrics: this.realtimeMetrics.size,
      aggregatedData: this.aggregatedData.size,
      alertRules: this.alertRules.size,
      dashboards: this.dashboards.size,
      eventBufferSize: this.eventBuffer.length
    };
  }
}