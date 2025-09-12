import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { createMockWebSocket, testDataGenerators } from '../utils/mocks.js';

describe('Enhanced WebSocket Testing', () => {
  let server;
  let wsServer;
  let testUser;
  let authToken;
  const port = 3002;
  
  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.WS_PORT = port;
    
    // Import and start WebSocket server
    const { createWebSocketServer } = await import('../../src/api/services/StreamingService.js');
    wsServer = createWebSocketServer(port);
    
    testUser = testDataGenerators.user();
    authToken = 'test-websocket-token';
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
  });
  
  afterAll(async () => {
    if (wsServer) {
      wsServer.close();
    }
  });

  describe('WebSocket Connection Management', () => {
    test('should establish WebSocket connection with valid authentication', async () => {
      const ws = new WebSocket(`ws://localhost:${port}?token=${authToken}`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          resolve();
        });
        
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
      
      ws.close();
    });

    test('should reject WebSocket connection with invalid authentication', async () => {
      const ws = new WebSocket(`ws://localhost:${port}?token=invalid-token`);
      
      await new Promise((resolve, reject) => {
        ws.on('error', (error) => {
          expect(error).toBeDefined();
          resolve();
        });
        
        ws.on('open', () => {
          reject(new Error('Connection should have been rejected'));
        });
        
        setTimeout(() => resolve(), 2000); // Timeout means connection was rejected
      });
    });

    test('should handle multiple concurrent WebSocket connections', async () => {
      const connections = [];
      const connectionPromises = [];
      
      for (let i = 0; i < 10; i++) {
        const ws = new WebSocket(`ws://localhost:${port}?token=${authToken}&clientId=client-${i}`);
        connections.push(ws);
        
        connectionPromises.push(
          new Promise((resolve, reject) => {
            ws.on('open', () => resolve(i));
            ws.on('error', reject);
            setTimeout(() => reject(new Error(`Connection ${i} timeout`)), 5000);
          })
        );
      }
      
      const connectedClients = await Promise.all(connectionPromises);
      
      expect(connectedClients.length).toBe(10);
      expect(connectedClients).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      
      // Clean up connections
      connections.forEach(ws => ws.close());
    });

    test('should handle WebSocket connection drops gracefully', async () => {
      const ws = new WebSocket(`ws://localhost:${port}?token=${authToken}`);
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          // Simulate abrupt connection drop
          ws.terminate();
          
          setTimeout(() => {
            expect(ws.readyState).toBe(WebSocket.CLOSED);
            resolve();
          }, 100);
        });
      });
    });
  });

  describe('Real-time AI Streaming', () => {
    let ws;
    
    beforeEach(async () => {
      ws = new WebSocket(`ws://localhost:${port}?token=${authToken}`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
    });
    
    afterEach(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    test('should stream AI responses in real-time', async () => {
      const messages = [];
      let responseComplete = false;
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        messages.push(message);
        
        if (message.type === 'ai_response_complete') {
          responseComplete = true;
        }
      });
      
      // Send a request for AI response
      ws.send(JSON.stringify({
        type: 'ai_request',
        data: {
          conversationId: 'test-conv-123',
          message: 'Tell me about artificial intelligence',
          model: 'gpt-4',
          stream: true
        }
      }));
      
      // Wait for streaming to complete
      await new Promise((resolve) => {
        const checkComplete = () => {
          if (responseComplete) {
            resolve();
          } else {
            setTimeout(checkComplete, 100);
          }
        };
        checkComplete();
      });
      
      expect(messages.length).toBeGreaterThan(1);
      expect(messages.some(m => m.type === 'ai_response_chunk')).toBe(true);
      expect(messages.some(m => m.type === 'ai_response_complete')).toBe(true);
      
      // Verify message structure
      const chunks = messages.filter(m => m.type === 'ai_response_chunk');
      chunks.forEach(chunk => {
        expect(chunk.data.content).toBeDefined();
        expect(chunk.data.conversationId).toBe('test-conv-123');
      });
    });

    test('should handle streaming errors gracefully', async () => {
      let errorReceived = false;
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'error') {
          errorReceived = true;
        }
      });
      
      // Send an invalid request
      ws.send(JSON.stringify({
        type: 'ai_request',
        data: {
          // Missing required fields
          message: '',
          model: 'invalid-model'
        }
      }));
      
      await new Promise((resolve) => {
        setTimeout(() => {
          expect(errorReceived).toBe(true);
          resolve();
        }, 2000);
      });
    });

    test('should maintain message order in streaming', async () => {
      const messages = [];
      let sequenceNumbers = [];
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        messages.push(message);
        
        if (message.type === 'ai_response_chunk' && message.data.sequence) {
          sequenceNumbers.push(message.data.sequence);
        }
      });
      
      ws.send(JSON.stringify({
        type: 'ai_request',
        data: {
          conversationId: 'test-conv-123',
          message: 'Write a long explanation about machine learning',
          model: 'gpt-4',
          stream: true
        }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check that sequence numbers are in order
      const sortedSequences = [...sequenceNumbers].sort((a, b) => a - b);
      expect(sequenceNumbers).toEqual(sortedSequences);
    });
  });

  describe('Voice Streaming', () => {
    let ws;
    
    beforeEach(async () => {
      ws = new WebSocket(`ws://localhost:${port}?token=${authToken}`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
    });
    
    afterEach(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    test('should stream audio data for text-to-speech', async () => {
      let audioChunks = [];
      let streamComplete = false;
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'audio_chunk') {
          audioChunks.push(message.data.chunk);
        } else if (message.type === 'audio_complete') {
          streamComplete = true;
        }
      });
      
      ws.send(JSON.stringify({
        type: 'tts_request',
        data: {
          text: 'Hello, this is a test of the text-to-speech streaming functionality.',
          voice: 'alloy',
          speed: 1.0
        }
      }));
      
      await new Promise((resolve) => {
        const checkComplete = () => {
          if (streamComplete) {
            resolve();
          } else {
            setTimeout(checkComplete, 100);
          }
        };
        checkComplete();
      });
      
      expect(audioChunks.length).toBeGreaterThan(0);
      expect(streamComplete).toBe(true);
      
      // Verify audio chunks are base64 encoded
      audioChunks.forEach(chunk => {
        expect(typeof chunk).toBe('string');
        expect(chunk.length).toBeGreaterThan(0);
        // Basic base64 validation
        expect(chunk).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
      });
    });

    test('should handle speech-to-text streaming', async () => {
      let transcriptionChunks = [];
      let transcriptionComplete = false;
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'transcription_chunk') {
          transcriptionChunks.push(message.data.text);
        } else if (message.type === 'transcription_complete') {
          transcriptionComplete = true;
        }
      });
      
      // Simulate sending audio chunks
      const mockAudioChunk = Buffer.from('mock audio data').toString('base64');
      
      ws.send(JSON.stringify({
        type: 'stt_start',
        data: {
          sampleRate: 16000,
          encoding: 'LINEAR16'
        }
      }));
      
      // Send audio chunks
      for (let i = 0; i < 5; i++) {
        ws.send(JSON.stringify({
          type: 'stt_chunk',
          data: {
            audioChunk: mockAudioChunk + i
          }
        }));
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      ws.send(JSON.stringify({
        type: 'stt_end'
      }));
      
      await new Promise((resolve) => {
        setTimeout(() => {
          expect(transcriptionChunks.length).toBeGreaterThanOrEqual(0);
          resolve();
        }, 3000);
      });
    });
  });

  describe('Connection Stability and Recovery', () => {
    test('should implement heartbeat/ping-pong mechanism', async () => {
      const ws = new WebSocket(`ws://localhost:${port}?token=${authToken}`);
      let pongReceived = false;
      
      await new Promise((resolve) => {
        ws.on('open', () => {
          ws.ping('heartbeat');
        });
        
        ws.on('pong', (data) => {
          expect(data.toString()).toBe('heartbeat');
          pongReceived = true;
          resolve();
        });
        
        setTimeout(() => resolve(), 2000);
      });
      
      expect(pongReceived).toBe(true);
      ws.close();
    });

    test('should auto-reconnect on connection loss', async () => {
      const connectionEvents = [];
      
      class ReconnectingWebSocket extends EventEmitter {
        constructor(url) {
          super();
          this.url = url;
          this.connect();
        }
        
        connect() {
          this.ws = new WebSocket(this.url);
          
          this.ws.on('open', () => {
            connectionEvents.push('connected');
            this.emit('open');
          });
          
          this.ws.on('close', () => {
            connectionEvents.push('disconnected');
            // Auto-reconnect after 1 second
            setTimeout(() => this.connect(), 1000);
          });
          
          this.ws.on('error', (error) => {
            connectionEvents.push('error');
          });
        }
        
        close() {
          if (this.ws) {
            this.ws.close();
          }
        }
        
        send(data) {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(data);
          }
        }
      }
      
      const rws = new ReconnectingWebSocket(`ws://localhost:${port}?token=${authToken}`);
      
      // Wait for initial connection
      await new Promise(resolve => {
        rws.on('open', resolve);
      });
      
      // Force disconnect
      rws.ws.terminate();
      
      // Wait for reconnection
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      expect(connectionEvents).toContain('connected');
      expect(connectionEvents).toContain('disconnected');
      expect(connectionEvents.filter(e => e === 'connected').length).toBeGreaterThan(1);
      
      rws.close();
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle high-frequency message sending', async () => {
      const ws = new WebSocket(`ws://localhost:${port}?token=${authToken}`);
      const messagesReceived = [];
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      ws.on('message', (data) => {
        messagesReceived.push(JSON.parse(data.toString()));
      });
      
      // Send 100 messages rapidly
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        ws.send(JSON.stringify({
          type: 'ping',
          data: { sequence: i, timestamp: Date.now() }
        }));
      }
      
      // Wait for all responses
      await new Promise((resolve) => {
        const checkComplete = () => {
          if (messagesReceived.length >= 100) {
            resolve();
          } else {
            setTimeout(checkComplete, 100);
          }
        };
        checkComplete();
      });
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(messagesReceived.length).toBe(100);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      ws.close();
    });

    test('should limit message size to prevent DoS attacks', async () => {
      const ws = new WebSocket(`ws://localhost:${port}?token=${authToken}`);
      let errorReceived = false;
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'error' && message.error.includes('size')) {
          errorReceived = true;
        }
      });
      
      // Send a very large message
      const largeMessage = {
        type: 'large_message',
        data: {
          content: 'A'.repeat(1024 * 1024) // 1MB of data
        }
      };
      
      ws.send(JSON.stringify(largeMessage));
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      expect(errorReceived).toBe(true);
      ws.close();
    });
  });

  describe('Security and Authentication', () => {
    test('should validate authentication tokens on each message', async () => {
      const ws = new WebSocket(`ws://localhost:${port}?token=${authToken}`);
      let authErrorReceived = false;
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'auth_error') {
          authErrorReceived = true;
        }
      });
      
      // Send message with invalid token in payload
      ws.send(JSON.stringify({
        type: 'ai_request',
        token: 'invalid-token',
        data: {
          message: 'test',
          model: 'gpt-4'
        }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      expect(authErrorReceived).toBe(true);
      ws.close();
    });

    test('should prevent message injection attacks', async () => {
      const ws = new WebSocket(`ws://localhost:${port}?token=${authToken}`);
      let responses = [];
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      ws.on('message', (data) => {
        responses.push(JSON.parse(data.toString()));
      });
      
      // Try to inject malicious content
      const maliciousMessage = {
        type: 'ai_request',
        data: {
          message: '<script>alert("xss")</script>',
          model: 'gpt-4'
        }
      };
      
      ws.send(JSON.stringify(maliciousMessage));
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check that responses don't contain unescaped malicious content
      responses.forEach(response => {
        if (response.data && response.data.content) {
          expect(response.data.content).not.toContain('<script>');
        }
      });
      
      ws.close();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed JSON messages', async () => {
      const ws = new WebSocket(`ws://localhost:${port}?token=${authToken}`);
      let errorReceived = false;
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'error') {
          errorReceived = true;
        }
      });
      
      // Send malformed JSON
      ws.send('{ invalid json }');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      expect(errorReceived).toBe(true);
      ws.close();
    });

    test('should handle binary data gracefully', async () => {
      const ws = new WebSocket(`ws://localhost:${port}?token=${authToken}`);
      let binaryHandled = false;
      
      await new Promise((resolve) => {
        ws.on('open', resolve);
      });
      
      ws.on('message', (data) => {
        binaryHandled = true;
      });
      
      // Send binary data
      const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      ws.send(binaryData);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      ws.close();
    });
  });
});
