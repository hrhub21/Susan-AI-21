/**
 * LM Studio Local Model Service Integration for Susan AI
 * Connects Susan to LM Studio served models for high-performance local AI
 */

import fetch from 'node-fetch';

class LMStudioService {
    constructor() {
        this.baseUrl = 'http://localhost:1234/v1';
        this.isAvailable = false;
        this.currentModel = null;
        this.initialize();
    }

    /**
     * Initialize LM Studio service
     */
    async initialize() {
        try {
            const health = await this.healthCheck();
            this.isAvailable = health.status === 'healthy';
            console.log('🎛️ LM Studio Service initialized:', this.isAvailable ? 'Available' : 'Not running');
        } catch (error) {
            console.warn('⚠️ LM Studio not available:', error.message);
        }
    }

    /**
     * Get available models from LM Studio
     */
    async getModels() {
        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: { 'Accept': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                return data.data || [];
            }
        } catch (error) {
            throw new Error(`Failed to fetch LM Studio models: ${error.message}`);
        }
        return [];
    }

    /**
     * Generate chat completion using LM Studio
     */
    async chatCompletion(messages, options = {}) {
        try {
            const models = await this.getModels();
            const model = options.model || (models[0]?.id) || 'local-model';

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    temperature: options.temperature || 0.7,
                    max_tokens: options.max_tokens || 2000,
                    stream: false,
                    ...options
                })
            });

            if (!response.ok) {
                throw new Error(`LM Studio API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const choice = data.choices?.[0];
            
            return {
                content: choice?.message?.content || 'No response generated',
                model: model,
                service: 'lmstudio',
                usage: data.usage,
                finish_reason: choice?.finish_reason
            };
        } catch (error) {
            throw new Error(`LM Studio chat completion failed: ${error.message}`);
        }
    }

    /**
     * Generate single completion
     */
    async generateCompletion(prompt, options = {}) {
        const messages = [
            { role: 'user', content: prompt }
        ];
        
        return this.chatCompletion(messages, options);
    }

    /**
     * Analyze text with specific focus (roofing, insurance, etc.)
     */
    async analyzeText(text, analysisType = 'general', options = {}) {
        const analysisPrompts = {
            roofing: `Analyze this roofing-related text and provide professional insights:\n\n${text}\n\nProvide analysis on: damage assessment, repair recommendations, materials needed, and estimated costs.`,
            insurance: `Review this insurance-related content as a professional adjuster:\n\n${text}\n\nAnalyze: coverage applicability, claim validity, documentation requirements, and next steps.`,
            general: `Provide a comprehensive analysis of the following:\n\n${text}`
        };

        const prompt = analysisPrompts[analysisType] || analysisPrompts.general;
        return this.generateCompletion(prompt, options);
    }

    /**
     * Generate professional templates
     */
    async generateTemplate(templateType, context = {}, options = {}) {
        const templatePrompts = {
            claim_letter: `Generate a professional insurance claim letter with the following details:\n${JSON.stringify(context, null, 2)}\n\nMake it formal, detailed, and persuasive.`,
            estimate: `Create a detailed roofing estimate based on:\n${JSON.stringify(context, null, 2)}\n\nInclude materials, labor, timeline, and total cost.`,
            report: `Generate a comprehensive damage assessment report:\n${JSON.stringify(context, null, 2)}\n\nInclude findings, recommendations, and supporting evidence.`
        };

        const prompt = templatePrompts[templateType] || `Generate a ${templateType} document with: ${JSON.stringify(context)}`;
        return this.generateCompletion(prompt, { ...options, temperature: 0.3 });
    }

    /**
     * Health check for LM Studio service
     */
    async healthCheck() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(`${this.baseUrl}/models`, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const models = await response.json();
                return {
                    status: 'healthy',
                    models_available: models.data?.length || 0,
                    service: 'lmstudio'
                };
            } else {
                return {
                    status: 'unhealthy',
                    error: `HTTP ${response.status}`,
                    service: 'lmstudio'
                };
            }
        } catch (error) {
            return {
                status: 'offline',
                error: error.message,
                service: 'lmstudio'
            };
        }
    }

    /**
     * Get service status and capabilities
     */
    async getStatus() {
        try {
            const health = await this.healthCheck();
            const models = health.status === 'healthy' ? await this.getModels() : [];

            return {
                ...health,
                available_models: models.map(m => ({
                    id: m.id,
                    name: m.id,
                    size: m.size || 'unknown'
                })),
                capabilities: [
                    'text_generation',
                    'chat_completion', 
                    'template_generation',
                    'text_analysis'
                ]
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                service: 'lmstudio'
            };
        }
    }
}

export default new LMStudioService();