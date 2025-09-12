import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

// Try to import bcrypt, fallback to mock if not available
let bcrypt;
try {
  bcrypt = await import('bcrypt');
} catch (error) {
  console.warn('⚠️ bcrypt not installed, using mock implementation for development');
  bcrypt = {
    hash: async (password, rounds) => `mock_hash_${password}`,
    compare: async (password, hash) => hash === `mock_hash_${password}`,
    hashSync: (password, rounds) => `mock_hash_${password}`
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class EnterpriseUserManagementService extends EventEmitter {
  constructor() {
    super();
    this.dataDir = path.join(__dirname, '../../../data/enterprise');
    this.usersDir = path.join(this.dataDir, 'users');
    this.teamsDir = path.join(this.dataDir, 'teams');
    this.organizationsDir = path.join(this.dataDir, 'organizations');
    this.activitiesDir = path.join(this.dataDir, 'activities');
    this.analyticsDir = path.join(this.dataDir, 'analytics');
    
    // In-memory stores for performance
    this.users = new Map();
    this.teams = new Map();
    this.organizations = new Map();
    this.userActivities = new Map();
    this.userAnalytics = new Map();
    this.userSessions = new Map();
    this.teamMemberships = new Map();
    this.organizationHierarchy = new Map();
    
    // User roles and their hierarchical levels
    this.userRoles = new Map([
      ['client', {
        id: 'client',
        name: 'Client',
        level: 1,
        description: 'Insurance client or property owner',
        permissions: [
          'claims:view_own',
          'documents:upload',
          'reports:view_own',
          'notifications:receive'
        ],
        features: ['basic_claims', 'document_upload', 'basic_reports']
      }],
      ['contractor', {
        id: 'contractor',
        name: 'Contractor',
        level: 2,
        description: 'External contractor or service provider',
        permissions: [
          'claims:view_assigned',
          'documents:upload',
          'documents:view_assigned',
          'reports:create_basic',
          'estimates:create',
          'photos:upload'
        ],
        features: ['contractor_tools', 'estimate_creation', 'photo_analysis']
      }],
      ['inspector', {
        id: 'inspector',
        name: 'Inspector',
        level: 3,
        description: 'Field inspector for damage assessment',
        permissions: [
          'claims:view_assigned',
          'claims:inspect',
          'documents:view',
          'documents:upload',
          'reports:create',
          'photos:analyze',
          'estimates:review',
          'compliance:check'
        ],
        features: ['inspection_tools', 'damage_analysis', 'compliance_check', 'ai_assistant']
      }],
      ['adjuster', {
        id: 'adjuster',
        name: 'Adjuster',
        level: 4,
        description: 'Insurance adjuster handling claims',
        permissions: [
          'claims:view',
          'claims:edit',
          'claims:assign',
          'documents:view',
          'documents:edit',
          'reports:view',
          'reports:edit',
          'estimates:review',
          'estimates:approve',
          'analytics:view_basic',
          'teams:view_own'
        ],
        features: ['claim_management', 'advanced_analytics', 'team_collaboration', 'ai_insights']
      }],
      ['manager', {
        id: 'manager',
        name: 'Manager',
        level: 5,
        description: 'Team or department manager',
        permissions: [
          'claims:view_all',
          'claims:edit_all',
          'claims:assign_all',
          'documents:view_all',
          'documents:manage',
          'reports:view_all',
          'reports:create_advanced',
          'analytics:view_advanced',
          'teams:manage',
          'users:view_team',
          'users:edit_team',
          'workflows:manage'
        ],
        features: ['team_management', 'advanced_reports', 'workflow_automation', 'performance_analytics']
      }],
      ['admin', {
        id: 'admin',
        name: 'Administrator',
        level: 6,
        description: 'System administrator with full access',
        permissions: [
          'claims:*',
          'documents:*',
          'reports:*',
          'analytics:*',
          'teams:*',
          'users:*',
          'organizations:*',
          'settings:*',
          'security:*',
          'billing:*',
          'integrations:*'
        ],
        features: ['full_access', 'system_administration', 'security_management', 'billing_management']
      }]
    ]);

    // Organization types and structures
    this.organizationTypes = new Map([
      ['insurance_company', {
        id: 'insurance_company',
        name: 'Insurance Company',
        defaultHierarchy: ['admin', 'manager', 'adjuster', 'inspector'],
        features: ['claims_processing', 'customer_management', 'analytics', 'compliance']
      }],
      ['adjusting_firm', {
        id: 'adjusting_firm',
        name: 'Independent Adjusting Firm',
        defaultHierarchy: ['admin', 'manager', 'adjuster'],
        features: ['multi_carrier_support', 'contractor_network', 'mobile_tools']
      }],
      ['roofing_company', {
        id: 'roofing_company',
        name: 'Roofing Company',
        defaultHierarchy: ['admin', 'manager', 'contractor', 'inspector'],
        features: ['estimate_tools', 'material_database', 'project_management']
      }],
      ['restoration_company', {
        id: 'restoration_company',
        name: 'Restoration Company',
        defaultHierarchy: ['admin', 'manager', 'contractor'],
        features: ['damage_assessment', 'project_tracking', 'client_communication']
      }]
    ]);

    this.ensureDirectories();
    this.loadExistingData();
    this.setupAnalyticsTracking();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.dataDir);
    await fs.ensureDir(this.usersDir);
    await fs.ensureDir(this.teamsDir);
    await fs.ensureDir(this.organizationsDir);
    await fs.ensureDir(this.activitiesDir);
    await fs.ensureDir(this.analyticsDir);
  }

  /**
   * Create a new organization
   */
  async createOrganization(organizationData, options = {}) {
    const {
      name,
      type,
      domain,
      tenantId,
      settings = {},
      adminUser,
      customHierarchy = null
    } = organizationData;

    const {
      autoSetupTeams = true,
      sendInvitations = true
    } = options;

    const organizationId = this.generateOrganizationId();

    try {
      // Validate organization type
      const orgType = this.organizationTypes.get(type);
      if (!orgType) {
        throw new Error(`Invalid organization type: ${type}`);
      }

      // Create organization record
      const organization = {
        id: organizationId,
        name,
        type,
        domain,
        tenantId,
        settings: {
          timezone: 'UTC',
          businessHours: {
            start: '09:00',
            end: '17:00',
            days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
          },
          notifications: {
            email: true,
            sms: false,
            push: true
          },
          features: orgType.features,
          ...settings
        },
        hierarchy: customHierarchy || orgType.defaultHierarchy,
        metadata: {
          createdAt: new Date(),
          createdBy: adminUser?.id,
          lastUpdated: new Date()
        },
        status: 'active',
        stats: {
          totalUsers: 0,
          totalTeams: 0,
          activeUsers: 0,
          lastActivity: null
        }
      };

      // Store organization
      this.organizations.set(organizationId, organization);
      await this.saveOrganization(organization);

      // Create default teams if requested
      if (autoSetupTeams) {
        await this.createDefaultTeams(organizationId, organization);
      }

      // Create admin user if provided
      if (adminUser) {
        await this.createUser({
          ...adminUser,
          organizationId,
          role: 'admin',
          isOrgAdmin: true
        });
      }

      logger.info('Organization created', {
        organizationId,
        name,
        type,
        tenantId,
        adminUserId: adminUser?.id
      });

      this.emit('organization:created', { organizationId, organization });

      return {
        organizationId,
        organization,
        message: 'Organization created successfully'
      };

    } catch (error) {
      logger.error('Failed to create organization', {
        name,
        type,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create a new team within an organization
   */
  async createTeam(teamData, options = {}) {
    const {
      name,
      description,
      organizationId,
      managerId,
      members = [],
      permissions = [],
      settings = {}
    } = teamData;

    const {
      autoAssignMembers = true,
      notifyMembers = true
    } = options;

    const teamId = this.generateTeamId();

    try {
      // Validate organization exists
      const organization = this.organizations.get(organizationId);
      if (!organization) {
        throw ApiError.notFound(`Organization ${organizationId} not found`);
      }

      // Validate manager exists and has proper role
      if (managerId) {
        const manager = this.users.get(managerId);
        if (!manager) {
          throw ApiError.notFound(`Manager ${managerId} not found`);
        }
        if (!this.canManageTeam(manager.role)) {
          throw ApiError.forbidden('User does not have team management permissions');
        }
      }

      // Create team record
      const team = {
        id: teamId,
        name,
        description,
        organizationId,
        managerId,
        members: [],
        permissions,
        settings: {
          visibility: 'private',
          joinRequiresApproval: true,
          allowMemberInvites: false,
          ...settings
        },
        metadata: {
          createdAt: new Date(),
          createdBy: managerId,
          lastUpdated: new Date()
        },
        status: 'active',
        stats: {
          totalMembers: 0,
          activeMembers: 0,
          lastActivity: null,
          projectsCount: 0,
          claimsCount: 0
        }
      };

      // Store team
      this.teams.set(teamId, team);
      await this.saveTeam(team);

      // Add members if provided
      if (autoAssignMembers && members.length > 0) {
        for (const memberId of members) {
          await this.addTeamMember(teamId, memberId, { notifyMember: notifyMembers });
        }
      }

      // Update organization stats
      organization.stats.totalTeams++;
      await this.saveOrganization(organization);

      logger.info('Team created', {
        teamId,
        name,
        organizationId,
        managerId,
        memberCount: members.length
      });

      this.emit('team:created', { teamId, team });

      return {
        teamId,
        team,
        message: 'Team created successfully'
      };

    } catch (error) {
      logger.error('Failed to create team', {
        name,
        organizationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create a new user in the enterprise system
   */
  async createUser(userData, options = {}) {
    const {
      email,
      firstName,
      lastName,
      role,
      organizationId,
      teamIds = [],
      permissions = [],
      settings = {},
      isOrgAdmin = false,
      temporaryPassword = null
    } = userData;

    const {
      sendWelcomeEmail = true,
      requirePasswordReset = true,
      autoActivate = true
    } = options;

    const userId = this.generateUserId();

    try {
      // Validate email uniqueness
      if (this.isEmailTaken(email)) {
        throw ApiError.conflict(`Email ${email} is already in use`);
      }

      // Validate role
      const roleConfig = this.userRoles.get(role);
      if (!roleConfig) {
        throw ApiError.badRequest(`Invalid role: ${role}`);
      }

      // Validate organization
      const organization = this.organizations.get(organizationId);
      if (!organization) {
        throw ApiError.notFound(`Organization ${organizationId} not found`);
      }

      // Generate temporary password if not provided
      const password = temporaryPassword || this.generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(password, 12);

      // Determine effective permissions
      const effectivePermissions = [
        ...roleConfig.permissions,
        ...permissions
      ];

      // Create user record
      const user = {
        id: userId,
        email,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        role,
        organizationId,
        tenantId: organization.tenantId,
        permissions: effectivePermissions,
        features: roleConfig.features,
        isOrgAdmin,
        passwordHash,
        teams: [],
        settings: {
          timezone: organization.settings.timezone,
          language: 'en',
          theme: 'light',
          notifications: {
            email: true,
            sms: false,
            push: true,
            frequency: 'immediate'
          },
          dashboard: {
            layout: 'default',
            widgets: this.getDefaultWidgets(role)
          },
          ...settings
        },
        security: {
          mfaEnabled: false,
          lastPasswordChange: new Date(),
          requirePasswordReset,
          failedLoginAttempts: 0,
          lastLoginAt: null,
          lastActiveAt: null,
          trustedDevices: []
        },
        metadata: {
          createdAt: new Date(),
          createdBy: options.createdBy || 'system',
          lastUpdated: new Date(),
          source: 'enterprise_admin'
        },
        status: autoActivate ? 'active' : 'pending',
        profile: {
          avatar: null,
          bio: null,
          phone: null,
          department: null,
          jobTitle: null,
          location: null,
          emergencyContact: null
        }
      };

      // Store user
      this.users.set(userId, user);
      await this.saveUser(user);

      // Add to teams if specified
      for (const teamId of teamIds) {
        await this.addTeamMember(teamId, userId, { notifyMember: false });
      }

      // Initialize user analytics
      await this.initializeUserAnalytics(userId);

      // Update organization stats
      organization.stats.totalUsers++;
      if (autoActivate) {
        organization.stats.activeUsers++;
      }
      await this.saveOrganization(organization);

      // Send welcome email if requested
      if (sendWelcomeEmail) {
        await this.sendWelcomeEmail(user, password);
      }

      // Log user creation activity
      await this.logActivity({
        type: 'user_created',
        userId,
        organizationId,
        metadata: { role, isOrgAdmin, createdBy: options.createdBy }
      });

      logger.info('User created', {
        userId,
        email,
        role,
        organizationId,
        isOrgAdmin
      });

      this.emit('user:created', { userId, user });

      return {
        userId,
        user: this.sanitizeUser(user),
        temporaryPassword: requirePasswordReset ? password : undefined,
        message: 'User created successfully'
      };

    } catch (error) {
      logger.error('Failed to create user', {
        email,
        role,
        organizationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update user information and permissions
   */
  async updateUser(userId, updates, options = {}) {
    const { updatedBy, validatePermissions = true } = options;

    try {
      const user = this.users.get(userId);
      if (!user) {
        throw ApiError.notFound(`User ${userId} not found`);
      }

      // Validate role change if requested
      if (updates.role && updates.role !== user.role) {
        await this.validateRoleChange(userId, user.role, updates.role, updatedBy);
      }

      // Update user data
      const updatedUser = {
        ...user,
        ...updates,
        metadata: {
          ...user.metadata,
          lastUpdated: new Date(),
          updatedBy
        }
      };

      // Update permissions if role changed
      if (updates.role) {
        const roleConfig = this.userRoles.get(updates.role);
        updatedUser.permissions = [
          ...roleConfig.permissions,
          ...(updates.permissions || [])
        ];
        updatedUser.features = roleConfig.features;
      }

      this.users.set(userId, updatedUser);
      await this.saveUser(updatedUser);

      // Log update activity
      await this.logActivity({
        type: 'user_updated',
        userId,
        organizationId: user.organizationId,
        metadata: { updates: Object.keys(updates), updatedBy }
      });

      logger.info('User updated', {
        userId,
        updates: Object.keys(updates),
        updatedBy
      });

      this.emit('user:updated', { userId, user: updatedUser, updates });

      return {
        userId,
        user: this.sanitizeUser(updatedUser),
        message: 'User updated successfully'
      };

    } catch (error) {
      logger.error('Failed to update user', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Add a user to a team
   */
  async addTeamMember(teamId, userId, options = {}) {
    const { role = 'member', permissions = [], notifyMember = true } = options;

    try {
      const team = this.teams.get(teamId);
      if (!team) {
        throw ApiError.notFound(`Team ${teamId} not found`);
      }

      const user = this.users.get(userId);
      if (!user) {
        throw ApiError.notFound(`User ${userId} not found`);
      }

      // Check if user is already a member
      if (team.members.some(member => member.userId === userId)) {
        throw ApiError.conflict('User is already a team member');
      }

      // Add member to team
      const membership = {
        userId,
        role,
        permissions,
        joinedAt: new Date(),
        status: 'active'
      };

      team.members.push(membership);
      team.stats.totalMembers++;
      team.stats.activeMembers++;
      team.metadata.lastUpdated = new Date();

      // Add team to user's teams list
      if (!user.teams.includes(teamId)) {
        user.teams.push(teamId);
      }

      // Store membership mapping
      const membershipKey = `${userId}:${teamId}`;
      this.teamMemberships.set(membershipKey, membership);

      await this.saveTeam(team);
      await this.saveUser(user);

      // Send notification if requested
      if (notifyMember) {
        await this.sendTeamInviteNotification(user, team);
      }

      // Log activity
      await this.logActivity({
        type: 'team_member_added',
        userId,
        organizationId: user.organizationId,
        metadata: { teamId, teamName: team.name, role }
      });

      logger.info('Team member added', {
        teamId,
        userId,
        role,
        teamName: team.name
      });

      this.emit('team:member_added', { teamId, userId, membership });

      return {
        teamId,
        userId,
        membership,
        message: 'User added to team successfully'
      };

    } catch (error) {
      logger.error('Failed to add team member', {
        teamId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Track user activity for analytics and monitoring
   */
  async logActivity(activityData) {
    const {
      type,
      userId,
      organizationId,
      metadata = {},
      timestamp = new Date(),
      ipAddress = null,
      userAgent = null
    } = activityData;

    try {
      const activityId = this.generateActivityId();
      
      const activity = {
        id: activityId,
        type,
        userId,
        organizationId,
        timestamp,
        metadata,
        context: {
          ipAddress,
          userAgent,
          source: 'enterprise_system'
        }
      };

      // Store in user's activity log
      let userActivities = this.userActivities.get(userId) || [];
      userActivities.push(activity);
      
      // Keep only last 1000 activities per user in memory
      if (userActivities.length > 1000) {
        userActivities = userActivities.slice(-1000);
      }
      
      this.userActivities.set(userId, userActivities);

      // Update user analytics
      await this.updateUserAnalytics(userId, activity);

      // Save activity to disk periodically
      await this.saveActivity(activity);

      logger.debug('Activity logged', {
        activityId,
        type,
        userId,
        organizationId
      });

      this.emit('activity:logged', { activity });

    } catch (error) {
      logger.error('Failed to log activity', {
        type,
        userId,
        error: error.message
      });
    }
  }

  /**
   * Get user analytics and performance metrics
   */
  async getUserAnalytics(userId, options = {}) {
    const {
      timeframe = 'month',
      includeTeamComparison = false,
      includeActivities = false
    } = options;

    try {
      const user = this.users.get(userId);
      if (!user) {
        throw ApiError.notFound(`User ${userId} not found`);
      }

      const analytics = this.userAnalytics.get(userId) || this.initializeAnalytics();
      const activities = this.userActivities.get(userId) || [];

      // Calculate timeframe-specific metrics
      const timeframeStart = this.getTimeframeStart(timeframe);
      const recentActivities = activities.filter(a => a.timestamp >= timeframeStart);

      const userAnalyticsData = {
        userId,
        user: this.sanitizeUser(user),
        timeframe,
        generatedAt: new Date(),
        metrics: {
          totalActivities: analytics.totalActivities,
          recentActivities: recentActivities.length,
          averageDaily: this.calculateAverageDaily(recentActivities, timeframe),
          mostActiveDay: this.findMostActiveDay(recentActivities),
          activityTypes: this.aggregateActivityTypes(recentActivities),
          productivity: this.calculateProductivityScore(user, recentActivities),
          engagement: this.calculateEngagementScore(user, recentActivities)
        },
        performance: {
          claimsProcessed: analytics.claimsProcessed,
          documentsReviewed: analytics.documentsReviewed,
          reportsGenerated: analytics.reportsGenerated,
          averageResponseTime: analytics.averageResponseTime,
          qualityScore: analytics.qualityScore,
          efficiencyRating: analytics.efficiencyRating
        },
        collaboration: {
          teamsCount: user.teams.length,
          collaborationsInitiated: analytics.collaborationsInitiated,
          messagesExchanged: analytics.messagesExchanged,
          meetingsAttended: analytics.meetingsAttended
        },
        trends: await this.calculateUserTrends(userId, timeframe),
        goals: analytics.goals || [],
        achievements: analytics.achievements || []
      };

      // Include team comparison if requested
      if (includeTeamComparison && user.teams.length > 0) {
        userAnalyticsData.teamComparison = await this.getTeamComparisonData(userId, timeframe);
      }

      // Include recent activities if requested
      if (includeActivities) {
        userAnalyticsData.recentActivities = recentActivities.slice(-50);
      }

      return userAnalyticsData;

    } catch (error) {
      logger.error('Failed to get user analytics', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get organization analytics and insights
   */
  async getOrganizationAnalytics(organizationId, options = {}) {
    const {
      timeframe = 'month',
      includeTeamBreakdown = true,
      includeUserMetrics = true
    } = options;

    try {
      const organization = this.organizations.get(organizationId);
      if (!organization) {
        throw ApiError.notFound(`Organization ${organizationId} not found`);
      }

      // Get all users and teams in organization
      const orgUsers = Array.from(this.users.values()).filter(u => u.organizationId === organizationId);
      const orgTeams = Array.from(this.teams.values()).filter(t => t.organizationId === organizationId);

      const timeframeStart = this.getTimeframeStart(timeframe);

      const analytics = {
        organizationId,
        organization: {
          id: organization.id,
          name: organization.name,
          type: organization.type
        },
        timeframe,
        generatedAt: new Date(),
        overview: {
          totalUsers: orgUsers.length,
          activeUsers: orgUsers.filter(u => u.status === 'active').length,
          totalTeams: orgTeams.length,
          activeTeams: orgTeams.filter(t => t.status === 'active').length,
          averageTeamSize: orgTeams.length > 0 ? Math.round(orgUsers.length / orgTeams.length) : 0
        },
        userDistribution: this.analyzeUserDistribution(orgUsers),
        activityMetrics: await this.calculateOrgActivityMetrics(organizationId, timeframeStart),
        performance: await this.calculateOrgPerformanceMetrics(organizationId, timeframeStart),
        trends: await this.calculateOrgTrends(organizationId, timeframe),
        insights: await this.generateOrgInsights(organizationId, timeframe)
      };

      // Include team breakdown if requested
      if (includeTeamBreakdown) {
        analytics.teams = await this.getTeamAnalytics(orgTeams, timeframeStart);
      }

      // Include detailed user metrics if requested
      if (includeUserMetrics) {
        analytics.topPerformers = await this.getTopPerformers(orgUsers, timeframeStart);
        analytics.engagementLevels = this.analyzeEngagementLevels(orgUsers);
      }

      return analytics;

    } catch (error) {
      logger.error('Failed to get organization analytics', {
        organizationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate user performance report
   */
  async generateUserReport(userId, reportType = 'comprehensive', timeframe = 'month') {
    try {
      const user = this.users.get(userId);
      if (!user) {
        throw ApiError.notFound(`User ${userId} not found`);
      }

      const analytics = await this.getUserAnalytics(userId, { 
        timeframe, 
        includeTeamComparison: true, 
        includeActivities: true 
      });

      const report = {
        reportId: this.generateReportId(),
        type: reportType,
        timeframe,
        generatedAt: new Date(),
        user: this.sanitizeUser(user),
        analytics,
        recommendations: await this.generateUserRecommendations(userId, analytics),
        summary: this.generateReportSummary(analytics),
        exportFormats: ['pdf', 'csv', 'json']
      };

      // Save report
      await this.saveReport(report);

      logger.info('User report generated', {
        userId,
        reportType,
        timeframe,
        reportId: report.reportId
      });

      this.emit('report:generated', { report });

      return report;

    } catch (error) {
      logger.error('Failed to generate user report', {
        userId,
        reportType,
        error: error.message
      });
      throw error;
    }
  }

  // Helper methods

  canManageTeam(role) {
    const roleConfig = this.userRoles.get(role);
    return roleConfig && roleConfig.level >= 5; // Manager level and above
  }

  isEmailTaken(email) {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  async createDefaultTeams(organizationId, organization) {
    const defaultTeams = [
      {
        name: 'Administration',
        description: 'Organization administrators and system managers',
        permissions: ['admin:*', 'users:*', 'teams:*']
      },
      {
        name: 'Claims Processing',
        description: 'Claims adjusters and processing team',
        permissions: ['claims:*', 'documents:view', 'reports:create']
      },
      {
        name: 'Field Inspectors',
        description: 'Field inspection and damage assessment team',
        permissions: ['claims:inspect', 'photos:analyze', 'reports:create']
      }
    ];

    for (const teamData of defaultTeams) {
      await this.createTeam({
        ...teamData,
        organizationId
      }, { autoAssignMembers: false, notifyMembers: false });
    }
  }

  getDefaultWidgets(role) {
    const widgets = {
      client: ['claims_status', 'documents', 'notifications'],
      contractor: ['assigned_jobs', 'estimates', 'calendar', 'photos'],
      inspector: ['inspections', 'reports', 'map', 'weather'],
      adjuster: ['claims_queue', 'analytics', 'documents', 'calendar'],
      manager: ['team_overview', 'performance', 'analytics', 'reports'],
      admin: ['system_overview', 'users', 'analytics', 'security']
    };

    return widgets[role] || widgets.client;
  }

  generateTemporaryPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  sanitizeUser(user) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }

  async validateRoleChange(userId, currentRole, newRole, updatedBy) {
    const currentRoleConfig = this.userRoles.get(currentRole);
    const newRoleConfig = this.userRoles.get(newRole);

    if (!newRoleConfig) {
      throw ApiError.badRequest(`Invalid role: ${newRole}`);
    }

    // Only allow role changes by users with higher privileges
    const updaterUser = this.users.get(updatedBy);
    if (updaterUser) {
      const updaterRoleConfig = this.userRoles.get(updaterUser.role);
      if (updaterRoleConfig.level <= Math.max(currentRoleConfig.level, newRoleConfig.level)) {
        throw ApiError.forbidden('Insufficient privileges to change user role');
      }
    }
  }

  async initializeUserAnalytics(userId) {
    const analytics = this.initializeAnalytics();
    this.userAnalytics.set(userId, analytics);
    return analytics;
  }

  initializeAnalytics() {
    return {
      totalActivities: 0,
      claimsProcessed: 0,
      documentsReviewed: 0,
      reportsGenerated: 0,
      averageResponseTime: 0,
      qualityScore: 0,
      efficiencyRating: 0,
      collaborationsInitiated: 0,
      messagesExchanged: 0,
      meetingsAttended: 0,
      goals: [],
      achievements: [],
      trends: {},
      lastCalculated: new Date()
    };
  }

  async updateUserAnalytics(userId, activity) {
    let analytics = this.userAnalytics.get(userId);
    if (!analytics) {
      analytics = this.initializeAnalytics();
    }

    analytics.totalActivities++;
    analytics.lastCalculated = new Date();

    // Update specific metrics based on activity type
    switch (activity.type) {
      case 'claim_processed':
        analytics.claimsProcessed++;
        break;
      case 'document_reviewed':
        analytics.documentsReviewed++;
        break;
      case 'report_generated':
        analytics.reportsGenerated++;
        break;
      case 'collaboration_initiated':
        analytics.collaborationsInitiated++;
        break;
      case 'message_sent':
        analytics.messagesExchanged++;
        break;
      case 'meeting_attended':
        analytics.meetingsAttended++;
        break;
    }

    this.userAnalytics.set(userId, analytics);
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

  calculateAverageDaily(activities, timeframe) {
    if (activities.length === 0) return 0;
    
    const days = timeframe === 'day' ? 1 : 
                 timeframe === 'week' ? 7 :
                 timeframe === 'month' ? 30 :
                 timeframe === 'quarter' ? 90 : 365;
    
    return Math.round(activities.length / days * 100) / 100;
  }

  findMostActiveDay(activities) {
    const dayCount = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    activities.forEach(activity => {
      const day = activity.timestamp.getDay();
      dayCount[day] = (dayCount[day] || 0) + 1;
    });

    const mostActiveDay = Object.keys(dayCount).reduce((a, b) => 
      dayCount[a] > dayCount[b] ? a : b, 0);

    return days[mostActiveDay] || 'N/A';
  }

  aggregateActivityTypes(activities) {
    const types = {};
    activities.forEach(activity => {
      types[activity.type] = (types[activity.type] || 0) + 1;
    });
    return types;
  }

  calculateProductivityScore(user, activities) {
    // Calculate productivity based on role-specific activities
    const roleMultipliers = {
      admin: 1.0,
      manager: 1.2,
      adjuster: 1.1,
      inspector: 1.0,
      contractor: 0.9,
      client: 0.8
    };

    const baseScore = activities.length * (roleMultipliers[user.role] || 1.0);
    return Math.min(Math.round(baseScore), 100);
  }

  calculateEngagementScore(user, activities) {
    // Calculate engagement based on activity diversity and frequency
    const uniqueTypes = new Set(activities.map(a => a.type)).size;
    const frequency = activities.length;
    const engagementScore = (uniqueTypes * 10) + (frequency * 2);
    return Math.min(Math.round(engagementScore), 100);
  }

  async calculateUserTrends(userId, timeframe) {
    // Mock implementation - would calculate actual trends
    return {
      activityTrend: 'increasing',
      productivityTrend: 'stable',
      engagementTrend: 'increasing',
      comparison: {
        previousPeriod: {
          activities: 85,
          productivity: 78,
          engagement: 92
        }
      }
    };
  }

  async sendWelcomeEmail(user, temporaryPassword) {
    // Mock implementation - would send actual welcome email
    logger.info('Welcome email sent', {
      userId: user.id,
      email: user.email,
      hasTemporaryPassword: !!temporaryPassword
    });
  }

  async sendTeamInviteNotification(user, team) {
    // Mock implementation - would send team invitation
    logger.info('Team invite notification sent', {
      userId: user.id,
      teamId: team.id,
      teamName: team.name
    });
  }

  // Storage methods
  async saveOrganization(organization) {
    const orgFile = path.join(this.organizationsDir, `${organization.id}.json`);
    await fs.writeJson(orgFile, organization, { spaces: 2 });
  }

  async saveTeam(team) {
    const teamFile = path.join(this.teamsDir, `${team.id}.json`);
    await fs.writeJson(teamFile, team, { spaces: 2 });
  }

  async saveUser(user) {
    const userFile = path.join(this.usersDir, `${user.id}.json`);
    await fs.writeJson(userFile, user, { spaces: 2 });
  }

  async saveActivity(activity) {
    const date = activity.timestamp.toISOString().split('T')[0];
    const activityFile = path.join(this.activitiesDir, `${date}.json`);
    
    let dayActivities = [];
    if (await fs.pathExists(activityFile)) {
      dayActivities = await fs.readJson(activityFile);
    }
    
    dayActivities.push(activity);
    await fs.writeJson(activityFile, dayActivities, { spaces: 2 });
  }

  async saveReport(report) {
    const reportFile = path.join(this.analyticsDir, 'reports', `${report.reportId}.json`);
    await fs.ensureDir(path.dirname(reportFile));
    await fs.writeJson(reportFile, report, { spaces: 2 });
  }

  async loadExistingData() {
    // Load existing organizations, teams, and users
    try {
      // Load organizations
      if (await fs.pathExists(this.organizationsDir)) {
        const orgFiles = await fs.readdir(this.organizationsDir);
        for (const file of orgFiles.filter(f => f.endsWith('.json'))) {
          const org = await fs.readJson(path.join(this.organizationsDir, file));
          this.organizations.set(org.id, org);
        }
      }

      // Load teams
      if (await fs.pathExists(this.teamsDir)) {
        const teamFiles = await fs.readdir(this.teamsDir);
        for (const file of teamFiles.filter(f => f.endsWith('.json'))) {
          const team = await fs.readJson(path.join(this.teamsDir, file));
          this.teams.set(team.id, team);
        }
      }

      // Load users
      if (await fs.pathExists(this.usersDir)) {
        const userFiles = await fs.readdir(this.usersDir);
        for (const file of userFiles.filter(f => f.endsWith('.json'))) {
          const user = await fs.readJson(path.join(this.usersDir, file));
          this.users.set(user.id, user);
        }
      }

      logger.info('Loaded existing enterprise data', {
        organizations: this.organizations.size,
        teams: this.teams.size,
        users: this.users.size
      });

    } catch (error) {
      logger.error('Failed to load existing enterprise data', {
        error: error.message
      });
    }
  }

  setupAnalyticsTracking() {
    // Save analytics data every hour
    setInterval(() => {
      this.persistAnalyticsData();
    }, 60 * 60 * 1000);

    // Clean up old activities daily
    setInterval(() => {
      this.cleanupOldActivities();
    }, 24 * 60 * 60 * 1000);
  }

  async persistAnalyticsData() {
    try {
      // Save user analytics
      for (const [userId, analytics] of this.userAnalytics) {
        const analyticsFile = path.join(this.analyticsDir, 'users', `${userId}.json`);
        await fs.ensureDir(path.dirname(analyticsFile));
        await fs.writeJson(analyticsFile, analytics, { spaces: 2 });
      }
    } catch (error) {
      logger.error('Failed to persist analytics data', { error: error.message });
    }
  }

  async cleanupOldActivities() {
    // Remove activities older than 90 days from memory
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    
    for (const [userId, activities] of this.userActivities) {
      const filteredActivities = activities.filter(a => a.timestamp >= cutoffDate);
      this.userActivities.set(userId, filteredActivities);
    }
  }

  // ID generators
  generateOrganizationId() {
    return `org_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateTeamId() {
    return `team_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateUserId() {
    return `user_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  generateActivityId() {
    return `act_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  }

  generateReportId() {
    return `rpt_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  }

  // Public API methods
  
  getUser(userId) {
    const user = this.users.get(userId);
    return user ? this.sanitizeUser(user) : null;
  }

  getTeam(teamId) {
    return this.teams.get(teamId);
  }

  getOrganization(organizationId) {
    return this.organizations.get(organizationId);
  }

  getUsersByOrganization(organizationId) {
    return Array.from(this.users.values())
      .filter(user => user.organizationId === organizationId)
      .map(user => this.sanitizeUser(user));
  }

  getTeamsByOrganization(organizationId) {
    return Array.from(this.teams.values())
      .filter(team => team.organizationId === organizationId);
  }

  getUserRoles() {
    return Array.from(this.userRoles.values());
  }

  getOrganizationTypes() {
    return Array.from(this.organizationTypes.values());
  }

  getSystemStats() {
    return {
      totalOrganizations: this.organizations.size,
      totalTeams: this.teams.size,
      totalUsers: this.users.size,
      activeUsers: Array.from(this.users.values()).filter(u => u.status === 'active').length,
      usersByRole: this.aggregateUsersByRole(),
      teamMemberships: this.teamMemberships.size
    };
  }

  aggregateUsersByRole() {
    const roleCount = {};
    for (const user of this.users.values()) {
      roleCount[user.role] = (roleCount[user.role] || 0) + 1;
    }
    return roleCount;
  }
}