import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';
import { RoleBasedAccessControlService } from '../services/RoleBasedAccessControlService.js';

// Check for JWT secret (optional for development)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET not set. JWT authentication will be disabled.');
}

// Initialize RBAC service for permission checking
const rbacService = new RoleBasedAccessControlService();

export const authMiddleware = (req, res, next) => {
  try {
    // Check for API key in headers
    const apiKey = req.headers['x-api-key'];
    const authHeader = req.headers.authorization;

    // API Key authentication
    if (apiKey) {
      if (validateApiKey(apiKey)) {
        req.auth = { type: 'api-key', key: apiKey };
        return next();
      } else {
        throw new ApiError(401, 'Invalid API key');
      }
    }

    // JWT Token authentication
    if (authHeader && authHeader.startsWith('Bearer ')) {
      if (!JWT_SECRET) {
        throw new ApiError(500, 'JWT authentication not configured');
      }
      
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.auth = { type: 'jwt', user: decoded };
        return next();
      } catch (jwtError) {
        throw new ApiError(401, 'Invalid or expired token');
      }
    }

    throw new ApiError(401, 'Authentication required');
  } catch (error) {
    next(error);
  }
};

export const adminAuthMiddleware = (req, res, next) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, 'Authentication required');
    }

    // Check if user has admin privileges
    if (req.auth.type === 'jwt' && req.auth.user.role === 'admin') {
      return next();
    }

    // Check if API key has admin privileges
    if (req.auth.type === 'api-key' && isAdminApiKey(req.auth.key)) {
      return next();
    }

    throw new ApiError(403, 'Admin privileges required');
  } catch (error) {
    next(error);
  }
};

export const optionalAuthMiddleware = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const authHeader = req.headers.authorization;

    if (apiKey && validateApiKey(apiKey)) {
      req.auth = { type: 'api-key', key: apiKey };
    } else if (authHeader && authHeader.startsWith('Bearer ') && JWT_SECRET) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.auth = { type: 'jwt', user: decoded };
      } catch (jwtError) {
        // Ignore invalid tokens for optional auth
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

function validateApiKey(apiKey) {
  // In production, this would check against a database
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  return validApiKeys.includes(apiKey);
}

function isAdminApiKey(apiKey) {
  // In production, this would check admin privileges in database
  const adminApiKeys = process.env.ADMIN_API_KEYS?.split(',') || [];
  return adminApiKeys.includes(apiKey);
}

/**
 * Enhanced authentication middleware with RBAC integration
 */
export const enhancedAuthMiddleware = (req, res, next) => {
  try {
    // Check for API key in headers
    const apiKey = req.headers['x-api-key'];
    const authHeader = req.headers.authorization;

    // API Key authentication
    if (apiKey) {
      if (validateApiKey(apiKey)) {
        req.auth = { 
          type: 'api-key', 
          key: apiKey,
          userId: `api_user_${apiKey.slice(-8)}`,
          permissions: getApiKeyPermissions(apiKey)
        };
        return next();
      } else {
        throw new ApiError(401, 'Invalid API key');
      }
    }

    // JWT Token authentication
    if (authHeader && authHeader.startsWith('Bearer ')) {
      if (!JWT_SECRET) {
        throw new ApiError(500, 'JWT authentication not configured');
      }
      
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.auth = { 
          type: 'jwt', 
          user: decoded,
          userId: decoded.sub || decoded.id,
          sessionId: decoded.sessionId,
          permissions: decoded.permissions || [],
          role: decoded.role
        };
        return next();
      } catch (jwtError) {
        throw new ApiError(401, 'Invalid or expired token');
      }
    }

    throw new ApiError(401, 'Authentication required');
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (requiredRole) => {
  return async (req, res, next) => {
    try {
      if (!req.auth) {
        throw new ApiError(401, 'Authentication required');
      }

      const userRole = req.auth.role || req.auth.user?.role;
      
      if (!userRole) {
        throw new ApiError(403, 'User role not found');
      }

      // Check role hierarchy
      const roleHierarchy = {
        client: 1,
        contractor: 2,
        inspector: 3,
        adjuster: 4,
        manager: 5,
        admin: 6
      };

      const userLevel = roleHierarchy[userRole] || 0;
      const requiredLevel = roleHierarchy[requiredRole] || 0;

      if (userLevel < requiredLevel) {
        throw new ApiError(403, `Insufficient role: ${requiredRole} required`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.auth) {
        throw new ApiError(401, 'Authentication required');
      }

      const userId = req.auth.userId || req.auth.user?.id || req.auth.user?.sub;
      
      if (!userId) {
        throw new ApiError(401, 'User identification required');
      }

      const context = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        method: req.method,
        sessionId: req.auth.sessionId
      };

      const hasPermission = await rbacService.hasPermission(userId, permission, context);

      if (!hasPermission) {
        throw new ApiError(403, `Insufficient permissions: ${permission} required`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Multiple permissions authorization (requires ALL permissions)
 */
export const requireAllPermissions = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.auth) {
        throw new ApiError(401, 'Authentication required');
      }

      const userId = req.auth.userId || req.auth.user?.id || req.auth.user?.sub;
      
      if (!userId) {
        throw new ApiError(401, 'User identification required');
      }

      const context = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        method: req.method,
        sessionId: req.auth.sessionId
      };

      const hasAllPermissions = await rbacService.hasAllPermissions(userId, permissions, context);

      if (!hasAllPermissions) {
        throw new ApiError(403, `Insufficient permissions: ${permissions.join(', ')} required`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Multiple permissions authorization (requires ANY permission)
 */
export const requireAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.auth) {
        throw new ApiError(401, 'Authentication required');
      }

      const userId = req.auth.userId || req.auth.user?.id || req.auth.user?.sub;
      
      if (!userId) {
        throw new ApiError(401, 'User identification required');
      }

      const context = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        method: req.method,
        sessionId: req.auth.sessionId
      };

      const hasAnyPermission = await rbacService.hasAnyPermission(userId, permissions, context);

      if (!hasAnyPermission) {
        throw new ApiError(403, `Insufficient permissions: one of ${permissions.join(', ')} required`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Feature access authorization middleware
 */
export const requireFeatureAccess = (featureId) => {
  return async (req, res, next) => {
    try {
      if (!req.auth) {
        throw new ApiError(401, 'Authentication required');
      }

      const userId = req.auth.userId || req.auth.user?.id || req.auth.user?.sub;
      
      if (!userId) {
        throw new ApiError(401, 'User identification required');
      }

      const context = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        method: req.method,
        sessionId: req.auth.sessionId,
        tenantId: req.auth.user?.tenantId
      };

      const canAccessFeature = await rbacService.canAccessFeature(userId, featureId, context);

      if (!canAccessFeature) {
        throw new ApiError(403, `Feature access denied: ${featureId}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * API endpoint authorization middleware
 */
export const authorizeAPIEndpoint = async (req, res, next) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, 'Authentication required');
    }

    const userId = req.auth.userId || req.auth.user?.id || req.auth.user?.sub;
    
    if (!userId) {
      throw new ApiError(401, 'User identification required');
    }

    const context = {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.auth.sessionId
    };

    const authorization = await rbacService.authorizeAPIRequest(
      userId, 
      req.method, 
      req.route?.path || req.path,
      context
    );

    if (!authorization.authorized) {
      throw new ApiError(403, `API access denied: ${authorization.reason}`);
    }

    // Add authorization info to request for use in route handlers
    req.authorization = authorization;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Organization-based access control
 */
export const requireOrganizationAccess = (req, res, next) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, 'Authentication required');
    }

    const userOrgId = req.auth.user?.organizationId;
    const requestedOrgId = req.params.organizationId || req.body.organizationId || req.query.organizationId;

    // If no specific organization requested, allow (will be filtered by permissions)
    if (!requestedOrgId) {
      return next();
    }

    // Check if user belongs to the requested organization
    if (userOrgId !== requestedOrgId) {
      // Allow if user has cross-organization permissions
      const isAdmin = req.auth.user?.role === 'admin';
      const isSuperUser = req.auth.permissions?.includes('organizations:*');
      
      if (!isAdmin && !isSuperUser) {
        throw new ApiError(403, 'Access denied: insufficient organization permissions');
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Data access policy middleware
 */
export const applyDataPolicy = (policyId) => {
  return async (req, res, next) => {
    try {
      if (!req.auth) {
        throw new ApiError(401, 'Authentication required');
      }

      const userId = req.auth.userId || req.auth.user?.id || req.auth.user?.sub;
      
      if (!userId) {
        throw new ApiError(401, 'User identification required');
      }

      const context = {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.originalUrl,
        method: req.method
      };

      // Apply data policy to query parameters or body
      const query = req.query || {};
      const filteredQuery = await rbacService.applyDataPolicy(userId, policyId, query, context);

      // Replace query with filtered version
      req.query = filteredQuery;
      req.dataPolicy = {
        policyId,
        originalQuery: query,
        filteredQuery
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Audit logging middleware
 */
export const auditMiddleware = (eventType) => {
  return (req, res, next) => {
    // Store original response.json to intercept
    const originalJson = res.json;
    
    res.json = function(data) {
      // Log the audit event after successful response
      setImmediate(async () => {
        try {
          if (req.auth) {
            const userId = req.auth.userId || req.auth.user?.id || req.auth.user?.sub;
            
            await rbacService.logAuditEvent({
              eventType: eventType || 'api_access',
              userId,
              result: res.statusCode < 400 ? 'success' : 'failure',
              details: {
                method: req.method,
                endpoint: req.originalUrl,
                statusCode: res.statusCode,
                userAgent: req.get('User-Agent'),
                ipAddress: req.ip
              }
            });
          }
        } catch (error) {
          console.error('Audit logging failed:', error);
        }
      });

      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
};

function getApiKeyPermissions(apiKey) {
  // Mock implementation - would get actual API key permissions from database
  if (isAdminApiKey(apiKey)) {
    return ['*']; // Admin API keys get all permissions
  }
  return ['api:basic_access'];
}

// Aliases for backward compatibility
export const validateAuth = authMiddleware;
export const auth = authMiddleware;