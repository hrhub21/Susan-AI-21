import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import EventEmitter from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class VectorMemoryService extends EventEmitter {
  constructor() {
    super();
    this.initializeClients();
    this.dataDir = path.join(__dirname, '../../../data/vector_memory');
    this.embeddingsDir = path.join(this.dataDir, 'embeddings');
    this.indexDir = path.join(this.dataDir, 'indexes');
    this.metadataDir = path.join(this.dataDir, 'metadata');
    this.intelligenceDir = path.join(this.dataDir, 'intelligence');
    this.patternDir = path.join(this.dataDir, 'patterns');
    
    this.vectorDimensions = 1536; // OpenAI embedding dimension
    this.memoryEntries = new Map();
    this.vectorIndexes = new Map();
    this.semanticClusters = new Map();
    this.knowledgeGraph = new Map();
    
    this.ensureDirectories();
    this.loadExistingMemory();
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
  }

  async ensureDirectories() {
    await fs.ensureDir(this.dataDir);
    await fs.ensureDir(this.embeddingsDir);
    await fs.ensureDir(this.indexDir);
    await fs.ensureDir(this.metadataDir);
    await fs.ensureDir(this.intelligenceDir);
    await fs.ensureDir(this.patternDir);
  }

  /**
   * Store conversation interaction with vector embeddings
   */
  async storeInteraction(conversationId, interaction, options = {}) {
    const {
      userId,
      importance = 0.5,
      tags = [],
      context = {},
      generateEmbedding = true,
      updateKnowledgeGraph = true
    } = options;

    const entryId = this.generateEntryId();
    const timestamp = new Date();

    try {
      // Prepare content for embedding
      const content = this.prepareContentForEmbedding(interaction);
      
      let embedding = null;
      if (generateEmbedding) {
        embedding = await this.generateEmbedding(content);
      }

      // Create memory entry
      const memoryEntry = {
        id: entryId,
        conversationId,
        userId,
        content,
        originalInteraction: interaction,
        embedding,
        metadata: {
          timestamp,
          importance,
          tags,
          context,
          model: interaction.assistantMessage?.metadata?.model,
          tokensUsed: interaction.assistantMessage?.metadata?.tokensUsed,
          cost: interaction.assistantMessage?.metadata?.cost,
          language: this.detectLanguage(content),
          sentiment: await this.analyzeSentiment(content),
          topics: await this.extractTopics(content),
          entities: await this.extractEntities(content)
        },
        accessCount: 0,
        lastAccessed: timestamp,
        clusterId: null,
        relations: []
      };

      // Store in memory
      this.memoryEntries.set(entryId, memoryEntry);

      // Update vector index
      if (embedding) {
        await this.updateVectorIndex(entryId, embedding, memoryEntry.metadata);
      }

      // Perform semantic clustering
      await this.updateSemanticClusters(entryId, memoryEntry);

      // Update knowledge graph
      if (updateKnowledgeGraph) {
        await this.updateKnowledgeGraph(entryId, memoryEntry);
      }

      // Persist to disk
      await this.persistMemoryEntry(memoryEntry);

      logger.info('Interaction stored in vector memory', {
        entryId,
        conversationId,
        userId,
        contentLength: content.length,
        hasEmbedding: !!embedding,
        topics: memoryEntry.metadata.topics?.length || 0
      });

      this.emit('memory:stored', { entryId, memoryEntry, userId });

      return entryId;

    } catch (error) {
      logger.error('Failed to store interaction in vector memory', {
        entryId,
        conversationId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Semantic search using vector similarity
   */
  async semanticSearch(query, options = {}) {
    const {
      limit = 10,
      threshold = 0.7,
      userId = null,
      conversationId = null,
      tags = [],
      timeRange = null,
      includeMetadata = true,
      rerank = true
    } = options;

    try {
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);
      
      if (!queryEmbedding) {
        // Fall back to keyword search
        return await this.keywordSearch(query, options);
      }

      // Find similar vectors
      const candidates = await this.findSimilarVectors(queryEmbedding, {
        limit: limit * 2, // Get more candidates for filtering
        threshold
      });

      // Apply filters
      let filteredResults = candidates.filter(candidate => {
        const entry = this.memoryEntries.get(candidate.id);
        if (!entry) return false;

        // User filter
        if (userId && entry.userId !== userId) return false;

        // Conversation filter
        if (conversationId && entry.conversationId !== conversationId) return false;

        // Tags filter
        if (tags.length > 0 && !tags.some(tag => entry.metadata.tags.includes(tag))) {
          return false;
        }

        // Time range filter
        if (timeRange) {
          const entryTime = new Date(entry.metadata.timestamp);
          if (timeRange.start && entryTime < new Date(timeRange.start)) return false;
          if (timeRange.end && entryTime > new Date(timeRange.end)) return false;
        }

        return true;
      });

      // Re-rank results if requested
      if (rerank) {
        filteredResults = await this.rerankResults(query, filteredResults);
      }

      // Update access statistics
      filteredResults.slice(0, limit).forEach(result => {
        const entry = this.memoryEntries.get(result.id);
        if (entry) {
          entry.accessCount++;
          entry.lastAccessed = new Date();
        }
      });

      // Format results
      const formattedResults = filteredResults.slice(0, limit).map(result => {
        const entry = this.memoryEntries.get(result.id);
        
        const formattedResult = {
          id: result.id,
          content: entry.content,
          similarity: result.similarity,
          conversationId: entry.conversationId,
          timestamp: entry.metadata.timestamp,
          importance: entry.metadata.importance
        };

        if (includeMetadata) {
          formattedResult.metadata = entry.metadata;
          formattedResult.accessCount = entry.accessCount;
          formattedResult.clusterId = entry.clusterId;
        }

        return formattedResult;
      });

      logger.info('Semantic search completed', {
        query: query.substring(0, 100),
        candidatesFound: candidates.length,
        filteredResults: filteredResults.length,
        returnedResults: formattedResults.length,
        threshold
      });

      return {
        results: formattedResults,
        totalCandidates: candidates.length,
        searchMetadata: {
          queryEmbedding: queryEmbedding ? queryEmbedding.slice(0, 5) : null, // First 5 dimensions for debugging
          threshold,
          reranked: rerank,
          filters: { userId, conversationId, tags, timeRange }
        }
      };

    } catch (error) {
      logger.error('Semantic search failed', {
        query: query.substring(0, 100),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get contextually relevant memories for a conversation
   */
  async getContextualMemories(conversationId, currentMessage, options = {}) {
    const {
      maxMemories = 5,
      importanceThreshold = 0.3,
      diversityFactor = 0.7,
      includeRelated = true
    } = options;

    try {
      // Get recent conversation context
      const recentContext = await this.getConversationMemories(conversationId, { limit: 10 });

      // Perform semantic search for related content
      const semanticResults = await this.semanticSearch(currentMessage, {
        limit: maxMemories * 2,
        conversationId: null, // Exclude current conversation
        threshold: 0.6
      });

      // Get related memories through knowledge graph
      let relatedMemories = [];
      if (includeRelated && recentContext.length > 0) {
        relatedMemories = await this.getRelatedMemories(recentContext[0].id, {
          maxDepth: 2,
          limit: 5
        });
      }

      // Combine and score memories
      const allCandidates = [
        ...semanticResults.results.map(r => ({ ...r, source: 'semantic' })),
        ...relatedMemories.map(r => ({ ...r, source: 'related' }))
      ];

      // Remove duplicates
      const uniqueCandidates = this.deduplicateMemories(allCandidates);

      // Apply importance filtering
      const importantMemories = uniqueCandidates.filter(memory => 
        memory.importance >= importanceThreshold
      );

      // Apply diversity selection
      const diverseMemories = this.selectDiverseMemories(importantMemories, {
        maxSelection: maxMemories,
        diversityFactor
      });

      // Sort by relevance and importance
      diverseMemories.sort((a, b) => {
        const scoreA = (a.similarity || 0.5) * 0.6 + a.importance * 0.4;
        const scoreB = (b.similarity || 0.5) * 0.6 + b.importance * 0.4;
        return scoreB - scoreA;
      });

      logger.info('Contextual memories retrieved', {
        conversationId,
        currentMessageLength: currentMessage.length,
        candidatesFound: allCandidates.length,
        uniqueCandidates: uniqueCandidates.length,
        importantMemories: importantMemories.length,
        finalMemories: diverseMemories.length
      });

      return {
        memories: diverseMemories.slice(0, maxMemories),
        context: recentContext.slice(0, 3), // Include recent context
        metadata: {
          totalCandidates: allCandidates.length,
          importanceThreshold,
          diversityFactor
        }
      };

    } catch (error) {
      logger.error('Failed to get contextual memories', {
        conversationId,
        error: error.message
      });
      return { memories: [], context: [], metadata: {} };
    }
  }

  /**
   * Generate embeddings for text content
   */
  async generateEmbedding(text) {
    if (!this.openai) {
      logger.warn('OpenAI client not available for embeddings');
      return null;
    }

    try {
      // Clean and prepare text
      const cleanedText = this.cleanTextForEmbedding(text);
      
      if (cleanedText.length === 0) {
        return null;
      }

      const response = await this.openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: cleanedText,
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

  /**
   * Find similar vectors using cosine similarity
   */
  async findSimilarVectors(queryEmbedding, options = {}) {
    const { limit = 10, threshold = 0.7 } = options;

    const similarities = [];

    for (const [entryId, entry] of this.memoryEntries) {
      if (!entry.embedding) continue;

      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
      
      if (similarity >= threshold) {
        similarities.push({
          id: entryId,
          similarity
        });
      }
    }

    // Sort by similarity (highest first)
    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, limit);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vectorA, vectorB) {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vector dimensions must match');
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
    
    if (magnitude === 0) return 0;
    
    return dotProduct / magnitude;
  }

  /**
   * Update semantic clusters for better organization
   */
  async updateSemanticClusters(entryId, memoryEntry) {
    if (!memoryEntry.embedding) return;

    try {
      // Find best matching cluster
      let bestCluster = null;
      let bestSimilarity = 0;

      for (const [clusterId, cluster] of this.semanticClusters) {
        const similarity = this.cosineSimilarity(memoryEntry.embedding, cluster.centroid);
        
        if (similarity > bestSimilarity && similarity > 0.8) {
          bestSimilarity = similarity;
          bestCluster = clusterId;
        }
      }

      if (bestCluster) {
        // Add to existing cluster
        const cluster = this.semanticClusters.get(bestCluster);
        cluster.entries.push(entryId);
        memoryEntry.clusterId = bestCluster;
        
        // Update centroid
        await this.updateClusterCentroid(bestCluster);
        
      } else {
        // Create new cluster
        const clusterId = this.generateClusterId();
        const newCluster = {
          id: clusterId,
          entries: [entryId],
          centroid: [...memoryEntry.embedding], // Copy embedding
          topics: memoryEntry.metadata.topics || [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        this.semanticClusters.set(clusterId, newCluster);
        memoryEntry.clusterId = clusterId;
      }

      logger.debug('Updated semantic clusters', {
        entryId,
        clusterId: memoryEntry.clusterId,
        totalClusters: this.semanticClusters.size
      });

    } catch (error) {
      logger.error('Failed to update semantic clusters', {
        entryId,
        error: error.message
      });
    }
  }

  /**
   * Update knowledge graph with entity relationships
   */
  async updateKnowledgeGraph(entryId, memoryEntry) {
    try {
      const entities = memoryEntry.metadata.entities || [];
      
      for (const entity of entities) {
        const entityId = this.normalizeEntityId(entity.name, entity.type);
        
        if (!this.knowledgeGraph.has(entityId)) {
          this.knowledgeGraph.set(entityId, {
            id: entityId,
            name: entity.name,
            type: entity.type,
            mentions: [],
            relations: new Set(),
            firstSeen: new Date(),
            lastSeen: new Date()
          });
        }

        const entityNode = this.knowledgeGraph.get(entityId);
        entityNode.mentions.push({
          entryId,
          context: entity.context || '',
          timestamp: memoryEntry.metadata.timestamp
        });
        entityNode.lastSeen = new Date();

        // Add relation to memory entry
        memoryEntry.relations.push({
          type: 'mentions',
          entityId,
          entityName: entity.name,
          entityType: entity.type
        });
      }

      // Find entity co-occurrences for relationship building
      if (entities.length > 1) {
        for (let i = 0; i < entities.length; i++) {
          for (let j = i + 1; j < entities.length; j++) {
            const entityA = this.normalizeEntityId(entities[i].name, entities[i].type);
            const entityB = this.normalizeEntityId(entities[j].name, entities[j].type);
            
            const nodeA = this.knowledgeGraph.get(entityA);
            const nodeB = this.knowledgeGraph.get(entityB);
            
            if (nodeA && nodeB) {
              nodeA.relations.add(entityB);
              nodeB.relations.add(entityA);
            }
          }
        }
      }

      logger.debug('Updated knowledge graph', {
        entryId,
        entitiesFound: entities.length,
        totalNodes: this.knowledgeGraph.size
      });

    } catch (error) {
      logger.error('Failed to update knowledge graph', {
        entryId,
        error: error.message
      });
    }
  }

  /**
   * Get related memories through knowledge graph traversal
   */
  async getRelatedMemories(entryId, options = {}) {
    const { maxDepth = 2, limit = 5 } = options;

    try {
      const visited = new Set();
      const relatedEntries = [];
      const queue = [{ id: entryId, depth: 0 }];

      while (queue.length > 0 && relatedEntries.length < limit) {
        const { id, depth } = queue.shift();
        
        if (visited.has(id) || depth > maxDepth) continue;
        visited.add(id);

        const entry = this.memoryEntries.get(id);
        if (!entry) continue;

        if (depth > 0) { // Don't include the starting entry
          relatedEntries.push({
            id,
            content: entry.content,
            similarity: 1.0 - (depth * 0.2), // Decrease similarity with depth
            importance: entry.metadata.importance,
            conversationId: entry.conversationId,
            timestamp: entry.metadata.timestamp,
            relationDepth: depth
          });
        }

        // Add related entries through knowledge graph
        for (const relation of entry.relations) {
          if (relation.type === 'mentions') {
            const entityNode = this.knowledgeGraph.get(relation.entityId);
            if (entityNode) {
              // Find other entries that mention this entity
              for (const mention of entityNode.mentions) {
                if (!visited.has(mention.entryId)) {
                  queue.push({ id: mention.entryId, depth: depth + 1 });
                }
              }
            }
          }
        }

        // Add entries from same semantic cluster
        if (entry.clusterId) {
          const cluster = this.semanticClusters.get(entry.clusterId);
          if (cluster) {
            for (const clusterEntryId of cluster.entries) {
              if (!visited.has(clusterEntryId)) {
                queue.push({ id: clusterEntryId, depth: depth + 1 });
              }
            }
          }
        }
      }

      return relatedEntries.slice(0, limit);

    } catch (error) {
      logger.error('Failed to get related memories', {
        entryId,
        error: error.message
      });
      return [];
    }
  }

  // Helper methods

  prepareContentForEmbedding(interaction) {
    let content = '';
    
    if (interaction.userMessage) {
      content += `User: ${interaction.userMessage.content}\n`;
    }
    
    if (interaction.assistantMessage) {
      content += `Assistant: ${interaction.assistantMessage.content}`;
    }
    
    return content.trim();
  }

  cleanTextForEmbedding(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?-]/g, '')
      .trim()
      .substring(0, 8000); // Limit for embedding model
  }

  detectLanguage(text) {
    // Simple language detection - in production use proper library
    const patterns = {
      en: /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/gi,
      es: /\b(el|la|y|o|pero|en|con|por|para|de)\b/gi,
      fr: /\b(le|la|et|ou|mais|dans|sur|avec|par|pour|de)\b/gi
    };

    let bestMatch = 'en';
    let maxMatches = 0;

    for (const [lang, pattern] of Object.entries(patterns)) {
      const matches = text.match(pattern);
      if (matches && matches.length > maxMatches) {
        maxMatches = matches.length;
        bestMatch = lang;
      }
    }

    return bestMatch;
  }

  async analyzeSentiment(text) {
    // Simple sentiment analysis - in production use proper library
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing', 'frustrating'];

    const words = text.toLowerCase().split(/\s+/);
    let positive = 0;
    let negative = 0;

    for (const word of words) {
      if (positiveWords.includes(word)) positive++;
      if (negativeWords.includes(word)) negative++;
    }

    let sentiment = 'neutral';
    let confidence = 0.5;

    if (positive > negative) {
      sentiment = 'positive';
      confidence = Math.min(0.9, 0.5 + (positive - negative) * 0.1);
    } else if (negative > positive) {
      sentiment = 'negative';
      confidence = Math.min(0.9, 0.5 + (negative - positive) * 0.1);
    }

    return { sentiment, confidence };
  }

  async extractTopics(text) {
    // Simple topic extraction - in production use NLP library
    const topicKeywords = {
      technology: ['computer', 'software', 'programming', 'code', 'api', 'database'],
      science: ['research', 'study', 'experiment', 'data', 'analysis', 'hypothesis'],
      business: ['company', 'market', 'sales', 'revenue', 'customer', 'strategy'],
      health: ['medical', 'doctor', 'patient', 'treatment', 'symptoms', 'medicine']
    };

    const words = text.toLowerCase().split(/\s+/);
    const topicScores = {};

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (words.includes(keyword)) score++;
      }
      if (score > 0) {
        topicScores[topic] = score / keywords.length;
      }
    }

    return Object.entries(topicScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([topic, score]) => ({ topic, confidence: score }));
  }

  async extractEntities(text) {
    // Simple entity extraction - in production use NER library
    const patterns = {
      PERSON: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
      EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      URL: /https?:\/\/[^\s]+/g,
      PHONE: /\b\d{3}-\d{3}-\d{4}\b/g
    };

    const entities = [];

    for (const [type, pattern] of Object.entries(patterns)) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          entities.push({
            name: match,
            type,
            context: this.getEntityContext(text, match)
          });
        }
      }
    }

    return entities;
  }

  getEntityContext(text, entity) {
    const index = text.indexOf(entity);
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + entity.length + 50);
    return text.substring(start, end).trim();
  }

  normalizeEntityId(name, type) {
    return `${type}:${name.toLowerCase().replace(/\s+/g, '_')}`;
  }

  deduplicateMemories(memories) {
    const seen = new Set();
    return memories.filter(memory => {
      if (seen.has(memory.id)) return false;
      seen.add(memory.id);
      return true;
    });
  }

  selectDiverseMemories(memories, options = {}) {
    const { maxSelection, diversityFactor = 0.7 } = options;
    
    if (memories.length <= maxSelection) return memories;

    const selected = [];
    const remaining = [...memories];

    // Always select the highest scoring memory first
    remaining.sort((a, b) => {
      const scoreA = (a.similarity || 0.5) * 0.6 + a.importance * 0.4;
      const scoreB = (b.similarity || 0.5) * 0.6 + b.importance * 0.4;
      return scoreB - scoreA;
    });

    selected.push(remaining.shift());

    // Select remaining memories balancing relevance and diversity
    while (selected.length < maxSelection && remaining.length > 0) {
      let bestMemory = null;
      let bestScore = -1;

      for (const memory of remaining) {
        // Calculate relevance score
        const relevanceScore = (memory.similarity || 0.5) * 0.6 + memory.importance * 0.4;

        // Calculate diversity score (lower is more diverse)
        let minSimilarity = 1.0;
        for (const selectedMemory of selected) {
          const similarity = this.calculateContentSimilarity(memory, selectedMemory);
          minSimilarity = Math.min(minSimilarity, similarity);
        }
        const diversityScore = 1.0 - minSimilarity;

        // Combined score
        const combinedScore = relevanceScore * (1 - diversityFactor) + diversityScore * diversityFactor;

        if (combinedScore > bestScore) {
          bestScore = combinedScore;
          bestMemory = memory;
        }
      }

      if (bestMemory) {
        selected.push(bestMemory);
        remaining.splice(remaining.indexOf(bestMemory), 1);
      } else {
        break;
      }
    }

    return selected;
  }

  calculateContentSimilarity(memoryA, memoryB) {
    // Simple content similarity based on common words
    const wordsA = new Set(memoryA.content.toLowerCase().split(/\s+/));
    const wordsB = new Set(memoryB.content.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    
    return intersection.size / union.size;
  }

  async updateClusterCentroid(clusterId) {
    const cluster = this.semanticClusters.get(clusterId);
    if (!cluster || cluster.entries.length === 0) return;

    // Calculate new centroid as average of all embeddings
    const embeddings = cluster.entries
      .map(entryId => this.memoryEntries.get(entryId)?.embedding)
      .filter(embedding => embedding);

    if (embeddings.length === 0) return;

    const newCentroid = new Array(this.vectorDimensions).fill(0);
    
    for (const embedding of embeddings) {
      for (let i = 0; i < this.vectorDimensions; i++) {
        newCentroid[i] += embedding[i];
      }
    }

    for (let i = 0; i < this.vectorDimensions; i++) {
      newCentroid[i] /= embeddings.length;
    }

    cluster.centroid = newCentroid;
    cluster.updatedAt = new Date();
  }

  async keywordSearch(query, options = {}) {
    const { limit = 10 } = options;
    
    const keywords = query.toLowerCase().split(/\s+/);
    const results = [];

    for (const [entryId, entry] of this.memoryEntries) {
      const content = entry.content.toLowerCase();
      let score = 0;

      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          score += 1 / keywords.length;
        }
      }

      if (score > 0) {
        results.push({
          id: entryId,
          similarity: score,
          content: entry.content,
          importance: entry.metadata.importance,
          conversationId: entry.conversationId,
          timestamp: entry.metadata.timestamp
        });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    
    return {
      results: results.slice(0, limit),
      totalCandidates: results.length,
      searchMetadata: {
        method: 'keyword',
        keywords
      }
    };
  }

  async rerankResults(query, results) {
    // Simple re-ranking based on additional factors
    return results.map(result => {
      const entry = this.memoryEntries.get(result.id);
      
      let boostFactor = 1.0;
      
      // Boost recent memories slightly
      const daysSince = (Date.now() - new Date(entry.metadata.timestamp)) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) boostFactor += 0.1;
      
      // Boost important memories
      boostFactor += entry.metadata.importance * 0.2;
      
      // Boost frequently accessed memories
      if (entry.accessCount > 5) boostFactor += 0.1;

      return {
        ...result,
        similarity: Math.min(1.0, result.similarity * boostFactor)
      };
    }).sort((a, b) => b.similarity - a.similarity);
  }

  async getConversationMemories(conversationId, options = {}) {
    const { limit = 10 } = options;
    
    const memories = Array.from(this.memoryEntries.values())
      .filter(entry => entry.conversationId === conversationId)
      .sort((a, b) => new Date(b.metadata.timestamp) - new Date(a.metadata.timestamp))
      .slice(0, limit);

    return memories.map(entry => ({
      id: entry.id,
      content: entry.content,
      timestamp: entry.metadata.timestamp,
      importance: entry.metadata.importance,
      metadata: entry.metadata
    }));
  }

  async persistMemoryEntry(memoryEntry) {
    const entryFile = path.join(this.metadataDir, `${memoryEntry.id}.json`);
    
    // Don't store embedding in metadata file (too large)
    const persistData = {
      ...memoryEntry,
      embedding: null // Store embeddings separately if needed
    };
    
    await fs.writeJson(entryFile, persistData, { spaces: 2 });
  }

  async loadExistingMemory() {
    try {
      const metadataFiles = await fs.readdir(this.metadataDir);
      
      for (const file of metadataFiles) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.metadataDir, file);
          const memoryEntry = await fs.readJson(filePath);
          this.memoryEntries.set(memoryEntry.id, memoryEntry);
        }
      }

      logger.info('Loaded existing vector memory', {
        entriesLoaded: this.memoryEntries.size
      });

    } catch (error) {
      logger.error('Failed to load existing memory', {
        error: error.message
      });
    }
  }

  // ID generators
  generateEntryId() {
    return `vmem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateClusterId() {
    return `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  async updateVectorIndex(entryId, embedding, metadata) {
    // This would typically update a proper vector database
    // For now, we store embeddings in memory
    logger.debug('Vector index updated', { entryId });
  }

  getMemoryStats() {
    return {
      totalEntries: this.memoryEntries.size,
      totalClusters: this.semanticClusters.size,
      totalKnowledgeNodes: this.knowledgeGraph.size,
      vectorDimensions: this.vectorDimensions
    };
  }

  async clearMemory(options = {}) {
    const { conversationId, userId, olderThan } = options;
    
    let deletedCount = 0;
    
    for (const [entryId, entry] of this.memoryEntries) {
      let shouldDelete = false;
      
      if (conversationId && entry.conversationId === conversationId) {
        shouldDelete = true;
      } else if (userId && entry.userId === userId) {
        shouldDelete = true;
      } else if (olderThan) {
        const entryDate = new Date(entry.metadata.timestamp);
        const cutoffDate = new Date(olderThan);
        if (entryDate < cutoffDate) {
          shouldDelete = true;
        }
      }
      
      if (shouldDelete) {
        this.memoryEntries.delete(entryId);
        
        // Clean up metadata file
        const entryFile = path.join(this.metadataDir, `${entryId}.json`);
        await fs.remove(entryFile).catch(() => {});
        
        deletedCount++;
      }
    }
    
    // Clean up orphaned clusters and knowledge graph nodes
    await this.cleanupOrphanedData();
    
    return { deletedCount };
  }

  async cleanupOrphanedData() {
    // Remove clusters with no entries
    for (const [clusterId, cluster] of this.semanticClusters) {
      const validEntries = cluster.entries.filter(entryId => this.memoryEntries.has(entryId));
      if (validEntries.length === 0) {
        this.semanticClusters.delete(clusterId);
      } else if (validEntries.length !== cluster.entries.length) {
        cluster.entries = validEntries;
        await this.updateClusterCentroid(clusterId);
      }
    }

    // Clean up knowledge graph
    for (const [entityId, entityNode] of this.knowledgeGraph) {
      const validMentions = entityNode.mentions.filter(mention => 
        this.memoryEntries.has(mention.entryId)
      );
      
      if (validMentions.length === 0) {
        this.knowledgeGraph.delete(entityId);
      } else if (validMentions.length !== entityNode.mentions.length) {
        entityNode.mentions = validMentions;
      }
    }
  }
}