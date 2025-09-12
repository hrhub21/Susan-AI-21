import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConversationService } from '../../../src/api/services/ConversationService.js';
import { mockFS, resetAllMocks, testDataGenerators } from '../../utils/mocks.js';
import fs from 'fs-extra';
import path from 'path';

// Mock the fs-extra module
jest.unstable_mockModule('fs-extra', () => mockFS);

describe('ConversationService', () => {
  let conversationService;
  
  beforeEach(() => {
    resetAllMocks();
    conversationService = new ConversationService();
  });
  
  afterEach(() => {
    resetAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with proper configuration', () => {
      expect(conversationService).toBeDefined();
      expect(conversationService.dataDir).toContain('conversations');
    });

    test('should ensure data directory exists', async () => {
      await conversationService.ensureDataDirectory();
      expect(mockFS.ensureDir).toHaveBeenCalledWith(conversationService.dataDir);
    });
  });

  describe('ID Generation', () => {
    test('should generate unique conversation IDs', () => {
      const id1 = conversationService.generateId();
      const id2 = conversationService.generateId();
      
      expect(id1).toMatch(/^conv_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^conv_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    test('should generate unique message IDs', () => {
      const id1 = conversationService.generateMessageId();
      const id2 = conversationService.generateMessageId();
      
      expect(id1).toMatch(/^msg_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^msg_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Conversation Creation', () => {
    test('should create conversation with valid data', async () => {
      const conversationData = {
        userId: 'user-123',
        title: 'Test Conversation',
        metadata: { topic: 'AI Discussion' }
      };
      
      mockFS.writeJson.mockResolvedValueOnce(true);
      
      const conversation = await conversationService.createConversation(conversationData);
      
      expect(conversation).toBeDefined();
      expect(conversation.id).toMatch(/^conv_/);
      expect(conversation.userId).toBe('user-123');
      expect(conversation.title).toBe('Test Conversation');
      expect(conversation.messages).toEqual([]);
      expect(conversation.metadata).toEqual({ topic: 'AI Discussion' });
      expect(conversation.messageCount).toBe(0);
      expect(conversation.createdAt).toBeDefined();
      expect(conversation.updatedAt).toBeDefined();
    });

    test('should save conversation to filesystem', async () => {
      const conversationData = {
        userId: 'user-123',
        title: 'Test Conversation'
      };
      
      mockFS.writeJson.mockResolvedValueOnce(true);
      
      await conversationService.createConversation(conversationData);
      
      expect(mockFS.writeJson).toHaveBeenCalledTimes(1);
    });
  });

  describe('Message Management', () => {
    test('should add message to conversation', async () => {
      const conversation = testDataGenerators.conversation();
      const messageData = {
        role: 'user',
        content: 'Hello, Susan!',
        metadata: { timestamp: Date.now() }
      };
      
      mockFS.readJson.mockResolvedValueOnce(conversation);
      mockFS.writeJson.mockResolvedValueOnce(true);
      
      const updatedConversation = await conversationService.addMessage(
        conversation.id,
        messageData
      );
      
      expect(updatedConversation.messages).toHaveLength(1);
      expect(updatedConversation.messages[0].content).toBe('Hello, Susan!');
      expect(updatedConversation.messages[0].id).toMatch(/^msg_/);
      expect(updatedConversation.messageCount).toBe(1);
    });

    test('should validate message role', async () => {
      const conversation = testDataGenerators.conversation();
      const invalidMessageData = {
        role: 'invalid',
        content: 'Test message'
      };
      
      mockFS.readJson.mockResolvedValueOnce(conversation);
      
      await expect(
        conversationService.addMessage(conversation.id, invalidMessageData)
      ).rejects.toThrow('Invalid message role');
    });

    test('should validate message content', async () => {
      const conversation = testDataGenerators.conversation();
      const emptyMessageData = {
        role: 'user',
        content: ''
      };
      
      mockFS.readJson.mockResolvedValueOnce(conversation);
      
      await expect(
        conversationService.addMessage(conversation.id, emptyMessageData)
      ).rejects.toThrow('Message content cannot be empty');
    });
  });

  describe('Conversation Retrieval', () => {
    test('should get conversation by ID', async () => {
      const conversation = testDataGenerators.conversation();
      
      mockFS.readJson.mockResolvedValueOnce(conversation);
      
      const retrieved = await conversationService.getConversation(conversation.id);
      
      expect(retrieved).toEqual(conversation);
      expect(mockFS.readJson).toHaveBeenCalledWith(
        path.join(conversationService.dataDir, `${conversation.id}.json`)
      );
    });

    test('should throw error for non-existent conversation', async () => {
      mockFS.readJson.mockRejectedValueOnce(new Error('File not found'));
      
      await expect(
        conversationService.getConversation('non-existent-id')
      ).rejects.toThrow('Conversation not found');
    });

    test('should list conversations for user', async () => {
      const conversations = [
        testDataGenerators.conversation({ userId: 'user-123' }),
        testDataGenerators.conversation({ userId: 'user-123' }),
        testDataGenerators.conversation({ userId: 'user-456' })
      ];
      
      mockFS.readdir.mockResolvedValueOnce([
        'conv-1.json',
        'conv-2.json',
        'conv-3.json'
      ]);
      
      mockFS.readJson
        .mockResolvedValueOnce(conversations[0])
        .mockResolvedValueOnce(conversations[1])
        .mockResolvedValueOnce(conversations[2]);
      
      const userConversations = await conversationService.listConversations('user-123');
      
      expect(userConversations).toHaveLength(2);
      expect(userConversations.every(conv => conv.userId === 'user-123')).toBe(true);
    });
  });

  describe('Conversation Updates', () => {
    test('should update conversation title', async () => {
      const conversation = testDataGenerators.conversation();
      const updates = { title: 'Updated Title' };
      
      mockFS.readJson.mockResolvedValueOnce(conversation);
      mockFS.writeJson.mockResolvedValueOnce(true);
      
      const updated = await conversationService.updateConversation(
        conversation.id,
        updates
      );
      
      expect(updated.title).toBe('Updated Title');
      expect(updated.updatedAt).not.toBe(conversation.updatedAt);
    });

    test('should update conversation metadata', async () => {
      const conversation = testDataGenerators.conversation();
      const updates = {
        metadata: { ...conversation.metadata, newField: 'newValue' }
      };
      
      mockFS.readJson.mockResolvedValueOnce(conversation);
      mockFS.writeJson.mockResolvedValueOnce(true);
      
      const updated = await conversationService.updateConversation(
        conversation.id,
        updates
      );
      
      expect(updated.metadata.newField).toBe('newValue');
    });
  });

  describe('Conversation Deletion', () => {
    test('should delete conversation', async () => {
      const conversationId = 'conv-123';
      
      mockFS.remove.mockResolvedValueOnce(true);
      
      await conversationService.deleteConversation(conversationId);
      
      expect(mockFS.remove).toHaveBeenCalledWith(
        path.join(conversationService.dataDir, `${conversationId}.json`)
      );
    });

    test('should handle deletion of non-existent conversation', async () => {
      mockFS.remove.mockRejectedValueOnce(new Error('File not found'));
      
      await expect(
        conversationService.deleteConversation('non-existent-id')
      ).rejects.toThrow('Conversation not found');
    });
  });

  describe('Search and Filter', () => {
    test('should search conversations by content', async () => {
      const conversations = [
        testDataGenerators.conversation({
          title: 'AI Discussion',
          messages: [
            { role: 'user', content: 'Tell me about machine learning' }
          ]
        }),
        testDataGenerators.conversation({
          title: 'Weather Chat',
          messages: [
            { role: 'user', content: 'What is the weather today?' }
          ]
        })
      ];
      
      mockFS.readdir.mockResolvedValueOnce(['conv-1.json', 'conv-2.json']);
      mockFS.readJson
        .mockResolvedValueOnce(conversations[0])
        .mockResolvedValueOnce(conversations[1]);
      
      const results = await conversationService.searchConversations(
        'user-123',
        'machine learning'
      );
      
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('AI Discussion');
    });

    test('should filter conversations by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const conversations = [
        testDataGenerators.conversation({ createdAt: now.toISOString() }),
        testDataGenerators.conversation({ createdAt: yesterday.toISOString() }),
        testDataGenerators.conversation({ createdAt: lastWeek.toISOString() })
      ];
      
      mockFS.readdir.mockResolvedValueOnce([
        'conv-1.json',
        'conv-2.json',
        'conv-3.json'
      ]);
      
      mockFS.readJson
        .mockResolvedValueOnce(conversations[0])
        .mockResolvedValueOnce(conversations[1])
        .mockResolvedValueOnce(conversations[2]);
      
      const results = await conversationService.filterConversationsByDate(
        'user-123',
        yesterday,
        now
      );
      
      expect(results).toHaveLength(2);
    });
  });

  describe('Analytics', () => {
    test('should get conversation statistics', async () => {
      const conversations = [
        testDataGenerators.conversation({
          messageCount: 5,
          createdAt: new Date().toISOString()
        }),
        testDataGenerators.conversation({
          messageCount: 10,
          createdAt: new Date().toISOString()
        })
      ];
      
      mockFS.readdir.mockResolvedValueOnce(['conv-1.json', 'conv-2.json']);
      mockFS.readJson
        .mockResolvedValueOnce(conversations[0])
        .mockResolvedValueOnce(conversations[1]);
      
      const stats = await conversationService.getConversationStats('user-123');
      
      expect(stats.totalConversations).toBe(2);
      expect(stats.totalMessages).toBe(15);
      expect(stats.averageMessagesPerConversation).toBe(7.5);
    });
  });

  describe('Error Handling', () => {
    test('should handle filesystem errors gracefully', async () => {
      mockFS.writeJson.mockRejectedValueOnce(new Error('Disk full'));
      
      await expect(
        conversationService.createConversation({
          userId: 'user-123',
          title: 'Test'
        })
      ).rejects.toThrow('Failed to save conversation');
    });

    test('should handle invalid JSON data', async () => {
      mockFS.readJson.mockRejectedValueOnce(new Error('Invalid JSON'));
      
      await expect(
        conversationService.getConversation('invalid-conv')
      ).rejects.toThrow('Failed to read conversation');
    });
  });
});
