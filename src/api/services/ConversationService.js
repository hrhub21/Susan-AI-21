import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ConversationService {
  constructor() {
    this.dataDir = path.join(__dirname, '../../../data/conversations');
    this.ensureDataDirectory();
  }

  async ensureDataDirectory() {
    await fs.ensureDir(this.dataDir);
  }

  generateId() {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async createConversation({ userId, title, metadata = {} }) {
    const conversation = {
      id: this.generateId(),
      userId,
      title,
      messages: [],
      metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
      lastActivity: new Date().toISOString()
    };

    await this.saveConversation(conversation);
    
    logger.info('Conversation created', {
      conversationId: conversation.id,
      userId,
      title
    });

    return conversation;
  }

  async getConversation(conversationId, userId) {
    try {
      const conversation = await this.loadConversation(conversationId);
      
      if (!conversation || conversation.userId !== userId) {
        return null;
      }

      return conversation;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async updateConversation(conversationId, userId, updates) {
    const conversation = await this.getConversation(conversationId, userId);
    
    if (!conversation) {
      return null;
    }

    const updatedConversation = {
      ...conversation,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await this.saveConversation(updatedConversation);
    
    logger.info('Conversation updated', {
      conversationId,
      userId,
      updates: Object.keys(updates)
    });

    return updatedConversation;
  }

  async deleteConversation(conversationId, userId) {
    const conversation = await this.getConversation(conversationId, userId);
    
    if (!conversation) {
      return false;
    }

    const filePath = path.join(this.dataDir, `${conversationId}.json`);
    await fs.remove(filePath);
    
    logger.info('Conversation deleted', {
      conversationId,
      userId
    });

    return true;
  }

  async listConversations({ userId, page = 1, limit = 20, search, sortBy = 'updatedAt', sortOrder = 'desc' }) {
    const userConversations = await this.getUserConversations(userId);
    
    // Apply search filter
    let filtered = userConversations;
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = userConversations.filter(conv => 
        conv.title.toLowerCase().includes(searchLower) ||
        conv.messages.some(msg => msg.content.toLowerCase().includes(searchLower))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (sortOrder === 'desc') {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      } else {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      }
    });

    // Apply pagination
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const conversations = filtered.slice(offset, offset + limit);

    // Remove messages from list view for performance
    const conversationsWithoutMessages = conversations.map(conv => ({
      ...conv,
      messages: undefined,
      messageCount: conv.messages?.length || 0,
      lastMessage: conv.messages?.length > 0 ? conv.messages[conv.messages.length - 1] : null
    }));

    return {
      conversations: conversationsWithoutMessages,
      page,
      limit,
      total,
      totalPages
    };
  }

  async addMessage(conversationId, messageData) {
    const conversation = await this.loadConversation(conversationId);
    
    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    const message = {
      id: this.generateMessageId(),
      ...messageData,
      timestamp: new Date().toISOString(),
      context: await this.extractMessageContext(messageData, conversation),
      sentiment: await this.analyzeMessageSentiment(messageData.content),
      topics: await this.extractMessageTopics(messageData.content),
      intent: await this.detectMessageIntent(messageData.content)
    };

    conversation.messages.push(message);
    conversation.messageCount = conversation.messages.length;
    conversation.updatedAt = new Date().toISOString();
    conversation.lastActivity = new Date().toISOString();
    
    // Update conversation metadata with new insights
    conversation.metadata = await this.updateConversationMetadata(conversation, message);

    await this.saveConversation(conversation);

    logger.debug('Enhanced message added to conversation', {
      conversationId,
      messageId: message.id,
      role: message.role,
      intent: message.intent,
      topics: message.topics?.length || 0
    });

    return message;
  }

  async getMessages(conversationId, userId, { page = 1, limit = 50 }) {
    const conversation = await this.getConversation(conversationId, userId);
    
    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    const messages = conversation.messages || [];
    const total = messages.length;
    const totalPages = Math.ceil(total / limit);
    
    // Get messages in reverse order (newest first) for pagination
    const reversedMessages = [...messages].reverse();
    const offset = (page - 1) * limit;
    const paginatedMessages = reversedMessages.slice(offset, offset + limit);

    return {
      messages: paginatedMessages,
      page,
      limit,
      total,
      totalPages
    };
  }

  async getConversationStats(conversationId, userId) {
    const conversation = await this.getConversation(conversationId, userId);
    
    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    const messages = conversation.messages || [];
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    // Calculate token usage and costs
    let totalTokens = 0;
    let totalCost = 0;
    const modelUsage = {};

    assistantMessages.forEach(msg => {
      if (msg.metadata?.tokensUsed) {
        totalTokens += msg.metadata.tokensUsed;
      }
      if (msg.metadata?.cost) {
        totalCost += msg.metadata.cost;
      }
      if (msg.metadata?.model) {
        modelUsage[msg.metadata.model] = (modelUsage[msg.metadata.model] || 0) + 1;
      }
    });

    // Calculate conversation duration
    const duration = messages.length > 0 ? 
      new Date(messages[messages.length - 1].timestamp) - new Date(messages[0].timestamp) : 0;

    return {
      messageCount: messages.length,
      userMessageCount: userMessages.length,
      assistantMessageCount: assistantMessages.length,
      totalTokens,
      totalCost,
      modelUsage,
      duration,
      createdAt: conversation.createdAt,
      lastActivity: conversation.lastActivity,
      averageResponseTime: this.calculateAverageResponseTime(messages)
    };
  }

  calculateAverageResponseTime(messages) {
    const responseTimes = [];
    
    for (let i = 0; i < messages.length - 1; i++) {
      const userMsg = messages[i];
      const assistantMsg = messages[i + 1];
      
      if (userMsg.role === 'user' && assistantMsg.role === 'assistant') {
        const responseTime = new Date(assistantMsg.timestamp) - new Date(userMsg.timestamp);
        responseTimes.push(responseTime);
      }
    }

    if (responseTimes.length === 0) return 0;
    
    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  }

  // Enhanced context extraction and analysis methods
  async extractMessageContext(messageData, conversation) {
    const recentMessages = conversation.messages.slice(-5); // Last 5 messages
    const topics = this.extractTopicsFromMessages(recentMessages);
    const entities = this.extractEntitiesFromMessages(recentMessages);
    
    return {
      recentTopics: topics,
      mentionedEntities: entities,
      conversationTurn: conversation.messages.length + 1,
      timeOfDay: this.getTimeOfDay(),
      conversationDuration: this.getConversationDuration(conversation)
    };
  }

  async analyzeMessageSentiment(content) {
    if (!content) return { sentiment: 'neutral', confidence: 0.5 };
    
    // Enhanced sentiment analysis using keyword patterns
    const positivePatterns = [
      /\b(great|good|excellent|amazing|wonderful|fantastic|love|like|happy|pleased|satisfied)\b/gi,
      /\b(thank you|thanks|appreciate|helpful|useful|perfect|awesome)\b/gi
    ];
    
    const negativePatterns = [
      /\b(bad|terrible|awful|horrible|hate|dislike|frustrated|angry|disappointed)\b/gi,
      /\b(problem|issue|error|wrong|broken|fail|difficult|confusing)\b/gi
    ];
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    positivePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) positiveScore += matches.length;
    });
    
    negativePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) negativeScore += matches.length;
    });
    
    let sentiment = 'neutral';
    let confidence = 0.5;
    
    if (positiveScore > negativeScore) {
      sentiment = 'positive';
      confidence = Math.min(0.95, 0.6 + (positiveScore - negativeScore) * 0.1);
    } else if (negativeScore > positiveScore) {
      sentiment = 'negative';
      confidence = Math.min(0.95, 0.6 + (negativeScore - positiveScore) * 0.1);
    }
    
    return { sentiment, confidence };
  }

  async extractMessageTopics(content) {
    if (!content) return [];
    
    const topicKeywords = {
      technology: ['computer', 'software', 'programming', 'code', 'api', 'database', 'ai', 'ml', 'tech'],
      science: ['research', 'study', 'experiment', 'data', 'analysis', 'hypothesis', 'theory'],
      business: ['company', 'market', 'sales', 'revenue', 'customer', 'strategy', 'profit', 'growth'],
      health: ['medical', 'doctor', 'patient', 'treatment', 'symptoms', 'medicine', 'health'],
      education: ['learn', 'study', 'education', 'school', 'university', 'course', 'knowledge'],
      entertainment: ['movie', 'music', 'game', 'book', 'art', 'culture', 'entertainment'],
      travel: ['travel', 'trip', 'vacation', 'flight', 'hotel', 'destination', 'tourism'],
      food: ['food', 'restaurant', 'recipe', 'cooking', 'cuisine', 'meal', 'drink']
    };
    
    const words = content.toLowerCase().split(/\s+/);
    const topicScores = {};
    
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      const score = keywords.filter(keyword => 
        words.some(word => word.includes(keyword))
      ).length;
      
      if (score > 0) {
        topicScores[topic] = score / keywords.length;
      }
    });
    
    return Object.entries(topicScores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([topic, confidence]) => ({ topic, confidence }));
  }

  async detectMessageIntent(content) {
    if (!content) return { intent: 'unknown', confidence: 0.5 };
    
    const intentPatterns = {
      question: {
        patterns: [/^(what|who|when|where|why|how|which|can you|could you|do you|are you|is there|will you)/i, /\?$/],
        weight: 2
      },
      request: {
        patterns: [/^(please|could you|can you|would you|help me|assist me|i need|i want)/i],
        weight: 2
      },
      command: {
        patterns: [/^(show me|tell me|give me|find|search|calculate|create|make|do|execute)/i],
        weight: 2
      },
      greeting: {
        patterns: [/^(hi|hello|hey|good morning|good afternoon|good evening|greetings)/i],
        weight: 1
      },
      farewell: {
        patterns: [/^(bye|goodbye|see you|farewell|take care|thank you)/i, /(bye|goodbye|see you later)$/i],
        weight: 1
      },
      compliment: {
        patterns: [/\b(great job|well done|excellent|amazing|fantastic|wonderful|perfect)\b/i],
        weight: 1
      },
      complaint: {
        patterns: [/\b(problem|issue|error|wrong|broken|not working|frustrated)\b/i],
        weight: 1
      }
    };
    
    let bestIntent = 'statement';
    let maxScore = 0;
    
    Object.entries(intentPatterns).forEach(([intent, config]) => {
      let score = 0;
      config.patterns.forEach(pattern => {
        if (pattern.test(content)) {
          score += config.weight;
        }
      });
      
      if (score > maxScore) {
        maxScore = score;
        bestIntent = intent;
      }
    });
    
    const confidence = maxScore > 0 ? Math.min(0.95, 0.6 + maxScore * 0.1) : 0.3;
    
    return { intent: bestIntent, confidence };
  }

  async updateConversationMetadata(conversation, newMessage) {
    const currentMetadata = conversation.metadata || {};
    
    // Update topic tracking
    const topics = currentMetadata.topics || {};
    if (newMessage.topics) {
      newMessage.topics.forEach(topicInfo => {
        if (!topics[topicInfo.topic]) {
          topics[topicInfo.topic] = { count: 0, lastMentioned: null, confidence: 0 };
        }
        topics[topicInfo.topic].count++;
        topics[topicInfo.topic].lastMentioned = newMessage.timestamp;
        topics[topicInfo.topic].confidence = Math.max(
          topics[topicInfo.topic].confidence, 
          topicInfo.confidence
        );
      });
    }
    
    // Update intent tracking
    const intents = currentMetadata.intents || {};
    if (newMessage.intent) {
      const intentType = newMessage.intent.intent;
      if (!intents[intentType]) {
        intents[intentType] = { count: 0, lastOccurrence: null };
      }
      intents[intentType].count++;
      intents[intentType].lastOccurrence = newMessage.timestamp;
    }
    
    // Update sentiment tracking
    const sentiments = currentMetadata.sentiments || { positive: 0, negative: 0, neutral: 0 };
    if (newMessage.sentiment) {
      sentiments[newMessage.sentiment.sentiment]++;
    }
    
    return {
      ...currentMetadata,
      topics,
      intents,
      sentiments,
      lastAnalyzed: new Date().toISOString(),
      totalMessages: conversation.messages.length + 1
    };
  }

  extractTopicsFromMessages(messages) {
    const allTopics = [];
    messages.forEach(msg => {
      if (msg.topics) {
        allTopics.push(...msg.topics);
      }
    });
    return allTopics;
  }

  extractEntitiesFromMessages(messages) {
    const allEntities = [];
    messages.forEach(msg => {
      if (msg.entities) {
        allEntities.push(...msg.entities);
      }
    });
    return allEntities;
  }

  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  }

  getConversationDuration(conversation) {
    if (!conversation.messages || conversation.messages.length === 0) return 0;
    
    const firstMessage = conversation.messages[0];
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    
    return new Date(lastMessage.timestamp) - new Date(firstMessage.timestamp);
  }

  async getUserConversations(userId) {
    try {
      const files = await fs.readdir(this.dataDir);
      const conversations = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const conversation = await this.loadConversation(file.replace('.json', ''));
            if (conversation.userId === userId) {
              conversations.push(conversation);
            }
          } catch (error) {
            logger.warn('Failed to load conversation', { file, error: error.message });
          }
        }
      }

      return conversations;
    } catch (error) {
      logger.error('Failed to get user conversations', { userId, error: error.message });
      return [];
    }
  }

  async saveConversation(conversation) {
    const filePath = path.join(this.dataDir, `${conversation.id}.json`);
    await fs.writeJson(filePath, conversation, { spaces: 2 });
  }

  async loadConversation(conversationId) {
    const filePath = path.join(this.dataDir, `${conversationId}.json`);
    return await fs.readJson(filePath);
  }

  // Backup and maintenance methods
  async backupConversations(userId, outputPath) {
    const conversations = await this.getUserConversations(userId);
    const backup = {
      userId,
      timestamp: new Date().toISOString(),
      conversations
    };

    await fs.writeJson(outputPath, backup, { spaces: 2 });
    
    logger.info('Conversations backed up', {
      userId,
      count: conversations.length,
      outputPath
    });

    return backup;
  }

  async cleanupOldConversations(daysToKeep = 90) {
    try {
      const files = await fs.readdir(this.dataDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      let deletedCount = 0;
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const conversation = await this.loadConversation(file.replace('.json', ''));
          const lastActivity = new Date(conversation.lastActivity || conversation.updatedAt);
          
          if (lastActivity < cutoffDate) {
            const filePath = path.join(this.dataDir, file);
            await fs.remove(filePath);
            deletedCount++;
            
            logger.info('Old conversation deleted', {
              conversationId: conversation.id,
              lastActivity: conversation.lastActivity
            });
          }
        } catch (error) {
          logger.warn('Failed to process conversation during cleanup', {
            file,
            error: error.message
          });
        }
      }
      
      logger.info('Conversation cleanup completed', {
        deletedCount,
        daysToKeep,
        cutoffDate: cutoffDate.toISOString()
      });
      
      return deletedCount;
    } catch (error) {
      logger.error('Conversation cleanup failed', { error: error.message });
      return 0;
    }
  }
}