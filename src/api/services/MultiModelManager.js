/**
 * Multi-Model Manager for Susan AI
 * Orchestrates multiple AI services with intelligent fallback and load balancing
 */

import OllamaService from './OllamaService.js';
import LMStudioService from './LMStudioService.js';

class MultiModelManager {
    constructor() {
        this.services = new Map();
        this.serviceHealth = new Map();
        this.loadBalancingEnabled = true;
        this.fallbackChain = ['ollama', 'lmstudio', 'anthropic'];
        this.initialize();
    }

    /**
     * Initialize all AI services
     */
    async initialize() {
        console.log('🧠 Initializing Multi-Model Manager...');

        // Register services
        this.services.set('ollama', OllamaService);
        this.services.set('lmstudio', LMStudioService);

        // Check health of all services
        await this.checkAllServices();

        console.log('✅ Multi-Model Manager initialized with services:', Array.from(this.services.keys()));
    }

    /**
     * Check health of all registered services
     */
    async checkAllServices() {
        const healthChecks = [];

        for (const [name, service] of this.services) {
            healthChecks.push(
                service.healthCheck()
                    .then(health => ({ name, health }))
                    .catch(error => ({ 
                        name, 
                        health: { status: 'error', error: error.message, service: name } 
                    }))
            );
        }

        const results = await Promise.allSettled(healthChecks);
        
        for (const result of results) {
            if (result.status === 'fulfilled') {
                const { name, health } = result.value;
                this.serviceHealth.set(name, health);
                console.log(`${health.status === 'healthy' ? '✅' : '❌'} ${name}: ${health.status}`);
            }
        }
    }

    /**
     * Get the best available service for a task
     */
    getBestService(taskType = 'general') {
        // Service preferences by task type
        const taskPreferences = {
            'vision': ['ollama', 'lmstudio'],
            'coding': ['ollama', 'lmstudio'], // DeepSeek models
            'analysis': ['lmstudio', 'ollama'],
            'chat': ['ollama', 'lmstudio'],
            'general': ['ollama', 'lmstudio']
        };

        const preferences = taskPreferences[taskType] || taskPreferences.general;

        for (const serviceName of preferences) {
            const health = this.serviceHealth.get(serviceName);
            if (health && health.status === 'healthy') {
                return {
                    name: serviceName,
                    service: this.services.get(serviceName),
                    health
                };
            }
        }

        return null;
    }

    /**
     * Generate response with intelligent service selection and fallback
     */
    async generateResponse(prompt, options = {}) {
        // Intelligently classify the query type if not provided
        const taskType = options.taskType || this.classifyQueryType(prompt);
        console.log(`🧠 Intelligent routing: Task type "${taskType}" detected for query`);
        let lastError = null;

        // Try services in order of preference
        for (const serviceName of this.fallbackChain) {
            if (!this.services.has(serviceName)) continue;

            const health = this.serviceHealth.get(serviceName);
            if (!health || health.status !== 'healthy') continue;

            try {
                const service = this.services.get(serviceName);
                console.log(`🤖 Using ${serviceName} for ${taskType} task`);

                let response;
                if (serviceName === 'ollama') {
                    response = await service.generateResponse(prompt, {
                        model: this.selectModelForTask(taskType, 'ollama'),
                        ...options
                    });
                } else if (serviceName === 'lmstudio') {
                    response = await service.generateCompletion(prompt, options);
                }

                if (response && response.content) {
                    return {
                        ...response,
                        service_used: serviceName,
                        fallback_attempted: lastError ? true : false
                    };
                }
            } catch (error) {
                console.warn(`❌ ${serviceName} failed:`, error.message);
                lastError = error;
                // Update health status
                this.serviceHealth.set(serviceName, {
                    ...this.serviceHealth.get(serviceName),
                    status: 'unhealthy',
                    last_error: error.message
                });
                continue;
            }
        }

        throw new Error(`All AI services failed. Last error: ${lastError?.message}`);
    }

    /**
     * Chat completion with context awareness
     */
    async chatCompletion(messages, options = {}) {
        // Extract last message for query classification
        const lastMessage = messages[messages.length - 1];
        const userQuery = lastMessage?.content || '';
        const taskType = options.taskType || this.classifyQueryType(userQuery);
        console.log(`🧠 Chat routing: Task type "${taskType}" detected`);
        let lastError = null;

        for (const serviceName of this.fallbackChain) {
            if (!this.services.has(serviceName)) continue;

            const health = this.serviceHealth.get(serviceName);
            if (!health || health.status !== 'healthy') continue;

            try {
                const service = this.services.get(serviceName);
                console.log(`💬 Using ${serviceName} for chat completion`);

                let response;
                if (serviceName === 'ollama') {
                    response = await service.chatCompletion(messages, {
                        model: this.selectModelForTask(taskType, 'ollama'),
                        ...options
                    });
                } else if (serviceName === 'lmstudio') {
                    response = await service.chatCompletion(messages, options);
                }

                if (response && response.content) {
                    return {
                        ...response,
                        service_used: serviceName
                    };
                }
            } catch (error) {
                console.warn(`❌ ${serviceName} chat failed:`, error.message);
                lastError = error;
                continue;
            }
        }

        throw new Error(`All chat services failed. Last error: ${lastError?.message}`);
    }

    /**
     * Select appropriate model for task type
     */
    /**
     * Intelligently classify query type based on content
     */
    classifyQueryType(query) {
        const queryLower = query.toLowerCase();
        
        // Coding and technical tasks
        if (queryLower.includes('code') || queryLower.includes('script') || queryLower.includes('function') || 
            queryLower.includes('debug') || queryLower.includes('programming') || queryLower.includes('javascript') ||
            queryLower.includes('python') || queryLower.includes('api') || queryLower.includes('error') || 
            queryLower.includes('bug')) {
            return 'coding';
        }
        
        // Roofing-specific analysis
        if (queryLower.includes('roof') || queryLower.includes('damage') || queryLower.includes('hail') ||
            queryLower.includes('shingle') || queryLower.includes('insurance') || queryLower.includes('claim') ||
            queryLower.includes('inspection') || queryLower.includes('building code') || queryLower.includes('irc')) {
            return 'roofing-analysis';
        }
        
        // Complex reasoning tasks
        if (queryLower.includes('analyze') || queryLower.includes('compare') || queryLower.includes('calculate') ||
            queryLower.includes('assess') || queryLower.includes('evaluate') || queryLower.includes('determine') ||
            queryLower.includes('explain why') || queryLower.includes('complex')) {
            return 'complex-reasoning';
        }
        
        // Creative writing and templates
        if (queryLower.includes('write') || queryLower.includes('compose') || queryLower.includes('draft') ||
            queryLower.includes('template') || queryLower.includes('email') || queryLower.includes('letter') ||
            queryLower.includes('report') || queryLower.includes('document')) {
            return 'template-generation';
        }
        
        // Simple questions and basic help
        if (queryLower.includes('what is') || queryLower.includes('how to') || queryLower.includes('help') ||
            queryLower.includes('basic') || queryLower.includes('simple') || query.length < 50) {
            return 'simple-questions';
        }
        
        // Customer service related
        if (queryLower.includes('customer') || queryLower.includes('client') || queryLower.includes('homeowner') ||
            queryLower.includes('service') || queryLower.includes('support') || queryLower.includes('complaint')) {
            return 'customer-service';
        }
        
        // Default to general reasoning for complex queries
        return 'reasoning';
    }

    selectModelForTask(taskType, serviceName) {
        const modelPreferences = {
            ollama: {
                coding: 'deepseek-coder-v2:latest',
                'code-analysis': 'deepseek-coder-v2:latest',
                'technical-documentation': 'deepseek-coder-v2:latest',
                reasoning: 'qwen2.5:7b',
                analysis: 'qwen2.5:7b',
                'roofing-analysis': 'qwen2.5:7b',
                'damage-assessment': 'qwen2.5:7b',
                'complex-reasoning': 'qwen2.5:7b',
                chat: 'llama3.1:latest',
                'casual-conversation': 'llama3.1:latest',
                'customer-service': 'llama3.1:latest',
                'simple-questions': 'llama3.2:3b',
                'quick-answers': 'llama3.2:3b',
                'basic-help': 'llama3.2:3b',
                'creative-writing': 'gemma3:4b',
                'template-generation': 'gemma3:4b',
                'email-composition': 'gemma3:4b',
                general: 'qwen2.5:7b'
            },
            lmstudio: {
                coding: 'DeepSeek-R1-0528-Qwen3-8B-MLX-8bit',
                analysis: 'gpt-oss-20b-mlx-8bit',
                chat: 'gpt-oss-20b-mlx-8bit',
                general: 'gpt-oss-20b-mlx-8bit'
            }
        };

        return modelPreferences[serviceName]?.[taskType] || modelPreferences[serviceName]?.general;
    }

    /**
     * Analyze image using available vision models
     */
    async analyzeImage(imageBase64, prompt, options = {}) {
        try {
            // Try Ollama with vision models first
            const ollamaHealth = this.serviceHealth.get('ollama');
            if (ollamaHealth && ollamaHealth.status === 'healthy') {
                const ollama = this.services.get('ollama');
                return await ollama.analyzeImage(imageBase64, prompt, options);
            }
        } catch (error) {
            console.warn('❌ Vision analysis failed:', error.message);
        }

        throw new Error('No vision models available');
    }

    /**
     * Generate professional templates
     */
    async generateTemplate(templateType, context, options = {}) {
        try {
            // Use LM Studio for template generation (better for structured output)
            const lmStudioHealth = this.serviceHealth.get('lmstudio');
            if (lmStudioHealth && lmStudioHealth.status === 'healthy') {
                const lmStudio = this.services.get('lmstudio');
                return await lmStudio.generateTemplate(templateType, context, options);
            }

            // Fallback to Ollama
            const ollamaHealth = this.serviceHealth.get('ollama');
            if (ollamaHealth && ollamaHealth.status === 'healthy') {
                const ollama = this.services.get('ollama');
                const prompt = this.createTemplatePrompt(templateType, context);
                return await ollama.generateResponse(prompt, {
                    model: 'qwen2.5:7b',
                    temperature: 0.3,
                    ...options
                });
            }
        } catch (error) {
            console.warn('❌ Template generation failed:', error.message);
        }

        throw new Error('Template generation unavailable');
    }

    /**
     * Create template prompt
     */
    createTemplatePrompt(templateType, context) {
        const prompts = {
            claim_letter: `Generate a professional insurance claim letter with these details: ${JSON.stringify(context)}`,
            estimate: `Create a detailed roofing estimate based on: ${JSON.stringify(context)}`,
            report: `Generate a comprehensive damage assessment report: ${JSON.stringify(context)}`
        };

        return prompts[templateType] || `Generate a ${templateType} document with: ${JSON.stringify(context)}`;
    }

    /**
     * Get overall system status
     */
    async getSystemStatus() {
        await this.checkAllServices();

        return {
            services: Object.fromEntries(this.serviceHealth),
            healthy_services: Array.from(this.serviceHealth.entries())
                .filter(([name, health]) => health.status === 'healthy')
                .map(([name]) => name),
            capabilities: {
                text_generation: true,
                chat_completion: true,
                image_analysis: this.serviceHealth.get('ollama')?.status === 'healthy',
                template_generation: true,
                coding_assistance: true
            },
            load_balancing: this.loadBalancingEnabled
        };
    }
}

export default new MultiModelManager();