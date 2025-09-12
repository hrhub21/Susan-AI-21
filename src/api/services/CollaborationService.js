import EventEmitter from 'events';
import crypto from 'crypto';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { wsManager } from '../middleware/streaming.js';

export class CollaborationService extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    this.participants = new Map();
    this.shareLinks = new Map();
    this.presenceData = new Map();
    this.operationalTransforms = new Map();
    this.conflictResolution = new Map();
    
    // Collaboration features
    this.features = {
      sharedCursor: new Map(),
      voiceChat: new Map(),
      screenShare: new Map(),
      fileSharing: new Map(),
      annotations: new Map(),
      reactions: new Map()
    };

    // Set up cleanup intervals
    this.setupCleanupIntervals();
  }

  /**
   * Start a collaboration session for a conversation
   */
  async startCollaborationSession(conversationId, options = {}) {
    const {
      userId,
      features = {
        sharedCursor: true,
        voiceChat: false,
        screenShare: false,
        fileSharing: true,
        annotations: true,
        reactions: true
      },
      permissions = {
        canEdit: true,
        canInvite: true,
        canModerate: false
      },
      settings = {
        maxParticipants: 10,
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        recordSession: false,
        requireApproval: false
      }
    } = options;

    const sessionId = this.generateSessionId();
    const startTime = new Date();

    try {
      const session = {
        id: sessionId,
        conversationId,
        ownerId: userId,
        status: 'active',
        participants: new Map(),
        features,
        permissions,
        settings,
        metadata: {
          startTime,
          lastActivity: startTime,
          messageCount: 0,
          participantJoins: 0,
          participantLeaves: 0
        },
        operationLog: [],
        conflictQueue: [],
        sharedState: {
          cursor: {},
          selections: {},
          annotations: [],
          reactions: []
        }
      };

      // Add owner as first participant
      await this.addParticipant(sessionId, userId, {
        role: 'owner',
        permissions: { ...permissions, canModerate: true },
        joinedAt: startTime
      });

      this.sessions.set(sessionId, session);

      // Initialize feature-specific data
      if (features.sharedCursor) {
        this.features.sharedCursor.set(sessionId, new Map());
      }
      if (features.voiceChat) {
        this.features.voiceChat.set(sessionId, {
          activeStreams: new Map(),
          settings: { muted: new Set(), deafened: new Set() }
        });
      }
      if (features.annotations) {
        this.features.annotations.set(sessionId, []);
      }
      if (features.reactions) {
        this.features.reactions.set(sessionId, []);
      }

      logger.info('Collaboration session started', {
        sessionId,
        conversationId,
        ownerId: userId,
        features: Object.keys(features).filter(f => features[f]),
        maxParticipants: settings.maxParticipants
      });

      this.emit('session:started', { sessionId, conversationId, userId, session });

      return {
        sessionId,
        status: session.status,
        features,
        settings,
        joinUrl: this.generateJoinUrl(sessionId)
      };

    } catch (error) {
      logger.error('Failed to start collaboration session', {
        conversationId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Join an existing collaboration session
   */
  async joinCollaborationSession(sessionId, options = {}) {
    const {
      userId,
      userInfo = {},
      inviteToken = null,
      permissions = {
        canEdit: true,
        canInvite: false,
        canModerate: false
      }
    } = options;

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw ApiError.notFound(`Collaboration session ${sessionId} not found`);
    }

    if (session.status !== 'active') {
      throw ApiError.badRequest(`Session ${sessionId} is not active (status: ${session.status})`);
    }

    // Check if session is full
    if (session.participants.size >= session.settings.maxParticipants) {
      throw ApiError.badRequest('Session is full');
    }

    // Validate invite token if required
    if (session.settings.requireApproval && !inviteToken) {
      throw ApiError.forbidden('Invite token required to join this session');
    }

    if (inviteToken && !this.validateInviteToken(sessionId, inviteToken)) {
      throw ApiError.forbidden('Invalid invite token');
    }

    // Check if user is already in session
    if (session.participants.has(userId)) {
      throw ApiError.badRequest('User already in session');
    }

    const joinTime = new Date();

    try {
      // Add participant
      await this.addParticipant(sessionId, userId, {
        role: 'participant',
        permissions,
        userInfo,
        joinedAt: joinTime,
        lastSeen: joinTime,
        status: 'online'
      });

      // Update session metadata
      session.metadata.lastActivity = joinTime;
      session.metadata.participantJoins++;

      // Notify other participants
      this.broadcastToSession(sessionId, {
        type: 'participant_joined',
        participant: {
          userId,
          userInfo,
          joinedAt: joinTime,
          role: 'participant'
        }
      }, userId); // Exclude the joining user

      // Send current state to new participant
      await this.sendSessionState(sessionId, userId);

      logger.info('User joined collaboration session', {
        sessionId,
        userId,
        participantCount: session.participants.size,
        conversationId: session.conversationId
      });

      this.emit('participant:joined', { sessionId, userId, session });

      return {
        sessionId,
        status: 'joined',
        participants: this.getSessionParticipants(sessionId),
        features: session.features,
        permissions
      };

    } catch (error) {
      logger.error('Failed to join collaboration session', {
        sessionId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Leave a collaboration session
   */
  async leaveCollaborationSession(sessionId, userId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw ApiError.notFound(`Session ${sessionId} not found`);
    }

    const participant = session.participants.get(userId);
    if (!participant) {
      throw ApiError.notFound(`User ${userId} not found in session`);
    }

    try {
      // Remove participant
      session.participants.delete(userId);
      this.participants.delete(`${sessionId}:${userId}`);

      // Clean up user-specific data
      this.cleanupUserData(sessionId, userId);

      // Update session metadata
      session.metadata.lastActivity = new Date();
      session.metadata.participantLeaves++;

      // Handle ownership transfer if owner leaves
      if (participant.role === 'owner' && session.participants.size > 0) {
        await this.transferOwnership(sessionId);
      }

      // End session if no participants remain
      if (session.participants.size === 0) {
        await this.endCollaborationSession(sessionId);
        return { sessionId, status: 'session_ended' };
      }

      // Notify remaining participants
      this.broadcastToSession(sessionId, {
        type: 'participant_left',
        participant: {
          userId,
          leftAt: new Date(),
          reason: 'user_left'
        }
      });

      logger.info('User left collaboration session', {
        sessionId,
        userId,
        remainingParticipants: session.participants.size,
        wasOwner: participant.role === 'owner'
      });

      this.emit('participant:left', { sessionId, userId, session });

      return {
        sessionId,
        status: 'left',
        remainingParticipants: session.participants.size
      };

    } catch (error) {
      logger.error('Failed to leave collaboration session', {
        sessionId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * End a collaboration session
   */
  async endCollaborationSession(sessionId, options = {}) {
    const { reason = 'manual', userId = null } = options;

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw ApiError.notFound(`Session ${sessionId} not found`);
    }

    try {
      // Notify all participants
      this.broadcastToSession(sessionId, {
        type: 'session_ended',
        reason,
        endedBy: userId,
        endedAt: new Date()
      });

      // Clean up all session data
      this.cleanupSessionData(sessionId);

      // Update session status
      session.status = 'ended';
      session.metadata.endTime = new Date();
      session.metadata.duration = session.metadata.endTime - session.metadata.startTime;

      // Archive session data if recording was enabled
      if (session.settings.recordSession) {
        await this.archiveSession(session);
      }

      // Remove from active sessions
      this.sessions.delete(sessionId);

      logger.info('Collaboration session ended', {
        sessionId,
        reason,
        duration: session.metadata.duration,
        totalParticipants: session.metadata.participantJoins,
        conversationId: session.conversationId
      });

      this.emit('session:ended', { sessionId, reason, session });

      return {
        sessionId,
        status: 'ended',
        metadata: session.metadata
      };

    } catch (error) {
      logger.error('Failed to end collaboration session', {
        sessionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Handle real-time cursor sharing
   */
  async updateCursor(sessionId, userId, cursorData) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.features.sharedCursor) {
      return;
    }

    const participant = session.participants.get(userId);
    if (!participant) {
      throw ApiError.forbidden('User not in session');
    }

    try {
      const cursors = this.features.sharedCursor.get(sessionId);
      cursors.set(userId, {
        ...cursorData,
        userId,
        timestamp: new Date(),
        userInfo: participant.userInfo
      });

      // Broadcast cursor position to other participants
      this.broadcastToSession(sessionId, {
        type: 'cursor_update',
        cursor: {
          userId,
          position: cursorData.position,
          selection: cursorData.selection,
          timestamp: new Date()
        }
      }, userId); // Exclude the user who moved the cursor

      this.updateSessionActivity(sessionId);

    } catch (error) {
      logger.error('Failed to update cursor', {
        sessionId,
        userId,
        error: error.message
      });
    }
  }

  /**
   * Handle operational transforms for collaborative editing
   */
  async applyOperation(sessionId, userId, operation) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw ApiError.notFound(`Session ${sessionId} not found`);
    }

    const participant = session.participants.get(userId);
    if (!participant || !participant.permissions.canEdit) {
      throw ApiError.forbidden('User does not have edit permissions');
    }

    try {
      // Assign operation ID and timestamp
      const operationId = this.generateOperationId();
      const enhancedOperation = {
        ...operation,
        id: operationId,
        userId,
        timestamp: new Date(),
        sessionId
      };

      // Check for conflicts with concurrent operations
      const conflicts = this.detectConflicts(sessionId, enhancedOperation);

      if (conflicts.length > 0) {
        // Apply conflict resolution
        const resolvedOperation = await this.resolveConflicts(sessionId, enhancedOperation, conflicts);
        enhancedOperation.resolvedFrom = conflicts.map(c => c.id);
        enhancedOperation.transforms = resolvedOperation.transforms;
      }

      // Apply operation to shared state
      await this.applyOperationToState(sessionId, enhancedOperation);

      // Log operation
      session.operationLog.push(enhancedOperation);

      // Broadcast operation to other participants
      this.broadcastToSession(sessionId, {
        type: 'operation',
        operation: enhancedOperation
      }, userId);

      // Update session activity
      this.updateSessionActivity(sessionId);
      session.metadata.messageCount++;

      logger.debug('Operation applied', {
        sessionId,
        userId,
        operationId,
        operationType: operation.type,
        conflicts: conflicts.length
      });

      this.emit('operation:applied', { sessionId, userId, operation: enhancedOperation });

      return {
        operationId,
        status: 'applied',
        conflicts: conflicts.length,
        transforms: enhancedOperation.transforms || []
      };

    } catch (error) {
      logger.error('Failed to apply operation', {
        sessionId,
        userId,
        operationType: operation.type,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Add annotation to conversation
   */
  async addAnnotation(sessionId, userId, annotation) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.features.annotations) {
      throw ApiError.badRequest('Annotations not enabled for this session');
    }

    const participant = session.participants.get(userId);
    if (!participant) {
      throw ApiError.forbidden('User not in session');
    }

    try {
      const annotationId = this.generateAnnotationId();
      const enhancedAnnotation = {
        ...annotation,
        id: annotationId,
        userId,
        createdAt: new Date(),
        userInfo: participant.userInfo
      };

      const annotations = this.features.annotations.get(sessionId);
      annotations.push(enhancedAnnotation);

      // Broadcast annotation to all participants
      this.broadcastToSession(sessionId, {
        type: 'annotation_added',
        annotation: enhancedAnnotation
      });

      this.updateSessionActivity(sessionId);

      logger.debug('Annotation added', {
        sessionId,
        userId,
        annotationId,
        type: annotation.type
      });

      return { annotationId, status: 'added' };

    } catch (error) {
      logger.error('Failed to add annotation', {
        sessionId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Add reaction to message
   */
  async addReaction(sessionId, userId, messageId, emoji) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.features.reactions) {
      throw ApiError.badRequest('Reactions not enabled for this session');
    }

    const participant = session.participants.get(userId);
    if (!participant) {
      throw ApiError.forbidden('User not in session');
    }

    try {
      const reactions = this.features.reactions.get(sessionId);
      
      // Remove existing reaction from same user to same message
      const existingIndex = reactions.findIndex(r => 
        r.userId === userId && r.messageId === messageId
      );
      
      if (existingIndex >= 0) {
        reactions.splice(existingIndex, 1);
      }

      // Add new reaction
      const reaction = {
        id: this.generateReactionId(),
        userId,
        messageId,
        emoji,
        createdAt: new Date(),
        userInfo: participant.userInfo
      };

      reactions.push(reaction);

      // Broadcast reaction to all participants
      this.broadcastToSession(sessionId, {
        type: 'reaction_added',
        reaction
      });

      this.updateSessionActivity(sessionId);

      return { reactionId: reaction.id, status: 'added' };

    } catch (error) {
      logger.error('Failed to add reaction', {
        sessionId,
        userId,
        messageId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create shareable link for session
   */
  async createShareLink(sessionId, options = {}) {
    const {
      userId,
      expiresIn = '24h',
      permissions = {
        canEdit: false,
        canInvite: false
      },
      password = null,
      maxUses = null
    } = options;

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw ApiError.notFound(`Session ${sessionId} not found`);
    }

    const participant = session.participants.get(userId);
    if (!participant || !participant.permissions.canInvite) {
      throw ApiError.forbidden('User does not have invite permissions');
    }

    try {
      const linkId = this.generateLinkId();
      const token = this.generateSecureToken();
      const expiresAt = this.calculateExpiration(expiresIn);

      const shareLink = {
        id: linkId,
        sessionId,
        token,
        createdBy: userId,
        createdAt: new Date(),
        expiresAt,
        permissions,
        password: password ? this.hashPassword(password) : null,
        maxUses,
        usedCount: 0,
        status: 'active'
      };

      this.shareLinks.set(token, shareLink);

      logger.info('Share link created', {
        sessionId,
        linkId,
        createdBy: userId,
        expiresAt,
        hasPassword: !!password,
        maxUses
      });

      return {
        linkId,
        url: this.generateShareUrl(token),
        token,
        expiresAt,
        permissions
      };

    } catch (error) {
      logger.error('Failed to create share link', {
        sessionId,
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update presence information for user
   */
  async updatePresence(sessionId, userId, presenceData) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const participant = session.participants.get(userId);
    if (!participant) {
      return;
    }

    try {
      const presence = {
        userId,
        status: presenceData.status || 'online',
        location: presenceData.location,
        activity: presenceData.activity,
        lastUpdate: new Date(),
        device: presenceData.device
      };

      this.presenceData.set(`${sessionId}:${userId}`, presence);
      participant.lastSeen = new Date();
      participant.status = presence.status;

      // Broadcast presence update
      this.broadcastToSession(sessionId, {
        type: 'presence_update',
        presence
      }, userId);

      this.updateSessionActivity(sessionId);

    } catch (error) {
      logger.error('Failed to update presence', {
        sessionId,
        userId,
        error: error.message
      });
    }
  }

  // Helper methods

  async addParticipant(sessionId, userId, participantData) {
    const session = this.sessions.get(sessionId);
    const participant = {
      userId,
      sessionId,
      ...participantData,
      connectionId: null // Will be set when WebSocket connects
    };

    session.participants.set(userId, participant);
    this.participants.set(`${sessionId}:${userId}`, participant);
  }

  broadcastToSession(sessionId, message, excludeUserId = null) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    for (const [userId] of session.participants) {
      if (userId !== excludeUserId) {
        // Use WebSocket manager to send message
        wsManager.sendToUser(userId, {
          ...message,
          sessionId,
          timestamp: new Date()
        });
      }
    }
  }

  async sendSessionState(sessionId, userId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const state = {
      type: 'session_state',
      sessionId,
      participants: this.getSessionParticipants(sessionId),
      features: session.features,
      sharedState: session.sharedState,
      cursors: session.features.sharedCursor ? 
        Object.fromEntries(this.features.sharedCursor.get(sessionId) || new Map()) : {},
      annotations: session.features.annotations ? 
        this.features.annotations.get(sessionId) || [] : [],
      reactions: session.features.reactions ? 
        this.features.reactions.get(sessionId) || [] : []
    };

    wsManager.sendToUser(userId, state);
  }

  getSessionParticipants(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    return Array.from(session.participants.values()).map(p => ({
      userId: p.userId,
      role: p.role,
      userInfo: p.userInfo,
      joinedAt: p.joinedAt,
      lastSeen: p.lastSeen,
      status: p.status,
      permissions: p.permissions
    }));
  }

  detectConflicts(sessionId, operation) {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    // Simple conflict detection based on overlapping positions
    const recentOps = session.operationLog
      .filter(op => op.timestamp > Date.now() - 5000) // Last 5 seconds
      .filter(op => op.userId !== operation.userId);

    const conflicts = [];

    for (const recentOp of recentOps) {
      if (this.operationsConflict(operation, recentOp)) {
        conflicts.push(recentOp);
      }
    }

    return conflicts;
  }

  operationsConflict(op1, op2) {
    // Simple conflict detection - check if operations affect overlapping ranges
    if (op1.type !== op2.type) return false;
    
    if (op1.type === 'text_edit') {
      const range1 = { start: op1.position, end: op1.position + (op1.delete || 0) };
      const range2 = { start: op2.position, end: op2.position + (op2.delete || 0) };
      
      return !(range1.end < range2.start || range2.end < range1.start);
    }

    return false;
  }

  async resolveConflicts(sessionId, operation, conflicts) {
    // Simple conflict resolution - adjust position based on earlier operations
    const resolved = { ...operation };
    let positionAdjustment = 0;

    for (const conflict of conflicts) {
      if (conflict.timestamp < operation.timestamp) {
        if (conflict.type === 'text_edit' && operation.type === 'text_edit') {
          if (conflict.position <= operation.position) {
            positionAdjustment += (conflict.insert?.length || 0) - (conflict.delete || 0);
          }
        }
      }
    }

    if (positionAdjustment !== 0) {
      resolved.position += positionAdjustment;
      resolved.transforms = resolved.transforms || [];
      resolved.transforms.push({
        type: 'position_adjustment',
        adjustment: positionAdjustment,
        reason: 'conflict_resolution'
      });
    }

    return resolved;
  }

  async applyOperationToState(sessionId, operation) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Apply operation to shared state
    // This is a simplified implementation
    switch (operation.type) {
      case 'text_edit':
        // Update shared document state
        break;
      case 'selection_change':
        session.sharedState.selections[operation.userId] = operation.selection;
        break;
    }
  }

  cleanupUserData(sessionId, userId) {
    // Remove user-specific data from all features
    const cursors = this.features.sharedCursor.get(sessionId);
    if (cursors) {
      cursors.delete(userId);
    }

    this.presenceData.delete(`${sessionId}:${userId}`);
  }

  cleanupSessionData(sessionId) {
    // Clean up all session-related data
    this.features.sharedCursor.delete(sessionId);
    this.features.voiceChat.delete(sessionId);
    this.features.annotations.delete(sessionId);
    this.features.reactions.delete(sessionId);
    this.features.fileSharing.delete(sessionId);
    this.features.screenShare.delete(sessionId);

    // Clean up operational transforms
    this.operationalTransforms.delete(sessionId);
    this.conflictResolution.delete(sessionId);
  }

  async transferOwnership(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.participants.size === 0) return;

    // Find a participant with moderator permissions, or the earliest joiner
    let newOwner = null;
    
    for (const [userId, participant] of session.participants) {
      if (participant.permissions.canModerate) {
        newOwner = participant;
        break;
      }
    }

    if (!newOwner) {
      // Get earliest joiner
      const participants = Array.from(session.participants.values());
      participants.sort((a, b) => a.joinedAt - b.joinedAt);
      newOwner = participants[0];
    }

    if (newOwner) {
      newOwner.role = 'owner';
      newOwner.permissions.canModerate = true;
      session.ownerId = newOwner.userId;

      this.broadcastToSession(sessionId, {
        type: 'ownership_transferred',
        newOwner: {
          userId: newOwner.userId,
          userInfo: newOwner.userInfo
        }
      });

      logger.info('Session ownership transferred', {
        sessionId,
        newOwner: newOwner.userId
      });
    }
  }

  updateSessionActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata.lastActivity = new Date();
    }
  }

  async archiveSession(session) {
    // Archive session data for later analysis
    const archive = {
      sessionId: session.id,
      conversationId: session.conversationId,
      metadata: session.metadata,
      operationLog: session.operationLog,
      participants: Array.from(session.participants.values()),
      archivedAt: new Date()
    };

    logger.info('Session archived', {
      sessionId: session.id,
      duration: session.metadata.duration,
      operations: session.operationLog.length
    });

    // In production, save to database
  }

  setupCleanupIntervals() {
    // Clean up expired sessions every hour
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000); // 1 hour

    // Clean up expired share links every hour
    setInterval(() => {
      this.cleanupExpiredShareLinks();
    }, 60 * 60 * 1000); // 1 hour

    // Update presence for inactive users every 5 minutes
    setInterval(() => {
      this.updateInactivePresence();
    }, 5 * 60 * 1000); // 5 minutes
  }

  cleanupExpiredSessions() {
    const now = new Date();
    
    for (const [sessionId, session] of this.sessions) {
      const timeSinceActivity = now - session.metadata.lastActivity;
      
      if (timeSinceActivity > session.settings.sessionTimeout) {
        this.endCollaborationSession(sessionId, {
          reason: 'timeout',
          userId: null
        }).catch(error => {
          logger.error('Failed to cleanup expired session', {
            sessionId,
            error: error.message
          });
        });
      }
    }
  }

  cleanupExpiredShareLinks() {
    const now = new Date();
    
    for (const [token, shareLink] of this.shareLinks) {
      if (shareLink.expiresAt && now > shareLink.expiresAt) {
        this.shareLinks.delete(token);
        logger.debug('Expired share link cleaned up', {
          linkId: shareLink.id,
          sessionId: shareLink.sessionId
        });
      }
    }
  }

  updateInactivePresence() {
    const now = new Date();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [key, presence] of this.presenceData) {
      const timeSinceUpdate = now - presence.lastUpdate;
      
      if (timeSinceUpdate > inactiveThreshold && presence.status !== 'away') {
        presence.status = 'away';
        presence.lastUpdate = now;

        const [sessionId, userId] = key.split(':');
        this.broadcastToSession(sessionId, {
          type: 'presence_update',
          presence
        }, userId);
      }
    }
  }

  validateInviteToken(sessionId, token) {
    const shareLink = this.shareLinks.get(token);
    if (!shareLink) return false;
    
    if (shareLink.sessionId !== sessionId) return false;
    if (shareLink.status !== 'active') return false;
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) return false;
    if (shareLink.maxUses && shareLink.usedCount >= shareLink.maxUses) return false;

    return true;
  }

  calculateExpiration(expiresIn) {
    const now = new Date();
    const duration = this.parseDuration(expiresIn);
    return new Date(now.getTime() + duration);
  }

  parseDuration(duration) {
    const units = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000
    };

    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error('Invalid duration format');

    const [, amount, unit] = match;
    return parseInt(amount) * units[unit];
  }

  hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  // ID generators
  generateSessionId() {
    return `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateAnnotationId() {
    return `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateReactionId() {
    return `react_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateLinkId() {
    return `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateJoinUrl(sessionId) {
    return `/collaborate/${sessionId}`;
  }

  generateShareUrl(token) {
    return `/collaborate/join/${token}`;
  }

  // Public API methods
  getActiveCollaborations(userId = null) {
    const sessions = Array.from(this.sessions.values());
    
    if (userId) {
      return sessions.filter(session => 
        session.participants.has(userId)
      );
    }

    return sessions;
  }

  getCollaborationSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  getSessionStats() {
    return {
      activeSessions: this.sessions.size,
      totalParticipants: this.participants.size,
      activePresence: this.presenceData.size,
      shareLinks: this.shareLinks.size
    };
  }
}