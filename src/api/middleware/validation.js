import { ApiError } from '../utils/ApiError.js';

// Input sanitization functions
export const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    // Basic XSS protection - escape HTML characters
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  return input;
};

export const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeInput(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[sanitizeInput(key)] = sanitizeObject(value);
  }
  return sanitized;
};

export const validationMiddleware = (req, res, next) => {
  // Add request ID for tracking
  req.requestId = generateRequestId();
  
  // Sanitize request body, query, and params
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  // Validate content type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers && req.headers['content-type'];
    
    // Allow multipart/form-data for file uploads
    if (req.path.includes('/upload') || req.path.includes('/files')) {
      if (!contentType || (!contentType.includes('multipart/form-data') && !contentType.includes('application/json'))) {
        return next(new ApiError(400, 'Content-Type must be multipart/form-data or application/json'));
      }
    } else {
      // Require JSON for other requests
      if (!contentType || !contentType.includes('application/json')) {
        return next(new ApiError(400, 'Content-Type must be application/json'));
      }
    }
  }

  // Validate request size
  const contentLength = req.headers && req.headers['content-length'];
  if (contentLength) {
    const maxSize = getMaxRequestSize(req.path);
    if (parseInt(contentLength) > maxSize) {
      return next(new ApiError(413, `Request too large. Maximum size: ${formatBytes(maxSize)}`));
    }
  }

  next();
};

export const validateJsonSchema = (schema) => {
  return (req, res, next) => {
    try {
      const result = validateRequest(req.body, schema);
      if (!result.valid) {
        throw new ApiError(400, 'Validation failed', result.errors);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validateQueryParams = (schema) => {
  return (req, res, next) => {
    try {
      const result = validateRequest(req.query, schema);
      if (!result.valid) {
        throw new ApiError(400, 'Query parameter validation failed', result.errors);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validateParams = (schema) => {
  return (req, res, next) => {
    try {
      const result = validateRequest(req.params, schema);
      if (!result.valid) {
        throw new ApiError(400, 'Path parameter validation failed', result.errors);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Common validation schemas
export const schemas = {
  // Conversation schemas
  createConversation: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 200 },
      initialMessage: { type: 'string', maxLength: 10000 },
      metadata: { type: 'object' }
    },
    additionalProperties: false
  },

  sendMessage: {
    type: 'object',
    required: ['content'],
    properties: {
      content: { type: 'string', minLength: 1, maxLength: 10000 },
      model: { type: 'string' },
      stream: { type: 'boolean' },
      options: {
        type: 'object',
        properties: {
          temperature: { type: 'number', minimum: 0, maximum: 2 },
          maxTokens: { type: 'integer', minimum: 1, maximum: 8000 }
        }
      }
    },
    additionalProperties: false
  },

  // User schemas
  updateProfile: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      email: { type: 'string', format: 'email' },
      preferences: { type: 'object' }
    },
    additionalProperties: false
  },

  // Auth schemas
  login: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 6 }
    },
    additionalProperties: false
  },

  // Plugin schemas
  installPlugin: {
    type: 'object',
    required: ['source'],
    properties: {
      source: { type: 'string', minLength: 1 },
      configuration: { type: 'object' }
    },
    additionalProperties: false
  },

  // Common query params
  pagination: {
    type: 'object',
    properties: {
      page: { type: 'string', pattern: '^[1-9]\\d*$' },
      limit: { type: 'string', pattern: '^([1-9]|[1-9]\\d|100)$' }
    }
  },

  // Path parameters
  uuid: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' }
    }
  }
};

export function validateRequest(data, schema) {
  const errors = [];
  
  if (!validateObject(data, schema, errors, '')) {
    return { valid: false, errors };
  }
  
  return { valid: true };
}

function validateObject(obj, schema, errors, path) {
  if (schema.type === 'object') {
    if (typeof obj !== 'object' || obj === null) {
      errors.push({ path, message: 'Must be an object' });
      return false;
    }

    // Check required properties
    if (schema.required) {
      for (const prop of schema.required) {
        if (!(prop in obj)) {
          errors.push({ path: `${path}.${prop}`, message: 'Required property missing' });
        }
      }
    }

    // Validate properties
    if (schema.properties) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (prop in obj) {
          validateProperty(obj[prop], propSchema, errors, `${path}.${prop}`);
        }
      }
    }

    // Check for additional properties
    if (schema.additionalProperties === false) {
      const allowedProps = Object.keys(schema.properties || {});
      for (const prop of Object.keys(obj)) {
        if (!allowedProps.includes(prop)) {
          errors.push({ path: `${path}.${prop}`, message: 'Additional property not allowed' });
        }
      }
    }
  }

  return errors.length === 0;
}

function validateProperty(value, schema, errors, path) {
  // Type validation
  if (schema.type) {
    if (!validateType(value, schema.type)) {
      errors.push({ path, message: `Must be of type ${schema.type}` });
      return;
    }
  }

  // String validations
  if (schema.type === 'string') {
    if (schema.minLength && value.length < schema.minLength) {
      errors.push({ path, message: `Must be at least ${schema.minLength} characters long` });
    }
    if (schema.maxLength && value.length > schema.maxLength) {
      errors.push({ path, message: `Must be at most ${schema.maxLength} characters long` });
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push({ path, message: 'Does not match required pattern' });
    }
    if (schema.format === 'email' && !isValidEmail(value)) {
      errors.push({ path, message: 'Must be a valid email address' });
    }
  }

  // Number validations
  if (schema.type === 'number' || schema.type === 'integer') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({ path, message: `Must be at least ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({ path, message: `Must be at most ${schema.maximum}` });
    }
  }

  // Object validation
  if (schema.type === 'object') {
    validateObject(value, schema, errors, path);
  }
}

function validateType(value, type) {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    default:
      return true;
  }
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function getMaxRequestSize(path) {
  // File upload endpoints get larger limits
  if (path.includes('/upload') || path.includes('/files')) {
    return 50 * 1024 * 1024; // 50MB
  }
  
  // Voice endpoints get medium limits
  if (path.includes('/voice')) {
    return 10 * 1024 * 1024; // 10MB
  }
  
  // Default limit for other endpoints
  return 1 * 1024 * 1024; // 1MB
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateRequestId() {
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Alias for backward compatibility
export const validation = validationMiddleware;