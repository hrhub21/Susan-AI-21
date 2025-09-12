import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { ConversationService } from '../services/ConversationService.js';
import { AIService } from '../services/AIService.js';
import { MemoryService } from '../services/MemoryService.js';

export class ConversationController {
  constructor() {
    this.conversationService = new ConversationService();
    this.aiService = new AIService();
    this.memoryService = new MemoryService();
  }

  async listConversations(req, res) {
    const { page = 1, limit = 20, search, sortBy = 'updatedAt', sortOrder = 'desc' } = req.query;
    const userId = this.getUserId(req);

    try {
      const result = await this.conversationService.listConversations({
        userId,
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        sortBy,
        sortOrder
      });

      res.json({
        success: true,
        data: {
          conversations: result.conversations
        },
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async createConversation(req, res) {
    const { title, initialMessage, metadata = {} } = req.body;
    const userId = this.getUserId(req);

    try {
      const conversation = await this.conversationService.createConversation({
        userId,
        title: title || 'New Conversation',
        metadata
      });

      // If there's an initial message, process it
      let assistantMessage = null;
      if (initialMessage) {
        const messageResult = await this.processMessage(conversation.id, initialMessage, req);
        assistantMessage = messageResult.assistantMessage;
      }

      res.status(201).json({
        success: true,
        data: {
          conversation,
          ...(assistantMessage && { initialResponse: assistantMessage })
        },
        message: 'Conversation created successfully',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getConversation(req, res) {
    const { conversationId } = req.params;
    const userId = this.getUserId(req);

    try {
      const conversation = await this.conversationService.getConversation(conversationId, userId);
      
      if (!conversation) {
        throw ApiError.notFound('Conversation not found');
      }

      res.json({
        success: true,
        data: conversation,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async updateConversation(req, res) {
    const { conversationId } = req.params;
    const { title, metadata } = req.body;
    const userId = this.getUserId(req);

    try {
      const updatedConversation = await this.conversationService.updateConversation(
        conversationId,
        userId,
        { title, metadata }
      );

      if (!updatedConversation) {
        throw ApiError.notFound('Conversation not found');
      }

      res.json({
        success: true,
        data: updatedConversation,
        message: 'Conversation updated successfully',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async deleteConversation(req, res) {
    const { conversationId } = req.params;
    const userId = this.getUserId(req);

    try {
      const deleted = await this.conversationService.deleteConversation(conversationId, userId);
      
      if (!deleted) {
        throw ApiError.notFound('Conversation not found');
      }

      res.status(204).send();
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async sendMessage(req, res) {
    const { conversationId } = req.params;
    const { content, model, options = {} } = req.body;
    const userId = this.getUserId(req);

    try {
      const result = await this.processMessage(conversationId, content, req, { model, options });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async streamMessage(req, res) {
    const { conversationId } = req.params;
    const { content, model, options = {} } = req.body;
    const userId = this.getUserId(req);

    try {
      // Verify conversation exists and user has access
      const conversation = await this.conversationService.getConversation(conversationId, userId);
      if (!conversation) {
        throw ApiError.notFound('Conversation not found');
      }

      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Save user message
      const userMessage = await this.conversationService.addMessage(conversationId, {
        role: 'user',
        content,
        metadata: {
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        }
      });

      // Send user message confirmation
      res.write(`data: ${JSON.stringify({
        type: 'user_message',
        message: userMessage
      })}\n\n`);

      // Get context for AI
      const context = await this.memoryService.getRelevantContext(conversationId, content);

      // Stream AI response
      let assistantMessageContent = '';
      const stream = await this.aiService.streamResponse(content, {
        conversationId,
        context,
        model: model || 'default',
        ...options
      });

      for await (const chunk of stream) {
        assistantMessageContent += chunk.content || '';
        
        res.write(`data: ${JSON.stringify({
          type: 'assistant_chunk',
          content: chunk.content,
          delta: chunk.delta,
          finishReason: chunk.finishReason
        })}\n\n`);

        if (chunk.finishReason) {
          break;
        }
      }

      // Save assistant message
      const assistantMessage = await this.conversationService.addMessage(conversationId, {
        role: 'assistant',
        content: assistantMessageContent,
        metadata: {
          model: model || 'default',
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          tokensUsed: stream.usage?.totalTokens,
          cost: stream.usage?.cost
        }
      });

      // Send completion
      res.write(`data: ${JSON.stringify({
        type: 'completion',
        message: assistantMessage
      })}\n\n`);

      res.write('data: [DONE]\n\n');
      res.end();

    } catch (error) {
      logger.apiError(error, req);
      
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message
      })}\n\n`);
      
      res.end();
    }
  }

  async getMessages(req, res) {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = this.getUserId(req);

    try {
      const result = await this.conversationService.getMessages(conversationId, userId, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: {
          messages: result.messages
        },
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getContext(req, res) {
    const { conversationId } = req.params;
    const { depth = 10 } = req.query;
    const userId = this.getUserId(req);

    try {
      // Verify conversation access
      const conversation = await this.conversationService.getConversation(conversationId, userId);
      if (!conversation) {
        throw ApiError.notFound('Conversation not found');
      }

      const context = await this.memoryService.getConversationContext(conversationId, {
        depth: parseInt(depth)
      });

      res.json({
        success: true,
        data: {
          context
        },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getStats(req, res) {
    const { conversationId } = req.params;
    const userId = this.getUserId(req);

    try {
      const stats = await this.conversationService.getConversationStats(conversationId, userId);

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  // Helper methods
  async processMessage(conversationId, content, req, options = {}) {
    const userId = this.getUserId(req);
    const { model, options: aiOptions = {} } = options;

    // Verify conversation exists and user has access
    const conversation = await this.conversationService.getConversation(conversationId, userId);
    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    // Save user message
    const userMessage = await this.conversationService.addMessage(conversationId, {
      role: 'user',
      content,
      metadata: {
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      }
    });

    // Get relevant context and memory
    const context = await this.memoryService.getRelevantContext(conversationId, content);

    // Get AI response
    const startTime = Date.now();
    const aiResponse = await this.aiService.generateResponse(content, {
      conversationId,
      context,
      model: model || 'default',
      ...aiOptions
    });
    const duration = Date.now() - startTime;

    // Save assistant message
    const assistantMessage = await this.conversationService.addMessage(conversationId, {
      role: 'assistant',
      content: aiResponse.content,
      metadata: {
        model: aiResponse.model,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        tokensUsed: aiResponse.usage?.totalTokens,
        cost: aiResponse.usage?.cost,
        processingTime: duration
      }
    });

    // Update memory with new interaction
    await this.memoryService.addInteraction(conversationId, {
      userMessage,
      assistantMessage,
      context: context.slice(0, 5) // Store limited context
    });

    // Log model usage
    logger.modelUsage(
      aiResponse.model,
      aiResponse.usage?.totalTokens || 0,
      aiResponse.usage?.cost || 0,
      duration
    );

    return {
      userMessage,
      assistantMessage,
      metadata: {
        processingTime: duration,
        model: aiResponse.model,
        tokensUsed: aiResponse.usage?.totalTokens,
        cost: aiResponse.usage?.cost
      }
    };
  }

  async cancelStream(req, res) {
    const { conversationId, streamId } = req.params;
    const userId = this.getUserId(req);

    try {
      const result = await this.conversationService.cancelStream(streamId, conversationId, userId);
      
      res.json({
        success: true,
        data: { streamId, cancelled: result },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async getActiveStreams(req, res) {
    const { conversationId } = req.params;
    const userId = this.getUserId(req);

    try {
      const streams = await this.conversationService.getActiveStreams(conversationId, userId);
      
      res.json({
        success: true,
        data: { streams },
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async exportConversation(req, res) {
    const { conversationId } = req.params;
    const { format = 'json', includeMetadata = 'true' } = req.query;
    const userId = this.getUserId(req);

    try {
      const exportData = await this.conversationService.exportConversation(conversationId, userId, {
        format,
        includeMetadata: includeMetadata === 'true'
      });
      
      const filename = `conversation_${conversationId}_${Date.now()}.${format}`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', this.getContentTypeForFormat(format));
      
      res.send(exportData);
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async shareConversation(req, res) {
    const { conversationId } = req.params;
    const { expiresIn = '7d', permissions = ['read'], password } = req.body;
    const userId = this.getUserId(req);

    try {
      const shareData = await this.conversationService.shareConversation(conversationId, userId, {
        expiresIn,
        permissions,
        password
      });
      
      res.json({
        success: true,
        data: shareData,
        message: 'Conversation shared successfully',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  async collaborateConversation(req, res) {
    const { conversationId } = req.params;
    const { action, features = {} } = req.body;
    const userId = this.getUserId(req);

    try {
      const result = await this.conversationService.collaborateConversation(conversationId, userId, {
        action,
        features
      });
      
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    } catch (error) {
      logger.apiError(error, req);
      throw error;
    }
  }

  getContentTypeForFormat(format) {
    const types = {
      'json': 'application/json',
      'markdown': 'text/markdown',
      'txt': 'text/plain',
      'csv': 'text/csv'
    };
    return types[format] || 'application/octet-stream';
  }

  getUserId(req) {
    if (req.auth?.user?.id) {
      return req.auth.user.id;
    }
    
    if (req.auth?.key) {
      // For API key auth, use a derived user ID or default
      return `api_user_${req.auth.key.slice(-8)}`;
    }
    
    throw ApiError.unauthorized('User identification required');
  }
}