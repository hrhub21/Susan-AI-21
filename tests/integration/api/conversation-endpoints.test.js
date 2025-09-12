import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { ConversationController } from '../../../src/api/controllers/ConversationController.js';
import { ConversationService } from '../../../src/api/services/ConversationService.js';
import { AIService } from '../../../src/api/services/AIService.js';
import { testDataGenerators } from '../../utils/mocks.js';
import { auth } from '../../../src/api/middleware/auth.js';

describe('Conversation API Integration Tests', () => {
  let app;
  let server;
  let testUser;
  let authToken;
  
  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret';
    
    // Create test Express app
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware for testing
    app.use((req, res, next) => {
      req.user = testUser;
      next();
    });
    
    // Set up conversation routes
    const conversationController = new ConversationController();
    app.post('/api/v1/conversations', conversationController.createConversation.bind(conversationController));
    app.get('/api/v1/conversations/:id', conversationController.getConversation.bind(conversationController));
    app.get('/api/v1/conversations', conversationController.listConversations.bind(conversationController));
    app.post('/api/v1/conversations/:id/messages', conversationController.addMessage.bind(conversationController));
    app.put('/api/v1/conversations/:id', conversationController.updateConversation.bind(conversationController));
    app.delete('/api/v1/conversations/:id', conversationController.deleteConversation.bind(conversationController));
    
    // Start test server
    server = app.listen(0); // Use random available port
  });
  
  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });
  
  beforeEach(() => {
    testUser = testDataGenerators.user();
    authToken = 'test-jwt-token';
  });
  
  afterEach(async () => {
    // Clean up test data
    await global.testHelpers.cleanupTestData();
  });

  describe('POST /api/v1/conversations', () => {
    test('should create new conversation with valid data', async () => {
      const conversationData = {
        title: 'Test Conversation',
        initialMessage: 'Hello, Susan!'
      };
      
      const response = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(conversationData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.conversation).toBeDefined();
      expect(response.body.data.conversation.title).toBe(conversationData.title);
      expect(response.body.data.conversation.id).toMatch(/^conv_/);
      expect(response.body.data.conversation.userId).toBe(testUser.id);
    });

    test('should validate required fields', async () => {
      const invalidData = {
        // Missing title
        initialMessage: 'Hello'
      };
      
      const response = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('title');
    });

    test('should handle empty initial message', async () => {
      const conversationData = {
        title: 'Test Conversation',
        initialMessage: ''
      };
      
      const response = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(conversationData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('initial message');
    });
  });

  describe('GET /api/v1/conversations/:id', () => {
    let testConversation;
    
    beforeEach(async () => {
      // Create test conversation
      const response = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Conversation',
          initialMessage: 'Hello'
        });
      
      testConversation = response.body.data.conversation;
    });

    test('should retrieve conversation by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testConversation.id);
      expect(response.body.data.title).toBe(testConversation.title);
    });

    test('should return 404 for non-existent conversation', async () => {
      const response = await request(app)
        .get('/api/v1/conversations/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('not found');
    });

    test('should not allow access to other users conversations', async () => {
      // Change user context
      testUser = testDataGenerators.user({ id: 'different-user' });
      
      const response = await request(app)
        .get(`/api/v1/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('access denied');
    });
  });

  describe('GET /api/v1/conversations', () => {
    beforeEach(async () => {
      // Create multiple test conversations
      await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Conversation 1', initialMessage: 'Hello 1' });
      
      await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Conversation 2', initialMessage: 'Hello 2' });
    });

    test('should list user conversations', async () => {
      const response = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.conversations).toHaveLength(2);
      expect(response.body.data.conversations[0].userId).toBe(testUser.id);
    });

    test('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/conversations?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.conversations).toHaveLength(1);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(1);
    });

    test('should support search filtering', async () => {
      const response = await request(app)
        .get('/api/v1/conversations?search=Conversation%201')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.conversations).toHaveLength(1);
      expect(response.body.data.conversations[0].title).toContain('Conversation 1');
    });
  });

  describe('POST /api/v1/conversations/:id/messages', () => {
    let testConversation;
    
    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Conversation',
          initialMessage: 'Hello'
        });
      
      testConversation = response.body.data.conversation;
    });

    test('should add message to conversation', async () => {
      const messageData = {
        content: 'What is artificial intelligence?'
      };
      
      const response = await request(app)
        .post(`/api/v1/conversations/${testConversation.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.userMessage).toBeDefined();
      expect(response.body.data.assistantMessage).toBeDefined();
      expect(response.body.data.userMessage.content).toBe(messageData.content);
    });

    test('should validate message content', async () => {
      const invalidMessageData = {
        content: ''
      };
      
      const response = await request(app)
        .post(`/api/v1/conversations/${testConversation.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidMessageData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('content');
    });

    test('should handle AI service integration', async () => {
      const messageData = {
        content: 'Tell me about machine learning'
      };
      
      const response = await request(app)
        .post(`/api/v1/conversations/${testConversation.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData)
        .expect(200);
      
      expect(response.body.data.assistantMessage).toBeDefined();
      expect(response.body.data.assistantMessage.role).toBe('assistant');
      expect(response.body.data.assistantMessage.content).toBeTruthy();
    });
  });

  describe('PUT /api/v1/conversations/:id', () => {
    let testConversation;
    
    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Original Title',
          initialMessage: 'Hello'
        });
      
      testConversation = response.body.data.conversation;
    });

    test('should update conversation title', async () => {
      const updateData = {
        title: 'Updated Title'
      };
      
      const response = await request(app)
        .put(`/api/v1/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title');
      expect(response.body.data.updatedAt).not.toBe(testConversation.updatedAt);
    });

    test('should update conversation metadata', async () => {
      const updateData = {
        metadata: {
          tags: ['AI', 'Machine Learning'],
          priority: 'high'
        }
      };
      
      const response = await request(app)
        .put(`/api/v1/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.metadata.tags).toEqual(['AI', 'Machine Learning']);
      expect(response.body.data.metadata.priority).toBe('high');
    });
  });

  describe('DELETE /api/v1/conversations/:id', () => {
    let testConversation;
    
    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Conversation',
          initialMessage: 'Hello'
        });
      
      testConversation = response.body.data.conversation;
    });

    test('should delete conversation', async () => {
      const response = await request(app)
        .delete(`/api/v1/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('deleted');
      
      // Verify conversation is deleted
      await request(app)
        .get(`/api/v1/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    test('should not delete other users conversations', async () => {
      // Change user context
      testUser = testDataGenerators.user({ id: 'different-user' });
      
      const response = await request(app)
        .delete(`/api/v1/conversations/${testConversation.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('access denied');
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits on conversation creation', async () => {
      const conversationData = {
        title: 'Rate Limit Test',
        initialMessage: 'Hello'
      };
      
      // Make multiple rapid requests
      const requests = [];
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .post('/api/v1/conversations')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ ...conversationData, title: `${conversationData.title} ${i}` })
        );
      }
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.some(res => res.status === 429);
      
      expect(rateLimited).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json')
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid JSON');
    });

    test('should handle missing authentication', async () => {
      // Override the test middleware to simulate missing auth
      const appWithoutAuth = express();
      appWithoutAuth.use(express.json());
      
      // Add auth middleware that rejects
      appWithoutAuth.use((req, res, next) => {
        res.status(401).json({
          success: false,
          error: { message: 'Authentication required' }
        });
      });
      
      const conversationController = new ConversationController();
      appWithoutAuth.post('/api/v1/conversations', conversationController.createConversation.bind(conversationController));
      
      const response = await request(appWithoutAuth)
        .post('/api/v1/conversations')
        .send({ title: 'Test', initialMessage: 'Hello' })
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Authentication');
    });
  });

  describe('Content Validation', () => {
    test('should sanitize conversation titles', async () => {
      const conversationData = {
        title: '<script>alert("xss")</script>Dangerous Title',
        initialMessage: 'Hello'
      };
      
      const response = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send(conversationData)
        .expect(201);
      
      expect(response.body.data.conversation.title).not.toContain('<script>');
      expect(response.body.data.conversation.title).toContain('Dangerous Title');
    });

    test('should sanitize message content', async () => {
      const conversationResponse = await request(app)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Test', initialMessage: 'Hello' });
      
      const messageData = {
        content: '<script>alert("xss")</script>What is AI?'
      };
      
      const response = await request(app)
        .post(`/api/v1/conversations/${conversationResponse.body.data.conversation.id}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(messageData)
        .expect(200);
      
      expect(response.body.data.userMessage.content).not.toContain('<script>');
      expect(response.body.data.userMessage.content).toContain('What is AI?');
    });
  });
});
