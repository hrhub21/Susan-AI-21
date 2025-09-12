/**
 * Ollama Local LLM Service Integration for Susan AI
 * Connects Susan to locally running Ollama models for offline AI capabilities
 */

import fetch from 'node-fetch';

class OllamaService {
    constructor() {
        this.baseUrl = 'http://localhost:11434';
        this.availableModels = [];
        this.defaultModel = 'qwen2.5:7b';
        this.initialize();
    }

    /**
     * Initialize service and fetch available models
     */
    async initialize() {
        try {
            await this.fetchAvailableModels();
            console.log('🦙 Ollama Service initialized with models:', this.availableModels.map(m => m.name));
        } catch (error) {
            console.warn('⚠️ Ollama not available:', error.message);
        }
    }

    /**
     * Fetch list of available Ollama models
     */
    async fetchAvailableModels() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            if (response.ok) {
                const data = await response.json();
                this.availableModels = data.models || [];
                return this.availableModels;
            }
        } catch (error) {
            throw new Error(`Failed to fetch models: ${error.message}`);
        }
    }

    /**
     * Generate response using Ollama model
     */
    async generateResponse(prompt, options = {}) {
        const model = options.model || this.defaultModel;
        
        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    prompt,
                    stream: false,
                    options: {
                        temperature: options.temperature || 0.7,
                        max_tokens: options.max_tokens || 2000,
                        ...options.modelOptions
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return {
                content: data.response,
                model: model,
                service: 'ollama',
                done: data.done,
                eval_count: data.eval_count,
                eval_duration: data.eval_duration
            };
        } catch (error) {
            throw new Error(`Ollama generation failed: ${error.message}`);
        }
    }

    /**
     * Chat completion with conversation context
     */
    async chatCompletion(messages, options = {}) {
        const model = options.model || this.defaultModel;
        
        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model,
                    messages,
                    stream: false,
                    options: {
                        temperature: options.temperature || 0.7,
                        ...options.modelOptions
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama chat API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return {
                content: data.message.content,
                role: data.message.role,
                model: model,
                service: 'ollama',
                done: data.done
            };
        } catch (error) {
            throw new Error(`Ollama chat failed: ${error.message}`);
        }
    }

    /**
     * Analyze image with vision capable models
     */
    async analyzeImage(imageBase64, prompt, options = {}) {
        const visionModel = 'llava:latest'; // If available
        
        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: visionModel,
                    prompt,
                    images: [imageBase64],
                    stream: false,
                    options: {
                        temperature: options.temperature || 0.3,
                        ...options.modelOptions
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama vision API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return {
                content: data.response,
                model: visionModel,
                service: 'ollama-vision',
                confidence: 0.85 // Estimated
            };
        } catch (error) {
            throw new Error(`Ollama vision analysis failed: ${error.message}`);
        }
    }

    /**
     * Get model info
     */
    async getModelInfo(modelName) {
        try {
            const response = await fetch(`${this.baseUrl}/api/show`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: modelName })
            });

            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.warn(`Failed to get model info for ${modelName}:`, error.message);
        }
        return null;
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            return {
                status: response.ok ? 'healthy' : 'unhealthy',
                models_available: this.availableModels.length,
                service: 'ollama'
            };
        } catch (error) {
            return {
                status: 'offline',
                error: error.message,
                service: 'ollama'
            };
        }
    }
}

export default new OllamaService();