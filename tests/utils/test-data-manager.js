import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TestDataManager {
  constructor() {
    this.testDataDir = path.join(__dirname, '..', 'fixtures');
    this.tempDataDir = path.join(__dirname, '..', 'temp');
    this.createdFiles = new Set();
    this.createdDirs = new Set();
  }

  async initialize() {
    await fs.ensureDir(this.testDataDir);
    await fs.ensureDir(this.tempDataDir);
  }

  async cleanup() {
    // Clean up created temporary files
    for (const file of this.createdFiles) {
      try {
        if (await fs.pathExists(file)) {
          await fs.remove(file);
        }
      } catch (error) {
        console.warn(`Failed to cleanup file ${file}:`, error.message);
      }
    }

    // Clean up created directories
    for (const dir of this.createdDirs) {
      try {
        if (await fs.pathExists(dir)) {
          await fs.remove(dir);
        }
      } catch (error) {
        console.warn(`Failed to cleanup directory ${dir}:`, error.message);
      }
    }

    this.createdFiles.clear();
    this.createdDirs.clear();
  }

  // User data fixtures
  generateUser(overrides = {}) {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    
    return {
      id: `user-${timestamp}-${randomId}`,
      email: `test-${timestamp}@susan-ai.com`,
      name: `Test User ${randomId.substring(0, 4)}`,
      preferences: {
        voice: 'alloy',
        language: 'en',
        theme: 'dark',
        notifications: true,
        ...overrides.preferences
      },
      metadata: {
        signupSource: 'test',
        testUser: true,
        ...overrides.metadata
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };
  }

  // Conversation data fixtures
  generateConversation(overrides = {}) {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(6).toString('hex');
    
    return {
      id: `conv-${timestamp}-${randomId}`,
      userId: overrides.userId || `user-${Date.now()}`,
      title: overrides.title || `Test Conversation ${randomId.substring(0, 4)}`,
      messages: overrides.messages || [],
      metadata: {
        source: 'test',
        topic: 'general',
        ...overrides.metadata
      },
      messageCount: overrides.messages ? overrides.messages.length : 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      ...overrides
    };
  }

  // Message data fixtures
  generateMessage(overrides = {}) {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(4).toString('hex');
    
    return {
      id: `msg-${timestamp}-${randomId}`,
      conversationId: overrides.conversationId || `conv-${Date.now()}`,
      role: overrides.role || 'user',
      content: overrides.content || 'This is a test message',
      metadata: {
        source: 'test',
        testMessage: true,
        ...overrides.metadata
      },
      timestamp: new Date().toISOString(),
      tokens: overrides.content ? this.estimateTokens(overrides.content) : 10,
      ...overrides
    };
  }

  // Voice profile fixtures
  generateVoiceProfile(overrides = {}) {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(4).toString('hex');
    
    return {
      id: `voice-profile-${timestamp}-${randomId}`,
      userId: overrides.userId || `user-${Date.now()}`,
      name: overrides.name || `Test Voice Profile ${randomId.substring(0, 4)}`,
      voicePreference: overrides.voicePreference || 'alloy',
      speechRate: overrides.speechRate || 1.0,
      pitch: overrides.pitch || 1.0,
      settings: {
        autoDetectLanguage: true,
        noiseReduction: false,
        customVocabulary: [],
        ...overrides.settings
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };
  }

  // API response fixtures
  generateApiResponse(data, status = 200, overrides = {}) {
    return {
      success: status >= 200 && status < 300,
      status,
      data,
      timestamp: new Date().toISOString(),
      requestId: crypto.randomBytes(8).toString('hex'),
      ...overrides
    };
  }

  // Error response fixtures
  generateErrorResponse(message, status = 400, code = 'VALIDATION_ERROR') {
    return {
      success: false,
      status,
      error: {
        message,
        code,
        timestamp: new Date().toISOString(),
        requestId: crypto.randomBytes(8).toString('hex')
      }
    };
  }

  // AI service response fixtures
  generateAIResponse(overrides = {}) {
    const content = overrides.content || 'This is a mock AI response for testing purposes.';
    
    return {
      content,
      role: 'assistant',
      model: overrides.model || 'gpt-4',
      usage: {
        prompt_tokens: overrides.promptTokens || 20,
        completion_tokens: overrides.completionTokens || this.estimateTokens(content),
        total_tokens: (overrides.promptTokens || 20) + this.estimateTokens(content)
      },
      finishReason: overrides.finishReason || 'stop',
      metadata: {
        responseTime: overrides.responseTime || Math.floor(Math.random() * 3000) + 500,
        testResponse: true,
        ...overrides.metadata
      },
      ...overrides
    };
  }

  // Memory/Analytics fixtures
  generateMemoryEntry(overrides = {}) {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(4).toString('hex');
    
    return {
      id: `memory-${timestamp}-${randomId}`,
      userId: overrides.userId || `user-${Date.now()}`,
      content: overrides.content || 'This is a test memory entry',
      context: overrides.context || 'conversation',
      importance: overrides.importance || 0.5,
      tags: overrides.tags || ['test', 'memory'],
      embedding: overrides.embedding || this.generateMockEmbedding(),
      createdAt: new Date().toISOString(),
      accessCount: overrides.accessCount || 0,
      lastAccessed: overrides.lastAccessed || new Date().toISOString(),
      ...overrides
    };
  }

  // File fixtures
  async createTestFile(filename, content = 'Test file content', options = {}) {
    const filePath = path.join(this.tempDataDir, filename);
    const dir = path.dirname(filePath);
    
    // Ensure directory exists
    await fs.ensureDir(dir);
    this.createdDirs.add(dir);
    
    // Write file
    if (typeof content === 'string') {
      await fs.writeFile(filePath, content, options.encoding || 'utf8');
    } else {
      await fs.writeFile(filePath, content);
    }
    
    this.createdFiles.add(filePath);
    
    return {
      path: filePath,
      name: filename,
      size: (await fs.stat(filePath)).size,
      mimetype: this.getMimetype(filename)
    };
  }

  // Audio file fixtures
  async createTestAudioFile(filename, durationMs = 5000, options = {}) {
    const audioData = this.generateMockAudioData(
      path.extname(filename).slice(1),
      durationMs,
      options
    );
    
    return await this.createTestFile(filename, audioData);
  }

  // Image file fixtures
  async createTestImageFile(filename, width = 100, height = 100) {
    const imageData = this.generateMockImageData(width, height);
    return await this.createTestFile(filename, imageData);
  }

  // CSV data fixtures
  async createTestCSVFile(filename, headers, rows) {
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return await this.createTestFile(filename, csvContent);
  }

  // JSON data fixtures
  async createTestJSONFile(filename, data) {
    const jsonContent = JSON.stringify(data, null, 2);
    return await this.createTestFile(filename, jsonContent);
  }

  // Batch data generators
  generateConversationHistory(userCount = 3, conversationsPerUser = 5, messagesPerConversation = 8) {
    const users = Array.from({ length: userCount }, () => this.generateUser());
    const conversations = [];
    
    users.forEach(user => {
      for (let i = 0; i < conversationsPerUser; i++) {
        const messages = [];
        
        for (let j = 0; j < messagesPerConversation; j++) {
          const isUserMessage = j % 2 === 0;
          const message = this.generateMessage({
            role: isUserMessage ? 'user' : 'assistant',
            content: isUserMessage 
              ? `User message ${j + 1} in conversation ${i + 1}`
              : this.generateAIResponse().content,
            timestamp: new Date(Date.now() - (messagesPerConversation - j) * 60000).toISOString()
          });
          messages.push(message);
        }
        
        const conversation = this.generateConversation({
          userId: user.id,
          title: `Conversation ${i + 1} for ${user.name}`,
          messages,
          messageCount: messages.length
        });
        
        conversations.push(conversation);
      }
    });
    
    return { users, conversations };
  }

  generateAnalyticsData(timeRange = '7d') {
    const now = new Date();
    const dayCount = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 1;
    
    const data = [];
    
    for (let i = dayCount - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      
      data.push({
        date: date.toISOString().split('T')[0],
        conversations: Math.floor(Math.random() * 100) + 20,
        messages: Math.floor(Math.random() * 500) + 100,
        users: Math.floor(Math.random() * 50) + 10,
        avgResponseTime: Math.floor(Math.random() * 2000) + 500,
        successRate: 0.95 + Math.random() * 0.05,
        errorRate: Math.random() * 0.02
      });
    }
    
    return data;
  }

  // Test scenario builders
  async createTestScenario(name, setup) {
    const scenarioDir = path.join(this.tempDataDir, 'scenarios', name);
    await fs.ensureDir(scenarioDir);
    this.createdDirs.add(scenarioDir);
    
    const scenario = await setup({
      dir: scenarioDir,
      createFile: (filename, content) => this.createTestFile(
        path.join('scenarios', name, filename),
        content
      ),
      generateUser: (overrides) => this.generateUser(overrides),
      generateConversation: (overrides) => this.generateConversation(overrides),
      generateMessage: (overrides) => this.generateMessage(overrides)
    });
    
    // Save scenario metadata
    const metadataFile = path.join(scenarioDir, 'scenario.json');
    await fs.writeJson(metadataFile, {
      name,
      createdAt: new Date().toISOString(),
      ...scenario
    }, { spaces: 2 });
    
    this.createdFiles.add(metadataFile);
    
    return scenario;
  }

  // Load existing fixtures
  async loadFixture(name) {
    const fixturePath = path.join(this.testDataDir, `${name}.json`);
    
    if (await fs.pathExists(fixturePath)) {
      return await fs.readJson(fixturePath);
    }
    
    throw new Error(`Fixture '${name}' not found at ${fixturePath}`);
  }

  // Save fixtures for reuse
  async saveFixture(name, data) {
    const fixturePath = path.join(this.testDataDir, `${name}.json`);
    await fs.writeJson(fixturePath, data, { spaces: 2 });
    return fixturePath;
  }

  // Utility methods
  estimateTokens(text) {
    return Math.ceil(text.length / 4); // Rough estimation
  }

  generateMockEmbedding(dimensions = 1536) {
    return Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
  }

  generateMockAudioData(format, durationMs, options = {}) {
    const baseSize = Math.floor(durationMs * 16); // Rough bytes per ms
    let size = baseSize;
    
    if (options.quality === 'high') {
      size = baseSize * 2;
    } else if (options.quality === 'low') {
      size = Math.floor(baseSize * 0.5);
    }
    
    const buffer = Buffer.alloc(size);
    
    // Add format-specific headers
    if (format === 'mp3') {
      buffer[0] = 0xFF;
      buffer[1] = 0xFB;
    } else if (format === 'wav') {
      buffer.write('RIFF', 0);
      buffer.writeUInt32LE(size - 8, 4);
      buffer.write('WAVE', 8);
    }
    
    // Fill with random audio-like data
    for (let i = 12; i < size; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    
    return buffer;
  }

  generateMockImageData(width, height) {
    // Generate a simple bitmap header + data
    const pixelData = width * height * 3; // RGB
    const fileSize = 54 + pixelData; // Header + data
    
    const buffer = Buffer.alloc(fileSize);
    
    // BMP header
    buffer.write('BM', 0);
    buffer.writeUInt32LE(fileSize, 2);
    buffer.writeUInt32LE(54, 10); // Data offset
    buffer.writeUInt32LE(40, 14); // Info header size
    buffer.writeUInt32LE(width, 18);
    buffer.writeUInt32LE(height, 22);
    buffer.writeUInt16LE(1, 26); // Planes
    buffer.writeUInt16LE(24, 28); // Bits per pixel
    
    // Fill with random pixel data
    for (let i = 54; i < fileSize; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    
    return buffer;
  }

  getMimetype(filename) {
    const ext = path.extname(filename).toLowerCase();
    
    const mimetypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.webm': 'audio/webm',
      '.mp4': 'video/mp4',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.xml': 'application/xml',
      '.pdf': 'application/pdf'
    };
    
    return mimetypes[ext] || 'application/octet-stream';
  }

  // Database state management
  async saveState(name, state) {
    const statePath = path.join(this.tempDataDir, 'states', `${name}.json`);
    await fs.ensureDir(path.dirname(statePath));
    await fs.writeJson(statePath, state, { spaces: 2 });
    this.createdFiles.add(statePath);
    return statePath;
  }

  async loadState(name) {
    const statePath = path.join(this.tempDataDir, 'states', `${name}.json`);
    
    if (await fs.pathExists(statePath)) {
      return await fs.readJson(statePath);
    }
    
    return null;
  }

  // Performance testing data
  generateLoadTestUsers(count = 100) {
    return Array.from({ length: count }, (_, index) => 
      this.generateUser({
        email: `loadtest-user-${index + 1}@susan-ai.com`,
        name: `Load Test User ${index + 1}`,
        metadata: {
          loadTest: true,
          userIndex: index + 1
        }
      })
    );
  }

  generateStressTestScenarios() {
    return {
      concurrentConnections: {
        name: 'Concurrent WebSocket Connections',
        connectionCount: 50,
        messageRate: 10, // messages per second per connection
        duration: 60 // seconds
      },
      rapidApiCalls: {
        name: 'Rapid API Calls',
        requestsPerSecond: 100,
        duration: 30,
        endpoints: [
          '/api/v1/conversations',
          '/api/v1/voice/synthesize',
          '/api/v1/memory/search'
        ]
      },
      largeBatch: {
        name: 'Large Batch Processing',
        batchSize: 500,
        itemSize: 'large', // small, medium, large
        operation: 'transcription'
      }
    };
  }
}

// Export singleton instance
export const testDataManager = new TestDataManager();

// Export individual generators for convenience
export const {
  generateUser,
  generateConversation,
  generateMessage,
  generateVoiceProfile,
  generateApiResponse,
  generateErrorResponse,
  generateAIResponse,
  generateMemoryEntry
} = testDataManager;
