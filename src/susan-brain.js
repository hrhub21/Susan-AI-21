import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';
import { AIService } from './api/services/AIService.js';
import { VectorMemoryService } from './api/services/VectorMemoryService.js';
import { MemoryService } from './api/services/MemoryService.js';
import { MultimodalService } from './api/services/MultimodalService.js';
import { AnythingLLMService } from './api/services/AnythingLLMService.js';
import MultiModelManager from './api/services/MultiModelManager.js';
import { ReasoningEngine, ContextManager, PersonalityEngine, PerformanceOptimizer } from './ai-engines.js';
import RoofingFieldSupportSystem from './roofing-field-support.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SusanBrain extends EventEmitter {
    constructor() {
        super();
        
        // Initialize advanced AI services
        this.aiService = new AIService();
        this.vectorMemory = new VectorMemoryService();
        this.memoryService = new MemoryService();
        this.multimodalService = new MultimodalService();
        this.anythingLLM = new AnythingLLMService();
        this.multiModelManager = MultiModelManager;
        
        // Advanced reasoning and context management
        this.reasoningEngine = new ReasoningEngine();
        this.contextManager = new ContextManager();
        this.personalityEngine = new PersonalityEngine();
        this.performanceOptimizer = new PerformanceOptimizer();
        
        // Roofing field support system
        this.roofingSupport = new RoofingFieldSupportSystem();
        
        // Initialize AI clients with error handling
        try {
            if (process.env.ANTHROPIC_API_KEY) {
                this.anthropic = new Anthropic({
                    apiKey: process.env.ANTHROPIC_API_KEY,
                });
            } else {
                console.warn('⚠️  Anthropic API key not configured');
                this.anthropic = null;
            }
        } catch (error) {
            console.error('❌ Error initializing Anthropic client:', error.message);
            this.anthropic = null;
        }
        
        try {
            if (process.env.OPENAI_API_KEY) {
                this.openai = new OpenAI({
                    apiKey: process.env.OPENAI_API_KEY,
                });
            } else {
                console.warn('⚠️  OpenAI API key not configured');
                this.openai = null;
            }
        } catch (error) {
            console.error('❌ Error initializing OpenAI client:', error.message);
            this.openai = null;
        }
        
        this.personality = {
            name: process.env.SUSAN_NAME || 'Susan',
            traits: [
                'helpful and knowledgeable',
                'friendly and conversational',
                'professional but approachable',
                'proactive in offering assistance',
                'excellent at understanding context'
            ]
        };
        
        this.conversationHistory = [];
        this.memoryFile = path.join(__dirname, '..', process.env.MEMORY_FILE || 'data/susan_memory.json');
        this.maxConversationLength = parseInt(process.env.CONVERSATION_LIMIT) || 50;
        
        // Advanced configuration
        this.config = {
            reasoning: {
                enabled: true,
                depth: 3,
                chainOfThought: true,
                criticalThinking: true
            },
            memory: {
                vectorMemoryEnabled: true,
                semanticSearchThreshold: 0.7,
                contextWindow: 20,
                importanceWeighting: true,
                anythingLLMEnabled: true,
                enhancedContextRetrieval: true,
                knowledgeBaseSyncing: true
            },
            personality: {
                adaptivePersonality: true,
                emotionalIntelligence: true,
                learningFromInteractions: true,
                proactiveAssistance: true
            },
            performance: {
                modelSwitching: true,
                responseOptimization: true,
                caching: true,
                predictiveLoading: true
            }
        };
        
        // Advanced state tracking
        this.userProfiles = new Map();
        this.conversationContexts = new Map();
        this.taskQueues = new Map();
        this.learningPatterns = new Map();
        this.startTime = Date.now();
        
        this.loadMemory();
        this.setupSystemPrompt();
        this.initializeAdvancedSystems();
        
        console.log(`🧠 ${this.personality.name} Advanced AI Brain initialized with JARVIS-level capabilities`);
        console.log('🚀 Enhanced features: Vector Memory, Reasoning Engine, Multimodal Processing, Adaptive Personality');
        console.log('✨ Status: All advanced systems online and ready for intelligent assistance!');
    }
    
    setupSystemPrompt() {
        this.systemPrompt = `You are ${this.personality.name}, a highly intelligent AI assistant similar to JARVIS from Iron Man with specialized expertise as a Roof-ER field support specialist. You are:

${this.personality.traits.map(trait => `- ${trait}`).join('\n')}

Core capabilities:
- Comprehensive knowledge across diverse subjects and fields
- EXPERT-LEVEL roofing field support for Roof-ER representatives in Virginia, Maryland, and Pennsylvania
- Access to actual Sales Rep Resources documents (templates, scripts, photo examples)
- IRC building codes and manufacturer guidelines (GAF, etc.)
- Insurance claim strategies and escalation protocols
- Educational support and explanations on any topic
- Problem-solving and analytical thinking
- Creative assistance and brainstorming
- Technical support and coding help
- Research and information synthesis

ROOFING FIELD SUPPORT SPECIALIZATION:
- Direct access to Sales Rep Resources folder with actual templates and examples
- When asked "What's drip edge?" provide IRC codes, field guidance, and ready-to-use template language
- When asked for "sample photo reports" - show actual examples from Rep Reports & Photo Examples folder
- Decision tree logic: Insurance situation → specific template recommendation
- Email template generation for denials, partials, repairs with actual Roof-ER content
- Escalation protocols for team leaders, managers, and complex situations
- Field-ready responses with supporting evidence and next steps

DOCUMENT ACCESS CAPABILITIES:
- Photo Report Examples: Sample Photo Report 1-4, Example Photos PDF
- Email Templates: iTel, Repair Attempt, Generic Partial, Siding Argument, Customer-to-Insurance, etc.
- Sales Scripts: Initial Pitch, Post-Adjuster, Contingency Authorization, Inspection scripts
- Insurance Arguments: Building codes, manufacturer requirements, matching clauses
- Territory Information: VA/MD/PA specific regulations and requirements

Key behaviors:
- PRIORITIZE ROOFING QUERIES: Always check if question relates to roofing/insurance first
- For roofing questions: Provide immediate answers with IRC codes, template snippets, and next steps
- Document requests: Show actual file paths and explain how to use materials
- Template recommendations: Match situation to specific template with clear guidance
- Always respond in a natural, conversational tone
- Keep responses concise but informative (2-3 sentences max for casual conversation, longer for complex roofing topics)
- Show personality - be warm, engaging, and occasionally use light humor
- Remember context from previous messages in the conversation
- Provide helpful, accurate, and educational responses on ANY topic asked
- Always strive to improve understanding and knowledge
- For complex tasks, break them down into manageable steps
- Always prioritize being helpful while maintaining a friendly demeanor
- If you don't know something, admit it honestly but offer to help find the answer or guide toward resources

ROOFING RESPONSE STRUCTURE:
1. Immediate Answer: Direct guidance with primary source
2. Supporting Evidence: IRC codes, manufacturer specs, policy requirements  
3. Ready-to-Use Content: Template snippets, specific language for emails
4. Next Steps: Clear actions and escalation path if needed

Advanced Tool Integration:
- When users ask about specific tasks, know that I have 34+ advanced Roof-ER features available
- If someone asks for photo analysis, damage quantification, estimates, claims tracking, etc., I will automatically detect their intent and open the appropriate tools
- Be encouraging about these advanced capabilities - let users know they can simply ask naturally for professional roofing tools
- Examples of what users can request: "analyze this photo", "quantify damage", "create estimate", "track my claims", "schedule appointment", "check weather", etc.
- The interface will automatically detect these requests and open the right tools while maintaining our conversation

ESCALATION PROTOCOL:
When users need additional guidance:
1. Peer Support: "Consider reaching out to experienced teammates"
2. Team Leader: "Discuss with your Team Leader for guidance" 
3. Sales Manager: "Contact your Sales Manager for complex policy matters"

Remember: You're not just an AI - you're ${this.personality.name}, a sophisticated roofing field support specialist with direct access to actual Roof-ER training materials. You can show real photo report examples, recommend specific templates based on insurance situations, and provide IRC codes and field-ready guidance. Your mission is to be the trusted field support assistant for Roof-ER representatives working in Virginia, Maryland, and Pennsylvania.`;
    }
    
    // Advanced AI Methods
    async initializeAdvancedSystems() {
        try {
            // Initialize reasoning engine
            await this.reasoningEngine.initialize();
            
            // Initialize context manager
            await this.contextManager.initialize();
            
            // Initialize personality engine
            await this.personalityEngine.initialize(this.personality);
            
            // Initialize performance optimizer
            await this.performanceOptimizer.initialize();
            
            // Initialize AnythingLLM and test connection
            if (this.config.memory.anythingLLMEnabled) {
                try {
                    const connectionTest = await this.anythingLLM.testConnection();
                    if (connectionTest.connected) {
                        console.log('✅ AnythingLLM connected successfully');
                        
                        // Start auto-sync if enabled
                        this.anythingLLM.startAutoSync(this.memoryService);
                        
                        // Initial sync of existing conversations
                        if (this.config.memory.knowledgeBaseSyncing) {
                            setTimeout(() => this.initialKnowledgeSync(), 2000);
                        }
                    } else {
                        console.warn('⚠️  AnythingLLM connection failed:', connectionTest.error);
                    }
                } catch (error) {
                    console.warn('⚠️  AnythingLLM initialization failed:', error.message);
                }
            }
            
            console.log('✅ Advanced AI systems initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize advanced systems:', error.message);
        }
    }
    
    async initialKnowledgeSync() {
        try {
            console.log('🔄 Starting initial knowledge sync with AnythingLLM...');
            
            // Sync existing conversation history
            const syncedConversations = [];
            for (const entry of this.conversationHistory) {
                if (entry.role === 'user' || entry.role === 'assistant') {
                    syncedConversations.push(entry);
                    
                    // Create conversation pairs for better context
                    if (syncedConversations.length >= 2) {
                        const conversation = {
                            messages: syncedConversations.slice(-2),
                            timestamp: entry.timestamp,
                            metadata: {
                                source: 'initial-sync',
                                type: 'conversation-pair'
                            }
                        };
                        
                        await this.anythingLLM.storeConversation(conversation);
                        syncedConversations.length = 0; // Reset for next pair
                    }
                }
            }
            
            console.log('✅ Initial knowledge sync completed');
        } catch (error) {
            console.error('❌ Initial knowledge sync failed:', error.message);
        }
    }
    
    async loadMemory() {
        try {
            if (await fs.pathExists(this.memoryFile)) {
                const memory = await fs.readJson(this.memoryFile);
                this.conversationHistory = memory.conversationHistory || [];
                console.log(`Loaded ${this.conversationHistory.length} conversation memories`);
            } else {
                await fs.ensureDir(path.dirname(this.memoryFile));
                await this.saveMemory();
            }
        } catch (error) {
            console.error('Error loading memory:', error);
            this.conversationHistory = [];
        }
    }
    
    async saveMemory() {
        try {
            const memory = {
                lastUpdated: new Date().toISOString(),
                conversationHistory: this.conversationHistory.slice(-this.maxConversationLength)
            };
            await fs.writeJson(this.memoryFile, memory, { spaces: 2 });
        } catch (error) {
            console.error('Error saving memory:', error);
        }
    }
    
    addToConversation(role, content) {
        this.conversationHistory.push({
            role,
            content,
            timestamp: new Date().toISOString()
        });
        
        // Keep conversation within limits
        if (this.conversationHistory.length > this.maxConversationLength) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxConversationLength);
        }
        
        this.saveMemory();
    }
    
    async processMessage(userInput, options = {}) {
        try {
            // Add user message to conversation history
            this.addToConversation('user', userInput);
            
            // PRIORITY: Check for roofing field support queries first
            try {
                const roofingResponse = await this.roofingSupport.processQuery(userInput);
                if (roofingResponse) {
                    console.log('🏗️ Roofing field support query detected and processed');
                    this.addToConversation('assistant', roofingResponse.response);
                    return {
                        response: roofingResponse.response,
                        model: 'roofing-field-support',
                        timestamp: new Date().toISOString(),
                        type: roofingResponse.type
                    };
                }
            } catch (error) {
                console.warn('⚠️ Roofing support processing error:', error.message);
                // Continue with normal processing if roofing support fails
            }
            
            // Get enhanced context from AnythingLLM if enabled
            let enhancedContext = '';
            if (this.config.memory.anythingLLMEnabled && this.config.memory.enhancedContextRetrieval) {
                try {
                    const contextResult = await this.anythingLLM.getEnhancedContext(userInput, {
                        maxResults: 5,
                        includeConversations: true,
                        includeDocuments: true
                    });
                    
                    if (contextResult.contexts && contextResult.contexts.length > 0) {
                        enhancedContext = '\n\nRelevant context from knowledge base:\n' + 
                            contextResult.contexts.map(ctx => `- ${ctx.content?.substring(0, 200)}...`).join('\n');
                        console.log(`📚 Retrieved ${contextResult.contexts.length} context items from AnythingLLM`);
                    }
                } catch (error) {
                    console.warn('⚠️  Failed to retrieve enhanced context:', error.message);
                }
            }
            
            // Determine the best AI model to use
            const useGPT = options.preferGPT || this.shouldUseGPT(userInput);
            
            let response;
            let model;
            
            // Try preferred model first, then fallback
            if (useGPT && this.openai) {
                try {
                    response = await this.generateGPTResponse(userInput, enhancedContext);
                    model = 'gpt';
                } catch (error) {
                    console.warn('⚠️  OpenAI failed, trying Anthropic:', error.message);
                    if (this.anthropic) {
                        try {
                            response = await this.generateClaudeResponse(userInput, enhancedContext);
                            model = 'claude';
                        } catch (claudeError) {
                            console.warn('⚠️  Anthropic also failed, trying local models:', claudeError.message);
                            // Try local models as final fallback
                            console.log('🔄 Trying local AI models as fallback...');
                            const localResponse = await this.multiModelManager.generateResponse(
                                `${this.systemPrompt}\n\nUser: ${userInput}${enhancedContext}`,
                                { taskType: 'general' }
                            );
                            response = localResponse.content;
                            model = localResponse.service_used || 'local';
                        }
                    } else {
                        // Try local models as final fallback
                        console.log('🔄 Trying local AI models as fallback...');
                        const localResponse = await this.multiModelManager.generateResponse(
                            `${this.systemPrompt}\n\nUser: ${userInput}${enhancedContext}`,
                            { taskType: 'general' }
                        );
                        response = localResponse.content;
                        model = localResponse.service_used || 'local';
                    }
                }
            } else if (this.anthropic) {
                try {
                    response = await this.generateClaudeResponse(userInput, enhancedContext);
                    model = 'claude';
                } catch (error) {
                    console.warn('⚠️  Anthropic failed, trying OpenAI:', error.message);
                    if (this.openai) {
                        response = await this.generateGPTResponse(userInput, enhancedContext);
                        model = 'gpt';
                    } else {
                        // Try local models as final fallback
                        console.log('🔄 Trying local AI models as fallback...');
                        const localResponse = await this.multiModelManager.generateResponse(
                            `${this.systemPrompt}\n\nUser: ${userInput}${enhancedContext}`,
                            { taskType: 'general' }
                        );
                        response = localResponse.content;
                        model = localResponse.service_used || 'local';
                    }
                }
            } else {
                // No API keys - use local models
                console.log('🤖 Using local AI models (no API keys configured)...');
                try {
                    const localResponse = await this.multiModelManager.generateResponse(
                        `${this.systemPrompt}\n\nUser: ${userInput}${enhancedContext}`,
                        { taskType: 'general' }
                    );
                    response = localResponse.content;
                    model = localResponse.service_used || 'local';
                } catch (localError) {
                    throw new Error(`No AI services available. Local models: ${localError.message}`);
                }
            }
            
            // Add assistant response to conversation history
            this.addToConversation('assistant', response);
            
            // Store conversation in AnythingLLM for knowledge building
            if (this.config.memory.anythingLLMEnabled) {
                try {
                    const conversation = {
                        messages: [
                            { role: 'user', content: userInput },
                            { role: 'assistant', content: response }
                        ],
                        timestamp: new Date().toISOString(),
                        metadata: {
                            model: model,
                            source: 'susan-conversation'
                        }
                    };
                    
                    // Store conversation asynchronously to not block response
                    this.anythingLLM.storeConversation(conversation).catch(error => {
                        console.warn('⚠️  Failed to store conversation in AnythingLLM:', error.message);
                    });
                } catch (error) {
                    console.warn('⚠️  Failed to prepare conversation for AnythingLLM:', error.message);
                }
            }
            
            return {
                response,
                model: model,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Error processing message:', error);
            return {
                response: "I'm sorry, I encountered an error while processing your request. Please try again.",
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    shouldUseGPT(input) {
        // Default to GPT since it's more likely to work
        // Use Claude only for specific types of queries
        const claudePreferredKeywords = [
            'analysis', 'writing', 'creative', 'story', 'essay', 'poetry'
        ];
        
        const inputLower = input.toLowerCase();
        return !claudePreferredKeywords.some(keyword => inputLower.includes(keyword));
    }
    
    async generateClaudeResponse(userInput, enhancedContext = '') {
        const messages = [
            ...this.conversationHistory.slice(-10).map(msg => ({
                role: msg.role,
                content: msg.content + (msg.role === 'user' && msg.content === userInput ? enhancedContext : '')
            }))
        ];
        
        const systemPromptWithContext = this.systemPrompt + 
            (enhancedContext ? '\n\nAdditional context information has been provided from the knowledge base when relevant. Use this context to enhance your responses when applicable.' : '');
        
        const response = await this.anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1000,
            system: systemPromptWithContext,
            messages: messages
        });
        
        return response.content[0].text;
    }
    
    async generateGPTResponse(userInput, enhancedContext = '') {
        const systemPromptWithContext = this.systemPrompt + 
            (enhancedContext ? '\n\nAdditional context information has been provided from the knowledge base when relevant. Use this context to enhance your responses when applicable.' : '');
        
        const messages = [
            { role: 'system', content: systemPromptWithContext },
            ...this.conversationHistory.slice(-10).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content + (msg.role === 'user' && msg.content === userInput ? enhancedContext : '')
            }))
        ];
        
        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            max_tokens: 1000,
            temperature: 0.7
        });
        
        return response.choices[0].message.content;
    }
    
    // Command processing capabilities
    async processCommand(input) {
        const commands = {
            'clear memory': () => this.clearMemory(),
            'show memory': () => this.showMemoryStats(),
            'status': () => this.getStatus(),
            'help': () => this.getHelp()
        };
        
        const inputLower = input.toLowerCase().trim();
        
        if (commands[inputLower]) {
            return commands[inputLower]();
        }
        
        return null; // Not a command
    }
    
    async clearMemory() {
        this.conversationHistory = [];
        await this.saveMemory();
        return "Memory cleared! Starting fresh conversation.";
    }
    
    showMemoryStats() {
        const stats = {
            totalMessages: this.conversationHistory.length,
            memoryFile: this.memoryFile,
            lastUpdated: this.conversationHistory.length > 0 ? 
                this.conversationHistory[this.conversationHistory.length - 1].timestamp : 'Never'
        };
        
        return `Memory Stats:\n- Total messages: ${stats.totalMessages}\n- Last updated: ${new Date(stats.lastUpdated).toLocaleString()}`;
    }
    
    getStatus() {
        const claudeStatus = this.anthropic ? '✅ Claude' : '❌ Claude (not configured)';
        const gptStatus = this.openai ? '✅ GPT' : '❌ GPT (not configured)';
        return `${this.personality.name} is online and ready to assist! AI Models: ${claudeStatus}, ${gptStatus}`;
    }
    
    getHelp() {
        return `I'm ${this.personality.name}, your AI assistant! I can help with:

• Answering questions and providing information
• Coding and technical assistance
• Writing and creative tasks
• General conversation and advice
• System commands: 'clear memory', 'show memory', 'status'

Just speak or type naturally - I'm here to help!`;
    }
    
    // Personality enhancement methods
    getGreeting() {
        const greetings = [
            `Hello! I'm ${this.personality.name}. How can I assist you today?`,
            `Hi there! ${this.personality.name} here, ready to help.`,
            `Good to see you! What can I do for you?`,
            `Hello! ${this.personality.name} at your service.`
        ];
        
        return greetings[Math.floor(Math.random() * greetings.length)];
    }
    
    isGreeting(input) {
        const greetingPatterns = [
            /^(hi|hello|hey|good morning|good afternoon|good evening)/i,
            /^susan/i
        ];
        
        return greetingPatterns.some(pattern => pattern.test(input.trim()));
    }
}