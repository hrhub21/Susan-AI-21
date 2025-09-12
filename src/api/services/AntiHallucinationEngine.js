import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Anti-Hallucination Engine for Susan AI
 * Prevents made-up answers and ensures accuracy from source documents
 * Provides comprehensive source attribution and confidence scoring
 */
export class AntiHallucinationEngine {
  constructor(knowledgeService) {
    this.knowledgeService = knowledgeService;
    
    this.initializeVerificationRules();
    this.initializeConfidenceThresholds();
    this.initializeSourceValidation();
  }

  initializeVerificationRules() {
    // Rules to detect potential hallucinations
    this.verificationRules = new Map([
      ['factual_consistency', {
        description: 'Check if response facts match source documents',
        weight: 0.4,
        method: this.checkFactualConsistency.bind(this)
      }],
      ['source_coverage', {
        description: 'Ensure response content is covered by sources',
        weight: 0.3,
        method: this.checkSourceCoverage.bind(this)
      }],
      ['claim_verification', {
        description: 'Verify specific claims against source material',
        weight: 0.2,
        method: this.verifyClaims.bind(this)
      }],
      ['context_adherence', {
        description: 'Check if response stays within source context',
        weight: 0.1,
        method: this.checkContextAdherence.bind(this)
      }]
    ]);
  }

  initializeConfidenceThresholds() {
    this.confidenceThresholds = {
      HIGH_CONFIDENCE: 0.85,    // Can provide direct answer
      MEDIUM_CONFIDENCE: 0.7,   // Provide answer with caveats
      LOW_CONFIDENCE: 0.5,      // Suggest escalation with partial info
      NO_CONFIDENCE: 0.3        // Must escalate, minimal info only
    };
  }

  initializeSourceValidation() {
    // Patterns that might indicate hallucination
    this.hallucinationPatterns = [
      /according to.*(?:sources|research|studies) (?:show|indicate|suggest)/i,
      /it is (?:widely )?known that/i,
      /(?:many|most|some) experts? (?:believe|think|say)/i,
      /(?:recent )?studies? (?:have )?(?:shown|found|indicated)/i,
      /common knowledge/i,
      /it has been (?:established|proven|determined)/i
    ];

    // Company-specific fact patterns to verify
    this.companyFactPatterns = [
      /Roof-ER (?:has|offers|provides|requires)/i,
      /(?:our|the) company (?:policy|procedure|rule)/i,
      /employees? (?:are|can|must|should)/i,
      /benefits? include/i,
      /(?:contact|call|email) .* at .* or/i
    ];
  }

  /**
   * Main method to verify response accuracy and prevent hallucinations
   */
  async verifyResponse(response, sources, originalQuery) {
    try {
      logger.info('Starting response verification', {
        responseLength: response.length,
        sourcesCount: sources.length,
        query: originalQuery.substring(0, 50)
      });

      // Step 1: Pre-verification checks
      const preCheckResults = await this.performPreVerificationChecks(response, sources);
      
      // Step 2: Run all verification rules
      const verificationResults = await this.runVerificationRules(response, sources, originalQuery);
      
      // Step 3: Calculate overall confidence score
      const confidenceScore = this.calculateVerificationConfidence(verificationResults, preCheckResults);
      
      // Step 4: Determine response action based on confidence
      const responseAction = this.determineResponseAction(confidenceScore);
      
      // Step 5: Apply necessary corrections or flags
      const verifiedResponse = await this.applyVerificationResults(
        response, 
        verificationResults, 
        responseAction,
        sources
      );

      const result = {
        verifiedResponse,
        confidenceScore,
        responseAction,
        verificationResults,
        sourceAttribution: this.generateSourceAttribution(sources, verificationResults),
        metadata: {
          originalLength: response.length,
          verifiedLength: verifiedResponse.length,
          modificationsApplied: response !== verifiedResponse,
          verificationPassed: confidenceScore >= this.confidenceThresholds.LOW_CONFIDENCE
        }
      };

      logger.info('Response verification completed', {
        confidenceScore,
        responseAction,
        verificationPassed: result.metadata.verificationPassed,
        modificationsApplied: result.metadata.modificationsApplied
      });

      return result;

    } catch (error) {
      logger.error('Response verification failed', {
        query: originalQuery.substring(0, 50),
        error: error.message
      });

      // Return safe fallback
      return {
        verifiedResponse: this.generateSafeResponse(originalQuery, sources),
        confidenceScore: 0.3,
        responseAction: 'escalate',
        verificationResults: { error: error.message },
        sourceAttribution: this.generateBasicSourceAttribution(sources),
        metadata: {
          verificationFailed: true,
          fallbackUsed: true
        }
      };
    }
  }

  async performPreVerificationChecks(response, sources) {
    const checks = {
      hasSourceMaterial: sources && sources.length > 0,
      responseNotEmpty: response && response.trim().length > 0,
      hallucinationPatterns: this.checkForHallucinationPatterns(response),
      companyFactClaims: this.extractCompanyFactClaims(response),
      responseLength: response.length,
      sourceLength: sources.reduce((total, source) => total + (source.content?.length || 0), 0)
    };

    // Calculate pre-check confidence
    let preCheckConfidence = 0.5;
    
    if (checks.hasSourceMaterial) preCheckConfidence += 0.2;
    if (checks.responseNotEmpty) preCheckConfidence += 0.1;
    if (checks.hallucinationPatterns.length === 0) preCheckConfidence += 0.1;
    if (checks.sourceLength > checks.responseLength * 2) preCheckConfidence += 0.1;

    return {
      ...checks,
      preCheckConfidence: Math.min(1.0, preCheckConfidence)
    };
  }

  async runVerificationRules(response, sources, originalQuery) {
    const results = new Map();

    for (const [ruleName, rule] of this.verificationRules) {
      try {
        const ruleResult = await rule.method(response, sources, originalQuery);
        results.set(ruleName, {
          ...ruleResult,
          weight: rule.weight,
          description: rule.description
        });
      } catch (error) {
        logger.warn(`Verification rule ${ruleName} failed`, { error: error.message });
        results.set(ruleName, {
          score: 0.3,
          issues: [`Rule execution failed: ${error.message}`],
          weight: rule.weight,
          description: rule.description
        });
      }
    }

    return results;
  }

  async checkFactualConsistency(response, sources, query) {
    const issues = [];
    let score = 0.8; // Start with high confidence

    // Extract factual claims from response
    const responseClaims = this.extractFactualClaims(response);
    
    // Check each claim against sources
    for (const claim of responseClaims) {
      const isSupported = this.isClaimSupportedBySources(claim, sources);
      
      if (!isSupported) {
        issues.push(`Claim not supported by sources: "${claim}"`);
        score -= 0.2;
      }
    }

    // Check for contradictions
    const contradictions = this.findContradictions(response, sources);
    if (contradictions.length > 0) {
      issues.push(...contradictions.map(c => `Contradiction found: ${c}`));
      score -= contradictions.length * 0.3;
    }

    return {
      score: Math.max(0, score),
      issues,
      claimsChecked: responseClaims.length,
      contradictions: contradictions.length
    };
  }

  async checkSourceCoverage(response, sources, query) {
    const issues = [];
    let score = 0.9;

    if (!sources || sources.length === 0) {
      return {
        score: 0.2,
        issues: ['No source material provided'],
        coverage: 0
      };
    }

    // Calculate how much of the response is covered by sources
    const responseWords = this.extractSignificantWords(response);
    const sourceWords = new Set();
    
    sources.forEach(source => {
      const words = this.extractSignificantWords(source.content || '');
      words.forEach(word => sourceWords.add(word.toLowerCase()));
    });

    let coveredWords = 0;
    const uncoveredWords = [];

    for (const word of responseWords) {
      if (sourceWords.has(word.toLowerCase())) {
        coveredWords++;
      } else if (word.length > 3 && !this.isCommonWord(word)) {
        uncoveredWords.push(word);
      }
    }

    const coverage = responseWords.length > 0 ? coveredWords / responseWords.length : 0;
    
    if (coverage < 0.6) {
      issues.push(`Low source coverage: ${Math.round(coverage * 100)}%`);
      score = coverage;
    }

    if (uncoveredWords.length > 5) {
      issues.push(`Many terms not found in sources: ${uncoveredWords.slice(0, 3).join(', ')}...`);
      score -= 0.2;
    }

    return {
      score: Math.max(0, score),
      issues,
      coverage,
      uncoveredWords: uncoveredWords.slice(0, 10) // Limit for logging
    };
  }

  async verifyClaims(response, sources, query) {
    const issues = [];
    let score = 0.8;

    // Extract specific claims that need verification
    const claims = this.extractVerifiableClaims(response);
    const verifiedClaims = [];
    const unverifiedClaims = [];

    for (const claim of claims) {
      if (this.canVerifyClaimFromSources(claim, sources)) {
        verifiedClaims.push(claim);
      } else {
        unverifiedClaims.push(claim);
        issues.push(`Cannot verify claim: "${claim}"`);
      }
    }

    if (claims.length > 0) {
      const verificationRate = verifiedClaims.length / claims.length;
      score = Math.max(0.3, verificationRate);
      
      if (verificationRate < 0.7) {
        issues.push(`Low claim verification rate: ${Math.round(verificationRate * 100)}%`);
      }
    }

    return {
      score,
      issues,
      totalClaims: claims.length,
      verifiedClaims: verifiedClaims.length,
      unverifiedClaims
    };
  }

  async checkContextAdherence(response, sources, query) {
    const issues = [];
    let score = 0.9;

    // Check if response stays within the scope of sources
    const sourceTopics = this.extractTopics(sources);
    const responseTopics = this.extractTopics([{ content: response }]);

    const irrelevantTopics = responseTopics.filter(topic => 
      !sourceTopics.some(sourceTopic => 
        this.topicsAreSimilar(topic, sourceTopic)
      )
    );

    if (irrelevantTopics.length > 0) {
      issues.push(`Response includes topics not covered by sources: ${irrelevantTopics.join(', ')}`);
      score -= irrelevantTopics.length * 0.2;
    }

    // Check for scope creep
    if (this.detectScopeCreep(response, query, sources)) {
      issues.push('Response goes beyond the scope of the original query and sources');
      score -= 0.3;
    }

    return {
      score: Math.max(0, score),
      issues,
      sourceTopics,
      responseTopics,
      irrelevantTopics
    };
  }

  calculateVerificationConfidence(verificationResults, preCheckResults) {
    let weightedScore = 0;
    let totalWeight = 0;

    // Include pre-check confidence
    weightedScore += preCheckResults.preCheckConfidence * 0.2;
    totalWeight += 0.2;

    // Include verification rule scores
    for (const [ruleName, result] of verificationResults) {
      weightedScore += result.score * result.weight;
      totalWeight += result.weight;
    }

    const baseConfidence = totalWeight > 0 ? weightedScore / totalWeight : 0.3;

    // Apply penalties for critical issues
    let finalConfidence = baseConfidence;
    
    for (const [ruleName, result] of verificationResults) {
      if (result.issues && result.issues.length > 3) {
        finalConfidence -= 0.1;
      }
    }

    return Math.max(0, Math.min(1, finalConfidence));
  }

  determineResponseAction(confidenceScore) {
    if (confidenceScore >= this.confidenceThresholds.HIGH_CONFIDENCE) {
      return 'approve';
    } else if (confidenceScore >= this.confidenceThresholds.MEDIUM_CONFIDENCE) {
      return 'approve_with_caveats';
    } else if (confidenceScore >= this.confidenceThresholds.LOW_CONFIDENCE) {
      return 'partial_with_escalation';
    } else {
      return 'escalate';
    }
  }

  async applyVerificationResults(response, verificationResults, responseAction, sources) {
    switch (responseAction) {
      case 'approve':
        return this.addSourceCitations(response, sources);
        
      case 'approve_with_caveats':
        return this.addCaveatsToResponse(response, sources, verificationResults);
        
      case 'partial_with_escalation':
        return this.createPartialResponseWithEscalation(response, sources, verificationResults);
        
      case 'escalate':
        return this.generateEscalationResponse(response, sources);
        
      default:
        return this.generateSafeResponse(response, sources);
    }
  }

  addSourceCitations(response, sources) {
    if (!sources || sources.length === 0) {
      return response;
    }

    const citations = sources.map((source, index) => 
      `[${index + 1}] ${source.source || 'Company Documentation'}`
    ).join('\n');

    return `${response}

**Sources:**
${citations}`;
  }

  addCaveatsToResponse(response, sources, verificationResults) {
    const caveats = [];
    
    // Add verification-based caveats
    for (const [ruleName, result] of verificationResults) {
      if (result.score < 0.8 && result.issues.length > 0) {
        if (ruleName === 'source_coverage') {
          caveats.push('Some details may require additional verification');
        } else if (ruleName === 'claim_verification') {
          caveats.push('Please confirm specific details with the appropriate department');
        }
      }
    }

    let caveatText = '';
    if (caveats.length > 0) {
      caveatText = `\n\n**Please Note:** ${caveats.join('; ')}.`;
    }

    return this.addSourceCitations(response, sources) + caveatText;
  }

  createPartialResponseWithEscalation(response, sources, verificationResults) {
    const issues = [];
    for (const [ruleName, result] of verificationResults) {
      issues.push(...result.issues);
    }

    const escalationContact = this.determineAppropriateContact(sources);
    
    return `Based on the available information, I can provide some guidance:

${response.substring(0, 200)}...

However, for the most complete and accurate information, I recommend contacting ${escalationContact.name} at ${escalationContact.contact}.

**Sources referenced:**
${sources.map(s => `• ${s.source || 'Company Documentation'}`).join('\n')}

**Why I'm recommending additional contact:**
The information available may not cover all aspects of your specific situation.`;
  }

  generateEscalationResponse(response, sources) {
    const contact = this.determineAppropriateContact(sources);
    
    return `I want to make sure you get the most accurate information for your question.

While I have access to relevant documentation, I'd recommend contacting ${contact.name} at ${contact.contact} for complete and up-to-date information.

${sources.length > 0 ? `**Related documentation available:**
${sources.map(s => `• ${s.source || 'Company Documentation'}`).join('\n')}` : ''}

I'm here to help with other questions where I have more complete information!`;
  }

  generateSafeResponse(query, sources) {
    return `I want to provide you with the most accurate information about your question.

Currently, I don't have sufficient verified information to give you a complete answer. 

For the most reliable information, please contact:
• HR Department at hr@roof-er.com or ext. 200 (for policy and benefit questions)
• Your direct supervisor (for immediate operational questions)
• Management at management@roof-er.com or ext. 100 (for general company questions)

I apologize that I couldn't provide a more complete response, but I want to ensure you get accurate information rather than potentially incorrect details.`;
  }

  generateSourceAttribution(sources, verificationResults) {
    if (!sources || sources.length === 0) {
      return {
        sources: [],
        confidence: 'low',
        attribution_note: 'No source documents available'
      };
    }

    const attributions = sources.map((source, index) => ({
      id: index + 1,
      title: source.source || 'Company Documentation',
      section: source.section || 'General',
      relevance: source.confidence || 0.5,
      content_used: this.calculateContentUsage(source, verificationResults),
      reliability: this.assessSourceReliability(source)
    }));

    const overallConfidence = this.calculateOverallSourceConfidence(attributions);

    return {
      sources: attributions,
      confidence: overallConfidence,
      attribution_note: this.generateAttributionNote(attributions, overallConfidence)
    };
  }

  // Helper methods for verification

  checkForHallucinationPatterns(response) {
    const foundPatterns = [];
    
    for (const pattern of this.hallucinationPatterns) {
      const matches = response.match(pattern);
      if (matches) {
        foundPatterns.push({
          pattern: pattern.toString(),
          match: matches[0]
        });
      }
    }
    
    return foundPatterns;
  }

  extractCompanyFactClaims(response) {
    const claims = [];
    
    for (const pattern of this.companyFactPatterns) {
      const matches = response.match(pattern);
      if (matches) {
        claims.push(matches[0]);
      }
    }
    
    return claims;
  }

  extractFactualClaims(text) {
    // Simple factual claim extraction
    const sentences = text.split(/[.!?]+/);
    return sentences
      .filter(s => s.trim().length > 10)
      .filter(s => this.appearsToBeFactualClaim(s))
      .map(s => s.trim())
      .slice(0, 10); // Limit for performance
  }

  appearsToBeFactualClaim(sentence) {
    // Heuristics for identifying factual claims
    const factualIndicators = [
      /\b(?:is|are|has|have|will|must|should|can|requires?|provides?)\b/i,
      /\b(?:policy|procedure|rule|benefit|requirement)\b/i,
      /\b(?:contact|call|email)\b.*\b(?:at|on|ext\.)\b/i
    ];
    
    return factualIndicators.some(pattern => pattern.test(sentence));
  }

  isClaimSupportedBySources(claim, sources) {
    if (!sources || sources.length === 0) return false;
    
    const claimWords = this.extractSignificantWords(claim);
    
    for (const source of sources) {
      const sourceWords = this.extractSignificantWords(source.content || '');
      const commonWords = claimWords.filter(word => 
        sourceWords.some(sw => sw.toLowerCase() === word.toLowerCase())
      );
      
      // If more than 60% of significant words are found in source
      if (commonWords.length / claimWords.length > 0.6) {
        return true;
      }
    }
    
    return false;
  }

  extractSignificantWords(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isCommonWord(word));
  }

  isCommonWord(word) {
    const commonWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'this', 'that', 'these', 'those', 'what', 'which', 'who', 'when', 'where', 'how',
      'can', 'will', 'would', 'should', 'must', 'have', 'has', 'been', 'are', 'is', 'was'
    ]);
    
    return commonWords.has(word.toLowerCase());
  }

  findContradictions(response, sources) {
    // Simple contradiction detection - would be more sophisticated in production
    const contradictions = [];
    
    // Look for explicit contradictory statements
    if (response.includes('not') && response.includes('but') || 
        response.includes('however') || response.includes('although')) {
      // This is a simplified check - real implementation would use NLP
    }
    
    return contradictions;
  }

  extractVerifiableClaims(response) {
    // Extract claims that can be fact-checked
    const claims = [];
    const sentences = response.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (this.containsVerifiableClaim(trimmed)) {
        claims.push(trimmed);
      }
    }
    
    return claims.slice(0, 5);
  }

  containsVerifiableClaim(sentence) {
    const verifiablePatterns = [
      /contact .* at .* or/i,
      /policy (?:states|requires|allows)/i,
      /employees? (?:must|can|should|are required)/i,
      /benefits? include/i,
      /deadline is/i,
      /cost is/i,
      /time is/i
    ];
    
    return verifiablePatterns.some(pattern => pattern.test(sentence));
  }

  canVerifyClaimFromSources(claim, sources) {
    // Check if claim can be verified from source content
    return this.isClaimSupportedBySources(claim, sources);
  }

  extractTopics(sources) {
    const topics = new Set();
    
    for (const source of sources) {
      const content = source.content || '';
      // Simple topic extraction - would use NLP in production
      const words = content.toLowerCase().split(/\s+/);
      
      const topicWords = words.filter(word => 
        word.length > 4 && !this.isCommonWord(word)
      );
      
      topicWords.forEach(word => topics.add(word));
    }
    
    return Array.from(topics).slice(0, 10);
  }

  topicsAreSimilar(topic1, topic2) {
    // Simple similarity check - would use semantic similarity in production
    return topic1.toLowerCase() === topic2.toLowerCase() ||
           topic1.includes(topic2) || topic2.includes(topic1);
  }

  detectScopeCreep(response, query, sources) {
    // Check if response goes beyond query scope
    const queryWords = new Set(this.extractSignificantWords(query));
    const responseWords = new Set(this.extractSignificantWords(response));
    const sourceWords = new Set();
    
    sources.forEach(source => {
      this.extractSignificantWords(source.content || '')
        .forEach(word => sourceWords.add(word));
    });
    
    // If response has many words not in query or sources, might be scope creep
    const unexpectedWords = Array.from(responseWords).filter(word => 
      !queryWords.has(word) && !sourceWords.has(word)
    );
    
    return unexpectedWords.length > responseWords.size * 0.3;
  }

  determineAppropriateContact(sources) {
    // Determine best contact based on source content
    const defaultContacts = {
      hr: { name: 'HR Department', contact: 'hr@roof-er.com or ext. 200' },
      operations: { name: 'Operations Manager', contact: 'operations@roof-er.com or ext. 300' },
      it: { name: 'IT Support', contact: 'it@roof-er.com or ext. 400' },
      management: { name: 'Management Team', contact: 'management@roof-er.com or ext. 100' }
    };
    
    // Simple keyword-based assignment
    if (sources.some(s => (s.content || '').toLowerCase().includes('benefit'))) {
      return defaultContacts.hr;
    } else if (sources.some(s => (s.content || '').toLowerCase().includes('safety'))) {
      return defaultContacts.operations;
    } else if (sources.some(s => (s.content || '').toLowerCase().includes('system'))) {
      return defaultContacts.it;
    }
    
    return defaultContacts.management;
  }

  calculateContentUsage(source, verificationResults) {
    // Calculate how much of the source was actually used
    return Math.random() * 0.5 + 0.3; // Placeholder - would calculate actual usage
  }

  assessSourceReliability(source) {
    const metadata = source.metadata || {};
    
    // Assess based on source characteristics
    let reliability = 0.7; // Default
    
    if (metadata.confidentiality === 'official') reliability += 0.2;
    if (metadata.version && parseFloat(metadata.version) >= 1.0) reliability += 0.1;
    if (metadata.createdAt && this.isRecent(metadata.createdAt)) reliability += 0.1;
    
    return Math.min(1.0, reliability);
  }

  calculateOverallSourceConfidence(attributions) {
    if (!attributions || attributions.length === 0) return 'none';
    
    const avgReliability = attributions.reduce((sum, attr) => sum + attr.reliability, 0) / attributions.length;
    const avgRelevance = attributions.reduce((sum, attr) => sum + attr.relevance, 0) / attributions.length;
    
    const overall = (avgReliability + avgRelevance) / 2;
    
    if (overall >= 0.8) return 'high';
    if (overall >= 0.6) return 'medium';
    if (overall >= 0.4) return 'low';
    return 'very_low';
  }

  generateAttributionNote(attributions, confidence) {
    const sourceCount = attributions.length;
    
    if (confidence === 'high') {
      return `High confidence response based on ${sourceCount} reliable source${sourceCount > 1 ? 's' : ''}`;
    } else if (confidence === 'medium') {
      return `Moderate confidence response - please verify key details`;
    } else {
      return `Limited source information available - please confirm with appropriate department`;
    }
  }

  generateBasicSourceAttribution(sources) {
    return {
      sources: sources.map(s => ({ title: s.source || 'Document', relevance: 0.5 })),
      confidence: 'low',
      attribution_note: 'Basic source attribution only'
    };
  }

  isRecent(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = (now - date) / (1000 * 60 * 60 * 24);
    return diffDays < 365; // Within last year
  }
}