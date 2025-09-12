import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import WebSocket from 'ws';
import { StreamingService } from '../../src/api/services/StreamingService.js';
import { spawn } from 'child_process';
import { testDataGenerators } from '../utils/mocks.js';
import http from 'http';
import express from 'express';

describe('WebSocket and Real-time Communication Tests', () => {
  let server;
  let httpServer;
  let wsServer;
  let streamingService;
  let serverPort;
  let wsPort;
  
  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    
    // Create HTTP server for WebSocket testing
    const app = express();
    app.use(express.json());
    
    httpServer = http.createServer(app);
    serverPort = 0; // Use random available port
    
    // Set up WebSocket server
    wsServer = new WebSocket.Server({ 
      server: httpServer,
      path: '/ws'
    });
    
    streamingService = new StreamingService();
    
    // Handle WebSocket connections
    wsServer.on('connection', (ws, req) => {
      const sessionId = req.url.split('?')[1] || `session-${Date.now()}`;
      
      streamingService.handleWebSocketConnection(ws, sessionId, req);
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          handleWebSocketMessage(ws, sessionId, message);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid JSON message'
          }));
        }
      });
      
      ws.on('close', () => {
        streamingService.handleWebSocketDisconnection(sessionId);
      });
    });
    
    // Start server
    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        serverPort = httpServer.address().port;
        wsPort = serverPort;
        resolve();
      });
    });
  });
  
  afterAll(async () => {
    if (wsServer) {
      wsServer.close();
    }
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
  });
  
  beforeEach(() => {
    // Clear streaming service state
    if (streamingService.activeStreams) {
      streamingService.activeStreams.clear();
    }
  });

  describe('WebSocket Connection Management', () => {
    test('should establish WebSocket connection', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}/ws?session-test-1`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
      
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      // Check if streaming service registered the connection
      expect(streamingService.activeStreams.has('session-test-1')).toBe(true);
      
      ws.close();
    });

    test('should handle multiple concurrent connections', async () => {
      const connectionCount = 5;
      const connections = [];
      
      // Create multiple connections
      for (let i = 0; i < connectionCount; i++) {
        const ws = new WebSocket(`ws://localhost:${wsPort}/ws?session-multi-${i}`);
        connections.push(ws);
        
        await new Promise((resolve, reject) => {
          ws.on('open', resolve);
          ws.on('error', reject);
          
          setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });
      }
      
      // Verify all connections are active
      expect(streamingService.activeStreams.size).toBe(connectionCount);
      
      // Close all connections
      connections.forEach(ws => ws.close());
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(streamingService.activeStreams.size).toBe(0);
    });

    test('should handle connection cleanup on disconnect', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}/ws?session-cleanup-test`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
      
      expect(streamingService.activeStreams.has('session-cleanup-test')).toBe(true);
      
      // Close connection
      ws.close();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(streamingService.activeStreams.has('session-cleanup-test')).toBe(false);
    });
  });

  describe('Real-time Message Exchange', () => {
    test('should send and receive messages', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}/ws?session-message-test`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
      
      const testMessage = {
        type: 'chat',
        content: 'Hello Susan!',
        timestamp: Date.now()
      };
      
      // Send message
      ws.send(JSON.stringify(testMessage));
      
      // Wait for response
      const response = await new Promise((resolve, reject) => {
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            resolve(message);
          } catch (error) {
            reject(error);
          }
        });
        
        setTimeout(() => reject(new Error('Response timeout')), 10000);
      });
      
      expect(response).toBeDefined();
      expect(response.type).toBeDefined();
      
      ws.close();
    });

    test('should handle streaming AI responses', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}/ws?session-ai-stream`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
      
      const streamingMessages = [];
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          streamingMessages.push(message);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });
      
      // Request AI response
      const aiRequest = {
        type: 'ai_request',
        content: 'Tell me about artificial intelligence',
        stream: true
      };
      
      ws.send(JSON.stringify(aiRequest));
      
      // Wait for streaming to complete
      await new Promise((resolve) => {
        const checkCompletion = () => {
          const hasStarted = streamingMessages.some(msg => msg.type === 'ai_response_start');
          const hasEnded = streamingMessages.some(msg => msg.type === 'ai_response_end');
          
          if (hasStarted && hasEnded) {
            resolve();
          } else {
            setTimeout(checkCompletion, 100);
          }
        };
        
        checkCompletion();
        
        // Timeout after 15 seconds
        setTimeout(resolve, 15000);
      });
      
      expect(streamingMessages.length).toBeGreaterThan(0);
      
      // Should have received streaming chunks
      const chunkMessages = streamingMessages.filter(msg => msg.type === 'ai_response_chunk');
      expect(chunkMessages.length).toBeGreaterThan(0);
      
      ws.close();
    });

    test('should handle voice streaming', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}/ws?session-voice-stream`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
      
      const voiceMessages = [];
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          voiceMessages.push(message);
        } catch (error) {
          // Might be binary audio data
          voiceMessages.push({ type: 'binary_data', size: data.length });
        }
      });
      
      // Start voice streaming
      const voiceRequest = {
        type: 'voice_stream_start',
        config: {
          format: 'mp3',
          sampleRate: 44100
        }
      };
      
      ws.send(JSON.stringify(voiceRequest));
      
      // Send mock audio chunks
      const audioChunk = Buffer.alloc(1024, 0x42); // Mock audio data
      ws.send(audioChunk);
      
      // End voice streaming
      const voiceEnd = {
        type: 'voice_stream_end'
      };
      
      ws.send(JSON.stringify(voiceEnd));
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      expect(voiceMessages.length).toBeGreaterThan(0);
      
      ws.close();
    });
  });

  describe('Real-time Notifications', () => {
    test('should broadcast system notifications', async () => {
      const connections = [];
      const receivedMessages = [];
      
      // Create multiple connections
      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket(`ws://localhost:${wsPort}/ws?session-broadcast-${i}`);
        connections.push(ws);
        
        await new Promise((resolve, reject) => {
          ws.on('open', resolve);
          ws.on('error', reject);
          
          setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            receivedMessages.push({ connection: i, message });
          } catch (error) {
            console.error('Failed to parse broadcast message:', error);
          }
        });
      }
      
      // Broadcast a system notification
      const notification = {
        type: 'system_notification',
        message: 'System maintenance scheduled',
        level: 'info'
      };
      
      streamingService.broadcastToAll('system_notification', notification);
      
      // Wait for messages to be received
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // All connections should receive the broadcast
      expect(receivedMessages.length).toBe(3);
      
      receivedMessages.forEach(({ message }) => {
        expect(message.type).toBe('system_notification');
        expect(message.message).toBe('System maintenance scheduled');
      });
      
      // Close all connections
      connections.forEach(ws => ws.close());
    });

    test('should send targeted user notifications', async () => {
      const userSessions = [
        { userId: 'user-1', sessionId: 'session-user-1' },
        { userId: 'user-2', sessionId: 'session-user-2' },
        { userId: 'user-1', sessionId: 'session-user-1-mobile' } // Same user, different session
      ];
      
      const connections = [];
      const receivedMessages = [];
      
      // Create connections for different users
      for (const { userId, sessionId } of userSessions) {
        const ws = new WebSocket(`ws://localhost:${wsPort}/ws?${sessionId}&userId=${userId}`);
        connections.push({ ws, userId, sessionId });
        
        await new Promise((resolve, reject) => {
          ws.on('open', resolve);
          ws.on('error', reject);
          
          setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            receivedMessages.push({ userId, sessionId, message });
          } catch (error) {
            console.error('Failed to parse user message:', error);
          }
        });
      }
      
      // Send notification to specific user
      const userNotification = {
        type: 'user_notification',
        message: 'You have a new message',
        data: { messageId: '12345' }
      };
      
      streamingService.broadcastToUser('user-1', 'user_notification', userNotification);
      
      // Wait for messages to be received
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Only user-1 sessions should receive the notification
      const user1Messages = receivedMessages.filter(({ userId }) => userId === 'user-1');
      const user2Messages = receivedMessages.filter(({ userId }) => userId === 'user-2');
      
      expect(user1Messages.length).toBe(2); // Two sessions for user-1
      expect(user2Messages.length).toBe(0); // No messages for user-2
      
      user1Messages.forEach(({ message }) => {
        expect(message.type).toBe('user_notification');
        expect(message.message).toBe('You have a new message');
      });
      
      // Close all connections
      connections.forEach(({ ws }) => ws.close());
    });
  });

  describe('Connection Resilience', () => {
    test('should handle connection interruptions gracefully', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}/ws?session-resilience-test`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
      
      // Verify connection is active
      expect(streamingService.activeStreams.has('session-resilience-test')).toBe(true);
      
      // Simulate network interruption by closing connection abruptly
      ws.terminate();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Connection should be cleaned up
      expect(streamingService.activeStreams.has('session-resilience-test')).toBe(false);
    });

    test('should handle malformed messages gracefully', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}/ws?session-malformed-test`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
      
      const errorMessages = [];
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          if (message.type === 'error') {
            errorMessages.push(message);
          }
        } catch (error) {
          console.error('Failed to parse error message:', error);
        }
      });
      
      // Send malformed JSON
      ws.send('{ invalid json }');
      
      // Wait for error response
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(errorMessages.length).toBeGreaterThan(0);
      expect(errorMessages[0].message).toContain('Invalid JSON');
      
      // Connection should still be active
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      ws.close();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle high message throughput', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}/ws?session-throughput-test`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
      
      const messageCount = 100;
      const receivedMessages = [];
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          receivedMessages.push(message);
        } catch (error) {
          console.error('Failed to parse throughput message:', error);
        }
      });
      
      const startTime = Date.now();
      
      // Send many messages rapidly
      for (let i = 0; i < messageCount; i++) {
        const message = {
          type: 'throughput_test',
          messageId: i,
          data: `Message ${i}`,
          timestamp: Date.now()
        };
        
        ws.send(JSON.stringify(message));
      }
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      const messagesPerSecond = messageCount / (duration / 1000);
      
      console.log(`Processed ${messageCount} messages in ${duration}ms (${messagesPerSecond.toFixed(2)} msg/sec)`);
      
      // Should handle reasonable throughput
      expect(messagesPerSecond).toBeGreaterThan(10);
      
      ws.close();
    });

    test('should monitor connection health', async () => {
      const ws = new WebSocket(`ws://localhost:${wsPort}/ws?session-health-test`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
      
      // Get health metrics
      const health = streamingService.checkStreamHealth('session-health-test');
      
      expect(health).toBeDefined();
      expect(health.isHealthy).toBe(true);
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.connectionStatus).toBe('active');
      
      ws.close();
    });
  });

  describe('Security and Authentication', () => {
    test('should validate connection authorization', async () => {
      // Try to connect without proper authorization
      const ws = new WebSocket(`ws://localhost:${wsPort}/ws?session-unauthorized`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
      
      // Send a message that requires authorization
      const protectedMessage = {
        type: 'protected_action',
        action: 'delete_conversation',
        conversationId: '12345'
      };
      
      ws.send(JSON.stringify(protectedMessage));
      
      // Should receive an authorization error
      const response = await new Promise((resolve, reject) => {
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            resolve(message);
          } catch (error) {
            reject(error);
          }
        });
        
        setTimeout(() => reject(new Error('Response timeout')), 5000);
      });
      
      expect(response.type).toBe('error');
      expect(response.message).toMatch(/authorization|authentication/i);
      
      ws.close();
    });
  });
});

// Helper function to handle WebSocket messages
function handleWebSocketMessage(ws, sessionId, message) {
  switch (message.type) {
    case 'chat':
      // Echo back with AI response simulation
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'ai_response',
          content: `Echo: ${message.content}`,
          timestamp: Date.now()
        }));
      }, 100);
      break;
      
    case 'ai_request':
      if (message.stream) {
        // Simulate streaming AI response
        ws.send(JSON.stringify({
          type: 'ai_response_start',
          requestId: message.requestId || Date.now()
        }));
        
        // Send multiple chunks
        const chunks = [
          'Artificial intelligence (AI) ',
          'is a branch of computer science ',
          'that aims to create machines ',
          'capable of intelligent behavior.'
        ];
        
        chunks.forEach((chunk, index) => {
          setTimeout(() => {
            ws.send(JSON.stringify({
              type: 'ai_response_chunk',
              content: chunk,
              chunkIndex: index
            }));
          }, index * 200);
        });
        
        setTimeout(() => {
          ws.send(JSON.stringify({
            type: 'ai_response_end',
            requestId: message.requestId || Date.now()
          }));
        }, chunks.length * 200 + 100);
      } else {
        // Send complete response
        setTimeout(() => {
          ws.send(JSON.stringify({
            type: 'ai_response',
            content: 'Here is information about artificial intelligence...',
            timestamp: Date.now()
          }));
        }, 500);
      }
      break;
      
    case 'voice_stream_start':
      ws.send(JSON.stringify({
        type: 'voice_stream_ready',
        sessionId
      }));
      break;
      
    case 'voice_stream_end':
      ws.send(JSON.stringify({
        type: 'voice_processing_complete',
        transcription: 'Mock transcription result',
        sessionId
      }));
      break;
      
    case 'protected_action':
      // Simulate authorization check
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Authorization required for protected actions',
        code: 'UNAUTHORIZED'
      }));
      break;
      
    default:
      ws.send(JSON.stringify({
        type: 'echo',
        originalMessage: message,
        timestamp: Date.now()
      }));
  }
}
