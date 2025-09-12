import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class RateLimitService extends EventEmitter {
  constructor() {
    super();
    this.dataDir = path.join(__dirname, '../../../data/rate_limits');
    this.configDir = path.join(this.dataDir, 'configs');
    this.metricsDir = path.join(this.dataDir, 'metrics');
    
    // In-memory rate limit trackers
    this.buckets = new Map(); // Token bucket for rate limiting
    this.quotas = new Map(); // Quota tracking
    this.windowCounts = new Map(); // Sliding window counters
    this.circuitBreakers = new Map(); // Circuit breaker states
    
    // Rate limit configurations
    this.configs = new Map();
    this.globalConfigs = new Map();
    this.emergencyLimits = new Map();
    
    // Rate limiting strategies
    this.strategies = {
      TOKEN_BUCKET: 'token_bucket',
      FIXED_WINDOW: 'fixed_window',
      SLIDING_WINDOW: 'sliding_window',
      SLIDING_LOG: 'sliding_log',
      ADAPTIVE: 'adaptive'
    };

    // Default configurations
    this.defaultConfigs = {
      api: {
        strategy: this.strategies.SLIDING_WINDOW,
        requests: 1000,
        window: 60000, // 1 minute
        burst: 50,
        queueSize: 100
      },
      ai_models: {
        strategy: this.strategies.TOKEN_BUCKET,
        requests: 100,
        window: 60000,
        burst: 10,
        tokens: 50000,
        tokenRefillRate: 100
      },
      uploads: {
        strategy: this.strategies.FIXED_WINDOW,
        requests: 20,
        window: 60000,
        maxSize: 50 * 1024 * 1024, // 50MB
        concurrent: 3
      },
      voice: {
        strategy: this.strategies.ADAPTIVE,
        requests: 50,
        window: 60000,
        transcriptionMinutes: 60,
        adaptiveThreshold: 0.8
      }
    };

    this.ensureDirectories();
    this.loadConfigurations();
    this.setupCleanup();
    this.setupMonitoring();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.dataDir);
    await fs.ensureDir(this.configDir);
    await fs.ensureDir(this.metricsDir);
  }

  /**
   * Configure rate limits for tenant/user
   */
  async configureRateLimit(identifier, limits, options = {}) {
    const {
      type = 'user', // 'user', 'tenant', 'api_key', 'ip'
      priority = 'normal', // 'low', 'normal', 'high', 'critical'
      enforceGlobal = true,
      customStrategies = {},
      quotaLimits = {},
      circuitBreakerConfig = {}
    } = options;

    try {
      const configId = this.generateConfigId();
      
      const configuration = {
        id: configId,
        identifier,
        type,
        priority,
        limits: this.normalizeLimits(limits),
        strategies: { ...this.defaultConfigs, ...customStrategies },
        quotas: quotaLimits,
        circuitBreaker: {
          enabled: true,
          failureThreshold: 50,
          recoveryTime: 60000, // 1 minute
          halfOpenMaxCalls: 5,
          ...circuitBreakerConfig
        },
        metadata: {
          createdAt: new Date(),
          enforceGlobal,
          lastUpdated: new Date()
        }
      };

      this.configs.set(identifier, configuration);

      // Initialize rate limit states
      await this.initializeRateLimitState(identifier, configuration);

      // Save configuration
      await this.saveConfiguration(configuration);

      logger.info('Rate limit configured', {
        configId,
        identifier,
        type,
        limits: Object.keys(limits)
      });

      this.emit('rate_limit:configured', { configId, identifier, configuration });

      return { configId, status: 'configured' };

    } catch (error) {
      logger.error('Failed to configure rate limit', {
        identifier,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check rate limit for a request
   */
  async checkRateLimit(identifier, resource, options = {}) {
    const {
      amount = 1,
      metadata = {},
      bypassEmergency = false,
      requestSize = 0,
      estimatedCost = 0
    } = options;

    try {
      // Check emergency limits first
      if (!bypassEmergency) {
        await this.checkEmergencyLimits(identifier, resource);
      }

      // Get configuration
      const config = this.getConfiguration(identifier);
      const resourceConfig = config.strategies[resource] || config.strategies.api;

      // Check circuit breaker
      await this.checkCircuitBreaker(identifier, resource);

      // Apply rate limiting strategy
      const result = await this.applyRateLimitStrategy(
        identifier,
        resource,
        resourceConfig,
        amount,
        { requestSize, estimatedCost, metadata }
      );

      // Check quotas
      const quotaResult = await this.checkQuotas(identifier, resource, amount, {
        requestSize,
        estimatedCost,
        metadata
      });

      // Combine results
      const finalResult = {
        allowed: result.allowed && quotaResult.allowed,
        remaining: Math.min(result.remaining, quotaResult.remaining),
        resetTime: Math.max(result.resetTime, quotaResult.resetTime),
        retryAfter: Math.max(result.retryAfter || 0, quotaResult.retryAfter || 0),
        limits: {
          rate: result,
          quota: quotaResult
        },
        metadata: {
          strategy: resourceConfig.strategy,
          identifier,
          resource,
          timestamp: new Date()
        }
      };

      // Update metrics
      await this.updateMetrics(identifier, resource, finalResult, options);

      // Log if rate limited
      if (!finalResult.allowed) {
        logger.warn('Rate limit exceeded', {
          identifier,
          resource,
          reason: !result.allowed ? 'rate_limit' : 'quota_exceeded',
          retryAfter: finalResult.retryAfter
        });

        this.emit('rate_limit:exceeded', {
          identifier,
          resource,
          result: finalResult
        });
      }

      return finalResult;

    } catch (error) {
      logger.error('Rate limit check failed', {
        identifier,
        resource,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Apply rate limiting strategy
   */
  async applyRateLimitStrategy(identifier, resource, config, amount, options = {}) {
    const key = `${identifier}:${resource}`;
    
    switch (config.strategy) {
      case this.strategies.TOKEN_BUCKET:
        return await this.applyTokenBucket(key, config, amount, options);
      
      case this.strategies.FIXED_WINDOW:
        return await this.applyFixedWindow(key, config, amount, options);
      
      case this.strategies.SLIDING_WINDOW:
        return await this.applySlidingWindow(key, config, amount, options);
      
      case this.strategies.SLIDING_LOG:
        return await this.applySlidingLog(key, config, amount, options);
      
      case this.strategies.ADAPTIVE:
        return await this.applyAdaptiveRateLimit(key, config, amount, options);
      
      default:
        throw new Error(`Unknown rate limiting strategy: ${config.strategy}`);
    }
  }

  /**
   * Token bucket rate limiting
   */
  async applyTokenBucket(key, config, amount, options) {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: config.burst || config.requests,
        lastRefill: now,
        capacity: config.burst || config.requests
      };
      this.buckets.set(key, bucket);
    }

    // Calculate tokens to add based on time elapsed
    const timePassed = now - bucket.lastRefill;
    const refillRate = config.tokenRefillRate || (config.requests / (config.window / 1000));
    const tokensToAdd = Math.floor((timePassed / 1000) * refillRate);

    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens >= amount) {
      bucket.tokens -= amount;
      
      return {
        allowed: true,
        remaining: bucket.tokens,
        resetTime: now + ((bucket.capacity - bucket.tokens) / refillRate) * 1000,
        retryAfter: 0
      };
    } else {
      const retryAfter = Math.ceil(((amount - bucket.tokens) / refillRate) * 1000);
      
      return {
        allowed: false,
        remaining: bucket.tokens,
        resetTime: now + retryAfter,
        retryAfter
      };
    }
  }

  /**
   * Fixed window rate limiting
   */
  async applyFixedWindow(key, config, amount, options) {
    const now = Date.now();
    const windowStart = Math.floor(now / config.window) * config.window;
    const windowKey = `${key}:${windowStart}`;

    let count = this.windowCounts.get(windowKey) || 0;

    if (count + amount <= config.requests) {
      this.windowCounts.set(windowKey, count + amount);
      
      return {
        allowed: true,
        remaining: config.requests - (count + amount),
        resetTime: windowStart + config.window,
        retryAfter: 0
      };
    } else {
      const retryAfter = (windowStart + config.window) - now;
      
      return {
        allowed: false,
        remaining: Math.max(0, config.requests - count),
        resetTime: windowStart + config.window,
        retryAfter
      };
    }
  }

  /**
   * Sliding window rate limiting
   */
  async applySlidingWindow(key, config, amount, options) {
    const now = Date.now();
    const windowSize = config.window;
    const windowStart = now - windowSize;

    // Get or initialize sliding window data
    let windowData = this.windowCounts.get(key);
    if (!windowData) {
      windowData = { timestamps: [], count: 0 };
      this.windowCounts.set(key, windowData);
    }

    // Remove old timestamps
    windowData.timestamps = windowData.timestamps.filter(timestamp => timestamp > windowStart);
    windowData.count = windowData.timestamps.length;

    if (windowData.count + amount <= config.requests) {
      // Add new timestamps
      for (let i = 0; i < amount; i++) {
        windowData.timestamps.push(now);
      }
      windowData.count += amount;

      const oldestTimestamp = windowData.timestamps[0] || now;
      const resetTime = oldestTimestamp + windowSize;

      return {
        allowed: true,
        remaining: config.requests - windowData.count,
        resetTime,
        retryAfter: 0
      };
    } else {
      const oldestTimestamp = windowData.timestamps[0];
      const retryAfter = oldestTimestamp ? (oldestTimestamp + windowSize) - now : 0;

      return {
        allowed: false,
        remaining: Math.max(0, config.requests - windowData.count),
        resetTime: now + retryAfter,
        retryAfter
      };
    }
  }

  /**
   * Adaptive rate limiting based on system load
   */
  async applyAdaptiveRateLimit(key, config, amount, options) {
    const systemLoad = await this.getSystemLoad();
    const adaptiveThreshold = config.adaptiveThreshold || 0.8;
    
    // Adjust limits based on system load
    let adjustedRequests = config.requests;
    if (systemLoad > adaptiveThreshold) {
      const reductionFactor = Math.min(0.5, (systemLoad - adaptiveThreshold) / (1 - adaptiveThreshold));
      adjustedRequests = Math.floor(config.requests * (1 - reductionFactor));
    }

    // Use sliding window with adjusted limits
    const adjustedConfig = { ...config, requests: adjustedRequests };
    const result = await this.applySlidingWindow(key, adjustedConfig, amount, options);

    // Add adaptive metadata
    result.adaptive = {
      systemLoad,
      originalLimit: config.requests,
      adjustedLimit: adjustedRequests,
      reductionFactor: (config.requests - adjustedRequests) / config.requests
    };

    return result;
  }

  /**
   * Check quota limits
   */
  async checkQuotas(identifier, resource, amount, options = {}) {
    const { requestSize = 0, estimatedCost = 0, metadata = {} } = options;
    
    const config = this.getConfiguration(identifier);
    const quotaConfig = config.quotas[resource];

    if (!quotaConfig) {
      return {
        allowed: true,
        remaining: Infinity,
        resetTime: 0,
        retryAfter: 0
      };
    }

    const now = Date.now();
    const quotaKey = `quota:${identifier}:${resource}`;
    let quota = this.quotas.get(quotaKey);

    if (!quota) {
      quota = {
        used: 0,
        resetTime: this.calculateQuotaResetTime(quotaConfig.period),
        metadata: {
          requests: 0,
          size: 0,
          cost: 0
        }
      };
      this.quotas.set(quotaKey, quota);
    }

    // Reset quota if period has passed
    if (now >= quota.resetTime) {
      quota.used = 0;
      quota.metadata = { requests: 0, size: 0, cost: 0 };
      quota.resetTime = this.calculateQuotaResetTime(quotaConfig.period);
    }

    // Check different quota types
    const checks = [];

    if (quotaConfig.requests !== undefined) {
      checks.push({
        type: 'requests',
        used: quota.metadata.requests,
        limit: quotaConfig.requests,
        increment: amount
      });
    }

    if (quotaConfig.size !== undefined) {
      checks.push({
        type: 'size',
        used: quota.metadata.size,
        limit: quotaConfig.size,
        increment: requestSize
      });
    }

    if (quotaConfig.cost !== undefined) {
      checks.push({
        type: 'cost',
        used: quota.metadata.cost,
        limit: quotaConfig.cost,
        increment: estimatedCost
      });
    }

    // Check if any quota would be exceeded
    for (const check of checks) {
      if (check.used + check.increment > check.limit) {
        return {
          allowed: false,
          remaining: Math.max(0, check.limit - check.used),
          resetTime: quota.resetTime,
          retryAfter: quota.resetTime - now,
          quotaType: check.type,
          quotaLimit: check.limit,
          quotaUsed: check.used
        };
      }
    }

    // Update quota usage
    quota.metadata.requests += amount;
    quota.metadata.size += requestSize;
    quota.metadata.cost += estimatedCost;

    // Find the most restrictive remaining quota
    let minRemaining = Infinity;
    for (const check of checks) {
      const remaining = check.limit - (check.used + check.increment);
      minRemaining = Math.min(minRemaining, remaining);
    }

    return {
      allowed: true,
      remaining: minRemaining,
      resetTime: quota.resetTime,
      retryAfter: 0
    };
  }

  /**
   * Check circuit breaker state
   */
  async checkCircuitBreaker(identifier, resource) {
    const key = `${identifier}:${resource}`;
    const breaker = this.circuitBreakers.get(key);

    if (!breaker || breaker.state === 'CLOSED') {
      return; // Allow request
    }

    const now = Date.now();

    if (breaker.state === 'OPEN') {
      if (now >= breaker.nextAttempt) {
        // Transition to HALF_OPEN
        breaker.state = 'HALF_OPEN';
        breaker.halfOpenCalls = 0;
        logger.info('Circuit breaker transitioning to HALF_OPEN', { key });
      } else {
        throw ApiError.serviceUnavailable('Service temporarily unavailable (circuit breaker open)', {
          retryAfter: Math.ceil((breaker.nextAttempt - now) / 1000)
        });
      }
    }

    if (breaker.state === 'HALF_OPEN') {
      const config = this.getConfiguration(identifier);
      const cbConfig = config.circuitBreaker;
      
      if (breaker.halfOpenCalls >= cbConfig.halfOpenMaxCalls) {
        throw ApiError.serviceUnavailable('Service temporarily unavailable (circuit breaker half-open limit reached)');
      }
    }
  }

  /**
   * Record circuit breaker result
   */
  async recordCircuitBreakerResult(identifier, resource, success) {
    const key = `${identifier}:${resource}`;
    let breaker = this.circuitBreakers.get(key);

    if (!breaker) {
      breaker = {
        state: 'CLOSED',
        failures: 0,
        lastFailure: null,
        halfOpenCalls: 0,
        nextAttempt: 0
      };
      this.circuitBreakers.set(key, breaker);
    }

    const config = this.getConfiguration(identifier);
    const cbConfig = config.circuitBreaker;

    if (success) {
      if (breaker.state === 'HALF_OPEN') {
        breaker.halfOpenCalls++;
        if (breaker.halfOpenCalls >= cbConfig.halfOpenMaxCalls) {
          // Successful recovery
          breaker.state = 'CLOSED';
          breaker.failures = 0;
          logger.info('Circuit breaker closed after successful recovery', { key });
        }
      } else if (breaker.state === 'CLOSED') {
        breaker.failures = Math.max(0, breaker.failures - 1); // Gradual recovery
      }
    } else {
      breaker.failures++;
      breaker.lastFailure = Date.now();

      if (breaker.state === 'HALF_OPEN') {
        // Failed during half-open, go back to open
        breaker.state = 'OPEN';
        breaker.nextAttempt = Date.now() + cbConfig.recoveryTime;
        logger.warn('Circuit breaker reopened after half-open failure', { key });
      } else if (breaker.failures >= cbConfig.failureThreshold) {
        // Threshold exceeded, open circuit breaker
        breaker.state = 'OPEN';
        breaker.nextAttempt = Date.now() + cbConfig.recoveryTime;
        logger.warn('Circuit breaker opened due to failure threshold', { 
          key, 
          failures: breaker.failures,
          threshold: cbConfig.failureThreshold
        });
      }
    }
  }

  /**
   * Set emergency rate limits
   */
  async setEmergencyLimits(options = {}) {
    const {
      globalLimits = {},
      duration = 60 * 60 * 1000, // 1 hour
      reason = 'emergency',
      priority = 'critical'
    } = options;

    const emergencyId = this.generateEmergencyId();
    const expiresAt = new Date(Date.now() + duration);

    const emergency = {
      id: emergencyId,
      limits: globalLimits,
      reason,
      priority,
      activatedAt: new Date(),
      expiresAt,
      active: true
    };

    this.emergencyLimits.set(emergencyId, emergency);

    logger.warn('Emergency rate limits activated', {
      emergencyId,
      reason,
      duration,
      limits: Object.keys(globalLimits)
    });

    this.emit('rate_limit:emergency_activated', { emergencyId, emergency });

    // Auto-deactivate after duration
    setTimeout(() => {
      emergency.active = false;
      logger.info('Emergency rate limits deactivated', { emergencyId });
      this.emit('rate_limit:emergency_deactivated', { emergencyId });
    }, duration);

    return { emergencyId, expiresAt };
  }

  /**
   * Get rate limit status for identifier
   */
  async getRateLimitStatus(identifier, resource = null) {
    const config = this.getConfiguration(identifier);
    const status = {
      identifier,
      timestamp: new Date(),
      limits: {},
      quotas: {},
      circuitBreakers: {}
    };

    const resources = resource ? [resource] : Object.keys(config.strategies);

    for (const res of resources) {
      const key = `${identifier}:${res}`;
      
      // Rate limit status
      const rateLimitState = this.getRateLimitState(key, config.strategies[res]);
      status.limits[res] = rateLimitState;

      // Quota status
      const quotaKey = `quota:${identifier}:${res}`;
      const quota = this.quotas.get(quotaKey);
      if (quota) {
        status.quotas[res] = {
          used: quota.metadata,
          resetTime: quota.resetTime,
          timeUntilReset: quota.resetTime - Date.now()
        };
      }

      // Circuit breaker status
      const breaker = this.circuitBreakers.get(key);
      if (breaker) {
        status.circuitBreakers[res] = {
          state: breaker.state,
          failures: breaker.failures,
          nextAttempt: breaker.nextAttempt
        };
      }
    }

    return status;
  }

  // Helper methods

  getConfiguration(identifier) {
    return this.configs.get(identifier) || this.createDefaultConfiguration(identifier);
  }

  createDefaultConfiguration(identifier) {
    const config = {
      identifier,
      type: 'default',
      priority: 'normal',
      limits: {},
      strategies: { ...this.defaultConfigs },
      quotas: {},
      circuitBreaker: {
        enabled: true,
        failureThreshold: 50,
        recoveryTime: 60000,
        halfOpenMaxCalls: 5
      },
      metadata: {
        createdAt: new Date(),
        isDefault: true
      }
    };

    this.configs.set(identifier, config);
    return config;
  }

  normalizeLimits(limits) {
    const normalized = {};
    
    for (const [resource, config] of Object.entries(limits)) {
      normalized[resource] = {
        requests: config.requests || 1000,
        window: config.window || 60000,
        burst: config.burst,
        ...config
      };
    }

    return normalized;
  }

  async initializeRateLimitState(identifier, configuration) {
    // Initialize buckets, quotas, and circuit breakers
    for (const resource of Object.keys(configuration.strategies)) {
      const key = `${identifier}:${resource}`;
      
      // Initialize quota if configured
      if (configuration.quotas[resource]) {
        const quotaKey = `quota:${identifier}:${resource}`;
        this.quotas.set(quotaKey, {
          used: 0,
          resetTime: this.calculateQuotaResetTime(configuration.quotas[resource].period),
          metadata: { requests: 0, size: 0, cost: 0 }
        });
      }
    }
  }

  calculateQuotaResetTime(period) {
    const now = new Date();
    
    switch (period) {
      case 'hour':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1).getTime();
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
      case 'week':
        const daysUntilNextWeek = 7 - now.getDay();
        return new Date(now.getTime() + daysUntilNextWeek * 24 * 60 * 60 * 1000).getTime();
      case 'month':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      default:
        return now.getTime() + 60 * 60 * 1000; // Default to 1 hour
    }
  }

  getRateLimitState(key, config) {
    switch (config.strategy) {
      case this.strategies.TOKEN_BUCKET:
        const bucket = this.buckets.get(key);
        return bucket ? {
          tokens: bucket.tokens,
          capacity: bucket.capacity,
          lastRefill: bucket.lastRefill
        } : null;

      case this.strategies.SLIDING_WINDOW:
      case this.strategies.SLIDING_LOG:
        const windowData = this.windowCounts.get(key);
        return windowData ? {
          count: windowData.count,
          timestamps: windowData.timestamps.length
        } : null;

      default:
        return null;
    }
  }

  async checkEmergencyLimits(identifier, resource) {
    for (const emergency of this.emergencyLimits.values()) {
      if (!emergency.active || emergency.expiresAt < new Date()) {
        continue;
      }

      const emergencyLimit = emergency.limits[resource];
      if (emergencyLimit) {
        // Apply emergency limits (simplified check)
        const key = `emergency:${identifier}:${resource}`;
        const count = this.windowCounts.get(key) || 0;
        
        if (count >= emergencyLimit.requests) {
          throw ApiError.serviceUnavailable('Emergency rate limits in effect', {
            reason: emergency.reason,
            retryAfter: 60
          });
        }
        
        this.windowCounts.set(key, count + 1);
      }
    }
  }

  async getSystemLoad() {
    // Mock implementation - would get actual system metrics
    return Math.random() * 0.3 + 0.1; // Simulate low to moderate load
  }

  async updateMetrics(identifier, resource, result, options) {
    const metrics = {
      identifier,
      resource,
      timestamp: new Date(),
      allowed: result.allowed,
      remaining: result.remaining,
      strategy: result.metadata?.strategy,
      ...options
    };

    // Emit for real-time monitoring
    this.emit('rate_limit:metrics', metrics);
  }

  setupCleanup() {
    // Clean up old data every 5 minutes
    setInterval(() => {
      this.cleanupExpiredData();
    }, 5 * 60 * 1000);
  }

  setupMonitoring() {
    // Monitor rate limit violations every minute
    setInterval(() => {
      this.monitorViolations();
    }, 60 * 1000);
  }

  cleanupExpiredData() {
    const now = Date.now();
    
    // Clean up old window counts (older than 1 hour)
    for (const [key, data] of this.windowCounts) {
      if (key.includes(':') && typeof data === 'object' && data.timestamps) {
        data.timestamps = data.timestamps.filter(timestamp => 
          now - timestamp < 60 * 60 * 1000
        );
        data.count = data.timestamps.length;
        
        if (data.timestamps.length === 0) {
          this.windowCounts.delete(key);
        }
      }
    }

    // Clean up expired quotas
    for (const [key, quota] of this.quotas) {
      if (quota.resetTime < now) {
        quota.used = 0;
        quota.metadata = { requests: 0, size: 0, cost: 0 };
        quota.resetTime = this.calculateQuotaResetTime('hour'); // Default reset
      }
    }

    // Clean up inactive emergency limits
    for (const [id, emergency] of this.emergencyLimits) {
      if (!emergency.active || emergency.expiresAt < new Date()) {
        this.emergencyLimits.delete(id);
      }
    }
  }

  async saveConfiguration(configuration) {
    const configFile = path.join(this.configDir, `${configuration.identifier}.json`);
    
    // Don't save sensitive data
    const sanitizedConfig = {
      ...configuration,
      // Remove any sensitive information if needed
    };
    
    await fs.writeJson(configFile, sanitizedConfig, { spaces: 2 });
  }

  async loadConfigurations() {
    try {
      const files = await fs.readdir(this.configDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const configFile = path.join(this.configDir, file);
          const config = await fs.readJson(configFile);
          this.configs.set(config.identifier, config);
        }
      }

      logger.info('Loaded rate limit configurations', {
        count: this.configs.size
      });

    } catch (error) {
      logger.error('Failed to load rate limit configurations', {
        error: error.message
      });
    }
  }

  // ID generators
  generateConfigId() {
    return `rl_config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateEmergencyId() {
    return `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  async resetRateLimit(identifier, resource = null) {
    if (resource) {
      const key = `${identifier}:${resource}`;
      this.buckets.delete(key);
      this.windowCounts.delete(key);
      this.circuitBreakers.delete(key);
    } else {
      // Reset all resources for identifier
      const keysToDelete = [];
      
      for (const key of this.buckets.keys()) {
        if (key.startsWith(`${identifier}:`)) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => {
        this.buckets.delete(key);
        this.windowCounts.delete(key);
        this.circuitBreakers.delete(key);
      });
    }

    logger.info('Rate limit reset', { identifier, resource });
    
    return { status: 'reset', identifier, resource };
  }

  getRateLimitStats() {
    return {
      configurations: this.configs.size,
      activeBuckets: this.buckets.size,
      activeQuotas: this.quotas.size,
      circuitBreakers: this.circuitBreakers.size,
      emergencyLimits: this.emergencyLimits.size,
      strategies: Object.values(this.strategies)
    };
  }

  async exportMetrics(timeRange = '1h') {
    // Export rate limit metrics for analysis
    const metrics = {
      timeRange,
      exportedAt: new Date(),
      configurations: Array.from(this.configs.values()),
      quotaUsage: Array.from(this.quotas.entries()),
      circuitBreakerStates: Array.from(this.circuitBreakers.entries()),
      emergencyLimits: Array.from(this.emergencyLimits.values())
    };

    return metrics;
  }
}