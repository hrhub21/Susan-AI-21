import axios from 'axios';
import crypto from 'crypto';
import EventEmitter from 'events';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * API Integration Framework for Susan AI
 * Flexible framework for connecting with any external system
 * Provides unified interface for REST APIs, GraphQL, WebSockets, and webhooks
 */
export class APIIntegrationFramework extends EventEmitter {
  constructor() {
    super();
    
    // Core configuration
    this.integrations = new Map();
    this.clients = new Map();
    this.rateLimiters = new Map();
    this.authHandlers = new Map();
    this.dataTransformers = new Map();
    this.webhookHandlers = new Map();
    this.auditLogs = [];
    this.retryQueues = new Map();
    this.middlewares = new Map();
    this.circuitBreakers = new Map();
    this.cache = new Map();
    
    // Framework configurations
    this.defaultConfig = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      rateLimit: {
        requests: 100,
        window: 60000 // 1 minute
      }
    };
    
    // Authentication types
    this.authTypes = {
      NONE: 'none',
      API_KEY: 'api_key',
      BEARER_TOKEN: 'bearer_token',
      BASIC_AUTH: 'basic_auth',
      OAUTH2: 'oauth2',
      JWT: 'jwt',
      CUSTOM: 'custom'
    };
    
    // Protocol types
    this.protocolTypes = {
      REST: 'rest',
      GRAPHQL: 'graphql',
      SOAP: 'soap',
      WEBSOCKET: 'websocket',
      GRPC: 'grpc'
    };
    
    this.setupDefaultMiddlewares();
    this.setupAuthHandlers();
    this.startRetryProcessor();
    this.startCircuitBreakerMonitoring();
    this.startCacheCleanup();
  }

  // Integration Management
  async registerIntegration(integrationId, config) {
    try {
      const integration = this.validateIntegrationConfig({
        id: integrationId,
        ...this.defaultConfig,
        ...config,
        createdAt: new Date(),
        enabled: true,
        status: 'inactive'
      });

      this.integrations.set(integrationId, integration);
      
      // Initialize client
      await this.initializeClient(integrationId);
      
      // Setup rate limiter
      this.setupRateLimiter(integrationId, integration.rateLimit);
      
      // Setup circuit breaker
      this.setupCircuitBreaker(integrationId, integration);
      
      // Setup data transformers
      if (integration.dataTransformers) {
        this.dataTransformers.set(integrationId, integration.dataTransformers);
      }
      
      // Setup webhook handlers
      if (integration.webhooks) {
        this.setupWebhookHandlers(integrationId, integration.webhooks);
      }

      this.logAudit('integration_registered', { integrationId, name: integration.name });

      return {
        success: true,
        integrationId,
        status: 'registered'
      };

    } catch (error) {
      this.logError(integrationId, 'Integration Registration Failed', error);
      throw new ApiError(`Failed to register integration ${integrationId}: ${error.message}`, 400);
    }
  }

  validateIntegrationConfig(config) {
    const required = ['id', 'name', 'baseUrl', 'protocol'];
    const missing = required.filter(field => !config[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (!Object.values(this.protocolTypes).includes(config.protocol)) {
      throw new Error(`Unsupported protocol: ${config.protocol}`);
    }

    if (config.auth && !Object.values(this.authTypes).includes(config.auth.type)) {
      throw new Error(`Unsupported auth type: ${config.auth.type}`);
    }

    return config;
  }

  async initializeClient(integrationId) {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    let client;

    switch (integration.protocol) {
      case this.protocolTypes.REST:
        client = await this.createRestClient(integration);
        break;
      case this.protocolTypes.GRAPHQL:
        client = await this.createGraphQLClient(integration);
        break;
      case this.protocolTypes.SOAP:
        client = await this.createSoapClient(integration);
        break;
      case this.protocolTypes.WEBSOCKET:
        client = await this.createWebSocketClient(integration);
        break;
      case this.protocolTypes.GRPC:
        client = await this.createGrpcClient(integration);
        break;
      default:
        throw new Error(`Unsupported protocol: ${integration.protocol}`);
    }

    this.clients.set(integrationId, client);
    integration.status = 'active';
    
    logger.info(`Client initialized for integration: ${integration.name}`);
    return client;
  }

  async createRestClient(integration) {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Susan-AI-Integration-Framework/1.0',
      ...integration.headers
    };

    // Handle authentication
    if (integration.auth) {
      const authHeaders = await this.getAuthHeaders(integration.id, integration.auth);
      Object.assign(headers, authHeaders);
    }

    const client = axios.create({
      baseURL: integration.baseUrl,
      timeout: integration.timeout,
      headers,
      maxRedirects: integration.maxRedirects || 5,
      validateStatus: integration.validateStatus || ((status) => status < 400)
    });

    // Add request interceptor
    client.interceptors.request.use(
      async (config) => {
        // Apply middlewares
        for (const middleware of this.getMiddlewares(integration.id, 'request')) {
          config = await middleware(config, integration);
        }
        
        // Rate limiting
        await this.checkRateLimit(integration.id);
        
        // Circuit breaker check
        this.checkCircuitBreaker(integration.id);
        
        this.logRequest(integration.id, config);
        return config;
      },
      (error) => {
        this.logError(integration.id, 'Request Error', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor
    client.interceptors.response.use(
      async (response) => {
        // Apply middlewares
        for (const middleware of this.getMiddlewares(integration.id, 'response')) {
          response = await middleware(response, integration);
        }
        
        // Record success for circuit breaker
        this.recordCircuitBreakerSuccess(integration.id);
        
        this.logResponse(integration.id, response);
        return response;
      },
      async (error) => {
        // Record failure for circuit breaker
        this.recordCircuitBreakerFailure(integration.id);
        
        this.logError(integration.id, 'Response Error', error);
        
        // Handle common errors
        if (error.response?.status === 429) {
          return this.handleRateLimit(integration.id, error.config);
        }
        
        if (error.response?.status === 401 || error.response?.status === 403) {
          return this.handleAuthError(integration.id, error.config);
        }
        
        return Promise.reject(error);
      }
    );

    return client;
  }

  async createGraphQLClient(integration) {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Susan-AI-Integration-Framework/1.0',
      ...integration.headers
    };

    if (integration.auth) {
      const authHeaders = await this.getAuthHeaders(integration.id, integration.auth);
      Object.assign(headers, authHeaders);
    }

    return {
      type: 'graphql',
      baseURL: integration.baseUrl,
      headers,
      async query(query, variables = {}) {
        const response = await axios.post(integration.baseUrl, {
          query,
          variables
        }, {
          headers,
          timeout: integration.timeout
        });
        
        if (response.data.errors) {
          throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
        }
        
        return response.data.data;
      },
      async mutation(mutation, variables = {}) {
        return this.query(mutation, variables);
      }
    };
  }

  async createSoapClient(integration) {
    // SOAP client implementation would require additional libraries like 'soap'
    throw new Error('SOAP protocol not yet implemented');
  }

  async createWebSocketClient(integration) {
    // WebSocket client implementation
    const WebSocket = require('ws');
    
    const wsUrl = integration.baseUrl.replace(/^http/, 'ws');
    const ws = new WebSocket(wsUrl, {
      headers: integration.headers,
      timeout: integration.timeout
    });

    return {
      type: 'websocket',
      ws,
      send: (data) => ws.send(JSON.stringify(data)),
      close: () => ws.close(),
      on: (event, callback) => ws.on(event, callback)
    };
  }

  async createGrpcClient(integration) {
    // gRPC client implementation would require gRPC libraries
    throw new Error('gRPC protocol not yet implemented');
  }

  // Authentication Handlers
  setupAuthHandlers() {
    this.authHandlers.set(this.authTypes.NONE, () => ({}));
    
    this.authHandlers.set(this.authTypes.API_KEY, (auth) => {
      const headers = {};
      if (auth.header) {
        headers[auth.header] = auth.key;
      } else {
        headers['X-API-Key'] = auth.key;
      }
      return headers;
    });
    
    this.authHandlers.set(this.authTypes.BEARER_TOKEN, (auth) => ({
      'Authorization': `Bearer ${auth.token}`
    }));
    
    this.authHandlers.set(this.authTypes.BASIC_AUTH, (auth) => {
      const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      return {
        'Authorization': `Basic ${credentials}`
      };
    });
    
    this.authHandlers.set(this.authTypes.JWT, (auth) => ({
      'Authorization': `Bearer ${auth.token}`
    }));
    
    this.authHandlers.set(this.authTypes.OAUTH2, async (auth, integrationId) => {
      // Handle OAuth2 token refresh if needed
      if (auth.expiresAt && Date.now() >= auth.expiresAt - 60000) {
        await this.refreshOAuth2Token(integrationId, auth);
      }
      return {
        'Authorization': `Bearer ${auth.accessToken}`
      };
    });
  }

  async getAuthHeaders(integrationId, auth) {
    const handler = this.authHandlers.get(auth.type);
    if (!handler) {
      throw new Error(`Unsupported auth type: ${auth.type}`);
    }
    
    if (auth.type === this.authTypes.OAUTH2) {
      return await handler(auth, integrationId);
    }
    
    return handler(auth);
  }

  async refreshOAuth2Token(integrationId, auth) {
    if (!auth.refreshToken) {
      throw new Error('No refresh token available for OAuth2');
    }

    try {
      const response = await axios.post(auth.tokenEndpoint, {
        grant_type: 'refresh_token',
        refresh_token: auth.refreshToken,
        client_id: auth.clientId,
        client_secret: auth.clientSecret
      });

      auth.accessToken = response.data.access_token;
      auth.expiresAt = Date.now() + (response.data.expires_in * 1000);
      
      if (response.data.refresh_token) {
        auth.refreshToken = response.data.refresh_token;
      }

      this.logAudit('oauth2_token_refreshed', { integrationId });
      
    } catch (error) {
      this.logError(integrationId, 'OAuth2 Token Refresh Failed', error);
      throw new Error(`Failed to refresh OAuth2 token: ${error.message}`);
    }
  }

  // Rate Limiting
  setupRateLimiter(integrationId, rateLimitConfig) {
    this.rateLimiters.set(integrationId, {
      requests: 0,
      windowStart: Date.now(),
      ...rateLimitConfig
    });
  }

  async checkRateLimit(integrationId) {
    const limiter = this.rateLimiters.get(integrationId);
    if (!limiter) return;

    const now = Date.now();
    
    // Reset window if expired
    if (now - limiter.windowStart >= limiter.window) {
      limiter.requests = 0;
      limiter.windowStart = now;
    }

    // Check if rate limit exceeded
    if (limiter.requests >= limiter.requests) {
      const waitTime = limiter.window - (now - limiter.windowStart);
      throw new ApiError(`Rate limit exceeded for ${integrationId}. Wait ${Math.ceil(waitTime / 1000)} seconds.`, 429);
    }

    limiter.requests++;
  }

  async handleRateLimit(integrationId, originalConfig) {
    const retryAfter = parseInt(originalConfig.response?.headers['retry-after']) || 60;
    logger.warn(`Rate limited by ${integrationId}. Retrying after ${retryAfter} seconds.`);
    
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const client = this.clients.get(integrationId);
          const response = await client.request(originalConfig);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      }, retryAfter * 1000);
    });
  }

  async handleAuthError(integrationId, originalConfig) {
    const integration = this.integrations.get(integrationId);
    if (integration?.auth?.type === this.authTypes.OAUTH2) {
      try {
        await this.refreshOAuth2Token(integrationId, integration.auth);
        const client = this.clients.get(integrationId);
        
        // Update auth headers
        const authHeaders = await this.getAuthHeaders(integrationId, integration.auth);
        Object.assign(client.defaults.headers, authHeaders);
        
        return client.request(originalConfig);
      } catch (error) {
        logger.error(`Failed to refresh token for ${integrationId}`, error);
      }
    }
    
    throw new ApiError(`Authentication failed for ${integrationId}. Please re-authenticate.`, 401);
  }

  // Circuit Breaker
  setupCircuitBreaker(integrationId, integration) {
    this.circuitBreakers.set(integrationId, {
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      failureCount: 0,
      successCount: 0,
      threshold: integration.circuitBreakerThreshold,
      timeout: integration.circuitBreakerTimeout,
      nextAttempt: null
    });
  }

  checkCircuitBreaker(integrationId) {
    const breaker = this.circuitBreakers.get(integrationId);
    if (!breaker) return;

    if (breaker.state === 'OPEN') {
      if (Date.now() >= breaker.nextAttempt) {
        breaker.state = 'HALF_OPEN';
        breaker.successCount = 0;
        logger.info(`Circuit breaker for ${integrationId} entering HALF_OPEN state`);
      } else {
        throw new ApiError(`Circuit breaker for ${integrationId} is OPEN`, 503);
      }
    }
  }

  recordCircuitBreakerSuccess(integrationId) {
    const breaker = this.circuitBreakers.get(integrationId);
    if (!breaker) return;

    breaker.failureCount = 0;
    
    if (breaker.state === 'HALF_OPEN') {
      breaker.successCount++;
      if (breaker.successCount >= 3) {
        breaker.state = 'CLOSED';
        logger.info(`Circuit breaker for ${integrationId} entering CLOSED state`);
      }
    }
  }

  recordCircuitBreakerFailure(integrationId) {
    const breaker = this.circuitBreakers.get(integrationId);
    if (!breaker) return;

    breaker.failureCount++;
    
    if (breaker.failureCount >= breaker.threshold) {
      breaker.state = 'OPEN';
      breaker.nextAttempt = Date.now() + breaker.timeout;
      logger.warn(`Circuit breaker for ${integrationId} entering OPEN state`);
    }
  }

  startCircuitBreakerMonitoring() {
    setInterval(() => {
      for (const [integrationId, breaker] of this.circuitBreakers) {
        if (breaker.state === 'OPEN' && Date.now() >= breaker.nextAttempt) {
          breaker.state = 'HALF_OPEN';
          breaker.successCount = 0;
          logger.info(`Circuit breaker for ${integrationId} auto-entering HALF_OPEN state`);
        }
      }
    }, 10000); // Check every 10 seconds
  }

  // Middleware System
  setupDefaultMiddlewares() {
    // Request logging middleware
    this.addMiddleware('global', 'request', async (config, integration) => {
      logger.debug('API Request', {
        integrationId: integration.id,
        method: config.method?.toUpperCase(),
        url: config.url,
        timestamp: new Date()
      });
      return config;
    });

    // Response caching middleware
    this.addMiddleware('global', 'response', async (response, integration) => {
      if (integration.cacheEnabled && response.config.method?.toLowerCase() === 'get') {
        const cacheKey = this.generateCacheKey(integration.id, response.config);
        this.setCache(cacheKey, response.data, integration.cacheTTL);
      }
      return response;
    });

    // Data transformation middleware
    this.addMiddleware('global', 'response', async (response, integration) => {
      const transformer = this.dataTransformers.get(integration.id);
      if (transformer && transformer.response) {
        response.data = await transformer.response(response.data, response);
      }
      return response;
    });
  }

  addMiddleware(integrationId, type, middleware) {
    const key = `${integrationId}:${type}`;
    if (!this.middlewares.has(key)) {
      this.middlewares.set(key, []);
    }
    this.middlewares.get(key).push(middleware);
  }

  getMiddlewares(integrationId, type) {
    const specific = this.middlewares.get(`${integrationId}:${type}`) || [];
    const global = this.middlewares.get(`global:${type}`) || [];
    return [...global, ...specific];
  }

  // Caching System
  generateCacheKey(integrationId, config) {
    const keyData = {
      integrationId,
      method: config.method,
      url: config.url,
      params: config.params,
      data: config.data
    };
    return crypto.createHash('md5').update(JSON.stringify(keyData)).digest('hex');
  }

  setCache(key, data, ttl) {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl
    });
  }

  getCache(key) {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.cache) {
        if (cached.expiresAt <= now) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }

  // API Call Methods
  async makeRequest(integrationId, config) {
    const integration = this.integrations.get(integrationId);
    const client = this.clients.get(integrationId);

    if (!integration || !client) {
      throw new ApiError(`Integration ${integrationId} not available`, 400);
    }

    if (!integration.enabled) {
      throw new ApiError(`Integration ${integrationId} is disabled`, 403);
    }

    try {
      // Check cache for GET requests
      if (config.method?.toLowerCase() === 'get' && integration.cacheEnabled) {
        const cacheKey = this.generateCacheKey(integrationId, config);
        const cached = this.getCache(cacheKey);
        if (cached) {
          this.logAudit('cache_hit', { integrationId, cacheKey });
          return {
            success: true,
            data: cached,
            cached: true,
            integrationId
          };
        }
      }

      let response;

      switch (integration.protocol) {
        case this.protocolTypes.REST:
          response = await client.request(config);
          break;
        case this.protocolTypes.GRAPHQL:
          if (config.query) {
            response = { data: await client.query(config.query, config.variables) };
          } else if (config.mutation) {
            response = { data: await client.mutation(config.mutation, config.variables) };
          } else {
            throw new Error('GraphQL query or mutation required');
          }
          break;
        default:
          throw new Error(`Request not supported for protocol: ${integration.protocol}`);
      }

      this.logAudit('request_completed', { 
        integrationId, 
        method: config.method,
        url: config.url,
        status: response.status 
      });

      return {
        success: true,
        data: response.data,
        status: response.status,
        headers: response.headers,
        integrationId
      };

    } catch (error) {
      this.logError(integrationId, 'Request Failed', error);
      
      // Add to retry queue for retryable errors
      if (this.isRetryableError(error)) {
        return this.addToRetryQueue(integrationId, 'makeRequest', { config });
      }
      
      throw new ApiError(`Request failed for ${integrationId}: ${error.message}`, error.response?.status || 500);
    }
  }

  async get(integrationId, url, params = {}, options = {}) {
    return this.makeRequest(integrationId, {
      method: 'GET',
      url,
      params,
      ...options
    });
  }

  async post(integrationId, url, data = {}, options = {}) {
    return this.makeRequest(integrationId, {
      method: 'POST',
      url,
      data,
      ...options
    });
  }

  async put(integrationId, url, data = {}, options = {}) {
    return this.makeRequest(integrationId, {
      method: 'PUT',
      url,
      data,
      ...options
    });
  }

  async patch(integrationId, url, data = {}, options = {}) {
    return this.makeRequest(integrationId, {
      method: 'PATCH',
      url,
      data,
      ...options
    });
  }

  async delete(integrationId, url, options = {}) {
    return this.makeRequest(integrationId, {
      method: 'DELETE',
      url,
      ...options
    });
  }

  async graphqlQuery(integrationId, query, variables = {}) {
    return this.makeRequest(integrationId, {
      query,
      variables
    });
  }

  async graphqlMutation(integrationId, mutation, variables = {}) {
    return this.makeRequest(integrationId, {
      mutation,
      variables
    });
  }

  // Data Transformation
  addDataTransformer(integrationId, transformers) {
    this.dataTransformers.set(integrationId, transformers);
  }

  // Webhook Handling
  setupWebhookHandlers(integrationId, webhookConfig) {
    this.webhookHandlers.set(integrationId, webhookConfig);
  }

  async handleWebhook(integrationId, data, headers = {}) {
    const webhookConfig = this.webhookHandlers.get(integrationId);
    if (!webhookConfig) {
      throw new ApiError(`No webhook handler for ${integrationId}`, 404);
    }

    try {
      // Verify webhook signature if configured
      if (webhookConfig.secret && webhookConfig.signatureHeader) {
        const signature = headers[webhookConfig.signatureHeader.toLowerCase()];
        if (!this.verifyWebhookSignature(data, signature, webhookConfig.secret)) {
          throw new ApiError('Invalid webhook signature', 401);
        }
      }

      // Process webhook data
      let processedData = data;
      if (webhookConfig.transformer) {
        processedData = await webhookConfig.transformer(data, headers);
      }

      // Emit event
      this.emit('webhook_received', {
        integrationId,
        data: processedData,
        headers,
        timestamp: new Date()
      });

      this.logAudit('webhook_processed', { integrationId, type: webhookConfig.type });

      return {
        success: true,
        processed: true,
        integrationId
      };

    } catch (error) {
      this.logError(integrationId, 'Webhook Processing Failed', error);
      throw new ApiError(`Webhook processing failed: ${error.message}`, 400);
    }
  }

  verifyWebhookSignature(payload, signature, secret) {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return signature === `sha256=${expectedSignature}` || signature === expectedSignature;
  }

  // Utility Methods
  isRetryableError(error) {
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    const statusCode = error.response?.status;
    
    return retryableStatusCodes.includes(statusCode) ||
           error.code === 'ECONNRESET' ||
           error.code === 'ETIMEDOUT' ||
           error.code === 'ENOTFOUND';
  }

  addToRetryQueue(integrationId, operation, params) {
    if (!this.retryQueues.has(integrationId)) {
      this.retryQueues.set(integrationId, []);
    }

    const retryItem = {
      id: crypto.randomBytes(8).toString('hex'),
      operation,
      params,
      attempts: 0,
      maxAttempts: this.integrations.get(integrationId)?.retries || 3,
      nextRetry: Date.now() + (this.integrations.get(integrationId)?.retryDelay || 1000),
      integrationId
    };

    this.retryQueues.get(integrationId).push(retryItem);
    this.logAudit('operation_queued_for_retry', { integrationId, operation, retryId: retryItem.id });

    return {
      success: false,
      queued: true,
      retryId: retryItem.id,
      message: `Operation queued for retry due to error`
    };
  }

  startRetryProcessor() {
    setInterval(() => {
      this.processRetryQueues();
    }, 5000); // Check every 5 seconds
  }

  async processRetryQueues() {
    for (const [integrationId, queue] of this.retryQueues) {
      const now = Date.now();
      const itemsToProcess = queue.filter(item => item.nextRetry <= now);

      for (const item of itemsToProcess) {
        try {
          item.attempts++;
          
          let result;
          switch (item.operation) {
            case 'makeRequest':
              result = await this.makeRequest(integrationId, item.params.config);
              break;
          }

          if (result.success) {
            // Remove from queue
            const index = queue.indexOf(item);
            if (index > -1) queue.splice(index, 1);
            
            this.logAudit('retry_succeeded', { 
              integrationId, 
              operation: item.operation, 
              retryId: item.id,
              attempts: item.attempts 
            });
          }

        } catch (error) {
          if (item.attempts >= item.maxAttempts) {
            // Remove failed item
            const index = queue.indexOf(item);
            if (index > -1) queue.splice(index, 1);
            
            this.logAudit('retry_failed_permanently', { 
              integrationId, 
              operation: item.operation, 
              retryId: item.id,
              attempts: item.attempts,
              error: error.message 
            });
          } else {
            // Schedule next retry with exponential backoff
            const delay = this.integrations.get(integrationId)?.retryDelay || 1000;
            item.nextRetry = Date.now() + (delay * Math.pow(2, item.attempts - 1));
          }
        }
      }
    }
  }

  // Integration Management Methods
  async enableIntegration(integrationId) {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new ApiError(`Integration ${integrationId} not found`, 404);
    }

    integration.enabled = true;
    this.logAudit('integration_enabled', { integrationId });

    return { success: true, integrationId, enabled: true };
  }

  async disableIntegration(integrationId) {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new ApiError(`Integration ${integrationId} not found`, 404);
    }

    integration.enabled = false;
    this.logAudit('integration_disabled', { integrationId });

    return { success: true, integrationId, enabled: false };
  }

  async removeIntegration(integrationId) {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new ApiError(`Integration ${integrationId} not found`, 404);
    }

    // Cleanup resources
    this.integrations.delete(integrationId);
    this.clients.delete(integrationId);
    this.rateLimiters.delete(integrationId);
    this.circuitBreakers.delete(integrationId);
    this.dataTransformers.delete(integrationId);
    this.webhookHandlers.delete(integrationId);
    this.retryQueues.delete(integrationId);

    this.logAudit('integration_removed', { integrationId });

    return { success: true, integrationId, removed: true };
  }

  async updateIntegration(integrationId, updates) {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new ApiError(`Integration ${integrationId} not found`, 404);
    }

    const updatedIntegration = {
      ...integration,
      ...updates,
      id: integrationId, // Don't allow ID changes
      updatedAt: new Date()
    };

    this.integrations.set(integrationId, updatedIntegration);

    // Re-initialize client if necessary
    if (updates.baseUrl || updates.auth || updates.headers) {
      await this.initializeClient(integrationId);
    }

    this.logAudit('integration_updated', { integrationId });

    return { success: true, integrationId, integration: updatedIntegration };
  }

  // Monitoring and Status
  async testConnection(integrationId) {
    const integration = this.integrations.get(integrationId);
    const client = this.clients.get(integrationId);

    if (!integration || !client) {
      return { success: false, error: 'Integration not available' };
    }

    try {
      let response;
      
      switch (integration.protocol) {
        case this.protocolTypes.REST:
          const testEndpoint = integration.healthEndpoint || '/health';
          response = await client.get(testEndpoint, { timeout: 5000 });
          break;
        case this.protocolTypes.GRAPHQL:
          response = await client.query('{ __typename }');
          break;
        default:
          throw new Error(`Test connection not implemented for ${integration.protocol}`);
      }

      return {
        success: true,
        status: response.status || 200,
        integrationId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        integrationId,
        timestamp: new Date()
      };
    }
  }

  getIntegrationStatus() {
    const status = {};
    
    for (const [integrationId, integration] of this.integrations) {
      const rateLimiter = this.rateLimiters.get(integrationId);
      const circuitBreaker = this.circuitBreakers.get(integrationId);
      const retryQueue = this.retryQueues.get(integrationId) || [];

      status[integrationId] = {
        name: integration.name,
        protocol: integration.protocol,
        enabled: integration.enabled,
        status: integration.status,
        lastUpdated: integration.updatedAt,
        rateLimitStatus: rateLimiter ? {
          requests: rateLimiter.requests,
          limit: rateLimiter.requests,
          windowStart: rateLimiter.windowStart
        } : null,
        circuitBreakerStatus: circuitBreaker ? {
          state: circuitBreaker.state,
          failureCount: circuitBreaker.failureCount,
          nextAttempt: circuitBreaker.nextAttempt
        } : null,
        retryQueue: {
          items: retryQueue.length,
          oldestItem: retryQueue[0]?.nextRetry
        }
      };
    }
    
    return status;
  }

  // Logging and Audit Methods
  logRequest(integrationId, config) {
    logger.debug('API Integration Request', {
      integrationId,
      method: config.method?.toUpperCase(),
      url: config.url,
      timestamp: new Date()
    });
  }

  logResponse(integrationId, response) {
    logger.debug('API Integration Response', {
      integrationId,
      status: response.status,
      timestamp: new Date()
    });
  }

  logError(integrationId, context, error) {
    logger.error(`API Integration Error - ${context}`, {
      integrationId,
      error: error.message,
      status: error.response?.status,
      timestamp: new Date()
    });
  }

  logAudit(action, details) {
    const auditEntry = {
      id: crypto.randomBytes(8).toString('hex'),
      action,
      details,
      timestamp: new Date()
    };

    this.auditLogs.push(auditEntry);
    
    // Keep only last 1000 audit entries
    if (this.auditLogs.length > 1000) {
      this.auditLogs = this.auditLogs.slice(-1000);
    }

    logger.info('API Integration Audit Log', auditEntry);
  }

  getAuditLogs(limit = 100) {
    return this.auditLogs.slice(-limit).reverse();
  }

  // Public API Methods
  listIntegrations() {
    return Array.from(this.integrations.values()).map(integration => ({
      id: integration.id,
      name: integration.name,
      protocol: integration.protocol,
      enabled: integration.enabled,
      status: integration.status,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt
    }));
  }

  getIntegration(integrationId) {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new ApiError(`Integration ${integrationId} not found`, 404);
    }

    return {
      ...integration,
      // Hide sensitive information
      auth: integration.auth ? { type: integration.auth.type } : undefined
    };
  }

  getMetrics() {
    const metrics = {
      totalIntegrations: this.integrations.size,
      activeIntegrations: Array.from(this.integrations.values()).filter(i => i.enabled).length,
      totalRequests: 0,
      cacheHitRate: 0,
      circuitBreakerStatus: {},
      retryQueueSizes: {}
    };

    // Calculate metrics
    for (const [integrationId, rateLimiter] of this.rateLimiters) {
      metrics.totalRequests += rateLimiter.requests;
    }

    for (const [integrationId, breaker] of this.circuitBreakers) {
      metrics.circuitBreakerStatus[integrationId] = breaker.state;
    }

    for (const [integrationId, queue] of this.retryQueues) {
      metrics.retryQueueSizes[integrationId] = queue.length;
    }

    return metrics;
  }

  // Configuration methods
  getAuthTypes() {
    return this.authTypes;
  }

  getProtocolTypes() {
    return this.protocolTypes;
  }

  getDefaultConfig() {
    return { ...this.defaultConfig };
  }
}