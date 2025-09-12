import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateJsonSchema, schemas } from '../middleware/validation.js';
import { moderateRateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../utils/ApiError.js';

const router = express.Router();

// Get user profile
router.get('/profile',
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    
    // Mock user data (in production, fetch from database)
    const user = {
      id: userId,
      email: req.auth.user?.email || 'user@susan-ai.com',
      name: 'Susan AI User',
      avatar: null,
      preferences: {
        theme: 'dark',
        language: 'en',
        notifications: true,
        defaultModel: 'gpt-3.5-turbo'
      },
      createdAt: '2024-01-01T00:00:00Z',
      lastLoginAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Update user profile
router.put('/profile',
  moderateRateLimit,
  validateJsonSchema(schemas.updateProfile),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { name, email, preferences } = req.body;
    
    // Mock update (in production, update database)
    const updatedUser = {
      id: userId,
      email: email || req.auth.user?.email || 'user@susan-ai.com',
      name: name || 'Susan AI User',
      preferences: preferences || {},
      updatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Get user preferences
router.get('/preferences',
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const preferences = {
      theme: 'dark',
      language: 'en',
      notifications: true,
      defaultModel: 'gpt-3.5-turbo',
      voiceSettings: {
        voice: 'alloy',
        speed: 1.0
      },
      conversationSettings: {
        autoSave: true,
        contextDepth: 10
      }
    };
    
    res.json({
      success: true,
      data: { preferences },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Update user preferences
router.put('/preferences',
  moderateRateLimit,
  validateJsonSchema({
    type: 'object',
    required: ['preferences'],
    properties: {
      preferences: { type: 'object' }
    }
  }),
  asyncHandler(async (req, res) => {
    const { preferences } = req.body;
    
    res.json({
      success: true,
      data: { preferences },
      message: 'Preferences updated successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Get usage analytics
router.get('/usage',
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const { timeframe = 'month' } = req.query;
    
    // Mock usage data
    const usage = {
      timeframe,
      totalInteractions: 145,
      totalTokens: 23456,
      totalCost: 12.34,
      conversationsCount: 23,
      averageResponseTime: 1250,
      favoriteModels: ['gpt-3.5-turbo', 'claude-3-sonnet'],
      dailyUsage: generateMockDailyUsage(timeframe)
    };
    
    res.json({
      success: true,
      data: usage,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

function getUserId(req) {
  if (req.auth?.user?.id) {
    return req.auth.user.id;
  }
  
  if (req.auth?.key) {
    return `api_user_${req.auth.key.slice(-8)}`;
  }
  
  throw ApiError.unauthorized('User identification required');
}

function generateMockDailyUsage(timeframe) {
  const days = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 365;
  const usage = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    usage.push({
      date: date.toISOString().split('T')[0],
      interactions: Math.floor(Math.random() * 20),
      tokens: Math.floor(Math.random() * 2000),
      cost: Math.random() * 2
    });
  }
  
  return usage;
}

export default router;