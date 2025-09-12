import { ApiError } from '../utils/ApiError.js';

// In-memory rate limit store (in production, use Redis)
const rateLimitStore = new Map();

export const rateLimitMiddleware = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100, // limit each IP to 100 requests per windowMs
    message = 'Too many requests, please try again later',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return (req, res, next) => {
    try {
      const key = getClientIdentifier(req);
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean up old entries
      cleanupExpiredEntries(windowStart);

      // Get or create rate limit data for this client
      let clientData = rateLimitStore.get(key);
      if (!clientData) {
        clientData = {
          requests: [],
          totalRequests: 0
        };
        rateLimitStore.set(key, clientData);
      }

      // Remove requests outside the current window
      clientData.requests = clientData.requests.filter(timestamp => timestamp > windowStart);

      // Check if limit exceeded
      if (clientData.requests.length >= maxRequests) {
        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': maxRequests,
          'X-RateLimit-Remaining': 0,
          'X-RateLimit-Reset': new Date(now + windowMs).toISOString(),
          'Retry-After': Math.ceil(windowMs / 1000)
        });

        throw new ApiError(429, message);
      }

      // Add current request
      clientData.requests.push(now);
      clientData.totalRequests++;

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': maxRequests - clientData.requests.length,
        'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const createRateLimit = (options) => {
  return rateLimitMiddleware(options);
};

// Specific rate limiters for different endpoints
export const strictRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 requests per 15 minutes
  message: 'Too many requests to this endpoint, please try again later'
});

export const moderateRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50, // 50 requests per 15 minutes
});

export const lenientRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 200, // 200 requests per 15 minutes
});

// AI model-specific rate limits (more restrictive for expensive models)
export const aiModelRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 AI requests per minute
  message: 'AI request rate limit exceeded, please wait before making another request'
});

export const fileUploadRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 20, // 20 file uploads per hour
  message: 'File upload rate limit exceeded, please wait before uploading again'
});

function getClientIdentifier(req) {
  // Use API key if available, otherwise fall back to IP
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    return `api:${apiKey}`;
  }

  // Use user ID if authenticated
  if (req.auth && req.auth.user && req.auth.user.id) {
    return `user:${req.auth.user.id}`;
  }

  // Fall back to IP address
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.connection.remoteAddress;
  return `ip:${ip}`;
}

function cleanupExpiredEntries(windowStart) {
  for (const [key, data] of rateLimitStore.entries()) {
    data.requests = data.requests.filter(timestamp => timestamp > windowStart);
    if (data.requests.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup function to prevent memory leaks
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  cleanupExpiredEntries(oneHourAgo);
}, 60 * 60 * 1000); // Run cleanup every hour