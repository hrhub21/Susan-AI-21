import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { jest } from '@jest/globals';

/**
 * Enhanced Test Data Manager
 * Provides comprehensive test data management with isolation, cleanup, and versioning
 */
export class EnhancedTestDataManager {
  constructor(options = {}) {
    this.basePath = options.basePath || path.join(process.cwd(), 'tests', 'data');
    this.isolation = options.isolation !== false; // Enable by default
    this.cleanup = options.cleanup !== false; // Enable by default
    this.testSuiteId = this.generateTestSuiteId();
    this.activeResources = new Set();
    this.databaseConnections = new Map();
    this.createdFiles = new Set();
    this.createdDirectories = new Set();
    this.mockServers = new Set();
    
    this.setupCleanupHandlers();
  }

  /**
   * Generate unique test suite identifier
   */
  generateTestSuiteId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `test-${timestamp}-${random}`;
  }

  /**
   * Set up cleanup handlers for test completion
   */
  setupCleanupHandlers() {
    if (this.cleanup) {
      // Jest afterAll cleanup
      if (typeof afterAll !== 'undefined') {
        afterAll(async () => {
          await this.cleanupAll();
        });
      }
      
      // Process exit cleanup
      process.on('exit', () => {
        this.cleanupSync();
      });
      
      // Graceful shutdown cleanup
      ['SIGINT', 'SIGTERM', 'SIGUSR2'].forEach(signal => {
        process.on(signal, async () => {
          await this.cleanupAll();
          process.exit(0);
        });
      });
    }
  }

  /**
   * Create isolated test user data
   */
  async createTestUser(overrides = {}) {
    const userId = `test-user-${this.testSuiteId}-${crypto.randomBytes(4).toString('hex')}`;
    
    const user = {
      id: userId,
      email: `${userId}@test.susan-ai.com`,
      name: `Test User ${userId.slice(-8)}`,
      password: 'TestPassword123!',
      passwordHash: await this.hashPassword('TestPassword123!'),
      preferences: {
        voice: 'alloy',
        language: 'en',
        theme: 'dark',
        notifications: true
      },
      permissions: ['user'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      testSuiteId: this.testSuiteId,
      ...overrides
    };
    
    this.activeResources.add(`user:${userId}`);
    
    // Store user data for cleanup
    const userDataPath = path.join(this.basePath, 'users', `${userId}.json`);
    await fs.ensureDir(path.dirname(userDataPath));
    await fs.writeJson(userDataPath, user);
    this.createdFiles.add(userDataPath);
    
    return user;
  }

  /**
   * Create isolated test conversation data
   */
  async createTestConversation(userId, overrides = {}) {
    const conversationId = `conv-${this.testSuiteId}-${crypto.randomBytes(4).toString('hex')}`;
    
    const conversation = {
      id: conversationId,
      userId,
      title: `Test Conversation ${conversationId.slice(-8)}`,
      messages: [],
      metadata: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      testSuiteId: this.testSuiteId,
      ...overrides
    };
    
    this.activeResources.add(`conversation:${conversationId}`);
    
    // Store conversation data
    const conversationDataPath = path.join(this.basePath, 'conversations', `${conversationId}.json`);
    await fs.ensureDir(path.dirname(conversationDataPath));
    await fs.writeJson(conversationDataPath, conversation);
    this.createdFiles.add(conversationDataPath);
    
    return conversation;
  }

  /**
   * Add test message to conversation
   */
  async addTestMessage(conversationId, content, role = 'user', overrides = {}) {
    const messageId = `msg-${this.testSuiteId}-${crypto.randomBytes(4).toString('hex')}`;
    
    const message = {
      id: messageId,
      conversationId,
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata: {
        model: role === 'assistant' ? 'gpt-4' : null,
        tokens: Math.floor(content.length / 4), // Rough estimate
        processingTime: role === 'assistant' ? Math.random() * 2000 + 500 : null
      },
      testSuiteId: this.testSuiteId,
      ...overrides
    };
    
    // Load existing conversation
    const conversationDataPath = path.join(this.basePath, 'conversations', `${conversationId}.json`);
    const conversation = await fs.readJson(conversationDataPath);
    
    // Add message
    conversation.messages.push(message);
    conversation.updatedAt = new Date().toISOString();
    
    // Save updated conversation
    await fs.writeJson(conversationDataPath, conversation);
    
    this.activeResources.add(`message:${messageId}`);
    
    return message;
  }

  /**
   * Create test audio file
   */
  async createTestAudioFile(type = 'wav', duration = 2, frequency = 440) {
    const filename = `test-audio-${this.testSuiteId}-${crypto.randomBytes(4).toString('hex')}.${type}`;
    const audioPath = path.join(this.basePath, 'audio', filename);
    
    await fs.ensureDir(path.dirname(audioPath));
    
    // Generate simple audio data based on type
    let audioData;
    
    switch (type.toLowerCase()) {
      case 'wav':
        audioData = this.generateWavFile(frequency, duration);
        break;
      case 'mp3':
        audioData = this.generateMockMp3(duration);
        break;
      default:
        audioData = this.generateGenericAudioMock(duration);
    }
    
    await fs.writeFile(audioPath, audioData);
    this.createdFiles.add(audioPath);
    this.activeResources.add(`audio:${filename}`);
    
    return {
      filename,
      path: audioPath,
      size: audioData.length,
      duration,
      type,
      testSuiteId: this.testSuiteId
    };
  }

  /**
   * Create test database connection
   */
  async createTestDatabase(type = 'memory') {
    const dbId = `db-${this.testSuiteId}-${crypto.randomBytes(4).toString('hex')}`;
    
    let connection;
    
    switch (type) {
      case 'memory':
        // In-memory database mock
        connection = {
          id: dbId,
          type: 'memory',
          data: new Map(),
          query: jest.fn(),
          insert: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          close: jest.fn()
        };
        break;
      
      case 'sqlite':
        // SQLite file database for testing
        const dbPath = path.join(this.basePath, 'databases', `${dbId}.sqlite`);
        await fs.ensureDir(path.dirname(dbPath));
        
        connection = {
          id: dbId,
          type: 'sqlite',
          path: dbPath,
          query: jest.fn(),
          insert: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          close: jest.fn()
        };
        
        this.createdFiles.add(dbPath);
        break;
      
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
    
    this.databaseConnections.set(dbId, connection);
    this.activeResources.add(`database:${dbId}`);
    
    return connection;
  }

  /**
   * Create mock external API server
   */
  async createMockApiServer(port = 0, endpoints = {}) {
    const express = await import('express');
    const app = express.default();
    
    app.use(express.json());
    
    // Add default health check
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', testSuiteId: this.testSuiteId });
    });
    
    // Add custom endpoints
    Object.entries(endpoints).forEach(([path, handler]) => {
      const [method, route] = path.split(' ');
      app[method.toLowerCase()](route, handler);
    });
    
    const server = app.listen(port);
    const actualPort = server.address().port;
    
    const mockServer = {
      id: `mock-${this.testSuiteId}-${actualPort}`,
      app,
      server,
      port: actualPort,
      baseUrl: `http://localhost:${actualPort}`,
      testSuiteId: this.testSuiteId
    };
    
    this.mockServers.add(mockServer);
    this.activeResources.add(`mock-server:${mockServer.id}`);
    
    return mockServer;
  }

  /**
   * Create test file with specific content
   */
  async createTestFile(filename, content, options = {}) {
    const testFilename = options.preserveName 
      ? filename 
      : `${this.testSuiteId}-${filename}`;
    
    const filePath = path.join(this.basePath, 'files', testFilename);
    await fs.ensureDir(path.dirname(filePath));
    
    if (typeof content === 'object') {
      await fs.writeJson(filePath, content, { spaces: 2 });
    } else {
      await fs.writeFile(filePath, content, options.encoding || 'utf8');
    }
    
    this.createdFiles.add(filePath);
    this.activeResources.add(`file:${testFilename}`);
    
    return {
      filename: testFilename,
      path: filePath,
      size: Buffer.byteLength(typeof content === 'string' ? content : JSON.stringify(content)),
      testSuiteId: this.testSuiteId
    };
  }

  /**
   * Create test directory structure
   */
  async createTestDirectory(structure) {
    const baseDir = path.join(this.basePath, 'directories', this.testSuiteId);
    
    await this.createDirectoryRecursive(baseDir, structure);
    
    this.createdDirectories.add(baseDir);
    this.activeResources.add(`directory:${this.testSuiteId}`);
    
    return baseDir;
  }

  /**
   * Recursively create directory structure
   */
  async createDirectoryRecursive(basePath, structure) {
    await fs.ensureDir(basePath);
    
    for (const [name, content] of Object.entries(structure)) {
      const itemPath = path.join(basePath, name);
      
      if (typeof content === 'object' && content !== null && !Buffer.isBuffer(content)) {
        // It's a directory
        await this.createDirectoryRecursive(itemPath, content);
      } else {
        // It's a file
        if (Buffer.isBuffer(content)) {
          await fs.writeFile(itemPath, content);
        } else if (typeof content === 'string') {
          await fs.writeFile(itemPath, content, 'utf8');
        } else {
          await fs.writeJson(itemPath, content, { spaces: 2 });
        }
        
        this.createdFiles.add(itemPath);
      }
    }
  }

  /**
   * Get test data by type and ID
   */
  async getTestData(type, id) {
    const dataPath = path.join(this.basePath, type, `${id}.json`);
    
    if (await fs.pathExists(dataPath)) {
      return await fs.readJson(dataPath);
    }
    
    throw new Error(`Test data not found: ${type}/${id}`);
  }

  /**
   * Update test data
   */
  async updateTestData(type, id, updates) {
    const dataPath = path.join(this.basePath, type, `${id}.json`);
    
    if (await fs.pathExists(dataPath)) {
      const data = await fs.readJson(dataPath);
      const updatedData = { ...data, ...updates, updatedAt: new Date().toISOString() };
      await fs.writeJson(dataPath, updatedData);
      return updatedData;
    }
    
    throw new Error(`Test data not found for update: ${type}/${id}`);
  }

  /**
   * List all test data of a specific type
   */
  async listTestData(type) {
    const typeDir = path.join(this.basePath, type);
    
    if (await fs.pathExists(typeDir)) {
      const files = await fs.readdir(typeDir);
      const dataList = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(typeDir, file));
          if (data.testSuiteId === this.testSuiteId) {
            dataList.push(data);
          }
        }
      }
      
      return dataList;
    }
    
    return [];
  }

  /**
   * Clean up all test resources
   */
  async cleanupAll() {
    try {
      // Close database connections
      for (const [dbId, connection] of this.databaseConnections) {
        try {
          if (connection.close) {
            await connection.close();
          }
        } catch (error) {
          console.warn(`Failed to close database ${dbId}:`, error.message);
        }
      }
      this.databaseConnections.clear();
      
      // Close mock servers
      for (const mockServer of this.mockServers) {
        try {
          await new Promise((resolve) => {
            mockServer.server.close(resolve);
          });
        } catch (error) {
          console.warn(`Failed to close mock server ${mockServer.id}:`, error.message);
        }
      }
      this.mockServers.clear();
      
      // Remove created files
      for (const filePath of this.createdFiles) {
        try {
          await fs.remove(filePath);
        } catch (error) {
          console.warn(`Failed to remove file ${filePath}:`, error.message);
        }
      }
      this.createdFiles.clear();
      
      // Remove created directories
      for (const dirPath of this.createdDirectories) {
        try {
          await fs.remove(dirPath);
        } catch (error) {
          console.warn(`Failed to remove directory ${dirPath}:`, error.message);
        }
      }
      this.createdDirectories.clear();
      
      this.activeResources.clear();
      
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Synchronous cleanup for process exit
   */
  cleanupSync() {
    try {
      // Synchronous cleanup of files and directories
      for (const filePath of this.createdFiles) {
        try {
          if (fs.existsSync(filePath)) {
            fs.removeSync(filePath);
          }
        } catch (error) {
          // Ignore errors during sync cleanup
        }
      }
      
      for (const dirPath of this.createdDirectories) {
        try {
          if (fs.existsSync(dirPath)) {
            fs.removeSync(dirPath);
          }
        } catch (error) {
          // Ignore errors during sync cleanup
        }
      }
    } catch (error) {
      // Ignore all errors during sync cleanup
    }
  }

  /**
   * Generate test statistics
   */
  getTestStatistics() {
    return {
      testSuiteId: this.testSuiteId,
      activeResources: this.activeResources.size,
      createdFiles: this.createdFiles.size,
      createdDirectories: this.createdDirectories.size,
      databaseConnections: this.databaseConnections.size,
      mockServers: this.mockServers.size,
      resourceTypes: Array.from(this.activeResources).reduce((acc, resource) => {
        const type = resource.split(':')[0];
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {})
    };
  }

  // Helper methods for generating test data
  
  async hashPassword(password) {
    // Simple hash for testing (don't use in production)
    return crypto.createHash('sha256').update(password + 'test-salt').digest('hex');
  }
  
  generateWavFile(frequency, duration, sampleRate = 44100) {
    const samples = Math.floor(sampleRate * duration);
    const buffer = Buffer.alloc(44 + samples * 2);
    
    // WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + samples * 2, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(samples * 2, 40);
    
    // Audio data
    for (let i = 0; i < samples; i++) {
      const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate);
      buffer.writeInt16LE(sample * 32767, 44 + i * 2);
    }
    
    return buffer;
  }
  
  generateMockMp3(duration) {
    // Generate mock MP3 header and data
    const mockMp3 = Buffer.alloc(Math.floor(duration * 16000)); // Rough size estimate
    
    // MP3 sync frame
    mockMp3[0] = 0xFF;
    mockMp3[1] = 0xFB;
    
    // Fill with pseudo-random data
    for (let i = 2; i < mockMp3.length; i++) {
      mockMp3[i] = Math.floor(Math.random() * 256);
    }
    
    return mockMp3;
  }
  
  generateGenericAudioMock(duration) {
    // Generate generic audio mock data
    const size = Math.floor(duration * 8000); // 8KB per second estimate
    const buffer = Buffer.alloc(size);
    
    for (let i = 0; i < size; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    
    return buffer;
  }
}

// Global instance for easy access
let globalTestDataManager;

export function getTestDataManager(options) {
  if (!globalTestDataManager) {
    globalTestDataManager = new EnhancedTestDataManager(options);
  }
  return globalTestDataManager;
}

export function resetTestDataManager() {
  if (globalTestDataManager) {
    globalTestDataManager.cleanupSync();
    globalTestDataManager = null;
  }
}

// Factory functions for common test data
export const testDataFactory = {
  user: (overrides = {}) => getTestDataManager().createTestUser(overrides),
  conversation: (userId, overrides = {}) => getTestDataManager().createTestConversation(userId, overrides),
  message: (conversationId, content, role, overrides = {}) => 
    getTestDataManager().addTestMessage(conversationId, content, role, overrides),
  audioFile: (type, duration, frequency) => 
    getTestDataManager().createTestAudioFile(type, duration, frequency),
  database: (type = 'memory') => getTestDataManager().createTestDatabase(type),
  mockServer: (port, endpoints) => getTestDataManager().createMockApiServer(port, endpoints),
  file: (filename, content, options) => getTestDataManager().createTestFile(filename, content, options),
  directory: (structure) => getTestDataManager().createTestDirectory(structure)
};
