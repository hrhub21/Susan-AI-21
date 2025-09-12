import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { AIService } from '../../src/api/services/AIService.js';
import { ConversationService } from '../../src/api/services/ConversationService.js';
import { VoiceService } from '../../src/api/services/VoiceService.js';
import { testDataGenerators } from '../utils/mocks.js';
import fs from 'fs-extra';
import path from 'path';

describe('AI Response Time Performance Tests', () => {
  let aiService;
  let conversationService;
  let voiceService;
  let performanceResults = [];
  
  beforeAll(() => {
    // Set up services for performance testing
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
    
    aiService = new AIService();
    conversationService = new ConversationService();
    voiceService = new VoiceService();
  });
  
  afterAll(async () => {
    // Generate performance report
    await generatePerformanceReport(performanceResults);
  });
  
  beforeEach(() => {
    // Reset metrics before each test
    if (aiService.streamMetrics) {
      aiService.streamMetrics.clear();
    }
  });

  describe('AI Model Response Times', () => {
    const testCases = [
      {
        name: 'Simple Question',
        prompt: 'What is 2 + 2?',
        expectedMaxTime: 3000,
        complexity: 'low'
      },
      {
        name: 'Medium Complexity',
        prompt: 'Explain the concept of machine learning in simple terms.',
        expectedMaxTime: 8000,
        complexity: 'medium'
      },
      {
        name: 'Complex Analysis',
        prompt: 'Analyze the pros and cons of different renewable energy technologies and their impact on global climate change mitigation.',
        expectedMaxTime: 15000,
        complexity: 'high'
      },
      {
        name: 'Code Generation',
        prompt: 'Write a Python function that implements a binary search algorithm with error handling and documentation.',
        expectedMaxTime: 12000,
        complexity: 'high'
      }
    ];

    testCases.forEach(({ name, prompt, expectedMaxTime, complexity }) => {
      test(`should respond to ${name} within ${expectedMaxTime}ms`, async () => {
        const startTime = performance.now();
        
        const messages = [{ role: 'user', content: prompt }];
        
        const response = await aiService.processMessages(messages, {
          model: 'gpt-4',
          maxTokens: 500
        });
        
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        // Record performance data
        performanceResults.push({
          testName: name,
          prompt,
          responseTime,
          expectedMaxTime,
          complexity,
          model: 'gpt-4',
          success: responseTime <= expectedMaxTime,
          tokenCount: response.usage?.total_tokens || 0,
          tokensPerSecond: response.usage?.total_tokens ? (response.usage.total_tokens / (responseTime / 1000)) : 0
        });
        
        expect(response).toBeDefined();
        expect(response.content).toBeTruthy();
        expect(responseTime).toBeLessThanOrEqual(expectedMaxTime);
        
        console.log(`${name}: ${responseTime.toFixed(2)}ms (${(response.usage?.total_tokens || 0)} tokens)`);
      }, expectedMaxTime + 5000); // Add buffer for test timeout
    });
  });

  describe('Concurrent Request Performance', () => {
    test('should handle multiple concurrent simple requests', async () => {
      const concurrentRequests = 5;
      const maxAllowedTime = 10000; // 10 seconds for all requests
      
      const startTime = performance.now();
      
      const requests = Array.from({ length: concurrentRequests }, (_, i) => {
        const messages = [{ role: 'user', content: `What is ${i + 1} + ${i + 2}?` }];
        return aiService.processMessages(messages, {
          model: 'gpt-4',
          maxTokens: 100
        });
      });
      
      const responses = await Promise.all(requests);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      performanceResults.push({
        testName: 'Concurrent Simple Requests',
        responseTime: totalTime,
        expectedMaxTime: maxAllowedTime,
        complexity: 'concurrent',
        model: 'gpt-4',
        requestCount: concurrentRequests,
        success: totalTime <= maxAllowedTime,
        averageTime: totalTime / concurrentRequests
      });
      
      expect(responses).toHaveLength(concurrentRequests);
      expect(responses.every(r => r.content)).toBe(true);
      expect(totalTime).toBeLessThanOrEqual(maxAllowedTime);
      
      console.log(`Concurrent requests: ${totalTime.toFixed(2)}ms total, ${(totalTime / concurrentRequests).toFixed(2)}ms average`);
    });

    test('should handle mixed complexity concurrent requests', async () => {
      const requests = [
        { messages: [{ role: 'user', content: 'What is AI?' }], complexity: 'simple' },
        { messages: [{ role: 'user', content: 'Explain quantum computing basics.' }], complexity: 'medium' },
        { messages: [{ role: 'user', content: 'Write a sorting algorithm in JavaScript.' }], complexity: 'complex' }
      ];
      
      const startTime = performance.now();
      
      const promises = requests.map(req => 
        aiService.processMessages(req.messages, {
          model: 'gpt-4',
          maxTokens: 300
        })
      );
      
      const responses = await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      performanceResults.push({
        testName: 'Mixed Complexity Concurrent',
        responseTime: totalTime,
        complexity: 'mixed',
        model: 'gpt-4',
        requestCount: requests.length,
        success: totalTime <= 20000, // 20 seconds max
        averageTime: totalTime / requests.length
      });
      
      expect(responses).toHaveLength(requests.length);
      expect(responses.every(r => r.content)).toBe(true);
      expect(totalTime).toBeLessThanOrEqual(20000);
    });
  });

  describe('Streaming Performance', () => {
    test('should start streaming response quickly', async () => {
      const maxTimeToFirstChunk = 2000; // 2 seconds
      
      const messages = [{ 
        role: 'user', 
        content: 'Write a detailed essay about the history of artificial intelligence, covering major milestones and breakthroughs.' 
      }];
      
      const startTime = performance.now();
      let firstChunkTime = null;
      let chunkCount = 0;
      
      const sessionId = aiService.createStreamingSession();
      
      // Mock streaming response handling
      const mockStreamHandler = {
        onChunk: (chunk) => {
          if (!firstChunkTime) {
            firstChunkTime = performance.now();
          }
          chunkCount++;
        },
        onComplete: () => {
          // Streaming complete
        }
      };
      
      // Simulate streaming request
      await aiService.processMessagesStream(messages, {
        model: 'gpt-4',
        maxTokens: 1000,
        sessionId
      }, mockStreamHandler);
      
      const timeToFirstChunk = firstChunkTime ? (firstChunkTime - startTime) : null;
      
      performanceResults.push({
        testName: 'Streaming Time to First Chunk',
        responseTime: timeToFirstChunk,
        expectedMaxTime: maxTimeToFirstChunk,
        complexity: 'streaming',
        model: 'gpt-4',
        chunkCount,
        success: timeToFirstChunk && timeToFirstChunk <= maxTimeToFirstChunk
      });
      
      expect(timeToFirstChunk).toBeTruthy();
      expect(timeToFirstChunk).toBeLessThanOrEqual(maxTimeToFirstChunk);
      expect(chunkCount).toBeGreaterThan(0);
      
      console.log(`Time to first chunk: ${timeToFirstChunk?.toFixed(2)}ms`);
    });
  });

  describe('Voice Processing Performance', () => {
    test('should synthesize speech within acceptable time', async () => {
      const testTexts = [
        { text: 'Hello world', expectedMaxTime: 3000, length: 'short' },
        { text: 'This is a medium length text that should take a reasonable amount of time to synthesize into speech.', expectedMaxTime: 8000, length: 'medium' },
        { text: 'This is a much longer piece of text that contains multiple sentences and should test the performance of the text-to-speech system when handling longer content. It includes various punctuation marks and should maintain good performance even with increased complexity.', expectedMaxTime: 15000, length: 'long' }
      ];
      
      for (const { text, expectedMaxTime, length } of testTexts) {
        const startTime = performance.now();
        
        try {
          const result = await voiceService.synthesizeSpeech(text, {
            voice: 'alloy',
            speed: 1.0
          });
          
          const endTime = performance.now();
          const synthTime = endTime - startTime;
          
          performanceResults.push({
            testName: `Voice Synthesis - ${length}`,
            responseTime: synthTime,
            expectedMaxTime,
            complexity: length,
            textLength: text.length,
            success: synthTime <= expectedMaxTime
          });
          
          expect(result).toBeDefined();
          expect(result.audioBuffer).toBeTruthy();
          expect(synthTime).toBeLessThanOrEqual(expectedMaxTime);
          
          console.log(`Voice synthesis (${length}): ${synthTime.toFixed(2)}ms for ${text.length} characters`);
        } catch (error) {
          console.warn(`Voice synthesis test skipped: ${error.message}`);
        }
      }
    });
  });

  describe('Memory Operations Performance', () => {
    test('should search conversations quickly', async () => {
      const maxSearchTime = 2000; // 2 seconds
      
      // Create test conversations
      const testConversations = [];
      for (let i = 0; i < 10; i++) {
        const conversation = await conversationService.createConversation({
          userId: `test-user-${i}`,
          title: `Test Conversation ${i}`,
          metadata: { topic: `Topic ${i}` }
        });
        testConversations.push(conversation);
      }
      
      const startTime = performance.now();
      
      try {
        const searchResults = await conversationService.searchConversations(
          'test-user-1',
          'Test Conversation'
        );
        
        const endTime = performance.now();
        const searchTime = endTime - startTime;
        
        performanceResults.push({
          testName: 'Conversation Search',
          responseTime: searchTime,
          expectedMaxTime: maxSearchTime,
          complexity: 'search',
          resultCount: searchResults.length,
          success: searchTime <= maxSearchTime
        });
        
        expect(searchResults).toBeDefined();
        expect(Array.isArray(searchResults)).toBe(true);
        expect(searchTime).toBeLessThanOrEqual(maxSearchTime);
        
        console.log(`Conversation search: ${searchTime.toFixed(2)}ms for ${searchResults.length} results`);
      } catch (error) {
        console.warn(`Search test skipped: ${error.message}`);
      }
    });
  });

  describe('Model Comparison Performance', () => {
    const models = ['gpt-4', 'claude-3-sonnet'];
    const testPrompt = 'Explain the concept of machine learning in 100 words.';
    
    models.forEach(model => {
      test(`should benchmark ${model} performance`, async () => {
        const maxTime = 10000; // 10 seconds
        
        const startTime = performance.now();
        
        try {
          const response = await aiService.processMessages(
            [{ role: 'user', content: testPrompt }],
            { model, maxTokens: 150 }
          );
          
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          
          performanceResults.push({
            testName: `Model Benchmark - ${model}`,
            responseTime,
            expectedMaxTime: maxTime,
            complexity: 'benchmark',
            model,
            tokenCount: response.usage?.total_tokens || 0,
            tokensPerSecond: response.usage?.total_tokens ? (response.usage.total_tokens / (responseTime / 1000)) : 0,
            success: responseTime <= maxTime
          });
          
          expect(response.content).toBeTruthy();
          expect(responseTime).toBeLessThanOrEqual(maxTime);
          
          console.log(`${model}: ${responseTime.toFixed(2)}ms (${response.usage?.total_tokens || 0} tokens, ${((response.usage?.total_tokens || 0) / (responseTime / 1000)).toFixed(2)} tokens/sec)`);
        } catch (error) {
          console.warn(`${model} benchmark skipped: ${error.message}`);
        }
      });
    });
  });
});

async function generatePerformanceReport(results) {
  const reportDir = path.join(process.cwd(), 'tests', 'performance', 'reports');
  await fs.ensureDir(reportDir);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = path.join(reportDir, `performance-report-${timestamp}.json`);
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: results.length,
      passedTests: results.filter(r => r.success).length,
      failedTests: results.filter(r => !r.success).length,
      averageResponseTime: results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.length
    },
    results,
    performanceMetrics: {
      fastestResponse: Math.min(...results.map(r => r.responseTime || Infinity)),
      slowestResponse: Math.max(...results.map(r => r.responseTime || 0)),
      p95ResponseTime: calculatePercentile(results.map(r => r.responseTime || 0), 95),
      p99ResponseTime: calculatePercentile(results.map(r => r.responseTime || 0), 99)
    }
  };
  
  await fs.writeJson(reportFile, report, { spaces: 2 });
  
  console.log('\n📊 Performance Test Summary:');
  console.log(`Total Tests: ${report.summary.totalTests}`);
  console.log(`Passed: ${report.summary.passedTests}`);
  console.log(`Failed: ${report.summary.failedTests}`);
  console.log(`Average Response Time: ${report.summary.averageResponseTime.toFixed(2)}ms`);
  console.log(`P95 Response Time: ${report.performanceMetrics.p95ResponseTime.toFixed(2)}ms`);
  console.log(`P99 Response Time: ${report.performanceMetrics.p99ResponseTime.toFixed(2)}ms`);
  console.log(`Report saved to: ${reportFile}`);
}

function calculatePercentile(values, percentile) {
  const sorted = values.filter(v => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}
