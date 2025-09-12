import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Escalation Engine for Susan AI
 * Handles management escalation and intelligent fallback systems
 * Ensures employees get proper help when AI knowledge is insufficient
 */
export class EscalationEngine {
  constructor(knowledgeService) {
    this.knowledgeService = knowledgeService;
    
    this.initializeEscalationRules();
    this.initializeFallbackStrategies();
    this.initializeContactDirectory();
    this.initializeEscalationTracking();
  }

  initializeEscalationRules() {
    // Rules that trigger escalation to management/specialists
    this.escalationRules = new Map([
      ['confidence_threshold', {
        description: 'Escalate when response confidence is below threshold',
        threshold: 0.6,
        priority: 'medium',
        method: this.checkConfidenceThreshold.bind(this)
      }],
      
      ['sensitive_topics', {
        description: 'Escalate sensitive HR or legal matters',
        keywords: ['harassment', 'discrimination', 'legal', 'lawsuit', 'complaint', 'grievance', 'termination', 'disciplinary'],
        priority: 'high',
        method: this.checkSensitiveTopics.bind(this)
      }],
      
      ['safety_critical', {
        description: 'Immediately escalate safety-critical issues',
        keywords: ['emergency', 'accident', 'injury', 'danger', 'hazard', 'unsafe', 'OSHA', 'violation'],
        priority: 'critical',
        method: this.checkSafetyCritical.bind(this)
      }],
      
      ['financial_matters', {
        description: 'Escalate complex financial or contractual questions',
        keywords: ['salary', 'bonus', 'contract', 'raise', 'promotion', 'budget', 'expense', 'reimbursement'],
        priority: 'medium',
        method: this.checkFinancialMatters.bind(this)
      }],
      
      ['policy_exceptions', {
        description: 'Escalate requests for policy exceptions or special cases',
        keywords: ['exception', 'special case', 'waiver', 'override', 'approve', 'authorize'],
        priority: 'medium',
        method: this.checkPolicyExceptions.bind(this)
      }],
      
      ['technical_complexity', {
        description: 'Escalate highly technical or specialized questions',
        indicators: ['no_relevant_sources', 'multiple_interpretations', 'requires_expertise'],
        priority: 'low',
        method: this.checkTechnicalComplexity.bind(this)
      }]
    ]);
  }

  initializeFallbackStrategies() {
    this.fallbackStrategies = new Map([
      ['partial_information', {
        description: 'Provide partial info with clear limitations and escalation path',
        applicableWhen: ['low_confidence', 'incomplete_sources'],
        method: this.generatePartialResponse.bind(this)
      }],
      
      ['guided_self_service', {
        description: 'Guide user to self-service resources while offering escalation',
        applicableWhen: ['common_questions', 'documented_procedures'],
        method: this.generateGuidedSelfService.bind(this)
      }],
      
      ['contextual_escalation', {
        description: 'Smart escalation based on user context and question type',
        applicableWhen: ['always'],
        method: this.generateContextualEscalation.bind(this)
      }],
      
      ['emergency_protocol', {
        description: 'Immediate escalation for emergencies',
        applicableWhen: ['safety_critical', 'urgent'],
        method: this.generateEmergencyProtocol.bind(this)
      }]
    ]);
  }

  initializeContactDirectory() {
    this.contactDirectory = new Map([
      ['hr_general', {
        name: 'HR Department',
        contact: 'hr@roof-er.com',
        phone: 'ext. 200',
        availability: 'Monday-Friday 8AM-5PM',
        topics: ['benefits', 'policies', 'leave', 'payroll', 'training', 'employee relations'],
        escalationLevel: 'department',
        responseTime: '24 hours'
      }],
      
      ['hr_manager', {
        name: 'HR Manager',
        contact: 'hr-manager@roof-er.com',
        phone: 'ext. 201',
        availability: 'Monday-Friday 8AM-5PM',
        topics: ['sensitive issues', 'complaints', 'policy exceptions', 'disciplinary matters'],
        escalationLevel: 'management',
        responseTime: '4 hours'
      }],
      
      ['operations_manager', {
        name: 'Operations Manager',
        contact: 'operations@roof-er.com',
        phone: 'ext. 300',
        availability: 'Monday-Friday 7AM-6PM',
        topics: ['schedules', 'equipment', 'safety', 'field operations', 'quality'],
        escalationLevel: 'management',
        responseTime: '2 hours'
      }],
      
      ['field_supervisor', {
        name: 'Field Supervisor',
        contact: 'field-supervisor@roof-er.com',
        phone: 'ext. 301',
        availability: 'Monday-Friday 6AM-7PM, Emergency on-call',
        topics: ['installation', 'safety', 'materials', 'quality', 'field issues'],
        escalationLevel: 'supervisor',
        responseTime: '1 hour'
      }],
      
      ['safety_officer', {
        name: 'Safety Officer',
        contact: 'safety@roof-er.com',
        phone: 'ext. 911',
        availability: '24/7 Emergency, Regular hours Monday-Friday 8AM-5PM',
        topics: ['safety incidents', 'hazards', 'OSHA', 'safety training', 'equipment safety'],
        escalationLevel: 'specialist',
        responseTime: 'Immediate for emergencies, 2 hours otherwise'
      }],
      
      ['it_support', {
        name: 'IT Support',
        contact: 'it@roof-er.com',
        phone: 'ext. 400',
        availability: 'Monday-Friday 8AM-5PM',
        topics: ['systems', 'software', 'passwords', 'equipment', 'network'],
        escalationLevel: 'department',
        responseTime: '4 hours'
      }],
      
      ['finance_manager', {
        name: 'Finance Manager',
        contact: 'finance@roof-er.com',
        phone: 'ext. 500',
        availability: 'Monday-Friday 8AM-5PM',
        topics: ['expenses', 'reimbursements', 'payroll issues', 'budget', 'contracts'],
        escalationLevel: 'management',
        responseTime: '24 hours'
      }],
      
      ['general_manager', {
        name: 'General Manager',
        contact: 'gm@roof-er.com',
        phone: 'ext. 100',
        availability: 'Monday-Friday 8AM-6PM',
        topics: ['company policy', 'strategic decisions', 'serious complaints', 'escalated issues'],
        escalationLevel: 'senior_management',
        responseTime: '24-48 hours'
      }],
      
      ['emergency_line', {
        name: 'Emergency Response',
        contact: '911 or company emergency hotline',
        phone: '1-800-ROOF-911',
        availability: '24/7',
        topics: ['medical emergencies', 'safety incidents', 'security issues'],
        escalationLevel: 'emergency',
        responseTime: 'Immediate'
      }]
    ]);
  }

  initializeEscalationTracking() {
    this.escalationMetrics = {
      totalEscalations: 0,
      escalationsByReason: new Map(),
      escalationsByContact: new Map(),
      escalationsByDepartment: new Map(),
      responseTimeTracking: new Map()
    };
  }

  /**
   * Main escalation analysis method
   */
  async analyzeEscalationNeed(query, searchResults, context = {}) {
    try {
      logger.info('Analyzing escalation need', {
        query: query.substring(0, 50),
        resultsCount: searchResults.length,
        context: { department: context.department, role: context.role }
      });

      const escalationAnalysis = {
        shouldEscalate: false,
        escalationReason: null,
        priority: 'low',
        recommendedContact: null,
        fallbackStrategy: null,
        confidence: 0
      };

      // Run all escalation rules
      const ruleResults = await this.runEscalationRules(query, searchResults, context);
      
      // Determine if escalation is needed
      const escalationDecision = this.makeEscalationDecision(ruleResults);
      
      if (escalationDecision.shouldEscalate) {
        escalationAnalysis.shouldEscalate = true;
        escalationAnalysis.escalationReason = escalationDecision.reason;
        escalationAnalysis.priority = escalationDecision.priority;
        escalationAnalysis.recommendedContact = await this.selectBestContact(query, context, escalationDecision.reason);
        escalationAnalysis.confidence = escalationDecision.confidence;
      } else {
        // Determine best fallback strategy
        escalationAnalysis.fallbackStrategy = this.selectFallbackStrategy(query, searchResults, context);
      }

      // Log escalation decision
      this.logEscalationDecision(escalationAnalysis, query, context);

      return escalationAnalysis;

    } catch (error) {
      logger.error('Escalation analysis failed', {
        query: query.substring(0, 50),
        error: error.message
      });

      // Return safe default escalation
      return {
        shouldEscalate: true,
        escalationReason: 'system_error',
        priority: 'medium',
        recommendedContact: this.contactDirectory.get('general_manager'),
        fallbackStrategy: null,
        confidence: 0.5,
        error: error.message
      };
    }
  }

  async runEscalationRules(query, searchResults, context) {
    const results = new Map();

    for (const [ruleName, rule] of this.escalationRules) {
      try {
        const ruleResult = await rule.method(query, searchResults, context, rule);
        results.set(ruleName, {
          ...ruleResult,
          ruleName,
          priority: rule.priority,
          description: rule.description
        });
      } catch (error) {
        logger.warn(`Escalation rule ${ruleName} failed`, { error: error.message });
        results.set(ruleName, {
          triggered: false,
          confidence: 0,
          reason: `Rule execution failed: ${error.message}`,
          ruleName,
          priority: rule.priority
        });
      }
    }

    return results;
  }

  async checkConfidenceThreshold(query, searchResults, context, rule) {
    const confidence = this.calculateResponseConfidence(searchResults);
    const triggered = confidence < rule.threshold;

    return {
      triggered,
      confidence,
      reason: triggered ? `Response confidence ${Math.round(confidence * 100)}% below threshold ${Math.round(rule.threshold * 100)}%` : null,
      metadata: {
        calculatedConfidence: confidence,
        threshold: rule.threshold
      }
    };
  }

  async checkSensitiveTopics(query, searchResults, context, rule) {
    const queryLower = query.toLowerCase();
    const triggeredKeywords = rule.keywords.filter(keyword => 
      queryLower.includes(keyword.toLowerCase())
    );

    const triggered = triggeredKeywords.length > 0;

    return {
      triggered,
      confidence: triggered ? 0.9 : 0,
      reason: triggered ? `Sensitive topic detected: ${triggeredKeywords.join(', ')}` : null,
      metadata: {
        triggeredKeywords,
        allKeywords: rule.keywords
      }
    };
  }

  async checkSafetyCritical(query, searchResults, context, rule) {
    const queryLower = query.toLowerCase();
    const triggeredKeywords = rule.keywords.filter(keyword => 
      queryLower.includes(keyword.toLowerCase())
    );

    const triggered = triggeredKeywords.length > 0;

    return {
      triggered,
      confidence: triggered ? 1.0 : 0,
      reason: triggered ? `Safety-critical issue detected: ${triggeredKeywords.join(', ')}` : null,
      metadata: {
        triggeredKeywords,
        immediateEscalation: triggered
      }
    };
  }

  async checkFinancialMatters(query, searchResults, context, rule) {
    const queryLower = query.toLowerCase();
    const triggeredKeywords = rule.keywords.filter(keyword => 
      queryLower.includes(keyword.toLowerCase())
    );

    // Check if this requires management approval
    const requiresApproval = triggeredKeywords.some(keyword => 
      ['raise', 'bonus', 'promotion', 'salary'].includes(keyword)
    );

    const triggered = triggeredKeywords.length > 0 && (requiresApproval || searchResults.length === 0);

    return {
      triggered,
      confidence: triggered ? 0.8 : 0,
      reason: triggered ? `Financial matter requiring management input: ${triggeredKeywords.join(', ')}` : null,
      metadata: {
        triggeredKeywords,
        requiresApproval
      }
    };
  }

  async checkPolicyExceptions(query, searchResults, context, rule) {
    const queryLower = query.toLowerCase();
    const triggeredKeywords = rule.keywords.filter(keyword => 
      queryLower.includes(keyword.toLowerCase())
    );

    const triggered = triggeredKeywords.length > 0;

    return {
      triggered,
      confidence: triggered ? 0.8 : 0,
      reason: triggered ? `Policy exception request detected: ${triggeredKeywords.join(', ')}` : null,
      metadata: {
        triggeredKeywords
      }
    };
  }

  async checkTechnicalComplexity(query, searchResults, context, rule) {
    let complexityScore = 0;
    const reasons = [];

    // No relevant sources found
    if (!searchResults || searchResults.length === 0) {
      complexityScore += 0.4;
      reasons.push('No relevant sources available');
    }

    // Low confidence results
    const avgConfidence = this.calculateResponseConfidence(searchResults);
    if (avgConfidence < 0.5) {
      complexityScore += 0.3;
      reasons.push('Low confidence in available information');
    }

    // Multiple possible interpretations
    if (searchResults.length > 0 && this.hasMultipleInterpretations(searchResults)) {
      complexityScore += 0.2;
      reasons.push('Multiple interpretations possible');
    }

    // Highly technical query
    if (this.isHighlyTechnical(query)) {
      complexityScore += 0.3;
      reasons.push('Highly technical query requiring expertise');
    }

    const triggered = complexityScore > 0.6;

    return {
      triggered,
      confidence: complexityScore,
      reason: triggered ? `Technical complexity: ${reasons.join(', ')}` : null,
      metadata: {
        complexityScore,
        reasons
      }
    };
  }

  makeEscalationDecision(ruleResults) {
    let highestPriority = null;
    let triggeredRules = [];
    let maxConfidence = 0;

    // Collect all triggered rules
    for (const [ruleName, result] of ruleResults) {
      if (result.triggered) {
        triggeredRules.push(result);
        maxConfidence = Math.max(maxConfidence, result.confidence);
        
        if (!highestPriority || this.getPriorityWeight(result.priority) > this.getPriorityWeight(highestPriority.priority)) {
          highestPriority = result;
        }
      }
    }

    if (triggeredRules.length === 0) {
      return { shouldEscalate: false };
    }

    return {
      shouldEscalate: true,
      reason: highestPriority.reason,
      priority: highestPriority.priority,
      confidence: maxConfidence,
      triggeredRules: triggeredRules.map(r => r.ruleName)
    };
  }

  async selectBestContact(query, context, escalationReason) {
    const queryLower = query.toLowerCase();
    
    // Emergency situations
    if (escalationReason.includes('Safety-critical') || queryLower.includes('emergency')) {
      if (queryLower.includes('medical') || queryLower.includes('accident') || queryLower.includes('injury')) {
        return this.contactDirectory.get('emergency_line');
      } else {
        return this.contactDirectory.get('safety_officer');
      }
    }

    // Sensitive topics
    if (escalationReason.includes('Sensitive topic')) {
      return this.contactDirectory.get('hr_manager');
    }

    // Financial matters
    if (escalationReason.includes('Financial matter')) {
      return this.contactDirectory.get('finance_manager');
    }

    // Department-based selection
    if (context.department) {
      const deptContact = this.getDepartmentContact(context.department);
      if (deptContact) {
        return deptContact;
      }
    }

    // Topic-based selection
    const topicContact = this.getTopicBasedContact(queryLower);
    if (topicContact) {
      return topicContact;
    }

    // Default to general manager for complex issues
    return this.contactDirectory.get('general_manager');
  }

  selectFallbackStrategy(query, searchResults, context) {
    const confidence = this.calculateResponseConfidence(searchResults);
    
    if (confidence > 0.4 && searchResults.length > 0) {
      return this.fallbackStrategies.get('partial_information');
    } else if (this.hasCommonPattern(query)) {
      return this.fallbackStrategies.get('guided_self_service');
    } else {
      return this.fallbackStrategies.get('contextual_escalation');
    }
  }

  /**
   * Generate escalation response based on analysis
   */
  async generateEscalationResponse(escalationAnalysis, query, searchResults, context = {}) {
    try {
      const { shouldEscalate, escalationReason, priority, recommendedContact, fallbackStrategy } = escalationAnalysis;

      if (shouldEscalate) {
        return await this.generateContactEscalation(escalationAnalysis, query, searchResults, context);
      } else if (fallbackStrategy) {
        return await fallbackStrategy.method(query, searchResults, context);
      } else {
        return await this.generateContextualEscalation(query, searchResults, context);
      }

    } catch (error) {
      logger.error('Escalation response generation failed', { error: error.message });
      return this.generateEmergencyFallback(query, context);
    }
  }

  async generateContactEscalation(escalationAnalysis, query, searchResults, context) {
    const { escalationReason, priority, recommendedContact } = escalationAnalysis;
    const contact = recommendedContact;

    let urgencyText = '';
    if (priority === 'critical') {
      urgencyText = '🚨 **URGENT** - ';
    } else if (priority === 'high') {
      urgencyText = '⚠️ **Important** - ';
    }

    const partialInfo = searchResults.length > 0 ? 
      `I found some related information, but ${escalationReason.toLowerCase()}. ` : '';

    const response = `${urgencyText}I want to ensure you get the most accurate help with "${query.substring(0, 60)}..."

${partialInfo}

**I recommend contacting:**
${contact.name}
📧 ${contact.contact}
📞 ${contact.phone}
🕐 Available: ${contact.availability}
⏱️ Expected response time: ${contact.responseTime}

**Why I'm recommending this contact:**
${escalationReason}

${this.generateContactGuidance(contact, priority)}

${priority === 'critical' ? '**Please contact immediately for safety-critical issues.**' : 'I\'m here to help with other questions I can answer directly!'}`;

    // Track escalation
    this.trackEscalation(escalationAnalysis, query, context);

    return {
      content: response,
      escalation: {
        contact: contact,
        reason: escalationReason,
        priority: priority,
        urgency: priority === 'critical' ? 'immediate' : priority === 'high' ? 'same_day' : 'normal'
      },
      metadata: {
        responseType: 'escalation',
        escalationId: this.generateEscalationId(),
        timestamp: new Date().toISOString()
      }
    };
  }

  async generatePartialResponse(query, searchResults, context) {
    if (!searchResults || searchResults.length === 0) {
      return this.generateContextualEscalation(query, searchResults, context);
    }

    const bestResult = searchResults[0];
    const partialContent = bestResult.content.substring(0, 200) + '...';
    const contact = await this.selectBestContact(query, context, 'incomplete_information');

    return {
      content: `I can provide some information about "${query}":

${partialContent}

**However, for complete and up-to-date information, I recommend contacting:**
${contact.name} at ${contact.contact}

**Why I'm suggesting additional contact:**
The available information may not cover all aspects of your specific situation.

**In the meantime:**
• Review the employee portal for additional resources
• Check with your direct supervisor for immediate guidance
• Feel free to ask me about other topics where I have more complete information

**Sources referenced:**
${searchResults.slice(0, 2).map(s => `• ${s.source || 'Company Documentation'}`).join('\n')}`,
      
      fallback: true,
      escalationSuggested: true,
      metadata: {
        responseType: 'partial_with_escalation',
        partialInfo: true
      }
    };
  }

  async generateGuidedSelfService(query, searchResults, context) {
    const selfServiceOptions = this.generateSelfServiceOptions(query, context);
    const contact = await this.selectBestContact(query, context, 'self_service_guidance');

    return {
      content: `I can guide you toward the best resources for "${query}":

**Self-Service Options:**
${selfServiceOptions.map(option => `• ${option}`).join('\n')}

**If you need additional help:**
Contact ${contact.name} at ${contact.contact}
They're available ${contact.availability}

**Quick Tips:**
• Have your employee ID ready when contacting departments
• Be specific about your situation for faster assistance
• Keep notes of any reference numbers provided

I'm always here to help with questions I can answer directly!`,
      
      selfService: true,
      escalationOffered: true,
      metadata: {
        responseType: 'guided_self_service',
        selfServiceOptions: selfServiceOptions.length
      }
    };
  }

  async generateContextualEscalation(query, searchResults, context) {
    const contact = await this.selectBestContact(query, context, 'general_inquiry');
    const alternativeContacts = this.getAlternativeContacts(contact, context);

    return {
      content: `I want to make sure you get the most accurate information about "${query}".

**I recommend contacting:**
${contact.name} at ${contact.contact}
Available: ${contact.availability}

${alternativeContacts.length > 0 ? `**Alternative contacts:**
${alternativeContacts.map(c => `• ${c.name} (${c.contact}) - For ${c.specialty}`).join('\n')}` : ''}

**Before you contact them, you might also:**
• Check the employee portal at [portal link]
• Review your employee handbook
• Ask your direct supervisor for immediate guidance

**What to mention when you contact them:**
"Susan AI suggested I contact you about [your specific question]. I need help with [brief description]."

I'm here to help with other questions I can answer directly!`,
      
      contextualEscalation: true,
      metadata: {
        responseType: 'contextual_escalation',
        primaryContact: contact.name,
        alternativeContacts: alternativeContacts.length
      }
    };
  }

  async generateEmergencyProtocol(query, searchResults, context) {
    const emergencyContact = this.contactDirectory.get('emergency_line');
    const safetyContact = this.contactDirectory.get('safety_officer');

    return {
      content: `🚨 **EMERGENCY PROTOCOL ACTIVATED**

For immediate emergencies:
📞 **Call 911** for medical, fire, or police emergencies
📞 **Call ${emergencyContact.phone}** for company emergency hotline

For safety incidents:
📞 **Contact ${safetyContact.name}** at ${safetyContact.phone}
📧 ${safetyContact.contact}

**Important:**
• Ensure everyone's safety first
• Report incidents immediately
• Follow your emergency procedures
• Document details when safe to do so

**Do not delay - contact emergency services immediately if anyone is in danger.**`,
      
      emergency: true,
      priority: 'critical',
      metadata: {
        responseType: 'emergency_protocol',
        timestamp: new Date().toISOString()
      }
    };
  }

  generateEmergencyFallback(query, context) {
    return {
      content: `I want to help you with "${query}", but I'm experiencing a technical issue.

**For immediate assistance:**
• Contact your direct supervisor
• Call HR at ext. 200
• Email management at management@roof-er.com

**For emergencies:**
• Call 911 for medical/safety emergencies
• Call the company emergency line: 1-800-ROOF-911

I apologize for the inconvenience. Please try asking your question again in a few minutes.`,
      
      systemError: true,
      metadata: {
        responseType: 'emergency_fallback',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Helper methods

  calculateResponseConfidence(searchResults) {
    if (!searchResults || searchResults.length === 0) return 0;
    
    const avgConfidence = searchResults.reduce((sum, result) => 
      sum + (result.confidence || 0), 0) / searchResults.length;
    
    const topResultConfidence = searchResults[0]?.confidence || 0;
    
    // Weight recent results higher
    return (avgConfidence * 0.6) + (topResultConfidence * 0.4);
  }

  getPriorityWeight(priority) {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    return weights[priority] || 0;
  }

  getDepartmentContact(department) {
    const deptMapping = {
      'hr': 'hr_general',
      'operations': 'operations_manager',
      'it': 'it_support',
      'finance': 'finance_manager',
      'safety': 'safety_officer'
    };
    
    const contactKey = deptMapping[department.toLowerCase()];
    return contactKey ? this.contactDirectory.get(contactKey) : null;
  }

  getTopicBasedContact(queryLower) {
    for (const [contactKey, contact] of this.contactDirectory) {
      if (contact.topics.some(topic => queryLower.includes(topic))) {
        return contact;
      }
    }
    return null;
  }

  hasMultipleInterpretations(searchResults) {
    // Simple check - in production would use more sophisticated analysis
    return searchResults.length > 3 && 
           searchResults.some(r => r.confidence < 0.7);
  }

  isHighlyTechnical(query) {
    const technicalIndicators = [
      'integration', 'API', 'configuration', 'implementation',
      'algorithm', 'architecture', 'specification', 'protocol'
    ];
    
    const queryLower = query.toLowerCase();
    return technicalIndicators.some(indicator => queryLower.includes(indicator));
  }

  hasCommonPattern(query) {
    const commonPatterns = [
      /how (?:do|can) i/i,
      /what is the (?:process|procedure)/i,
      /where (?:do|can) i find/i,
      /when is (?:the|my)/i
    ];
    
    return commonPatterns.some(pattern => pattern.test(query));
  }

  generateContactGuidance(contact, priority) {
    let guidance = `**When you contact them:**
• Mention that Susan AI referred you
• Be specific about your situation
• Have your employee ID ready`;

    if (priority === 'high' || priority === 'critical') {
      guidance += `
• Mention this is ${priority} priority
• Request urgent assistance`;
    }

    return guidance;
  }

  generateSelfServiceOptions(query, context) {
    const options = [
      'Check the employee portal for documented procedures',
      'Review your employee handbook for policy information',
      'Use the company directory to find department contacts'
    ];

    // Add context-specific options
    if (context.department === 'hr') {
      options.push('Access the benefits portal for benefit information');
    } else if (context.department === 'operations') {
      options.push('Check the field operations manual');
    }

    return options;
  }

  getAlternativeContacts(primaryContact, context) {
    const alternatives = [];
    
    // Add HR as fallback for most issues
    if (primaryContact.name !== 'HR Department' && primaryContact.name !== 'HR Manager') {
      alternatives.push({
        name: 'HR Department',
        contact: 'hr@roof-er.com',
        specialty: 'policy and employee questions'
      });
    }

    // Add general manager for complex issues
    if (primaryContact.escalationLevel !== 'senior_management') {
      alternatives.push({
        name: 'General Manager',
        contact: 'gm@roof-er.com',
        specialty: 'complex or escalated issues'
      });
    }

    return alternatives.slice(0, 2); // Limit to avoid overwhelming
  }

  trackEscalation(escalationAnalysis, query, context) {
    try {
      this.escalationMetrics.totalEscalations++;
      
      // Track by reason
      const reason = escalationAnalysis.escalationReason || 'unknown';
      this.escalationMetrics.escalationsByReason.set(
        reason,
        (this.escalationMetrics.escalationsByReason.get(reason) || 0) + 1
      );
      
      // Track by contact
      const contactName = escalationAnalysis.recommendedContact?.name || 'unknown';
      this.escalationMetrics.escalationsByContact.set(
        contactName,
        (this.escalationMetrics.escalationsByContact.get(contactName) || 0) + 1
      );
      
      // Track by department
      const department = context.department || 'unknown';
      this.escalationMetrics.escalationsByDepartment.set(
        department,
        (this.escalationMetrics.escalationsByDepartment.get(department) || 0) + 1
      );

    } catch (error) {
      logger.warn('Failed to track escalation metrics', { error: error.message });
    }
  }

  logEscalationDecision(escalationAnalysis, query, context) {
    logger.info('Escalation decision made', {
      query: query.substring(0, 50),
      shouldEscalate: escalationAnalysis.shouldEscalate,
      reason: escalationAnalysis.escalationReason,
      priority: escalationAnalysis.priority,
      recommendedContact: escalationAnalysis.recommendedContact?.name,
      context: { department: context.department, role: context.role }
    });
  }

  generateEscalationId() {
    return `esc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  getEscalationMetrics() {
    return {
      ...this.escalationMetrics,
      escalationsByReason: Object.fromEntries(this.escalationMetrics.escalationsByReason),
      escalationsByContact: Object.fromEntries(this.escalationMetrics.escalationsByContact),
      escalationsByDepartment: Object.fromEntries(this.escalationMetrics.escalationsByDepartment)
    };
  }
}