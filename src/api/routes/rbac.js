import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateJsonSchema } from '../middleware/validation.js';
import { moderateRateLimit, strictRateLimit } from '../middleware/rateLimit.js';
import { authMiddleware, adminAuthMiddleware } from '../middleware/auth.js';
import { ApiError } from '../utils/ApiError.js';
import { RoleBasedAccessControlService } from '../services/RoleBasedAccessControlService.js';

const router = express.Router();
const rbacService = new RoleBasedAccessControlService();

// Middleware to check RBAC permissions
const requirePermission = (permission) => {
  return asyncHandler(async (req, res, next) => {
    const userId = getUserId(req);
    const hasPermission = await rbacService.hasPermission(userId, permission, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      method: req.method
    });

    if (!hasPermission) {
      throw ApiError.forbidden(`Insufficient permissions: ${permission} required`);
    }

    next();
  });
};

// Validation schemas
const createRoleSchema = {
  type: 'object',
  required: ['id', 'name', 'permissions'],
  properties: {
    id: { type: 'string', pattern: '^[a-z_]+$', minLength: 2, maxLength: 50 },
    name: { type: 'string', minLength: 2, maxLength: 100 },
    description: { type: 'string', maxLength: 500 },
    permissions: { type: 'array', items: { type: 'string' } },
    inheritsFrom: { type: 'array', items: { type: 'string' } },
    level: { type: 'number', minimum: 1, maximum: 10 },
    features: { type: 'array', items: { type: 'string' } },
    dataPolicy: { type: 'string' }
  }
};

const createPermissionSchema = {
  type: 'object',
  required: ['id', 'name', 'category', 'resource', 'action'],
  properties: {
    id: { type: 'string', pattern: '^[a-z_:]+$' },
    name: { type: 'string', minLength: 2, maxLength: 100 },
    description: { type: 'string', maxLength: 500 },
    category: { type: 'string' },
    resource: { type: 'string' },
    action: { type: 'string' },
    conditions: { type: 'array', items: { type: 'object' } }
  }
};

const assignPermissionsSchema = {
  type: 'object',
  required: ['permissions'],
  properties: {
    permissions: { type: 'array', items: { type: 'string' } },
    replace: { type: 'boolean' },
    expiresAt: { type: 'string', format: 'date-time' },
    reason: { type: 'string', maxLength: 500 }
  }
};

// Permission Management Routes

/**
 * @route POST /api/rbac/permissions
 * @desc Create a new permission
 * @access Admin
 */
router.post('/permissions',
  authMiddleware,
  requirePermission('security:manage_permissions'),
  moderateRateLimit,
  validateJsonSchema(createPermissionSchema),
  asyncHandler(async (req, res) => {
    const permissionData = req.body;
    const createdBy = getUserId(req);

    const result = await rbacService.createPermission(permissionData, { createdBy });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Permission created successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route GET /api/rbac/permissions
 * @desc List all permissions by category
 * @access Manager+
 */
router.get('/permissions',
  authMiddleware,
  requirePermission('security:view_permissions'),
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const { category, search } = req.query;

    const permissionCategories = rbacService.getPermissionCategories();
    
    let result = permissionCategories;
    
    if (category) {
      result = result.filter(cat => cat.id === category);
    }
    
    if (search) {
      result = result.map(cat => ({
        ...cat,
        permissions: cat.permissions.filter(perm => 
          perm.toLowerCase().includes(search.toLowerCase())
        )
      })).filter(cat => cat.permissions.length > 0);
    }

    res.json({
      success: true,
      data: { permissionCategories: result },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Role Management Routes

/**
 * @route POST /api/rbac/roles
 * @desc Create a new role
 * @access Admin
 */
router.post('/roles',
  authMiddleware,
  requirePermission('security:manage_permissions'),
  moderateRateLimit,
  validateJsonSchema(createRoleSchema),
  asyncHandler(async (req, res) => {
    const roleData = req.body;
    const createdBy = getUserId(req);

    const result = await rbacService.createRole(roleData, { 
      createdBy,
      validatePermissions: true
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Role created successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route GET /api/rbac/roles
 * @desc List all roles
 * @access Manager+
 */
router.get('/roles',
  authMiddleware,
  requirePermission('security:view_permissions'),
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const roles = rbacService.getRoles();

    res.json({
      success: true,
      data: { roles },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route GET /api/rbac/roles/:id
 * @desc Get role details
 * @access Manager+
 */
router.get('/roles/:id',
  authMiddleware,
  requirePermission('security:view_permissions'),
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const roles = rbacService.getRoles();
    const role = roles.find(r => r.id === id);

    if (!role) {
      throw ApiError.notFound(`Role ${id} not found`);
    }

    res.json({
      success: true,
      data: { role },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// User Permission Management Routes

/**
 * @route POST /api/rbac/users/:userId/permissions
 * @desc Assign permissions to user
 * @access Admin
 */
router.post('/users/:userId/permissions',
  authMiddleware,
  requirePermission('security:manage_permissions'),
  moderateRateLimit,
  validateJsonSchema(assignPermissionsSchema),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { permissions, replace = false, expiresAt, reason } = req.body;
    const assignedBy = getUserId(req);

    const result = await rbacService.assignUserPermissions(userId, permissions, {
      replace,
      assignedBy,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      reason
    });

    res.json({
      success: true,
      data: result,
      message: 'Permissions assigned successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route GET /api/rbac/users/:userId/permissions
 * @desc Get user permissions
 * @access Self, Manager, or Admin
 */
router.get('/users/:userId/permissions',
  authMiddleware,
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const currentUserId = getUserId(req);

    // Check if user can view permissions
    const isViewingSelf = currentUserId === userId;
    const canViewAll = await rbacService.hasPermission(currentUserId, 'security:view_permissions');

    if (!isViewingSelf && !canViewAll) {
      throw ApiError.forbidden('Insufficient permissions to view user permissions');
    }

    const permissions = await rbacService.getUserPermissions(userId);

    res.json({
      success: true,
      data: { 
        userId,
        permissions,
        totalCount: permissions.length
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Permission Checking Routes

/**
 * @route POST /api/rbac/check-permission
 * @desc Check if user has specific permission
 * @access Authenticated
 */
router.post('/check-permission',
  authMiddleware,
  moderateRateLimit,
  validateJsonSchema({
    type: 'object',
    required: ['permission'],
    properties: {
      permission: { type: 'string' },
      userId: { type: 'string' },
      context: { type: 'object' }
    }
  }),
  asyncHandler(async (req, res) => {
    const { permission, userId, context = {} } = req.body;
    const currentUserId = getUserId(req);

    // Use provided userId or current user
    const targetUserId = userId || currentUserId;

    // Only allow checking other users' permissions if user has admin rights
    if (targetUserId !== currentUserId) {
      const canCheckOthers = await rbacService.hasPermission(currentUserId, 'security:view_permissions');
      if (!canCheckOthers) {
        throw ApiError.forbidden('Cannot check permissions for other users');
      }
    }

    const hasPermission = await rbacService.hasPermission(targetUserId, permission, {
      ...context,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: {
        userId: targetUserId,
        permission,
        hasPermission,
        checked: true
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route POST /api/rbac/check-permissions
 * @desc Check multiple permissions for user
 * @access Authenticated
 */
router.post('/check-permissions',
  authMiddleware,
  moderateRateLimit,
  validateJsonSchema({
    type: 'object',
    required: ['permissions'],
    properties: {
      permissions: { type: 'array', items: { type: 'string' } },
      userId: { type: 'string' },
      requireAll: { type: 'boolean' },
      context: { type: 'object' }
    }
  }),
  asyncHandler(async (req, res) => {
    const { permissions, userId, requireAll = true, context = {} } = req.body;
    const currentUserId = getUserId(req);

    // Use provided userId or current user
    const targetUserId = userId || currentUserId;

    // Only allow checking other users' permissions if user has admin rights
    if (targetUserId !== currentUserId) {
      const canCheckOthers = await rbacService.hasPermission(currentUserId, 'security:view_permissions');
      if (!canCheckOthers) {
        throw ApiError.forbidden('Cannot check permissions for other users');
      }
    }

    const contextWithRequest = {
      ...context,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    let hasAccess;
    const permissionResults = {};

    if (requireAll) {
      hasAccess = await rbacService.hasAllPermissions(targetUserId, permissions, contextWithRequest);
      // Get individual results for detailed response
      for (const permission of permissions) {
        permissionResults[permission] = await rbacService.hasPermission(targetUserId, permission, contextWithRequest);
      }
    } else {
      hasAccess = await rbacService.hasAnyPermission(targetUserId, permissions, contextWithRequest);
      // Get individual results for detailed response
      for (const permission of permissions) {
        permissionResults[permission] = await rbacService.hasPermission(targetUserId, permission, contextWithRequest);
      }
    }

    res.json({
      success: true,
      data: {
        userId: targetUserId,
        permissions,
        hasAccess,
        requireAll,
        results: permissionResults
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Feature Access Routes

/**
 * @route POST /api/rbac/check-feature
 * @desc Check if user can access specific feature
 * @access Authenticated
 */
router.post('/check-feature',
  authMiddleware,
  moderateRateLimit,
  validateJsonSchema({
    type: 'object',
    required: ['featureId'],
    properties: {
      featureId: { type: 'string' },
      userId: { type: 'string' },
      context: { type: 'object' }
    }
  }),
  asyncHandler(async (req, res) => {
    const { featureId, userId, context = {} } = req.body;
    const currentUserId = getUserId(req);

    // Use provided userId or current user
    const targetUserId = userId || currentUserId;

    // Only allow checking other users' features if user has admin rights
    if (targetUserId !== currentUserId) {
      const canCheckOthers = await rbacService.hasPermission(currentUserId, 'security:view_permissions');
      if (!canCheckOthers) {
        throw ApiError.forbidden('Cannot check feature access for other users');
      }
    }

    const canAccess = await rbacService.canAccessFeature(targetUserId, featureId, {
      ...context,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: {
        userId: targetUserId,
        featureId,
        canAccess,
        checked: true
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route GET /api/rbac/features
 * @desc Get available features and their access requirements
 * @access Authenticated
 */
router.get('/features',
  authMiddleware,
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const features = rbacService.getFeatureControls();

    res.json({
      success: true,
      data: { features },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Data Access Policy Routes

/**
 * @route GET /api/rbac/data-policies
 * @desc Get available data access policies
 * @access Manager+
 */
router.get('/data-policies',
  authMiddleware,
  requirePermission('security:view_permissions'),
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const policies = rbacService.getDataAccessPolicies();

    res.json({
      success: true,
      data: { policies },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route POST /api/rbac/apply-data-policy
 * @desc Apply data access policy to query
 * @access Authenticated (for own data) or Manager+ (for others)
 */
router.post('/apply-data-policy',
  authMiddleware,
  moderateRateLimit,
  validateJsonSchema({
    type: 'object',
    required: ['policyId'],
    properties: {
      policyId: { type: 'string' },
      query: { type: 'object' },
      userId: { type: 'string' },
      context: { type: 'object' }
    }
  }),
  asyncHandler(async (req, res) => {
    const { policyId, query = {}, userId, context = {} } = req.body;
    const currentUserId = getUserId(req);

    // Use provided userId or current user
    const targetUserId = userId || currentUserId;

    // Only allow applying policies for other users if user has appropriate permissions
    if (targetUserId !== currentUserId) {
      const canManagePolicies = await rbacService.hasPermission(currentUserId, 'security:manage_policies');
      if (!canManagePolicies) {
        throw ApiError.forbidden('Cannot apply data policies for other users');
      }
    }

    const filteredQuery = await rbacService.applyDataPolicy(targetUserId, policyId, query, {
      ...context,
      appliedBy: currentUserId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: {
        userId: targetUserId,
        policyId,
        originalQuery: query,
        filteredQuery,
        applied: true
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// API Authorization Routes

/**
 * @route POST /api/rbac/authorize-request
 * @desc Authorize API request based on user permissions
 * @access Authenticated
 */
router.post('/authorize-request',
  authMiddleware,
  moderateRateLimit,
  validateJsonSchema({
    type: 'object',
    required: ['method', 'endpoint'],
    properties: {
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
      endpoint: { type: 'string' },
      userId: { type: 'string' },
      context: { type: 'object' }
    }
  }),
  asyncHandler(async (req, res) => {
    const { method, endpoint, userId, context = {} } = req.body;
    const currentUserId = getUserId(req);

    // Use provided userId or current user
    const targetUserId = userId || currentUserId;

    // Only allow authorizing for other users if user has admin rights
    if (targetUserId !== currentUserId) {
      const canAuthorizeOthers = await rbacService.hasPermission(currentUserId, 'security:manage_permissions');
      if (!canAuthorizeOthers) {
        throw ApiError.forbidden('Cannot authorize requests for other users');
      }
    }

    const authorization = await rbacService.authorizeAPIRequest(targetUserId, method, endpoint, {
      ...context,
      authorizedBy: currentUserId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: {
        userId: targetUserId,
        method,
        endpoint,
        ...authorization
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Session Management Routes

/**
 * @route POST /api/rbac/sessions
 * @desc Start secure session with permission caching
 * @access Authenticated
 */
router.post('/sessions',
  authMiddleware,
  moderateRateLimit,
  validateJsonSchema({
    type: 'object',
    required: ['sessionId'],
    properties: {
      sessionId: { type: 'string' },
      mfaVerified: { type: 'boolean' },
      deviceTrusted: { type: 'boolean' },
      cachePermissions: { type: 'boolean' },
      sessionTimeout: { type: 'number' }
    }
  }),
  asyncHandler(async (req, res) => {
    const { 
      sessionId, 
      mfaVerified = false, 
      deviceTrusted = false,
      cachePermissions = true,
      sessionTimeout = 8 * 60 * 60 * 1000 
    } = req.body;
    
    const userId = getUserId(req);

    const sessionData = {
      sessionId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      mfaVerified,
      deviceTrusted
    };

    const result = await rbacService.startSecureSession(userId, sessionData, {
      cachePermissions,
      sessionTimeout
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Secure session started successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Audit and Compliance Routes

/**
 * @route GET /api/rbac/audit
 * @desc Get audit log
 * @access Admin
 */
router.get('/audit',
  authMiddleware,
  requirePermission('security:view_audit'),
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const {
      userId,
      eventType,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = req.query;

    const auditLog = await rbacService.getAuditLog({
      userId,
      eventType,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: auditLog,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route POST /api/rbac/compliance-report
 * @desc Generate security compliance report
 * @access Admin
 */
router.post('/compliance-report',
  authMiddleware,
  requirePermission('security:view_audit'),
  moderateRateLimit,
  validateJsonSchema({
    type: 'object',
    properties: {
      timeframe: { 
        type: 'string', 
        enum: ['day', 'week', 'month', 'quarter', 'year'] 
      },
      includeDetails: { type: 'boolean' },
      format: { 
        type: 'string', 
        enum: ['json', 'pdf', 'csv'] 
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const { 
      timeframe = 'month', 
      includeDetails = false,
      format = 'json'
    } = req.body;

    const report = await rbacService.generateComplianceReport(timeframe, {
      includeDetails,
      format
    });

    res.json({
      success: true,
      data: {
        reportId: report.reportId,
        downloadUrl: `/api/rbac/reports/${report.reportId}`,
        report: format === 'json' ? report : undefined
      },
      message: 'Compliance report generated successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// System Information Routes

/**
 * @route GET /api/rbac/stats
 * @desc Get RBAC system statistics
 * @access Admin
 */
router.get('/stats',
  authMiddleware,
  requirePermission('security:view_audit'),
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const stats = rbacService.getSystemStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route GET /api/rbac/health
 * @desc Check RBAC service health
 * @access Authenticated
 */
router.get('/health',
  authMiddleware,
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        permissionChecking: 'operational',
        auditLogging: 'operational',
        sessionManagement: 'operational',
        dataFiltering: 'operational'
      },
      metrics: rbacService.getSystemStats()
    };

    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Helper function
function getUserId(req) {
  if (req.auth?.user?.id) {
    return req.auth.user.id;
  }
  
  if (req.auth?.user?.sub) {
    return req.auth.user.sub;
  }
  
  if (req.auth?.key) {
    return `api_user_${req.auth.key.slice(-8)}`;
  }
  
  throw ApiError.unauthorized('User identification required');
}

export default router;