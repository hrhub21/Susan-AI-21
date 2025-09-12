import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Training Integration Service
 * Integrates training and coaching services with existing analytics, user management,
 * and other system components for a unified learning management experience
 */
export class TrainingIntegrationService extends EventEmitter {
  constructor() {
    super();
    this.dataDir = path.join(__dirname, '../../../data/training-integration');
    
    // Service references (will be injected)
    this.trainingService = null;
    this.coachingService = null;
    this.analyticsService = null;
    this.userManagementService = null;
    this.aiService = null;
    this.enterpriseUserService = null;
    this.rbacService = null;

    // Integration state
    this.userSessions = new Map();
    this.integrationMetrics = new Map();
    this.crossServiceEvents = new Map();

    this.ensureDirectories();
    this.setupIntegrationHandlers();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.dataDir);
    await fs.ensureDir(path.join(this.dataDir, 'sessions'));
    await fs.ensureDir(path.join(this.dataDir, 'metrics'));
    await fs.ensureDir(path.join(this.dataDir, 'events'));
  }

  /**
   * Initialize integration with all required services
   */
  initializeServices(services) {
    const {
      trainingService,
      coachingService,
      analyticsService,
      userManagementService,
      aiService,
      enterpriseUserService,
      rbacService
    } = services;

    this.trainingService = trainingService;
    this.coachingService = coachingService;
    this.analyticsService = analyticsService;
    this.userManagementService = userManagementService;
    this.aiService = aiService;
    this.enterpriseUserService = enterpriseUserService;
    this.rbacService = rbacService;

    // Set up cross-service communication
    this.setupCrossServiceIntegration();

    logger.info('Training integration services initialized', {
      servicesConnected: Object.keys(services).length
    });
  }

  /**
   * Set up cross-service event handlers and data synchronization
   */
  setupCrossServiceIntegration() {
    // Training events to analytics
    if (this.trainingService && this.analyticsService) {
      this.trainingService.on('training:module_started', (data) => {
        this.analyticsService.trackUserBehavior({
          userId: data.userId,
          action: 'module_started',
          feature: 'training',
          metadata: {
            categoryId: data.categoryId,
            moduleId: data.moduleId,
            timestamp: data.timestamp
          }
        });
      });

      this.trainingService.on('training:module_completed', (data) => {
        this.analyticsService.trackUserBehavior({
          userId: data.userId,
          action: 'module_completed',
          feature: 'training',
          duration: this.calculateModuleDuration(data),
          metadata: {
            categoryId: data.categoryId,
            moduleId: data.moduleId,
            score: data.score,
            timestamp: data.timestamp
          }
        });
      });
    }

    // Coaching events to analytics
    if (this.coachingService && this.analyticsService) {
      this.coachingService.on('assessment:completed', (data) => {
        this.analyticsService.trackUserBehavior({
          userId: data.userId,
          action: 'assessment_completed',
          feature: 'coaching',
          metadata: {
            assessmentId: data.assessmentId,
            overallScore: data.results.overall,
            timestamp: data.timestamp
          }
        });
      });

      this.coachingService.on('goal:completed', (data) => {
        this.analyticsService.trackUserBehavior({
          userId: data.userId,
          action: 'goal_completed',
          feature: 'coaching',
          duration: data.completedIn,
          metadata: {
            goalId: data.goalId,
            category: data.category,
            timestamp: data.timestamp
          }
        });
      });

      this.coachingService.on('user:level_up', (data) => {
        this.analyticsService.trackUserBehavior({
          userId: data.userId,
          action: 'level_up',
          feature: 'coaching',
          metadata: {
            oldLevel: data.oldLevel,
            newLevel: data.newLevel,
            experiencePoints: data.experiencePoints,
            timestamp: data.timestamp
          }
        });
      });
    }

    // Set up bi-directional integration
    this.setupBidirectionalSync();
  }

  /**
   * Set up bidirectional data synchronization between services
   */
  setupBidirectionalSync() {
    // Sync user profile updates to training/coaching
    if (this.userManagementService) {
      this.userManagementService.on?.('user:profile_updated', async (data) => {
        await this.syncUserProfileToTraining(data.userId, data.profileData);
      });
    }

    // Sync enterprise role changes to training access
    if (this.enterpriseUserService && this.rbacService) {
      this.enterpriseUserService.on?.('user:role_changed', async (data) => {
        await this.updateTrainingAccess(data.userId, data.newRole, data.permissions);
      });
    }
  }

  /**
   * Get comprehensive user training dashboard
   */
  async getUserTrainingDashboard(userId, options = {}) {
    try {
      const { includeAnalytics = true, includeRecommendations = true } = options;

      // Get user information
      const userInfo = await this.getUserInfo(userId);
      
      // Get training progress
      const trainingProgress = await this.trainingService.getUserProgress(userId);
      
      // Get coaching analytics
      const coachingAnalytics = await this.coachingService.getPerformanceAnalytics(userId);
      
      // Get user session data
      const sessionData = await this.getUserSessionData(userId);

      const dashboard = {
        user: userInfo,
        training: {
          progress: trainingProgress,
          analytics: await this.trainingService.getUserTrainingAnalytics(userId),
          recentModules: await this.getRecentTrainingModules(userId, 5),
          upcomingDeadlines: await this.getUpcomingDeadlines(userId)
        },
        coaching: {
          analytics: coachingAnalytics,
          currentGoals: await this.getCurrentGoals(userId),
          achievements: await this.getRecentAchievements(userId),
          benchmarkComparison: await this.coachingService.compareWithIndustryBenchmarks(userId)
        },
        session: sessionData,
        integrationMetrics: await this.getUserIntegrationMetrics(userId)
      };

      // Add analytics integration if requested
      if (includeAnalytics && this.analyticsService) {
        dashboard.analytics = await this.getIntegratedAnalytics(userId);
      }

      // Add AI-powered recommendations if requested
      if (includeRecommendations && this.aiService) {
        dashboard.recommendations = await this.generateIntegratedRecommendations(userId, dashboard);
      }

      return dashboard;
    } catch (error) {
      logger.error('Failed to get user training dashboard', { 
        userId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Create unified learning path based on user profile, role, and performance
   */
  async createUnifiedLearningPath(userId, context = {}) {
    try {
      // Get user context
      const userInfo = await this.getUserInfo(userId);
      const rolePermissions = await this.getUserRolePermissions(userId);
      const performanceData = await this.coachingService.getUserPerformanceMetrics(userId);
      const trainingHistory = await this.trainingService.getUserProgress(userId);

      // Generate role-based learning requirements
      const roleRequirements = await this.generateRoleBasedRequirements(userInfo.role, rolePermissions);
      
      // Get coaching recommendations
      const coachingPath = await this.coachingService.generateOptimalLearningPath(userId);
      
      // Get training recommendations
      const trainingRecommendations = await this.trainingService.getTrainingRecommendations(userId, context);

      // Create unified path
      const unifiedPath = {
        userId,
        generatedAt: new Date(),
        userContext: {
          role: userInfo.role,
          level: performanceData.currentLevel || 1,
          experiencePoints: performanceData.experiencePoints || 0,
          strengths: await this.identifyUserStrengths(userId),
          improvementAreas: await this.identifyImprovementAreas(userId)
        },
        pathComponents: {
          mandatory: roleRequirements.mandatory || [],
          recommended: this.mergeRecommendations(coachingPath.recommendedPath, trainingRecommendations.immediate),
          optional: trainingRecommendations.longTerm || [],
          continuous: roleRequirements.continuous || []
        },
        timeline: await this.generateUnifiedTimeline(userId, roleRequirements, coachingPath),
        milestones: await this.generateLearningMilestones(userId, roleRequirements, performanceData),
        adaptiveElements: await this.generateAdaptiveElements(userId, performanceData)
      };

      // Save learning path
      await this.saveLearningPath(userId, unifiedPath);

      return unifiedPath;
    } catch (error) {
      logger.error('Failed to create unified learning path', { 
        userId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Track cross-service user activity and learning effectiveness
   */
  async trackCrossServiceActivity(userId, activityData) {
    try {
      const {
        service,
        action,
        context,
        performance,
        timestamp = new Date()
      } = activityData;

      // Create comprehensive activity record
      const activityRecord = {
        id: this.generateActivityId(),
        userId,
        service,
        action,
        context,
        performance,
        timestamp,
        integrationData: {
          sessionId: await this.getCurrentSessionId(userId),
          userLevel: await this.getUserCurrentLevel(userId),
          crossServiceContext: await this.getCrossServiceContext(userId)
        }
      };

      // Update user session
      await this.updateUserSession(userId, activityRecord);

      // Send to analytics if available
      if (this.analyticsService) {
        this.analyticsService.trackUserBehavior({
          userId,
          action: `${service}:${action}`,
          feature: 'integrated_learning',
          metadata: activityRecord,
          sessionId: activityRecord.integrationData.sessionId
        });
      }

      // Update integration metrics
      await this.updateIntegrationMetrics(userId, activityRecord);

      // Trigger adaptive responses
      await this.triggerAdaptiveResponses(userId, activityRecord);

      this.emit('cross_service:activity_tracked', activityRecord);

      return activityRecord;
    } catch (error) {
      logger.error('Failed to track cross-service activity', { 
        userId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Generate AI-powered integrated recommendations
   */
  async generateIntegratedRecommendations(userId, dashboardData) {
    if (!this.aiService) {
      return this.generateStaticRecommendations(dashboardData);
    }

    try {
      const prompt = this.buildIntegratedRecommendationPrompt(userId, dashboardData);
      
      const response = await this.aiService.generateResponse(prompt, {
        temperature: 0.7,
        maxTokens: 800,
        systemPrompt: `You are Susan AI's integrated learning advisor. Analyze user data across training, coaching, 
        and performance metrics to provide personalized, actionable recommendations that optimize learning outcomes 
        and career development in the roofing and insurance industry.`
      });

      return {
        type: 'ai_integrated',
        recommendations: this.parseAIRecommendations(response.content),
        confidence: response.confidence || 0.8,
        generatedAt: new Date(),
        basedOn: [
          'training_progress',
          'coaching_analytics', 
          'performance_metrics',
          'industry_benchmarks',
          'role_requirements'
        ]
      };
    } catch (error) {
      logger.error('Failed to generate AI recommendations', { userId, error: error.message });
      return this.generateStaticRecommendations(dashboardData);
    }
  }

  /**
   * Manage enterprise-wide training initiatives
   */
  async manageEnterpriseTrainingInitiative(organizationId, initiativeData) {
    try {
      const {
        title,
        description,
        targetRoles,
        requiredModules,
        deadline,
        priority = 'medium',
        trackingMetrics
      } = initiativeData;

      // Get organization users
      const organizationUsers = await this.getOrganizationUsers(organizationId, targetRoles);
      
      // Create initiative
      const initiative = {
        id: this.generateInitiativeId(),
        organizationId,
        title,
        description,
        targetRoles,
        requiredModules,
        deadline: new Date(deadline),
        priority,
        trackingMetrics: trackingMetrics || this.getDefaultTrackingMetrics(),
        participants: organizationUsers.map(user => ({
          userId: user.id,
          role: user.role,
          status: 'enrolled',
          enrolledAt: new Date(),
          progress: 0,
          completedModules: []
        })),
        status: 'active',
        createdAt: new Date()
      };

      // Enroll users in required modules
      for (const participant of initiative.participants) {
        await this.enrollUserInInitiative(participant.userId, initiative);
      }

      // Set up initiative tracking
      await this.setupInitiativeTracking(initiative);

      // Save initiative
      await this.saveTrainingInitiative(initiative);

      logger.info('Enterprise training initiative created', {
        initiativeId: initiative.id,
        organizationId,
        participantCount: initiative.participants.length
      });

      return initiative;
    } catch (error) {
      logger.error('Failed to manage enterprise training initiative', { 
        organizationId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Generate comprehensive training reports for organizations
   */
  async generateOrganizationTrainingReport(organizationId, reportOptions = {}) {
    try {
      const {
        timeframe = '30d',
        includeIndividualProgress = true,
        includeROIAnalysis = true,
        format = 'json'
      } = reportOptions;

      // Get organization data
      const organizationUsers = await this.getOrganizationUsers(organizationId);
      const trainingInitiatives = await this.getOrganizationInitiatives(organizationId);

      const report = {
        organizationId,
        reportPeriod: {
          timeframe,
          startDate: this.calculateStartDate(timeframe),
          endDate: new Date()
        },
        summary: {
          totalUsers: organizationUsers.length,
          activeTrainees: 0,
          completedModules: 0,
          averageProgress: 0,
          totalTrainingHours: 0,
          certificationCount: 0
        },
        initiatives: [],
        userProgress: [],
        analytics: {},
        recommendations: [],
        generatedAt: new Date()
      };

      // Calculate summary metrics
      for (const user of organizationUsers) {
        const userProgress = await this.trainingService.getUserProgress(user.id);
        const userAnalytics = await this.trainingService.getUserTrainingAnalytics(user.id, timeframe);

        report.summary.activeTrainees += userProgress.totalModulesStarted > 0 ? 1 : 0;
        report.summary.completedModules += userProgress.totalModulesCompleted;
        report.summary.totalTrainingHours += userProgress.totalTimeSpent / 60; // Convert to hours
        report.summary.certificationCount += userProgress.certifications.length;

        if (includeIndividualProgress) {
          report.userProgress.push({
            userId: user.id,
            name: user.name,
            role: user.role,
            progress: userProgress,
            analytics: userAnalytics
          });
        }
      }

      // Calculate averages
      report.summary.averageProgress = organizationUsers.length > 0 
        ? report.summary.completedModules / organizationUsers.length 
        : 0;

      // Add initiative tracking
      for (const initiative of trainingInitiatives) {
        const initiativeProgress = await this.getInitiativeProgress(initiative.id);
        report.initiatives.push({
          ...initiative,
          progress: initiativeProgress
        });
      }

      // Add ROI analysis if requested
      if (includeROIAnalysis) {
        report.roiAnalysis = await this.calculateTrainingROI(organizationId, timeframe);
      }

      // Generate organization-specific recommendations
      report.recommendations = await this.generateOrganizationRecommendations(organizationId, report);

      // Save report
      await this.saveOrganizationReport(report, format);

      return report;
    } catch (error) {
      logger.error('Failed to generate organization training report', { 
        organizationId, 
        error: error.message 
      });
      throw error;
    }
  }

  // Helper methods

  async getUserInfo(userId) {
    if (this.userManagementService) {
      return await this.userManagementService.getUserProfile?.(userId) || { id: userId, role: 'user' };
    }
    return { id: userId, role: 'user' };
  }

  async getUserRolePermissions(userId) {
    if (this.rbacService) {
      return await this.rbacService.getUserPermissions?.(userId) || [];
    }
    return [];
  }

  async generateRoleBasedRequirements(role, permissions) {
    const roleRequirements = {
      user: {
        mandatory: ['roofing_inspection.basic_inspection_techniques'],
        continuous: ['susan_ai_mastery.susan_basics']
      },
      inspector: {
        mandatory: [
          'roofing_inspection.basic_inspection_techniques',
          'roofing_inspection.damage_identification',
          'damage_assessment.damage_classification'
        ],
        continuous: ['roofing_inspection.safety_protocols']
      },
      adjuster: {
        mandatory: [
          'insurance_process.claim_initiation',
          'insurance_process.documentation_requirements',
          'communication_skills.adjuster_relations'
        ],
        continuous: ['insurance_process.legal_compliance']
      },
      manager: {
        mandatory: [
          'communication_skills.professional_communication',
          'business_acumen.project_management'
        ],
        continuous: [
          'communication_skills.conflict_resolution',
          'business_acumen.strategic_thinking'
        ]
      }
    };

    return roleRequirements[role] || roleRequirements.user;
  }

  mergeRecommendations(coachingRecs, trainingRecs) {
    const merged = [...(coachingRecs || [])];
    
    for (const trainingRec of (trainingRecs || [])) {
      if (!merged.find(rec => rec.title === trainingRec.title)) {
        merged.push(trainingRec);
      }
    }
    
    return merged;
  }

  generateActivityId() {
    return `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateInitiativeId() {
    return `initiative_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  calculateModuleDuration(data) {
    // Calculate module duration from start to completion
    return data.timestamp - (data.startedAt || data.timestamp);
  }

  buildIntegratedRecommendationPrompt(userId, dashboardData) {
    return `
Analyze the following comprehensive user data and provide integrated learning recommendations:

User Training Progress: ${JSON.stringify(dashboardData.training.progress, null, 2)}
Coaching Analytics: ${JSON.stringify(dashboardData.coaching.analytics.overview, null, 2)}
Performance Benchmarks: ${JSON.stringify(dashboardData.coaching.benchmarkComparison, null, 2)}

Provide specific, actionable recommendations that:
1. Address skill gaps identified in performance data
2. Leverage strengths for career advancement
3. Integrate training modules with coaching goals
4. Consider industry benchmarks and role requirements
5. Suggest optimal learning sequence and timeline

Format as structured recommendations with priorities and timelines.
    `.trim();
  }

  parseAIRecommendations(content) {
    // Parse AI response into structured recommendations
    // This would be more sophisticated in production
    return [
      {
        type: 'immediate',
        title: 'Priority Learning Focus',
        description: 'AI-analyzed priority areas based on performance gaps',
        actions: ['Complete targeted training modules', 'Practice with real scenarios'],
        timeline: '2-4 weeks'
      },
      {
        type: 'strategic',
        title: 'Career Development Path',
        description: 'Long-term development recommendations',
        actions: ['Pursue advanced certifications', 'Develop leadership skills'],
        timeline: '3-6 months'
      }
    ];
  }

  generateStaticRecommendations(dashboardData) {
    return {
      type: 'static',
      recommendations: [
        {
          type: 'immediate',
          title: 'Continue Current Training',
          description: 'Maintain momentum with your current learning path',
          actions: ['Complete in-progress modules', 'Take practice assessments'],
          timeline: '1-2 weeks'
        }
      ],
      confidence: 0.6,
      generatedAt: new Date()
    };
  }

  calculateStartDate(timeframe) {
    const now = new Date();
    const days = parseInt(timeframe.replace('d', ''));
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  getDefaultTrackingMetrics() {
    return [
      'completion_rate',
      'average_score',
      'time_to_completion',
      'engagement_level',
      'skill_improvement'
    ];
  }

  async setupIntegrationHandlers() {
    // Set up periodic integration maintenance
    setInterval(async () => {
      try {
        await this.updateIntegrationHealth();
      } catch (error) {
        logger.error('Integration health update failed', { error: error.message });
      }
    }, 300000); // Every 5 minutes
  }

  async updateIntegrationHealth() {
    const health = {
      trainingService: !!this.trainingService,
      coachingService: !!this.coachingService,
      analyticsService: !!this.analyticsService,
      userManagementService: !!this.userManagementService,
      aiService: !!this.aiService,
      lastHealthCheck: new Date()
    };

    this.emit('integration:health_updated', health);
  }

  // Placeholder methods for features that would be implemented with full service integration

  async getUserSessionData(userId) {
    return this.userSessions.get(userId) || { active: false, sessionId: null };
  }

  async getRecentTrainingModules(userId, limit) {
    // Would get recent modules from training service
    return [];
  }

  async getUpcomingDeadlines(userId) {
    // Would get upcoming deadlines from coaching service
    return [];
  }

  async getCurrentGoals(userId) {
    // Would get current goals from coaching service
    return [];
  }

  async getRecentAchievements(userId) {
    // Would get recent achievements from coaching service
    return [];
  }

  async getIntegratedAnalytics(userId) {
    // Would get integrated analytics from analytics service
    return {};
  }

  async getCurrentSessionId(userId) {
    return this.userSessions.get(userId)?.sessionId || null;
  }

  async getUserCurrentLevel(userId) {
    return 1; // Would get from coaching service
  }

  async getCrossServiceContext(userId) {
    return {}; // Would aggregate context from all services
  }

  async updateUserSession(userId, activityRecord) {
    // Update user session with activity
    const session = this.userSessions.get(userId) || { activities: [] };
    session.activities.push(activityRecord);
    this.userSessions.set(userId, session);
  }

  async updateIntegrationMetrics(userId, activityRecord) {
    // Update integration metrics
    const metrics = this.integrationMetrics.get(userId) || { totalActivities: 0 };
    metrics.totalActivities++;
    this.integrationMetrics.set(userId, metrics);
  }

  async triggerAdaptiveResponses(userId, activityRecord) {
    // Trigger adaptive learning responses based on activity
    this.emit('adaptive:response_triggered', { userId, activityRecord });
  }

  async saveLearningPath(userId, path) {
    const filename = `${userId}_learning_path.json`;
    const filepath = path.join(this.dataDir, filename);
    await fs.writeJson(filepath, path, { spaces: 2 });
  }

  async identifyUserStrengths(userId) {
    // Would analyze across all services to identify strengths
    return [];
  }

  async identifyImprovementAreas(userId) {
    // Would analyze across all services to identify improvement areas
    return [];
  }

  async generateUnifiedTimeline(userId, roleRequirements, coachingPath) {
    // Would generate timeline based on all requirements
    return {
      phases: [],
      totalDuration: '12 weeks',
      milestones: []
    };
  }

  async generateLearningMilestones(userId, roleRequirements, performanceData) {
    // Would generate learning milestones
    return [];
  }

  async generateAdaptiveElements(userId, performanceData) {
    // Would generate adaptive learning elements
    return {
      triggers: [],
      responses: [],
      personalizations: []
    };
  }

  async getUserIntegrationMetrics(userId) {
    return this.integrationMetrics.get(userId) || {};
  }
}

export default TrainingIntegrationService;