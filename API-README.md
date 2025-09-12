# Susan AI - Comprehensive RESTful API System

A production-ready, enterprise-scale RESTful API system for Susan AI that provides JARVIS-level assistant capabilities with advanced features including conversation management, AI model optimization, memory search, plugin system, real-time data integration, and comprehensive administration tools.

## 🚀 Features

### Core Capabilities
- **Conversation Management**: Multi-turn conversations with context preservation
- **AI Model Management**: Model selection, performance tracking, and cost optimization
- **Memory & Context Search**: Intelligent memory search and context retrieval
- **Voice Processing**: Speech-to-text and text-to-speech capabilities
- **File & Media Processing**: Upload, analysis, OCR, and content extraction
- **Plugin System**: Extensible plugin architecture for custom functionality
- **Real-time Data**: Weather, news, stocks, and social media integration
- **User Management**: Authentication, profiles, preferences, and analytics
- **System Administration**: Monitoring, metrics, configuration, and maintenance

### Technical Features
- **RESTful Design**: Follows HTTP semantics and REST principles
- **OpenAPI 3.0 Specification**: Complete API documentation with examples
- **Authentication**: JWT tokens and API key authentication
- **Rate Limiting**: Configurable rate limits per user/IP/endpoint
- **Input Validation**: Comprehensive request validation with detailed error messages
- **Error Handling**: Standardized error responses with proper HTTP status codes
- **Logging**: Comprehensive request/response logging with rotation
- **Security**: CORS, XSS protection, input sanitization, and security headers
- **Streaming**: Server-sent events for real-time AI responses
- **WebSocket Support**: Real-time bidirectional communication
- **File Upload**: Multi-file upload with type validation and size limits
- **Versioning**: API versioning strategy for backward compatibility

## 📁 Project Structure

```
src/api/
├── controllers/           # Request handlers and business logic
│   ├── ConversationController.js
│   ├── ModelController.js
│   ├── MemoryController.js
│   └── ...
├── middleware/           # Express middleware
│   ├── auth.js          # Authentication middleware
│   ├── rateLimit.js     # Rate limiting
│   ├── validation.js    # Input validation
│   └── errorHandler.js  # Error handling
├── routes/              # API route definitions
│   ├── index.js         # Main router
│   ├── conversations.js # Conversation endpoints
│   ├── models.js        # Model management
│   ├── memory.js        # Memory and context
│   ├── voice.js         # Voice processing
│   ├── files.js         # File operations
│   ├── data.js          # Real-time data
│   ├── users.js         # User management
│   ├── auth.js          # Authentication
│   └── admin.js         # Administration
├── services/            # Business logic services
│   ├── ConversationService.js
│   ├── AIService.js
│   ├── MemoryService.js
│   ├── ModelMetricsService.js
│   └── ...
├── utils/               # Utility functions
│   ├── ApiError.js      # Error classes
│   └── logger.js        # Logging utility
├── test/                # API tests
│   └── api-test.js      # Comprehensive test suite
├── openapi.yaml         # OpenAPI specification
└── server.js            # Main server file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager
- OpenAI API key (optional but recommended)
- Anthropic API key (optional but recommended)

### Installation

1. **Clone and navigate to the project**:
   ```bash
   cd susan-ai
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   # Copy the example environment file
   copy .env.example .env
   
   # Edit .env with your configuration
   # Required: Set your AI provider API keys
   OPENAI_API_KEY=your-openai-api-key
   ANTHROPIC_API_KEY=your-anthropic-api-key
   ```

4. **Start the API server**:
   ```bash
   # Using npm script
   npm run start:api
   
   # Or using the batch file (Windows)
   start-api.bat
   
   # Or directly
   node src/api/server.js
   ```

5. **Verify installation**:
   - API Documentation: http://localhost:3001/docs
   - Health Check: http://localhost:3001/api/v1/health
   - OpenAPI Spec: http://localhost:3001/api/v1/openapi.yaml

## 🔧 Configuration

### Environment Variables

The API uses environment variables for configuration. See `.env.example` for a complete list.

#### Essential Configuration:
```bash
# Server
PORT=3001
HOST=localhost
NODE_ENV=development

# Security
JWT_SECRET=your-secret-key-change-this-in-production

# AI Providers
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Authentication
VALID_API_KEYS=test-api-key-123,your-api-key
ADMIN_API_KEYS=admin-key-789,your-admin-key
```

#### Optional Configuration:
```bash
# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=52428800
MAX_FILES_PER_REQUEST=5

# External APIs
WEATHER_API_KEY=your-weather-api-key
NEWS_API_KEY=your-news-api-key
STOCK_API_KEY=your-stock-api-key
```

## 📚 API Documentation

### Authentication

The API supports two authentication methods:

#### 1. API Key Authentication
```bash
curl -H "X-API-Key: your-api-key" \
     http://localhost:3001/api/v1/conversations
```

#### 2. JWT Token Authentication
```bash
# Login to get token
curl -X POST http://localhost:3001/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@susan-ai.com","password":"admin123"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer your-jwt-token" \
     http://localhost:3001/api/v1/conversations
```

### Core Endpoints

#### Health Check
```bash
GET /api/v1/health
```

#### Conversations
```bash
# List conversations
GET /api/v1/conversations

# Create conversation
POST /api/v1/conversations
{
  "title": "My Conversation",
  "initialMessage": "Hello, Susan!"
}

# Send message
POST /api/v1/conversations/{id}/messages
{
  "content": "What is artificial intelligence?",
  "model": "gpt-3.5-turbo"
}

# Stream response
POST /api/v1/conversations/{id}/messages/stream
{
  "content": "Explain quantum computing",
  "model": "claude-3-sonnet"
}
```

#### AI Models
```bash
# List available models
GET /api/v1/models

# Get model metrics
GET /api/v1/models/gpt-3.5-turbo/metrics?timeframe=day

# Get cost analytics
GET /api/v1/models/analytics/costs?timeframe=month
```

#### Memory & Context
```bash
# Search memory
POST /api/v1/memory/search
{
  "query": "machine learning concepts",
  "limit": 10
}

# Get context
GET /api/v1/memory/context?conversationId=conv_123&depth=20

# Get analytics
GET /api/v1/memory/analytics?timeframe=month
```

#### Voice Processing
```bash
# Text to speech
POST /api/v1/voice/synthesize
{
  "text": "Hello, this is Susan AI",
  "voice": "alloy",
  "speed": 1.0
}

# Speech to text (multipart form)
POST /api/v1/voice/transcribe
Content-Type: multipart/form-data
audio: (audio file)
```

#### File Processing
```bash
# Upload files
POST /api/v1/files/upload
Content-Type: multipart/form-data
files: (file1, file2, ...)
purpose: "analysis"

# Analyze file
POST /api/v1/files/{id}/analyze
{
  "analysisType": "content_extraction",
  "options": {}
}
```

#### Real-time Data
```bash
# Weather data
GET /api/v1/data/weather?location=London&units=metric

# News feed
GET /api/v1/data/news?category=technology&limit=10

# Stock data
GET /api/v1/data/stocks?symbols=AAPL,GOOGL,MSFT

# Cryptocurrency data
GET /api/v1/data/crypto?symbols=bitcoin,ethereum&currency=usd
```

#### User Management
```bash
# User profile
GET /api/v1/users/profile

# Update preferences
PUT /api/v1/users/preferences
{
  "preferences": {
    "theme": "dark",
    "defaultModel": "claude-3-sonnet"
  }
}

# Usage analytics
GET /api/v1/users/usage?timeframe=month
```

#### Administration
```bash
# System status
GET /api/v1/admin/system/status

# System metrics
GET /api/v1/admin/system/metrics?timeframe=hour

# System logs
GET /api/v1/admin/system/logs?level=error&limit=100
```

## 🧪 Testing

### Running Tests

```bash
# Make sure the API server is running first
npm run start:api

# Run the test suite
npm test

# Or use the batch file (Windows)
test-api.bat

# Or run directly
node src/api/test/api-test.js
```

### Test Coverage

The test suite covers:
- Health checks and system status
- Authentication and authorization
- All API endpoints and HTTP methods
- Input validation and error handling
- Rate limiting behavior
- File upload functionality
- WebSocket connections
- Response format validation

## 🔒 Security

### Security Features
- **Input Validation**: All inputs validated against schemas
- **Rate Limiting**: Configurable limits per endpoint/user/IP
- **Authentication**: JWT tokens and API key validation
- **Authorization**: Role-based access control for admin endpoints
- **CORS**: Configurable cross-origin resource sharing
- **Security Headers**: XSS protection, content type options, frame options
- **Request Size Limits**: Configurable limits for different endpoints
- **File Type Validation**: Whitelist-based file type checking
- **SQL Injection Prevention**: Parameterized queries and input sanitization

### Security Best Practices
1. Use strong JWT secrets in production
2. Implement proper API key rotation
3. Enable HTTPS in production
4. Regularly update dependencies
5. Monitor rate limit violations
6. Implement request logging and monitoring
7. Use environment variables for sensitive data
8. Implement proper backup and recovery procedures

## 📊 Monitoring & Analytics

### Logging
- Request/response logging with unique request IDs
- Error logging with stack traces
- Performance metrics (response times, token usage)
- Security event logging
- Automatic log rotation and cleanup

### Metrics
- API request rates and response times
- AI model usage and costs
- User activity and engagement
- System resource utilization
- Error rates and types

### Health Monitoring
- Service health checks
- Database connectivity
- External API availability
- Memory and disk usage
- Rate limit violations

## 🔌 Plugin System

The API includes a comprehensive plugin system for extending functionality:

### Plugin Features
- Dynamic plugin loading and unloading
- Plugin marketplace integration
- Configuration management
- Execution monitoring and logging
- Security sandboxing
- Performance metrics

### Plugin Development
```javascript
// Example plugin structure
export class MyPlugin {
  constructor(config) {
    this.config = config;
  }
  
  async execute(functionName, parameters) {
    // Plugin logic here
    return { result: 'success' };
  }
  
  getCapabilities() {
    return ['data_processing', 'external_integration'];
  }
}
```

## 🚀 Production Deployment

### Prerequisites for Production
1. **Environment Setup**:
   - Set `NODE_ENV=production`
   - Use strong JWT secrets
   - Configure proper CORS origins
   - Set up SSL/TLS certificates

2. **Database Configuration**:
   - Set up production database
   - Configure connection pooling
   - Implement backup strategies

3. **Monitoring**:
   - Set up application monitoring
   - Configure log aggregation
   - Implement health checks
   - Set up alerting

4. **Security**:
   - Enable HTTPS
   - Configure firewalls
   - Implement API rate limiting
   - Set up intrusion detection

### Deployment Options
- **Docker**: Containerized deployment
- **Cloud Platforms**: AWS, Azure, Google Cloud
- **VPS**: Traditional server deployment
- **Kubernetes**: Orchestrated container deployment

## 🛠️ Development

### Development Setup
```bash
# Clone repository
git clone <repository-url>
cd susan-ai

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start in development mode with auto-reload
npm run dev:api
```

### Code Structure Guidelines
- **Controllers**: Handle HTTP requests and responses
- **Services**: Contain business logic and data operations
- **Middleware**: Handle cross-cutting concerns (auth, validation, logging)
- **Routes**: Define API endpoints and their handlers
- **Utils**: Shared utility functions and classes

### Adding New Endpoints
1. Define route in appropriate route file
2. Create controller method
3. Add service layer logic if needed
4. Update OpenAPI specification
5. Add tests for new functionality
6. Update documentation

## 📈 Performance

### Optimization Features
- Request/response compression
- Efficient data structures
- Streaming for large responses
- Connection pooling
- Caching strategies
- Rate limiting
- Memory management

### Performance Monitoring
- Response time tracking
- Memory usage monitoring
- CPU utilization tracking
- Database query performance
- External API latency

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Update documentation
7. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the API documentation at `/docs`
- Review the OpenAPI specification at `/api/v1/openapi.yaml`
- Run the test suite to verify functionality
- Check logs for error details
- Review configuration settings

## 🔄 API Versioning

The API uses URL path versioning (`/api/v1/`). Future versions will maintain backward compatibility where possible. Breaking changes will result in new version numbers.

---

**Built with ❤️ for enterprise-scale AI applications**