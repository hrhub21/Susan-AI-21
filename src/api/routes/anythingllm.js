import express from 'express';
import { AnythingLLMService } from '../services/AnythingLLMService.js';
import { MemoryService } from '../services/MemoryService.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

const router = express.Router();

// Initialize services
let anythingLLMService, memoryService;

async function initializeServices() {
  try {
    anythingLLMService = new AnythingLLMService();
    memoryService = new MemoryService();
    
    logger.info('AnythingLLM API services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize AnythingLLM services', { error: error.message });
    throw error;
  }
}

// Initialize services on module load
initializeServices().catch(console.error);

/**
 * @swagger
 * /api/anythingllm/status:
 *   get:
 *     summary: Check AnythingLLM connection status
 *     tags: [AnythingLLM]
 *     responses:
 *       200:
 *         description: Connection status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connected:
 *                   type: boolean
 *                 version:
 *                   type: string
 *                 status:
 *                   type: string
 *                 error:
 *                   type: string
 */
router.get('/status', async (req, res, next) => {
  try {
    const status = await anythingLLMService.testConnection();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(new ApiError(500, `Failed to check AnythingLLM status: ${error.message}`));
  }
});

/**
 * @swagger
 * /api/anythingllm/workspace:
 *   get:
 *     summary: Get current workspace information
 *     tags: [AnythingLLM]
 *     responses:
 *       200:
 *         description: Workspace information retrieved successfully
 */
router.get('/workspace', async (req, res, next) => {
  try {
    const workspace = await anythingLLMService.ensureWorkspace();
    res.json({
      success: true,
      data: workspace
    });
  } catch (error) {
    next(new ApiError(500, `Failed to get workspace: ${error.message}`));
  }
});

/**
 * @swagger
 * /api/anythingllm/workspace/stats:
 *   get:
 *     summary: Get workspace statistics
 *     tags: [AnythingLLM]
 *     responses:
 *       200:
 *         description: Workspace statistics retrieved successfully
 */
router.get('/workspace/stats', async (req, res, next) => {
  try {
    const stats = await anythingLLMService.getWorkspaceStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(new ApiError(500, `Failed to get workspace stats: ${error.message}`));
  }
});

/**
 * @swagger
 * /api/anythingllm/documents:
 *   post:
 *     summary: Store a document in AnythingLLM
 *     tags: [AnythingLLM]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Document content to store
 *               metadata:
 *                 type: object
 *                 description: Additional metadata for the document
 *               workspace:
 *                 type: string
 *                 description: Workspace name (optional)
 *     responses:
 *       201:
 *         description: Document stored successfully
 */
router.post('/documents', async (req, res, next) => {
  try {
    const { content, metadata = {}, workspace } = req.body;
    
    if (!content) {
      return next(new ApiError(400, 'Content is required'));
    }
    
    const document = await anythingLLMService.storeDocument(content, metadata, workspace);
    
    logger.info('Document stored via API', {
      documentId: document.id,
      workspace: workspace || 'default',
      userId: req.user?.id
    });
    
    res.status(201).json({
      success: true,
      data: document
    });
  } catch (error) {
    next(new ApiError(500, `Failed to store document: ${error.message}`));
  }
});

/**
 * @swagger
 * /api/anythingllm/conversations:
 *   post:
 *     summary: Store a conversation in AnythingLLM
 *     tags: [AnythingLLM]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conversation
 *             properties:
 *               conversation:
 *                 type: object
 *                 description: Conversation object to store
 *               userId:
 *                 type: string
 *                 description: User ID associated with the conversation
 *               workspace:
 *                 type: string
 *                 description: Workspace name (optional)
 *     responses:
 *       201:
 *         description: Conversation stored successfully
 */
router.post('/conversations', async (req, res, next) => {
  try {
    const { conversation, userId, workspace } = req.body;
    
    if (!conversation) {
      return next(new ApiError(400, 'Conversation is required'));
    }
    
    const storedConversation = await anythingLLMService.storeConversation(
      conversation, 
      userId || req.user?.id, 
      workspace
    );
    
    logger.info('Conversation stored via API', {
      conversationId: storedConversation.id,
      workspace: workspace || 'default',
      userId: userId || req.user?.id
    });
    
    res.status(201).json({
      success: true,
      data: storedConversation
    });
  } catch (error) {
    next(new ApiError(500, `Failed to store conversation: ${error.message}`));
  }
});

/**
 * @swagger
 * /api/anythingllm/query:
 *   post:
 *     summary: Query the AnythingLLM knowledge base
 *     tags: [AnythingLLM]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: Query string to search for
 *               options:
 *                 type: object
 *                 description: Query options
 *               workspace:
 *                 type: string
 *                 description: Workspace name (optional)
 *     responses:
 *       200:
 *         description: Query results retrieved successfully
 */
router.post('/query', async (req, res, next) => {
  try {
    const { query, options = {}, workspace } = req.body;
    
    if (!query) {
      return next(new ApiError(400, 'Query is required'));
    }
    
    const result = await anythingLLMService.queryKnowledge(query, options, workspace);
    
    logger.info('Knowledge query via API', {
      query: query.substring(0, 100),
      workspace: workspace || 'default',
      sourcesFound: result.sources?.length || 0,
      userId: req.user?.id
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(new ApiError(500, `Failed to query knowledge: ${error.message}`));
  }
});

/**
 * @swagger
 * /api/anythingllm/context:
 *   post:
 *     summary: Get relevant context for a query
 *     tags: [AnythingLLM]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: Query string to find context for
 *               maxResults:
 *                 type: integer
 *                 description: Maximum number of context results
 *                 default: 5
 *               workspace:
 *                 type: string
 *                 description: Workspace name (optional)
 *     responses:
 *       200:
 *         description: Context retrieved successfully
 */
router.post('/context', async (req, res, next) => {
  try {
    const { query, maxResults = 5, workspace } = req.body;
    
    if (!query) {
      return next(new ApiError(400, 'Query is required'));
    }
    
    const contexts = await anythingLLMService.getRelevantContext(query, maxResults, workspace);
    
    logger.info('Context retrieval via API', {
      query: query.substring(0, 100),
      workspace: workspace || 'default',
      resultsFound: contexts.length,
      userId: req.user?.id
    });
    
    res.json({
      success: true,
      data: contexts
    });
  } catch (error) {
    next(new ApiError(500, `Failed to get context: ${error.message}`));
  }
});

/**
 * @swagger
 * /api/anythingllm/sync:
 *   post:
 *     summary: Manually sync Susan's memory with AnythingLLM
 *     tags: [AnythingLLM]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               workspace:
 *                 type: string
 *                 description: Workspace name (optional)
 *     responses:
 *       200:
 *         description: Sync completed successfully
 */
router.post('/sync', async (req, res, next) => {
  try {
    const { workspace } = req.body;
    
    const syncResult = await anythingLLMService.syncWithSusanMemory(memoryService, workspace);
    
    logger.info('Manual memory sync via API', {
      workspace: workspace || 'default',
      totalConversations: syncResult.total,
      syncedCount: syncResult.synced,
      userId: req.user?.id
    });
    
    res.json({
      success: true,
      data: syncResult,
      message: `Synced ${syncResult.synced} out of ${syncResult.total} conversations`
    });
  } catch (error) {
    next(new ApiError(500, `Failed to sync memory: ${error.message}`));
  }
});

/**
 * @swagger
 * /api/anythingllm/documents/{documentId}:
 *   delete:
 *     summary: Delete a document from AnythingLLM
 *     tags: [AnythingLLM]
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID to delete
 *       - in: query
 *         name: workspace
 *         schema:
 *           type: string
 *         description: Workspace name (optional)
 *     responses:
 *       200:
 *         description: Document deleted successfully
 */
router.delete('/documents/:documentId', async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const { workspace } = req.query;
    
    const result = await anythingLLMService.deleteDocument(documentId, workspace);
    
    logger.info('Document deleted via API', {
      documentId,
      workspace: workspace || 'default',
      userId: req.user?.id
    });
    
    res.json({
      success: true,
      data: { deleted: result },
      message: 'Document deleted successfully'
    });
  } catch (error) {
    next(new ApiError(500, `Failed to delete document: ${error.message}`));
  }
});

/**
 * @swagger
 * /api/anythingllm/workspace/settings:
 *   put:
 *     summary: Update workspace settings
 *     tags: [AnythingLLM]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settings:
 *                 type: object
 *                 description: Workspace settings to update
 *               workspace:
 *                 type: string
 *                 description: Workspace name (optional)
 *     responses:
 *       200:
 *         description: Workspace settings updated successfully
 */
router.put('/workspace/settings', async (req, res, next) => {
  try {
    const { settings, workspace } = req.body;
    
    if (!settings) {
      return next(new ApiError(400, 'Settings are required'));
    }
    
    const updatedWorkspace = await anythingLLMService.updateWorkspaceSettings(settings, workspace);
    
    logger.info('Workspace settings updated via API', {
      workspace: workspace || 'default',
      userId: req.user?.id
    });
    
    res.json({
      success: true,
      data: updatedWorkspace,
      message: 'Workspace settings updated successfully'
    });
  } catch (error) {
    next(new ApiError(500, `Failed to update workspace settings: ${error.message}`));
  }
});

export default router;