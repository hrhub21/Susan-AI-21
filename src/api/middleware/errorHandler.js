import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('API Error:', {
    error: err.message,
    stack: err.stack,
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Handle known API errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      details: err.details,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'AuthenticationError',
      message: 'Invalid token',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'AuthenticationError',
      message: 'Token expired',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Request validation failed',
      details: err.details || err.message,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  }

  // Handle multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'FileSizeError',
      message: 'File too large',
      details: 'File exceeds maximum allowed size',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      error: 'FileCountError',
      message: 'Too many files',
      details: 'Number of files exceeds limit',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  }

  // Handle syntax errors (malformed JSON)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'SyntaxError',
      message: 'Invalid JSON in request body',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  }

  // Handle MongoDB/Database errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    return res.status(500).json({
      error: 'DatabaseError',
      message: 'Database operation failed',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  }

  // Handle network/timeout errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    return res.status(503).json({
      error: 'ServiceUnavailable',
      message: 'External service unavailable',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  }

  // Handle rate limit errors (from rate-limiter-flexible or similar)
  if (err.name === 'RateLimiterError') {
    return res.status(429).json({
      error: 'RateLimitError',
      message: 'Rate limit exceeded',
      details: err.message,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  }

  // Default error response for unhandled errors
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred',
    ...(isDevelopment && {
      details: err.message,
      stack: err.stack
    }),
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
};

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'NotFound',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
};

export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};