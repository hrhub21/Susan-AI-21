import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SSOService extends EventEmitter {
  constructor() {
    super();
    this.dataDir = path.join(__dirname, '../../../data/sso');
    this.configDir = path.join(this.dataDir, 'configs');
    this.certificatesDir = path.join(this.dataDir, 'certificates');
    
    // SSO configurations by tenant
    this.ssoConfigs = new Map();
    this.ssoSessions = new Map();
    this.ssoProviders = new Map();
    
    // Supported SSO protocols
    this.supportedProtocols = ['saml2', 'oidc', 'oauth2', 'ldap'];
    
    // Active SAML/OIDC sessions
    this.activeSessions = new Map();
    this.sessionTimeouts = new Map();

    this.ensureDirectories();
    this.loadExistingConfigurations();
    this.setupSessionCleanup();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.dataDir);
    await fs.ensureDir(this.configDir);
    await fs.ensureDir(this.certificatesDir);
  }

  /**
   * Configure SSO for a tenant
   */
  async configureTenantSSO(tenantId, ssoConfig, options = {}) {
    const {
      protocol,
      providerName,
      settings,
      attributes = {},
      autoProvisioning = true,
      defaultRole = 'user',
      metadata = {},
      certificate = null,
      privateKey = null
    } = ssoConfig;

    const { userId, validateConfig = true } = options;

    try {
      if (!this.supportedProtocols.includes(protocol)) {
        throw new Error(`Unsupported SSO protocol: ${protocol}`);
      }

      // Validate configuration based on protocol
      if (validateConfig) {
        await this.validateSSOConfiguration(protocol, settings);
      }

      const configId = this.generateConfigId();
      
      const config = {
        id: configId,
        tenantId,
        protocol,
        providerName,
        settings: this.sanitizeSettings(protocol, settings),
        attributes,
        autoProvisioning,
        defaultRole,
        metadata: {
          ...metadata,
          createdAt: new Date(),
          createdBy: userId,
          lastUpdated: new Date()
        },
        status: 'active',
        security: {
          encryptAssertions: protocol === 'saml2',
          signRequests: protocol === 'saml2',
          validateSignatures: true,
          sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
          refreshTokenRotation: protocol === 'oidc'
        }
      };

      // Handle certificates for SAML
      if (protocol === 'saml2' && (certificate || privateKey)) {
        config.certificates = await this.storeCertificates(configId, {
          certificate,
          privateKey
        });
      }

      // Generate service provider metadata for SAML
      if (protocol === 'saml2') {
        config.serviceProviderMetadata = await this.generateSAMLMetadata(config);
      }

      // Generate OIDC configuration
      if (protocol === 'oidc') {
        config.oidcConfiguration = await this.generateOIDCConfiguration(config);
      }

      this.ssoConfigs.set(configId, config);

      // Save configuration
      await this.saveSSOConfiguration(config);

      logger.info('SSO configuration created', {
        configId,
        tenantId,
        protocol,
        providerName,
        createdBy: userId
      });

      this.emit('sso:configured', { configId, tenantId, config });

      return {
        configId,
        status: 'configured',
        protocol,
        metadata: config.serviceProviderMetadata || config.oidcConfiguration,
        endpoints: this.generateSSOEndpoints(configId, protocol)
      };

    } catch (error) {
      logger.error('Failed to configure SSO', {
        tenantId,
        protocol,
        providerName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Initiate SSO authentication
   */
  async initiateSSOAuthentication(tenantId, options = {}) {
    const {
      protocol,
      returnUrl = '/',
      forceAuth = false,
      userAgent,
      ipAddress
    } = options;

    try {
      // Find SSO configuration for tenant
      const config = this.findTenantSSOConfig(tenantId, protocol);
      if (!config) {
        throw ApiError.notFound(`No SSO configuration found for tenant ${tenantId}`);
      }

      const sessionId = this.generateSessionId();
      const timestamp = new Date();

      // Create SSO session
      const session = {
        id: sessionId,
        tenantId,
        configId: config.id,
        protocol: config.protocol,
        status: 'initiated',
        returnUrl,
        forceAuth,
        metadata: {
          initiatedAt: timestamp,
          userAgent,
          ipAddress,
          expiresAt: new Date(timestamp.getTime() + 10 * 60 * 1000) // 10 minutes
        }
      };

      this.ssoSessions.set(sessionId, session);

      // Generate authentication URL based on protocol
      let authUrl;
      switch (config.protocol) {
        case 'saml2':
          authUrl = await this.generateSAMLAuthRequest(config, session);
          break;
        case 'oidc':
          authUrl = await this.generateOIDCAuthRequest(config, session);
          break;
        case 'oauth2':
          authUrl = await this.generateOAuth2AuthRequest(config, session);
          break;
        default:
          throw new Error(`Protocol ${config.protocol} not supported for initiation`);
      }

      // Set session timeout
      this.setSessionTimeout(sessionId, 10 * 60 * 1000); // 10 minutes

      logger.info('SSO authentication initiated', {
        sessionId,
        tenantId,
        protocol: config.protocol,
        provider: config.providerName
      });

      this.emit('sso:initiated', { sessionId, tenantId, config, session });

      return {
        sessionId,
        authUrl,
        expiresAt: session.metadata.expiresAt
      };

    } catch (error) {
      logger.error('Failed to initiate SSO authentication', {
        tenantId,
        protocol,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle SSO callback/response
   */
  async handleSSOCallback(sessionId, response, options = {}) {
    const { protocol, validateResponse = true } = options;

    try {
      const session = this.ssoSessions.get(sessionId);
      if (!session) {
        throw ApiError.notFound(`SSO session ${sessionId} not found or expired`);
      }

      const config = this.ssoConfigs.get(session.configId);
      if (!config) {
        throw ApiError.notFound(`SSO configuration ${session.configId} not found`);
      }

      // Validate response based on protocol
      let userInfo;
      switch (config.protocol) {
        case 'saml2':
          userInfo = await this.processSAMLResponse(config, response, validateResponse);
          break;
        case 'oidc':
          userInfo = await this.processOIDCResponse(config, response, validateResponse);
          break;
        case 'oauth2':
          userInfo = await this.processOAuth2Response(config, response, validateResponse);
          break;
        default:
          throw new Error(`Protocol ${config.protocol} not supported for callback`);
      }

      // Update session
      session.status = 'authenticated';
      session.userInfo = userInfo;
      session.metadata.authenticatedAt = new Date();

      // Create or link user account
      const user = await this.provisionUser(config, userInfo);

      // Generate application session token
      const appSession = await this.createApplicationSession(session, user);

      // Clean up SSO session
      this.clearSessionTimeout(sessionId);
      this.ssoSessions.delete(sessionId);

      logger.info('SSO authentication completed', {
        sessionId,
        tenantId: session.tenantId,
        userId: user.id,
        protocol: config.protocol,
        provider: config.providerName
      });

      this.emit('sso:authenticated', {
        sessionId,
        tenantId: session.tenantId,
        user,
        userInfo,
        config
      });

      return {
        user,
        session: appSession,
        returnUrl: session.returnUrl
      };

    } catch (error) {
      // Update session with error
      const session = this.ssoSessions.get(sessionId);
      if (session) {
        session.status = 'failed';
        session.error = error.message;
        session.metadata.failedAt = new Date();
      }

      logger.error('SSO callback handling failed', {
        sessionId,
        error: error.message
      });

      this.emit('sso:authentication_failed', {
        sessionId,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Process SAML response
   */
  async processSAMLResponse(config, samlResponse, validate = true) {
    try {
      // Parse SAML response (this would use a proper SAML library)
      const decodedResponse = this.decodeSAMLResponse(samlResponse);
      
      if (validate) {
        await this.validateSAMLResponse(config, decodedResponse);
      }

      // Extract user information from SAML assertions
      const userInfo = this.extractSAMLUserInfo(config, decodedResponse);

      return userInfo;

    } catch (error) {
      logger.error('SAML response processing failed', {
        configId: config.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process OIDC response
   */
  async processOIDCResponse(config, oidcResponse, validate = true) {
    try {
      const { code, state } = oidcResponse;

      // Exchange code for tokens
      const tokenResponse = await this.exchangeOIDCCode(config, code);
      
      if (validate) {
        await this.validateOIDCTokens(config, tokenResponse);
      }

      // Get user information from userinfo endpoint or ID token
      const userInfo = await this.getOIDCUserInfo(config, tokenResponse);

      return userInfo;

    } catch (error) {
      logger.error('OIDC response processing failed', {
        configId: config.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Provision user account from SSO information
   */
  async provisionUser(config, userInfo) {
    try {
      const { tenantId, attributes, autoProvisioning, defaultRole } = config;

      // Map SSO attributes to user properties
      const mappedUser = this.mapSSOAttributes(userInfo, attributes);

      // Check if user already exists
      let user = await this.findExistingUser(tenantId, mappedUser);

      if (user) {
        // Update existing user with latest information
        user = await this.updateUserFromSSO(user, mappedUser);
      } else if (autoProvisioning) {
        // Create new user
        user = await this.createUserFromSSO(tenantId, mappedUser, defaultRole);
      } else {
        throw new Error('User not found and auto-provisioning is disabled');
      }

      // Update last SSO login
      user.lastSSOLogin = new Date();
      user.ssoProvider = config.providerName;

      return user;

    } catch (error) {
      logger.error('User provisioning failed', {
        configId: config.id,
        userInfo,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create application session after successful SSO
   */
  async createApplicationSession(ssoSession, user) {
    const sessionToken = this.generateSessionToken();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

    const appSession = {
      id: sessionToken,
      userId: user.id,
      tenantId: ssoSession.tenantId,
      type: 'sso',
      ssoSessionId: ssoSession.id,
      createdAt: new Date(),
      expiresAt,
      metadata: {
        ssoProvider: ssoSession.configId,
        userAgent: ssoSession.metadata.userAgent,
        ipAddress: ssoSession.metadata.ipAddress
      }
    };

    this.activeSessions.set(sessionToken, appSession);

    // Set session cleanup timeout
    this.setSessionTimeout(sessionToken, 8 * 60 * 60 * 1000);

    return appSession;
  }

  /**
   * Logout user and terminate SSO session
   */
  async logoutSSO(sessionToken, options = {}) {
    const { initiateGlobalLogout = true } = options;

    try {
      const session = this.activeSessions.get(sessionToken);
      if (!session) {
        throw ApiError.notFound('Session not found');
      }

      const config = this.ssoConfigs.get(session.ssoSessionId);

      // Remove application session
      this.activeSessions.delete(sessionToken);
      this.clearSessionTimeout(sessionToken);

      let logoutUrl = null;

      // Initiate global logout if supported and requested
      if (initiateGlobalLogout && config) {
        switch (config.protocol) {
          case 'saml2':
            logoutUrl = await this.generateSAMLLogoutRequest(config, session);
            break;
          case 'oidc':
            logoutUrl = await this.generateOIDCLogoutRequest(config, session);
            break;
        }
      }

      logger.info('SSO logout completed', {
        sessionToken,
        userId: session.userId,
        tenantId: session.tenantId,
        globalLogout: !!logoutUrl
      });

      this.emit('sso:logged_out', {
        sessionToken,
        session,
        globalLogout: !!logoutUrl
      });

      return {
        success: true,
        logoutUrl
      };

    } catch (error) {
      logger.error('SSO logout failed', {
        sessionToken,
        error: error.message
      });
      throw error;
    }
  }

  // Helper methods

  validateSSOConfiguration(protocol, settings) {
    switch (protocol) {
      case 'saml2':
        this.validateSAMLConfiguration(settings);
        break;
      case 'oidc':
        this.validateOIDCConfiguration(settings);
        break;
      case 'oauth2':
        this.validateOAuth2Configuration(settings);
        break;
      case 'ldap':
        this.validateLDAPConfiguration(settings);
        break;
    }
  }

  validateSAMLConfiguration(settings) {
    const required = ['ssoUrl', 'entityId', 'certificate'];
    for (const field of required) {
      if (!settings[field]) {
        throw new Error(`SAML configuration missing required field: ${field}`);
      }
    }
  }

  validateOIDCConfiguration(settings) {
    const required = ['issuer', 'clientId', 'clientSecret'];
    for (const field of required) {
      if (!settings[field]) {
        throw new Error(`OIDC configuration missing required field: ${field}`);
      }
    }
  }

  sanitizeSettings(protocol, settings) {
    // Remove sensitive information from logged settings
    const sanitized = { ...settings };
    
    const sensitiveFields = ['clientSecret', 'privateKey', 'password'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  findTenantSSOConfig(tenantId, protocol = null) {
    for (const config of this.ssoConfigs.values()) {
      if (config.tenantId === tenantId && 
          config.status === 'active' &&
          (!protocol || config.protocol === protocol)) {
        return config;
      }
    }
    return null;
  }

  generateSSOEndpoints(configId, protocol) {
    const baseUrl = process.env.SSO_BASE_URL || 'https://api.susan-ai.com/sso';
    
    const endpoints = {
      initiate: `${baseUrl}/${configId}/initiate`,
      callback: `${baseUrl}/${configId}/callback`,
      metadata: `${baseUrl}/${configId}/metadata`
    };

    if (protocol === 'saml2') {
      endpoints.acs = `${baseUrl}/${configId}/acs`; // Assertion Consumer Service
      endpoints.sls = `${baseUrl}/${configId}/sls`; // Single Logout Service
    }

    return endpoints;
  }

  async generateSAMLAuthRequest(config, session) {
    // Generate SAML authentication request
    const requestId = this.generateRequestId();
    const timestamp = new Date().toISOString();

    // This would use a proper SAML library to generate the request
    const authRequest = {
      id: requestId,
      destination: config.settings.ssoUrl,
      issuer: config.settings.entityId,
      timestamp,
      sessionId: session.id
    };

    // Build and encode SAML request
    const encodedRequest = this.encodeSAMLRequest(authRequest);
    
    // Generate URL with request
    const authUrl = `${config.settings.ssoUrl}?SAMLRequest=${encodeURIComponent(encodedRequest)}&RelayState=${session.id}`;

    return authUrl;
  }

  async generateOIDCAuthRequest(config, session) {
    const { issuer, clientId, redirectUri } = config.settings;
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid profile email',
      state: session.id,
      nonce: this.generateNonce()
    });

    const authUrl = `${issuer}/auth?${params.toString()}`;
    return authUrl;
  }

  mapSSOAttributes(userInfo, attributeMapping) {
    const mapped = {};
    
    for (const [localAttr, ssoAttr] of Object.entries(attributeMapping)) {
      if (userInfo[ssoAttr]) {
        mapped[localAttr] = userInfo[ssoAttr];
      }
    }

    return mapped;
  }

  async findExistingUser(tenantId, userInfo) {
    // Implementation would query user database
    // Return null if user not found
    return null;
  }

  async createUserFromSSO(tenantId, userInfo, defaultRole) {
    // Implementation would create new user in database
    const user = {
      id: this.generateUserId(),
      tenantId,
      email: userInfo.email,
      name: userInfo.name || userInfo.displayName,
      role: defaultRole,
      ssoProvisioned: true,
      createdAt: new Date()
    };

    return user;
  }

  async updateUserFromSSO(user, ssoUserInfo) {
    // Update user with latest SSO information
    return {
      ...user,
      name: ssoUserInfo.name || user.name,
      email: ssoUserInfo.email || user.email,
      lastUpdated: new Date()
    };
  }

  setupSessionCleanup() {
    // Clean up expired sessions every hour
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000); // 1 hour
  }

  cleanupExpiredSessions() {
    const now = new Date();

    // Clean up SSO sessions
    for (const [sessionId, session] of this.ssoSessions) {
      if (session.metadata.expiresAt < now) {
        this.ssoSessions.delete(sessionId);
        this.clearSessionTimeout(sessionId);
      }
    }

    // Clean up application sessions
    for (const [sessionToken, session] of this.activeSessions) {
      if (session.expiresAt < now) {
        this.activeSessions.delete(sessionToken);
        this.clearSessionTimeout(sessionToken);
      }
    }
  }

  setSessionTimeout(sessionId, timeout) {
    const timeoutId = setTimeout(() => {
      this.ssoSessions.delete(sessionId);
      this.activeSessions.delete(sessionId);
      this.sessionTimeouts.delete(sessionId);
    }, timeout);

    this.sessionTimeouts.set(sessionId, timeoutId);
  }

  clearSessionTimeout(sessionId) {
    const timeoutId = this.sessionTimeouts.get(sessionId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.sessionTimeouts.delete(sessionId);
    }
  }

  async saveSSOConfiguration(config) {
    const configFile = path.join(this.configDir, `${config.id}.json`);
    
    // Don't save sensitive information
    const sanitizedConfig = {
      ...config,
      settings: this.sanitizeSettings(config.protocol, config.settings)
    };
    
    await fs.writeJson(configFile, sanitizedConfig, { spaces: 2 });
  }

  async loadExistingConfigurations() {
    try {
      const files = await fs.readdir(this.configDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const configFile = path.join(this.configDir, file);
          const config = await fs.readJson(configFile);
          this.ssoConfigs.set(config.id, config);
        }
      }

      logger.info('Loaded SSO configurations', {
        count: this.ssoConfigs.size
      });

    } catch (error) {
      logger.error('Failed to load SSO configurations', {
        error: error.message
      });
    }
  }

  // ID generators
  generateConfigId() {
    return `sso_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSessionId() {
    return `sso_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateNonce() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Mock implementations for SAML/OIDC processing
  decodeSAMLResponse(response) {
    // Mock implementation - would use proper SAML library
    return { assertions: [], user: {} };
  }

  encodeSAMLRequest(request) {
    // Mock implementation - would use proper SAML library
    return Buffer.from(JSON.stringify(request)).toString('base64');
  }

  extractSAMLUserInfo(config, response) {
    // Mock implementation
    return {
      email: 'user@example.com',
      name: 'Test User',
      groups: ['users']
    };
  }

  async exchangeOIDCCode(config, code) {
    // Mock implementation - would make actual token exchange
    return {
      access_token: 'mock_access_token',
      id_token: 'mock_id_token',
      refresh_token: 'mock_refresh_token'
    };
  }

  async getOIDCUserInfo(config, tokens) {
    // Mock implementation - would call userinfo endpoint
    return {
      sub: '1234567890',
      email: 'user@example.com',
      name: 'Test User',
      groups: ['users']
    };
  }

  // Public API methods
  getTenantSSOConfigs(tenantId) {
    return Array.from(this.ssoConfigs.values())
      .filter(config => config.tenantId === tenantId);
  }

  getSSOStats() {
    return {
      totalConfigs: this.ssoConfigs.size,
      activeSessions: this.activeSessions.size,
      ssoSessions: this.ssoSessions.size,
      protocols: this.supportedProtocols
    };
  }

  async testSSOConfiguration(configId) {
    const config = this.ssoConfigs.get(configId);
    if (!config) {
      throw ApiError.notFound(`SSO configuration ${configId} not found`);
    }

    // Test connectivity and configuration
    const testResult = {
      configId,
      protocol: config.protocol,
      status: 'success',
      tests: []
    };

    try {
      // Protocol-specific tests
      switch (config.protocol) {
        case 'saml2':
          await this.testSAMLConfiguration(config, testResult);
          break;
        case 'oidc':
          await this.testOIDCConfiguration(config, testResult);
          break;
      }

      return testResult;

    } catch (error) {
      testResult.status = 'failed';
      testResult.error = error.message;
      return testResult;
    }
  }

  async testSAMLConfiguration(config, testResult) {
    // Mock SAML configuration tests
    testResult.tests.push({
      name: 'Metadata Validation',
      status: 'passed',
      message: 'SAML metadata is valid'
    });
  }

  async testOIDCConfiguration(config, testResult) {
    // Mock OIDC configuration tests
    testResult.tests.push({
      name: 'Discovery Document',
      status: 'passed',
      message: 'OIDC discovery document accessible'
    });
  }
}