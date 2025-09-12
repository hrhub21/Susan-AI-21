import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TenantService extends EventEmitter {
  constructor() {
    super();
    this.dataDir = path.join(__dirname, '../../../data/tenants');
    this.configDir = path.join(this.dataDir, 'configs');
    this.isolationDir = path.join(this.dataDir, 'isolation');
    
    // In-memory tenant registry
    this.tenants = new Map();
    this.tenantConfigs = new Map();
    this.tenantLimits = new Map();
    this.tenantUsage = new Map();
    this.tenantIsolation = new Map();
    
    // Default tenant plans
    this.plans = new Map([
      ['starter', {
        id: 'starter',
        name: 'Starter Plan',
        limits: {
          requests: 1000,
          tokens: 100000,
          storage: 1024 * 1024 * 100, // 100MB
          users: 5,
          conversations: 50,
          plugins: 3,
          collaborators: 2
        },
        features: ['basic_ai', 'conversations', 'voice_basic'],
        price: { amount: 29, currency: 'USD', period: 'month' }
      }],
      ['professional', {
        id: 'professional',
        name: 'Professional Plan',
        limits: {
          requests: 10000,
          tokens: 1000000,
          storage: 1024 * 1024 * 1024, // 1GB
          users: 25,
          conversations: 500,
          plugins: 10,
          collaborators: 10
        },
        features: ['advanced_ai', 'conversations', 'voice_advanced', 'multimodal', 'analytics'],
        price: { amount: 99, currency: 'USD', period: 'month' }
      }],
      ['enterprise', {
        id: 'enterprise',
        name: 'Enterprise Plan',
        limits: {
          requests: 100000,
          tokens: 10000000,
          storage: 1024 * 1024 * 1024 * 10, // 10GB
          users: 500,
          conversations: -1, // unlimited
          plugins: -1, // unlimited
          collaborators: -1 // unlimited
        },
        features: ['enterprise_ai', 'conversations', 'voice_enterprise', 'multimodal', 'analytics', 'sso', 'audit_logs', 'priority_support'],
        price: { amount: 499, currency: 'USD', period: 'month' }
      }]
    ]);

    this.ensureDirectories();
    this.loadExistingTenants();
    this.setupUsageTracking();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.dataDir);
    await fs.ensureDir(this.configDir);
    await fs.ensureDir(this.isolationDir);
  }

  /**
   * Create a new tenant
   */
  async createTenant(tenantData, options = {}) {
    const {
      name,
      domain,
      plan = 'starter',
      adminUser,
      settings = {},
      metadata = {},
      customLimits = null
    } = tenantData;

    const {
      autoActivate = true,
      sendWelcome = true,
      provisionResources = true
    } = options;

    const tenantId = this.generateTenantId();

    try {
      // Validate plan
      const planConfig = this.plans.get(plan);
      if (!planConfig) {
        throw new Error(`Invalid plan: ${plan}`);
      }

      // Check domain uniqueness
      if (domain && this.isDomainTaken(domain)) {
        throw new Error(`Domain ${domain} is already taken`);
      }

      // Create tenant record
      const tenant = {
        id: tenantId,
        name,
        domain,
        plan,
        status: autoActivate ? 'active' : 'pending',
        adminUser,
        settings: {
          timezone: 'UTC',
          language: 'en',
          theme: 'default',
          features: planConfig.features,
          ...settings
        },
        metadata: {
          ...metadata,
          createdAt: new Date(),
          createdBy: adminUser?.id,
          lastUpdated: new Date()
        },
        limits: customLimits || planConfig.limits,
        usage: this.initializeUsageTracking(),
        billing: {
          plan,
          status: 'trial',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
          lastBillingDate: null,
          nextBillingDate: null
        },
        security: {
          isolation: 'namespace',
          encryption: true,
          auditLogging: planConfig.features.includes('audit_logs'),
          ssoEnabled: planConfig.features.includes('sso'),
          allowedIPs: [],
          sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
          mfaRequired: false
        }
      };

      // Store tenant
      this.tenants.set(tenantId, tenant);

      // Create tenant configuration
      await this.createTenantConfiguration(tenantId, tenant);

      // Set up resource isolation
      if (provisionResources) {
        await this.setupTenantIsolation(tenantId, tenant);
      }

      // Initialize usage tracking
      this.tenantUsage.set(tenantId, this.initializeUsageTracking());

      // Save to disk
      await this.saveTenant(tenant);

      // Send welcome email if requested
      if (sendWelcome && adminUser?.email) {
        await this.sendWelcomeEmail(tenant, adminUser);
      }

      logger.info('Tenant created', {
        tenantId,
        name,
        domain,
        plan,
        adminUserId: adminUser?.id,
        autoActivate
      });

      this.emit('tenant:created', { tenantId, tenant });

      return {
        tenantId,
        status: tenant.status,
        plan,
        trialEndsAt: tenant.billing.trialEndsAt,
        limits: tenant.limits,
        features: tenant.settings.features
      };

    } catch (error) {
      logger.error('Failed to create tenant', {
        name,
        domain,
        plan,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get tenant information
   */
  async getTenant(tenantId, options = {}) {
    const { includeUsage = false, includeConfig = false } = options;

    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw ApiError.notFound(`Tenant ${tenantId} not found`);
    }

    const result = {
      ...tenant,
      currentUsage: includeUsage ? this.getCurrentUsage(tenantId) : undefined,
      configuration: includeConfig ? this.tenantConfigs.get(tenantId) : undefined
    };

    return result;
  }

  /**
   * Update tenant configuration
   */
  async updateTenant(tenantId, updates, options = {}) {
    const { userId, validateLimits = true } = options;

    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw ApiError.notFound(`Tenant ${tenantId} not found`);
    }

    try {
      // Validate plan change if requested
      if (updates.plan && updates.plan !== tenant.plan) {
        await this.validatePlanChange(tenantId, updates.plan);
      }

      // Update tenant data
      const updatedTenant = {
        ...tenant,
        ...updates,
        metadata: {
          ...tenant.metadata,
          ...updates.metadata,
          lastUpdated: new Date(),
          updatedBy: userId
        }
      };

      // Update limits if plan changed
      if (updates.plan) {
        const newPlan = this.plans.get(updates.plan);
        updatedTenant.limits = updates.customLimits || newPlan.limits;
        updatedTenant.settings.features = newPlan.features;
      }

      // Validate usage against new limits
      if (validateLimits && updates.limits) {
        await this.validateUsageAgainstLimits(tenantId, updates.limits);
      }

      this.tenants.set(tenantId, updatedTenant);

      // Update configuration
      await this.updateTenantConfiguration(tenantId, updatedTenant);

      // Save to disk
      await this.saveTenant(updatedTenant);

      logger.info('Tenant updated', {
        tenantId,
        updates: Object.keys(updates),
        updatedBy: userId
      });

      this.emit('tenant:updated', { tenantId, tenant: updatedTenant, updates });

      return updatedTenant;

    } catch (error) {
      logger.error('Failed to update tenant', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Activate or deactivate tenant
   */
  async setTenantStatus(tenantId, status, options = {}) {
    const { reason, userId } = options;

    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw ApiError.notFound(`Tenant ${tenantId} not found`);
    }

    const previousStatus = tenant.status;
    tenant.status = status;
    tenant.metadata.lastUpdated = new Date();
    tenant.metadata.statusChangedBy = userId;
    tenant.metadata.statusChangeReason = reason;

    // Handle status-specific actions
    switch (status) {
      case 'suspended':
        await this.suspendTenantResources(tenantId);
        break;
      case 'active':
        if (previousStatus === 'suspended') {
          await this.restoreTenantResources(tenantId);
        }
        break;
      case 'deleted':
        await this.deleteTenantResources(tenantId);
        break;
    }

    await this.saveTenant(tenant);

    logger.info('Tenant status changed', {
      tenantId,
      previousStatus,
      newStatus: status,
      reason,
      changedBy: userId
    });

    this.emit('tenant:status_changed', { tenantId, tenant, previousStatus, newStatus: status });

    return { tenantId, status, previousStatus };
  }

  /**
   * Track tenant resource usage
   */
  async trackUsage(tenantId, usage) {
    const {
      type, // 'requests', 'tokens', 'storage', 'users'
      amount,
      metadata = {},
      timestamp = new Date()
    } = usage;

    try {
      let tenantUsage = this.tenantUsage.get(tenantId);
      if (!tenantUsage) {
        tenantUsage = this.initializeUsageTracking();
        this.tenantUsage.set(tenantId, tenantUsage);
      }

      // Update current usage
      if (!tenantUsage.current[type]) {
        tenantUsage.current[type] = 0;
      }
      tenantUsage.current[type] += amount;

      // Update daily usage
      const today = timestamp.toISOString().split('T')[0];
      if (!tenantUsage.daily[today]) {
        tenantUsage.daily[today] = {};
      }
      if (!tenantUsage.daily[today][type]) {
        tenantUsage.daily[today][type] = 0;
      }
      tenantUsage.daily[today][type] += amount;

      // Update total usage
      if (!tenantUsage.total[type]) {
        tenantUsage.total[type] = 0;
      }
      tenantUsage.total[type] += amount;

      tenantUsage.lastUpdated = timestamp;

      // Check limits
      await this.checkUsageLimits(tenantId, type, tenantUsage.current[type]);

      // Emit usage event
      this.emit('tenant:usage', {
        tenantId,
        type,
        amount,
        currentUsage: tenantUsage.current[type],
        metadata
      });

    } catch (error) {
      logger.error('Failed to track tenant usage', {
        tenantId,
        type,
        amount,
        error: error.message
      });
    }
  }

  /**
   * Check if tenant has exceeded limits
   */
  async checkUsageLimits(tenantId, type, currentUsage) {
    const tenant = this.tenants.get(tenantId);
    if (!tenant || !tenant.limits) return;

    const limit = tenant.limits[type];
    if (limit === -1) return; // Unlimited

    const usagePercentage = (currentUsage / limit) * 100;

    // Warning thresholds
    if (usagePercentage >= 90) {
      await this.sendUsageWarning(tenantId, type, usagePercentage, 'critical');
    } else if (usagePercentage >= 80) {
      await this.sendUsageWarning(tenantId, type, usagePercentage, 'warning');
    }

    // Hard limit enforcement
    if (currentUsage >= limit) {
      await this.enforceLimitExceeded(tenantId, type, currentUsage, limit);
    }
  }

  /**
   * Set up tenant resource isolation
   */
  async setupTenantIsolation(tenantId, tenant) {
    try {
      const isolation = {
        id: tenantId,
        type: tenant.security.isolation,
        namespace: `tenant_${tenantId}`,
        resourceLimits: tenant.limits,
        networkIsolation: true,
        dataIsolation: true,
        computeIsolation: tenant.plan === 'enterprise',
        createdAt: new Date()
      };

      // Create isolated directories
      const tenantDir = path.join(this.isolationDir, tenantId);
      await fs.ensureDir(tenantDir);
      await fs.ensureDir(path.join(tenantDir, 'data'));
      await fs.ensureDir(path.join(tenantDir, 'logs'));
      await fs.ensureDir(path.join(tenantDir, 'temp'));

      // Set up database isolation (schema/namespace)
      await this.setupDatabaseIsolation(tenantId, isolation);

      // Set up file storage isolation
      await this.setupStorageIsolation(tenantId, isolation);

      this.tenantIsolation.set(tenantId, isolation);

      logger.info('Tenant isolation set up', {
        tenantId,
        isolationType: isolation.type,
        namespace: isolation.namespace
      });

    } catch (error) {
      logger.error('Failed to set up tenant isolation', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Migrate tenant to new plan
   */
  async migrateTenantPlan(tenantId, newPlan, options = {}) {
    const { effectiveDate = new Date(), prorated = true } = options;

    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw ApiError.notFound(`Tenant ${tenantId} not found`);
    }

    const oldPlan = this.plans.get(tenant.plan);
    const newPlanConfig = this.plans.get(newPlan);

    if (!newPlanConfig) {
      throw ApiError.badRequest(`Invalid plan: ${newPlan}`);
    }

    try {
      // Validate migration is allowed
      await this.validatePlanMigration(tenantId, tenant.plan, newPlan);

      // Calculate prorated billing if needed
      let billingAdjustment = null;
      if (prorated) {
        billingAdjustment = await this.calculateProratedBilling(tenant, oldPlan, newPlanConfig, effectiveDate);
      }

      // Update tenant
      const updatedTenant = await this.updateTenant(tenantId, {
        plan: newPlan,
        limits: newPlanConfig.limits,
        settings: {
          ...tenant.settings,
          features: newPlanConfig.features
        },
        billing: {
          ...tenant.billing,
          plan: newPlan,
          planChangeDate: effectiveDate,
          billingAdjustment
        }
      });

      // Update resource allocations
      await this.updateResourceAllocations(tenantId, newPlanConfig.limits);

      logger.info('Tenant plan migrated', {
        tenantId,
        oldPlan: tenant.plan,
        newPlan,
        effectiveDate,
        prorated
      });

      this.emit('tenant:plan_migrated', {
        tenantId,
        tenant: updatedTenant,
        oldPlan: tenant.plan,
        newPlan,
        billingAdjustment
      });

      return {
        tenantId,
        oldPlan: tenant.plan,
        newPlan,
        effectiveDate,
        billingAdjustment
      };

    } catch (error) {
      logger.error('Failed to migrate tenant plan', {
        tenantId,
        oldPlan: tenant.plan,
        newPlan,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get tenant usage analytics
   */
  async getTenantAnalytics(tenantId, options = {}) {
    const {
      timeframe = 'month',
      includeComparisons = true,
      includeForecast = false
    } = options;

    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw ApiError.notFound(`Tenant ${tenantId} not found`);
    }

    const usage = this.tenantUsage.get(tenantId) || this.initializeUsageTracking();

    const analytics = {
      tenantId,
      timeframe,
      generatedAt: new Date(),
      current: usage.current,
      limits: tenant.limits,
      utilization: this.calculateUtilization(usage.current, tenant.limits),
      trends: await this.calculateUsageTrends(tenantId, timeframe),
      costs: await this.calculateTenantCosts(tenantId, timeframe)
    };

    if (includeComparisons) {
      analytics.comparisons = await this.generateUsageComparisons(tenantId, timeframe);
    }

    if (includeForecast) {
      analytics.forecast = await this.generateUsageForecast(tenantId, timeframe);
    }

    return analytics;
  }

  // Helper methods

  initializeUsageTracking() {
    return {
      current: {},
      daily: {},
      total: {},
      lastUpdated: new Date(),
      resetDate: new Date()
    };
  }

  getCurrentUsage(tenantId) {
    const usage = this.tenantUsage.get(tenantId);
    return usage ? usage.current : {};
  }

  calculateUtilization(current, limits) {
    const utilization = {};
    
    for (const [type, limit] of Object.entries(limits)) {
      if (limit === -1) {
        utilization[type] = 0; // Unlimited
      } else {
        const usage = current[type] || 0;
        utilization[type] = Math.min((usage / limit) * 100, 100);
      }
    }

    return utilization;
  }

  isDomainTaken(domain) {
    for (const tenant of this.tenants.values()) {
      if (tenant.domain === domain) {
        return true;
      }
    }
    return false;
  }

  async createTenantConfiguration(tenantId, tenant) {
    const config = {
      tenantId,
      isolation: {
        namespace: `tenant_${tenantId}`,
        databaseSchema: `tenant_${tenantId}`,
        storagePrefix: tenantId,
        logPrefix: `tenant_${tenantId}`
      },
      features: tenant.settings.features,
      limits: tenant.limits,
      security: tenant.security,
      customization: {
        branding: tenant.settings.branding || {},
        theme: tenant.settings.theme || 'default',
        language: tenant.settings.language || 'en'
      },
      integrations: {
        sso: tenant.security.ssoEnabled ? {} : null,
        webhooks: [],
        apis: []
      }
    };

    this.tenantConfigs.set(tenantId, config);

    // Save configuration to disk
    const configFile = path.join(this.configDir, `${tenantId}.json`);
    await fs.writeJson(configFile, config, { spaces: 2 });

    return config;
  }

  async updateTenantConfiguration(tenantId, tenant) {
    const existingConfig = this.tenantConfigs.get(tenantId);
    if (!existingConfig) {
      return await this.createTenantConfiguration(tenantId, tenant);
    }

    const updatedConfig = {
      ...existingConfig,
      features: tenant.settings.features,
      limits: tenant.limits,
      security: tenant.security,
      lastUpdated: new Date()
    };

    this.tenantConfigs.set(tenantId, updatedConfig);

    // Save to disk
    const configFile = path.join(this.configDir, `${tenantId}.json`);
    await fs.writeJson(configFile, updatedConfig, { spaces: 2 });

    return updatedConfig;
  }

  async setupDatabaseIsolation(tenantId, isolation) {
    // Implementation would set up database schema/namespace
    logger.debug('Database isolation set up', {
      tenantId,
      schema: isolation.namespace
    });
  }

  async setupStorageIsolation(tenantId, isolation) {
    // Implementation would set up isolated storage
    logger.debug('Storage isolation set up', {
      tenantId,
      prefix: isolation.namespace
    });
  }

  async validatePlanChange(tenantId, newPlan) {
    const tenant = this.tenants.get(tenantId);
    const currentUsage = this.getCurrentUsage(tenantId);
    const newPlanConfig = this.plans.get(newPlan);

    // Check if current usage exceeds new plan limits
    for (const [type, usage] of Object.entries(currentUsage)) {
      const newLimit = newPlanConfig.limits[type];
      if (newLimit !== -1 && usage > newLimit) {
        throw new Error(`Current ${type} usage (${usage}) exceeds new plan limit (${newLimit})`);
      }
    }
  }

  async validateUsageAgainstLimits(tenantId, newLimits) {
    const currentUsage = this.getCurrentUsage(tenantId);

    for (const [type, usage] of Object.entries(currentUsage)) {
      const newLimit = newLimits[type];
      if (newLimit !== -1 && usage > newLimit) {
        throw new Error(`Current ${type} usage (${usage}) exceeds new limit (${newLimit})`);
      }
    }
  }

  async sendUsageWarning(tenantId, type, percentage, severity) {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return;

    const warning = {
      tenantId,
      type,
      percentage,
      severity,
      timestamp: new Date(),
      limit: tenant.limits[type],
      currentUsage: this.getCurrentUsage(tenantId)[type]
    };

    logger.warn(`Tenant ${severity} usage warning`, warning);

    this.emit('tenant:usage_warning', warning);

    // Send notification to tenant admin
    await this.sendNotification(tenant, 'usage_warning', warning);
  }

  async enforceLimitExceeded(tenantId, type, currentUsage, limit) {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return;

    const enforcement = {
      tenantId,
      type,
      currentUsage,
      limit,
      timestamp: new Date(),
      action: 'throttle' // or 'block', 'upgrade_required'
    };

    logger.error('Tenant limit exceeded', enforcement);

    this.emit('tenant:limit_exceeded', enforcement);

    // Apply enforcement action
    switch (enforcement.action) {
      case 'throttle':
        await this.throttleTenantRequests(tenantId, type);
        break;
      case 'block':
        await this.blockTenantRequests(tenantId, type);
        break;
    }
  }

  async sendWelcomeEmail(tenant, adminUser) {
    // Implementation would send welcome email
    logger.info('Welcome email sent', {
      tenantId: tenant.id,
      adminEmail: adminUser.email
    });
  }

  async sendNotification(tenant, type, data) {
    // Implementation would send notifications via email, webhook, etc.
    logger.info('Tenant notification sent', {
      tenantId: tenant.id,
      type,
      data
    });
  }

  setupUsageTracking() {
    // Reset usage counters daily
    setInterval(() => {
      this.resetDailyUsage();
    }, 24 * 60 * 60 * 1000); // Daily

    // Persist usage data every hour
    setInterval(() => {
      this.persistUsageData();
    }, 60 * 60 * 1000); // Hourly
  }

  resetDailyUsage() {
    // Reset daily counters for all tenants
    for (const [tenantId, usage] of this.tenantUsage) {
      // Keep historical daily data, just reset current if needed
      const today = new Date().toISOString().split('T')[0];
      if (!usage.daily[today]) {
        usage.daily[today] = {};
      }
    }
  }

  async persistUsageData() {
    // Save usage data to disk
    for (const [tenantId, usage] of this.tenantUsage) {
      try {
        const usageFile = path.join(this.dataDir, 'usage', `${tenantId}.json`);
        await fs.ensureDir(path.dirname(usageFile));
        await fs.writeJson(usageFile, usage, { spaces: 2 });
      } catch (error) {
        logger.error('Failed to persist usage data', {
          tenantId,
          error: error.message
        });
      }
    }
  }

  async saveTenant(tenant) {
    const tenantFile = path.join(this.dataDir, `${tenant.id}.json`);
    await fs.writeJson(tenantFile, tenant, { spaces: 2 });
  }

  async loadExistingTenants() {
    try {
      const files = await fs.readdir(this.dataDir);
      
      for (const file of files) {
        if (file.endsWith('.json') && file !== 'usage') {
          const tenantFile = path.join(this.dataDir, file);
          const tenant = await fs.readJson(tenantFile);
          this.tenants.set(tenant.id, tenant);
          
          // Load configuration
          const configFile = path.join(this.configDir, file);
          if (await fs.pathExists(configFile)) {
            const config = await fs.readJson(configFile);
            this.tenantConfigs.set(tenant.id, config);
          }
        }
      }

      logger.info('Loaded existing tenants', {
        count: this.tenants.size
      });

    } catch (error) {
      logger.error('Failed to load existing tenants', {
        error: error.message
      });
    }
  }

  generateTenantId() {
    return `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods

  listTenants(filters = {}) {
    let tenants = Array.from(this.tenants.values());

    if (filters.status) {
      tenants = tenants.filter(t => t.status === filters.status);
    }

    if (filters.plan) {
      tenants = tenants.filter(t => t.plan === filters.plan);
    }

    if (filters.domain) {
      tenants = tenants.filter(t => t.domain && t.domain.includes(filters.domain));
    }

    return tenants;
  }

  getTenantByDomain(domain) {
    for (const tenant of this.tenants.values()) {
      if (tenant.domain === domain) {
        return tenant;
      }
    }
    return null;
  }

  getTenantPlans() {
    return Array.from(this.plans.values());
  }

  getTenantStats() {
    const stats = {
      total: this.tenants.size,
      byStatus: {},
      byPlan: {},
      totalUsage: {
        requests: 0,
        tokens: 0,
        storage: 0
      }
    };

    for (const tenant of this.tenants.values()) {
      // Count by status
      stats.byStatus[tenant.status] = (stats.byStatus[tenant.status] || 0) + 1;

      // Count by plan
      stats.byPlan[tenant.plan] = (stats.byPlan[tenant.plan] || 0) + 1;

      // Aggregate usage
      const usage = this.getCurrentUsage(tenant.id);
      stats.totalUsage.requests += usage.requests || 0;
      stats.totalUsage.tokens += usage.tokens || 0;
      stats.totalUsage.storage += usage.storage || 0;
    }

    return stats;
  }
}