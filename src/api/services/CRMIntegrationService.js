import axios from 'axios';
import crypto from 'crypto';
import EventEmitter from 'events';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * CRM Integration Service for Susan AI
 * Supports Salesforce, HubSpot, and custom CRM systems
 * Provides comprehensive CRM functionality with OAuth, rate limiting, and data transformation
 */
export class CRMIntegrationService extends EventEmitter {
  constructor() {
    super();
    
    // Core configuration
    this.integrations = new Map();
    this.clients = new Map();
    this.rateLimiters = new Map();
    this.oauthTokens = new Map();
    this.webhookHandlers = new Map();
    this.dataMappers = new Map();
    this.auditLogs = [];
    this.retryQueues = new Map();
    
    // Rate limiting configurations
    this.rateLimits = {
      salesforce: { requests: 5000, window: 24 * 60 * 60 * 1000 }, // 5000/day
      hubspot: { requests: 10000, window: 24 * 60 * 60 * 1000 }, // 10000/day
      custom: { requests: 1000, window: 60 * 60 * 1000 } // 1000/hour
    };
    
    // Initialize CRM integrations
    this.initializeIntegrations();
    this.setupRateLimiters();
    this.setupWebhookHandlers();
    this.setupDataMappers();
    this.startRetryProcessor();
  }

  initializeIntegrations() {
    // Salesforce Configuration
    this.integrations.set('salesforce', {
      name: 'Salesforce CRM',
      type: 'salesforce',
      enabled: !!(process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET),
      config: {
        clientId: process.env.SALESFORCE_CLIENT_ID,
        clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
        redirectUri: process.env.SALESFORCE_REDIRECT_URI || 'http://localhost:3000/auth/salesforce/callback',
        sandbox: process.env.SALESFORCE_SANDBOX === 'true',
        apiVersion: process.env.SALESFORCE_API_VERSION || 'v58.0',
        loginUrl: process.env.SALESFORCE_SANDBOX === 'true' 
          ? 'https://test.salesforce.com' 
          : 'https://login.salesforce.com'
      },
      endpoints: {
        oauth: '/services/oauth2/token',
        sobjects: '/services/data/v58.0/sobjects',
        query: '/services/data/v58.0/query',
        composite: '/services/data/v58.0/composite'
      },
      scopes: ['api', 'refresh_token', 'offline_access']
    });

    // HubSpot Configuration
    this.integrations.set('hubspot', {
      name: 'HubSpot CRM',
      type: 'hubspot',
      enabled: !!(process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET),
      config: {
        clientId: process.env.HUBSPOT_CLIENT_ID,
        clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
        redirectUri: process.env.HUBSPOT_REDIRECT_URI || 'http://localhost:3000/auth/hubspot/callback',
        portalId: process.env.HUBSPOT_PORTAL_ID,
        apiKey: process.env.HUBSPOT_API_KEY
      },
      endpoints: {
        oauth: 'https://api.hubapi.com/oauth/v1/token',
        contacts: 'https://api.hubapi.com/crm/v3/objects/contacts',
        companies: 'https://api.hubapi.com/crm/v3/objects/companies',
        deals: 'https://api.hubapi.com/crm/v3/objects/deals',
        tickets: 'https://api.hubapi.com/crm/v3/objects/tickets'
      },
      scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 
               'crm.objects.companies.read', 'crm.objects.companies.write',
               'crm.objects.deals.read', 'crm.objects.deals.write']
    });

    // Custom CRM Configuration
    this.integrations.set('custom', {
      name: 'Custom CRM',
      type: 'custom',
      enabled: !!(process.env.CUSTOM_CRM_BASE_URL && process.env.CUSTOM_CRM_API_KEY),
      config: {
        baseUrl: process.env.CUSTOM_CRM_BASE_URL,
        apiKey: process.env.CUSTOM_CRM_API_KEY,
        authType: process.env.CUSTOM_CRM_AUTH_TYPE || 'api_key', // api_key, oauth, bearer
        timeout: parseInt(process.env.CUSTOM_CRM_TIMEOUT) || 30000
      },
      endpoints: {
        contacts: '/api/contacts',
        companies: '/api/companies',
        opportunities: '/api/opportunities',
        activities: '/api/activities'
      }
    });

    this.initializeClients();
  }

  initializeClients() {
    for (const [crmId, integration] of this.integrations) {
      if (integration.enabled) {
        let baseURL = '';
        let headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'Susan-AI-CRM-Integration/1.0'
        };

        switch (crmId) {
          case 'salesforce':
            baseURL = integration.config.loginUrl;
            break;
          case 'hubspot':
            baseURL = 'https://api.hubapi.com';
            if (integration.config.apiKey) {
              headers['Authorization'] = `Bearer ${integration.config.apiKey}`;
            }
            break;
          case 'custom':
            baseURL = integration.config.baseUrl;
            if (integration.config.authType === 'api_key') {
              headers['X-API-Key'] = integration.config.apiKey;
            } else if (integration.config.authType === 'bearer') {
              headers['Authorization'] = `Bearer ${integration.config.apiKey}`;
            }
            break;
        }

        const client = axios.create({
          baseURL,
          timeout: integration.config.timeout || 30000,
          headers
        });

        // Add request interceptor for rate limiting and logging
        client.interceptors.request.use(
          async (config) => {
            await this.checkRateLimit(crmId);
            this.logRequest(crmId, config);
            return config;
          },
          (error) => {
            this.logError(crmId, 'Request Error', error);
            return Promise.reject(error);
          }
        );

        // Add response interceptor for error handling and retry logic
        client.interceptors.response.use(
          (response) => {
            this.logResponse(crmId, response);
            return response;
          },
          async (error) => {
            this.logError(crmId, 'Response Error', error);
            
            // Handle rate limiting
            if (error.response?.status === 429) {
              return this.handleRateLimit(crmId, error.config);
            }
            
            // Handle OAuth token expiration
            if (error.response?.status === 401) {
              return this.handleAuthError(crmId, error.config);
            }
            
            return Promise.reject(error);
          }
        );

        this.clients.set(crmId, client);
        logger.info(`CRM client initialized: ${integration.name}`);
      }
    }
  }

  setupRateLimiters() {
    for (const [crmId, limits] of Object.entries(this.rateLimits)) {
      this.rateLimiters.set(crmId, {
        requests: 0,
        windowStart: Date.now(),
        ...limits
      });
    }
  }

  async checkRateLimit(crmId) {
    const limiter = this.rateLimiters.get(crmId);
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
      throw new ApiError(`Rate limit exceeded for ${crmId}. Wait ${Math.ceil(waitTime / 1000)} seconds.`, 429);
    }

    limiter.requests++;
  }

  async handleRateLimit(crmId, originalConfig) {
    const retryAfter = parseInt(originalConfig.response?.headers['retry-after']) || 60;
    logger.warn(`Rate limited by ${crmId}. Retrying after ${retryAfter} seconds.`);
    
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const client = this.clients.get(crmId);
          const response = await client.request(originalConfig);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      }, retryAfter * 1000);
    });
  }

  async handleAuthError(crmId, originalConfig) {
    try {
      await this.refreshToken(crmId);
      const client = this.clients.get(crmId);
      return client.request(originalConfig);
    } catch (error) {
      logger.error(`Failed to refresh token for ${crmId}`, error);
      throw new ApiError(`Authentication failed for ${crmId}. Please re-authenticate.`, 401);
    }
  }

  setupWebhookHandlers() {
    this.webhookHandlers.set('salesforce', this.handleSalesforceWebhook.bind(this));
    this.webhookHandlers.set('hubspot', this.handleHubSpotWebhook.bind(this));
    this.webhookHandlers.set('custom', this.handleCustomWebhook.bind(this));
  }

  setupDataMappers() {
    // Salesforce data mapper
    this.dataMappers.set('salesforce', {
      contact: {
        toSusan: (sfContact) => ({
          id: sfContact.Id,
          firstName: sfContact.FirstName,
          lastName: sfContact.LastName,
          email: sfContact.Email,
          phone: sfContact.Phone,
          company: sfContact.Account?.Name,
          title: sfContact.Title,
          createdAt: sfContact.CreatedDate,
          updatedAt: sfContact.LastModifiedDate
        }),
        fromSusan: (susanContact) => ({
          FirstName: susanContact.firstName,
          LastName: susanContact.lastName,
          Email: susanContact.email,
          Phone: susanContact.phone,
          Title: susanContact.title
        })
      },
      company: {
        toSusan: (sfAccount) => ({
          id: sfAccount.Id,
          name: sfAccount.Name,
          website: sfAccount.Website,
          phone: sfAccount.Phone,
          industry: sfAccount.Industry,
          employees: sfAccount.NumberOfEmployees,
          createdAt: sfAccount.CreatedDate
        }),
        fromSusan: (susanCompany) => ({
          Name: susanCompany.name,
          Website: susanCompany.website,
          Phone: susanCompany.phone,
          Industry: susanCompany.industry,
          NumberOfEmployees: susanCompany.employees
        })
      }
    });

    // HubSpot data mapper
    this.dataMappers.set('hubspot', {
      contact: {
        toSusan: (hsContact) => ({
          id: hsContact.id,
          firstName: hsContact.properties.firstname,
          lastName: hsContact.properties.lastname,
          email: hsContact.properties.email,
          phone: hsContact.properties.phone,
          company: hsContact.properties.company,
          title: hsContact.properties.jobtitle,
          createdAt: hsContact.createdAt,
          updatedAt: hsContact.updatedAt
        }),
        fromSusan: (susanContact) => ({
          firstname: susanContact.firstName,
          lastname: susanContact.lastName,
          email: susanContact.email,
          phone: susanContact.phone,
          company: susanContact.company,
          jobtitle: susanContact.title
        })
      },
      company: {
        toSusan: (hsCompany) => ({
          id: hsCompany.id,
          name: hsCompany.properties.name,
          website: hsCompany.properties.website,
          phone: hsCompany.properties.phone,
          industry: hsCompany.properties.industry,
          employees: hsCompany.properties.numberofemployees,
          createdAt: hsCompany.createdAt
        }),
        fromSusan: (susanCompany) => ({
          name: susanCompany.name,
          website: susanCompany.website,
          phone: susanCompany.phone,
          industry: susanCompany.industry,
          numberofemployees: susanCompany.employees
        })
      }
    });
  }

  // OAuth Authentication Methods
  async initiateOAuthFlow(crmId, state = null) {
    const integration = this.integrations.get(crmId);
    if (!integration) {
      throw new ApiError(`CRM integration ${crmId} not found`, 404);
    }

    let authUrl = '';
    const stateParam = state || crypto.randomBytes(16).toString('hex');

    switch (crmId) {
      case 'salesforce':
        authUrl = `${integration.config.loginUrl}/services/oauth2/authorize?` +
          `response_type=code&` +
          `client_id=${integration.config.clientId}&` +
          `redirect_uri=${encodeURIComponent(integration.config.redirectUri)}&` +
          `scope=${integration.scopes.join('%20')}&` +
          `state=${stateParam}`;
        break;

      case 'hubspot':
        authUrl = `https://app.hubspot.com/oauth/authorize?` +
          `client_id=${integration.config.clientId}&` +
          `redirect_uri=${encodeURIComponent(integration.config.redirectUri)}&` +
          `scope=${integration.scopes.join('%20')}&` +
          `state=${stateParam}`;
        break;

      default:
        throw new ApiError(`OAuth not supported for ${crmId}`, 400);
    }

    this.logAudit('oauth_initiated', { crmId, state: stateParam });
    return { authUrl, state: stateParam };
  }

  async exchangeCodeForToken(crmId, code, state) {
    const integration = this.integrations.get(crmId);
    if (!integration) {
      throw new ApiError(`CRM integration ${crmId} not found`, 404);
    }

    const client = this.clients.get(crmId);
    let tokenData = null;

    try {
      switch (crmId) {
        case 'salesforce':
          const sfResponse = await client.post(integration.endpoints.oauth, {
            grant_type: 'authorization_code',
            client_id: integration.config.clientId,
            client_secret: integration.config.clientSecret,
            redirect_uri: integration.config.redirectUri,
            code
          }, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          });
          
          tokenData = {
            accessToken: sfResponse.data.access_token,
            refreshToken: sfResponse.data.refresh_token,
            instanceUrl: sfResponse.data.instance_url,
            expiresAt: Date.now() + (sfResponse.data.expires_in * 1000)
          };
          break;

        case 'hubspot':
          const hsResponse = await axios.post(integration.endpoints.oauth, {
            grant_type: 'authorization_code',
            client_id: integration.config.clientId,
            client_secret: integration.config.clientSecret,
            redirect_uri: integration.config.redirectUri,
            code
          });
          
          tokenData = {
            accessToken: hsResponse.data.access_token,
            refreshToken: hsResponse.data.refresh_token,
            expiresAt: Date.now() + (hsResponse.data.expires_in * 1000)
          };
          break;

        default:
          throw new ApiError(`OAuth not supported for ${crmId}`, 400);
      }

      this.oauthTokens.set(crmId, tokenData);
      this.updateClientAuth(crmId, tokenData);
      this.logAudit('oauth_completed', { crmId, state });

      return { success: true, crmId, authenticated: true };

    } catch (error) {
      this.logError(crmId, 'OAuth Exchange Failed', error);
      throw new ApiError(`OAuth token exchange failed for ${crmId}: ${error.message}`, 400);
    }
  }

  async refreshToken(crmId) {
    const tokenData = this.oauthTokens.get(crmId);
    const integration = this.integrations.get(crmId);

    if (!tokenData?.refreshToken || !integration) {
      throw new ApiError(`No refresh token available for ${crmId}`, 401);
    }

    const client = this.clients.get(crmId);

    try {
      let response;
      switch (crmId) {
        case 'salesforce':
          response = await client.post(integration.endpoints.oauth, {
            grant_type: 'refresh_token',
            client_id: integration.config.clientId,
            client_secret: integration.config.clientSecret,
            refresh_token: tokenData.refreshToken
          });
          
          tokenData.accessToken = response.data.access_token;
          tokenData.expiresAt = Date.now() + (response.data.expires_in * 1000);
          break;

        case 'hubspot':
          response = await axios.post(integration.endpoints.oauth, {
            grant_type: 'refresh_token',
            client_id: integration.config.clientId,
            client_secret: integration.config.clientSecret,
            refresh_token: tokenData.refreshToken
          });
          
          tokenData.accessToken = response.data.access_token;
          tokenData.expiresAt = Date.now() + (response.data.expires_in * 1000);
          break;
      }

      this.updateClientAuth(crmId, tokenData);
      this.logAudit('token_refreshed', { crmId });
      
    } catch (error) {
      this.logError(crmId, 'Token Refresh Failed', error);
      throw new ApiError(`Token refresh failed for ${crmId}`, 401);
    }
  }

  updateClientAuth(crmId, tokenData) {
    const client = this.clients.get(crmId);
    if (client && tokenData) {
      client.defaults.headers.Authorization = `Bearer ${tokenData.accessToken}`;
      
      if (crmId === 'salesforce' && tokenData.instanceUrl) {
        client.defaults.baseURL = tokenData.instanceUrl;
      }
    }
  }

  // Contact Management Methods
  async createContact(crmId, contactData) {
    const client = this.clients.get(crmId);
    const integration = this.integrations.get(crmId);
    const mapper = this.dataMappers.get(crmId);

    if (!client || !integration || !mapper) {
      throw new ApiError(`CRM ${crmId} not available`, 400);
    }

    try {
      const mappedData = mapper.contact.fromSusan(contactData);
      let response;

      switch (crmId) {
        case 'salesforce':
          response = await client.post(`${integration.endpoints.sobjects}/Contact`, mappedData);
          break;
        case 'hubspot':
          response = await client.post(integration.endpoints.contacts, {
            properties: mappedData
          });
          break;
        case 'custom':
          response = await client.post(integration.endpoints.contacts, mappedData);
          break;
      }

      const createdContact = this.transformResponseData(crmId, 'contact', response.data);
      this.logAudit('contact_created', { crmId, contactId: createdContact.id });

      return {
        success: true,
        data: createdContact,
        crmId
      };

    } catch (error) {
      this.logError(crmId, 'Contact Creation Failed', error);
      return this.addToRetryQueue(crmId, 'createContact', { contactData });
    }
  }

  async updateContact(crmId, contactId, contactData) {
    const client = this.clients.get(crmId);
    const integration = this.integrations.get(crmId);
    const mapper = this.dataMappers.get(crmId);

    if (!client || !integration || !mapper) {
      throw new ApiError(`CRM ${crmId} not available`, 400);
    }

    try {
      const mappedData = mapper.contact.fromSusan(contactData);
      let response;

      switch (crmId) {
        case 'salesforce':
          response = await client.patch(`${integration.endpoints.sobjects}/Contact/${contactId}`, mappedData);
          break;
        case 'hubspot':
          response = await client.patch(`${integration.endpoints.contacts}/${contactId}`, {
            properties: mappedData
          });
          break;
        case 'custom':
          response = await client.put(`${integration.endpoints.contacts}/${contactId}`, mappedData);
          break;
      }

      this.logAudit('contact_updated', { crmId, contactId });

      return {
        success: true,
        contactId,
        crmId
      };

    } catch (error) {
      this.logError(crmId, 'Contact Update Failed', error);
      return this.addToRetryQueue(crmId, 'updateContact', { contactId, contactData });
    }
  }

  async getContact(crmId, contactId) {
    const client = this.clients.get(crmId);
    const integration = this.integrations.get(crmId);

    if (!client || !integration) {
      throw new ApiError(`CRM ${crmId} not available`, 400);
    }

    try {
      let response;

      switch (crmId) {
        case 'salesforce':
          response = await client.get(`${integration.endpoints.sobjects}/Contact/${contactId}`);
          break;
        case 'hubspot':
          response = await client.get(`${integration.endpoints.contacts}/${contactId}`);
          break;
        case 'custom':
          response = await client.get(`${integration.endpoints.contacts}/${contactId}`);
          break;
      }

      const contact = this.transformResponseData(crmId, 'contact', response.data);
      this.logAudit('contact_retrieved', { crmId, contactId });

      return {
        success: true,
        data: contact,
        crmId
      };

    } catch (error) {
      this.logError(crmId, 'Contact Retrieval Failed', error);
      throw new ApiError(`Failed to retrieve contact from ${crmId}: ${error.message}`, error.response?.status || 500);
    }
  }

  async searchContacts(crmId, searchCriteria) {
    const client = this.clients.get(crmId);
    const integration = this.integrations.get(crmId);

    if (!client || !integration) {
      throw new ApiError(`CRM ${crmId} not available`, 400);
    }

    try {
      let response;
      const { email, name, company, limit = 50 } = searchCriteria;

      switch (crmId) {
        case 'salesforce':
          let soqlQuery = "SELECT Id, FirstName, LastName, Email, Phone, Title FROM Contact WHERE ";
          const conditions = [];
          
          if (email) conditions.push(`Email = '${email}'`);
          if (name) conditions.push(`(FirstName LIKE '%${name}%' OR LastName LIKE '%${name}%')`);
          if (company) conditions.push(`Account.Name LIKE '%${company}%'`);
          
          soqlQuery += conditions.join(' AND ') + ` LIMIT ${limit}`;
          
          response = await client.get(`${integration.endpoints.query}?q=${encodeURIComponent(soqlQuery)}`);
          break;

        case 'hubspot':
          const filters = [];
          if (email) filters.push({ propertyName: 'email', operator: 'EQ', value: email });
          if (name) filters.push({ propertyName: 'firstname', operator: 'CONTAINS_TOKEN', value: name });
          
          response = await client.post(`${integration.endpoints.contacts}/search`, {
            filterGroups: [{ filters }],
            limit
          });
          break;

        case 'custom':
          const params = new URLSearchParams();
          if (email) params.append('email', email);
          if (name) params.append('name', name);
          if (company) params.append('company', company);
          params.append('limit', limit);
          
          response = await client.get(`${integration.endpoints.contacts}/search?${params}`);
          break;
      }

      const contacts = this.transformSearchResults(crmId, 'contact', response.data);
      this.logAudit('contacts_searched', { crmId, resultsCount: contacts.length });

      return {
        success: true,
        data: contacts,
        total: contacts.length,
        crmId
      };

    } catch (error) {
      this.logError(crmId, 'Contact Search Failed', error);
      throw new ApiError(`Failed to search contacts in ${crmId}: ${error.message}`, error.response?.status || 500);
    }
  }

  // Company/Account Management Methods
  async createCompany(crmId, companyData) {
    const client = this.clients.get(crmId);
    const integration = this.integrations.get(crmId);
    const mapper = this.dataMappers.get(crmId);

    if (!client || !integration || !mapper) {
      throw new ApiError(`CRM ${crmId} not available`, 400);
    }

    try {
      const mappedData = mapper.company.fromSusan(companyData);
      let response;

      switch (crmId) {
        case 'salesforce':
          response = await client.post(`${integration.endpoints.sobjects}/Account`, mappedData);
          break;
        case 'hubspot':
          response = await client.post(integration.endpoints.companies, {
            properties: mappedData
          });
          break;
        case 'custom':
          response = await client.post(integration.endpoints.companies, mappedData);
          break;
      }

      const createdCompany = this.transformResponseData(crmId, 'company', response.data);
      this.logAudit('company_created', { crmId, companyId: createdCompany.id });

      return {
        success: true,
        data: createdCompany,
        crmId
      };

    } catch (error) {
      this.logError(crmId, 'Company Creation Failed', error);
      return this.addToRetryQueue(crmId, 'createCompany', { companyData });
    }
  }

  // Webhook Handlers
  async handleSalesforceWebhook(data) {
    try {
      logger.info('Processing Salesforce webhook', { type: data.type, objectId: data.objectId });
      
      this.emit('crm_data_updated', {
        crmId: 'salesforce',
        type: data.type,
        objectId: data.objectId,
        data: data,
        timestamp: new Date()
      });

      return { success: true };
    } catch (error) {
      logger.error('Salesforce webhook processing failed', error);
      return { success: false, error: error.message };
    }
  }

  async handleHubSpotWebhook(data) {
    try {
      logger.info('Processing HubSpot webhook', { type: data.subscriptionType, objectId: data.objectId });
      
      this.emit('crm_data_updated', {
        crmId: 'hubspot',
        type: data.subscriptionType,
        objectId: data.objectId,
        data: data,
        timestamp: new Date()
      });

      return { success: true };
    } catch (error) {
      logger.error('HubSpot webhook processing failed', error);
      return { success: false, error: error.message };
    }
  }

  async handleCustomWebhook(data) {
    try {
      logger.info('Processing Custom CRM webhook', { type: data.event, id: data.id });
      
      this.emit('crm_data_updated', {
        crmId: 'custom',
        type: data.event,
        objectId: data.id,
        data: data,
        timestamp: new Date()
      });

      return { success: true };
    } catch (error) {
      logger.error('Custom CRM webhook processing failed', error);
      return { success: false, error: error.message };
    }
  }

  // Utility Methods
  transformResponseData(crmId, objectType, data) {
    const mapper = this.dataMappers.get(crmId);
    if (mapper && mapper[objectType] && mapper[objectType].toSusan) {
      return mapper[objectType].toSusan(data);
    }
    return data;
  }

  transformSearchResults(crmId, objectType, data) {
    let records = [];
    
    switch (crmId) {
      case 'salesforce':
        records = data.records || [];
        break;
      case 'hubspot':
        records = data.results || [];
        break;
      default:
        records = Array.isArray(data) ? data : data.results || [];
    }

    return records.map(record => this.transformResponseData(crmId, objectType, record));
  }

  addToRetryQueue(crmId, operation, params) {
    if (!this.retryQueues.has(crmId)) {
      this.retryQueues.set(crmId, []);
    }

    const retryItem = {
      id: crypto.randomBytes(8).toString('hex'),
      operation,
      params,
      attempts: 0,
      maxAttempts: 3,
      nextRetry: Date.now() + 60000, // Retry in 1 minute
      crmId
    };

    this.retryQueues.get(crmId).push(retryItem);
    this.logAudit('operation_queued_for_retry', { crmId, operation, retryId: retryItem.id });

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
    }, 30000); // Check every 30 seconds
  }

  async processRetryQueues() {
    for (const [crmId, queue] of this.retryQueues) {
      const now = Date.now();
      const itemsToProcess = queue.filter(item => item.nextRetry <= now);

      for (const item of itemsToProcess) {
        try {
          item.attempts++;
          
          let result;
          switch (item.operation) {
            case 'createContact':
              result = await this.createContact(crmId, item.params.contactData);
              break;
            case 'updateContact':
              result = await this.updateContact(crmId, item.params.contactId, item.params.contactData);
              break;
            case 'createCompany':
              result = await this.createCompany(crmId, item.params.companyData);
              break;
          }

          if (result.success) {
            // Remove from queue
            const index = queue.indexOf(item);
            if (index > -1) queue.splice(index, 1);
            
            this.logAudit('retry_succeeded', { 
              crmId, 
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
              crmId, 
              operation: item.operation, 
              retryId: item.id,
              attempts: item.attempts,
              error: error.message 
            });
          } else {
            // Schedule next retry with exponential backoff
            item.nextRetry = Date.now() + (Math.pow(2, item.attempts) * 60000);
          }
        }
      }
    }
  }

  // Logging and Audit Methods
  logRequest(crmId, config) {
    logger.debug('CRM API Request', {
      crmId,
      method: config.method?.toUpperCase(),
      url: config.url,
      timestamp: new Date()
    });
  }

  logResponse(crmId, response) {
    logger.debug('CRM API Response', {
      crmId,
      status: response.status,
      timestamp: new Date()
    });
  }

  logError(crmId, context, error) {
    logger.error(`CRM Error - ${context}`, {
      crmId,
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

    logger.info('CRM Audit Log', auditEntry);
  }

  // Public API Methods
  getIntegrationStatus() {
    const status = {};
    
    for (const [crmId, integration] of this.integrations) {
      const tokenData = this.oauthTokens.get(crmId);
      const rateLimiter = this.rateLimiters.get(crmId);
      const retryQueue = this.retryQueues.get(crmId) || [];

      status[crmId] = {
        name: integration.name,
        type: integration.type,
        enabled: integration.enabled,
        authenticated: !!tokenData?.accessToken,
        tokenExpiresAt: tokenData?.expiresAt,
        rateLimitStatus: {
          requests: rateLimiter?.requests || 0,
          limit: rateLimiter?.requests || 0,
          windowStart: rateLimiter?.windowStart
        },
        retryQueue: {
          items: retryQueue.length,
          oldestItem: retryQueue[0]?.nextRetry
        }
      };
    }
    
    return status;
  }

  getAuditLogs(limit = 100) {
    return this.auditLogs.slice(-limit).reverse();
  }

  async testConnection(crmId) {
    const client = this.clients.get(crmId);
    const integration = this.integrations.get(crmId);

    if (!client || !integration) {
      return { success: false, error: 'Integration not available' };
    }

    try {
      let response;
      
      switch (crmId) {
        case 'salesforce':
          response = await client.get('/services/data/');
          break;
        case 'hubspot':
          response = await client.get('/crm/v3/objects/contacts?limit=1');
          break;
        case 'custom':
          response = await client.get('/health');
          break;
      }

      return {
        success: true,
        status: response.status,
        crmId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        crmId,
        timestamp: new Date()
      };
    }
  }
}