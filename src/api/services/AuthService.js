import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Try to import optional dependencies, fallback to mocks if not available
let bcrypt, speakeasy, qrcode;
try {
  bcrypt = await import('bcrypt');
} catch (error) {
  console.warn('⚠️ bcrypt not installed, using mock implementation');
  bcrypt = {
    hash: async (password, rounds) => `mock_hash_${password}`,
    compare: async (password, hash) => hash === `mock_hash_${password}`,
    hashSync: (password, rounds) => `mock_hash_${password}`
  };
}

try {
  speakeasy = await import('speakeasy');
} catch (error) {
  console.warn('⚠️ speakeasy not installed, MFA features disabled');
  speakeasy = {
    generateSecret: () => ({ base32: 'MOCK_SECRET', otpauth_url: 'otpauth://mock' }),
    totp: {
      verify: () => false
    }
  };
}

try {
  qrcode = await import('qrcode');
} catch (error) {
  console.warn('⚠️ qrcode not installed, QR code generation disabled');
  qrcode = {
    toDataURL: async () => 'data:image/png;base64,mock_qr_code'
  };
}
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { EnterpriseUserManagementService } from './EnterpriseUserManagementService.js';
import { RoleBasedAccessControlService } from './RoleBasedAccessControlService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AuthService extends EventEmitter {
  constructor() {
    super();
    this.dataDir = path.join(__dirname, '../../../data/auth');
    
    // Initialize enterprise services
    this.enterpriseService = new EnterpriseUserManagementService();
    this.rbacService = new RoleBasedAccessControlService();
    this.tokensDir = path.join(this.dataDir, 'tokens');
    this.sessionsDir = path.join(this.dataDir, 'sessions');
    this.securityDir = path.join(this.dataDir, 'security');
    
    // In-memory stores for active sessions and tokens
    this.activeSessions = new Map();
    this.refreshTokens = new Map();
    this.apiKeys = new Map();
    this.mfaSecrets = new Map();
    this.passwordResets = new Map();
    this.loginAttempts = new Map();
    this.securityPolicies = new Map();
    
    // JWT configuration
    this.jwtConfig = {
      accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m',
      refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
      algorithm: 'HS256',
      issuer: 'susan-ai',
      audience: 'susan-ai-api'
    };

    // Security policies
    this.defaultSecurityPolicy = {
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        preventReuse: 5,
        maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
      },
      accountLockout: {
        maxAttempts: 5,
        lockoutDuration: 30 * 60 * 1000, // 30 minutes
        resetTime: 15 * 60 * 1000 // 15 minutes
      },
      sessionPolicy: {
        maxSessions: 5,
        idleTimeout: 2 * 60 * 60 * 1000, // 2 hours
        absoluteTimeout: 8 * 60 * 60 * 1000, // 8 hours
        requireMFA: false,
        allowRememberMe: true
      },
      mfaPolicy: {
        enabled: true,
        required: false,
        backupCodes: 10,
        gracePeriod: 7 * 24 * 60 * 60 * 1000 // 7 days
      }
    };

    this.ensureDirectories();
    this.setupSecurityMonitoring();
    this.loadSecurityPolicies();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.dataDir);
    await fs.ensureDir(this.tokensDir);
    await fs.ensureDir(this.sessionsDir);
    await fs.ensureDir(this.securityDir);
  }

  /**
   * Authenticate user with enhanced security
   */
  async authenticateUser(credentials, options = {}) {
    const {
      email,
      password,
      mfaToken,
      rememberMe = false,
      deviceId,
      userAgent,
      ipAddress
    } = credentials;

    const {
      tenantId,
      requireMFA = false,
      skipRateLimit = false
    } = options;

    const attemptId = this.generateAttemptId();

    try {
      // Rate limiting check
      if (!skipRateLimit) {
        await this.checkRateLimit(email, ipAddress);
      }

      // Find user (this would query your user database)
      const user = await this.findUser(email, tenantId);
      if (!user) {
        await this.recordFailedAttempt(email, ipAddress, 'user_not_found');
        throw ApiError.unauthorized('Invalid credentials');
      }

      // Check account status
      await this.checkAccountStatus(user);

      // Validate password
      const isValidPassword = await this.validatePassword(password, user.passwordHash);
      if (!isValidPassword) {
        await this.recordFailedAttempt(email, ipAddress, 'invalid_password');
        throw ApiError.unauthorized('Invalid credentials');
      }

      // Check if MFA is required
      const securityPolicy = this.getSecurityPolicy(user.tenantId);
      const mfaRequired = requireMFA || securityPolicy.mfaPolicy.required || user.mfaEnabled;

      if (mfaRequired) {
        if (!mfaToken) {
          // Return challenge for MFA
          const challenge = await this.createMFAChallenge(user);
          return {
            status: 'mfa_required',
            challenge,
            attemptId,
            methods: user.mfaMethods || ['totp']
          };
        }

        // Validate MFA token
        const isValidMFA = await this.validateMFAToken(user, mfaToken);
        if (!isValidMFA) {
          await this.recordFailedAttempt(email, ipAddress, 'invalid_mfa');
          throw ApiError.unauthorized('Invalid MFA token');
        }
      }

      // Create session
      const session = await this.createSession(user, {
        rememberMe,
        deviceId,
        userAgent,
        ipAddress,
        mfaVerified: mfaRequired
      });

      // Start RBAC secure session if enterprise user
      if (user.organizationId) {
        try {
          await this.rbacService.startSecureSession(user.id, {
            sessionId: session.id,
            ipAddress,
            userAgent,
            mfaVerified: mfaRequired,
            deviceTrusted: await this.isDeviceTrusted(user.id, deviceId)
          }, {
            cachePermissions: true,
            sessionTimeout: securityPolicy.sessionPolicy.absoluteTimeout
          });
        } catch (rbacError) {
          logger.warn('Failed to start RBAC session', {
            userId: user.id,
            sessionId: session.id,
            error: rbacError.message
          });
        }
      }

      // Clear failed attempts
      this.clearFailedAttempts(email, ipAddress);

      // Log successful authentication
      await this.logAuthEvent('login_success', user, {
        sessionId: session.id,
        ipAddress,
        userAgent,
        mfaUsed: mfaRequired
      });

      // Log enterprise user activity
      if (user.organizationId) {
        try {
          await this.enterpriseService.logActivity({
            type: 'user_login',
            userId: user.id,
            organizationId: user.organizationId,
            metadata: {
              sessionId: session.id,
              mfaUsed: mfaRequired,
              rememberMe,
              deviceId
            },
            ipAddress,
            userAgent
          });
        } catch (activityError) {
          logger.warn('Failed to log enterprise activity', {
            userId: user.id,
            error: activityError.message
          });
        }
      }

      logger.info('User authenticated successfully', {
        userId: user.id,
        email: user.email,
        tenantId: user.tenantId,
        sessionId: session.id,
        mfaUsed: mfaRequired
      });

      this.emit('auth:login', { user, session });

      return {
        status: 'success',
        user: this.sanitizeUser(user),
        session,
        tokens: {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken
        }
      };

    } catch (error) {
      if (error instanceof ApiError) {
        await this.logAuthEvent('login_failed', { email, tenantId }, {
          reason: error.message,
          ipAddress,
          userAgent,
          attemptId
        });
      }

      logger.error('Authentication failed', {
        email,
        tenantId,
        error: error.message,
        ipAddress
      });

      throw error;
    }
  }

  /**
   * Create user session with enhanced security
   */
  async createSession(user, options = {}) {
    const {
      rememberMe = false,
      deviceId,
      userAgent,
      ipAddress,
      mfaVerified = false
    } = options;

    const sessionId = this.generateSessionId();
    const now = new Date();
    const securityPolicy = this.getSecurityPolicy(user.tenantId);

    // Check session limits
    await this.enforceSessionLimits(user.id, securityPolicy.sessionPolicy.maxSessions);

    // Generate tokens
    const accessToken = await this.generateAccessToken(user, {
      sessionId,
      mfaVerified,
      permissions: user.permissions || []
    });

    const refreshToken = await this.generateRefreshToken(user, sessionId);

    // Calculate expiration times
    const accessTokenExpiry = new Date(now.getTime() + this.parseTimespan(this.jwtConfig.accessTokenExpiry));
    const refreshTokenExpiry = rememberMe 
      ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days
      : new Date(now.getTime() + this.parseTimespan(this.jwtConfig.refreshTokenExpiry));

    const sessionExpiry = rememberMe
      ? refreshTokenExpiry
      : new Date(now.getTime() + securityPolicy.sessionPolicy.absoluteTimeout);

    // Create session object
    const session = {
      id: sessionId,
      userId: user.id,
      tenantId: user.tenantId,
      accessToken,
      refreshToken,
      createdAt: now,
      lastActivity: now,
      expiresAt: sessionExpiry,
      device: {
        id: deviceId,
        userAgent,
        ipAddress,
        trusted: await this.isDeviceTrusted(user.id, deviceId)
      },
      security: {
        mfaVerified,
        rememberMe,
        riskScore: await this.calculateSessionRiskScore(user, options),
        ipAddressHistory: [ipAddress],
        deviceFingerprint: this.generateDeviceFingerprint(userAgent, ipAddress)
      },
      metadata: {
        loginMethod: 'password',
        sessionVersion: '2.0'
      }
    };

    // Store session
    this.activeSessions.set(sessionId, session);
    this.refreshTokens.set(refreshToken, {
      sessionId,
      userId: user.id,
      expiresAt: refreshTokenExpiry
    });

    // Save session to disk
    await this.saveSession(session);

    // Set up session monitoring
    this.monitorSession(sessionId);

    return session;
  }

  /**
   * Validate and refresh access token
   */
  async refreshAccessToken(refreshToken, options = {}) {
    const { ipAddress, userAgent } = options;

    try {
      // Validate refresh token
      const tokenData = this.refreshTokens.get(refreshToken);
      if (!tokenData) {
        throw ApiError.unauthorized('Invalid refresh token');
      }

      if (tokenData.expiresAt < new Date()) {
        this.refreshTokens.delete(refreshToken);
        throw ApiError.unauthorized('Refresh token expired');
      }

      // Get session
      const session = this.activeSessions.get(tokenData.sessionId);
      if (!session) {
        this.refreshTokens.delete(refreshToken);
        throw ApiError.unauthorized('Session not found');
      }

      // Security checks
      await this.validateSessionSecurity(session, { ipAddress, userAgent });

      // Get user
      const user = await this.findUserById(session.userId);
      if (!user) {
        await this.invalidateSession(session.id);
        throw ApiError.unauthorized('User not found');
      }

      // Generate new access token
      const newAccessToken = await this.generateAccessToken(user, {
        sessionId: session.id,
        mfaVerified: session.security.mfaVerified,
        permissions: user.permissions || []
      });

      // Update session
      session.accessToken = newAccessToken;
      session.lastActivity = new Date();

      // Update security monitoring
      if (ipAddress && !session.security.ipAddressHistory.includes(ipAddress)) {
        session.security.ipAddressHistory.push(ipAddress);
        session.security.riskScore = await this.updateSessionRiskScore(session, { ipAddress });
      }

      await this.saveSession(session);

      logger.info('Access token refreshed', {
        sessionId: session.id,
        userId: user.id,
        newRiskScore: session.security.riskScore
      });

      return {
        accessToken: newAccessToken,
        refreshToken, // Keep same refresh token
        expiresAt: new Date(Date.now() + this.parseTimespan(this.jwtConfig.accessTokenExpiry))
      };

    } catch (error) {
      logger.error('Token refresh failed', {
        error: error.message,
        ipAddress
      });
      throw error;
    }
  }

  /**
   * Setup Multi-Factor Authentication
   */
  async setupMFA(userId, options = {}) {
    const { method = 'totp', label } = options;

    try {
      const user = await this.findUserById(userId);
      if (!user) {
        throw ApiError.notFound('User not found');
      }

      let mfaSetup;

      switch (method) {
        case 'totp':
          mfaSetup = await this.setupTOTP(user, label);
          break;
        case 'sms':
          mfaSetup = await this.setupSMS(user);
          break;
        case 'email':
          mfaSetup = await this.setupEmailMFA(user);
          break;
        default:
          throw ApiError.badRequest(`Unsupported MFA method: ${method}`);
      }

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Store MFA configuration (not activated until verified)
      const mfaConfig = {
        userId,
        method,
        secret: mfaSetup.secret,
        backupCodes: backupCodes.map(code => bcrypt.hashSync(code, 10)),
        verified: false,
        createdAt: new Date()
      };

      this.mfaSecrets.set(`${userId}:${method}`, mfaConfig);

      logger.info('MFA setup initiated', {
        userId,
        method,
        label
      });

      return {
        method,
        setupData: mfaSetup.setupData,
        backupCodes, // Show backup codes to user once
        verificationRequired: true
      };

    } catch (error) {
      logger.error('MFA setup failed', {
        userId,
        method,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Verify and activate MFA
   */
  async verifyMFA(userId, method, verificationCode) {
    try {
      const mfaConfig = this.mfaSecrets.get(`${userId}:${method}`);
      if (!mfaConfig) {
        throw ApiError.notFound('MFA setup not found');
      }

      if (mfaConfig.verified) {
        throw ApiError.badRequest('MFA already verified');
      }

      // Verify the code
      let isValid = false;
      switch (method) {
        case 'totp':
          isValid = speakeasy.totp.verify({
            secret: mfaConfig.secret,
            encoding: 'base32',
            token: verificationCode
          });
          break;
        case 'sms':
        case 'email':
          // For SMS/Email, verification code would be sent and stored temporarily
          isValid = await this.verifyTemporaryCode(userId, method, verificationCode);
          break;
      }

      if (!isValid) {
        throw ApiError.unauthorized('Invalid verification code');
      }

      // Activate MFA
      mfaConfig.verified = true;
      mfaConfig.activatedAt = new Date();

      // Update user MFA status
      await this.updateUserMFAStatus(userId, method, true);

      logger.info('MFA verified and activated', {
        userId,
        method
      });

      this.emit('auth:mfa_activated', { userId, method });

      return {
        status: 'activated',
        method,
        message: 'MFA has been successfully activated'
      };

    } catch (error) {
      logger.error('MFA verification failed', {
        userId,
        method,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate API key with scoped permissions
   */
  async generateAPIKey(options = {}) {
    const {
      userId,
      tenantId,
      name,
      permissions = [],
      expiresAt,
      ipRestrictions = [],
      rateLimit
    } = options;

    try {
      const keyId = this.generateKeyId();
      const keySecret = this.generateKeySecret();
      const keyHash = await bcrypt.hash(keySecret, 12);

      const apiKey = {
        id: keyId,
        userId,
        tenantId,
        name,
        keyHash,
        permissions,
        restrictions: {
          ipAddresses: ipRestrictions,
          rateLimit
        },
        usage: {
          totalRequests: 0,
          lastUsed: null,
          createdAt: new Date()
        },
        expiresAt,
        status: 'active'
      };

      this.apiKeys.set(keyId, apiKey);

      // Save API key to disk
      await this.saveAPIKey(apiKey);

      logger.info('API key generated', {
        keyId,
        userId,
        tenantId,
        name,
        permissions: permissions.length
      });

      this.emit('auth:api_key_created', { keyId, userId, tenantId });

      return {
        keyId,
        keySecret, // Only returned once
        permissions,
        expiresAt
      };

    } catch (error) {
      logger.error('API key generation failed', {
        userId,
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate API key
   */
  async validateAPIKey(keyId, keySecret, options = {}) {
    const { ipAddress, requiredPermissions = [] } = options;

    try {
      const apiKey = this.apiKeys.get(keyId);
      if (!apiKey) {
        throw ApiError.unauthorized('Invalid API key');
      }

      if (apiKey.status !== 'active') {
        throw ApiError.unauthorized('API key is not active');
      }

      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        throw ApiError.unauthorized('API key has expired');
      }

      // Validate key secret
      const isValidSecret = await bcrypt.compare(keySecret, apiKey.keyHash);
      if (!isValidSecret) {
        throw ApiError.unauthorized('Invalid API key secret');
      }

      // Check IP restrictions
      if (apiKey.restrictions.ipAddresses.length > 0) {
        if (!ipAddress || !apiKey.restrictions.ipAddresses.includes(ipAddress)) {
          throw ApiError.forbidden('IP address not allowed for this API key');
        }
      }

      // Check permissions
      if (requiredPermissions.length > 0) {
        const hasPermissions = requiredPermissions.every(permission => 
          apiKey.permissions.includes(permission) || apiKey.permissions.includes('*')
        );
        
        if (!hasPermissions) {
          throw ApiError.forbidden('Insufficient permissions');
        }
      }

      // Update usage
      apiKey.usage.totalRequests++;
      apiKey.usage.lastUsed = new Date();

      logger.debug('API key validated', {
        keyId,
        userId: apiKey.userId,
        tenantId: apiKey.tenantId
      });

      return {
        keyId,
        userId: apiKey.userId,
        tenantId: apiKey.tenantId,
        permissions: apiKey.permissions
      };

    } catch (error) {
      logger.error('API key validation failed', {
        keyId,
        error: error.message,
        ipAddress
      });
      throw error;
    }
  }

  /**
   * Password reset flow
   */
  async initiatePasswordReset(email, tenantId, options = {}) {
    const { ipAddress, userAgent } = options;

    try {
      const user = await this.findUser(email, tenantId);
      if (!user) {
        // Don't reveal if user exists, but log attempt
        logger.warn('Password reset attempted for non-existent user', {
          email,
          tenantId,
          ipAddress
        });
        return { status: 'sent' }; // Always return success
      }

      const resetToken = this.generateResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      const resetRequest = {
        userId: user.id,
        email: user.email,
        token: resetToken,
        expiresAt,
        ipAddress,
        userAgent,
        used: false,
        createdAt: new Date()
      };

      this.passwordResets.set(resetToken, resetRequest);

      // Send reset email (implementation would send actual email)
      await this.sendPasswordResetEmail(user, resetToken);

      // Log reset initiation
      await this.logAuthEvent('password_reset_requested', user, {
        ipAddress,
        userAgent
      });

      logger.info('Password reset initiated', {
        userId: user.id,
        email: user.email,
        ipAddress
      });

      return { status: 'sent' };

    } catch (error) {
      logger.error('Password reset initiation failed', {
        email,
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Complete password reset
   */
  async resetPassword(resetToken, newPassword, options = {}) {
    const { ipAddress, userAgent } = options;

    try {
      const resetRequest = this.passwordResets.get(resetToken);
      if (!resetRequest) {
        throw ApiError.badRequest('Invalid or expired reset token');
      }

      if (resetRequest.expiresAt < new Date()) {
        this.passwordResets.delete(resetToken);
        throw ApiError.badRequest('Reset token has expired');
      }

      if (resetRequest.used) {
        throw ApiError.badRequest('Reset token has already been used');
      }

      const user = await this.findUserById(resetRequest.userId);
      if (!user) {
        throw ApiError.badRequest('User not found');
      }

      // Validate new password
      await this.validatePasswordPolicy(newPassword, user);

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update user password
      await this.updateUserPassword(user.id, passwordHash);

      // Mark reset token as used
      resetRequest.used = true;
      resetRequest.usedAt = new Date();

      // Invalidate all user sessions for security
      await this.invalidateAllUserSessions(user.id);

      // Log password reset completion
      await this.logAuthEvent('password_reset_completed', user, {
        ipAddress,
        userAgent
      });

      logger.info('Password reset completed', {
        userId: user.id,
        email: user.email,
        ipAddress
      });

      this.emit('auth:password_reset', { user });

      return { status: 'completed' };

    } catch (error) {
      logger.error('Password reset failed', {
        resetToken,
        error: error.message
      });
      throw error;
    }
  }

  // Helper methods

  async validatePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  async validatePasswordPolicy(password, user) {
    const policy = this.getSecurityPolicy(user.tenantId).passwordPolicy;

    if (password.length < policy.minLength) {
      throw ApiError.badRequest(`Password must be at least ${policy.minLength} characters long`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      throw ApiError.badRequest('Password must contain at least one uppercase letter');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      throw ApiError.badRequest('Password must contain at least one lowercase letter');
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      throw ApiError.badRequest('Password must contain at least one number');
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*]/.test(password)) {
      throw ApiError.badRequest('Password must contain at least one special character');
    }

    // Check password history (implementation would check against stored hashes)
    if (policy.preventReuse > 0) {
      const isReused = await this.checkPasswordReuse(user.id, password, policy.preventReuse);
      if (isReused) {
        throw ApiError.badRequest(`Password cannot be one of the last ${policy.preventReuse} passwords`);
      }
    }
  }

  async generateAccessToken(user, options = {}) {
    const { sessionId, mfaVerified, permissions } = options;

    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      permissions,
      sessionId,
      mfaVerified,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor((Date.now() + this.parseTimespan(this.jwtConfig.accessTokenExpiry)) / 1000),
      iss: this.jwtConfig.issuer,
      aud: this.jwtConfig.audience
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      algorithm: this.jwtConfig.algorithm
    });
  }

  async generateRefreshToken(user, sessionId) {
    const payload = {
      sub: user.id,
      sessionId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor((Date.now() + this.parseTimespan(this.jwtConfig.refreshTokenExpiry)) / 1000),
      iss: this.jwtConfig.issuer,
      aud: this.jwtConfig.audience
    };

    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
      algorithm: this.jwtConfig.algorithm
    });
  }

  async setupTOTP(user, label) {
    const secret = speakeasy.generateSecret({
      name: label || `Susan AI (${user.email})`,
      issuer: 'Susan AI',
      length: 32
    });

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      setupData: {
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32,
        otpauthUrl: secret.otpauth_url
      }
    };
  }

  generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  async checkRateLimit(identifier, ipAddress) {
    const key = `${identifier}:${ipAddress}`;
    const attempts = this.loginAttempts.get(key) || { count: 0, firstAttempt: new Date() };

    const policy = this.defaultSecurityPolicy.accountLockout;
    const timeSinceFirst = Date.now() - attempts.firstAttempt.getTime();

    if (timeSinceFirst > policy.resetTime) {
      // Reset attempts after reset time
      this.loginAttempts.delete(key);
      return;
    }

    if (attempts.count >= policy.maxAttempts) {
      const timeRemaining = policy.lockoutDuration - timeSinceFirst;
      if (timeRemaining > 0) {
        throw ApiError.tooManyRequests(`Account locked. Try again in ${Math.ceil(timeRemaining / 60000)} minutes`);
      } else {
        // Lockout period expired
        this.loginAttempts.delete(key);
      }
    }
  }

  async recordFailedAttempt(identifier, ipAddress, reason) {
    const key = `${identifier}:${ipAddress}`;
    const attempts = this.loginAttempts.get(key) || { count: 0, firstAttempt: new Date() };

    attempts.count++;
    attempts.lastAttempt = new Date();
    attempts.reason = reason;

    this.loginAttempts.set(key, attempts);

    // Log security event
    await this.logAuthEvent('login_failed', { email: identifier }, {
      ipAddress,
      reason,
      attemptCount: attempts.count
    });
  }

  clearFailedAttempts(identifier, ipAddress) {
    const key = `${identifier}:${ipAddress}`;
    this.loginAttempts.delete(key);
  }

  getSecurityPolicy(tenantId) {
    return this.securityPolicies.get(tenantId) || this.defaultSecurityPolicy;
  }

  sanitizeUser(user) {
    const { passwordHash, mfaSecret, ...sanitized } = user;
    return sanitized;
  }

  parseTimespan(timespan) {
    const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const match = timespan.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error('Invalid timespan format');
    return parseInt(match[1]) * units[match[2]];
  }

  setupSecurityMonitoring() {
    // Clean up expired sessions every hour
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);

    // Monitor suspicious activities every 5 minutes
    setInterval(() => {
      this.monitorSuspiciousActivities();
    }, 5 * 60 * 1000);
  }

  async loadSecurityPolicies() {
    // Load tenant-specific security policies
    try {
      const policiesFile = path.join(this.securityDir, 'policies.json');
      if (await fs.pathExists(policiesFile)) {
        const policies = await fs.readJson(policiesFile);
        Object.entries(policies).forEach(([tenantId, policy]) => {
          this.securityPolicies.set(tenantId, { ...this.defaultSecurityPolicy, ...policy });
        });
      }
    } catch (error) {
      logger.error('Failed to load security policies', { error: error.message });
    }
  }

  // ID generators
  generateSessionId() {
    return `sess_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  }

  generateAttemptId() {
    return `att_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateKeyId() {
    return `key_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateKeySecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Integration methods with enterprise services
  async findUser(email, tenantId) {
    try {
      // Try to find user in enterprise system first
      const users = Array.from(this.enterpriseService.users.values());
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && 
                                   (!tenantId || u.tenantId === tenantId));
      
      if (user) {
        return {
          ...user,
          passwordHash: user.passwordHash,
          permissions: await this.rbacService.getUserPermissions(user.id),
          mfaEnabled: user.security?.mfaEnabled || false,
          mfaMethods: user.security?.mfaMethods || []
        };
      }
      
      // Fallback to legacy user lookup
      return null;
    } catch (error) {
      logger.error('Failed to find user', { email, tenantId, error: error.message });
      return null;
    }
  }

  async findUserById(userId) {
    try {
      // Try to find user in enterprise system first
      const user = this.enterpriseService.getUser(userId);
      
      if (user) {
        return {
          ...user,
          permissions: await this.rbacService.getUserPermissions(userId),
          mfaEnabled: user.security?.mfaEnabled || false,
          mfaMethods: user.security?.mfaMethods || []
        };
      }
      
      // Fallback to legacy user lookup
      return null;
    } catch (error) {
      logger.error('Failed to find user by ID', { userId, error: error.message });
      return null;
    }
  }

  async checkAccountStatus(user) {
    // Check if account is locked, suspended, etc.
    if (user.status === 'locked') {
      throw ApiError.forbidden('Account is locked');
    }
    if (user.status === 'suspended') {
      throw ApiError.forbidden('Account is suspended');
    }
  }

  async logAuthEvent(event, user, metadata) {
    // Log authentication events for audit trail
    logger.info(`Auth event: ${event}`, {
      userId: user.id || user.email,
      tenantId: user.tenantId,
      ...metadata
    });
  }

  // Public API methods
  async validateJWT(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: [this.jwtConfig.algorithm],
        issuer: this.jwtConfig.issuer,
        audience: this.jwtConfig.audience
      });

      // Check if session is still active
      if (decoded.sessionId) {
        const session = this.activeSessions.get(decoded.sessionId);
        if (!session || session.expiresAt < new Date()) {
          throw new Error('Session expired or invalid');
        }
      }

      return decoded;
    } catch (error) {
      throw ApiError.unauthorized('Invalid or expired token');
    }
  }

  async logout(sessionId) {
    await this.invalidateSession(sessionId);
    this.emit('auth:logout', { sessionId });
    return { status: 'logged_out' };
  }

  async invalidateSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      this.activeSessions.delete(sessionId);
      this.refreshTokens.delete(session.refreshToken);
      
      // Remove session file
      const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
      await fs.remove(sessionFile).catch(() => {});

      logger.info('Session invalidated', { sessionId, userId: session.userId });
    }
  }

  getAuthStats() {
    return {
      activeSessions: this.activeSessions.size,
      activeAPIKeys: this.apiKeys.size,
      pendingResets: this.passwordResets.size,
      mfaConfigs: this.mfaSecrets.size,
      failedAttempts: this.loginAttempts.size
    };
  }
}