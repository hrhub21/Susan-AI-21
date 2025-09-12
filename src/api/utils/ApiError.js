export class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', details = null) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Unauthorized', details = null) {
    return new ApiError(401, message, details);
  }

  static forbidden(message = 'Forbidden', details = null) {
    return new ApiError(403, message, details);
  }

  static notFound(message = 'Not Found', details = null) {
    return new ApiError(404, message, details);
  }

  static conflict(message = 'Conflict', details = null) {
    return new ApiError(409, message, details);
  }

  static unprocessableEntity(message = 'Unprocessable Entity', details = null) {
    return new ApiError(422, message, details);
  }

  static tooManyRequests(message = 'Too Many Requests', details = null) {
    return new ApiError(429, message, details);
  }

  static internalServerError(message = 'Internal Server Error', details = null) {
    return new ApiError(500, message, details);
  }

  static notImplemented(message = 'Not Implemented', details = null) {
    return new ApiError(501, message, details);
  }

  static serviceUnavailable(message = 'Service Unavailable', details = null) {
    return new ApiError(503, message, details);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details
    };
  }
}