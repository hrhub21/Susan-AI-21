import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import chalk from 'chalk';
import multer from 'multer';
import OpenAI from 'openai';
import fs from 'fs';

import { SusanBrain } from './susan-brain.js';
import { CommandHandler } from './command-handler.js';
import { EnhancedRoofERService } from './api/services/EnhancedRoofERService.js';
import apiRoutes from './api/routes/index.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SusanServer {
    constructor() {
        this.app = express();
        this.server = createServer(this.app);
        this.wss = new WebSocketServer({ server: this.server });
        
        this.port = process.env.PORT || 3001;
        this.host = process.env.HOST || 'localhost';
        
        // Initialize OpenAI for Whisper
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        // Configure multer for file uploads
        this.upload = multer({ 
            storage: multer.memoryStorage(),
            limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
        });
        
        this.setupExpress();
        this.initializeSusan();
        this.setupWebSocket();
        this.handleGracefulShutdown();
        
        console.log(chalk.blue('🤖 Susan AI Server initializing...'));
    }
    
    setupExpress() {
        // Body parsing middleware (must come before routes)
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Mount API routes BEFORE static files
        this.app.use('/api', apiRoutes);
        
        // Serve static files from public directory
        const publicPath = path.join(__dirname, '..', 'public');
        this.app.use(express.static(publicPath));
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                susan: {
                    brain: this.susanBrain ? 'initialized' : 'not initialized',
                    commands: this.commandHandler ? 'initialized' : 'not initialized'
                }
            });
        });
        
        // API endpoint for text-only interactions
        this.app.post('/api/message', async (req, res) => {
            try {
                const { message } = req.body;
                if (!message) {
                    return res.status(400).json({ error: 'Message is required' });
                }
                
                const response = await this.processMessage(message);
                res.json(response);
            } catch (error) {
                console.error('API Error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
        
        // Whisper transcription endpoint with enhanced voice processing
        this.app.post('/api/v1/voice/transcribe', this.upload.single('audio'), async (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'No audio file provided' 
                    });
                }
                
                console.log(`🎤 Transcribing audio file: ${req.file.originalname} (${req.file.size} bytes)`);
                
                // Create a File object for OpenAI
                const audioFile = new File([req.file.buffer], req.file.originalname, {
                    type: req.file.mimetype
                });
                
                const transcription = await this.openai.audio.transcriptions.create({
                    file: audioFile,
                    model: 'whisper-1',
                    language: 'en'
                });
                
                console.log(`🎯 Transcription result: "${transcription.text}"`);
                
                // Process the transcribed text through Susan's enhanced system
                const response = await this.processMessage(transcription.text);
                
                res.json({
                    success: true,
                    transcription: transcription.text,
                    susan_response: response,
                    voice_processing: true
                });
                
            } catch (error) {
                console.error('Whisper transcription error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Transcription failed',
                    details: error.message
                });
            }
        });

        // Document upload and analysis endpoint for claim documents
        this.app.post('/api/v1/documents/analyze', this.upload.single('document'), async (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'No document file provided' 
                    });
                }
                
                console.log(`📄 Analyzing document: ${req.file.originalname} (${req.file.size} bytes)`);
                
                // Process document based on type
                let analysis = await this.analyzeUploadedDocument(req.file, req.body.query || '');
                
                res.json({
                    success: true,
                    filename: req.file.originalname,
                    analysis: analysis,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('Document analysis error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Document analysis failed',
                    details: error.message
                });
            }
        });
        
        // Roof-ER Knowledge Base status endpoint
        this.app.get('/api/roofer-knowledge/status', async (req, res) => {
            try {
                const stats = await this.roofERKnowledge.getKnowledgeStats();
                res.json({
                    status: 'operational',
                    message: 'Roof-ER Knowledge Base is integrated into Susan\'s main conversation system',
                    integration: 'Built into /api/message endpoint - just ask Susan work-related questions!',
                    stats: stats,
                    lastUpdate: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({ 
                    status: 'error', 
                    error: 'Failed to fetch knowledge base status' 
                });
            }
        });
        
        // Documents API - Serve Sales Rep Resources documents
        this.app.get('/api/documents/list', (req, res) => {
            try {
                const documentsPath = '/Users/a21/Downloads/Sales Rep Resources/';
                
                const getDocuments = (dir, basePath = '') => {
                    let documents = [];
                    const items = fs.readdirSync(dir, { withFileTypes: true });
                    
                    items.forEach(item => {
                        if (item.name.startsWith('.')) return; // Skip hidden files
                        
                        const fullPath = path.join(dir, item.name);
                        const relativePath = path.join(basePath, item.name);
                        
                        if (item.isDirectory()) {
                            documents = documents.concat(getDocuments(fullPath, relativePath));
                        } else {
                            const ext = path.extname(item.name).toLowerCase();
                            if (['.pdf', '.docx', '.doc', '.xlsx', '.jpg', '.jpeg', '.png'].includes(ext)) {
                                documents.push({
                                    name: item.name,
                                    path: relativePath,
                                    type: ext.substring(1),
                                    size: fs.statSync(fullPath).size,
                                    category: basePath || 'root'
                                });
                            }
                        }
                    });
                    
                    return documents;
                };
                
                const documents = getDocuments(documentsPath);
                res.json({ documents, total: documents.length });
            } catch (error) {
                console.error('Error listing documents:', error);
                res.status(500).json({ error: 'Failed to list documents' });
            }
        });
        
        // Serve individual documents
        this.app.get('/api/documents/serve/:category/:filename', (req, res) => {
            try {
                const { category, filename } = req.params;
                const documentsPath = '/Users/a21/Downloads/Sales Rep Resources/';
                let filePath;
                
                if (category === 'root') {
                    filePath = path.join(documentsPath, filename);
                } else {
                    filePath = path.join(documentsPath, decodeURIComponent(category), filename);
                }
                
                if (!fs.existsSync(filePath)) {
                    return res.status(404).json({ error: 'Document not found' });
                }
                
                const ext = path.extname(filename).toLowerCase();
                let contentType = 'application/octet-stream';
                
                switch (ext) {
                    case '.pdf':
                        contentType = 'application/pdf';
                        break;
                    case '.docx':
                        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                        break;
                    case '.doc':
                        contentType = 'application/msword';
                        break;
                    case '.xlsx':
                        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                        break;
                    case '.jpg':
                    case '.jpeg':
                        contentType = 'image/jpeg';
                        break;
                    case '.png':
                        contentType = 'image/png';
                        break;
                }
                
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
                res.sendFile(filePath);
            } catch (error) {
                console.error('Error serving document:', error);
                res.status(500).json({ error: 'Failed to serve document' });
            }
        });
        
        // Catch-all for SPA
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(publicPath, 'index.html'));
        });
    }
    
    async initializeSusan() {
        try {
            this.susanBrain = new SusanBrain();
            this.commandHandler = new CommandHandler(this.susanBrain);
            this.roofERKnowledge = new EnhancedRoofERService();
            
            console.log(chalk.green('✅ Susan brain and command handler initialized'));
        } catch (error) {
            console.error(chalk.red('❌ Error initializing Susan:'), error);
            console.log(chalk.yellow('⚠️  Make sure your .env file has the required API keys'));
        }
    }
    
    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            const clientIP = req.socket.remoteAddress;
            console.log(chalk.cyan(`👋 New client connected from ${clientIP}`));
            
            // Send welcome message
            ws.send(JSON.stringify({
                type: 'response',
                content: this.susanBrain ? this.susanBrain.getGreeting() : 'Hello! I\'m starting up...',
                timestamp: new Date().toISOString()
            }));
            
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    
                    if (message.type === 'message') {
                        const response = await this.processMessage(message.content);
                        
                        ws.send(JSON.stringify({
                            type: 'response',
                            content: response.content,
                            model: response.model,
                            timestamp: response.timestamp
                        }));
                    }
                } catch (error) {
                    console.error('WebSocket message error:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        content: 'Sorry, I had trouble processing your message.',
                        timestamp: new Date().toISOString()
                    }));
                }
            });
            
            ws.on('close', () => {
                console.log(chalk.yellow(`👋 Client disconnected from ${clientIP}`));
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });
        });
    }
    
    async processMessage(userInput) {
        if (!this.susanBrain || !this.commandHandler) {
            return {
                content: 'I\'m still starting up. Please wait a moment and try again.',
                timestamp: new Date().toISOString()
            };
        }
        
        try {
            console.log(chalk.blue(`📨 Processing: "${userInput}"`));
            
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
            
            // Check if it's a casual company question first
            if (this.isCasualCompanyQuestion(userInput)) {
                console.log(chalk.blue(`💬 Casual company question - using natural conversation`));
                // Skip RoofER service and go directly to natural AI response
            }
            // Check if it's a work-related question for Roof-ER knowledge
            else if (this.isWorkRelatedQuestion(userInput)) {
                console.log(chalk.blue(`🏢 Work-related question detected, checking Roof-ER knowledge...`));
                
                try {
                    const roofERResult = await this.roofERKnowledge.processClaimQuery(userInput);
                    
                    if (roofERResult.confidence > 0.3) {
                        console.log(chalk.green(`🎯 Enhanced SUSAN Response (confidence: ${roofERResult.confidence})`));
                        
                        let response = roofERResult.response;
                        
                        // Add escalation notice if needed
                        if (roofERResult.escalation?.needed) {
                            response += `\n\n⚠️ **ESCALATION NEEDED:** ${roofERResult.escalation.reason}\n📞 Contact: ${roofERResult.escalation.contact}`;
                        }
                        
                        return {
                            content: response,
                            model: roofERResult.model || 'susan-roofing-specialist',
                            confidence: roofERResult.confidence,
                            scenario: roofERResult.scenario,
                            timestamp: roofERResult.timestamp || new Date().toISOString()
                        };
                    }
                } catch (error) {
                    console.error(chalk.red('❌ Error with Roof-ER knowledge:'), error);
                }
            }
            
            // If not a command or work question, process with AI
            const aiResponse = await this.susanBrain.processMessage(userInput);
            console.log(chalk.green(`🧠 AI Response (${aiResponse.model}): ${aiResponse.response.substring(0, 50)}...`));
            
            return {
                content: aiResponse.response,
                model: aiResponse.model,
                timestamp: aiResponse.timestamp
            };
            
        } catch (error) {
            console.error(chalk.red('❌ Error processing message:'), error);
            return {
                content: 'I apologize, but I encountered an error processing your request. Please try again.',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    isWorkRelatedQuestion(input) {
        const lowerInput = input.toLowerCase();
        
        // Exclude casual questions about the company/employees
        const casualQuestions = [
            /do you know.*roof.?er.*employ/i,
            /who.*work.*roof.?er/i,
            /tell me about.*roof.?er/i,
            /what.*roof.?er.*company/i,
            /roof.?er.*people/i,
            /about.*roof.?er/i
        ];
        
        if (casualQuestions.some(pattern => pattern.test(input))) {
            return false;
        }
        
        // Only match SPECIFIC work task patterns
        const specificWorkPatterns = [
            // Specific roofing tasks
            /how.*inspect.*roof/i,
            /roof.*damage.*assess/i,
            /shingle.*repair/i,
            /leak.*fix/i,
            /roof.*replacement/i,
            
            // Insurance claim tasks
            /insurance.*claim.*process/i,
            /adjuster.*meeting/i,
            /claim.*documentation/i,
            /dispute.*insurance/i,
            /estimate.*template/i,
            
            // Sales tasks
            /sales.*pitch/i,
            /customer.*presentation/i,
            /contract.*template/i,
            /proposal.*write/i,
            
            // Specific work processes
            /template for/i,
            /email template/i,
            /script for/i,
            /procedure for/i,
            /how do i.*process/i,
            /what is the process/i,
            /steps to.*complete/i,
            /who do i contact.*claim/i,
            /escalation.*procedure/i
        ];
        
        return specificWorkPatterns.some(pattern => pattern.test(input));
    }
    
    isCasualCompanyQuestion(input) {
        const casualQuestions = [
            /do you know.*roof.?er.*employ/i,
            /who.*work.*roof.?er/i,
            /tell me about.*roof.?er/i,
            /what.*roof.?er.*company/i,
            /roof.?er.*people/i,
            /about.*roof.?er/i,
            /roof.?er.*team/i,
            /know.*anyone.*roof.?er/i,
            /meet.*roof.?er/i,
            /roof.?er.*staff/i
        ];
        
        return casualQuestions.some(pattern => pattern.test(input));
    }

    async analyzeUploadedDocument(file, query) {
        try {
            const fileExtension = path.extname(file.originalname).toLowerCase();
            
            // Determine document type and analysis approach
            let documentType = 'unknown';
            let analysisContext = '';
            
            if (fileExtension === '.pdf') {
                documentType = 'pdf_claim_document';
                analysisContext = 'This appears to be a claim-related PDF document. ';
            } else if (['.jpg', '.jpeg', '.png'].includes(fileExtension)) {
                documentType = 'photo_evidence';
                analysisContext = 'This appears to be photo evidence for a claim. ';
            } else if (['.docx', '.doc'].includes(fileExtension)) {
                documentType = 'document_template';
                analysisContext = 'This appears to be a document or template. ';
            }
            
            // Create analysis prompt based on document type
            const analysisPrompt = `${analysisContext}User query: "${query}". 
            
            Please analyze this ${documentType} and provide Roof-ER specific guidance:
            1. What type of claim document is this?
            2. What Roof-ER template should be used in response?
            3. What specific evidence or arguments should be highlighted?
            4. What are the next steps for the sales rep?
            
            Focus on Roof-ER's internal processes and templates, not manufacturer guidelines unless specifically needed.`;
            
            // For now, analyze based on filename and user query
            const contextualQuery = `Document uploaded: ${file.originalname}. ${query}. Please analyze and provide appropriate Roof-ER template and guidance.`;
            
            // Process through Susan's enhanced system
            const susanAnalysis = await this.roofERKnowledge.processClaimQuery(contextualQuery);
            
            return {
                document_type: documentType,
                filename: file.originalname,
                file_size: file.size,
                analysis_context: analysisContext,
                susan_guidance: susanAnalysis,
                recommended_actions: this.getDocumentRecommendations(documentType, susanAnalysis)
            };
            
        } catch (error) {
            console.error('Error analyzing document:', error);
            return {
                error: 'Analysis failed',
                message: 'Please contact your Team Leader for assistance with this document.',
                escalation_needed: true
            };
        }
    }
    
    getDocumentRecommendations(documentType, susanAnalysis) {
        const baseRecommendations = [
            'Review Susan\'s template suggestions',
            'Customize the template for your specific claim',
            'Attach supporting documentation',
            'CC the homeowner on all communications'
        ];
        
        switch (documentType) {
            case 'pdf_claim_document':
                return [
                    'Extract claim number and adjuster information',
                    'Identify partial vs full denial',
                    'Use appropriate Roof-ER response template',
                    ...baseRecommendations
                ];
            case 'photo_evidence':
                return [
                    'Use Roof-ER Photo Report Template',
                    'Document all visible damage clearly',
                    'Include collateral damage (gutters, vents, etc.)',
                    ...baseRecommendations
                ];
            case 'document_template':
                return [
                    'Review for Roof-ER compliance',
                    'Ensure proper escalation protocols',
                    'Verify contact information accuracy',
                    ...baseRecommendations
                ];
            default:
                return baseRecommendations;
        }
    }
    
    start() {
        this.server.listen(this.port, this.host, () => {
            console.log(chalk.green('🚀 Susan AI Server started successfully!'));
            console.log(chalk.cyan(`📍 Server running at: http://${this.host}:${this.port}`));
            console.log(chalk.magenta('💡 Open the URL in your browser to interact with Susan'));
            console.log(chalk.gray('Press Ctrl+C to stop the server'));
            
            // Show configuration info
            console.log('\n' + chalk.yellow('🔧 Configuration:'));
            console.log(chalk.gray(`   • OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Not configured'}`));
            console.log(chalk.gray(`   • Anthropic API: ${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Not configured'}`));
            console.log(chalk.gray(`   • Memory file: ${this.susanBrain?.memoryFile || 'Not initialized'}`));
            console.log('');
        });
    }
    
    handleGracefulShutdown() {
        process.on('SIGINT', () => {
            console.log(chalk.yellow('\n🛑 Received SIGINT, shutting down gracefully...'));
            
            this.server.close(() => {
                console.log(chalk.blue('👋 Susan AI Server stopped'));
                process.exit(0);
            });
        });
        
        process.on('SIGTERM', () => {
            console.log(chalk.yellow('\n🛑 Received SIGTERM, shutting down gracefully...'));
            
            this.server.close(() => {
                console.log(chalk.blue('👋 Susan AI Server stopped'));
                process.exit(0);
            });
        });
    }
}

// Start the server
const susan = new SusanServer();
susan.start();

export default SusanServer;