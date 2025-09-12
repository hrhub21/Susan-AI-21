import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Advanced Response Generation Engine for Susan AI
 * Generates helpful, contextual responses with examples and actionable guidance
 */
export class ResponseGenerationEngine {
  constructor(knowledgeService, searchEngine) {
    this.knowledgeService = knowledgeService;
    this.searchEngine = searchEngine;
    
    this.initializeTemplates();
    this.initializeResponsePatterns();
    this.initializeExampleGenerators();
  }

  initializeTemplates() {
    this.responseTemplates = new Map([
      ['policy_explanation', {
        systemPrompt: `You are Susan, a helpful Roof-ER employee assistant. Explain company policies clearly and provide practical examples. Always be professional, supportive, and include actionable next steps.

When explaining policies:
1. Start with a clear, direct answer
2. Provide the key policy details
3. Give practical examples
4. Include next steps or actions
5. Mention who to contact for more help

Use a friendly, professional tone and always aim to be genuinely helpful.`,
        
        template: `**{policyTitle}**

{explanation}

**Key Points:**
{keyPoints}

**Examples:**
{examples}

**Next Steps:**
{nextSteps}

**Need More Help?**
{escalationInfo}

*Source: {sources}*`,
        
        requiredFields: ['policyTitle', 'explanation', 'sources'],
        optionalFields: ['keyPoints', 'examples', 'nextSteps', 'escalationInfo']
      }],

      ['procedure_guide', {
        systemPrompt: `You are Susan, a knowledgeable Roof-ER assistant. Provide clear, step-by-step guidance for company procedures. Make sure employees can easily follow the steps and know what to do if they need help.

For procedures:
1. Give a brief overview first
2. List clear, numbered steps
3. Include important warnings or notes
4. Provide examples where helpful
5. Include contact information for assistance

Be encouraging and supportive in your tone.`,
        
        template: `**How to: {procedureTitle}**

{overview}

**Steps:**
{steps}

**Important Notes:**
{notes}

**Example:**
{example}

**Need Assistance?**
{supportInfo}

*Source: {sources}*`,
        
        requiredFields: ['procedureTitle', 'overview', 'steps', 'sources'],
        optionalFields: ['notes', 'example', 'supportInfo']
      }],

      ['benefit_information', {
        systemPrompt: `You are Susan, a helpful HR assistant for Roof-ER employees. Explain benefits clearly and help employees understand how to use them. Always be encouraging about the benefits available and provide clear instructions.

For benefit information:
1. Start with what the benefit is and why it's valuable
2. Explain eligibility clearly
3. Provide step-by-step instructions for using the benefit
4. Give real examples when possible
5. Include contact information for questions

Use a warm, supportive tone that makes employees feel valued.`,
        
        template: `**{benefitName}**

{description}

**What This Means for You:**
{personalValue}

**Eligibility:**
{eligibility}

**How to Use This Benefit:**
{instructions}

**Example:**
{example}

**Questions?**
Contact HR at hr@roof-er.com or ext. 200 - we're here to help!

*Source: {sources}*`,
        
        requiredFields: ['benefitName', 'description', 'sources'],
        optionalFields: ['personalValue', 'eligibility', 'instructions', 'example']
      }],

      ['safety_guidance', {
        systemPrompt: `You are Susan, a safety-focused assistant for Roof-ER employees. Safety is our top priority. Provide clear, actionable safety guidance and always emphasize the importance of following safety procedures.

For safety information:
1. Start with why the safety measure is important
2. Provide clear, specific instructions
3. Include warnings about what NOT to do
4. Give examples of proper safety practices
5. Always include emergency contact information

Use a serious but supportive tone that emphasizes care for employee wellbeing.`,
        
        template: `**Safety Alert: {safetyTopic}**

⚠️ **Why This Matters:** {importance}

**Safety Requirements:**
{requirements}

**Step-by-Step:**
{steps}

**⛔ Important - DO NOT:**
{warnings}

**Example of Proper Practice:**
{example}

**🚨 Emergency Contact:** {emergencyContact}
**Questions?** {supportContact}

*Source: {sources}*`,
        
        requiredFields: ['safetyTopic', 'importance', 'requirements', 'emergencyContact', 'sources'],
        optionalFields: ['steps', 'warnings', 'example', 'supportContact']
      }],

      ['technical_support', {
        systemPrompt: `You are Susan, a technical support assistant for Roof-ER employees. Help employees solve technical issues with clear, step-by-step guidance. Be patient and thorough in your explanations.

For technical support:
1. Acknowledge the issue and show understanding
2. Provide clear troubleshooting steps
3. Include screenshots or visual descriptions when helpful
4. Offer alternative solutions if the first doesn't work
5. Provide escalation path to IT support

Use a patient, helpful tone and break down complex technical concepts.`,
        
        template: `**Technical Support: {issueType}**

I understand you're having trouble with {problemDescription}. Let me walk you through the solution:

**Quick Fix:**
{quickSolution}

**Detailed Steps:**
{detailedSteps}

**If That Doesn't Work:**
{alternativeSolution}

**Still Having Issues?**
Contact IT Support at it@roof-er.com or ext. 400
They're available: {supportHours}

*Source: {sources}*`,
        
        requiredFields: ['issueType', 'problemDescription', 'quickSolution', 'sources'],
        optionalFields: ['detailedSteps', 'alternativeSolution', 'supportHours']
      }],

      ['escalation_response', {
        systemPrompt: `You are Susan, a helpful Roof-ER assistant. When you don't have complete information, be honest about limitations while still providing value. Always guide employees to the right person who can help them fully.

For escalation responses:
1. Acknowledge what you do know
2. Be honest about limitations
3. Provide any helpful partial information
4. Direct to the most appropriate contact
5. Set expectations for follow-up

Use a helpful, honest tone that builds trust.`,
        
        template: `I want to make sure you get the most accurate information about {topic}.

{partialInformation}

**For Complete Information:**
I recommend contacting {contactName} at {contactInfo}
{contactDetails}

**Why I'm recommending this contact:**
{escalationReason}

**In the meantime:**
{interimSteps}

I'm always here to help with what I do know - feel free to ask about anything else!`,
        
        requiredFields: ['topic', 'contactName', 'contactInfo', 'escalationReason'],
        optionalFields: ['partialInformation', 'contactDetails', 'interimSteps']
      }]
    ]);
  }

  initializeResponsePatterns() {
    this.responsePatterns = new Map([
      ['question_about_policy', {
        indicators: ['policy', 'rule', 'allowed', 'permitted', 'regulation'],
        template: 'policy_explanation',
        confidence_threshold: 0.7
      }],
      ['how_to_procedure', {
        indicators: ['how to', 'how do i', 'steps', 'procedure', 'process'],
        template: 'procedure_guide',
        confidence_threshold: 0.7
      }],
      ['benefits_inquiry', {
        indicators: ['benefit', 'insurance', 'vacation', 'sick leave', 'pay', 'compensation'],
        template: 'benefit_information',
        confidence_threshold: 0.7
      }],
      ['safety_concern', {
        indicators: ['safety', 'danger', 'hazard', 'accident', 'injury', 'emergency'],
        template: 'safety_guidance',
        confidence_threshold: 0.8
      }],
      ['technical_issue', {
        indicators: ['computer', 'software', 'system', 'login', 'password', 'error'],
        template: 'technical_support',
        confidence_threshold: 0.7
      }]
    ]);
  }

  initializeExampleGenerators() {
    this.exampleGenerators = new Map([
      ['copy_paste', (content, context) => this.generateCopyPasteExamples(content, context)],
      ['scenario', (content, context) => this.generateScenarioExamples(content, context)],
      ['template', (content, context) => this.generateTemplateExamples(content, context)],
      ['checklist', (content, context) => this.generateChecklistExamples(content, context)]
    ]);
  }

  /**
   * Generate a comprehensive response based on search results and context
   */
  async generateResponse(query, searchResults, context = {}) {
    try {
      const {
        employeeId = null,
        department = null,
        role = null,
        responseStyle = 'helpful',
        includeExamples = true,
        includeNextSteps = true
      } = context;

      logger.info('Generating knowledge response', {
        query: query.substring(0, 50),
        resultsCount: searchResults.length,
        department,
        role
      });

      // Determine response template based on query analysis
      const templateType = this.analyzeQueryType(query, searchResults);
      const template = this.responseTemplates.get(templateType);

      if (!template) {
        throw new Error(`Template not found: ${templateType}`);
      }

      // Calculate overall confidence
      const confidence = this.calculateResponseConfidence(searchResults);

      // Generate response content using AI
      const aiGeneratedContent = await this.generateAIContent(query, searchResults, template, context);

      // Extract and format key information
      const formattedResponse = await this.formatResponse(aiGeneratedContent, template, searchResults);

      // Generate examples if requested
      let examples = [];
      if (includeExamples && searchResults.length > 0) {
        examples = await this.generateExamples(query, searchResults, context);
      }

      // Generate next steps if requested
      let nextSteps = [];
      if (includeNextSteps) {
        nextSteps = await this.generateNextSteps(query, searchResults, context);
      }

      // Add source citations
      const sources = this.formatSources(searchResults);

      const response = {
        content: formattedResponse,
        examples,
        nextSteps,
        sources,
        confidence,
        metadata: {
          templateUsed: templateType,
          sourcesCount: searchResults.length,
          confidenceScore: confidence,
          context: { department, role, employeeId }
        }
      };

      logger.info('Response generated successfully', {
        templateType,
        confidence,
        examplesCount: examples.length,
        nextStepsCount: nextSteps.length
      });

      return response;

    } catch (error) {
      logger.error('Response generation failed', {
        query: query.substring(0, 50),
        error: error.message
      });
      
      return this.generateFallbackResponse(query, context);
    }
  }

  analyzeQueryType(query, searchResults) {
    const queryLower = query.toLowerCase();
    
    // Check each pattern
    for (const [patternName, pattern] of this.responsePatterns) {
      if (pattern.indicators.some(indicator => queryLower.includes(indicator))) {
        // Verify confidence if we have search results
        if (searchResults.length > 0) {
          const avgConfidence = this.calculateAverageConfidence(searchResults);
          if (avgConfidence >= pattern.confidence_threshold) {
            return pattern.template;
          }
        } else {
          return pattern.template;
        }
      }
    }

    // Default to policy explanation for general queries
    return 'policy_explanation';
  }

  calculateResponseConfidence(searchResults) {
    if (!searchResults || searchResults.length === 0) {
      return 0.3;
    }

    // Base confidence on search result quality
    const avgConfidence = this.calculateAverageConfidence(searchResults);
    const topResultConfidence = searchResults[0]?.confidence || 0;
    const resultCount = Math.min(searchResults.length, 5);

    // Weighted calculation
    return Math.min(1.0, (avgConfidence * 0.4) + (topResultConfidence * 0.4) + (resultCount * 0.04));
  }

  async generateAIContent(query, searchResults, template, context) {
    if (!this.knowledgeService.openai && !this.knowledgeService.anthropic) {
      return this.generateTemplateBasedContent(query, searchResults, template, context);
    }

    try {
      // Build context from search results
      const sourceContext = searchResults.slice(0, 3).map(result => 
        `Source: ${result.source}\nContent: ${result.content.substring(0, 500)}...`
      ).join('\n\n');

      const messages = [
        {
          role: 'system',
          content: template.systemPrompt
        },
        {
          role: 'user',
          content: `Question: ${query}

Available Information:
${sourceContext}

Please provide a helpful, accurate response based on the available information. If the information is incomplete, acknowledge this and suggest appropriate next steps.

Employee Context:
- Department: ${context.department || 'Not specified'}
- Role: ${context.role || 'Not specified'}
- Response Style: ${context.responseStyle || 'helpful'}`
        }
      ];

      let aiResponse;
      if (this.knowledgeService.openai) {
        const response = await this.knowledgeService.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages,
          temperature: 0.3,
          max_tokens: 800
        });
        aiResponse = response.choices[0].message.content;
      } else if (this.knowledgeService.anthropic) {
        const response = await this.knowledgeService.anthropic.messages.create({
          model: 'claude-3-haiku',
          max_tokens: 800,
          temperature: 0.3,
          system: template.systemPrompt,
          messages: [{ role: 'user', content: messages[1].content }]
        });
        aiResponse = response.content[0].text;
      }

      return aiResponse;

    } catch (error) {
      logger.warn('AI content generation failed, falling back to templates', {
        error: error.message
      });
      return this.generateTemplateBasedContent(query, searchResults, template, context);
    }
  }

  generateTemplateBasedContent(query, searchResults, template, context) {
    const topResult = searchResults[0];
    if (!topResult) {
      return `I found limited information about "${query}". Let me connect you with someone who can provide more complete assistance.`;
    }

    const content = topResult.content.substring(0, 300) + '...';
    const source = topResult.source || 'Company Documentation';

    return `Based on our ${source.toLowerCase()}, here's what I can tell you about ${query}:

${content}

This information should help get you started. If you need more specific details, I'd be happy to connect you with the appropriate department.`;
  }

  async formatResponse(aiContent, template, searchResults) {
    // For now, return the AI content directly
    // In a full implementation, this would apply the template formatting
    return aiContent;
  }

  async generateExamples(query, searchResults, context) {
    const examples = [];
    const queryType = this.determineExampleType(query);
    
    try {
      switch (queryType) {
        case 'email_template':
          examples.push(...this.generateEmailExamples(query, searchResults, context));
          break;
        case 'form_completion':
          examples.push(...this.generateFormExamples(query, searchResults, context));
          break;
        case 'procedure_steps':
          examples.push(...this.generateStepExamples(query, searchResults, context));
          break;
        case 'communication':
          examples.push(...this.generateCommunicationExamples(query, searchResults, context));
          break;
        default:
          examples.push(...this.generateGeneralExamples(query, searchResults, context));
      }
    } catch (error) {
      logger.warn('Example generation failed', { error: error.message });
    }

    return examples.slice(0, 3); // Limit to 3 examples
  }

  generateEmailExamples(query, searchResults, context) {
    return [{
      type: 'email_template',
      title: 'Email Template - Copy & Paste',
      content: `Subject: [Your specific request/question]

Hi [Manager/Department Name],

I hope this message finds you well. I'm writing to request information about [specific topic from your question].

[Add specific details about your situation]

Could you please help me with [specific ask]? I would appreciate any guidance you can provide.

Thank you for your time and assistance.

Best regards,
[Your Name]
[Your Position]
[Your Contact Information]`,
      copyable: true
    }];
  }

  generateFormExamples(query, searchResults, context) {
    return [{
      type: 'form_example',
      title: 'How to Complete the Form',
      content: `1. Fill in your personal information in the top section
2. Select the appropriate category for your request
3. Provide detailed description in the comments section
4. Attach any required supporting documents
5. Submit to your supervisor for approval before final submission

**Tip:** Keep a copy for your records before submitting.`,
      copyable: false
    }];
  }

  generateStepExamples(query, searchResults, context) {
    if (searchResults.length === 0) return [];

    const content = searchResults[0].content;
    const steps = this.extractStepsFromContent(content);

    return [{
      type: 'procedure_checklist',
      title: 'Step-by-Step Checklist',
      content: steps.map((step, index) => `☐ ${index + 1}. ${step}`).join('\n'),
      copyable: true
    }];
  }

  generateCommunicationExamples(query, searchResults, context) {
    return [{
      type: 'conversation_starter',
      title: 'How to Bring This Up',
      content: `"Hi [Name], I have a question about [topic]. I've reviewed the available information, but I'd like to clarify [specific point]. When would be a good time to discuss this?"

Or via email:
"I'm following up on [topic] and need some clarification on [specific aspect]. Could we schedule a brief conversation to make sure I understand correctly?"`,
      copyable: true
    }];
  }

  generateGeneralExamples(query, searchResults, context) {
    if (searchResults.length === 0) return [];

    const topResult = searchResults[0];
    return [{
      type: 'quick_reference',
      title: 'Quick Reference',
      content: `Key points about "${query}":

• ${this.extractKeyPoints(topResult.content).slice(0, 3).join('\n• ')}

Source: ${topResult.source}`,
      copyable: true
    }];
  }

  async generateNextSteps(query, searchResults, context) {
    const nextSteps = [];

    // Standard next steps based on context
    if (context.department) {
      const deptContact = this.getDepartmentContact(context.department);
      if (deptContact) {
        nextSteps.push({
          action: `Contact ${deptContact.title}`,
          details: `Reach out to ${deptContact.name} at ${deptContact.contact} for department-specific guidance`,
          priority: 'medium'
        });
      }
    }

    // Query-specific next steps
    if (query.toLowerCase().includes('form') || query.toLowerCase().includes('application')) {
      nextSteps.push({
        action: 'Complete Required Forms',
        details: 'Gather necessary documents and complete the relevant forms',
        priority: 'high'
      });
    }

    if (query.toLowerCase().includes('training') || query.toLowerCase().includes('learn')) {
      nextSteps.push({
        action: 'Schedule Training',
        details: 'Contact HR to schedule any required training sessions',
        priority: 'medium'
      });
    }

    // Default helpful next step
    nextSteps.push({
      action: 'Follow Up if Needed',
      details: 'If you need additional clarification, don\'t hesitate to ask me or contact the appropriate department',
      priority: 'low'
    });

    return nextSteps.slice(0, 4); // Limit to 4 next steps
  }

  formatSources(searchResults) {
    return searchResults.slice(0, 3).map((result, index) => ({
      id: `source_${index + 1}`,
      title: result.source || 'Company Documentation',
      section: result.section || 'General Information',
      confidence: Math.round(result.confidence * 100),
      relevance: result.confidence > 0.8 ? 'High' : result.confidence > 0.6 ? 'Medium' : 'Low'
    }));
  }

  generateFallbackResponse(query, context) {
    const escalationContact = this.determineEscalationContact(query, context.department);

    return {
      content: `I want to make sure you get the most accurate information about "${query}".

While I have some general knowledge, I'd recommend contacting ${escalationContact.name} at ${escalationContact.contact} for the most complete and up-to-date information.

In the meantime, you might also check:
• Employee portal for additional resources
• Your direct supervisor for immediate guidance
• HR department for policy-related questions

I'm always here to help with other questions you might have!`,
      
      examples: [],
      nextSteps: [{
        action: 'Contact Appropriate Department',
        details: `Reach out to ${escalationContact.name} for accurate information`,
        priority: 'high'
      }],
      sources: [],
      confidence: 0.4,
      metadata: {
        responseType: 'fallback',
        escalationRecommended: true
      }
    };
  }

  // Helper methods
  calculateAverageConfidence(results) {
    if (!results || results.length === 0) return 0;
    const sum = results.reduce((acc, result) => acc + (result.confidence || 0), 0);
    return sum / results.length;
  }

  determineExampleType(query) {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('email') || queryLower.includes('message')) {
      return 'email_template';
    } else if (queryLower.includes('form') || queryLower.includes('application')) {
      return 'form_completion';
    } else if (queryLower.includes('how to') || queryLower.includes('steps')) {
      return 'procedure_steps';
    } else if (queryLower.includes('talk to') || queryLower.includes('discuss')) {
      return 'communication';
    }
    
    return 'general';
  }

  extractStepsFromContent(content) {
    const lines = content.split('\n');
    const steps = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^\d+\./)) {
        steps.push(trimmed.replace(/^\d+\.\s*/, ''));
      } else if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) {
        steps.push(trimmed.substring(2));
      }
    }
    
    return steps.slice(0, 6); // Limit to 6 steps
  }

  extractKeyPoints(content) {
    // Simple key point extraction
    const sentences = content.split(/[.!?]+/);
    return sentences
      .map(s => s.trim())
      .filter(s => s.length > 10 && s.length < 100)
      .slice(0, 5);
  }

  getDepartmentContact(department) {
    const contacts = {
      'hr': { name: 'HR Department', title: 'HR Team', contact: 'hr@roof-er.com or ext. 200' },
      'operations': { name: 'Operations Manager', title: 'Operations Team', contact: 'operations@roof-er.com or ext. 300' },
      'it': { name: 'IT Support', title: 'IT Department', contact: 'it@roof-er.com or ext. 400' },
      'sales': { name: 'Sales Manager', title: 'Sales Team', contact: 'sales@roof-er.com or ext. 500' }
    };
    
    return contacts[department.toLowerCase()] || null;
  }

  determineEscalationContact(query, department) {
    // Default escalation based on query type
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('benefit') || queryLower.includes('pay') || queryLower.includes('leave')) {
      return { name: 'HR Department', contact: 'hr@roof-er.com or ext. 200' };
    } else if (queryLower.includes('safety') || queryLower.includes('equipment')) {
      return { name: 'Operations Manager', contact: 'operations@roof-er.com or ext. 300' };
    } else if (queryLower.includes('system') || queryLower.includes('computer')) {
      return { name: 'IT Support', contact: 'it@roof-er.com or ext. 400' };
    }
    
    // Department-based escalation
    const deptContact = this.getDepartmentContact(department || 'management');
    return deptContact || { name: 'Management Team', contact: 'management@roof-er.com or ext. 100' };
  }
}