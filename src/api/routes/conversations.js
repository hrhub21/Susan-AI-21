import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateJsonSchema, validateQueryParams, validateParams, schemas } from '../middleware/validation.js';
import { aiModelRateLimit, moderateRateLimit } from '../middleware/rateLimit.js';
import { sseMiddleware, requestIdMiddleware } from '../middleware/streaming.js';
import { ConversationController } from '../controllers/ConversationController.js';

const router = express.Router();
const conversationController = new ConversationController();

// Apply request ID middleware to all routes
router.use(requestIdMiddleware);

// List conversations with pagination and search
router.get('/',
  moderateRateLimit,
  validateQueryParams(schemas.pagination),
  asyncHandler(conversationController.listConversations.bind(conversationController))
);

// Create new conversation
router.post('/',
  moderateRateLimit,
  validateJsonSchema(schemas.createConversation),
  asyncHandler(conversationController.createConversation.bind(conversationController))
);

// Get specific conversation
router.get('/:conversationId',
  moderateRateLimit,
  validateParams(schemas.uuid),
  asyncHandler(conversationController.getConversation.bind(conversationController))
);

// Update conversation metadata
router.put('/:conversationId',
  moderateRateLimit,
  validateParams(schemas.uuid),
  validateJsonSchema({
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 200 },
      metadata: { type: 'object' }
    },
    additionalProperties: false
  }),
  asyncHandler(conversationController.updateConversation.bind(conversationController))
);

// Delete conversation
router.delete('/:conversationId',
  moderateRateLimit,
  validateParams(schemas.uuid),
  asyncHandler(conversationController.deleteConversation.bind(conversationController))
);

// Send message and get response
router.post('/:conversationId/messages',
  aiModelRateLimit,
  validateParams(schemas.uuid),
  validateJsonSchema(schemas.sendMessage),
  asyncHandler(conversationController.sendMessage.bind(conversationController))
);

// Stream message response with SSE
router.post('/:conversationId/messages/stream',
  requestIdMiddleware,
  aiModelRateLimit,
  validateParams(schemas.uuid),
  validateJsonSchema(schemas.sendMessage),
  sseMiddleware,
  asyncHandler(conversationController.streamMessage.bind(conversationController))
);

// Cancel streaming response
router.delete('/:conversationId/messages/stream/:streamId',
  moderateRateLimit,
  validateParams({
    type: 'object',
    properties: {
      conversationId: schemas.uuid.properties.conversationId,
      streamId: { type: 'string', pattern: '^stream_[0-9]+_[a-z0-9]+$' }
    },
    required: ['conversationId', 'streamId']
  }),
  asyncHandler(conversationController.cancelStream.bind(conversationController))
);

// Get active streams for conversation
router.get('/:conversationId/streams',
  moderateRateLimit,
  validateParams(schemas.uuid),
  asyncHandler(conversationController.getActiveStreams.bind(conversationController))
);

// Get conversation messages with pagination
router.get('/:conversationId/messages',
  moderateRateLimit,
  validateParams(schemas.uuid),
  validateQueryParams(schemas.pagination),
  asyncHandler(conversationController.getMessages.bind(conversationController))
);

// Get conversation context for AI
router.get('/:conversationId/context',
  moderateRateLimit,
  validateParams(schemas.uuid),
  validateQueryParams({
    type: 'object',
    properties: {
      depth: { type: 'string', pattern: '^([1-9]|[1-4][0-9]|50)$' }
    }
  }),
  asyncHandler(conversationController.getContext.bind(conversationController))
);

// Get conversation statistics
router.get('/:conversationId/stats',
  moderateRateLimit,
  validateParams(schemas.uuid),
  asyncHandler(conversationController.getStats.bind(conversationController))
);

// Export conversation (enhanced format)
router.get('/:conversationId/export',
  moderateRateLimit,
  validateParams(schemas.uuid),
  validateQueryParams({
    type: 'object',
    properties: {
      format: { type: 'string', enum: ['json', 'markdown', 'txt', 'csv'] },
      includeMetadata: { type: 'string', enum: ['true', 'false'] }
    }
  }),
  asyncHandler(conversationController.exportConversation.bind(conversationController))
);

// Share conversation (generate shareable link)
router.post('/:conversationId/share',
  moderateRateLimit,
  validateParams(schemas.uuid),
  validateJsonSchema({
    type: 'object',
    properties: {
      expiresIn: { type: 'string', enum: ['1h', '24h', '7d', '30d', 'never'] },
      permissions: { 
        type: 'array', 
        items: { type: 'string', enum: ['read', 'comment'] },
        default: ['read']
      },
      password: { type: 'string', minLength: 8 }
    }
  }),
  asyncHandler(conversationController.shareConversation.bind(conversationController))
);

// Collaborative features
router.post('/:conversationId/collaborate',
  moderateRateLimit,
  validateParams(schemas.uuid),
  validateJsonSchema({
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['start', 'join', 'leave'] },
      features: {
        type: 'object',
        properties: {
          sharedCursor: { type: 'boolean', default: false },
          voiceChat: { type: 'boolean', default: false },
          screenShare: { type: 'boolean', default: false }
        }
      }
    },
    required: ['action']
  }),
  asyncHandler(conversationController.collaborateConversation.bind(conversationController))
);

export default router;