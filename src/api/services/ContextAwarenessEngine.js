import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Context Awareness Engine for Susan AI
 * Understands employee roles, departments, and specific needs
 * Provides personalized, context-appropriate responses
 */
export class ContextAwarenessEngine {
  constructor(knowledgeService) {
    this.knowledgeService = knowledgeService;
    this.contextDir = path.join(__dirname, '../../../data/contexts');
    
    this.employeeProfiles = new Map();
    this.departmentContexts = new Map();
    this.roleDefinitions = new Map();
    this.contextualRules = new Map();
    this.accessPermissions = new Map();
    
    this.initializeContextEngine();
  }

  async initializeContextEngine() {
    await this.ensureContextDirectories();
    this.setupDepartmentContexts();
    this.setupRoleDefinitions();
    this.setupContextualRules();
    this.setupAccessPermissions();
    await this.loadEmployeeProfiles();
  }

  async ensureContextDirectories() {
    await fs.ensureDir(this.contextDir);
    await fs.ensureDir(path.join(this.contextDir, 'employees'));
    await fs.ensureDir(path.join(this.contextDir, 'departments'));
    await fs.ensureDir(path.join(this.contextDir, 'roles'));
  }

  setupDepartmentContexts() {
    this.departmentContexts.set('sales', {
      name: 'Sales Department',
      focus: ['customer_relations', 'estimates', 'contracts', 'pricing'],
      commonQuestions: [
        'pricing guidelines', 'customer communication', 'estimate procedures',
        'contract terms', 'lead management', 'sales targets'
      ],
      tools: ['CRM system', 'estimating software', 'pricing calculator'],
      processes: ['lead_to_close', 'estimate_approval', 'customer_followup'],
      restrictions: ['internal_costs', 'employee_personal_info', 'competitive_intelligence'],
      urgentTopics: ['customer_complaints', 'pricing_errors', 'contract_disputes'],
      escalationPath: 'sales_manager -> operations_manager -> general_manager',
      workingHours: 'Monday-Friday 8AM-6PM, Saturday 9AM-2PM',
      peakTimes: ['Monday mornings', 'after storms', 'spring season'],
      kpis: ['conversion_rate', 'estimate_accuracy', 'customer_satisfaction'],
      supportContacts: {
        manager: 'sales-manager@roof-er.com',
        admin: 'sales-admin@roof-er.com',
        support: 'sales-support@roof-er.com'
      }
    });

    this.departmentContexts.set('operations', {
      name: 'Operations Department',
      focus: ['scheduling', 'equipment', 'safety', 'quality_control'],
      commonQuestions: [
        'schedule changes', 'equipment maintenance', 'safety procedures',
        'material orders', 'weather delays', 'quality standards'
      ],
      tools: ['scheduling software', 'equipment tracking', 'safety checklists'],
      processes: ['job_scheduling', 'equipment_maintenance', 'safety_inspections'],
      restrictions: ['customer_pricing', 'employee_personal_info', 'financial_details'],
      urgentTopics: ['safety_incidents', 'equipment_failures', 'weather_emergencies'],
      escalationPath: 'field_supervisor -> operations_manager -> general_manager',
      workingHours: 'Monday-Friday 6AM-7PM, Emergency on-call',
      peakTimes: ['early morning', 'weather events', 'busy season'],
      kpis: ['job_completion_rate', 'safety_incidents', 'equipment_uptime'],
      supportContacts: {
        manager: 'operations-manager@roof-er.com',
        supervisor: 'field-supervisor@roof-er.com',
        safety: 'safety@roof-er.com'
      }
    });

    this.departmentContexts.set('customer_service', {
      name: 'Customer Service Department',
      focus: ['customer_support', 'warranties', 'complaints', 'followup'],
      commonQuestions: [
        'warranty claims', 'customer complaints', 'service requests',
        'appointment scheduling', 'payment issues', 'communication protocols'
      ],
      tools: ['helpdesk system', 'warranty database', 'communication platform'],
      processes: ['complaint_resolution', 'warranty_processing', 'customer_followup'],
      restrictions: ['internal_operations', 'employee_info', 'detailed_pricing'],
      urgentTopics: ['customer_emergencies', 'warranty_disputes', 'service_failures'],
      escalationPath: 'cs_supervisor -> operations_manager -> general_manager',
      workingHours: 'Monday-Friday 8AM-6PM',
      peakTimes: ['after installations', 'storm season', 'warranty period'],
      kpis: ['response_time', 'resolution_rate', 'customer_satisfaction'],
      supportContacts: {
        manager: 'cs-manager@roof-er.com',
        supervisor: 'cs-supervisor@roof-er.com',
        escalation: 'cs-escalation@roof-er.com'
      }
    });

    this.departmentContexts.set('installation', {
      name: 'Installation Department',
      focus: ['installation_procedures', 'materials', 'safety', 'quality'],
      commonQuestions: [
        'installation techniques', 'material specifications', 'safety requirements',
        'quality standards', 'tool usage', 'weather considerations'
      ],
      tools: ['installation equipment', 'safety gear', 'quality meters'],
      processes: ['pre_installation', 'installation_execution', 'quality_inspection'],
      restrictions: ['customer_pricing', 'business_strategy', 'financial_data'],
      urgentTopics: ['safety_hazards', 'installation_errors', 'equipment_malfunctions'],
      escalationPath: 'field_supervisor -> operations_manager -> safety_officer',
      workingHours: 'Monday-Friday 7AM-6PM, Weather dependent',
      peakTimes: ['good weather days', 'scheduled installation days'],
      kpis: ['installation_quality', 'completion_time', 'safety_compliance'],
      supportContacts: {
        supervisor: 'field-supervisor@roof-er.com',
        safety: 'safety@roof-er.com',
        quality: 'quality@roof-er.com'
      }
    });

    this.departmentContexts.set('hr', {
      name: 'Human Resources',
      focus: ['employee_relations', 'benefits', 'policies', 'compliance'],
      commonQuestions: [
        'benefits information', 'policy clarification', 'leave requests',
        'performance reviews', 'training requirements', 'complaint procedures'
      ],
      tools: ['HRIS system', 'benefits portal', 'policy database'],
      processes: ['onboarding', 'performance_management', 'benefits_administration'],
      restrictions: ['none'], // HR has broad access for employee assistance
      urgentTopics: ['harassment_reports', 'safety_violations', 'legal_issues'],
      escalationPath: 'hr_specialist -> hr_manager -> general_manager -> legal',
      workingHours: 'Monday-Friday 8AM-5PM',
      peakTimes: ['open_enrollment', 'performance_review_periods', 'onboarding'],
      kpis: ['employee_satisfaction', 'compliance_rate', 'response_time'],
      supportContacts: {
        manager: 'hr-manager@roof-er.com',
        benefits: 'benefits@roof-er.com',
        compliance: 'compliance@roof-er.com'
      }
    });

    this.departmentContexts.set('administration', {
      name: 'Administration',
      focus: ['procedures', 'documentation', 'compliance', 'support'],
      commonQuestions: [
        'form procedures', 'documentation requirements', 'process clarification',
        'system access', 'compliance requirements', 'administrative support'
      ],
      tools: ['document management', 'process tracking', 'compliance systems'],
      processes: ['document_management', 'process_improvement', 'compliance_monitoring'],
      restrictions: ['confidential_personnel_data', 'financial_details'],
      urgentTopics: ['compliance_violations', 'system_outages', 'document_emergencies'],
      escalationPath: 'admin_supervisor -> operations_manager -> general_manager',
      workingHours: 'Monday-Friday 8AM-5PM',
      peakTimes: ['audit_periods', 'compliance_deadlines', 'system_updates'],
      kpis: ['process_efficiency', 'compliance_rate', 'document_accuracy'],
      supportContacts: {
        manager: 'admin-manager@roof-er.com',
        support: 'admin-support@roof-er.com',
        compliance: 'compliance@roof-er.com'
      }
    });
  }

  setupRoleDefinitions() {
    this.roleDefinitions.set('field_technician', {
      title: 'Field Technician',
      level: 'individual_contributor',
      departments: ['installation', 'operations'],
      responsibilities: [
        'roof installations', 'safety compliance', 'quality control',
        'equipment maintenance', 'customer interaction'
      ],
      permissions: {
        access_level: 'field_operations',
        restricted_topics: ['pricing', 'contracts', 'financial_data', 'personnel_records'],
        priority_topics: ['safety', 'installation_procedures', 'equipment', 'materials']
      },
      common_needs: [
        'installation procedures', 'safety requirements', 'material specifications',
        'equipment operation', 'quality standards', 'weather protocols'
      ],
      escalation_contacts: ['field_supervisor', 'safety_officer'],
      work_context: {
        location: 'field',
        schedule: 'project_based',
        equipment_dependent: true,
        weather_dependent: true
      }
    });

    this.roleDefinitions.set('sales_representative', {
      title: 'Sales Representative',
      level: 'individual_contributor',
      departments: ['sales'],
      responsibilities: [
        'customer communication', 'estimates', 'lead management',
        'contract presentation', 'customer education'
      ],
      permissions: {
        access_level: 'customer_facing',
        restricted_topics: ['internal_costs', 'employee_personal_info', 'operations_details'],
        priority_topics: ['pricing', 'products', 'customer_service', 'contracts']
      },
      common_needs: [
        'pricing guidelines', 'product information', 'estimate procedures',
        'customer communication', 'contract terms', 'competitive_info'
      ],
      escalation_contacts: ['sales_manager', 'customer_service'],
      work_context: {
        location: 'office_and_field',
        schedule: 'flexible',
        customer_facing: true,
        commission_based: true
      }
    });

    this.roleDefinitions.set('customer_service_rep', {
      title: 'Customer Service Representative',
      level: 'individual_contributor',
      departments: ['customer_service'],
      responsibilities: [
        'customer support', 'complaint resolution', 'warranty management',
        'appointment scheduling', 'communication coordination'
      ],
      permissions: {
        access_level: 'customer_support',
        restricted_topics: ['internal_operations', 'employee_personal_info', 'detailed_pricing'],
        priority_topics: ['customer_service', 'warranties', 'scheduling', 'communication']
      },
      common_needs: [
        'warranty information', 'complaint procedures', 'scheduling systems',
        'customer communication', 'escalation procedures', 'service_protocols'
      ],
      escalation_contacts: ['cs_supervisor', 'operations_manager'],
      work_context: {
        location: 'office',
        schedule: 'regular_hours',
        customer_facing: true,
        phone_based: true
      }
    });

    this.roleDefinitions.set('supervisor', {
      title: 'Supervisor',
      level: 'management',
      departments: ['operations', 'installation', 'customer_service'],
      responsibilities: [
        'team management', 'quality oversight', 'problem resolution',
        'performance management', 'training coordination'
      ],
      permissions: {
        access_level: 'supervisory',
        restricted_topics: ['executive_decisions', 'confidential_hr', 'financial_strategy'],
        priority_topics: ['team_management', 'operations', 'quality', 'safety']
      },
      common_needs: [
        'team management', 'performance metrics', 'operational procedures',
        'quality standards', 'problem resolution', 'training resources'
      ],
      escalation_contacts: ['department_manager', 'hr_manager'],
      work_context: {
        location: 'office_and_field',
        schedule: 'extended_hours',
        team_responsible: true,
        decision_making: 'operational'
      }
    });

    this.roleDefinitions.set('manager', {
      title: 'Manager',
      level: 'management',
      departments: ['all'],
      responsibilities: [
        'departmental strategy', 'budget management', 'policy implementation',
        'performance oversight', 'escalation resolution'
      ],
      permissions: {
        access_level: 'management',
        restricted_topics: ['executive_strategy', 'confidential_legal', 'board_matters'],
        priority_topics: ['management', 'strategy', 'budgets', 'performance', 'policy']
      },
      common_needs: [
        'management tools', 'performance data', 'budget information',
        'policy implementation', 'strategic planning', 'compliance'
      ],
      escalation_contacts: ['general_manager', 'senior_leadership'],
      work_context: {
        location: 'office',
        schedule: 'flexible_extended',
        budget_responsible: true,
        decision_making: 'strategic'
      }
    });

    this.roleDefinitions.set('office_staff', {
      title: 'Office Staff',
      level: 'individual_contributor',
      departments: ['administration', 'hr', 'finance'],
      responsibilities: [
        'administrative support', 'documentation', 'data entry',
        'customer communication', 'process support'
      ],
      permissions: {
        access_level: 'administrative',
        restricted_topics: ['field_operations', 'technical_specs', 'executive_decisions'],
        priority_topics: ['procedures', 'documentation', 'systems', 'support']
      },
      common_needs: [
        'administrative procedures', 'system access', 'documentation standards',
        'communication protocols', 'form procedures', 'support_processes'
      ],
      escalation_contacts: ['supervisor', 'department_manager'],
      work_context: {
        location: 'office',
        schedule: 'regular_hours',
        system_dependent: true,
        support_role: true
      }
    });
  }

  setupContextualRules() {
    this.contextualRules.set('role_based_filtering', {
      description: 'Filter content based on user role permissions',
      priority: 'high',
      apply: (content, userContext) => this.applyRoleBasedFiltering(content, userContext)
    });

    this.contextualRules.set('department_relevance', {
      description: 'Boost relevance of department-specific content',
      priority: 'medium',
      apply: (content, userContext) => this.applyDepartmentRelevance(content, userContext)
    });

    this.contextualRules.set('experience_level_adjustment', {
      description: 'Adjust content complexity based on experience level',
      priority: 'medium',
      apply: (content, userContext) => this.adjustForExperienceLevel(content, userContext)
    });

    this.contextualRules.set('urgency_detection', {
      description: 'Detect and prioritize urgent requests',
      priority: 'high',
      apply: (content, userContext) => this.detectUrgency(content, userContext)
    });

    this.contextualRules.set('personalization', {
      description: 'Personalize responses based on user profile',
      priority: 'low',
      apply: (content, userContext) => this.personalizeContent(content, userContext)
    });
  }

  setupAccessPermissions() {
    // Define what information each access level can see
    this.accessPermissions.set('field_operations', {
      allowed: [
        'safety_procedures', 'installation_guides', 'equipment_manuals',
        'material_specs', 'quality_standards', 'basic_policies'
      ],
      restricted: [
        'pricing_details', 'financial_data', 'personnel_records',
        'strategic_plans', 'customer_financial_info'
      ]
    });

    this.accessPermissions.set('customer_facing', {
      allowed: [
        'product_information', 'pricing_guidelines', 'service_procedures',
        'customer_policies', 'warranty_information', 'communication_scripts'
      ],
      restricted: [
        'internal_costs', 'employee_records', 'operational_details',
        'competitive_intelligence', 'internal_procedures'
      ]
    });

    this.accessPermissions.set('customer_support', {
      allowed: [
        'customer_service_procedures', 'warranty_policies', 'complaint_resolution',
        'scheduling_systems', 'communication_protocols', 'basic_technical_info'
      ],
      restricted: [
        'internal_operations', 'employee_personal_info', 'detailed_pricing',
        'strategic_information', 'confidential_customer_data'
      ]
    });

    this.accessPermissions.set('administrative', {
      allowed: [
        'administrative_procedures', 'documentation_standards', 'system_guides',
        'compliance_requirements', 'general_policies', 'support_processes'
      ],
      restricted: [
        'field_technical_procedures', 'customer_pricing', 'strategic_plans',
        'confidential_personnel_data', 'executive_decisions'
      ]
    });

    this.accessPermissions.set('supervisory', {
      allowed: [
        'team_management', 'performance_metrics', 'operational_procedures',
        'quality_standards', 'training_materials', 'departmental_policies'
      ],
      restricted: [
        'executive_strategy', 'confidential_hr_matters', 'financial_strategy',
        'legal_matters', 'board_decisions'
      ]
    });

    this.accessPermissions.set('management', {
      allowed: [
        'management_tools', 'performance_data', 'budget_information',
        'policy_implementation', 'strategic_planning', 'compliance_data'
      ],
      restricted: [
        'executive_strategy', 'confidential_legal_matters', 'board_decisions',
        'merger_acquisition_info', 'sensitive_financial_data'
      ]
    });
  }

  /**
   * Build comprehensive user context from available information
   */
  async buildUserContext(userInfo) {
    try {
      const {
        employeeId = null,
        department = null,
        role = null,
        email = null,
        preferences = {},
        sessionHistory = []
      } = userInfo;

      logger.debug('Building user context', { employeeId, department, role });

      // Get or create employee profile
      let employeeProfile = null;
      if (employeeId) {
        employeeProfile = await this.getEmployeeProfile(employeeId);
        if (!employeeProfile) {
          employeeProfile = await this.createEmployeeProfile(employeeId, { department, role, email });
        }
      }

      // Get department context
      const departmentContext = this.departmentContexts.get(department?.toLowerCase()) || null;

      // Get role definition
      const roleDefinition = this.roleDefinitions.get(role?.toLowerCase()) || null;

      // Determine access level
      const accessLevel = this.determineAccessLevel(roleDefinition, departmentContext);

      // Get permissions
      const permissions = this.accessPermissions.get(accessLevel) || { allowed: [], restricted: [] };

      // Build comprehensive context
      const userContext = {
        employee: {
          id: employeeId,
          profile: employeeProfile,
          department: department,
          role: role,
          email: email
        },
        department: departmentContext,
        role: roleDefinition,
        access: {
          level: accessLevel,
          permissions: permissions
        },
        preferences: {
          ...preferences,
          responseStyle: preferences.responseStyle || 'helpful',
          detailLevel: preferences.detailLevel || 'medium',
          includeExamples: preferences.includeExamples !== false
        },
        session: {
          history: sessionHistory,
          currentTopics: this.extractCurrentTopics(sessionHistory),
          urgencyLevel: this.assessSessionUrgency(sessionHistory)
        },
        context_metadata: {
          contextBuiltAt: new Date(),
          contextVersion: '1.0',
          hasCompleteInfo: !!(employeeId && department && role)
        }
      };

      logger.info('User context built successfully', {
        employeeId,
        department,
        role,
        accessLevel,
        hasProfile: !!employeeProfile
      });

      return userContext;

    } catch (error) {
      logger.error('Failed to build user context', {
        userInfo: { employeeId: userInfo.employeeId, department: userInfo.department, role: userInfo.role },
        error: error.message
      });

      // Return minimal context
      return {
        employee: { id: null, profile: null, department: userInfo.department, role: userInfo.role },
        department: null,
        role: null,
        access: { level: 'basic', permissions: { allowed: ['general_information'], restricted: [] } },
        preferences: { responseStyle: 'helpful', detailLevel: 'medium', includeExamples: true },
        session: { history: [], currentTopics: [], urgencyLevel: 'normal' },
        context_metadata: { hasCompleteInfo: false, error: error.message }
      };
    }
  }

  /**
   * Apply contextual filtering to search results and responses
   */
  async applyContextualFiltering(content, userContext, query = '') {
    try {
      let filteredContent = content;

      // Apply all contextual rules
      for (const [ruleName, rule] of this.contextualRules) {
        try {
          filteredContent = await rule.apply(filteredContent, userContext, query);
        } catch (error) {
          logger.warn(`Contextual rule ${ruleName} failed`, { error: error.message });
        }
      }

      return {
        filteredContent,
        contextualizationApplied: true,
        userContext: {
          department: userContext.employee?.department,
          role: userContext.employee?.role,
          accessLevel: userContext.access?.level
        }
      };

    } catch (error) {
      logger.error('Contextual filtering failed', { error: error.message });
      return {
        filteredContent: content,
        contextualizationApplied: false,
        error: error.message
      };
    }
  }

  /**
   * Generate context-aware response enhancements
   */
  async generateContextualEnhancements(response, userContext, query) {
    const enhancements = {
      personalizedGreeting: this.generatePersonalizedGreeting(userContext),
      roleSpecificTips: this.generateRoleSpecificTips(response, userContext),
      departmentResources: this.getDepartmentResources(userContext),
      escalationContext: this.getContextualEscalationInfo(userContext),
      relatedTopics: this.suggestRelatedTopics(response, userContext, query)
    };

    return enhancements;
  }

  // Implementation of contextual rules

  async applyRoleBasedFiltering(content, userContext) {
    const permissions = userContext.access?.permissions;
    if (!permissions) return content;

    // Filter out restricted content
    let filtered = content;
    
    if (Array.isArray(content)) {
      // Filter search results
      filtered = content.filter(item => {
        const itemCategory = item.metadata?.category || 'general';
        return !permissions.restricted.some(restricted => 
          itemCategory.toLowerCase().includes(restricted.toLowerCase())
        );
      });
    } else if (typeof content === 'string') {
      // Check if response contains restricted information
      for (const restricted of permissions.restricted) {
        if (content.toLowerCase().includes(restricted.toLowerCase())) {
          // Add warning or remove sensitive parts
          const warning = `\n\n*Note: Some information may be restricted based on your role permissions.*`;
          filtered = content + warning;
          break;
        }
      }
    }

    return filtered;
  }

  async applyDepartmentRelevance(content, userContext) {
    const department = userContext.employee?.department;
    const departmentContext = userContext.department;
    
    if (!department || !departmentContext) return content;

    if (Array.isArray(content)) {
      // Boost relevance of department-specific content
      return content.map(item => {
        let relevanceBoost = 1.0;
        
        // Check if content matches department focus areas
        if (departmentContext.focus.some(focus => 
          (item.content || '').toLowerCase().includes(focus.toLowerCase())
        )) {
          relevanceBoost += 0.2;
        }

        // Check if content matches common questions
        if (departmentContext.commonQuestions.some(question => 
          (item.content || '').toLowerCase().includes(question.toLowerCase())
        )) {
          relevanceBoost += 0.1;
        }

        return {
          ...item,
          confidence: Math.min(1.0, (item.confidence || 0.5) * relevanceBoost),
          departmentRelevance: relevanceBoost > 1.0
        };
      });
    }

    return content;
  }

  async adjustForExperienceLevel(content, userContext) {
    const employeeProfile = userContext.employee?.profile;
    const experienceLevel = employeeProfile?.experienceLevel || 'intermediate';

    if (typeof content === 'string') {
      if (experienceLevel === 'beginner') {
        // Add more detailed explanations for beginners
        return content + '\n\n*New to this topic? Feel free to ask for more detailed explanations or examples.*';
      } else if (experienceLevel === 'expert') {
        // Provide more concise information for experts
        return content.replace(/\*\*Note:\*\*.*?\n/g, ''); // Remove basic notes
      }
    }

    return content;
  }

  async detectUrgency(content, userContext) {
    const urgentKeywords = [
      'emergency', 'urgent', 'asap', 'immediately', 'critical',
      'accident', 'injury', 'danger', 'safety', 'help'
    ];

    const queryText = typeof content === 'string' ? content : '';
    const hasUrgentKeywords = urgentKeywords.some(keyword => 
      queryText.toLowerCase().includes(keyword)
    );

    if (hasUrgentKeywords) {
      userContext.session.urgencyLevel = 'high';
      
      if (typeof content === 'string') {
        return `🚨 **Urgent Request Detected** 🚨\n\n${content}\n\n*This appears to be an urgent request. If this is a safety emergency, please call 911 or contact emergency services immediately.*`;
      }
    }

    return content;
  }

  async personalizeContent(content, userContext) {
    const employeeProfile = userContext.employee?.profile;
    const preferences = userContext.preferences;

    if (!employeeProfile) return content;

    if (typeof content === 'string') {
      // Add personalized elements
      let personalized = content;

      // Add preferred name if available
      if (employeeProfile.preferredName) {
        personalized = personalized.replace(/Hi there/g, `Hi ${employeeProfile.preferredName}`);
      }

      // Adjust detail level based on preferences
      if (preferences.detailLevel === 'brief') {
        // Condense content for brief preference
        personalized = personalized.replace(/\*\*.*?\*\*\n/g, ''); // Remove bold section headers
      }

      return personalized;
    }

    return content;
  }

  // Helper methods

  async getEmployeeProfile(employeeId) {
    try {
      const profilePath = path.join(this.contextDir, 'employees', `${employeeId}.json`);
      
      if (await fs.pathExists(profilePath)) {
        const profile = await fs.readJson(profilePath);
        this.employeeProfiles.set(employeeId, profile);
        return profile;
      }
      
      return null;
    } catch (error) {
      logger.warn('Failed to load employee profile', { employeeId, error: error.message });
      return null;
    }
  }

  async createEmployeeProfile(employeeId, initialData) {
    try {
      const profile = {
        employeeId,
        department: initialData.department,
        role: initialData.role,
        email: initialData.email,
        createdAt: new Date(),
        experienceLevel: 'intermediate', // Default
        preferences: {
          responseStyle: 'helpful',
          detailLevel: 'medium',
          includeExamples: true
        },
        interactionHistory: [],
        commonQuestions: [],
        lastActive: new Date()
      };

      const profilePath = path.join(this.contextDir, 'employees', `${employeeId}.json`);
      await fs.writeJson(profilePath, profile, { spaces: 2 });
      
      this.employeeProfiles.set(employeeId, profile);
      
      return profile;
    } catch (error) {
      logger.error('Failed to create employee profile', { employeeId, error: error.message });
      return null;
    }
  }

  determineAccessLevel(roleDefinition, departmentContext) {
    if (!roleDefinition) return 'basic';
    return roleDefinition.permissions?.access_level || 'basic';
  }

  extractCurrentTopics(sessionHistory) {
    // Extract topics from recent session history
    const recentHistory = sessionHistory.slice(-5); // Last 5 interactions
    const topics = new Set();
    
    recentHistory.forEach(interaction => {
      if (interaction.topics) {
        interaction.topics.forEach(topic => topics.add(topic));
      }
    });

    return Array.from(topics);
  }

  assessSessionUrgency(sessionHistory) {
    const urgentKeywords = ['emergency', 'urgent', 'critical', 'immediately'];
    
    const recentMessages = sessionHistory.slice(-3);
    const hasUrgentContent = recentMessages.some(msg => 
      urgentKeywords.some(keyword => 
        (msg.content || '').toLowerCase().includes(keyword)
      )
    );

    return hasUrgentContent ? 'high' : 'normal';
  }

  generatePersonalizedGreeting(userContext) {
    const department = userContext.employee?.department;
    const role = userContext.employee?.role;
    const timeOfDay = this.getTimeOfDay();

    if (department && role) {
      return `Good ${timeOfDay}! I'm here to help you with ${department} and ${role}-related questions.`;
    } else if (department) {
      return `Good ${timeOfDay}! I'm here to help with ${department} department questions.`;
    }

    return `Good ${timeOfDay}! I'm Susan, your Roof-ER assistant. How can I help you today?`;
  }

  generateRoleSpecificTips(response, userContext) {
    const roleDefinition = userContext.role;
    if (!roleDefinition) return [];

    const tips = [];
    
    // Add role-specific tips based on common needs
    if (roleDefinition.common_needs) {
      const relevantNeeds = roleDefinition.common_needs.slice(0, 3);
      tips.push({
        type: 'role_tip',
        content: `As a ${roleDefinition.title}, you might also find helpful: ${relevantNeeds.join(', ')}`
      });
    }

    return tips;
  }

  getDepartmentResources(userContext) {
    const departmentContext = userContext.department;
    if (!departmentContext) return [];

    const resources = [];
    
    if (departmentContext.tools) {
      resources.push({
        type: 'tools',
        title: 'Department Tools',
        items: departmentContext.tools
      });
    }

    if (departmentContext.supportContacts) {
      resources.push({
        type: 'contacts',
        title: 'Support Contacts',
        items: Object.entries(departmentContext.supportContacts).map(([role, contact]) => ({
          role,
          contact
        }))
      });
    }

    return resources;
  }

  getContextualEscalationInfo(userContext) {
    const departmentContext = userContext.department;
    const roleDefinition = userContext.role;

    if (!departmentContext && !roleDefinition) return null;

    const escalationPath = departmentContext?.escalationPath || 
                          roleDefinition?.escalation_contacts?.join(' -> ');

    return {
      escalationPath,
      primaryContacts: roleDefinition?.escalation_contacts || [],
      departmentSupport: departmentContext?.supportContacts || {}
    };
  }

  suggestRelatedTopics(response, userContext, query) {
    const department = userContext.employee?.department;
    const departmentContext = userContext.department;
    
    if (!departmentContext) return [];

    // Suggest topics related to user's department
    const relatedTopics = departmentContext.commonQuestions
      .filter(question => !query.toLowerCase().includes(question.toLowerCase()))
      .slice(0, 3);

    return relatedTopics.map(topic => ({
      topic,
      relevance: 'department_related'
    }));
  }

  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  async loadEmployeeProfiles() {
    try {
      const employeesDir = path.join(this.contextDir, 'employees');
      
      if (await fs.pathExists(employeesDir)) {
        const profileFiles = await fs.readdir(employeesDir);
        
        for (const file of profileFiles) {
          if (file.endsWith('.json')) {
            const employeeId = file.replace('.json', '');
            await this.getEmployeeProfile(employeeId);
          }
        }
      }

      logger.info('Employee profiles loaded', {
        profilesLoaded: this.employeeProfiles.size
      });

    } catch (error) {
      logger.error('Failed to load employee profiles', { error: error.message });
    }
  }

  // Public methods for external use

  async updateEmployeeProfile(employeeId, updates) {
    try {
      let profile = this.employeeProfiles.get(employeeId);
      
      if (!profile) {
        profile = await this.createEmployeeProfile(employeeId, updates);
      } else {
        profile = { ...profile, ...updates, lastUpdated: new Date() };
        this.employeeProfiles.set(employeeId, profile);
        
        const profilePath = path.join(this.contextDir, 'employees', `${employeeId}.json`);
        await fs.writeJson(profilePath, profile, { spaces: 2 });
      }

      return profile;
    } catch (error) {
      logger.error('Failed to update employee profile', { employeeId, error: error.message });
      throw error;
    }
  }

  getContextualInsights(userContext) {
    return {
      department_info: userContext.department,
      role_info: userContext.role,
      access_level: userContext.access?.level,
      personalization_available: !!userContext.employee?.profile,
      context_completeness: userContext.context_metadata?.hasCompleteInfo
    };
  }

  getDepartmentInfo(departmentName) {
    return this.departmentContexts.get(departmentName?.toLowerCase()) || null;
  }

  getRoleInfo(roleName) {
    return this.roleDefinitions.get(roleName?.toLowerCase()) || null;
  }

  getAvailableRoles() {
    return Array.from(this.roleDefinitions.keys());
  }

  getAvailableDepartments() {
    return Array.from(this.departmentContexts.keys());
  }
}