import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Advanced Semantic Search Engine for Roof-ER Knowledge Base
 * Provides context-aware, department-specific search capabilities
 */
export class SemanticSearchEngine {
  constructor(knowledgeService) {
    this.knowledgeService = knowledgeService;
    this.searchIndexes = new Map();
    this.contextualFilters = new Map();
    this.departmentMappings = new Map();
    this.roleMappings = new Map();
    
    this.initializeSearchEngine();
  }

  async initializeSearchEngine() {
    // Setup department-specific search contexts
    this.setupDepartmentMappings();
    this.setupRoleMappings();
    this.setupContextualFilters();
  }

  setupDepartmentMappings() {
    const departmentMappings = {
      'sales': {
        keywords: ['customer', 'estimate', 'quote', 'pricing', 'lead', 'contract'],
        priority_docs: ['sales_procedures', 'pricing_guide', 'customer_relations'],
        escalation_contact: 'sales_manager'
      },
      'operations': {
        keywords: ['schedule', 'equipment', 'materials', 'installation', 'job', 'site'],
        priority_docs: ['operations_manual', 'safety_procedures', 'equipment_guide'],
        escalation_contact: 'operations_manager'
      },
      'customer_service': {
        keywords: ['complaint', 'warranty', 'followup', 'satisfaction', 'issue'],
        priority_docs: ['customer_service_guide', 'warranty_policy', 'complaint_handling'],
        escalation_contact: 'customer_service_manager'
      },
      'installation': {
        keywords: ['install', 'repair', 'materials', 'tools', 'safety', 'quality'],
        priority_docs: ['installation_manual', 'safety_guide', 'quality_standards'],
        escalation_contact: 'field_supervisor'
      },
      'quality_assurance': {
        keywords: ['inspect', 'quality', 'standards', 'checklist', 'compliance'],
        priority_docs: ['quality_manual', 'inspection_checklist', 'compliance_guide'],
        escalation_contact: 'qa_manager'
      },
      'hr': {
        keywords: ['benefits', 'policy', 'leave', 'payroll', 'training', 'performance'],
        priority_docs: ['employee_handbook', 'benefits_guide', 'policies'],
        escalation_contact: 'hr_manager'
      },
      'administration': {
        keywords: ['procedure', 'policy', 'form', 'process', 'documentation'],
        priority_docs: ['admin_procedures', 'forms_guide', 'process_manual'],
        escalation_contact: 'admin_manager'
      },
      'finance': {
        keywords: ['invoice', 'payment', 'expense', 'budget', 'accounting'],
        priority_docs: ['finance_procedures', 'expense_policy', 'billing_guide'],
        escalation_contact: 'finance_manager'
      }
    };

    for (const [dept, config] of Object.entries(departmentMappings)) {
      this.departmentMappings.set(dept, config);
    }
  }

  setupRoleMappings() {
    const roleMappings = {
      'field_technician': {
        access_level: 'field',
        relevant_topics: ['installation', 'safety', 'materials', 'tools', 'procedures'],
        restricted_topics: ['pricing', 'contracts', 'financial'],
        priority_docs: ['field_manual', 'safety_guide', 'installation_procedures']
      },
      'office_staff': {
        access_level: 'office',
        relevant_topics: ['procedures', 'policies', 'systems', 'communication'],
        restricted_topics: ['technical_specs', 'field_procedures'],
        priority_docs: ['office_procedures', 'system_guide', 'communication_protocols']
      },
      'manager': {
        access_level: 'management',
        relevant_topics: ['all'],
        restricted_topics: [],
        priority_docs: ['management_guide', 'policies', 'procedures']
      },
      'sales_rep': {
        access_level: 'sales',
        relevant_topics: ['customers', 'pricing', 'products', 'estimates'],
        restricted_topics: ['internal_costs', 'employee_info'],
        priority_docs: ['sales_guide', 'product_catalog', 'pricing_guide']
      },
      'customer_service_rep': {
        access_level: 'customer_service',
        relevant_topics: ['customer_issues', 'warranty', 'policies', 'procedures'],
        restricted_topics: ['internal_operations', 'pricing'],
        priority_docs: ['customer_service_manual', 'warranty_guide', 'issue_resolution']
      }
    };

    for (const [role, config] of Object.entries(roleMappings)) {
      this.roleMappings.set(role, config);
    }
  }

  setupContextualFilters() {
    // Content confidence filters
    this.contextualFilters.set('high_confidence', (results) => 
      results.filter(r => r.confidence >= 0.8)
    );

    this.contextualFilters.set('medium_confidence', (results) => 
      results.filter(r => r.confidence >= 0.6)
    );

    // Department-specific filters
    this.contextualFilters.set('department_relevant', (results, context) => {
      if (!context.department) return results;
      
      const deptConfig = this.departmentMappings.get(context.department.toLowerCase());
      if (!deptConfig) return results;

      return results.map(result => {
        // Boost relevance for department-specific keywords
        let boost = 1.0;
        const content = result.content.toLowerCase();
        
        for (const keyword of deptConfig.keywords) {
          if (content.includes(keyword)) {
            boost += 0.1;
          }
        }

        // Boost for priority documents
        if (deptConfig.priority_docs.some(doc => result.source?.includes(doc))) {
          boost += 0.2;
        }

        return {
          ...result,
          confidence: Math.min(1.0, result.confidence * boost),
          departmentRelevance: boost
        };
      });
    });

    // Role-based access control
    this.contextualFilters.set('role_access', (results, context) => {
      if (!context.role) return results;

      const roleConfig = this.roleMappings.get(context.role.toLowerCase());
      if (!roleConfig) return results;

      return results.filter(result => {
        // Check restricted topics
        const content = result.content.toLowerCase();
        const metadata = result.metadata || {};

        for (const restrictedTopic of roleConfig.restricted_topics) {
          if (content.includes(restrictedTopic) || 
              metadata.category === restrictedTopic) {
            return false;
          }
        }

        return true;
      });
    });
  }

  /**
   * Perform semantic search with contextual filtering
   */
  async performSemanticSearch(queryEmbedding, query, context = {}) {
    const {
      department = null,
      role = null,
      confidentialityLevel = 'internal',
      maxResults = 10,
      threshold = 0.7
    } = context;

    try {
      // Find similar vectors from all documents
      const rawResults = await this.findSimilarVectors(queryEmbedding, {
        threshold,
        maxResults: maxResults * 3 // Get more for filtering
      });

      logger.debug('Raw semantic search results', {
        query: query.substring(0, 50),
        rawResults: rawResults.length,
        threshold
      });

      // Apply contextual filters
      let filteredResults = rawResults;

      // Apply department relevance boost
      if (department) {
        filteredResults = this.contextualFilters.get('department_relevant')(
          filteredResults, 
          { department }
        );
      }

      // Apply role-based access control
      if (role) {
        filteredResults = this.contextualFilters.get('role_access')(
          filteredResults, 
          { role }
        );
      }

      // Apply confidentiality filtering
      filteredResults = this.filterByConfidentiality(filteredResults, confidentialityLevel);

      // Re-rank results based on combined relevance
      const rerankedResults = await this.rerankResults(filteredResults, query, context);

      // Add enriched metadata
      const enrichedResults = await this.enrichResultsWithMetadata(rerankedResults, context);

      const finalResults = enrichedResults.slice(0, maxResults);

      logger.info('Semantic search completed with context', {
        query: query.substring(0, 50),
        department,
        role,
        rawResults: rawResults.length,
        afterFiltering: filteredResults.length,
        finalResults: finalResults.length,
        avgConfidence: this.calculateAverageConfidence(finalResults)
      });

      return {
        results: finalResults,
        metadata: {
          totalFound: rawResults.length,
          afterContextFiltering: filteredResults.length,
          searchContext: { department, role, confidentialityLevel },
          avgConfidence: this.calculateAverageConfidence(finalResults)
        }
      };

    } catch (error) {
      logger.error('Semantic search failed', {
        query: query.substring(0, 50),
        error: error.message
      });
      throw error;
    }
  }

  async findSimilarVectors(queryEmbedding, options = {}) {
    const { threshold = 0.7, maxResults = 50 } = options;
    const results = [];

    // Search through all document embeddings
    for (const [documentId, document] of this.knowledgeService.documentIndex) {
      if (!document.chunks) continue;

      for (const chunk of document.chunks) {
        if (!chunk.embedding) continue;

        const similarity = this.calculateCosineSimilarity(queryEmbedding, chunk.embedding);
        
        if (similarity >= threshold) {
          results.push({
            documentId,
            chunkIndex: chunk.index,
            content: chunk.content,
            similarity,
            confidence: similarity,
            source: document.metadata?.title || documentId,
            section: this.extractSection(chunk.content),
            metadata: {
              ...document.metadata,
              chunkWordCount: chunk.wordCount,
              documentHash: document.hash
            }
          });
        }
      }
    }

    // Sort by similarity (highest first)
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, maxResults);
  }

  calculateCosineSimilarity(vectorA, vectorB) {
    if (!vectorA || !vectorB || vectorA.length !== vectorB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] ** 2;
      normB += vectorB[i] ** 2;
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  filterByConfidentiality(results, confidentialityLevel) {
    const confidentialityLevels = {
      'public': 1,
      'internal': 2,
      'confidential': 3,
      'restricted': 4
    };

    const maxLevel = confidentialityLevels[confidentialityLevel] || 2;

    return results.filter(result => {
      const docLevel = confidentialityLevels[result.metadata?.confidentiality] || 2;
      return docLevel <= maxLevel;
    });
  }

  async rerankResults(results, query, context) {
    const queryLower = query.toLowerCase();
    const queryKeywords = this.extractKeywords(query);

    return results.map(result => {
      let rerankScore = result.confidence;

      // Boost for exact keyword matches
      const content = result.content.toLowerCase();
      for (const keyword of queryKeywords) {
        if (content.includes(keyword)) {
          rerankScore += 0.05;
        }
      }

      // Boost for title/section matches
      if (result.source && result.source.toLowerCase().includes(queryLower)) {
        rerankScore += 0.1;
      }

      // Department-specific boosts
      if (context.department) {
        const deptConfig = this.departmentMappings.get(context.department.toLowerCase());
        if (deptConfig) {
          for (const keyword of deptConfig.keywords) {
            if (content.includes(keyword)) {
              rerankScore += 0.08;
            }
          }
        }
      }

      // Recent document boost
      if (result.metadata?.createdAt) {
        const daysSince = (Date.now() - new Date(result.metadata.createdAt)) / (1000 * 60 * 60 * 24);
        if (daysSince < 30) {
          rerankScore += 0.02;
        }
      }

      return {
        ...result,
        confidence: Math.min(1.0, rerankScore),
        rerankFactors: {
          originalScore: result.confidence,
          keywordBoost: rerankScore - result.confidence
        }
      };
    }).sort((a, b) => b.confidence - a.confidence);
  }

  async enrichResultsWithMetadata(results, context) {
    return results.map(result => {
      // Add context-specific metadata
      const enriched = {
        ...result,
        contextMetadata: {
          relevanceReason: this.generateRelevanceReason(result, context),
          suggestedActions: this.generateSuggestedActions(result, context),
          relatedTopics: this.findRelatedTopics(result)
        }
      };

      // Add department-specific enrichment
      if (context.department) {
        const deptConfig = this.departmentMappings.get(context.department.toLowerCase());
        if (deptConfig) {
          enriched.contextMetadata.departmentRelevance = this.calculateDepartmentRelevance(
            result,
            deptConfig
          );
        }
      }

      return enriched;
    });
  }

  generateRelevanceReason(result, context) {
    const reasons = [];

    if (result.confidence > 0.9) {
      reasons.push('High semantic similarity to your query');
    } else if (result.confidence > 0.8) {
      reasons.push('Good semantic match');
    }

    if (result.departmentRelevance > 1.1) {
      reasons.push(`Specifically relevant to ${context.department} department`);
    }

    if (result.metadata?.category) {
      reasons.push(`Found in ${result.metadata.category} documentation`);
    }

    return reasons.length > 0 ? reasons.join('; ') : 'Relevant content found';
  }

  generateSuggestedActions(result, context) {
    const actions = [];

    // Based on content type
    if (result.content.includes('procedure') || result.content.includes('steps')) {
      actions.push('Follow the outlined procedure');
    }

    if (result.content.includes('contact') || result.content.includes('call')) {
      actions.push('Contact the mentioned person or department');
    }

    if (result.content.includes('form') || result.content.includes('application')) {
      actions.push('Complete the required form');
    }

    // Department-specific actions
    if (context.department === 'hr') {
      actions.push('Check employee portal for additional resources');
    } else if (context.department === 'operations') {
      actions.push('Verify with field supervisor if needed');
    }

    return actions;
  }

  findRelatedTopics(result) {
    // Simple related topic extraction
    const content = result.content.toLowerCase();
    const topics = [];

    // Common business topics
    const topicKeywords = {
      'safety': ['safety', 'hazard', 'protection', 'risk'],
      'procedures': ['procedure', 'process', 'workflow', 'steps'],
      'policies': ['policy', 'rule', 'guideline', 'regulation'],
      'training': ['training', 'education', 'learning', 'certification'],
      'equipment': ['equipment', 'tool', 'machinery', 'device'],
      'customer_service': ['customer', 'client', 'service', 'satisfaction']
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        topics.push(topic);
      }
    }

    return topics;
  }

  calculateDepartmentRelevance(result, deptConfig) {
    const content = result.content.toLowerCase();
    let relevanceScore = 0;

    // Check keyword matches
    for (const keyword of deptConfig.keywords) {
      if (content.includes(keyword)) {
        relevanceScore += 1;
      }
    }

    // Check priority document matches
    if (deptConfig.priority_docs.some(doc => result.source?.includes(doc))) {
      relevanceScore += 2;
    }

    return relevanceScore;
  }

  extractKeywords(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !this.isStopWord(word))
      .slice(0, 10); // Limit to top 10 keywords
  }

  isStopWord(word) {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'between', 'among', 'without', 'this', 'that', 'these',
      'those', 'what', 'which', 'who', 'when', 'where', 'why', 'how'
    ]);
    
    return stopWords.has(word);
  }

  extractSection(content) {
    // Try to identify section from content structure
    const lines = content.split('\n');
    for (const line of lines.slice(0, 3)) {
      if (line.match(/^#+\s+/) || line.match(/^\d+\.\s+/)) {
        return line.replace(/^#+\s+/, '').replace(/^\d+\.\s+/, '').trim();
      }
    }
    return 'Content section';
  }

  calculateAverageConfidence(results) {
    if (!results || results.length === 0) return 0;
    const sum = results.reduce((acc, result) => acc + (result.confidence || 0), 0);
    return Math.round((sum / results.length) * 100) / 100;
  }

  // Fallback keyword search method
  async performKeywordSearch(query, context = {}) {
    const queryLower = query.toLowerCase();
    const queryKeywords = this.extractKeywords(query);
    const results = [];

    for (const [documentId, document] of this.knowledgeService.documentIndex) {
      if (!document.chunks) continue;

      for (const chunk of document.chunks) {
        const content = chunk.content.toLowerCase();
        let score = 0;

        // Exact phrase match
        if (content.includes(queryLower)) {
          score += 0.8;
        }

        // Keyword matches
        for (const keyword of queryKeywords) {
          if (content.includes(keyword)) {
            score += 0.1;
          }
        }

        if (score > 0) {
          results.push({
            documentId,
            chunkIndex: chunk.index,
            content: chunk.content,
            similarity: score,
            confidence: score,
            source: document.metadata?.title || documentId,
            section: this.extractSection(chunk.content),
            metadata: document.metadata,
            searchMethod: 'keyword'
          });
        }
      }
    }

    results.sort((a, b) => b.confidence - a.confidence);
    return results.slice(0, context.maxResults || 10);
  }
}