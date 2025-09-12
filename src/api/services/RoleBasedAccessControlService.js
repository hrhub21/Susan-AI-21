import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class RoleBasedAccessControlService extends EventEmitter {
  constructor(enterpriseService = null) {
    super();
    this.dataDir = path.join(__dirname, '../../../data/rbac');
    this.enterpriseService = enterpriseService;
    this.permissionsDir = path.join(this.dataDir, 'permissions');
    this.policiesDir = path.join(this.dataDir, 'policies');
    this.auditDir = path.join(this.dataDir, 'audit');
    this.sessionsDir = path.join(this.dataDir, 'sessions');
    
    // In-memory caches for performance
    this.permissions = new Map();
    this.roles = new Map();
    this.policies = new Map();
    this.userPermissions = new Map();
    this.sessionPermissions = new Map();
    this.auditLogs = new Map();
    this.accessPatterns = new Map();
    this.featureFlags = new Map();
    
    // Permission categories and their base permissions
    this.permissionCategories = new Map([
      ['claims', {
        id: 'claims',
        name: 'Claims Management',
        description: 'Permissions related to insurance claims processing',
        permissions: [
          'claims:view_own',
          'claims:view_assigned',
          'claims:view_team',
          'claims:view_all',
          'claims:create',
          'claims:edit_own',
          'claims:edit_assigned',
          'claims:edit_all',
          'claims:delete',
          'claims:assign',
          'claims:approve',
          'claims:close',
          'claims:reopen',
          'claims:export'
        ]
      }],
      ['documents', {
        id: 'documents',
        name: 'Document Management',
        description: 'Permissions for document handling and processing',
        permissions: [
          'documents:view_own',
          'documents:view_assigned',
          'documents:view_team',
          'documents:view_all',
          'documents:upload',
          'documents:download',
          'documents:edit',
          'documents:delete',
          'documents:share',
          'documents:process_ocr',
          'documents:classify',
          'documents:approve'
        ]
      }],
      ['reports', {
        id: 'reports',
        name: 'Reporting & Analytics',
        description: 'Permissions for reports and analytics access',
        permissions: [
          'reports:view_own',
          'reports:view_team',
          'reports:view_all',
          'reports:create_basic',
          'reports:create_advanced',
          'reports:edit',
          'reports:delete',
          'reports:export',
          'reports:schedule',
          'reports:share'
        ]
      }],
      ['analytics', {
        id: 'analytics',
        name: 'Analytics & Insights',
        description: 'Permissions for analytics and business intelligence',
        permissions: [
          'analytics:view_basic',
          'analytics:view_advanced',
          'analytics:view_financial',
          'analytics:create_dashboards',
          'analytics:export_data',
          'analytics:configure_metrics'
        ]
      }],
      ['users', {
        id: 'users',
        name: 'User Management',
        description: 'Permissions for user administration',
        permissions: [
          'users:view_own',
          'users:view_team',
          'users:view_all',
          'users:create',
          'users:edit_own',
          'users:edit_team',
          'users:edit_all',
          'users:delete',
          'users:activate',
          'users:deactivate',
          'users:reset_password',
          'users:assign_roles'
        ]
      }],
      ['teams', {
        id: 'teams',
        name: 'Team Management',
        description: 'Permissions for team administration',
        permissions: [
          'teams:view_own',
          'teams:view_all',
          'teams:create',
          'teams:edit_own',
          'teams:edit_all',
          'teams:delete',
          'teams:manage_members',
          'teams:assign_projects'
        ]
      }],
      ['organizations', {
        id: 'organizations',
        name: 'Organization Management',
        description: 'Permissions for organization administration',
        permissions: [
          'organizations:view',
          'organizations:edit',
          'organizations:manage_hierarchy',
          'organizations:manage_settings',
          'organizations:view_billing',
          'organizations:manage_billing'
        ]
      }],
      ['security', {
        id: 'security',
        name: 'Security & Compliance',
        description: 'Permissions for security and compliance features',
        permissions: [
          'security:view_logs',
          'security:manage_permissions',
          'security:manage_policies',
          'security:view_audit',
          'security:manage_mfa',
          'security:manage_sessions',
          'security:configure_sso'
        ]
      }],
      ['integrations', {
        id: 'integrations',
        name: 'System Integrations',
        description: 'Permissions for third-party integrations',
        permissions: [
          'integrations:view',
          'integrations:configure',
          'integrations:manage_api_keys',
          'integrations:manage_webhooks',
          'integrations:test_connections'
        ]
      }],
      ['ai_features', {
        id: 'ai_features',
        name: 'AI Features',
        description: 'Permissions for AI-powered features',
        permissions: [
          'ai:basic_chat',
          'ai:advanced_analysis',
          'ai:document_processing',
          'ai:damage_assessment',
          'ai:predictive_analytics',
          'ai:custom_models',
          'ai:training_data'
        ]
      }]
    ]);

    // Data access policies for row-level security
    this.dataAccessPolicies = new Map([
      ['own_data_only', {
        id: 'own_data_only',
        name: 'Own Data Only',
        description: 'User can only access their own data',
        rules: [
          { field: 'userId', operator: 'equals', value: '{{current_user_id}}' },
          { field: 'createdBy', operator: 'equals', value: '{{current_user_id}}' }
        ]
      }],
      ['team_data', {
        id: 'team_data',
        name: 'Team Data Access',
        description: 'User can access data from their teams',
        rules: [
          { field: 'teamId', operator: 'in', value: '{{user_team_ids}}' },
          { field: 'assignedTeam', operator: 'in', value: '{{user_team_ids}}' }
        ]
      }],
      ['organization_data', {
        id: 'organization_data',
        name: 'Organization Data Access',
        description: 'User can access all data in their organization',
        rules: [
          { field: 'organizationId', operator: 'equals', value: '{{user_organization_id}}' }
        ]
      }],
      ['tenant_data', {
        id: 'tenant_data',
        name: 'Tenant Data Access',
        description: 'User can access all data in their tenant',
        rules: [
          { field: 'tenantId', operator: 'equals', value: '{{user_tenant_id}}' }
        ]
      }],
      ['public_data', {
        id: 'public_data',
        name: 'Public Data Access',
        description: 'User can access public data',
        rules: [
          { field: 'visibility', operator: 'equals', value: 'public' }
        ]
      }],
      ['assigned_data', {
        id: 'assigned_data',
        name: 'Assigned Data Access',
        description: 'User can access data assigned to them',
        rules: [
          { field: 'assignedTo', operator: 'equals', value: '{{current_user_id}}' },
          { field: 'assignedUsers', operator: 'contains', value: '{{current_user_id}}' }
        ]
      }]
    ]);

    // Feature access control definitions
    this.featureControls = new Map([
      ['basic_claims', {
        id: 'basic_claims',
        name: 'Basic Claims Processing',
        description: 'Basic claim viewing and editing capabilities',
        requiredPermissions: ['claims:view_own', 'claims:edit_own'],
        requiredRole: 'client',
        dataPolicy: 'own_data_only'
      }],
      ['advanced_claims', {
        id: 'advanced_claims',
        name: 'Advanced Claims Management',
        description: 'Full claims management with assignment capabilities',
        requiredPermissions: ['claims:view_all', 'claims:edit_all', 'claims:assign'],
        requiredRole: 'adjuster',
        dataPolicy: 'organization_data'
      }],
      ['team_management', {
        id: 'team_management',
        name: 'Team Management',
        description: 'Ability to manage teams and team members',
        requiredPermissions: ['teams:manage_members', 'users:edit_team'],
        requiredRole: 'manager',
        dataPolicy: 'team_data'
      }],
      ['system_administration', {
        id: 'system_administration',
        name: 'System Administration',
        description: 'Full system administration capabilities',
        requiredPermissions: ['users:*', 'organizations:*', 'security:*'],
        requiredRole: 'admin',
        dataPolicy: 'tenant_data'
      }],
      ['ai_insights', {
        id: 'ai_insights',
        name: 'AI-Powered Insights',
        description: 'Access to advanced AI analysis and insights',
        requiredPermissions: ['ai:advanced_analysis', 'analytics:view_advanced'],
        requiredRole: 'adjuster',
        dataPolicy: 'team_data'
      }],
      ['financial_analytics', {
        id: 'financial_analytics',
        name: 'Financial Analytics',
        description: 'Access to financial reports and cost analytics',
        requiredPermissions: ['analytics:view_financial', 'reports:view_all'],
        requiredRole: 'manager',
        dataPolicy: 'organization_data'
      }],
      ['compliance_reporting', {
        id: 'compliance_reporting',
        name: 'Compliance Reporting',
        description: 'Access to compliance and audit reporting',
        requiredPermissions: ['security:view_audit', 'reports:create_advanced'],
        requiredRole: 'manager',
        dataPolicy: 'organization_data'
      }],
      ['api_access', {
        id: 'api_access',
        name: 'API Access',
        description: 'Programmatic API access',
        requiredPermissions: ['integrations:manage_api_keys'],
        requiredRole: 'developer',
        dataPolicy: 'assigned_data'
      }]
    ]);

    this.ensureDirectories();
    this.loadExistingData();
    this.setupAuditLogging();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.dataDir);
    await fs.ensureDir(this.permissionsDir);
    await fs.ensureDir(this.policiesDir);
    await fs.ensureDir(this.auditDir);
    await fs.ensureDir(this.sessionsDir);
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(userId, permission, context = {}) {
    try {
      const userPermissions = await this.getUserPermissions(userId);
      
      // Check for wildcard permissions
      if (userPermissions.includes('*') || userPermissions.includes(`${permission.split(':')[0]}:*`)) {
        await this.logAccessAttempt(userId, permission, 'granted', 'wildcard', context);
        return true;
      }

      // Check for exact permission match
      if (userPermissions.includes(permission)) {
        await this.logAccessAttempt(userId, permission, 'granted', 'exact', context);
        return true;
      }

      await this.logAccessAttempt(userId, permission, 'denied', 'insufficient_permissions', context);
      return false;

    } catch (error) {
      logger.error('Permission check failed', {
        userId,
        permission,
        error: error.message
      });
      await this.logAccessAttempt(userId, permission, 'error', error.message, context);
      return false;
    }
  }

  /**
   * Check if user has multiple permissions (all required)
   */
  async hasAllPermissions(userId, permissions, context = {}) {
    try {
      for (const permission of permissions) {
        if (!(await this.hasPermission(userId, permission, context))) {
          return false;
        }
      }
      return true;
    } catch (error) {
      logger.error('Multiple permission check failed', {
        userId,
        permissions,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(userId, permissions, context = {}) {
    try {
      for (const permission of permissions) {
        if (await this.hasPermission(userId, permission, context)) {
          return true;
        }
      }
      return false;
    } catch (error) {
      logger.error('Any permission check failed', {
        userId,
        permissions,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Check if user can access a specific feature
   */
  async canAccessFeature(userId, featureId, context = {}) {
    try {
      const feature = this.featureControls.get(featureId);
      if (!feature) {
        throw ApiError.notFound(`Feature ${featureId} not found`);
      }

      // Check required permissions
      if (!(await this.hasAllPermissions(userId, feature.requiredPermissions, context))) {
        await this.logFeatureAccess(userId, featureId, 'denied', 'insufficient_permissions', context);
        return false;
      }

      // Check required role if specified
      if (feature.requiredRole) {
        const userRole = await this.getUserRole(userId);
        if (!this.isRoleAdequate(userRole, feature.requiredRole)) {
          await this.logFeatureAccess(userId, featureId, 'denied', 'insufficient_role', context);
          return false;
        }
      }

      // Check feature flags
      if (!(await this.isFeatureEnabled(featureId, context))) {
        await this.logFeatureAccess(userId, featureId, 'denied', 'feature_disabled', context);
        return false;
      }

      await this.logFeatureAccess(userId, featureId, 'granted', 'authorized', context);
      return true;

    } catch (error) {
      logger.error('Feature access check failed', {
        userId,
        featureId,
        error: error.message
      });
      await this.logFeatureAccess(userId, featureId, 'error', error.message, context);
      return false;
    }
  }

  /**
   * Apply data access policy to filter query results
   */
  async applyDataPolicy(userId, policyId, query = {}, context = {}) {
    try {
      const policy = this.dataAccessPolicies.get(policyId);
      if (!policy) {
        throw ApiError.notFound(`Data policy ${policyId} not found`);
      }

      const userContext = await this.getUserContext(userId);
      const filteredQuery = { ...query };

      // Apply policy rules to query
      for (const rule of policy.rules) {
        const resolvedValue = await this.resolveVariableValue(rule.value, userContext);
        
        switch (rule.operator) {
          case 'equals':
            filteredQuery[rule.field] = resolvedValue;
            break;
          case 'in':
            filteredQuery[rule.field] = { $in: resolvedValue };
            break;
          case 'contains':
            if (!filteredQuery.$or) filteredQuery.$or = [];
            filteredQuery.$or.push({ [rule.field]: { $elemMatch: { $eq: resolvedValue } } });
            break;
          case 'not_equals':
            filteredQuery[rule.field] = { $ne: resolvedValue };
            break;
        }
      }

      await this.logDataAccess(userId, policyId, 'applied', filteredQuery, context);
      return filteredQuery;

    } catch (error) {
      logger.error('Data policy application failed', {
        userId,
        policyId,
        error: error.message
      });
      await this.logDataAccess(userId, policyId, 'error', null, context);
      throw error;
    }
  }

  /**
   * Authorize API request based on user permissions
   */
  async authorizeAPIRequest(userId, method, endpoint, context = {}) {
    try {
      // Map HTTP methods and endpoints to required permissions
      const requiredPermission = this.mapEndpointToPermission(method, endpoint);
      
      if (!requiredPermission) {
        // No specific permission required for this endpoint
        await this.logAPIAccess(userId, method, endpoint, 'granted', 'public_endpoint', context);
        return { authorized: true, permission: null };
      }

      const hasAccess = await this.hasPermission(userId, requiredPermission, context);
      
      if (hasAccess) {
        await this.logAPIAccess(userId, method, endpoint, 'granted', requiredPermission, context);
        return { 
          authorized: true, 
          permission: requiredPermission,
          dataPolicy: await this.getEndpointDataPolicy(endpoint)
        };
      } else {
        await this.logAPIAccess(userId, method, endpoint, 'denied', requiredPermission, context);
        return { 
          authorized: false, 
          permission: requiredPermission,
          reason: 'insufficient_permissions'
        };
      }

    } catch (error) {
      logger.error('API authorization failed', {
        userId,
        method,
        endpoint,
        error: error.message
      });
      await this.logAPIAccess(userId, method, endpoint, 'error', null, context);
      return { 
        authorized: false, 
        reason: 'authorization_error',
        error: error.message
      };
    }
  }

  /**
   * Create a new role with specified permissions
   */
  async createRole(roleData, options = {}) {
    const {
      id,
      name,
      description,
      permissions = [],
      inheritsFrom = [],
      level = 1,
      features = [],
      dataPolicy = 'own_data_only'
    } = roleData;

    const { validatePermissions = true } = options;

    try {
      if (this.roles.has(id)) {
        throw ApiError.conflict(`Role ${id} already exists`);
      }

      // Validate permissions if requested
      if (validatePermissions) {
        await this.validatePermissions(permissions);
      }

      // Resolve inherited permissions
      const inheritedPermissions = await this.resolveInheritedPermissions(inheritsFrom);
      const allPermissions = [...new Set([...permissions, ...inheritedPermissions])];

      const role = {
        id,
        name,
        description,
        permissions: allPermissions,
        inheritsFrom,
        level,
        features,
        dataPolicy,
        metadata: {
          createdAt: new Date(),
          createdBy: options.createdBy || 'system',
          lastUpdated: new Date()
        },
        status: 'active'
      };

      this.roles.set(id, role);
      await this.saveRole(role);

      logger.info('Role created', {
        roleId: id,
        name,
        permissionCount: allPermissions.length,
        inheritsFrom
      });

      this.emit('role:created', { roleId: id, role });

      return { roleId: id, role };

    } catch (error) {
      logger.error('Failed to create role', {
        roleId: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create custom permission
   */
  async createPermission(permissionData, options = {}) {
    const {
      id,
      name,
      description,
      category,
      resource,
      action,
      conditions = []
    } = permissionData;

    try {
      if (this.permissions.has(id)) {
        throw ApiError.conflict(`Permission ${id} already exists`);
      }

      const permission = {
        id,
        name,
        description,
        category,
        resource,
        action,
        conditions,
        metadata: {
          createdAt: new Date(),
          createdBy: options.createdBy || 'system',
          lastUpdated: new Date()
        },
        status: 'active'
      };

      this.permissions.set(id, permission);
      await this.savePermission(permission);

      logger.info('Permission created', {
        permissionId: id,
        category,
        resource,
        action
      });

      this.emit('permission:created', { permissionId: id, permission });

      return { permissionId: id, permission };

    } catch (error) {
      logger.error('Failed to create permission', {
        permissionId: id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Assign permissions to user
   */
  async assignUserPermissions(userId, permissions, options = {}) {
    const { 
      replace = false, 
      assignedBy, 
      expiresAt = null,
      reason = null 
    } = options;

    try {
      let currentPermissions = this.userPermissions.get(userId) || [];
      
      if (replace) {
        currentPermissions = permissions;
      } else {
        currentPermissions = [...new Set([...currentPermissions, ...permissions])];
      }

      const assignment = {
        userId,
        permissions: currentPermissions,
        assignedBy,
        assignedAt: new Date(),
        expiresAt,
        reason,
        metadata: {
          totalPermissions: currentPermissions.length,
          operation: replace ? 'replace' : 'add'
        }
      };

      this.userPermissions.set(userId, currentPermissions);
      await this.saveUserPermissions(assignment);

      // Log permission assignment
      await this.logPermissionChange(userId, 'assigned', permissions, {
        assignedBy,
        operation: replace ? 'replace' : 'add',
        reason
      });

      logger.info('User permissions assigned', {
        userId,
        permissionCount: currentPermissions.length,
        operation: replace ? 'replace' : 'add',
        assignedBy
      });

      this.emit('permissions:assigned', { userId, permissions: currentPermissions, assignment });

      return { userId, permissions: currentPermissions };

    } catch (error) {
      logger.error('Failed to assign user permissions', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Start a secure session with permission caching
   */
  async startSecureSession(userId, sessionData, options = {}) {
    const {
      sessionId,
      ipAddress,
      userAgent,
      mfaVerified = false,
      deviceTrusted = false
    } = sessionData;

    const { cachePermissions = true, sessionTimeout = 8 * 60 * 60 * 1000 } = options;

    try {
      // Get user permissions and context
      const userPermissions = await this.getUserPermissions(userId);
      const userContext = await this.getUserContext(userId);
      const userRole = await this.getUserRole(userId);

      // Calculate session risk score
      const riskScore = await this.calculateSessionRiskScore({
        userId,
        ipAddress,
        userAgent,
        mfaVerified,
        deviceTrusted,
        userRole
      });

      // Create secure session
      const session = {
        id: sessionId,
        userId,
        permissions: cachePermissions ? userPermissions : null,
        userContext,
        userRole,
        security: {
          ipAddress,
          userAgent,
          mfaVerified,
          deviceTrusted,
          riskScore,
          requiresStepUp: riskScore > 70
        },
        timing: {
          startedAt: new Date(),
          lastActivity: new Date(),
          expiresAt: new Date(Date.now() + sessionTimeout)
        },
        metadata: {
          permissionsCached: cachePermissions,
          cacheSize: userPermissions.length
        }
      };

      this.sessionPermissions.set(sessionId, session);
      await this.saveSession(session);

      // Log session start
      await this.logSessionEvent(sessionId, 'started', {
        userId,
        riskScore,
        mfaVerified,
        deviceTrusted
      });

      logger.info('Secure session started', {
        sessionId,
        userId,
        riskScore,
        permissionsCached: cachePermissions,
        requiresStepUp: session.security.requiresStepUp
      });

      this.emit('session:started', { sessionId, session });

      return { 
        sessionId, 
        session: {
          id: session.id,
          expiresAt: session.timing.expiresAt,
          riskScore: session.security.riskScore,
          requiresStepUp: session.security.requiresStepUp
        }
      };

    } catch (error) {
      logger.error('Failed to start secure session', {
        sessionId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get comprehensive audit log
   */
  async getAuditLog(options = {}) {
    const {
      userId = null,
      eventType = null,
      startDate = null,
      endDate = null,
      limit = 100,
      offset = 0
    } = options;

    try {
      let auditEntries = Array.from(this.auditLogs.values()).flat();

      // Apply filters
      if (userId) {
        auditEntries = auditEntries.filter(entry => entry.userId === userId);
      }

      if (eventType) {
        auditEntries = auditEntries.filter(entry => entry.eventType === eventType);
      }

      if (startDate) {
        auditEntries = auditEntries.filter(entry => entry.timestamp >= new Date(startDate));
      }

      if (endDate) {
        auditEntries = auditEntries.filter(entry => entry.timestamp <= new Date(endDate));
      }

      // Sort by timestamp (newest first)
      auditEntries.sort((a, b) => b.timestamp - a.timestamp);

      // Apply pagination
      const totalCount = auditEntries.length;
      const paginatedEntries = auditEntries.slice(offset, offset + limit);

      const auditLog = {
        totalCount,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(totalCount / limit),
        limit,
        entries: paginatedEntries,
        filters: { userId, eventType, startDate, endDate },
        generatedAt: new Date()
      };

      return auditLog;

    } catch (error) {
      logger.error('Failed to retrieve audit log', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate security compliance report
   */
  async generateComplianceReport(timeframe = 'month', options = {}) {
    const { includeDetails = false, format = 'json' } = options;

    try {
      const startDate = this.getTimeframeStart(timeframe);
      const endDate = new Date();

      // Get audit data for timeframe
      const auditData = await this.getAuditLog({
        startDate,
        endDate,
        limit: 10000
      });

      // Calculate compliance metrics
      const complianceMetrics = {
        accessAttempts: {
          total: auditData.entries.filter(e => e.eventType === 'access_attempt').length,
          granted: auditData.entries.filter(e => e.eventType === 'access_attempt' && e.result === 'granted').length,
          denied: auditData.entries.filter(e => e.eventType === 'access_attempt' && e.result === 'denied').length
        },
        featureAccess: {
          total: auditData.entries.filter(e => e.eventType === 'feature_access').length,
          granted: auditData.entries.filter(e => e.eventType === 'feature_access' && e.result === 'granted').length,
          denied: auditData.entries.filter(e => e.eventType === 'feature_access' && e.result === 'denied').length
        },
        dataAccess: {
          total: auditData.entries.filter(e => e.eventType === 'data_access').length,
          violations: auditData.entries.filter(e => e.eventType === 'data_access' && e.result === 'violation').length
        },
        permissionChanges: auditData.entries.filter(e => e.eventType === 'permission_change').length,
        securityEvents: auditData.entries.filter(e => e.eventType === 'security_event').length
      };

      // Calculate compliance scores
      const accessSuccessRate = complianceMetrics.accessAttempts.total > 0 
        ? (complianceMetrics.accessAttempts.granted / complianceMetrics.accessAttempts.total) * 100 
        : 100;

      const dataComplianceScore = complianceMetrics.dataAccess.total > 0
        ? ((complianceMetrics.dataAccess.total - complianceMetrics.dataAccess.violations) / complianceMetrics.dataAccess.total) * 100
        : 100;

      const report = {
        reportId: this.generateReportId(),
        timeframe,
        period: { startDate, endDate },
        generatedAt: new Date(),
        complianceScore: Math.round((accessSuccessRate + dataComplianceScore) / 2),
        metrics: complianceMetrics,
        scores: {
          accessSuccessRate: Math.round(accessSuccessRate),
          dataComplianceScore: Math.round(dataComplianceScore),
          overallHealth: this.calculateSecurityHealth(complianceMetrics)
        },
        recommendations: this.generateSecurityRecommendations(complianceMetrics),
        trends: await this.calculateComplianceTrends(timeframe)
      };

      if (includeDetails) {
        report.detailedEvents = auditData.entries.slice(0, 100); // Last 100 events
        report.topUsers = this.getTopUsersByActivity(auditData.entries);
        report.riskIndicators = this.identifyRiskIndicators(auditData.entries);
      }

      // Save report
      await this.saveComplianceReport(report);

      logger.info('Compliance report generated', {
        reportId: report.reportId,
        timeframe,
        complianceScore: report.complianceScore,
        totalEvents: auditData.totalCount
      });

      this.emit('compliance:report_generated', { report });

      return report;

    } catch (error) {
      logger.error('Failed to generate compliance report', {
        timeframe,
        error: error.message
      });
      throw error;
    }
  }

  // Helper methods

  async getUserPermissions(userId) {
    // First check cached permissions
    let permissions = this.userPermissions.get(userId);
    
    if (!permissions) {
      // Load from user role and direct assignments
      const userRole = await this.getUserRole(userId);
      const rolePermissions = await this.getRolePermissions(userRole);
      const directPermissions = await this.getDirectUserPermissions(userId);
      
      permissions = [...new Set([...rolePermissions, ...directPermissions])];
      this.userPermissions.set(userId, permissions);
    }
    
    return permissions;
  }

  async getUserRole(userId) {
    // Try to get from enterprise service if available
    try {
      if (this.enterpriseService) {
        const user = this.enterpriseService.getUser(userId);
        return user ? user.role : 'client';
      }
    } catch (error) {
      // Fall back to default
    }
    return 'client'; // Default role
  }

  async getRolePermissions(roleId) {
    // First check custom roles
    const role = this.roles.get(roleId);
    if (role) {
      return role.permissions;
    }
    
    // Fall back to enterprise service role definitions
    try {
      if (this.enterpriseService) {
        const roleConfig = this.enterpriseService.userRoles.get(roleId);
        return roleConfig ? roleConfig.permissions : [];
      }
    } catch (error) {
      // Fall back to empty permissions
    }
    
    return [];
  }

  async getDirectUserPermissions(userId) {
    // Check if user has directly assigned permissions
    const userPermissions = this.userPermissions.get(userId);
    if (userPermissions) {
      return userPermissions;
    }
    
    // Try to get from enterprise service
    try {
      if (this.enterpriseService) {
        const user = this.enterpriseService.getUser(userId);
        return user ? (user.permissions || []) : [];
      }
    } catch (error) {
      // Fall back to empty permissions
    }
    
    return [];
  }

  async getUserContext(userId) {
    // Mock implementation - would get user context from user service
    return {
      userId,
      organizationId: 'org_123',
      tenantId: 'tenant_123',
      teamIds: ['team_1', 'team_2'],
      role: await this.getUserRole(userId)
    };
  }

  isRoleAdequate(userRole, requiredRole) {
    // Mock role hierarchy check
    const roleHierarchy = {
      client: 1,
      contractor: 2,
      inspector: 3,
      adjuster: 4,
      manager: 5,
      admin: 6
    };

    return (roleHierarchy[userRole] || 0) >= (roleHierarchy[requiredRole] || 0);
  }

  async isFeatureEnabled(featureId, context = {}) {
    const flag = this.featureFlags.get(featureId);
    if (!flag) return true; // Default to enabled if no flag set

    if (flag.enabled === false) return false;
    
    // Check context-based enablement (tenant, organization, etc.)
    if (flag.enabledFor && context.tenantId) {
      return flag.enabledFor.includes(context.tenantId);
    }

    return flag.enabled;
  }

  async resolveVariableValue(value, userContext) {
    if (typeof value !== 'string') return value;

    const variables = {
      '{{current_user_id}}': userContext.userId,
      '{{user_organization_id}}': userContext.organizationId,
      '{{user_tenant_id}}': userContext.tenantId,
      '{{user_team_ids}}': userContext.teamIds
    };

    return variables[value] || value;
  }

  mapEndpointToPermission(method, endpoint) {
    // Map HTTP endpoints to required permissions
    const endpointMap = {
      'GET /api/claims': 'claims:view_all',
      'POST /api/claims': 'claims:create',
      'PUT /api/claims/:id': 'claims:edit_all',
      'DELETE /api/claims/:id': 'claims:delete',
      'GET /api/users': 'users:view_all',
      'POST /api/users': 'users:create',
      'PUT /api/users/:id': 'users:edit_all',
      'DELETE /api/users/:id': 'users:delete',
      'GET /api/teams': 'teams:view_all',
      'POST /api/teams': 'teams:create',
      'GET /api/analytics': 'analytics:view_basic',
      'GET /api/reports': 'reports:view_all'
    };

    const key = `${method} ${endpoint}`;
    return endpointMap[key] || null;
  }

  async getEndpointDataPolicy(endpoint) {
    // Map endpoints to data access policies
    const policyMap = {
      '/api/claims': 'team_data',
      '/api/users': 'organization_data',
      '/api/teams': 'organization_data',
      '/api/documents': 'assigned_data',
      '/api/reports': 'team_data'
    };

    return policyMap[endpoint] || 'own_data_only';
  }

  async validatePermissions(permissions) {
    const allPermissions = new Set();
    
    // Collect all valid permissions from categories
    for (const category of this.permissionCategories.values()) {
      category.permissions.forEach(p => allPermissions.add(p));
    }

    // Add custom permissions
    for (const permission of this.permissions.values()) {
      allPermissions.add(permission.id);
    }

    // Validate each permission
    for (const permission of permissions) {
      if (permission === '*' || permission.endsWith(':*')) {
        continue; // Wildcard permissions are valid
      }
      
      if (!allPermissions.has(permission)) {
        throw ApiError.badRequest(`Invalid permission: ${permission}`);
      }
    }
  }

  async resolveInheritedPermissions(roleIds) {
    const inheritedPermissions = [];
    
    for (const roleId of roleIds) {
      const role = this.roles.get(roleId);
      if (role) {
        inheritedPermissions.push(...role.permissions);
      }
    }
    
    return [...new Set(inheritedPermissions)];
  }

  async calculateSessionRiskScore(sessionData) {
    let riskScore = 0;

    // IP address risk
    if (!sessionData.deviceTrusted) riskScore += 20;
    
    // MFA status
    if (!sessionData.mfaVerified) riskScore += 30;
    
    // User role risk
    const roleRisk = {
      admin: 40,
      manager: 20,
      adjuster: 10,
      inspector: 5,
      contractor: 5,
      client: 0
    };
    riskScore += roleRisk[sessionData.userRole] || 0;

    // Time-based risk (unusual hours)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) riskScore += 15;

    return Math.min(riskScore, 100);
  }

  getTimeframeStart(timeframe) {
    const now = new Date();
    switch (timeframe) {
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        return weekStart;
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        return new Date(now.getFullYear(), quarter * 3, 1);
      case 'year':
        return new Date(now.getFullYear(), 0, 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }

  calculateSecurityHealth(metrics) {
    // Calculate overall security health score
    let healthScore = 100;

    // Deduct for denied access attempts
    if (metrics.accessAttempts.total > 0) {
      const deniedRate = metrics.accessAttempts.denied / metrics.accessAttempts.total;
      if (deniedRate > 0.1) healthScore -= 20; // More than 10% denied
    }

    // Deduct for data violations
    if (metrics.dataAccess.violations > 0) {
      healthScore -= Math.min(metrics.dataAccess.violations * 5, 30);
    }

    // Deduct for excessive permission changes
    if (metrics.permissionChanges > 50) {
      healthScore -= 10;
    }

    return Math.max(healthScore, 0);
  }

  generateSecurityRecommendations(metrics) {
    const recommendations = [];

    if (metrics.accessAttempts.denied > metrics.accessAttempts.granted * 0.1) {
      recommendations.push({
        type: 'security',
        priority: 'high',
        title: 'High Access Denial Rate',
        description: 'Consider reviewing user permissions or providing additional training',
        action: 'Review user roles and permissions'
      });
    }

    if (metrics.dataAccess.violations > 0) {
      recommendations.push({
        type: 'compliance',
        priority: 'critical',
        title: 'Data Access Violations Detected',
        description: 'Immediate review of data access policies required',
        action: 'Audit data access policies and user training'
      });
    }

    if (metrics.securityEvents > 10) {
      recommendations.push({
        type: 'security',
        priority: 'medium',
        title: 'Multiple Security Events',
        description: 'Review security events for potential threats',
        action: 'Investigate security event patterns'
      });
    }

    return recommendations;
  }

  // Audit logging methods

  async logAccessAttempt(userId, permission, result, reason, context) {
    await this.logAuditEvent({
      eventType: 'access_attempt',
      userId,
      result,
      details: {
        permission,
        reason,
        context
      }
    });
  }

  async logFeatureAccess(userId, featureId, result, reason, context) {
    await this.logAuditEvent({
      eventType: 'feature_access',
      userId,
      result,
      details: {
        featureId,
        reason,
        context
      }
    });
  }

  async logDataAccess(userId, policyId, action, query, context) {
    await this.logAuditEvent({
      eventType: 'data_access',
      userId,
      result: action,
      details: {
        policyId,
        query,
        context
      }
    });
  }

  async logAPIAccess(userId, method, endpoint, result, permission, context) {
    await this.logAuditEvent({
      eventType: 'api_access',
      userId,
      result,
      details: {
        method,
        endpoint,
        permission,
        context
      }
    });
  }

  async logPermissionChange(userId, action, permissions, context) {
    await this.logAuditEvent({
      eventType: 'permission_change',
      userId,
      result: action,
      details: {
        permissions,
        context
      }
    });
  }

  async logSessionEvent(sessionId, action, details) {
    await this.logAuditEvent({
      eventType: 'session_event',
      sessionId,
      result: action,
      details
    });
  }

  async logAuditEvent(eventData) {
    const auditEntry = {
      id: this.generateAuditId(),
      ...eventData,
      timestamp: new Date(),
      source: 'rbac_service'
    };

    // Store in memory (grouped by date for efficient access)
    const dateKey = auditEntry.timestamp.toISOString().split('T')[0];
    if (!this.auditLogs.has(dateKey)) {
      this.auditLogs.set(dateKey, []);
    }
    this.auditLogs.get(dateKey).push(auditEntry);

    // Save to disk
    await this.saveAuditEntry(auditEntry);

    this.emit('audit:logged', { auditEntry });
  }

  // Storage methods

  async saveRole(role) {
    const roleFile = path.join(this.dataDir, 'roles', `${role.id}.json`);
    await fs.ensureDir(path.dirname(roleFile));
    await fs.writeJson(roleFile, role, { spaces: 2 });
  }

  async savePermission(permission) {
    const permissionFile = path.join(this.permissionsDir, `${permission.id}.json`);
    await fs.writeJson(permissionFile, permission, { spaces: 2 });
  }

  async saveUserPermissions(assignment) {
    const assignmentFile = path.join(this.dataDir, 'user_permissions', `${assignment.userId}.json`);
    await fs.ensureDir(path.dirname(assignmentFile));
    await fs.writeJson(assignmentFile, assignment, { spaces: 2 });
  }

  async saveSession(session) {
    const sessionFile = path.join(this.sessionsDir, `${session.id}.json`);
    await fs.writeJson(sessionFile, session, { spaces: 2 });
  }

  async saveAuditEntry(entry) {
    const date = entry.timestamp.toISOString().split('T')[0];
    const auditFile = path.join(this.auditDir, `${date}.json`);
    
    let dayAuditLog = [];
    if (await fs.pathExists(auditFile)) {
      dayAuditLog = await fs.readJson(auditFile);
    }
    
    dayAuditLog.push(entry);
    await fs.writeJson(auditFile, dayAuditLog, { spaces: 2 });
  }

  async saveComplianceReport(report) {
    const reportFile = path.join(this.dataDir, 'compliance_reports', `${report.reportId}.json`);
    await fs.ensureDir(path.dirname(reportFile));
    await fs.writeJson(reportFile, report, { spaces: 2 });
  }

  async loadExistingData() {
    // Load existing roles, permissions, and audit data
    try {
      // Load roles
      const rolesDir = path.join(this.dataDir, 'roles');
      if (await fs.pathExists(rolesDir)) {
        const roleFiles = await fs.readdir(rolesDir);
        for (const file of roleFiles.filter(f => f.endsWith('.json'))) {
          const role = await fs.readJson(path.join(rolesDir, file));
          this.roles.set(role.id, role);
        }
      }

      // Load permissions
      if (await fs.pathExists(this.permissionsDir)) {
        const permissionFiles = await fs.readdir(this.permissionsDir);
        for (const file of permissionFiles.filter(f => f.endsWith('.json'))) {
          const permission = await fs.readJson(path.join(this.permissionsDir, file));
          this.permissions.set(permission.id, permission);
        }
      }

      logger.info('Loaded existing RBAC data', {
        roles: this.roles.size,
        permissions: this.permissions.size
      });

    } catch (error) {
      logger.error('Failed to load existing RBAC data', {
        error: error.message
      });
    }
  }

  setupAuditLogging() {
    // Clean up old audit logs daily
    setInterval(() => {
      this.cleanupOldAuditLogs();
    }, 24 * 60 * 60 * 1000);

    // Persist audit data every hour
    setInterval(() => {
      this.persistAuditData();
    }, 60 * 60 * 1000);
  }

  async cleanupOldAuditLogs() {
    // Remove audit logs older than 1 year
    const cutoffDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const keysToDelete = [];

    for (const [dateKey] of this.auditLogs) {
      if (new Date(dateKey) < cutoffDate) {
        keysToDelete.push(dateKey);
      }
    }

    keysToDelete.forEach(key => this.auditLogs.delete(key));
  }

  async persistAuditData() {
    // Persist any in-memory audit data to disk
    for (const [dateKey, entries] of this.auditLogs) {
      try {
        const auditFile = path.join(this.auditDir, `${dateKey}.json`);
        await fs.writeJson(auditFile, entries, { spaces: 2 });
      } catch (error) {
        logger.error('Failed to persist audit data', {
          dateKey,
          error: error.message
        });
      }
    }
  }

  // ID generators
  generateAuditId() {
    return `audit_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  }

  generateReportId() {
    return `rpt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  }

  // Public API methods

  getPermissionCategories() {
    return Array.from(this.permissionCategories.values());
  }

  getDataAccessPolicies() {
    return Array.from(this.dataAccessPolicies.values());
  }

  getFeatureControls() {
    return Array.from(this.featureControls.values());
  }

  getRoles() {
    return Array.from(this.roles.values());
  }

  getSystemStats() {
    return {
      totalRoles: this.roles.size,
      totalPermissions: this.permissions.size,
      totalPolicies: this.policies.size,
      activeSessions: this.sessionPermissions.size,
      auditLogDays: this.auditLogs.size,
      permissionCategories: this.permissionCategories.size
    };
  }
}