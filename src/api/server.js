import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import chalk from 'chalk';
import cors from 'cors';

// Import API routes
import apiRoutes from './routes/index.js';
import { requestLogger } from './utils/logger.js';
import { notFoundHandler } from './middleware/errorHandler.js';

// Import existing Susan components
import { SusanBrain } from '../susan-brain.js';
import { CommandHandler } from '../command-handler.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SusanAPIServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    
    this.port = process.env.PORT || 3001;
    this.host = process.env.HOST || 'localhost';
    this.apiVersion = 'v1';
    
    this.setupMiddleware();
    this.setupAPI();
    this.initializeSusan();
    this.setupWebSocket();
    this.setupErrorHandling();
    this.handleGracefulShutdown();
    
    console.log(chalk.blue('🤖 Susan AI Comprehensive API Server initializing...'));
  }
  
  setupMiddleware() {
    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3004'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With']
    }));

    // Request logging
    this.app.use(requestLogger);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Security headers
    this.app.use((req, res, next) => {
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      });
      next();
    });

    // Serve static files from public directory
    const publicPath = path.join(__dirname, '..', '..', 'public');
    this.app.use(express.static(publicPath));
  }

  setupAPI() {
    // API Documentation route
    this.app.get('/docs', (req, res) => {
      res.json({
        title: 'Susan AI API Documentation',
        version: this.apiVersion,
        description: 'Comprehensive JARVIS-level AI Assistant API',
        endpoints: {
          openapi: `/api/${this.apiVersion}/openapi.yaml`,
          health: `/api/${this.apiVersion}/health`,
          conversations: `/api/${this.apiVersion}/conversations`,
          voice: `/api/${this.apiVersion}/voice`,
          models: `/api/${this.apiVersion}/models`,
          memory: `/api/${this.apiVersion}/memory`,
          plugins: `/api/${this.apiVersion}/plugins`,
          files: `/api/${this.apiVersion}/files`,
          users: `/api/${this.apiVersion}/users`,
          auth: `/api/${this.apiVersion}/auth`,
          admin: `/api/${this.apiVersion}/admin`
        },
        websocket: `ws://${this.host}:${this.port}/ws`,
        authentication: {
          types: ['API Key', 'JWT Bearer Token'],
          headers: ['X-API-Key', 'Authorization: Bearer <token>']
        }
      });
    });

    // OpenAPI specification endpoint
    this.app.get('/api/v1/openapi.yaml', (req, res) => {
      const openApiPath = path.join(__dirname, 'openapi.yaml');
      res.sendFile(openApiPath);
    });

    // Mount API routes
    this.app.use(`/api/${this.apiVersion}`, apiRoutes);

    // Legacy API compatibility (for existing Susan frontend)
    this.setupLegacyAPI();
  }

  setupLegacyAPI() {
    // Legacy health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        api: {
          version: this.apiVersion,
          documentation: '/docs'
        },
        susan: {
          brain: this.susanBrain ? 'initialized' : 'not initialized',
          commands: this.commandHandler ? 'initialized' : 'not initialized'
        }
      });
    });
    
    // Legacy message endpoint for backward compatibility
    this.app.post('/api/message', async (req, res) => {
      try {
        const { message } = req.body;
        if (!message) {
          return res.status(400).json({ error: 'Message is required' });
        }
        
        const response = await this.processLegacyMessage(message);
        res.json(response);
      } catch (error) {
        console.error('Legacy API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  setupErrorHandling() {
    // 404 handler for API routes
    this.app.use('/api/*', notFoundHandler);
    
    // Catch-all for SPA (serve index.html for frontend routes)
    this.app.get('*', (req, res) => {
      const publicPath = path.join(__dirname, '..', '..', 'public');
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  }
  
  async initializeSusan() {
    try {
      this.susanBrain = new SusanBrain();
      this.commandHandler = new CommandHandler(this.susanBrain);
      
      console.log(chalk.green('✅ Susan brain and command handler initialized'));
    } catch (error) {
      console.error(chalk.red('❌ Error initializing Susan:'), error);
      console.log(chalk.yellow('⚠️  Make sure your .env file has the required API keys'));
    }
  }
  
  setupWebSocket() {
    this.wss.on('connection', async (ws, req) => {
      const clientIP = req.socket.remoteAddress;
      
      try {
        // Extract authentication token from URL query or headers
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token') || req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          ws.close(1008, 'Authentication required');
          console.log(chalk.red(`❌ WebSocket connection rejected from ${clientIP}: No auth token`));
          return;
        }
        
        // Validate token (simplified - in production use proper JWT validation)
        const validTokens = process.env.VALID_API_KEYS?.split(',') || [];
        if (!validTokens.includes(token)) {
          ws.close(1008, 'Invalid authentication token');
          console.log(chalk.red(`❌ WebSocket connection rejected from ${clientIP}: Invalid token`));
          return;
        }
        
        ws.auth = { token, clientIP };
        ws.messageCount = 0;
        ws.lastMessageTime = Date.now();
        
        console.log(chalk.cyan(`👋 Authenticated WebSocket client connected from ${clientIP}`));
      
      } catch (error) {
        ws.close(1011, 'Authentication error');
        console.log(chalk.red(`❌ WebSocket connection error from ${clientIP}:`, error.message));
        return;
      }
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to Susan AI',
        timestamp: new Date().toISOString(),
        apiVersion: this.apiVersion,
        capabilities: [
          'real-time chat',
          'voice processing',
          'file analysis',
          'plugin execution',
          'memory search'
        ]
      }));
      
      ws.on('message', async (data) => {
        try {
          // Rate limiting check
          const now = Date.now();
          if (now - ws.lastMessageTime < 1000) { // Max 1 message per second
            ws.messageCount++;
            if (ws.messageCount > 5) { // Max 5 messages in burst
              ws.close(1008, 'Rate limit exceeded');
              return;
            }
          } else {
            ws.messageCount = 0;
          }
          ws.lastMessageTime = now;
          
          // Validate message size
          if (data.length > 1024 * 1024) { // 1MB limit
            ws.close(1009, 'Message too large');
            return;
          }
          
          const message = JSON.parse(data.toString());
          
          switch (message.type) {
            case 'message':
              const response = await this.processLegacyMessage(message.content);
              ws.send(JSON.stringify({
                type: 'response',
                content: response.content,
                model: response.model,
                timestamp: response.timestamp,
                requestId: message.requestId
              }));
              break;
              
            case 'ping':
              ws.send(JSON.stringify({
                type: 'pong',
                timestamp: new Date().toISOString()
              }));
              break;
              
            case 'subscribe':
              // Handle subscription to specific events
              ws.send(JSON.stringify({
                type: 'subscribed',
                channel: message.channel,
                timestamp: new Date().toISOString()
              }));
              break;
              
            default:
              ws.send(JSON.stringify({
                type: 'error',
                message: `Unknown message type: ${message.type}`,
                timestamp: new Date().toISOString()
              }));
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Sorry, I had trouble processing your message.',
            error: error.message,
            timestamp: new Date().toISOString()
          }));
        }
      });
      
      ws.on('close', () => {
        console.log(chalk.yellow(`👋 WebSocket client disconnected from ${clientIP}`));
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }
  
  async processLegacyMessage(userInput) {
    if (!this.susanBrain || !this.commandHandler) {
      return {
        content: 'I\'m still starting up. Please wait a moment and try again.',
        timestamp: new Date().toISOString()
      };
    }
    
    try {
      console.log(chalk.blue(`📨 Processing legacy message: "${userInput}"`));
      
      // Check if it's a greeting
      if (this.susanBrain.isGreeting(userInput)) {
        return {
          content: this.susanBrain.getGreeting(),
          model: 'susan',
          timestamp: new Date().toISOString()
        };
      }
      
      // Try to process as a command first
      const commandResult = await this.commandHandler.processInput(userInput);
      
      if (commandResult.isCommand) {
        console.log(chalk.green(`⚡ Command executed: ${commandResult.result.substring(0, 50)}...`));
        return {
          content: commandResult.result,
          model: 'command',
          timestamp: new Date().toISOString()
        };
      }
      
      // If not a command, process with AI
      const aiResponse = await this.susanBrain.processMessage(userInput);
      console.log(chalk.green(`🧠 AI Response (${aiResponse.model}): ${aiResponse.response.substring(0, 50)}...`));
      
      return {
        content: aiResponse.response,
        model: aiResponse.model,
        timestamp: aiResponse.timestamp
      };
      
    } catch (error) {
      console.error(chalk.red('❌ Error processing legacy message:'), error);
      return {
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  start() {
    this.server.listen(this.port, this.host, () => {
      console.log(chalk.green('🚀 Susan AI Comprehensive API Server started successfully!'));
      console.log(chalk.cyan(`📍 Server running at: http://${this.host}:${this.port}`));
      console.log(chalk.magenta(`📚 API Documentation: http://${this.host}:${this.port}/docs`));
      console.log(chalk.magenta(`🔧 OpenAPI Spec: http://${this.host}:${this.port}/api/v1/openapi.yaml`));
      console.log(chalk.blue(`🔌 WebSocket: ws://${this.host}:${this.port}/ws`));
      console.log(chalk.gray('Press Ctrl+C to stop the server'));
      
      // Show configuration info
      console.log('\n' + chalk.yellow('🔧 Configuration:'));
      console.log(chalk.gray(`   • API Version: ${this.apiVersion}`));
      console.log(chalk.gray(`   • OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Not configured'}`));
      console.log(chalk.gray(`   • Anthropic API: ${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Not configured'}`));
      console.log(chalk.gray(`   • Environment: ${process.env.NODE_ENV || 'development'}`));
      console.log(chalk.gray(`   • CORS Origin: ${process.env.CORS_ORIGIN || 'localhost'}`));
      console.log(chalk.gray(`   • Memory file: ${this.susanBrain?.memoryFile || 'Not initialized'}`));
      
      console.log('\n' + chalk.yellow('🔗 Available Endpoints:'));
      console.log(chalk.gray(`   • Conversations: /api/${this.apiVersion}/conversations`));
      console.log(chalk.gray(`   • Voice Processing: /api/${this.apiVersion}/voice`));
      console.log(chalk.gray(`   • AI Models: /api/${this.apiVersion}/models`));
      console.log(chalk.gray(`   • Memory Search: /api/${this.apiVersion}/memory`));
      console.log(chalk.gray(`   • Plugin System: /api/${this.apiVersion}/plugins`));
      console.log(chalk.gray(`   • File Processing: /api/${this.apiVersion}/files`));
      console.log(chalk.gray(`   • User Management: /api/${this.apiVersion}/users`));
      console.log(chalk.gray(`   • Administration: /api/${this.apiVersion}/admin`));
      console.log('');
    });
  }
  
  handleGracefulShutdown() {
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n🛑 Received SIGINT, shutting down gracefully...'));
      
      // Close WebSocket connections
      this.wss.clients.forEach((ws) => {
        ws.close();
      });
      
      this.server.close(() => {
        console.log(chalk.blue('👋 Susan AI API Server stopped'));
        process.exit(0);
      });
    });
    
    process.on('SIGTERM', () => {
      console.log(chalk.yellow('\n🛑 Received SIGTERM, shutting down gracefully...'));
      
      // Close WebSocket connections
      this.wss.clients.forEach((ws) => {
        ws.close();
      });
      
      this.server.close(() => {
        console.log(chalk.blue('👋 Susan AI API Server stopped'));
        process.exit(0);
      });
    });
  }
}

// Start the server
const susan = new SusanAPIServer();
susan.start();

export default SusanAPIServer;