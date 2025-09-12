import EventEmitter from 'events';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

export class StreamingService extends EventEmitter {
    constructor() {
        super();
        this.activeStreams = new Map();
        this.streamHistory = new Map();
        this.maxConcurrentStreams = 100;
        this.streamTimeout = 30000; // 30 seconds
    }

    /**
     * Create a new Server-Sent Events stream
     */
    createSSEStream(req, res, streamId) {
        try {
            // Set SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            });

            // Create stream object
            const stream = {
                id: streamId,
                response: res,
                request: req,
                startTime: Date.now(),
                messageCount: 0,
                isActive: true,
                userId: req.user?.id,
                sessionId: req.headers['x-session-id']
            };

            // Check concurrent stream limit
            if (this.activeStreams.size >= this.maxConcurrentStreams) {
                throw new ApiError(429, 'Maximum concurrent streams reached');
            }

            // Store stream
            this.activeStreams.set(streamId, stream);

            // Send initial connection event
            this.sendSSEMessage(streamId, 'connected', {
                streamId,
                timestamp: new Date().toISOString(),
                message: 'Stream connected successfully'
            });

            // Handle client disconnect
            req.on('close', () => {
                this.closeStream(streamId);
            });

            // Set timeout
            setTimeout(() => {
                if (this.activeStreams.has(streamId)) {
                    this.closeStream(streamId, 'timeout');
                }
            }, this.streamTimeout);

            logger.info('SSE stream created', { streamId, userId: stream.userId });
            return stream;

        } catch (error) {
            logger.error('Failed to create SSE stream', { error: error.message, streamId });
            throw error;
        }
    }

    /**
     * Send message to SSE stream
     */
    sendSSEMessage(streamId, event, data) {
        const stream = this.activeStreams.get(streamId);
        if (!stream || !stream.isActive) {
            return false;
        }

        try {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            stream.response.write(message);
            stream.messageCount++;

            // Store in history for debugging
            if (!this.streamHistory.has(streamId)) {
                this.streamHistory.set(streamId, []);
            }
            this.streamHistory.get(streamId).push({
                event,
                data,
                timestamp: Date.now()
            });

            return true;
        } catch (error) {
            logger.error('Failed to send SSE message', { error: error.message, streamId });
            this.closeStream(streamId, 'error');
            return false;
        }
    }

    /**
     * Stream AI response in chunks
     */
    async streamAIResponse(streamId, aiService, prompt, options = {}) {
        try {
            this.sendSSEMessage(streamId, 'ai_start', {
                prompt: prompt.substring(0, 100) + '...',
                model: options.model || 'default'
            });

            const stream = await aiService.streamResponse(prompt, options);
            let fullResponse = '';

            for await (const chunk of stream) {
                if (!this.activeStreams.has(streamId)) {
                    break; // Stream was closed
                }

                if (chunk.delta) {
                    fullResponse += chunk.delta;
                    this.sendSSEMessage(streamId, 'ai_chunk', {
                        delta: chunk.delta,
                        totalLength: fullResponse.length
                    });
                }

                if (chunk.finishReason) {
                    this.sendSSEMessage(streamId, 'ai_complete', {
                        fullResponse,
                        finishReason: chunk.finishReason,
                        usage: chunk.usage
                    });
                    break;
                }
            }

        } catch (error) {
            logger.error('AI streaming error', { error: error.message, streamId });
            this.sendSSEMessage(streamId, 'ai_error', {
                error: error.message,
                code: error.code || 'AI_STREAM_ERROR'
            });
        }
    }

    /**
     * Close a stream
     */
    closeStream(streamId, reason = 'client_disconnect') {
        const stream = this.activeStreams.get(streamId);
        if (!stream) return;

        try {
            if (stream.isActive) {
                this.sendSSEMessage(streamId, 'disconnect', {
                    reason,
                    duration: Date.now() - stream.startTime,
                    messageCount: stream.messageCount
                });

                stream.response.end();
            }

            stream.isActive = false;
            this.activeStreams.delete(streamId);

            logger.info('SSE stream closed', { 
                streamId, 
                reason, 
                duration: Date.now() - stream.startTime,
                messageCount: stream.messageCount
            });

            // Cleanup history after some time
            setTimeout(() => {
                this.streamHistory.delete(streamId);
            }, 60000); // Keep for 1 minute for debugging

        } catch (error) {
            logger.error('Error closing stream', { error: error.message, streamId });
        }
    }

    /**
     * Get stream statistics
     */
    getStreamStats() {
        return {
            activeStreams: this.activeStreams.size,
            maxConcurrentStreams: this.maxConcurrentStreams,
            totalStreamsInHistory: this.streamHistory.size,
            streamDetails: Array.from(this.activeStreams.values()).map(stream => ({
                id: stream.id,
                userId: stream.userId,
                sessionId: stream.sessionId,
                duration: Date.now() - stream.startTime,
                messageCount: stream.messageCount,
                isActive: stream.isActive
            }))
        };
    }

    /**
     * Broadcast message to multiple streams
     */
    broadcast(event, data, filter = {}) {
        let sent = 0;
        
        for (const [streamId, stream] of this.activeStreams) {
            // Apply filters
            if (filter.userId && stream.userId !== filter.userId) continue;
            if (filter.sessionId && stream.sessionId !== filter.sessionId) continue;
            
            if (this.sendSSEMessage(streamId, event, data)) {
                sent++;
            }
        }

        logger.info('Broadcast message sent', { event, recipients: sent });
        return sent;
    }

    /**
     * Health check for streaming service
     */
    getHealth() {
        return {
            status: 'healthy',
            activeStreams: this.activeStreams.size,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
        };
    }
}

// Singleton instance
export const streamingService = new StreamingService();