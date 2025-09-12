import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { VectorMemoryService } from '../../../src/api/services/VectorMemoryService.js';
import { testDataGenerators, resetAllMocks } from '../../utils/mocks.js';

describe('VectorMemoryService', () => {
  let vectorMemoryService;
  
  beforeEach(() => {
    resetAllMocks();
    vectorMemoryService = new VectorMemoryService();
  });
  
  afterEach(() => {
    resetAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with proper configuration', () => {
      expect(vectorMemoryService).toBeDefined();
      expect(vectorMemoryService.embeddings).toBeDefined();
      expect(vectorMemoryService.vectorStore).toBeDefined();
    });

    test('should handle missing configuration gracefully', () => {
      const serviceWithoutConfig = new VectorMemoryService({});
      expect(serviceWithoutConfig).toBeDefined();
    });
  });

  describe('Vector Operations', () => {
    test('should generate embeddings for text', async () => {
      const text = 'This is a test message about artificial intelligence';
      
      const embedding = await vectorMemoryService.generateEmbedding(text);
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
      expect(embedding.every(val => typeof val === 'number')).toBe(true);
    });

    test('should handle empty text input', async () => {
      await expect(
        vectorMemoryService.generateEmbedding('')
      ).rejects.toThrow('Text cannot be empty');
    });

    test('should handle very long text input', async () => {
      const longText = 'A'.repeat(10000);
      
      const embedding = await vectorMemoryService.generateEmbedding(longText);
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
    });
  });

  describe('Memory Storage', () => {
    test('should store memory with vector embedding', async () => {
      const memoryData = {
        content: 'User prefers coffee over tea',
        context: 'preference',
        userId: 'test-user-123'
      };
      
      const result = await vectorMemoryService.storeMemory(memoryData);
      
      expect(result).toBeDefined();
      expect(result.id).toBeTruthy();
      expect(result.embedding).toBeDefined();
      expect(result.content).toBe(memoryData.content);
    });

    test('should validate required fields for memory storage', async () => {
      const invalidMemory = {
        content: 'Test content'
        // Missing userId
      };
      
      await expect(
        vectorMemoryService.storeMemory(invalidMemory)
      ).rejects.toThrow('userId is required');
    });

    test('should handle duplicate memory content', async () => {
      const memoryData = {
        content: 'Duplicate content test',
        context: 'test',
        userId: 'test-user-123'
      };
      
      // Store the same memory twice
      await vectorMemoryService.storeMemory(memoryData);
      const result = await vectorMemoryService.storeMemory(memoryData);
      
      // Should handle gracefully, possibly updating or returning existing
      expect(result).toBeDefined();
    });
  });

  describe('Similarity Search', () => {
    test('should find similar memories by content', async () => {
      // Store test memories
      await vectorMemoryService.storeMemory({
        content: 'User loves pizza',
        context: 'food',
        userId: 'test-user-123'
      });
      
      await vectorMemoryService.storeMemory({
        content: 'User enjoys Italian cuisine',
        context: 'food',
        userId: 'test-user-123'
      });
      
      await vectorMemoryService.storeMemory({
        content: 'User prefers morning meetings',
        context: 'schedule',
        userId: 'test-user-123'
      });
      
      const results = await vectorMemoryService.searchSimilar(
        'food preferences and pizza',
        'test-user-123',
        { limit: 5, threshold: 0.7 }
      );
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].similarity).toBeGreaterThan(0.7);
      expect(results[0].content).toContain('pizza');
    });

    test('should respect similarity threshold', async () => {
      await vectorMemoryService.storeMemory({
        content: 'Completely unrelated content about space exploration',
        context: 'science',
        userId: 'test-user-123'
      });
      
      const results = await vectorMemoryService.searchSimilar(
        'food and cooking',
        'test-user-123',
        { limit: 5, threshold: 0.9 }
      );
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // Should return empty or very few results due to high threshold
    });

    test('should limit results correctly', async () => {
      // Store multiple memories
      for (let i = 0; i < 10; i++) {
        await vectorMemoryService.storeMemory({
          content: `Test memory content number ${i}`,
          context: 'test',
          userId: 'test-user-123'
        });
      }
      
      const results = await vectorMemoryService.searchSimilar(
        'test memory content',
        'test-user-123',
        { limit: 3 }
      );
      
      expect(results.length).toBeLessThanOrEqual(3);
    });

    test('should filter by user ID', async () => {
      await vectorMemoryService.storeMemory({
        content: 'User A memory',
        context: 'test',
        userId: 'user-a'
      });
      
      await vectorMemoryService.storeMemory({
        content: 'User B memory',
        context: 'test',
        userId: 'user-b'
      });
      
      const results = await vectorMemoryService.searchSimilar(
        'memory',
        'user-a',
        { limit: 10 }
      );
      
      expect(results.every(result => result.userId === 'user-a')).toBe(true);
    });
  });

  describe('Memory Management', () => {
    test('should update existing memory', async () => {
      const memory = await vectorMemoryService.storeMemory({
        content: 'Original content',
        context: 'test',
        userId: 'test-user-123'
      });
      
      const updated = await vectorMemoryService.updateMemory(memory.id, {
        content: 'Updated content',
        context: 'updated'
      });
      
      expect(updated.id).toBe(memory.id);
      expect(updated.content).toBe('Updated content');
      expect(updated.context).toBe('updated');
      expect(updated.embedding).toBeDefined();
      expect(updated.embedding).not.toEqual(memory.embedding);
    });

    test('should delete memory by ID', async () => {
      const memory = await vectorMemoryService.storeMemory({
        content: 'To be deleted',
        context: 'test',
        userId: 'test-user-123'
      });
      
      const result = await vectorMemoryService.deleteMemory(memory.id);
      
      expect(result).toBe(true);
      
      // Verify it's deleted
      await expect(
        vectorMemoryService.getMemory(memory.id)
      ).rejects.toThrow('Memory not found');
    });

    test('should get memory statistics', async () => {
      // Store multiple memories for different users
      for (let i = 0; i < 5; i++) {
        await vectorMemoryService.storeMemory({
          content: `Memory ${i}`,
          context: 'test',
          userId: 'test-user-123'
        });
      }
      
      const stats = await vectorMemoryService.getMemoryStats('test-user-123');
      
      expect(stats).toBeDefined();
      expect(stats.totalMemories).toBeGreaterThanOrEqual(5);
      expect(stats.contexts).toBeDefined();
      expect(stats.averageContentLength).toBeGreaterThan(0);
    });
  });

  describe('Batch Operations', () => {
    test('should store multiple memories in batch', async () => {
      const memories = [
        { content: 'Batch memory 1', context: 'batch', userId: 'test-user-123' },
        { content: 'Batch memory 2', context: 'batch', userId: 'test-user-123' },
        { content: 'Batch memory 3', context: 'batch', userId: 'test-user-123' }
      ];
      
      const results = await vectorMemoryService.storeBatchMemories(memories);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);
      expect(results.every(r => r.id && r.embedding)).toBe(true);
    });

    test('should handle partial failures in batch operations', async () => {
      const memories = [
        { content: 'Valid memory 1', context: 'test', userId: 'test-user-123' },
        { content: '', context: 'test', userId: 'test-user-123' }, // Invalid
        { content: 'Valid memory 2', context: 'test', userId: 'test-user-123' }
      ];
      
      const results = await vectorMemoryService.storeBatchMemories(memories, {
        continueOnError: true
      });
      
      expect(results.successful.length).toBe(2);
      expect(results.failed.length).toBe(1);
      expect(results.failed[0].error).toContain('empty');
    });
  });

  describe('Context-based Retrieval', () => {
    test('should retrieve memories by context', async () => {
      await vectorMemoryService.storeMemory({
        content: 'Work-related memory',
        context: 'work',
        userId: 'test-user-123'
      });
      
      await vectorMemoryService.storeMemory({
        content: 'Personal memory',
        context: 'personal',
        userId: 'test-user-123'
      });
      
      const workMemories = await vectorMemoryService.getMemoriesByContext(
        'test-user-123',
        'work'
      );
      
      expect(workMemories.length).toBe(1);
      expect(workMemories[0].context).toBe('work');
      expect(workMemories[0].content).toContain('Work-related');
    });

    test('should retrieve recent memories within time range', async () => {
      const oldDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const recentDate = new Date();
      
      await vectorMemoryService.storeMemory({
        content: 'Old memory',
        context: 'test',
        userId: 'test-user-123',
        timestamp: oldDate.toISOString()
      });
      
      await vectorMemoryService.storeMemory({
        content: 'Recent memory',
        context: 'test',
        userId: 'test-user-123',
        timestamp: recentDate.toISOString()
      });
      
      const recentMemories = await vectorMemoryService.getRecentMemories(
        'test-user-123',
        { days: 3 }
      );
      
      expect(recentMemories.length).toBe(1);
      expect(recentMemories[0].content).toBe('Recent memory');
    });
  });

  describe('Performance and Optimization', () => {
    test('should handle large-scale similarity search efficiently', async () => {
      // Store many memories
      const memories = [];
      for (let i = 0; i < 100; i++) {
        memories.push({
          content: `Performance test memory ${i} with various content and keywords`,
          context: 'performance',
          userId: 'test-user-123'
        });
      }
      
      await vectorMemoryService.storeBatchMemories(memories);
      
      const startTime = performance.now();
      
      const results = await vectorMemoryService.searchSimilar(
        'performance test memory',
        'test-user-123',
        { limit: 10 }
      );
      
      const endTime = performance.now();
      const searchTime = endTime - startTime;
      
      expect(results.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should support concurrent operations', async () => {
      const promises = [];
      
      // Create concurrent store operations
      for (let i = 0; i < 10; i++) {
        promises.push(
          vectorMemoryService.storeMemory({
            content: `Concurrent memory ${i}`,
            context: 'concurrent',
            userId: 'test-user-123'
          })
        );
      }
      
      const results = await Promise.all(promises);
      
      expect(results.length).toBe(10);
      expect(results.every(r => r.id && r.embedding)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle embedding service failures', async () => {
      // Mock embedding service failure
      const originalGenerateEmbedding = vectorMemoryService.generateEmbedding;
      vectorMemoryService.generateEmbedding = jest.fn().mockRejectedValue(
        new Error('Embedding service unavailable')
      );
      
      await expect(
        vectorMemoryService.storeMemory({
          content: 'Test content',
          context: 'test',
          userId: 'test-user-123'
        })
      ).rejects.toThrow('Embedding service unavailable');
      
      // Restore original method
      vectorMemoryService.generateEmbedding = originalGenerateEmbedding;
    });

    test('should handle vector store connection failures', async () => {
      // Mock vector store failure
      const originalVectorStore = vectorMemoryService.vectorStore;
      vectorMemoryService.vectorStore = {
        store: jest.fn().mockRejectedValue(new Error('Vector store unavailable'))
      };
      
      await expect(
        vectorMemoryService.storeMemory({
          content: 'Test content',
          context: 'test',
          userId: 'test-user-123'
        })
      ).rejects.toThrow('Vector store unavailable');
      
      // Restore original
      vectorMemoryService.vectorStore = originalVectorStore;
    });
  });
});
