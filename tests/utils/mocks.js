import { jest } from '@jest/globals';

// Mock OpenAI API
export const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'This is a mocked AI response',
            role: 'assistant'
          }
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      })
    }
  },
  audio: {
    speech: {
      create: jest.fn().mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024))
      })
    },
    transcriptions: {
      create: jest.fn().mockResolvedValue({
        text: 'This is a mocked transcription'
      })
    }
  }
};

// Mock Anthropic API
export const mockAnthropic = {
  messages: {
    create: jest.fn().mockResolvedValue({
      content: [{
        text: 'This is a mocked Claude response'
      }],
      usage: {
        input_tokens: 10,
        output_tokens: 20
      }
    })
  }
};

// Mock Express Request
export const createMockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: {
    id: 'test-user-123',
    email: 'test@example.com'
  },
  ...overrides
});

// Mock Express Response
export const createMockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    header: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis()
  };
  return res;
};

// Mock WebSocket
export const createMockWebSocket = () => ({
  send: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
  emit: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
});

// Mock File System operations
export const mockFS = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  exists: jest.fn().mockResolvedValue(true),
  ensureDir: jest.fn().mockResolvedValue(true),
  remove: jest.fn().mockResolvedValue(true),
  readJson: jest.fn().mockResolvedValue({}),
  writeJson: jest.fn().mockResolvedValue(true)
};

// Mock External APIs
export const mockExternalAPIs = {
  weather: {
    current: {
      temperature: 22,
      description: 'Partly cloudy',
      humidity: 65,
      windSpeed: 10
    }
  },
  news: {
    articles: [
      {
        title: 'Test News Article',
        description: 'This is a test news article',
        url: 'https://example.com/news/1',
        publishedAt: new Date().toISOString()
      }
    ]
  },
  stocks: {
    quotes: [
      {
        symbol: 'AAPL',
        price: 150.25,
        change: 2.50,
        changePercent: 1.69
      }
    ]
  }
};

// Mock Memory Service Data
export const mockMemoryData = {
  conversations: [
    {
      id: 'conv-1',
      title: 'Test Conversation',
      messages: [
        {
          role: 'user',
          content: 'Hello'
        },
        {
          role: 'assistant',
          content: 'Hi there!'
        }
      ]
    }
  ],
  memories: [
    {
      id: 'mem-1',
      content: 'User likes coffee',
      context: 'conversation',
      timestamp: new Date().toISOString()
    }
  ]
};

// Mock Voice Processing Data
export const mockVoiceData = {
  audioBuffer: new ArrayBuffer(1024),
  transcription: 'Hello, this is a test transcription',
  synthesis: {
    audioBuffer: new ArrayBuffer(2048),
    duration: 3.5
  },
  voices: [
    { id: 'alloy', name: 'Alloy', language: 'en' },
    { id: 'echo', name: 'Echo', language: 'en' },
    { id: 'nova', name: 'Nova', language: 'en' }
  ]
};

// Utility function to reset all mocks
export const resetAllMocks = () => {
  jest.clearAllMocks();
  
  // Reset OpenAI mocks
  mockOpenAI.chat.completions.create.mockClear();
  mockOpenAI.audio.speech.create.mockClear();
  mockOpenAI.audio.transcriptions.create.mockClear();
  
  // Reset Anthropic mocks
  mockAnthropic.messages.create.mockClear();
  
  // Reset FS mocks
  Object.values(mockFS).forEach(mock => {
    if (jest.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
};

// Test data generators
export const testDataGenerators = {
  user: (overrides = {}) => ({
    id: `user-${Date.now()}`,
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    preferences: {
      voice: 'alloy',
      language: 'en',
      theme: 'dark'
    },
    createdAt: new Date().toISOString(),
    ...overrides
  }),
  
  conversation: (overrides = {}) => ({
    id: `conv-${Date.now()}`,
    title: 'Test Conversation',
    userId: 'test-user-123',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }),
  
  message: (overrides = {}) => ({
    id: `msg-${Date.now()}`,
    conversationId: 'test-conv-123',
    role: 'user',
    content: 'Test message content',
    timestamp: new Date().toISOString(),
    ...overrides
  }),
  
  apiResponse: (data, status = 200, overrides = {}) => ({
    success: status >= 200 && status < 300,
    status,
    data,
    timestamp: new Date().toISOString(),
    ...overrides
  })
};