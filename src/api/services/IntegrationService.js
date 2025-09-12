import axios from 'axios';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';
import EventEmitter from 'events';

/**
 * Integration Service for Susan AI
 * Handles integrations with HR systems, leaderboard systems, and other external services
 * Provides seamless data flow between Susan and company systems
 */
export class IntegrationService extends EventEmitter {
  constructor() {
    super();
    
    this.integrations = new Map();
    this.apiClients = new Map();
    this.webhookHandlers = new Map();
    this.syncSchedules = new Map();
    this.integrationMetrics = new Map();
    
    this.initializeIntegrations();
    this.setupWebhookHandlers();
    this.startSyncSchedules();
  }

  initializeIntegrations() {
    // HR System Integration Configuration
    this.integrations.set('hr_system', {
      name: 'HR Management System',
      type: 'hr',
      enabled: !!process.env.HR_SYSTEM_API_KEY,
      config: {
        baseUrl: process.env.HR_SYSTEM_BASE_URL || 'https://hr.roof-er.com/api/v1',
        apiKey: process.env.HR_SYSTEM_API_KEY,
        timeout: 30000,
        rateLimit: { requests: 100, window: '1h' }
      },
      endpoints: {
        employees: '/employees',
        benefits: '/benefits',
        policies: '/policies',
        org_chart: '/organization',
        training: '/training',
        performance: '/performance'
      },
      permissions: {
        read: ['basic_info', 'benefits', 'policies', 'training'],
        restricted: ['salary', 'performance_reviews', 'disciplinary']
      }
    });

    // Leaderboard System Integration
    this.integrations.set('leaderboard_system', {
      name: 'Performance Leaderboard',
      type: 'performance',
      enabled: !!process.env.LEADERBOARD_API_KEY,
      config: {
        baseUrl: process.env.LEADERBOARD_BASE_URL || 'https://performance.roof-er.com/api',
        apiKey: process.env.LEADERBOARD_API_KEY,
        timeout: 15000,
        rateLimit: { requests: 200, window: '1h' }
      },
      endpoints: {
        leaderboards: '/leaderboards',
        metrics: '/metrics',
        achievements: '/achievements',
        goals: '/goals',
        rankings: '/rankings'
      },
      permissions: {
        read: ['public_rankings', 'team_metrics', 'personal_goals'],
        restricted: ['detailed_performance', 'comparison_data']
      }
    });

    // Employee Portal Integration
    this.integrations.set('employee_portal', {
      name: 'Employee Self-Service Portal',
      type: 'portal',
      enabled: !!process.env.PORTAL_API_KEY,
      config: {
        baseUrl: process.env.PORTAL_BASE_URL || 'https://portal.roof-er.com/api',
        apiKey: process.env.PORTAL_API_KEY,
        timeout: 20000,
        rateLimit: { requests: 150, window: '1h' }
      },
      endpoints: {
        profile: '/profile',
        requests: '/requests',
        documents: '/documents',
        announcements: '/announcements',
        directory: '/directory'
      },
      permissions: {
        read: ['own_profile', 'announcements', 'directory'],
        write: ['profile_updates', 'requests']
      }
    });

    // Time Tracking Integration
    this.integrations.set('time_tracking', {
      name: 'Time & Attendance System',
      type: 'timekeeping',
      enabled: !!process.env.TIMETRACK_API_KEY,
      config: {
        baseUrl: process.env.TIMETRACK_BASE_URL || 'https://time.roof-er.com/api',
        apiKey: process.env.TIMETRACK_API_KEY,
        timeout: 15000,
        rateLimit: { requests: 300, window: '1h' }
      },
      endpoints: {
        timesheets: '/timesheets',
        schedules: '/schedules',
        time_off: '/time-off',
        overtime: '/overtime'
      },
      permissions: {
        read: ['own_timesheet', 'schedule', 'time_off_balance'],
        restricted: ['payroll_data', 'others_timesheets']
      }
    });

    // Document Management Integration
    this.integrations.set('document_management', {
      name: 'Document Management System',
      type: 'documents',
      enabled: !!process.env.DMS_API_KEY,
      config: {
        baseUrl: process.env.DMS_BASE_URL || 'https://docs.roof-er.com/api',
        apiKey: process.env.DMS_API_KEY,
        timeout: 25000,
        rateLimit: { requests: 100, window: '1h' }
      },
      endpoints: {
        search: '/search',
        documents: '/documents',
        folders: '/folders',
        permissions: '/permissions'
      },
      permissions: {
        read: ['public_docs', 'department_docs', 'assigned_docs'],
        restricted: ['confidential_docs', 'executive_docs']
      }
    });

    this.initializeApiClients();
  }

  initializeApiClients() {
    for (const [integrationId, integration] of this.integrations) {
      if (integration.enabled) {
        const client = axios.create({
          baseURL: integration.config.baseUrl,
          timeout: integration.config.timeout,
          headers: {
            'Authorization': `Bearer ${integration.config.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Susan-AI/1.0'
          }
        });

        // Add request interceptor for rate limiting and logging
        client.interceptors.request.use(
          (config) => {
            logger.debug('API request', {
              integration: integrationId,
              method: config.method,
              url: config.url
            });
            return config;
          },
          (error) => {
            logger.error('API request error', { integration: integrationId, error: error.message });
            return Promise.reject(error);
          }
        );

        // Add response interceptor for error handling
        client.interceptors.response.use(
          (response) => {
            this.updateIntegrationMetrics(integrationId, 'success');
            return response;
          },
          (error) => {
            this.updateIntegrationMetrics(integrationId, 'error');
            logger.error('API response error', {
              integration: integrationId,
              status: error.response?.status,
              message: error.message
            });
            return Promise.reject(error);
          }
        );

        this.apiClients.set(integrationId, client);
        logger.info('API client initialized', { integration: integrationId });
      }
    }
  }

  /**
   * HR System Integration Methods
   */
  async getEmployeeInformation(employeeId, requestingUserId = null) {
    try {
      const client = this.apiClients.get('hr_system');
      if (!client) {
        throw new Error('HR system integration not available');
      }

      // Check permissions
      if (requestingUserId && requestingUserId !== employeeId) {
        await this.checkHRPermissions(requestingUserId, 'employee_lookup');
      }

      const response = await client.get(`/employees/${employeeId}`, {
        params: { 
          fields: 'basic_info,department,role,manager,start_date',
          requesting_user: requestingUserId 
        }
      });

      const employeeData = this.sanitizeEmployeeData(response.data, requestingUserId);

      logger.info('Employee information retrieved', { employeeId, requestingUserId });

      return {
        success: true,
        data: employeeData,
        source: 'hr_system',
        retrievedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get employee information', {
        employeeId,
        requestingUserId,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        source: 'hr_system'
      };
    }
  }

  async getBenefitsInformation(employeeId, benefitType = null) {
    try {
      const client = this.apiClients.get('hr_system');
      if (!client) {
        throw new Error('HR system integration not available');
      }

      const params = { employee_id: employeeId };
      if (benefitType) {
        params.type = benefitType;
      }

      const response = await client.get('/benefits', { params });

      return {
        success: true,
        data: response.data,
        source: 'hr_system',
        retrievedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get benefits information', {
        employeeId,
        benefitType,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        source: 'hr_system'
      };
    }
  }

  async getCompanyPolicies(category = null, department = null) {
    try {
      const client = this.apiClients.get('hr_system');
      if (!client) {
        throw new Error('HR system integration not available');
      }

      const params = {};
      if (category) params.category = category;
      if (department) params.department = department;

      const response = await client.get('/policies', { params });

      return {
        success: true,
        data: response.data,
        source: 'hr_system',
        retrievedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get company policies', {
        category,
        department,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        source: 'hr_system'
      };
    }
  }

  async getOrganizationChart(department = null) {
    try {
      const client = this.apiClients.get('hr_system');
      if (!client) {
        throw new Error('HR system integration not available');
      }

      const params = {};
      if (department) params.department = department;

      const response = await client.get('/organization', { params });

      return {
        success: true,
        data: response.data,
        source: 'hr_system',
        retrievedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get organization chart', {
        department,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        source: 'hr_system'
      };
    }
  }

  /**
   * Leaderboard System Integration Methods
   */
  async getLeaderboardData(leaderboardType = 'overall', department = null, timeframe = 'month') {
    try {
      const client = this.apiClients.get('leaderboard_system');
      if (!client) {
        throw new Error('Leaderboard system integration not available');
      }

      const params = {
        type: leaderboardType,
        timeframe: timeframe
      };
      if (department) params.department = department;

      const response = await client.get('/leaderboards', { params });

      return {
        success: true,
        data: response.data,
        source: 'leaderboard_system',
        retrievedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get leaderboard data', {
        leaderboardType,
        department,
        timeframe,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        source: 'leaderboard_system'
      };
    }
  }

  async getEmployeeMetrics(employeeId, metricType = null, timeframe = 'month') {
    try {
      const client = this.apiClients.get('leaderboard_system');
      if (!client) {
        throw new Error('Leaderboard system integration not available');
      }

      const params = {
        employee_id: employeeId,
        timeframe: timeframe
      };
      if (metricType) params.metric_type = metricType;

      const response = await client.get('/metrics', { params });

      return {
        success: true,
        data: response.data,
        source: 'leaderboard_system',
        retrievedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get employee metrics', {
        employeeId,
        metricType,
        timeframe,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        source: 'leaderboard_system'
      };
    }
  }

  async getAchievements(employeeId = null, achievementType = null) {
    try {
      const client = this.apiClients.get('leaderboard_system');
      if (!client) {
        throw new Error('Leaderboard system integration not available');
      }

      const params = {};
      if (employeeId) params.employee_id = employeeId;
      if (achievementType) params.type = achievementType;

      const response = await client.get('/achievements', { params });

      return {
        success: true,
        data: response.data,
        source: 'leaderboard_system',
        retrievedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get achievements', {
        employeeId,
        achievementType,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        source: 'leaderboard_system'
      };
    }
  }

  /**
   * Employee Portal Integration Methods
   */
  async getEmployeePortalData(employeeId, dataType = 'profile') {
    try {
      const client = this.apiClients.get('employee_portal');
      if (!client) {
        throw new Error('Employee portal integration not available');
      }

      let endpoint = '/profile';
      const params = { employee_id: employeeId };

      switch (dataType) {
        case 'requests':
          endpoint = '/requests';
          break;
        case 'documents':
          endpoint = '/documents';
          break;
        case 'announcements':
          endpoint = '/announcements';
          break;
        default:
          endpoint = '/profile';
      }

      const response = await client.get(endpoint, { params });

      return {
        success: true,
        data: response.data,
        source: 'employee_portal',
        retrievedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get employee portal data', {
        employeeId,
        dataType,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        source: 'employee_portal'
      };
    }
  }

  async submitEmployeeRequest(employeeId, requestData) {
    try {
      const client = this.apiClients.get('employee_portal');
      if (!client) {
        throw new Error('Employee portal integration not available');
      }

      const requestPayload = {
        employee_id: employeeId,
        ...requestData,
        submitted_at: new Date(),
        source: 'susan_ai'
      };

      const response = await client.post('/requests', requestPayload);

      logger.info('Employee request submitted', {
        employeeId,
        requestType: requestData.type,
        requestId: response.data.id
      });

      return {
        success: true,
        data: response.data,
        source: 'employee_portal',
        submittedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to submit employee request', {
        employeeId,
        requestType: requestData.type,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        source: 'employee_portal'
      };
    }
  }

  /**
   * Document Management Integration Methods
   */
  async searchDocuments(query, filters = {}) {
    try {
      const client = this.apiClients.get('document_management');
      if (!client) {
        throw new Error('Document management system integration not available');
      }

      const searchParams = {
        query: query,
        ...filters,
        search_source: 'susan_ai'
      };

      const response = await client.get('/search', { params: searchParams });

      return {
        success: true,
        data: response.data,
        source: 'document_management',
        searchedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to search documents', {
        query,
        filters,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        source: 'document_management'
      };
    }
  }

  async getDocumentById(documentId, employeeId = null) {
    try {
      const client = this.apiClients.get('document_management');
      if (!client) {
        throw new Error('Document management system integration not available');
      }

      const params = {};
      if (employeeId) params.requesting_user = employeeId;

      const response = await client.get(`/documents/${documentId}`, { params });

      return {
        success: true,
        data: response.data,
        source: 'document_management',
        retrievedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get document', {
        documentId,
        employeeId,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        source: 'document_management'
      };
    }
  }

  /**
   * Time Tracking Integration Methods
   */
  async getTimeOffBalance(employeeId) {
    try {
      const client = this.apiClients.get('time_tracking');
      if (!client) {
        throw new Error('Time tracking system integration not available');
      }

      const response = await client.get(`/time-off/balance/${employeeId}`);

      return {
        success: true,
        data: response.data,
        source: 'time_tracking',
        retrievedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get time off balance', {
        employeeId,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        source: 'time_tracking'
      };
    }
  }

  async getEmployeeSchedule(employeeId, startDate = null, endDate = null) {
    try {
      const client = this.apiClients.get('time_tracking');
      if (!client) {
        throw new Error('Time tracking system integration not available');
      }

      const params = { employee_id: employeeId };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await client.get('/schedules', { params });

      return {
        success: true,
        data: response.data,
        source: 'time_tracking',
        retrievedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to get employee schedule', {
        employeeId,
        startDate,
        endDate,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        source: 'time_tracking'
      };
    }
  }

  /**
   * Unified Query Interface - intelligently route queries to appropriate systems
   */
  async queryIntegratedSystems(query, userContext, queryType = 'auto') {
    try {
      logger.info('Querying integrated systems', {
        query: query.substring(0, 50),
        queryType,
        employeeId: userContext.employee?.id
      });

      const results = new Map();

      // Determine which systems to query based on query content and type
      const systemsToQuery = this.determineRelevantSystems(query, queryType, userContext);

      // Query each relevant system
      for (const systemId of systemsToQuery) {
        try {
          const systemResult = await this.querySystem(systemId, query, userContext);
          if (systemResult.success) {
            results.set(systemId, systemResult);
          }
        } catch (error) {
          logger.warn(`Failed to query system ${systemId}`, { error: error.message });
        }
      }

      // Combine and format results
      const combinedResults = this.combineSystemResults(results, query, userContext);

      logger.info('Integrated systems query completed', {
        systemsQueried: systemsToQuery.length,
        resultsFound: results.size,
        totalItems: combinedResults.totalItems
      });

      return combinedResults;

    } catch (error) {
      logger.error('Integrated systems query failed', {
        query: query.substring(0, 50),
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        results: new Map(),
        totalItems: 0
      };
    }
  }

  // Helper methods

  determineRelevantSystems(query, queryType, userContext) {
    const queryLower = query.toLowerCase();
    const systemsToQuery = new Set();

    // Always include HR system for employee-related queries
    if (this.apiClients.has('hr_system') && 
        (queryType === 'auto' || queryType === 'hr' || 
         queryLower.includes('benefit') || queryLower.includes('policy') || 
         queryLower.includes('employee'))) {
      systemsToQuery.add('hr_system');
    }

    // Include leaderboard system for performance queries
    if (this.apiClients.has('leaderboard_system') && 
        (queryType === 'performance' || queryLower.includes('performance') || 
         queryLower.includes('metric') || queryLower.includes('ranking') || 
         queryLower.includes('leaderboard'))) {
      systemsToQuery.add('leaderboard_system');
    }

    // Include document management for document searches
    if (this.apiClients.has('document_management') && 
        (queryType === 'document' || queryLower.includes('document') || 
         queryLower.includes('manual') || queryLower.includes('procedure'))) {
      systemsToQuery.add('document_management');
    }

    // Include time tracking for schedule/time-off queries
    if (this.apiClients.has('time_tracking') && 
        (queryType === 'schedule' || queryLower.includes('schedule') || 
         queryLower.includes('time off') || queryLower.includes('vacation'))) {
      systemsToQuery.add('time_tracking');
    }

    // Always include employee portal if available
    if (this.apiClients.has('employee_portal')) {
      systemsToQuery.add('employee_portal');
    }

    return Array.from(systemsToQuery);
  }

  async querySystem(systemId, query, userContext) {
    const employeeId = userContext.employee?.id;
    const department = userContext.employee?.department;

    switch (systemId) {
      case 'hr_system':
        // Query HR system for relevant information
        const benefitsResult = await this.getBenefitsInformation(employeeId);
        const policiesResult = await this.getCompanyPolicies(null, department);
        
        return {
          success: true,
          data: {
            benefits: benefitsResult.success ? benefitsResult.data : null,
            policies: policiesResult.success ? policiesResult.data : null
          },
          source: 'hr_system'
        };

      case 'leaderboard_system':
        const metricsResult = await this.getEmployeeMetrics(employeeId);
        const achievementsResult = await this.getAchievements(employeeId);
        
        return {
          success: true,
          data: {
            metrics: metricsResult.success ? metricsResult.data : null,
            achievements: achievementsResult.success ? achievementsResult.data : null
          },
          source: 'leaderboard_system'
        };

      case 'document_management':
        const documentsResult = await this.searchDocuments(query, { department });
        
        return {
          success: true,
          data: documentsResult.success ? documentsResult.data : null,
          source: 'document_management'
        };

      case 'time_tracking':
        const timeOffResult = await this.getTimeOffBalance(employeeId);
        const scheduleResult = await this.getEmployeeSchedule(employeeId);
        
        return {
          success: true,
          data: {
            timeOff: timeOffResult.success ? timeOffResult.data : null,
            schedule: scheduleResult.success ? scheduleResult.data : null
          },
          source: 'time_tracking'
        };

      case 'employee_portal':
        const portalResult = await this.getEmployeePortalData(employeeId, 'announcements');
        
        return {
          success: true,
          data: portalResult.success ? portalResult.data : null,
          source: 'employee_portal'
        };

      default:
        return { success: false, error: 'Unknown system' };
    }
  }

  combineSystemResults(results, query, userContext) {
    const combinedData = {
      hrData: results.get('hr_system')?.data || null,
      performanceData: results.get('leaderboard_system')?.data || null,
      documentsData: results.get('document_management')?.data || null,
      timeData: results.get('time_tracking')?.data || null,
      portalData: results.get('employee_portal')?.data || null
    };

    let totalItems = 0;
    for (const [system, result] of results) {
      if (result.success && result.data) {
        if (Array.isArray(result.data)) {
          totalItems += result.data.length;
        } else if (typeof result.data === 'object') {
          totalItems += Object.keys(result.data).length;
        } else {
          totalItems += 1;
        }
      }
    }

    return {
      success: true,
      data: combinedData,
      systemsQueried: Array.from(results.keys()),
      totalItems,
      queriedAt: new Date(),
      query: query.substring(0, 100)
    };
  }

  setupWebhookHandlers() {
    // Setup webhook handlers for real-time updates from integrated systems
    this.webhookHandlers.set('hr_update', this.handleHRUpdate.bind(this));
    this.webhookHandlers.set('performance_update', this.handlePerformanceUpdate.bind(this));
    this.webhookHandlers.set('document_update', this.handleDocumentUpdate.bind(this));
    
    logger.info('Webhook handlers setup completed');
  }

  async handleHRUpdate(data) {
    try {
      logger.info('Processing HR update webhook', { type: data.type, employeeId: data.employee_id });
      
      // Emit event for other services to handle
      this.emit('hr_data_updated', {
        type: data.type,
        employeeId: data.employee_id,
        data: data,
        timestamp: new Date()
      });
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to handle HR update', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async handlePerformanceUpdate(data) {
    try {
      logger.info('Processing performance update webhook', { type: data.type, employeeId: data.employee_id });
      
      this.emit('performance_data_updated', {
        type: data.type,
        employeeId: data.employee_id,
        data: data,
        timestamp: new Date()
      });
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to handle performance update', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async handleDocumentUpdate(data) {
    try {
      logger.info('Processing document update webhook', { type: data.type, documentId: data.document_id });
      
      this.emit('document_updated', {
        type: data.type,
        documentId: data.document_id,
        data: data,
        timestamp: new Date()
      });
      
      return { success: true };
    } catch (error) {
      logger.error('Failed to handle document update', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  startSyncSchedules() {
    // Setup periodic sync schedules for keeping data up-to-date
    this.syncSchedules.set('hr_sync', {
      interval: 24 * 60 * 60 * 1000, // Daily
      lastSync: null,
      method: this.syncHRData.bind(this)
    });

    this.syncSchedules.set('performance_sync', {
      interval: 4 * 60 * 60 * 1000, // Every 4 hours
      lastSync: null,
      method: this.syncPerformanceData.bind(this)
    });

    // Start sync timers
    for (const [syncId, syncConfig] of this.syncSchedules) {
      setInterval(async () => {
        try {
          await syncConfig.method();
          syncConfig.lastSync = new Date();
          logger.info(`${syncId} completed successfully`);
        } catch (error) {
          logger.error(`${syncId} failed`, { error: error.message });
        }
      }, syncConfig.interval);
    }

    logger.info('Sync schedules started');
  }

  async syncHRData() {
    // Sync critical HR data
    logger.info('Starting HR data sync');
    // Implementation would sync essential HR data
  }

  async syncPerformanceData() {
    // Sync performance metrics
    logger.info('Starting performance data sync');
    // Implementation would sync performance metrics
  }

  sanitizeEmployeeData(employeeData, requestingUserId) {
    // Remove sensitive information based on requesting user permissions
    const sanitized = { ...employeeData };
    
    // Always remove sensitive fields unless it's the employee's own data
    if (requestingUserId !== employeeData.employee_id) {
      delete sanitized.salary;
      delete sanitized.social_security;
      delete sanitized.personal_phone;
      delete sanitized.home_address;
      delete sanitized.emergency_contacts;
    }

    return sanitized;
  }

  async checkHRPermissions(userId, action) {
    // Check if user has permission to perform HR actions
    // This would integrate with the HR system's permission model
    return true; // Simplified for now
  }

  updateIntegrationMetrics(integrationId, status) {
    if (!this.integrationMetrics.has(integrationId)) {
      this.integrationMetrics.set(integrationId, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        lastRequest: null
      });
    }

    const metrics = this.integrationMetrics.get(integrationId);
    metrics.totalRequests++;
    metrics.lastRequest = new Date();

    if (status === 'success') {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }
  }

  // Public methods for monitoring and management

  getIntegrationStatus() {
    const status = {};
    
    for (const [integrationId, integration] of this.integrations) {
      const metrics = this.integrationMetrics.get(integrationId);
      
      status[integrationId] = {
        name: integration.name,
        type: integration.type,
        enabled: integration.enabled,
        hasClient: this.apiClients.has(integrationId),
        metrics: metrics || { totalRequests: 0, successfulRequests: 0, failedRequests: 0 },
        lastSync: this.syncSchedules.get(`${integration.type}_sync`)?.lastSync || null
      };
    }
    
    return status;
  }

  async testIntegration(integrationId) {
    try {
      const client = this.apiClients.get(integrationId);
      if (!client) {
        return { success: false, error: 'Integration not available' };
      }

      // Test with a simple health check endpoint
      const response = await client.get('/health', { timeout: 5000 });
      
      return {
        success: true,
        status: response.status,
        responseTime: Date.now(),
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status || 'unknown'
      };
    }
  }

  async refreshIntegrationToken(integrationId) {
    // Refresh API tokens when needed
    logger.info('Refreshing integration token', { integrationId });
    // Implementation would handle token refresh
    return { success: true };
  }

  getAvailableIntegrations() {
    return Array.from(this.integrations.entries()).map(([id, config]) => ({
      id,
      name: config.name,
      type: config.type,
      enabled: config.enabled
    }));
  }
}