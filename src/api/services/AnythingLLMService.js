import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import EventEmitter from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * AnythingLLM Integration Service
 * Provides integration with AnythingLLM vector database and knowledge management system
 * to enhance Susan's capabilities with persistent knowledge storage and retrieval
 */
export class AnythingLLMService extends EventEmitter {
  constructor() {
    super();
    
    // Configuration from environment variables
    this.baseUrl = process.env.ANYTHINGLLM_BASE_URL || 'http://localhost:3001';
    this.apiKey = process.env.ANYTHINGLLM_API_KEY;
    this.timeout = parseInt(process.env.ANYTHINGLLM_TIMEOUT || '30000');
    
    // Default workspace configuration
    this.defaultWorkspace = process.env.ANYTHINGLLM_WORKSPACE || 'susan-ai';
    
    // Initialize the HTTP client
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      }
    });

    // Request/Response interceptors for logging and error handling
    this.setupInterceptors();
    
    // Cache for workspaces and documents
    this.workspaceCache = new Map();
    this.documentCache = new Map();
    
    // Knowledge sync settings
    this.syncSettings = {
      enabled: process.env.ANYTHINGLLM_AUTO_SYNC === 'true',
      interval: parseInt(process.env.ANYTHINGLLM_SYNC_INTERVAL || '300000'), // 5 minutes
      batchSize: parseInt(process.env.ANYTHINGLLM_BATCH_SIZE || '10')
    };

    // Initialize workspace on startup
    this.initializeWorkspace();
    
    logger.info('AnythingLLM Service initialized', {
      baseUrl: this.baseUrl,
      workspace: this.defaultWorkspace,
      autoSync: this.syncSettings.enabled
    });
  }

  /**
   * Setup axios interceptors for logging and error handling
   */
  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('AnythingLLM Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          data: config.data ? '[DATA]' : undefined
        });
        return config;
      },
      (error) => {
        logger.error('AnythingLLM Request Error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('AnythingLLM Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('AnythingLLM Response Error', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          url: error.config?.url
        });
        return Promise.reject(new ApiError(
          error.response?.status || 500,
          `AnythingLLM Error: ${error.response?.data?.message || error.message}`
        ));
      }
    );
  }

  /**
   * Initialize or ensure the default workspace exists
   */
  async initializeWorkspace() {
    try {
      await this.ensureWorkspace(this.defaultWorkspace);
      logger.info(`Workspace '${this.defaultWorkspace}' initialized`);
    } catch (error) {
      logger.error('Failed to initialize workspace', error);
    }
  }

  /**
   * Test connection to AnythingLLM instance
   */
  async testConnection() {
    try {
      const response = await this.client.get('/api/workspaces');
      logger.info('AnythingLLM connection successful', {
        workspaceCount: response.data?.workspaces?.length
      });
      return {
        connected: true,
        workspaceCount: response.data?.workspaces?.length
      };
    } catch (error) {
      logger.error('AnythingLLM connection failed', error);
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Ensure workspace exists, create if it doesn't
   */
  async ensureWorkspace(workspaceName = this.defaultWorkspace) {
    try {
      // Check if workspace exists in cache
      if (this.workspaceCache.has(workspaceName)) {
        return this.workspaceCache.get(workspaceName);
      }

      // Try to get existing workspace
      let workspace;
      try {
        const response = await this.client.get(`/api/workspace/${workspaceName}`);
        workspace = response.data.workspace;
      } catch (error) {
        // If workspace doesn't exist, create it
        if (error.response?.status === 404) {
          logger.info(`Creating workspace: ${workspaceName}`);
          const createResponse = await this.client.post('/api/workspace/new', {
            name: workspaceName,
            description: `Susan AI Knowledge Base - ${workspaceName}`,
            openAiTemp: 0.7,
            chatMode: 'chat'
          });
          workspace = createResponse.data.workspace;
        } else {
          throw error;
        }
      }

      // Cache the workspace
      this.workspaceCache.set(workspaceName, workspace);
      return workspace;
    } catch (error) {
      logger.error(`Failed to ensure workspace: ${workspaceName}`, error);
      throw new ApiError(500, `Failed to ensure workspace: ${error.message}`);
    }
  }

  /**
   * Store a document in AnythingLLM
   */
  async storeDocument(content, metadata = {}, workspaceName = this.defaultWorkspace) {
    try {
      await this.ensureWorkspace(workspaceName);

      const document = {
        content,
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'susan-ai',
          ...metadata
        }
      };

      // For now, we'll use the chat endpoint to store information as context
      // since document upload endpoint structure needs to be determined
      const response = await this.client.post(`/api/v1/workspace/${workspaceName}/chat`, {
        message: `Store this information: ${content}`,
        mode: 'chat'
      });
      
      const storedDoc = response.data;
      this.documentCache.set(storedDoc.id, storedDoc);

      logger.info('Document stored in AnythingLLM', {
        documentId: storedDoc.id,
        workspace: workspaceName,
        contentLength: content.length
      });

      this.emit('documentStored', { document: storedDoc, workspace: workspaceName });
      return storedDoc;
    } catch (error) {
      logger.error('Failed to store document', error);
      throw new ApiError(500, `Failed to store document: ${error.message}`);
    }
  }

  /**
   * Store conversation in AnythingLLM for knowledge building
   */
  async storeConversation(conversation, userId = null, workspaceName = this.defaultWorkspace) {
    try {
      const content = conversation.messages?.map(msg => 
        `${msg.role}: ${msg.content}`
      ).join('\n\n') || conversation.content;

      const metadata = {
        type: 'conversation',
        userId,
        messageCount: conversation.messages?.length || 1,
        timestamp: conversation.timestamp || new Date().toISOString(),
        ...conversation.metadata
      };

      return await this.storeDocument(content, metadata, workspaceName);
    } catch (error) {
      logger.error('Failed to store conversation', error);
      throw new ApiError(500, `Failed to store conversation: ${error.message}`);
    }
  }

  /**
   * Query AnythingLLM for relevant information
   */
  async queryKnowledge(query, options = {}, workspaceName = this.defaultWorkspace) {
    try {
      await this.ensureWorkspace(workspaceName);

      const queryParams = {
        message: query,
        mode: options.mode || 'query', // 'query' or 'chat'
        workspace: workspaceName,
        ...options
      };

      const response = await this.client.post(`/api/v1/workspace/${workspaceName}/chat`, queryParams);
      
      const result = {
        response: response.data.textResponse,
        sources: response.data.sources || [],
        relevantDocuments: response.data.documents || [],
        confidence: response.data.confidence || 0
      };

      logger.info('Knowledge query completed', {
        query: query.substring(0, 100),
        workspace: workspaceName,
        sourcesFound: result.sources.length,
        confidence: result.confidence
      });

      this.emit('knowledgeQueried', { query, result, workspace: workspaceName });
      return result;
    } catch (error) {
      logger.error('Failed to query knowledge', error);
      throw new ApiError(500, `Failed to query knowledge: ${error.message}`);
    }
  }

  /**
   * Retrieve relevant context for a given query using chat endpoint
   * Note: This reuses the chat endpoint since dedicated search endpoint is not available
   */
  async getRelevantContext(query, maxResults = 5, workspaceName = this.defaultWorkspace) {
    try {
      const response = await this.client.post(`/api/v1/workspace/${workspaceName}/chat`, {
        message: `Find relevant information about: ${query}`,
        mode: 'query'
      });

      const contexts = response.data.sources || [];
      
      logger.info('Context retrieval completed', {
        query: query.substring(0, 100),
        workspace: workspaceName,
        resultsFound: contexts.length
      });

      return contexts.slice(0, maxResults);
    } catch (error) {
      logger.error('Failed to retrieve context', error);
      // Return empty context instead of throwing error to prevent breaking the flow
      logger.warn('Returning empty context due to retrieval failure');
      return [];
    }
  }

  /**
   * Sync Susan's memory with AnythingLLM
   */
  async syncWithSusanMemory(memoryService, workspaceName = this.defaultWorkspace) {
    try {
      logger.info('Starting memory sync with AnythingLLM');

      const conversations = await memoryService.getAllConversations();
      const syncedCount = 0;

      for (const conversation of conversations) {
        try {
          await this.storeConversation(conversation, conversation.userId, workspaceName);
          syncedCount++;
        } catch (error) {
          logger.warn('Failed to sync conversation', {
            conversationId: conversation.id,
            error: error.message
          });
        }
      }

      logger.info('Memory sync completed', {
        totalConversations: conversations.length,
        syncedCount,
        workspace: workspaceName
      });

      this.emit('memorySynced', { 
        total: conversations.length, 
        synced: syncedCount, 
        workspace: workspaceName 
      });

      return { total: conversations.length, synced: syncedCount };
    } catch (error) {
      logger.error('Failed to sync memory', error);
      throw new ApiError(500, `Failed to sync memory: ${error.message}`);
    }
  }

  /**
   * Get workspace statistics
   */
  async getWorkspaceStats(workspaceName = this.defaultWorkspace) {
    try {
      const response = await this.client.get(`/api/workspace/${workspaceName}`);
      const workspace = response.data.workspace;
      return {
        documents: workspace.documents?.length || 0,
        name: workspace.name,
        slug: workspace.slug,
        lastUpdated: workspace.lastUpdatedAt
      };
    } catch (error) {
      logger.error('Failed to get workspace stats', error);
      throw new ApiError(500, `Failed to get workspace stats: ${error.message}`);
    }
  }

  /**
   * Delete a document from workspace
   */
  async deleteDocument(documentId, workspaceName = this.defaultWorkspace) {
    try {
      // Document deletion endpoint needs to be determined
      logger.warn('Document deletion not implemented - endpoint needs verification', {
        documentId,
        workspace: workspaceName
      });
      return false;
    } catch (error) {
      logger.error('Failed to delete document', error);
      throw new ApiError(500, `Failed to delete document: ${error.message}`);
    }
  }

  /**
   * Update workspace settings
   */
  async updateWorkspaceSettings(settings, workspaceName = this.defaultWorkspace) {
    try {
      // Workspace update endpoint needs to be determined
      logger.warn('Workspace settings update not implemented - endpoint needs verification', {
        workspace: workspaceName,
        settings
      });
      return {};
    } catch (error) {
      logger.error('Failed to update workspace settings', error);
      throw new ApiError(500, `Failed to update workspace settings: ${error.message}`);
    }
  }

  /**
   * Enhanced context retrieval with multiple strategies
   */
  async getEnhancedContext(query, options = {}) {
    const {
      workspaceName = this.defaultWorkspace,
      maxResults = 10,
      includeConversations = true,
      includeDocuments = true,
      timeRange = null // { start: Date, end: Date }
    } = options;

    try {
      const contexts = [];

      // Get direct relevant context
      const relevantContext = await this.getRelevantContext(query, maxResults, workspaceName);
      contexts.push(...relevantContext);

      // If we have time range, filter by it
      if (timeRange) {
        contexts = contexts.filter(ctx => {
          const ctxDate = new Date(ctx.metadata?.timestamp || ctx.timestamp);
          return ctxDate >= timeRange.start && ctxDate <= timeRange.end;
        });
      }

      // Sort by relevance/confidence
      contexts.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

      return {
        contexts: contexts.slice(0, maxResults),
        total: contexts.length,
        query
      };
    } catch (error) {
      logger.error('Failed to get enhanced context', error);
      throw new ApiError(500, `Failed to get enhanced context: ${error.message}`);
    }
  }

  /**
   * Start automatic sync if enabled
   */
  startAutoSync(memoryService) {
    if (!this.syncSettings.enabled) {
      return;
    }

    this.syncInterval = setInterval(async () => {
      try {
        await this.syncWithSusanMemory(memoryService);
      } catch (error) {
        logger.error('Auto sync failed', error);
      }
    }, this.syncSettings.interval);

    logger.info('Auto sync started', { interval: this.syncSettings.interval });
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.info('Auto sync stopped');
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.stopAutoSync();
    this.workspaceCache.clear();
    this.documentCache.clear();
    this.removeAllListeners();
  }
}

export default AnythingLLMService;