import 'jest-extended';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Mock external services by default
  process.env.MOCK_EXTERNAL_SERVICES = 'true';
  
  // Set test API keys (these should be fake for testing)
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-anthropic-key';
  
  // Console override for cleaner test output
  const originalConsole = console;
  global.originalConsole = originalConsole;
  
  // Only show console output if VERBOSE_TESTS is set
  if (!process.env.VERBOSE_TESTS) {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(async () => {
  // Restore console if it was mocked
  if (global.originalConsole) {
    console.log = global.originalConsole.log;
    console.info = global.originalConsole.info;
    console.warn = global.originalConsole.warn;
    console.error = global.originalConsole.error;
  }
});

// Global test helpers
global.testHelpers = {
  // Wait for a specified time
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Create mock API response
  createMockResponse: (data, status = 200) => ({
    status,
    data,
    ok: status >= 200 && status < 300,
    headers: new Map()
  }),
  
  // Generate test user data
  generateTestUser: () => ({
    id: `test-user-${Date.now()}`,
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    preferences: {
      voice: 'alloy',
      language: 'en'
    }
  }),
  
  // Generate test conversation data
  generateTestConversation: () => ({
    id: `conv-${Date.now()}`,
    title: 'Test Conversation',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }),
  
  // Clean up test data
  cleanupTestData: async () => {
    // Override in specific test files as needed
  }
};

// Extend Jest matchers
expect.extend({
  toBeValidApiResponse(received) {
    const pass = received && 
                 typeof received.status === 'number' &&
                 received.data !== undefined &&
                 typeof received.ok === 'boolean';
    
    return {
      message: () => `expected ${received} to be a valid API response`,
      pass
    };
  },
  
  toBeValidConversation(received) {
    const pass = received &&
                 typeof received.id === 'string' &&
                 typeof received.title === 'string' &&
                 Array.isArray(received.messages);
    
    return {
      message: () => `expected ${received} to be a valid conversation object`,
      pass
    };
  }
});