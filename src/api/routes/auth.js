import express from 'express';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateJsonSchema, schemas } from '../middleware/validation.js';
import { moderateRateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../utils/ApiError.js';

const router = express.Router();

// User login
router.post('/login',
  moderateRateLimit,
  validateJsonSchema(schemas.login),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    // Simple authentication (in production, use proper password hashing and database)
    const validUsers = [
      { id: 'user_1', email: 'admin@susan-ai.com', password: 'admin123', role: 'admin' },
      { id: 'user_2', email: 'user@susan-ai.com', password: 'user123', role: 'user' }
    ];
    
    const user = validUsers.find(u => u.email === email && u.password === password);
    
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      },
      timestamp: new Date().toISOString()
    });
  })
);

// Refresh token
router.post('/refresh',
  moderateRateLimit,
  validateJsonSchema({
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: { type: 'string' }
    }
  }),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'your-secret-key');
      
      if (decoded.type !== 'refresh') {
        throw ApiError.unauthorized('Invalid refresh token');
      }
      
      const newToken = jwt.sign(
        { id: decoded.id, email: decoded.email, role: decoded.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );
      
      res.json({
        success: true,
        data: { token: newToken },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }
  })
);

// Logout
router.post('/logout',
  asyncHandler(async (req, res) => {
    // In a real app, you'd blacklist the token
    res.json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    });
  })
);

export default router;