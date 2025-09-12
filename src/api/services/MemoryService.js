import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

// Encryption utilities for sensitive memory data
const ENCRYPTION_KEY = process.env.MEMORY_ENCRYPTION_KEY || crypto.randomBytes(32);
const ALGORITHM = 'aes-256-gcm';

function encryptData(data) {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
    cipher.setAAD(Buffer.from('memory-data'));
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  } catch (error) {
    logger.error('Memory encryption failed', { error: error.message });
    return { encrypted: JSON.stringify(data), iv: null, tag: null };
  }
}

function decryptData(encryptedData) {
  try {
    if (!encryptedData.iv || !encryptedData.tag) {
      return JSON.parse(encryptedData.encrypted);
    }
    
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    decipher.setAAD(Buffer.from('memory-data'));
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    logger.error('Memory decryption failed', { error: error.message });
    return null;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MemoryService {
  constructor() {
    this.dataDir = path.join(__dirname, '../../../data/memory');
    this.contextDir = path.join(this.dataDir, 'context');
    this.searchIndexDir = path.join(this.dataDir, 'search');
    this.ensureDirectories();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.dataDir);
    await fs.ensureDir(this.contextDir);
    await fs.ensureDir(this.searchIndexDir);
  }

  async getRelevantContext(conversationId, userMessage, options = {}) {
    const { depth = 10, includeGlobal = true } = options;

    try {
      // Get conversation context
      const conversationContext = await this.getConversationContext(conversationId, { depth });
      
      // Get semantically relevant memories
      const relevantMemories = await this.searchMemories(userMessage, { limit: 5 });
      
      // Combine and prioritize context
      const context = [
        ...conversationContext,
        ...relevantMemories
      ];

      return context.slice(0, depth);
    } catch (error) {
      logger.error('Failed to get relevant context', {
        conversationId,
        error: error.message
      });
      return [];
    }
  }

  async getConversationContext(conversationId, options = {}) {
    const { depth = 10 } = options;

    try {
      const contextFile = path.join(this.contextDir, `${conversationId}.json`);
      
      if (!(await fs.pathExists(contextFile))) {
        return [];
      }

      const contextData = await fs.readJson(contextFile);
      const messages = contextData.messages || [];
      
      // Return most recent messages
      return messages.slice(-depth * 2); // Get depth worth of exchanges (user + assistant)
    } catch (error) {
      logger.error('Failed to get conversation context', {
        conversationId,
        error: error.message
      });
      return [];
    }
  }

  async addInteraction(conversationId, interaction) {
    try {
      const { userMessage, assistantMessage, context } = interaction;
      
      // Update conversation context
      await this.updateConversationContext(conversationId, [userMessage, assistantMessage]);
      
      // Add to searchable memory
      await this.addToSearchIndex(conversationId, interaction);
      
      // Update memory analytics
      await this.updateMemoryAnalytics(conversationId, interaction);
      
      logger.debug('Interaction added to memory', {
        conversationId,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id
      });
    } catch (error) {
      logger.error('Failed to add interaction to memory', {
        conversationId,
        error: error.message
      });
    }
  }

  async updateConversationContext(conversationId, messages) {
    const contextFile = path.join(this.contextDir, `${conversationId}.json`);
    
    let contextData = { messages: [] };
    if (await fs.pathExists(contextFile)) {
      contextData = await fs.readJson(contextFile);
    }

    // Add new messages
    contextData.messages.push(...messages);
    
    // Keep only recent messages to prevent file from growing too large
    const maxMessages = 100;
    if (contextData.messages.length > maxMessages) {
      contextData.messages = contextData.messages.slice(-maxMessages);
    }

    contextData.updatedAt = new Date().toISOString();
    
    await fs.writeJson(contextFile, contextData, { spaces: 2 });
  }

  async addToSearchIndex(conversationId, interaction) {
    const indexFile = path.join(this.searchIndexDir, 'interactions.json');
    
    let searchIndex = { interactions: [] };
    if (await fs.pathExists(indexFile)) {
      searchIndex = await fs.readJson(indexFile);
    }

    // Create searchable entry
    const searchEntry = {
      id: `${conversationId}_${interaction.userMessage.id}`,
      conversationId,
      userMessage: interaction.userMessage.content,
      assistantMessage: interaction.assistantMessage.content,
      timestamp: interaction.userMessage.timestamp,
      keywords: this.extractKeywords(interaction.userMessage.content + ' ' + interaction.assistantMessage.content),
      metadata: {
        model: interaction.assistantMessage.metadata?.model,
        tokensUsed: interaction.assistantMessage.metadata?.tokensUsed
      }
    };

    searchIndex.interactions.push(searchEntry);
    
    // Keep index manageable (last 1000 interactions)
    if (searchIndex.interactions.length > 1000) {
      searchIndex.interactions = searchIndex.interactions.slice(-1000);
    }

    searchIndex.updatedAt = new Date().toISOString();
    
    await fs.writeJson(indexFile, searchIndex, { spaces: 2 });
  }

  async searchMemories(query, options = {}) {
    const { limit = 10, conversationId = null } = options;

    try {
      const indexFile = path.join(this.searchIndexDir, 'interactions.json');
      
      if (!(await fs.pathExists(indexFile))) {
        return [];
      }

      const searchIndex = await fs.readJson(indexFile);
      const interactions = searchIndex.interactions || [];
      
      // Simple text-based search (in production, use proper search engine)
      const queryLower = query.toLowerCase();
      const queryKeywords = this.extractKeywords(query);
      
      const results = interactions
        .filter(interaction => {
          // Exclude current conversation if specified
          if (conversationId && interaction.conversationId === conversationId) {
            return false;
          }
          
          // Check for text matches
          const textMatch = 
            interaction.userMessage.toLowerCase().includes(queryLower) ||
            interaction.assistantMessage.toLowerCase().includes(queryLower);
          
          // Check for keyword matches
          const keywordMatch = queryKeywords.some(keyword => 
            interaction.keywords.includes(keyword)
          );
          
          return textMatch || keywordMatch;
        })
        .map(interaction => ({
          ...interaction,
          relevanceScore: this.calculateRelevanceScore(interaction, queryKeywords, queryLower)
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit)
        .map(interaction => ({
          role: 'system',
          content: `Previous context: User asked "${interaction.userMessage.substring(0, 100)}..." and assistant responded "${interaction.assistantMessage.substring(0, 100)}..."`
        }));

      return results;
    } catch (error) {
      logger.error('Memory search failed', {
        query,
        error: error.message
      });
      return [];
    }
  }

  extractKeywords(text) {
    // Simple keyword extraction (in production, use NLP library)
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));
    
    // Remove duplicates and return
    return [...new Set(words)];
  }

  isStopWord(word) {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
      'after', 'above', 'below', 'between', 'among', 'during', 'without',
      'this', 'that', 'these', 'those', 'what', 'which', 'who', 'when',
      'where', 'why', 'how', 'can', 'could', 'should', 'would', 'will',
      'shall', 'may', 'might', 'must', 'have', 'has', 'had', 'been',
      'being', 'been', 'are', 'is', 'was', 'were', 'am', 'do', 'does',
      'did', 'done', 'get', 'got', 'getting', 'make', 'made', 'making'
    ]);
    
    return stopWords.has(word);
  }

  calculateRelevanceScore(interaction, queryKeywords, queryLower) {
    let score = 0;
    
    // Keyword matches (higher weight)
    const keywordMatches = queryKeywords.filter(keyword => 
      interaction.keywords.includes(keyword)
    ).length;
    score += keywordMatches * 3;
    
    // Text matches in user message
    if (interaction.userMessage.toLowerCase().includes(queryLower)) {
      score += 2;
    }
    
    // Text matches in assistant message
    if (interaction.assistantMessage.toLowerCase().includes(queryLower)) {
      score += 1;
    }
    
    // Recency bonus (newer interactions get slight boost)
    const daysSinceInteraction = (Date.now() - new Date(interaction.timestamp)) / (1000 * 60 * 60 * 24);
    if (daysSinceInteraction < 7) {
      score += 0.5;
    }
    
    return score;
  }

  async updateMemoryAnalytics(conversationId, interaction) {
    try {
      const analyticsFile = path.join(this.dataDir, 'analytics.json');
      
      let analytics = {
        totalInteractions: 0,
        totalTokens: 0,
        totalCost: 0,
        modelUsage: {},
        dailyStats: {},
        conversationStats: {}
      };
      
      if (await fs.pathExists(analyticsFile)) {
        analytics = await fs.readJson(analyticsFile);
      }
      
      const today = new Date().toISOString().split('T')[0];
      const model = interaction.assistantMessage.metadata?.model || 'unknown';
      const tokens = interaction.assistantMessage.metadata?.tokensUsed || 0;
      const cost = interaction.assistantMessage.metadata?.cost || 0;
      
      // Update totals
      analytics.totalInteractions++;
      analytics.totalTokens += tokens;
      analytics.totalCost += cost;
      
      // Update model usage
      if (!analytics.modelUsage[model]) {
        analytics.modelUsage[model] = { count: 0, tokens: 0, cost: 0 };
      }
      analytics.modelUsage[model].count++;
      analytics.modelUsage[model].tokens += tokens;
      analytics.modelUsage[model].cost += cost;
      
      // Update daily stats
      if (!analytics.dailyStats[today]) {
        analytics.dailyStats[today] = { interactions: 0, tokens: 0, cost: 0 };
      }
      analytics.dailyStats[today].interactions++;
      analytics.dailyStats[today].tokens += tokens;
      analytics.dailyStats[today].cost += cost;
      
      // Update conversation stats
      if (!analytics.conversationStats[conversationId]) {
        analytics.conversationStats[conversationId] = { 
          interactions: 0, 
          tokens: 0, 
          cost: 0,
          firstInteraction: interaction.userMessage.timestamp,
          lastInteraction: interaction.userMessage.timestamp
        };
      }
      analytics.conversationStats[conversationId].interactions++;
      analytics.conversationStats[conversationId].tokens += tokens;
      analytics.conversationStats[conversationId].cost += cost;
      analytics.conversationStats[conversationId].lastInteraction = interaction.userMessage.timestamp;
      
      analytics.updatedAt = new Date().toISOString();
      
      await fs.writeJson(analyticsFile, analytics, { spaces: 2 });
    } catch (error) {
      logger.error('Failed to update memory analytics', {
        conversationId,
        error: error.message
      });
    }
  }

  async getMemoryAnalytics(options = {}) {
    const { timeframe = 'week', includeConversations = false } = options;
    
    try {
      const analyticsFile = path.join(this.dataDir, 'analytics.json');
      
      if (!(await fs.pathExists(analyticsFile))) {
        return {
          totalInteractions: 0,
          totalTokens: 0,
          totalCost: 0,
          timeframe,
          data: {}
        };
      }
      
      const analytics = await fs.readJson(analyticsFile);
      
      // Filter data based on timeframe
      const cutoffDate = new Date();
      switch (timeframe) {
        case 'day':
          cutoffDate.setDate(cutoffDate.getDate() - 1);
          break;
        case 'week':
          cutoffDate.setDate(cutoffDate.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(cutoffDate.getMonth() - 1);
          break;
        case 'year':
          cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
          break;
      }
      
      const filteredDailyStats = {};
      Object.entries(analytics.dailyStats || {}).forEach(([date, stats]) => {
        if (new Date(date) >= cutoffDate) {
          filteredDailyStats[date] = stats;
        }
      });
      
      const result = {
        totalInteractions: analytics.totalInteractions,
        totalTokens: analytics.totalTokens,
        totalCost: analytics.totalCost,
        modelUsage: analytics.modelUsage,
        timeframe,
        dailyStats: filteredDailyStats,
        updatedAt: analytics.updatedAt
      };
      
      if (includeConversations) {
        result.conversationStats = analytics.conversationStats;
      }
      
      return result;
    } catch (error) {
      logger.error('Failed to get memory analytics', {
        timeframe,
        error: error.message
      });
      
      return {
        totalInteractions: 0,
        totalTokens: 0,
        totalCost: 0,
        timeframe,
        error: error.message
      };
    }
  }

  async cleanupMemory(options = {}) {
    const { daysToKeep = 90, maxInteractions = 5000 } = options;
    
    try {
      let cleanupCount = 0;
      
      // Cleanup conversation contexts
      const contextFiles = await fs.readdir(this.contextDir);
      for (const file of contextFiles) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.contextDir, file);
          const stats = await fs.stat(filePath);
          const daysSinceModified = (Date.now() - stats.mtime) / (1000 * 60 * 60 * 24);
          
          if (daysSinceModified > daysToKeep) {
            await fs.remove(filePath);
            cleanupCount++;
          }
        }
      }
      
      // Cleanup search index
      const indexFile = path.join(this.searchIndexDir, 'interactions.json');
      if (await fs.pathExists(indexFile)) {
        const searchIndex = await fs.readJson(indexFile);
        if (searchIndex.interactions && searchIndex.interactions.length > maxInteractions) {
          searchIndex.interactions = searchIndex.interactions.slice(-maxInteractions);
          searchIndex.updatedAt = new Date().toISOString();
          await fs.writeJson(indexFile, searchIndex, { spaces: 2 });
        }
      }
      
      logger.info('Memory cleanup completed', {
        cleanupCount,
        daysToKeep,
        maxInteractions
      });
      
      return { cleanupCount };
    } catch (error) {
      logger.error('Memory cleanup failed', { error: error.message });
      throw error;
    }
  }
}