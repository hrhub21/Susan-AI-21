import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateJsonSchema } from '../middleware/validation.js';
import { moderateRateLimit, strictRateLimit } from '../middleware/rateLimit.js';
import { authMiddleware, adminAuthMiddleware } from '../middleware/auth.js';
import { ApiError } from '../utils/ApiError.js';
import { EnterpriseUserManagementService } from '../services/EnterpriseUserManagementService.js';
import { RoleBasedAccessControlService } from '../services/RoleBasedAccessControlService.js';

const router = express.Router();
const enterpriseService = new EnterpriseUserManagementService();
const rbacService = new RoleBasedAccessControlService();

// Middleware to check enterprise permissions
const requirePermission = (permission) => {
  return asyncHandler(async (req, res, next) => {
    const userId = getUserId(req);
    const hasPermission = await rbacService.hasPermission(userId, permission, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (!hasPermission) {
      throw ApiError.forbidden(`Insufficient permissions: ${permission} required`);
    }

    next();
  });
};

// Validation schemas
const createOrganizationSchema = {
  type: 'object',
  required: ['name', 'type', 'adminUser'],
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 100 },
    type: { 
      type: 'string', 
      enum: ['insurance_company', 'adjusting_firm', 'roofing_company', 'restoration_company'] 
    },
    domain: { type: 'string', pattern: '^[a-zA-Z0-9.-]+$' },
    adminUser: {
      type: 'object',
      required: ['email', 'firstName', 'lastName'],
      properties: {
        email: { type: 'string', format: 'email' },
        firstName: { type: 'string', minLength: 1, maxLength: 50 },
        lastName: { type: 'string', minLength: 1, maxLength: 50 }
      }
    },
    settings: { type: 'object' }
  }
};

const createTeamSchema = {
  type: 'object',
  required: ['name', 'organizationId'],
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 100 },
    description: { type: 'string', maxLength: 500 },
    organizationId: { type: 'string' },
    managerId: { type: 'string' },
    members: { type: 'array', items: { type: 'string' } },
    permissions: { type: 'array', items: { type: 'string' } },
    settings: { type: 'object' }
  }
};

const createUserSchema = {
  type: 'object',
  required: ['email', 'firstName', 'lastName', 'role', 'organizationId'],
  properties: {
    email: { type: 'string', format: 'email' },
    firstName: { type: 'string', minLength: 1, maxLength: 50 },
    lastName: { type: 'string', minLength: 1, maxLength: 50 },
    role: { 
      type: 'string',
      enum: ['client', 'contractor', 'inspector', 'adjuster', 'manager', 'admin']
    },
    organizationId: { type: 'string' },
    teamIds: { type: 'array', items: { type: 'string' } },
    permissions: { type: 'array', items: { type: 'string' } },
    settings: { type: 'object' },
    isOrgAdmin: { type: 'boolean' }
  }
};

// Organization Management Routes

/**
 * @route POST /api/enterprise/organizations
 * @desc Create a new organization
 * @access Admin
 */
router.post('/organizations',
  authMiddleware,
  requirePermission('organizations:create'),
  moderateRateLimit,
  validateJsonSchema(createOrganizationSchema),
  asyncHandler(async (req, res) => {
    const organizationData = req.body;
    const options = {
      autoSetupTeams: req.body.autoSetupTeams !== false,
      sendInvitations: req.body.sendInvitations !== false
    };

    const result = await enterpriseService.createOrganization(organizationData, options);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Organization created successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route GET /api/enterprise/organizations/:id
 * @desc Get organization details
 * @access Manager+
 */
router.get('/organizations/:id',
  authMiddleware,
  requirePermission('organizations:view'),
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { includeTeams = false, includeUsers = false } = req.query;

    const organization = await enterpriseService.getOrganization(id);
    if (!organization) {
      throw ApiError.notFound(`Organization ${id} not found`);
    }

    const responseData = { ...organization };

    if (includeTeams === 'true') {
      responseData.teams = await enterpriseService.getTeamsByOrganization(id);
    }

    if (includeUsers === 'true') {
      responseData.users = await enterpriseService.getUsersByOrganization(id);
    }

    res.json({
      success: true,
      data: responseData,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route GET /api/enterprise/organizations/:id/analytics
 * @desc Get organization analytics
 * @access Manager+
 */
router.get('/organizations/:id/analytics',
  authMiddleware,
  requirePermission('analytics:view_advanced'),
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
      timeframe = 'month',
      includeTeamBreakdown = true,
      includeUserMetrics = true 
    } = req.query;

    const analytics = await enterpriseService.getOrganizationAnalytics(id, {
      timeframe,
      includeTeamBreakdown: includeTeamBreakdown === 'true',
      includeUserMetrics: includeUserMetrics === 'true'
    });

    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Team Management Routes

/**
 * @route POST /api/enterprise/teams
 * @desc Create a new team
 * @access Manager+
 */
router.post('/teams',
  authMiddleware,
  requirePermission('teams:create'),
  moderateRateLimit,
  validateJsonSchema(createTeamSchema),
  asyncHandler(async (req, res) => {
    const teamData = req.body;
    const options = {
      autoAssignMembers: req.body.autoAssignMembers !== false,
      notifyMembers: req.body.notifyMembers !== false
    };

    const result = await enterpriseService.createTeam(teamData, options);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Team created successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route GET /api/enterprise/teams/:id
 * @desc Get team details
 * @access Team Member or Manager+
 */
router.get('/teams/:id',
  authMiddleware,
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = getUserId(req);
    
    // Check if user can view this team
    const hasPermission = await rbacService.hasAnyPermission(userId, [
      'teams:view_all',
      'teams:view_own'
    ]);

    if (!hasPermission) {
      throw ApiError.forbidden('Insufficient permissions to view team');
    }

    const team = await enterpriseService.getTeam(id);
    if (!team) {
      throw ApiError.notFound(`Team ${id} not found`);
    }

    // Check if user is team member for 'view_own' permission
    const isTeamMember = team.members.some(member => member.userId === userId);
    const canViewAll = await rbacService.hasPermission(userId, 'teams:view_all');

    if (!canViewAll && !isTeamMember) {
      throw ApiError.forbidden('You can only view teams you are a member of');
    }

    res.json({
      success: true,
      data: team,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route POST /api/enterprise/teams/:id/members
 * @desc Add member to team
 * @access Team Manager or Admin
 */
router.post('/teams/:id/members',
  authMiddleware,
  requirePermission('teams:manage_members'),
  moderateRateLimit,
  validateJsonSchema({
    type: 'object',
    required: ['userId'],
    properties: {
      userId: { type: 'string' },
      role: { type: 'string', enum: ['member', 'lead', 'manager'] },
      permissions: { type: 'array', items: { type: 'string' } }
    }
  }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { userId, role = 'member', permissions = [] } = req.body;

    const result = await enterpriseService.addTeamMember(id, userId, {
      role,
      permissions,
      notifyMember: true
    });

    res.status(201).json({
      success: true,
      data: result,
      message: 'Team member added successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// User Management Routes

/**
 * @route POST /api/enterprise/users
 * @desc Create a new user
 * @access Admin or Manager
 */
router.post('/users',
  authMiddleware,
  requirePermission('users:create'),
  moderateRateLimit,
  validateJsonSchema(createUserSchema),
  asyncHandler(async (req, res) => {
    const userData = req.body;
    const createdBy = getUserId(req);
    
    const options = {
      sendWelcomeEmail: req.body.sendWelcomeEmail !== false,
      requirePasswordReset: req.body.requirePasswordReset !== false,
      autoActivate: req.body.autoActivate !== false,
      createdBy
    };

    const result = await enterpriseService.createUser(userData, options);

    res.status(201).json({
      success: true,
      data: result,
      message: 'User created successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route GET /api/enterprise/users/:id
 * @desc Get user details
 * @access Self, Team Manager, or Admin
 */
router.get('/users/:id',
  authMiddleware,
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const currentUserId = getUserId(req);

    // Check permissions
    const canViewAll = await rbacService.hasPermission(currentUserId, 'users:view_all');
    const canViewTeam = await rbacService.hasPermission(currentUserId, 'users:view_team');
    const isViewingSelf = currentUserId === id;

    if (!canViewAll && !canViewTeam && !isViewingSelf) {
      throw ApiError.forbidden('Insufficient permissions to view user');
    }

    const user = await enterpriseService.getUser(id);
    if (!user) {
      throw ApiError.notFound(`User ${id} not found`);
    }

    // Additional team-based access check for 'view_team' permission
    if (canViewTeam && !canViewAll && !isViewingSelf) {
      // Implementation would check if users are on same team
      // For now, allow if user has view_team permission
    }

    res.json({
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route PUT /api/enterprise/users/:id
 * @desc Update user information
 * @access Self (limited), Manager, or Admin
 */
router.put('/users/:id',
  authMiddleware,
  moderateRateLimit,
  validateJsonSchema({
    type: 'object',
    properties: {
      firstName: { type: 'string', minLength: 1, maxLength: 50 },
      lastName: { type: 'string', minLength: 1, maxLength: 50 },
      role: { 
        type: 'string',
        enum: ['client', 'contractor', 'inspector', 'adjuster', 'manager', 'admin']
      },
      permissions: { type: 'array', items: { type: 'string' } },
      settings: { type: 'object' },
      status: { type: 'string', enum: ['active', 'inactive', 'suspended'] }
    }
  }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const currentUserId = getUserId(req);
    const updates = req.body;

    // Check permissions based on update type
    const isUpdatingSelf = currentUserId === id;
    const canEditAll = await rbacService.hasPermission(currentUserId, 'users:edit_all');
    const canEditTeam = await rbacService.hasPermission(currentUserId, 'users:edit_team');
    const canEditOwn = await rbacService.hasPermission(currentUserId, 'users:edit_own');

    if (!canEditAll && !canEditTeam && (!isUpdatingSelf || !canEditOwn)) {
      throw ApiError.forbidden('Insufficient permissions to update user');
    }

    // Restrict self-updates to safe fields only
    if (isUpdatingSelf && !canEditAll && !canEditTeam) {
      const allowedSelfUpdates = ['firstName', 'lastName', 'settings'];
      const updateKeys = Object.keys(updates);
      const invalidUpdates = updateKeys.filter(key => !allowedSelfUpdates.includes(key));
      
      if (invalidUpdates.length > 0) {
        throw ApiError.forbidden(`Cannot update fields: ${invalidUpdates.join(', ')}`);
      }
    }

    const result = await enterpriseService.updateUser(id, updates, {
      updatedBy: currentUserId,
      validatePermissions: true
    });

    res.json({
      success: true,
      data: result,
      message: 'User updated successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route GET /api/enterprise/users/:id/analytics
 * @desc Get user analytics and performance metrics
 * @access Self, Manager, or Admin
 */
router.get('/users/:id/analytics',
  authMiddleware,
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const currentUserId = getUserId(req);
    const {
      timeframe = 'month',
      includeTeamComparison = false,
      includeActivities = false
    } = req.query;

    // Check permissions
    const isViewingSelf = currentUserId === id;
    const canViewAnalytics = await rbacService.hasAnyPermission(currentUserId, [
      'analytics:view_advanced',
      'users:view_all'
    ]);

    if (!isViewingSelf && !canViewAnalytics) {
      throw ApiError.forbidden('Insufficient permissions to view user analytics');
    }

    const analytics = await enterpriseService.getUserAnalytics(id, {
      timeframe,
      includeTeamComparison: includeTeamComparison === 'true',
      includeActivities: includeActivities === 'true'
    });

    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route POST /api/enterprise/users/:id/reports
 * @desc Generate user performance report
 * @access Manager or Admin
 */
router.post('/users/:id/reports',
  authMiddleware,
  requirePermission('reports:create_advanced'),
  moderateRateLimit,
  validateJsonSchema({
    type: 'object',
    properties: {
      reportType: { 
        type: 'string', 
        enum: ['comprehensive', 'performance', 'activity', 'compliance'] 
      },
      timeframe: { 
        type: 'string', 
        enum: ['week', 'month', 'quarter', 'year'] 
      },
      format: { 
        type: 'string', 
        enum: ['json', 'pdf', 'csv'] 
      }
    }
  }),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
      reportType = 'comprehensive', 
      timeframe = 'month',
      format = 'json'
    } = req.body;

    const report = await enterpriseService.generateUserReport(id, reportType, timeframe);

    res.json({
      success: true,
      data: {
        reportId: report.reportId,
        downloadUrl: `/api/enterprise/reports/${report.reportId}`,
        report: format === 'json' ? report : undefined
      },
      message: 'Report generated successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// List and Search Routes

/**
 * @route GET /api/enterprise/organizations
 * @desc List organizations with filtering
 * @access Admin
 */
router.get('/organizations',
  authMiddleware,
  requirePermission('organizations:view'),
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      search
    } = req.query;

    // Mock implementation - would implement actual filtering and pagination
    const organizations = Array.from(enterpriseService.organizations.values());
    
    let filteredOrgs = organizations;
    
    if (type) {
      filteredOrgs = filteredOrgs.filter(org => org.type === type);
    }
    
    if (status) {
      filteredOrgs = filteredOrgs.filter(org => org.status === status);
    }
    
    if (search) {
      filteredOrgs = filteredOrgs.filter(org => 
        org.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedOrgs = filteredOrgs.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        organizations: paginatedOrgs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(filteredOrgs.length / limit),
          totalCount: filteredOrgs.length,
          hasNext: endIndex < filteredOrgs.length,
          hasPrev: startIndex > 0
        }
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route GET /api/enterprise/users
 * @desc List users with filtering
 * @access Manager+
 */
router.get('/users',
  authMiddleware,
  requirePermission('users:view_all'),
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      organizationId,
      role,
      status,
      search
    } = req.query;

    const users = enterpriseService.getUsersByOrganization(organizationId || null);
    
    let filteredUsers = users;
    
    if (role) {
      filteredUsers = filteredUsers.filter(user => user.role === role);
    }
    
    if (status) {
      filteredUsers = filteredUsers.filter(user => user.status === status);
    }
    
    if (search) {
      filteredUsers = filteredUsers.filter(user => 
        user.fullName.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase())
      );
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        users: paginatedUsers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(filteredUsers.length / limit),
          totalCount: filteredUsers.length,
          hasNext: endIndex < filteredUsers.length,
          hasPrev: startIndex > 0
        }
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route GET /api/enterprise/teams
 * @desc List teams with filtering
 * @access Manager+
 */
router.get('/teams',
  authMiddleware,
  requirePermission('teams:view_all'),
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      organizationId,
      status,
      search
    } = req.query;

    const teams = enterpriseService.getTeamsByOrganization(organizationId || null);
    
    let filteredTeams = teams;
    
    if (status) {
      filteredTeams = filteredTeams.filter(team => team.status === status);
    }
    
    if (search) {
      filteredTeams = filteredTeams.filter(team => 
        team.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedTeams = filteredTeams.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        teams: paginatedTeams,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(filteredTeams.length / limit),
          totalCount: filteredTeams.length,
          hasNext: endIndex < filteredTeams.length,
          hasPrev: startIndex > 0
        }
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// System Information Routes

/**
 * @route GET /api/enterprise/roles
 * @desc Get available user roles
 * @access Authenticated
 */
router.get('/roles',
  authMiddleware,
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const roles = enterpriseService.getUserRoles();

    res.json({
      success: true,
      data: { roles },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route GET /api/enterprise/organization-types
 * @desc Get available organization types
 * @access Authenticated
 */
router.get('/organization-types',
  authMiddleware,
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const organizationTypes = enterpriseService.getOrganizationTypes();

    res.json({
      success: true,
      data: { organizationTypes },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @route GET /api/enterprise/stats
 * @desc Get enterprise system statistics
 * @access Admin
 */
router.get('/stats',
  authMiddleware,
  requirePermission('analytics:view_advanced'),
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const stats = enterpriseService.getSystemStats();

    res.json({
      success: true,
      data: stats,
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
  
  if (req.auth?.key) {
    return `api_user_${req.auth.key.slice(-8)}`;
  }
  
  throw ApiError.unauthorized('User identification required');
}

export default router;