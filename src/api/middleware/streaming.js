import { v4 as uuidv4 } from 'uuid';
import { streamingService } from '../services/StreamingService.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Middleware to set up Server-Sent Events (SSE) streaming
 */
export const setupSSE = (req, res, next) => {
    try {
        // Generate unique stream ID
        const streamId = req.query.stream_id || req.headers['x-stream-id'] || uuidv4();
        
        // Check if client accepts SSE
        const acceptsSSE = req.headers.accept && req.headers.accept.includes('text/event-stream');
        
        if (!acceptsSSE) {
            return res.status(400).json({
                error: 'Client must accept text/event-stream',
                required_header: 'Accept: text/event-stream'
            });
        }

        // Create SSE stream
        const stream = streamingService.createSSEStream(req, res, streamId);
        
        // Add stream info to request
        req.stream = stream;
        req.streamId = streamId;
        
        logger.info('SSE stream established', { 
            streamId, 
            userAgent: req.headers['user-agent'],
            ip: req.ip 
        });

        next();
        
    } catch (error) {
        logger.error('SSE setup failed', { error: error.message });
        next(error);
    }
};

/**
 * Middleware to enable streaming responses for API endpoints
 */
export const enableStreaming = (req, res, next) => {
    // Add streaming utilities to response object
    res.streamMessage = (event, data) => {
        if (req.streamId) {
            return streamingService.sendSSEMessage(req.streamId, event, data);
        }
        return false;
    };

    res.streamError = (error) => {
        if (req.streamId) {
            return streamingService.sendSSEMessage(req.streamId, 'error', {
                message: error.message,
                code: error.code || 'UNKNOWN_ERROR',
                timestamp: new Date().toISOString()
            });
        }
        return false;
    };

    res.streamProgress = (progress) => {
        if (req.streamId) {
            return streamingService.sendSSEMessage(req.streamId, 'progress', {
                percentage: progress.percentage || 0,
                message: progress.message || '',
                timestamp: new Date().toISOString()
            });
        }
        return false;
    };

    next();
};

/**
 * Enhanced WebSocket manager for real-time collaboration
 */
export class EnhancedWebSocketManager {
    constructor() {
        this.connections = new Map();
        this.rooms = new Map();
        this.userSessions = new Map();
        this.messageQueue = new Map();
    }

    /**
     * Handle new WebSocket connection
     */
    handleConnection(ws, req) {
        const sessionId = uuidv4();
        const userId = req.user?.id || `anonymous_${Date.now()}`;
        
        const connection = {
            id: sessionId,
            userId,
            ws,
            joinedAt: Date.now(),
            lastActivity: Date.now(),
            rooms: new Set(),
            metadata: {
                userAgent: req.headers['user-agent'],
                ip: req.ip,
                origin: req.headers.origin
            }
        };

        this.connections.set(sessionId, connection);
        this.updateUserSession(userId, sessionId);

        // Send welcome message
        this.sendToConnection(sessionId, {
            type: 'connection_established',
            sessionId,
            userId,
            timestamp: new Date().toISOString(),
            capabilities: [
                'real_time_chat',
                'voice_streaming',
                'file_sharing',
                'collaborative_editing',
                'presence_tracking'
            ]
        });

        // Set up event handlers
        this.setupConnectionHandlers(sessionId, ws);

        logger.info('WebSocket connection established', {
            sessionId,
            userId,
            totalConnections: this.connections.size
        });

        return connection;
    }

    /**
     * Set up WebSocket event handlers
     */
    setupConnectionHandlers(sessionId, ws) {
        const connection = this.connections.get(sessionId);
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(sessionId, message);
            } catch (error) {
                logger.error('Invalid WebSocket message', { sessionId, error: error.message });
                this.sendError(sessionId, 'Invalid message format');
            }
        });

        ws.on('close', () => {
            this.handleDisconnection(sessionId);
        });

        ws.on('error', (error) => {
            logger.error('WebSocket error', { sessionId, error: error.message });
            this.handleDisconnection(sessionId);
        });

        // Heartbeat
        const heartbeat = setInterval(() => {
            if (ws.readyState === ws.OPEN) {
                ws.ping();
            } else {
                clearInterval(heartbeat);
            }
        }, 30000);

        ws.on('pong', () => {
            if (connection) {
                connection.lastActivity = Date.now();
            }
        });
    }

    /**
     * Handle incoming WebSocket message
     */
    async handleMessage(sessionId, message) {
        const connection = this.connections.get(sessionId);
        if (!connection) return;

        connection.lastActivity = Date.now();

        try {
            switch (message.type) {
                case 'join_room':
                    await this.handleJoinRoom(sessionId, message.roomId, message.metadata);
                    break;
                    
                case 'leave_room':
                    await this.handleLeaveRoom(sessionId, message.roomId);
                    break;
                    
                case 'chat_message':
                    await this.handleChatMessage(sessionId, message);
                    break;
                    
                case 'voice_data':
                    await this.handleVoiceData(sessionId, message);
                    break;
                    
                case 'cursor_position':
                    await this.handleCursorPosition(sessionId, message);
                    break;
                    
                case 'document_edit':
                    await this.handleDocumentEdit(sessionId, message);
                    break;
                    
                case 'file_share':
                    await this.handleFileShare(sessionId, message);
                    break;
                    
                case 'presence_update':
                    await this.handlePresenceUpdate(sessionId, message);
                    break;
                    
                default:
                    logger.warn('Unknown message type', { sessionId, type: message.type });
                    this.sendError(sessionId, `Unknown message type: ${message.type}`);
            }
        } catch (error) {
            logger.error('Message handling error', { sessionId, error: error.message });
            this.sendError(sessionId, 'Failed to process message');
        }
    }

    /**
     * Handle room joining
     */
    async handleJoinRoom(sessionId, roomId, metadata = {}) {
        const connection = this.connections.get(sessionId);
        if (!connection) return;

        // Create room if it doesn't exist
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                id: roomId,
                participants: new Map(),
                createdAt: Date.now(),
                metadata: {}
            });
        }

        const room = this.rooms.get(roomId);
        
        // Add participant to room
        room.participants.set(sessionId, {
            sessionId,
            userId: connection.userId,
            joinedAt: Date.now(),
            metadata
        });

        // Add room to connection
        connection.rooms.add(roomId);

        // Notify other participants
        this.broadcastToRoom(roomId, {
            type: 'participant_joined',
            roomId,
            participant: {
                sessionId,
                userId: connection.userId,
                metadata
            },
            timestamp: new Date().toISOString()
        }, sessionId);

        // Send room info to new participant
        this.sendToConnection(sessionId, {
            type: 'room_joined',
            roomId,
            participants: Array.from(room.participants.values()),
            timestamp: new Date().toISOString()
        });

        logger.info('User joined room', {
            sessionId,
            userId: connection.userId,
            roomId,
            participantCount: room.participants.size
        });
    }

    /**
     * Handle room leaving
     */
    async handleLeaveRoom(sessionId, roomId) {
        const connection = this.connections.get(sessionId);
        const room = this.rooms.get(roomId);
        
        if (!connection || !room) return;

        // Remove from room
        room.participants.delete(sessionId);
        connection.rooms.delete(roomId);

        // Notify other participants
        this.broadcastToRoom(roomId, {
            type: 'participant_left',
            roomId,
            sessionId,
            userId: connection.userId,
            timestamp: new Date().toISOString()
        });

        // Clean up empty room
        if (room.participants.size === 0) {
            this.rooms.delete(roomId);
            logger.info('Room cleaned up', { roomId });
        }

        logger.info('User left room', {
            sessionId,
            userId: connection.userId,
            roomId,
            remainingParticipants: room.participants.size
        });
    }

    /**
     * Handle chat messages
     */
    async handleChatMessage(sessionId, message) {
        const connection = this.connections.get(sessionId);
        if (!connection) return;

        const chatMessage = {
            type: 'chat_message',
            id: uuidv4(),
            sessionId,
            userId: connection.userId,
            content: message.content,
            roomId: message.roomId,
            timestamp: new Date().toISOString(),
            metadata: message.metadata || {}
        };

        // Broadcast to room or specific target
        if (message.roomId) {
            this.broadcastToRoom(message.roomId, chatMessage, sessionId);
        } else if (message.targetSessionId) {
            this.sendToConnection(message.targetSessionId, chatMessage);
        }

        logger.info('Chat message processed', {
            sessionId,
            userId: connection.userId,
            roomId: message.roomId,
            contentLength: message.content?.length
        });
    }

    /**
     * Handle voice data streaming
     */
    async handleVoiceData(sessionId, message) {
        const connection = this.connections.get(sessionId);
        if (!connection) return;

        const voiceMessage = {
            type: 'voice_data',
            sessionId,
            userId: connection.userId,
            roomId: message.roomId,
            audioData: message.audioData,
            format: message.format,
            timestamp: new Date().toISOString()
        };

        // Broadcast to room participants (excluding sender)
        if (message.roomId) {
            this.broadcastToRoom(message.roomId, voiceMessage, sessionId);
        }
    }

    /**
     * Handle cursor position updates
     */
    async handleCursorPosition(sessionId, message) {
        const connection = this.connections.get(sessionId);
        if (!connection) return;

        const cursorUpdate = {
            type: 'cursor_position',
            sessionId,
            userId: connection.userId,
            position: message.position,
            selection: message.selection,
            roomId: message.roomId,
            timestamp: new Date().toISOString()
        };

        if (message.roomId) {
            this.broadcastToRoom(message.roomId, cursorUpdate, sessionId);
        }
    }

    /**
     * Handle document edits
     */
    async handleDocumentEdit(sessionId, message) {
        const connection = this.connections.get(sessionId);
        if (!connection) return;

        const editMessage = {
            type: 'document_edit',
            sessionId,
            userId: connection.userId,
            operation: message.operation,
            documentId: message.documentId,
            roomId: message.roomId,
            timestamp: new Date().toISOString()
        };

        if (message.roomId) {
            this.broadcastToRoom(message.roomId, editMessage, sessionId);
        }
    }

    /**
     * Handle file sharing
     */
    async handleFileShare(sessionId, message) {
        const connection = this.connections.get(sessionId);
        if (!connection) return;

        const fileMessage = {
            type: 'file_shared',
            sessionId,
            userId: connection.userId,
            file: {
                id: message.fileId,
                name: message.fileName,
                size: message.fileSize,
                type: message.fileType,
                url: message.fileUrl
            },
            roomId: message.roomId,
            timestamp: new Date().toISOString()
        };

        if (message.roomId) {
            this.broadcastToRoom(message.roomId, fileMessage);
        }
    }

    /**
     * Handle presence updates
     */
    async handlePresenceUpdate(sessionId, message) {
        const connection = this.connections.get(sessionId);
        if (!connection) return;

        connection.metadata.presence = {
            status: message.status,
            activity: message.activity,
            lastSeen: Date.now()
        };

        const presenceUpdate = {
            type: 'presence_update',
            sessionId,
            userId: connection.userId,
            presence: connection.metadata.presence,
            timestamp: new Date().toISOString()
        };

        // Broadcast to all rooms the user is in
        connection.rooms.forEach(roomId => {
            this.broadcastToRoom(roomId, presenceUpdate, sessionId);
        });
    }

    /**
     * Handle connection disconnection
     */
    handleDisconnection(sessionId) {
        const connection = this.connections.get(sessionId);
        if (!connection) return;

        // Remove from all rooms
        connection.rooms.forEach(roomId => {
            this.handleLeaveRoom(sessionId, roomId);
        });

        // Clean up user session
        this.cleanupUserSession(connection.userId, sessionId);

        // Remove connection
        this.connections.delete(sessionId);

        logger.info('WebSocket connection closed', {
            sessionId,
            userId: connection.userId,
            duration: Date.now() - connection.joinedAt,
            totalConnections: this.connections.size
        });
    }

    // Utility methods
    sendToConnection(sessionId, message) {
        const connection = this.connections.get(sessionId);
        if (connection && connection.ws.readyState === connection.ws.OPEN) {
            try {
                connection.ws.send(JSON.stringify(message));
                return true;
            } catch (error) {
                logger.error('Failed to send message', { sessionId, error: error.message });
                return false;
            }
        }
        return false;
    }

    broadcastToRoom(roomId, message, excludeSessionId = null) {
        const room = this.rooms.get(roomId);
        if (!room) return 0;

        let sent = 0;
        room.participants.forEach((participant, sessionId) => {
            if (sessionId !== excludeSessionId) {
                if (this.sendToConnection(sessionId, message)) {
                    sent++;
                }
            }
        });

        return sent;
    }

    sendError(sessionId, error) {
        this.sendToConnection(sessionId, {
            type: 'error',
            error: typeof error === 'string' ? error : error.message,
            timestamp: new Date().toISOString()
        });
    }

    updateUserSession(userId, sessionId) {
        if (!this.userSessions.has(userId)) {
            this.userSessions.set(userId, new Set());
        }
        this.userSessions.get(userId).add(sessionId);
    }

    cleanupUserSession(userId, sessionId) {
        const sessions = this.userSessions.get(userId);
        if (sessions) {
            sessions.delete(sessionId);
            if (sessions.size === 0) {
                this.userSessions.delete(userId);
            }
        }
    }

    /**
     * Get manager statistics
     */
    getStats() {
        return {
            totalConnections: this.connections.size,
            totalRooms: this.rooms.size,
            totalUsers: this.userSessions.size,
            roomDetails: Array.from(this.rooms.values()).map(room => ({
                id: room.id,
                participants: room.participants.size,
                createdAt: room.createdAt
            }))
        };
    }
}

// Request ID middleware for tracking requests
export const requestIdMiddleware = (req, res, next) => {
    req.requestId = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-ID', req.requestId);
    next();
};

// SSE middleware alias for convenience
export const sseMiddleware = setupSSE;

// Export singleton instance
export const wsManager = new EnhancedWebSocketManager();