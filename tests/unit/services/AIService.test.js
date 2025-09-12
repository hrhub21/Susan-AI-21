import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AIService } from '../../../src/api/services/AIService.js';
import { mockOpenAI, mockAnthropic, resetAllMocks } from '../../utils/mocks.js';

// Mock the external dependencies
jest.unstable_mockModule('openai', () => ({
  default: jest.fn(() => mockOpenAI)
}));

jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
  default: jest.fn(() => mockAnthropic)
}));

describe('AIService', () => {
  let aiService;
  
  beforeEach(() => {
    resetAllMocks();
    
    // Set test environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    
    aiService = new AIService();
  });
  
  afterEach(() => {
    resetAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with proper configuration', () => {
      expect(aiService).toBeDefined();
      expect(aiService.modelConfigs).toBeDefined();
      expect(aiService.activeStreams).toBeInstanceOf(Map);
      expect(aiService.streamMetrics).toBeInstanceOf(Map);
    });

    test('should have OpenAI and Anthropic clients when API keys are provided', () => {
      expect(aiService.openai).toBeDefined();
      expect(aiService.anthropic).toBeDefined();
    });

    test('should handle missing API keys gracefully', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      
      const serviceWithoutKeys = new AIService();
      expect(serviceWithoutKeys.openai).toBeUndefined();
      expect(serviceWithoutKeys.anthropic).toBeUndefined();
    });
  });

  describe('Model Configuration', () => {
    test('should return valid model configurations', () => {
      const configs = aiService.getModelConfigurations();
      
      expect(configs).toBeDefined();
      expect(configs['gpt-4']).toBeDefined();
      expect(configs['gpt-4'].provider).toBe('openai');
      expect(configs['gpt-4'].maxTokens).toBeGreaterThan(0);
      expect(configs['gpt-4'].cost).toBeDefined();
    });

    test('should include both OpenAI and Anthropic models', () => {
      const configs = aiService.getModelConfigurations();
      
      const openaiModels = Object.values(configs).filter(config => config.provider === 'openai');
      const anthropicModels = Object.values(configs).filter(config => config.provider === 'anthropic');
      
      expect(openaiModels.length).toBeGreaterThan(0);
      expect(anthropicModels.length).toBeGreaterThan(0);
    });
  });

  describe('Model Selection', () => {
    test('should select appropriate model based on task', async () => {
      const textTask = { type: 'text', complexity: 'high' };
      const visionTask = { type: 'vision', complexity: 'medium' };
      
      const textModel = await aiService.selectOptimalModel(textTask);
      const visionModel = await aiService.selectOptimalModel(visionTask);
      
      expect(textModel).toBeDefined();
      expect(visionModel).toBeDefined();
      expect(aiService.modelConfigs[visionModel].capabilities).toContain('vision');
    });

    test('should fallback to default model when no optimal match', async () => {
      const unknownTask = { type: 'unknown', complexity: 'unknown' };
      const model = await aiService.selectOptimalModel(unknownTask);
      
      expect(model).toBeDefined();
      expect(aiService.modelConfigs[model]).toBeDefined();
    });
  });

  describe('Message Processing', () => {
    test('should process text messages with OpenAI', async () => {
      const messages = [
        { role: 'user', content: 'Hello, how are you?' }
      ];
      
      const response = await aiService.processMessages(messages, {
        model: 'gpt-4',
        maxTokens: 150
      });
      
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
      expect(response).toBeDefined();
      expect(response.content).toBe('This is a mocked AI response');
      expect(response.usage).toBeDefined();
    });

    test('should process messages with Anthropic', async () => {
      const messages = [
        { role: 'user', content: 'Explain quantum computing' }
      ];
      
      const response = await aiService.processMessages(messages, {
        model: 'claude-3-sonnet',
        maxTokens: 200
      });
      
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(1);
      expect(response).toBeDefined();
      expect(response.content).toBe('This is a mocked Claude response');
    });

    test('should handle empty messages array', async () => {
      await expect(
        aiService.processMessages([], { model: 'gpt-4' })
      ).rejects.toThrow('Messages array cannot be empty');
    });

    test('should validate message format', async () => {
      const invalidMessages = [
        { role: 'invalid', content: 'test' }
      ];
      
      await expect(
        aiService.processMessages(invalidMessages, { model: 'gpt-4' })
      ).rejects.toThrow('Invalid message role');
    });
  });

  describe('Streaming', () => {
    test('should create streaming session', () => {
      const sessionId = aiService.createStreamingSession();
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(aiService.activeStreams.has(sessionId)).toBe(true);
    });

    test('should track streaming metrics', () => {
      const sessionId = aiService.createStreamingSession();
      
      aiService.updateStreamingMetrics(sessionId, {
        tokensGenerated: 50,
        latency: 120
      });
      
      expect(aiService.streamMetrics.has(sessionId)).toBe(true);
      expect(aiService.streamMetrics.get(sessionId).tokensGenerated).toBe(50);
    });

    test('should cleanup streaming session', () => {
      const sessionId = aiService.createStreamingSession();
      
      aiService.cleanupStreamingSession(sessionId);
      
      expect(aiService.activeStreams.has(sessionId)).toBe(false);
      expect(aiService.streamMetrics.has(sessionId)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle OpenAI API errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(
        new Error('OpenAI API Error')
      );
      
      const messages = [{ role: 'user', content: 'test' }];
      
      await expect(
        aiService.processMessages(messages, { model: 'gpt-4' })
      ).rejects.toThrow('OpenAI API Error');
    });

    test('should handle Anthropic API errors', async () => {
      mockAnthropic.messages.create.mockRejectedValueOnce(
        new Error('Anthropic API Error')
      );
      
      const messages = [{ role: 'user', content: 'test' }];
      
      await expect(
        aiService.processMessages(messages, { model: 'claude-3-sonnet' })
      ).rejects.toThrow('Anthropic API Error');
    });

    test('should handle rate limiting gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValueOnce({
        status: 429,
        message: 'Rate limit exceeded'
      });
      
      const messages = [{ role: 'user', content: 'test' }];
      
      await expect(
        aiService.processMessages(messages, { model: 'gpt-4' })
      ).rejects.toMatchObject({
        status: 429
      });
    });
  });

  describe('Token Management', () => {
    test('should estimate token count for messages', () => {
      const messages = [
        { role: 'user', content: 'Hello world' },
        { role: 'assistant', content: 'Hi there!' }
      ];
      
      const tokenCount = aiService.estimateTokenCount(messages);
      
      expect(tokenCount).toBeGreaterThan(0);
      expect(typeof tokenCount).toBe('number');
    });

    test('should respect token limits', async () => {
      const longMessage = 'A'.repeat(10000); // Very long message
      const messages = [{ role: 'user', content: longMessage }];
      
      const result = await aiService.processMessages(messages, {
        model: 'gpt-4',
        maxTokens: 100
      });
      
      expect(result).toBeDefined();
      // Should truncate or handle long messages appropriately
    });
  });

  describe('Cost Calculation', () => {
    test('should calculate costs accurately', () => {
      const usage = {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      };
      
      const cost = aiService.calculateCost('gpt-4', usage);
      
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });

    test('should handle unknown models for cost calculation', () => {
      const usage = { prompt_tokens: 100, completion_tokens: 50 };
      
      const cost = aiService.calculateCost('unknown-model', usage);
      
      expect(cost).toBe(0);
    });
  });

  describe('Function Calling', () => {
    test('should handle function calls in messages', async () => {
      const messages = [
        { role: 'user', content: 'What is the weather in New York?' }
      ];
      
      const functions = [
        {
          name: 'get_weather',
          description: 'Get weather information',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' }
            }
          }
        }
      ];
      
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: null,
            function_call: {
              name: 'get_weather',
              arguments: '{"location": "New York"}'
            }
          }
        }]
      });
      
      const response = await aiService.processMessages(messages, {
        model: 'gpt-4',
        functions
      });
      
      expect(response.function_call).toBeDefined();
      expect(response.function_call.name).toBe('get_weather');
    });
  });
});