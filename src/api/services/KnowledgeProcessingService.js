import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import EventEmitter from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Advanced Knowledge Processing System for Susan AI
 * Provides comprehensive Roof-ER employee assistance with:
 * - Document processing and knowledge extraction
 * - Vector-based semantic search
 * - Anti-hallucination mechanisms
 * - Context-aware responses
 * - Management escalation protocols
 */
export class KnowledgeProcessingService extends EventEmitter {
  constructor() {
    super();
    
    // Initialize AI clients
    this.initializeClients();
    
    // Setup directories
    this.knowledgeDir = path.join(__dirname, '../../../data/knowledge');
    this.documentsDir = path.join(this.knowledgeDir, 'documents');
    this.vectorsDir = path.join(this.knowledgeDir, 'vectors');
    this.indexesDir = path.join(this.knowledgeDir, 'indexes');
    this.templatesDir = path.join(this.knowledgeDir, 'templates');
    this.policiesDir = path.join(this.knowledgeDir, 'policies');
    this.contextsDir = path.join(this.knowledgeDir, 'contexts');
    
    // Knowledge base components
    this.documentIndex = new Map();
    this.vectorIndex = new Map();
    this.topicClusters = new Map();
    this.employeeContexts = new Map();
    this.companyTerminology = new Map();
    this.escalationRules = new Map();
    this.responseTemplates = new Map();
    
    // Configuration
    this.config = {
      maxDocumentSize: 50 * 1024 * 1024, // 50MB
      chunkSize: 1000, // tokens per chunk
      chunkOverlap: 200, // overlap between chunks
      similarityThreshold: 0.75, // minimum similarity for relevant results
      maxSearchResults: 10,
      confidenceThreshold: 0.8, // minimum confidence to provide answer
      escalationThreshold: 0.6, // threshold below which to escalate
    };
    
    this.ensureDirectories();
    this.loadExistingKnowledge();
    this.setupCompanyContext();
  }

  async initializeClients() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }

    if (!this.openai && !this.anthropic) {
      logger.warn('No AI providers configured for knowledge processing');
    }
  }

  async ensureDirectories() {
    const directories = [
      this.knowledgeDir,
      this.documentsDir,
      this.vectorsDir,
      this.indexesDir,
      this.templatesDir,
      this.policiesDir,
      this.contextsDir
    ];

    for (const dir of directories) {
      await fs.ensureDir(dir);
    }
  }

  /**
   * Process and ingest documents into the knowledge base
   */
  async ingestDocument(documentData, options = {}) {
    const {
      source = 'upload',
      category = 'general',
      department = null,
      confidentiality = 'internal',
      version = '1.0',
      tags = [],
      author = 'system'
    } = options;

    const documentId = this.generateDocumentId();
    
    try {
      logger.info('Starting document ingestion', {
        documentId,
        source,
        category,
        size: documentData.length
      });

      // Validate document
      await this.validateDocument(documentData);

      // Extract metadata
      const metadata = await this.extractDocumentMetadata(documentData, {
        category,
        department,
        confidentiality,
        version,
        tags,
        author
      });

      // Parse and clean content
      const cleanedContent = await this.parseAndCleanDocument(documentData);

      // Split into chunks for processing
      const chunks = await this.splitDocumentIntoChunks(cleanedContent);

      // Generate embeddings for each chunk
      const embeddedChunks = await this.generateChunkEmbeddings(chunks);

      // Extract key concepts and terminology
      const concepts = await this.extractKeyConcepts(cleanedContent);
      const terminology = await this.extractTerminology(cleanedContent);

      // Create document record
      const document = {
        id: documentId,
        source,
        metadata,
        content: cleanedContent,
        chunks: embeddedChunks,
        concepts,
        terminology,
        processedAt: new Date(),
        version,
        hash: this.calculateContentHash(cleanedContent)
      };

      // Store document
      await this.storeDocument(document);

      // Update indexes
      await this.updateSearchIndexes(document);
      await this.updateTopicClusters(document);
      await this.updateCompanyTerminology(terminology);

      logger.info('Document ingestion completed', {
        documentId,
        chunksCreated: chunks.length,
        conceptsExtracted: concepts.length,
        terminologyExtracted: terminology.length
      });

      this.emit('document:ingested', { documentId, document });

      return {
        documentId,
        status: 'success',
        chunksProcessed: chunks.length,
        conceptsExtracted: concepts.length,
        terminologyExtracted: terminology.length
      };

    } catch (error) {
      logger.error('Document ingestion failed', {
        documentId,
        error: error.message
      });

      this.emit('document:ingestion_failed', { documentId, error: error.message });
      throw new ApiError.badRequest(`Document ingestion failed: ${error.message}`);
    }
  }

  /**
   * Perform semantic search with Roof-ER context awareness
   */
  async semanticSearch(query, context = {}) {
    const {
      employeeId = null,
      department = null,
      role = null,
      confidentialityLevel = 'internal',
      includeExamples = true,
      maxResults = this.config.maxSearchResults
    } = context;

    try {
      logger.info('Performing semantic search', {
        query: query.substring(0, 100),
        employeeId,
        department,
        role
      });

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) {
        return await this.fallbackKeywordSearch(query, context);
      }

      // Find relevant documents and chunks
      const searchResults = await this.findSimilarContent(queryEmbedding, {
        confidentialityLevel,
        department,
        role,
        maxResults: maxResults * 2 // Get more for filtering
      });

      // Apply context-aware filtering
      const contextFilteredResults = await this.applyContextualFiltering(
        searchResults,
        { employeeId, department, role, query }
      );

      // Rank and score results
      const rankedResults = await this.rankSearchResults(
        contextFilteredResults,
        query,
        context
      );

      // Add source attribution and confidence scores
      const attributedResults = await this.addSourceAttribution(rankedResults);

      // Generate examples if requested
      let examples = [];
      if (includeExamples && attributedResults.length > 0) {
        examples = await this.generateResponseExamples(query, attributedResults);
      }

      const finalResults = attributedResults.slice(0, maxResults);

      logger.info('Semantic search completed', {
        query: query.substring(0, 100),
        resultsFound: searchResults.length,
        afterFiltering: contextFilteredResults.length,
        finalResults: finalResults.length,
        avgConfidence: this.calculateAverageConfidence(finalResults)
      });

      return {
        query,
        results: finalResults,
        examples,
        metadata: {
          totalFound: searchResults.length,
          afterContextFiltering: contextFilteredResults.length,
          avgConfidence: this.calculateAverageConfidence(finalResults),
          searchMethod: 'semantic',
          context: { employeeId, department, role }
        }
      };

    } catch (error) {
      logger.error('Semantic search failed', {
        query: query.substring(0, 100),
        error: error.message
      });

      // Fallback to keyword search
      return await this.fallbackKeywordSearch(query, context);
    }
  }

  /**
   * Generate comprehensive response with anti-hallucination measures
   */
  async generateKnowledgeResponse(query, searchResults, context = {}) {
    const {
      employeeId = null,
      department = null,
      role = null,
      responseStyle = 'helpful',
      includeExamples = true,
      includeNextSteps = true
    } = context;

    try {
      // Calculate confidence score
      const confidence = this.calculateResponseConfidence(searchResults);

      // Check if we should escalate to management
      if (confidence < this.config.escalationThreshold) {
        return await this.generateEscalationResponse(query, searchResults, context);
      }

      // Select the most relevant sources
      const relevantSources = searchResults.slice(0, 3);

      // Build context-aware system prompt
      const systemPrompt = await this.buildKnowledgeSystemPrompt({
        employeeId,
        department,
        role,
        responseStyle,
        sources: relevantSources
      });

      // Generate response using AI
      const aiResponse = await this.generateAIResponse(query, {
        systemPrompt,
        context: this.formatSourcesForAI(relevantSources),
        temperature: 0.3, // Lower for factual accuracy
        maxTokens: 1000
      });

      // Apply anti-hallucination checks
      const verifiedResponse = await this.verifyResponseAccuracy(
        aiResponse,
        relevantSources,
        query
      );

      // Add source citations
      const citedResponse = this.addSourceCitations(verifiedResponse, relevantSources);

      // Generate examples if requested
      let examples = [];
      if (includeExamples) {
        examples = await this.generateActionableExamples(query, relevantSources);
      }

      // Generate next steps if requested
      let nextSteps = [];
      if (includeNextSteps) {
        nextSteps = await this.generateNextSteps(query, relevantSources, context);
      }

      const response = {
        content: citedResponse,
        confidence,
        sources: relevantSources.map(source => ({
          id: source.documentId,
          title: source.title,
          section: source.section,
          relevance: source.confidence
        })),
        examples,
        nextSteps,
        metadata: {
          responseType: 'knowledge-based',
          confidenceScore: confidence,
          sourcesUsed: relevantSources.length,
          aiModel: 'enhanced',
          verificationPassed: true
        }
      };

      logger.info('Knowledge response generated', {
        query: query.substring(0, 100),
        confidence,
        sourcesUsed: relevantSources.length,
        examplesCount: examples.length,
        nextStepsCount: nextSteps.length
      });

      return response;

    } catch (error) {
      logger.error('Knowledge response generation failed', {
        query: query.substring(0, 100),
        error: error.message
      });

      // Return safe fallback response
      return await this.generateFallbackResponse(query, context);
    }
  }

  /**
   * Generate escalation response when confidence is low
   */
  async generateEscalationResponse(query, searchResults, context = {}) {
    const { department = null, role = null } = context;

    // Determine appropriate escalation contact
    const escalationContact = await this.determineEscalationContact(
      query,
      department,
      role
    );

    // Get partial information if available
    let partialInfo = '';
    if (searchResults.length > 0) {
      const topResult = searchResults[0];
      partialInfo = `I found some related information in ${topResult.source}, but I want to make sure you get the most accurate and complete answer. `;
    }

    const escalationResponse = {
      content: `${partialInfo}For the most accurate information about "${query.substring(0, 50)}...", I recommend contacting ${escalationContact.name} ${escalationContact.contact ? `at ${escalationContact.contact}` : ''}. They'll be able to provide you with the specific details you need.

In the meantime, you might also find helpful information in our employee portal or by checking with your direct supervisor.`,
      
      confidence: 0.5,
      escalation: {
        recommended: true,
        contact: escalationContact,
        reason: 'Insufficient confidence in available knowledge base'
      },
      sources: searchResults.slice(0, 2),
      metadata: {
        responseType: 'escalation',
        confidenceScore: 0.5,
        escalationReason: 'low_confidence'
      }
    };

    logger.info('Escalation response generated', {
      query: query.substring(0, 100),
      escalationContact: escalationContact.name,
      partialResultsAvailable: searchResults.length > 0
    });

    return escalationResponse;
  }

  /**
   * Setup company-specific context and terminology
   */
  async setupCompanyContext() {
    // Load Roof-ER specific context
    const roofErContext = {
      companyName: 'Roof-ER',
      industry: 'Roofing and Construction',
      departments: [
        'Sales',
        'Operations',
        'Customer Service',
        'Installation',
        'Quality Assurance',
        'Administration',
        'Human Resources',
        'Finance'
      ],
      commonTerms: {
        'TPO': 'Thermoplastic Olefin - a type of roofing membrane',
        'EPDM': 'Ethylene Propylene Diene Monomer - a synthetic rubber roofing membrane',
        'Modified Bitumen': 'A type of asphalt-based roofing material',
        'Roof-ER': 'Our company name - always capitalize both parts',
        'Field Tech': 'Field Technician - installation team member',
        'QA': 'Quality Assurance',
        'WO': 'Work Order',
        'Estimate': 'Cost assessment provided to customer',
        'Survey': 'Initial roof assessment'
      },
      escalationContacts: {
        'hr': {
          name: 'HR Department',
          contact: 'hr@roof-er.com',
          phone: 'ext. 200',
          topics: ['benefits', 'policies', 'payroll', 'leave', 'training']
        },
        'operations': {
          name: 'Operations Manager',
          contact: 'operations@roof-er.com', 
          phone: 'ext. 300',
          topics: ['schedules', 'equipment', 'safety', 'procedures']
        },
        'it': {
          name: 'IT Support',
          contact: 'it@roof-er.com',
          phone: 'ext. 400',
          topics: ['systems', 'software', 'passwords', 'equipment']
        },
        'management': {
          name: 'Management Team',
          contact: 'management@roof-er.com',
          phone: 'ext. 100',
          topics: ['policies', 'decisions', 'complaints', 'suggestions']
        }
      }
    };

    // Store company context
    this.companyContext = roofErContext;
    
    // Load terminology into memory
    for (const [term, definition] of Object.entries(roofErContext.commonTerms)) {
      this.companyTerminology.set(term.toLowerCase(), {
        term,
        definition,
        category: 'company_standard',
        source: 'company_context'
      });
    }

    // Store escalation rules
    for (const [key, contact] of Object.entries(roofErContext.escalationContacts)) {
      this.escalationRules.set(key, contact);
    }

    logger.info('Company context setup completed', {
      departments: roofErContext.departments.length,
      terminology: Object.keys(roofErContext.commonTerms).length,
      escalationContacts: Object.keys(roofErContext.escalationContacts).length
    });
  }

  /**
   * Load response templates for consistent formatting
   */
  async loadResponseTemplates() {
    const templates = {
      policy_explanation: {
        template: `Based on our company policy documentation:

{content}

**Key Points:**
{keyPoints}

**Examples:**
{examples}

**Next Steps:**
{nextSteps}

*Source: {source}*`,
        requiredFields: ['content', 'source'],
        optionalFields: ['keyPoints', 'examples', 'nextSteps']
      },

      procedure_steps: {
        template: `Here's the step-by-step procedure for {topic}:

{steps}

**Important Notes:**
{notes}

**Who to Contact:**
If you need help with any of these steps, contact {contact}.

*Source: {source}*`,
        requiredFields: ['topic', 'steps', 'source'],
        optionalFields: ['notes', 'contact']
      },

      benefit_information: {
        template: `**{benefitName}**

{description}

**Eligibility:**
{eligibility}

**How to Apply/Use:**
{instructions}

**Examples:**
{examples}

**Questions?** Contact HR at hr@roof-er.com or ext. 200

*Source: {source}*`,
        requiredFields: ['benefitName', 'description', 'source'],
        optionalFields: ['eligibility', 'instructions', 'examples']
      },

      escalation_needed: {
        template: `I want to make sure you get the most accurate information about {topic}. 

{partialInfo}

**Recommended Contact:**
{contactName} - {contactInfo}

**Why I'm recommending this contact:**
{reason}

**In the meantime:**
{interimSteps}`,
        requiredFields: ['topic', 'contactName', 'contactInfo', 'reason'],
        optionalFields: ['partialInfo', 'interimSteps']
      }
    };

    // Store templates
    for (const [templateId, template] of Object.entries(templates)) {
      this.responseTemplates.set(templateId, template);
    }

    logger.info('Response templates loaded', {
      templateCount: Object.keys(templates).length
    });
  }

  // Helper methods for document processing

  async validateDocument(documentData) {
    if (!documentData || typeof documentData !== 'string') {
      throw new Error('Invalid document data');
    }

    if (documentData.length > this.config.maxDocumentSize) {
      throw new Error('Document exceeds maximum size limit');
    }

    // Check for basic content validity
    if (documentData.trim().length < 10) {
      throw new Error('Document content too short');
    }

    return true;
  }

  async extractDocumentMetadata(documentData, options) {
    return {
      ...options,
      contentLength: documentData.length,
      wordCount: documentData.split(/\s+/).length,
      createdAt: new Date(),
      language: await this.detectLanguage(documentData)
    };
  }

  async parseAndCleanDocument(documentData) {
    // Basic text cleaning
    return documentData
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async splitDocumentIntoChunks(content) {
    const chunks = [];
    const sentences = content.split(/[.!?]+/);
    let currentChunk = '';
    let wordCount = 0;

    for (const sentence of sentences) {
      const sentenceWords = sentence.trim().split(/\s+/).length;
      
      if (wordCount + sentenceWords > this.config.chunkSize && currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          wordCount,
          index: chunks.length
        });
        
        // Add overlap
        const overlapWords = currentChunk.split(/\s+/).slice(-this.config.chunkOverlap);
        currentChunk = overlapWords.join(' ') + ' ' + sentence.trim();
        wordCount = overlapWords.length + sentenceWords;
      } else {
        currentChunk += sentence.trim() + '. ';
        wordCount += sentenceWords;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        wordCount,
        index: chunks.length
      });
    }

    return chunks;
  }

  async generateChunkEmbeddings(chunks) {
    const embeddedChunks = [];
    
    for (const chunk of chunks) {
      try {
        const embedding = await this.generateEmbedding(chunk.content);
        embeddedChunks.push({
          ...chunk,
          embedding,
          embeddingDimensions: embedding ? embedding.length : 0
        });
      } catch (error) {
        logger.warn('Failed to generate embedding for chunk', {
          chunkIndex: chunk.index,
          error: error.message
        });
        embeddedChunks.push({
          ...chunk,
          embedding: null,
          embeddingDimensions: 0
        });
      }
    }

    return embeddedChunks;
  }

  async generateEmbedding(text) {
    if (!this.openai) {
      logger.warn('OpenAI client not available for embeddings');
      return null;
    }

    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text.substring(0, 8000), // Limit input length
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Embedding generation failed', {
        textLength: text.length,
        error: error.message
      });
      return null;
    }
  }

  calculateContentHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  generateDocumentId() {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async detectLanguage(text) {
    // Simple language detection - in production use proper library
    const englishWords = /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/gi;
    const matches = text.match(englishWords);
    return matches && matches.length > 10 ? 'en' : 'unknown';
  }

  calculateAverageConfidence(results) {
    if (!results || results.length === 0) return 0;
    const sum = results.reduce((acc, result) => acc + (result.confidence || 0), 0);
    return sum / results.length;
  }

  async extractKeyConcepts(content) {
    try {
      // Simple concept extraction - would use NLP in production
      const concepts = [];
      const words = content.toLowerCase().split(/\s+/);
      
      // Company-specific concepts
      const companyTerms = Array.from(this.companyTerminology.keys());
      for (const term of companyTerms) {
        if (words.some(word => word.includes(term))) {
          concepts.push({
            concept: term,
            definition: this.companyTerminology.get(term).definition,
            confidence: 0.8
          });
        }
      }
      
      return concepts.slice(0, 10); // Limit concepts
    } catch (error) {
      logger.warn('Concept extraction failed', { error: error.message });
      return [];
    }
  }

  async extractTerminology(content) {
    try {
      const terminology = [];
      
      // Extract technical terms, abbreviations, and company-specific language
      const words = content.split(/\s+/);
      
      for (const word of words) {
        const cleaned = word.replace(/[^\w]/g, '');
        
        // Abbreviations (all caps, 2-6 letters)
        if (cleaned.match(/^[A-Z]{2,6}$/) && !this.isCommonWord(cleaned.toLowerCase())) {
          terminology.push({
            term: cleaned,
            type: 'abbreviation',
            context: this.getWordContext(content, word)
          });
        }
        
        // Technical terms (capitalized words that aren't common)
        if (cleaned.match(/^[A-Z][a-z]+$/) && cleaned.length > 4 && !this.isCommonWord(cleaned.toLowerCase())) {
          terminology.push({
            term: cleaned,
            type: 'technical_term',
            context: this.getWordContext(content, word)
          });
        }
      }
      
      return terminology.slice(0, 20); // Limit terminology
    } catch (error) {
      logger.warn('Terminology extraction failed', { error: error.message });
      return [];
    }
  }

  async storeDocument(document) {
    try {
      // Store in memory index
      this.documentIndex.set(document.id, document);
      
      // Store document metadata
      const docPath = path.join(this.documentsDir, `${document.id}.json`);
      await fs.writeJson(docPath, {
        ...document,
        chunks: document.chunks.map(chunk => ({ ...chunk, embedding: null })) // Don't store embeddings in JSON
      }, { spaces: 2 });
      
      logger.debug('Document stored', { documentId: document.id });
    } catch (error) {
      logger.error('Document storage failed', { documentId: document.id, error: error.message });
      throw error;
    }
  }

  async updateSearchIndexes(document) {
    try {
      // Update vector indexes with embeddings
      for (const chunk of document.chunks) {
        if (chunk.embedding) {
          const indexKey = `${document.id}_${chunk.index}`;
          this.vectorIndex.set(indexKey, {
            documentId: document.id,
            chunkIndex: chunk.index,
            embedding: chunk.embedding,
            content: chunk.content,
            metadata: document.metadata
          });
        }
      }
      
      logger.debug('Search indexes updated', { documentId: document.id });
    } catch (error) {
      logger.error('Search index update failed', { documentId: document.id, error: error.message });
    }
  }

  async updateTopicClusters(document) {
    try {
      // Simple topic clustering based on concepts
      const concepts = document.concepts || [];
      
      for (const concept of concepts) {
        if (!this.topicClusters.has(concept.concept)) {
          this.topicClusters.set(concept.concept, {
            topic: concept.concept,
            documents: [],
            totalReferences: 0
          });
        }
        
        const cluster = this.topicClusters.get(concept.concept);
        cluster.documents.push(document.id);
        cluster.totalReferences++;
      }
      
      logger.debug('Topic clusters updated', { documentId: document.id });
    } catch (error) {
      logger.error('Topic cluster update failed', { documentId: document.id, error: error.message });
    }
  }

  async updateCompanyTerminology(terminology) {
    try {
      for (const term of terminology) {
        if (!this.companyTerminology.has(term.term.toLowerCase())) {
          this.companyTerminology.set(term.term.toLowerCase(), {
            term: term.term,
            type: term.type,
            definition: term.context || `${term.type} used in company documentation`,
            category: 'auto_extracted',
            source: 'document_processing'
          });
        }
      }
      
      logger.debug('Company terminology updated', { termsAdded: terminology.length });
    } catch (error) {
      logger.error('Terminology update failed', { error: error.message });
    }
  }

  async findSimilarContent(embedding, options) {
    try {
      const { confidentialityLevel, department, role, maxResults = 10 } = options;
      const results = [];
      
      for (const [indexKey, vectorData] of this.vectorIndex) {
        if (!vectorData.embedding) continue;
        
        const similarity = this.cosineSimilarity(embedding, vectorData.embedding);
        
        if (similarity >= 0.5) { // Basic threshold
          results.push({
            documentId: vectorData.documentId,
            chunkIndex: vectorData.chunkIndex,
            content: vectorData.content,
            similarity,
            confidence: similarity,
            source: vectorData.metadata?.title || vectorData.documentId,
            section: this.extractSection(vectorData.content),
            metadata: vectorData.metadata
          });
        }
      }
      
      // Sort by similarity and return top results
      results.sort((a, b) => b.similarity - a.similarity);
      return results.slice(0, maxResults);
    } catch (error) {
      logger.error('Similar content search failed', { error: error.message });
      return [];
    }
  }

  cosineSimilarity(vectorA, vectorB) {
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

  getWordContext(text, word) {
    const index = text.indexOf(word);
    if (index === -1) return '';
    
    const start = Math.max(0, index - 30);
    const end = Math.min(text.length, index + word.length + 30);
    return text.substring(start, end).trim();
  }

  isCommonWord(word) {
    const commonWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'between', 'among', 'without', 'this', 'that', 'these',
      'those', 'what', 'which', 'who', 'when', 'where', 'why', 'how'
    ]);
    
    return commonWords.has(word.toLowerCase());
  }

  async loadExistingKnowledge() {
    try {
      // Load existing documents from disk
      if (await fs.pathExists(this.documentsDir)) {
        const files = await fs.readdir(this.documentsDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const docPath = path.join(this.documentsDir, file);
              const document = await fs.readJson(docPath);
              
              this.documentIndex.set(document.id, document);
              
              // Rebuild indexes without embeddings (would regenerate if needed)
              await this.updateTopicClusters(document);
              if (document.terminology) {
                await this.updateCompanyTerminology(document.terminology);
              }
            } catch (error) {
              logger.warn(`Failed to load document ${file}`, { error: error.message });
            }
          }
        }
      }
      
      logger.info('Existing knowledge loaded', {
        documentsLoaded: this.documentIndex.size,
        topicClusters: this.topicClusters.size,
        terminology: this.companyTerminology.size
      });
    } catch (error) {
      logger.error('Failed to load existing knowledge', { error: error.message });
    }
  }
}