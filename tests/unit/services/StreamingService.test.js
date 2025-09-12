import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { StreamingService } from '../../../src/api/services/StreamingService.js';
import { createMockRequest, createMockResponse, createMockWebSocket, resetAllMocks } from '../../utils/mocks.js';
import EventEmitter from 'events';

describe('StreamingService', () => {
  let streamingService;
  let mockReq;
  let mockRes;
  let mockWs;
  
  beforeEach(() => {
    resetAllMocks();
    streamingService = new StreamingService();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockWs = createMockWebSocket();
  });
  
  afterEach(() => {
    resetAllMocks();
    // Clean up any active streams
    streamingService.activeStreams.clear();
    streamingService.streamHistory.clear();
  });

  describe('Initialization', () => {
    test('should initialize with proper configuration', () => {
      expect(streamingService).toBeDefined();
      expect(streamingService.activeStreams).toBeInstanceOf(Map);
      expect(streamingService.streamHistory).toBeInstanceOf(Map);
      expect(streamingService.maxConcurrentStreams).toBe(100);
      expect(streamingService.streamTimeout).toBe(30000);
    });

    test('should extend EventEmitter', () => {
      expect(streamingService).toBeInstanceOf(EventEmitter);
    });
  });

  describe('SSE Stream Management', () => {
    test('should create SSE stream successfully', () => {
      const streamId = 'stream-123';
      
      streamingService.createSSEStream(mockReq, mockRes, streamId);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }));
      
      expect(streamingService.activeStreams.has(streamId)).toBe(true);
      const stream = streamingService.activeStreams.get(streamId);
      expect(stream.id).toBe(streamId);
      expect(stream.isActive).toBe(true);
    });

    test('should reject stream creation when at max capacity', () => {
      // Fill up to max capacity
      for (let i = 0; i < streamingService.maxConcurrentStreams; i++) {
        const streamId = `stream-${i}`;
        streamingService.activeStreams.set(streamId, {
          id: streamId,
          isActive: true
        });
      }
      
      expect(() => {
        streamingService.createSSEStream(mockReq, mockRes, 'overflow-stream');
      }).toThrow('Maximum concurrent streams reached');
    });

    test('should send SSE message format correctly', () => {
      const streamId = 'stream-123';
      streamingService.createSSEStream(mockReq, mockRes, streamId);
      
      const testData = { message: 'Hello World', timestamp: Date.now() };
      streamingService.sendSSEMessage(streamId, 'test-event', testData);
      
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('event: test-event')
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining(`data: ${JSON.stringify(testData)}`)
      );
    });

    test('should handle stream cleanup', () => {
      const streamId = 'stream-123';
      streamingService.createSSEStream(mockReq, mockRes, streamId);
      
      expect(streamingService.activeStreams.has(streamId)).toBe(true);
      
      streamingService.closeSSEStream(streamId);
      
      expect(streamingService.activeStreams.has(streamId)).toBe(false);
      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe('WebSocket Management', () => {
    test('should handle WebSocket connection', () => {
      const sessionId = 'session-123';
      
      streamingService.handleWebSocketConnection(mockWs, sessionId, mockReq);
      
      expect(streamingService.activeStreams.has(sessionId)).toBe(true);
      const stream = streamingService.activeStreams.get(sessionId);
      expect(stream.type).toBe('websocket');
      expect(stream.socket).toBe(mockWs);
    });

    test('should send WebSocket message', () => {
      const sessionId = 'session-123';
      streamingService.handleWebSocketConnection(mockWs, sessionId, mockReq);
      
      const testData = { type: 'response', content: 'Test message' };
      streamingService.sendWebSocketMessage(sessionId, testData);
      
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(testData));
    });

    test('should handle WebSocket disconnection', () => {
      const sessionId = 'session-123';
      streamingService.handleWebSocketConnection(mockWs, sessionId, mockReq);
      
      expect(streamingService.activeStreams.has(sessionId)).toBe(true);
      
      streamingService.handleWebSocketDisconnection(sessionId);
      
      expect(streamingService.activeStreams.has(sessionId)).toBe(false);
    });
  });

  describe('Stream Metrics', () => {
    test('should track stream metrics', () => {
      const streamId = 'stream-123';
      streamingService.createSSEStream(mockReq, mockRes, streamId);
      
      const metrics = {
        messagesTransmitted: 5,
        dataTransferred: 1024,
        duration: 5000
      };
      
      streamingService.updateStreamMetrics(streamId, metrics);
      
      const streamMetrics = streamingService.getStreamMetrics(streamId);
      expect(streamMetrics.messagesTransmitted).toBe(5);
      expect(streamMetrics.dataTransferred).toBe(1024);
      expect(streamMetrics.duration).toBe(5000);
    });

    test('should calculate throughput metrics', () => {
      const streamId = 'stream-123';
      streamingService.createSSEStream(mockReq, mockRes, streamId);
      
      // Simulate stream activity
      streamingService.updateStreamMetrics(streamId, {
        messagesTransmitted: 10,
        dataTransferred: 2048,
        duration: 10000 // 10 seconds
      });
      
      const throughput = streamingService.calculateStreamThroughput(streamId);
      expect(throughput.messagesPerSecond).toBe(1);
      expect(throughput.bytesPerSecond).toBe(204.8);
    });
  });

  describe('Stream Health Monitoring', () => {
    test('should monitor stream health', () => {
      const streamId = 'stream-123';
      streamingService.createSSEStream(mockReq, mockRes, streamId);
      
      const health = streamingService.checkStreamHealth(streamId);
      
      expect(health.isHealthy).toBe(true);
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.connectionStatus).toBe('active');
    });

    test('should detect unhealthy streams', () => {
      const streamId = 'stream-123';
      streamingService.createSSEStream(mockReq, mockRes, streamId);
      
      // Simulate stream timeout
      const stream = streamingService.activeStreams.get(streamId);
      stream.lastActivity = Date.now() - streamingService.streamTimeout - 1000;
      
      const health = streamingService.checkStreamHealth(streamId);
      expect(health.isHealthy).toBe(false);
      expect(health.issues).toContain('timeout');
    });

    test('should cleanup stale streams', () => {
      const streamId1 = 'stream-123';
      const streamId2 = 'stream-456';
      
      streamingService.createSSEStream(mockReq, mockRes, streamId1);
      streamingService.createSSEStream(mockReq, mockRes, streamId2);
      
      // Make one stream stale
      const stream1 = streamingService.activeStreams.get(streamId1);
      stream1.lastActivity = Date.now() - streamingService.streamTimeout - 1000;
      
      const cleanedCount = streamingService.cleanupStaleStreams();
      
      expect(cleanedCount).toBe(1);
      expect(streamingService.activeStreams.has(streamId1)).toBe(false);
      expect(streamingService.activeStreams.has(streamId2)).toBe(true);
    });
  });

  describe('Stream Events', () => {
    test('should emit stream lifecycle events', () => {
      const connectSpy = jest.fn();
      const disconnectSpy = jest.fn();
      
      streamingService.on('stream:connected', connectSpy);
      streamingService.on('stream:disconnected', disconnectSpy);
      
      const streamId = 'stream-123';
      streamingService.createSSEStream(mockReq, mockRes, streamId);
      
      expect(connectSpy).toHaveBeenCalledWith({
        streamId,
        type: 'sse',
        userId: mockReq.user?.id
      });
      
      streamingService.closeSSEStream(streamId);
      
      expect(disconnectSpy).toHaveBeenCalledWith({
        streamId,
        type: 'sse'
      });
    });

    test('should emit error events', () => {
      const errorSpy = jest.fn();
      streamingService.on('stream:error', errorSpy);
      
      const streamId = 'stream-123';
      const error = new Error('Stream error');
      
      streamingService.handleStreamError(streamId, error);
      
      expect(errorSpy).toHaveBeenCalledWith({
        streamId,
        error,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Broadcast Functionality', () => {
    test('should broadcast to all active streams', () => {
      const streamId1 = 'stream-123';
      const streamId2 = 'stream-456';
      
      streamingService.createSSEStream(mockReq, mockRes, streamId1);
      streamingService.createSSEStream(mockReq, mockRes, streamId2);
      
      const broadcastData = { type: 'announcement', message: 'System update' };
      streamingService.broadcastToAll('announcement', broadcastData);
      
      expect(mockRes.write).toHaveBeenCalledTimes(6); // 3 calls per stream (headers + data + close)
    });

    test('should broadcast to specific user streams', () => {
      const userId = 'user-123';
      const streamId1 = 'stream-123';
      const streamId2 = 'stream-456';
      
      const reqUser = createMockRequest({ user: { id: userId } });
      const reqOther = createMockRequest({ user: { id: 'user-456' } });
      
      streamingService.createSSEStream(reqUser, mockRes, streamId1);
      streamingService.createSSEStream(reqOther, mockRes, streamId2);
      
      const userData = { type: 'personal', message: 'Personal notification' };
      streamingService.broadcastToUser(userId, 'notification', userData);
      
      // Should only send to user's streams
      expect(mockRes.write).toHaveBeenCalledTimes(3); // Only one stream gets the message
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce message rate limits', () => {
      const streamId = 'stream-123';
      streamingService.createSSEStream(mockReq, mockRes, streamId);
      
      // Set a low rate limit for testing
      streamingService.setStreamRateLimit(streamId, 2, 1000); // 2 messages per second
      
      // Send messages rapidly
      streamingService.sendSSEMessage(streamId, 'test', { data: 1 });
      streamingService.sendSSEMessage(streamId, 'test', { data: 2 });
      
      // Third message should be rate limited
      expect(() => {
        streamingService.sendSSEMessage(streamId, 'test', { data: 3 });
      }).toThrow('Rate limit exceeded');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing stream errors', () => {
      expect(() => {
        streamingService.sendSSEMessage('non-existent-stream', 'test', {});
      }).toThrow('Stream not found');
    });

    test('should handle WebSocket errors gracefully', () => {
      const sessionId = 'session-123';
      streamingService.handleWebSocketConnection(mockWs, sessionId, mockReq);
      
      // Simulate WebSocket error
      mockWs.send.mockImplementationOnce(() => {
        throw new Error('WebSocket send failed');
      });
      
      expect(() => {
        streamingService.sendWebSocketMessage(sessionId, { test: 'data' });
      }).not.toThrow(); // Should handle error gracefully
    });

    test('should handle response write errors', () => {
      const streamId = 'stream-123';
      streamingService.createSSEStream(mockReq, mockRes, streamId);
      
      // Simulate response write error
      mockRes.write.mockImplementationOnce(() => {
        throw new Error('Response write failed');
      });
      
      expect(() => {
        streamingService.sendSSEMessage(streamId, 'test', {});
      }).not.toThrow(); // Should handle error gracefully
    });
  });

  describe('Memory Management', () => {
    test('should limit stream history size', () => {
      const maxHistorySize = 1000;
      streamingService.maxHistorySize = maxHistorySize;
      
      // Create many streams to exceed history limit
      for (let i = 0; i < maxHistorySize + 100; i++) {
        const streamId = `stream-${i}`;
        streamingService.createSSEStream(mockReq, mockRes, streamId);
        streamingService.closeSSEStream(streamId);
      }
      
      expect(streamingService.streamHistory.size).toBeLessThanOrEqual(maxHistorySize);
    });
  });
});
