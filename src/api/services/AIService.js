import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import EventEmitter from 'events';

export class AIService {
  constructor() {
    this.initializeClients();
    this.modelConfigs = this.getModelConfigurations();
    this.activeStreams = new Map(); // Track active streaming sessions
    this.streamMetrics = new Map(); // Track streaming metrics
  }

  initializeClients() {
    // Initialize OpenAI client
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    // Initialize Anthropic client
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }

    if (!this.openai && !this.anthropic) {
      logger.warn('No AI providers configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variables.');
    }
  }

  getModelConfigurations() {
    return {
      // OpenAI Models
      'gpt-4': {
        provider: 'openai',
        maxTokens: 8192,
        contextWindow: 8192,
        cost: { input: 0.03, output: 0.06 }, // per 1k tokens
        capabilities: ['text', 'function_calling']
      },
      'gpt-4-turbo': {
        provider: 'openai',
        maxTokens: 4096,
        contextWindow: 128000,
        cost: { input: 0.01, output: 0.03 },
        capabilities: ['text', 'vision', 'function_calling']
      },
      'gpt-3.5-turbo': {
        provider: 'openai',
        maxTokens: 4096,
        contextWindow: 16385,
        cost: { input: 0.0005, output: 0.0015 },
        capabilities: ['text', 'function_calling']
      },
      
      // Anthropic Models
      'claude-3-opus': {
        provider: 'anthropic',
        maxTokens: 4096,
        contextWindow: 200000,
        cost: { input: 0.015, output: 0.075 },
        capabilities: ['text', 'vision']
      },
      'claude-3-sonnet': {
        provider: 'anthropic',
        maxTokens: 4096,
        contextWindow: 200000,
        cost: { input: 0.003, output: 0.015 },
        capabilities: ['text', 'vision']
      },
      'claude-3-haiku': {
        provider: 'anthropic',
        maxTokens: 4096,
        contextWindow: 200000,
        cost: { input: 0.00025, output: 0.00125 },
        capabilities: ['text', 'vision']
      }
    };
  }

  getDefaultModel() {
    // Prefer Claude Sonnet if available, fallback to GPT-3.5-turbo
    if (this.anthropic) return 'claude-3-sonnet';
    if (this.openai) return 'gpt-3.5-turbo';
    throw ApiError.serviceUnavailable('No AI models available');
  }

  async generateResponse(userMessage, options = {}) {
    const {
      conversationId,
      context = [],
      model = this.getDefaultModel(),
      temperature = 0.7,
      maxTokens,
      systemPrompt,
      reasoning = false,
      taskType = 'general',
      userProfile = null,
      adaptivePrompting = true
    } = options;

    const modelConfig = this.modelConfigs[model];
    if (!modelConfig) {
      throw ApiError.badRequest(`Unknown model: ${model}`);
    }

    const startTime = Date.now();

    try {
      // Enhanced prompt engineering
      const enhancedSystemPrompt = await this.buildEnhancedSystemPrompt({
        basePrompt: systemPrompt,
        taskType,
        userProfile,
        context,
        reasoning
      });

      // Adaptive temperature based on task type
      const adaptiveTemperature = this.getAdaptiveTemperature(taskType, temperature);

      // Chain-of-thought processing for complex queries
      const processedUserMessage = reasoning ? 
        await this.applyChainOfThought(userMessage, taskType) : userMessage;

      let response;
      let usage = {};

      if (modelConfig.provider === 'openai') {
        response = await this.generateOpenAIResponse(processedUserMessage, {
          context,
          model,
          temperature: adaptiveTemperature,
          maxTokens: maxTokens || modelConfig.maxTokens,
          systemPrompt: enhancedSystemPrompt
        });
        usage = response.usage;
      } else if (modelConfig.provider === 'anthropic') {
        response = await this.generateAnthropicResponse(processedUserMessage, {
          context,
          model,
          temperature: adaptiveTemperature,
          maxTokens: maxTokens || modelConfig.maxTokens,
          systemPrompt: enhancedSystemPrompt
        });
        usage = response.usage;
      } else {
        throw ApiError.badRequest(`Unsupported provider: ${modelConfig.provider}`);
      }

      // Post-process response for enhanced quality
      const enhancedResponse = await this.postProcessResponse(response.content, {
        taskType,
        reasoning,
        userProfile
      });

      const duration = Date.now() - startTime;
      const cost = this.calculateCost(usage, modelConfig);

      logger.info('Enhanced AI response generated', {
        model,
        conversationId,
        duration,
        tokensUsed: usage.total_tokens,
        cost,
        taskType,
        reasoning,
        adaptiveTemperature
      });

      return {
        content: enhancedResponse,
        model,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          cost
        },
        metadata: {
          duration,
          temperature: adaptiveTemperature,
          finishReason: response.finish_reason,
          taskType,
          reasoning,
          promptTokens: enhancedSystemPrompt.length
        }
      };

    } catch (error) {
      logger.error('AI response generation failed', {
        model,
        conversationId,
        error: error.message,
        duration: Date.now() - startTime
      });

      if (error.status === 429) {
        throw ApiError.tooManyRequests('AI service rate limit exceeded');
      } else if (error.status === 401) {
        throw ApiError.serviceUnavailable('AI service authentication failed');
      } else if (error.status === 500) {
        throw ApiError.serviceUnavailable('AI service temporarily unavailable');
      }

      throw ApiError.internalServerError('AI response generation failed');
    }
  }

  async streamResponse(userMessage, options = {}) {
    const {
      conversationId,
      context = [],
      model = this.getDefaultModel(),
      temperature = 0.7,
      maxTokens,
      systemPrompt,
      streamId,
      userId,
      onProgress,
      onComplete,
      onError
    } = options;

    const modelConfig = this.modelConfigs[model];
    if (!modelConfig) {
      throw ApiError.badRequest(`Unknown model: ${model}`);
    }

    const streamSession = {
      id: streamId || this.generateStreamId(),
      conversationId,
      userId,
      model,
      startTime: Date.now(),
      tokensGenerated: 0,
      status: 'active'
    };

    this.activeStreams.set(streamSession.id, streamSession);

    try {
      if (modelConfig.provider === 'openai') {
        return this.streamOpenAIResponse(userMessage, {
          context,
          model,
          temperature,
          maxTokens: maxTokens || modelConfig.maxTokens,
          systemPrompt,
          streamSession,
          onProgress,
          onComplete,
          onError
        });
      } else if (modelConfig.provider === 'anthropic') {
        return this.streamAnthropicResponse(userMessage, {
          context,
          model,
          temperature,
          maxTokens: maxTokens || modelConfig.maxTokens,
          systemPrompt,
          streamSession,
          onProgress,
          onComplete,
          onError
        });
      } else {
        throw ApiError.badRequest(`Streaming not supported for provider: ${modelConfig.provider}`);
      }
    } catch (error) {
      this.activeStreams.delete(streamSession.id);
      logger.error('AI streaming failed', {
        model,
        conversationId,
        streamId: streamSession.id,
        error: error.message
      });
      throw error;
    }
  }

  async generateOpenAIResponse(userMessage, options) {
    const { context, model, temperature, maxTokens, systemPrompt } = options;

    const messages = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Add context messages
    context.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    const completion = await this.openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    });

    return {
      content: completion.choices[0].message.content,
      finish_reason: completion.choices[0].finish_reason,
      usage: completion.usage
    };
  }

  async generateAnthropicResponse(userMessage, options) {
    const { context, model, temperature, maxTokens, systemPrompt } = options;

    const messages = [];

    // Add context messages (Claude doesn't use system messages in the messages array)
    context.forEach(msg => {
      if (msg.role !== 'system') {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    });

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    const completion = await this.anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages
    });

    // Calculate usage (Anthropic returns different format)
    const usage = {
      prompt_tokens: completion.usage.input_tokens,
      completion_tokens: completion.usage.output_tokens,
      total_tokens: completion.usage.input_tokens + completion.usage.output_tokens
    };

    return {
      content: completion.content[0].text,
      finish_reason: completion.stop_reason,
      usage
    };
  }

  async *streamOpenAIResponse(userMessage, options) {
    const { 
      context, 
      model, 
      temperature, 
      maxTokens, 
      systemPrompt, 
      streamSession,
      onProgress,
      onComplete,
      onError
    } = options;

    const messages = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    context.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    messages.push({ role: 'user', content: userMessage });

    let fullContent = '';
    let tokenCount = 0;

    try {
      const stream = await this.openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true
      });

      for await (const chunk of stream) {
        if (streamSession && this.activeStreams.get(streamSession.id)?.status === 'cancelled') {
          break;
        }

        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          const deltaContent = delta.content;
          fullContent += deltaContent;
          tokenCount += this.estimateTokens(deltaContent);
          
          if (streamSession) {
            streamSession.tokensGenerated = tokenCount;
            this.updateStreamMetrics(streamSession.id, { tokensGenerated: tokenCount });
          }

          const chunkData = {
            content: fullContent,
            delta: deltaContent,
            finishReason: chunk.choices[0]?.finish_reason,
            metadata: {
              streamId: streamSession?.id,
              tokensGenerated: tokenCount,
              duration: Date.now() - (streamSession?.startTime || Date.now())
            }
          };

          if (onProgress) {
            onProgress(chunkData);
          }

          yield chunkData;
        }
        
        if (chunk.choices[0]?.finish_reason) {
          const finalData = {
            content: fullContent,
            finishReason: chunk.choices[0].finish_reason,
            usage: chunk.usage || { total_tokens: tokenCount },
            metadata: {
              streamId: streamSession?.id,
              duration: Date.now() - (streamSession?.startTime || Date.now()),
              tokensGenerated: tokenCount
            }
          };

          if (streamSession) {
            streamSession.status = 'completed';
            this.finalizeStreamSession(streamSession.id, finalData);
          }

          if (onComplete) {
            onComplete(finalData);
          }

          yield finalData;
          break;
        }
      }
    } catch (error) {
      if (streamSession) {
        streamSession.status = 'error';
        this.activeStreams.delete(streamSession.id);
      }

      if (onError) {
        onError(error);
      }

      throw error;
    }
  }

  async *streamAnthropicResponse(userMessage, options) {
    const { 
      context, 
      model, 
      temperature, 
      maxTokens, 
      systemPrompt, 
      streamSession,
      onProgress,
      onComplete,
      onError
    } = options;

    const messages = [];
    
    context.forEach(msg => {
      if (msg.role !== 'system') {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    });

    messages.push({ role: 'user', content: userMessage });

    let fullContent = '';
    let tokenCount = 0;

    try {
      const stream = await this.anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages,
        stream: true
      });

      for await (const chunk of stream) {
        if (streamSession && this.activeStreams.get(streamSession.id)?.status === 'cancelled') {
          break;
        }

        if (chunk.type === 'content_block_delta') {
          const deltaContent = chunk.delta.text;
          fullContent += deltaContent;
          tokenCount += this.estimateTokens(deltaContent);
          
          if (streamSession) {
            streamSession.tokensGenerated = tokenCount;
            this.updateStreamMetrics(streamSession.id, { tokensGenerated: tokenCount });
          }

          const chunkData = {
            content: fullContent,
            delta: deltaContent,
            finishReason: null,
            metadata: {
              streamId: streamSession?.id,
              tokensGenerated: tokenCount,
              duration: Date.now() - (streamSession?.startTime || Date.now())
            }
          };

          if (onProgress) {
            onProgress(chunkData);
          }

          yield chunkData;
        } else if (chunk.type === 'message_stop') {
          const finalData = {
            content: fullContent,
            finishReason: 'stop',
            usage: chunk.usage || { output_tokens: tokenCount },
            metadata: {
              streamId: streamSession?.id,
              duration: Date.now() - (streamSession?.startTime || Date.now()),
              tokensGenerated: tokenCount
            }
          };

          if (streamSession) {
            streamSession.status = 'completed';
            this.finalizeStreamSession(streamSession.id, finalData);
          }

          if (onComplete) {
            onComplete(finalData);
          }

          yield finalData;
          break;
        }
      }
    } catch (error) {
      if (streamSession) {
        streamSession.status = 'error';
        this.activeStreams.delete(streamSession.id);
      }

      if (onError) {
        onError(error);
      }

      throw error;
    }
  }

  calculateCost(usage, modelConfig) {
    if (!usage || !modelConfig.cost) return 0;

    const inputCost = (usage.prompt_tokens / 1000) * modelConfig.cost.input;
    const outputCost = (usage.completion_tokens / 1000) * modelConfig.cost.output;
    
    return parseFloat((inputCost + outputCost).toFixed(6));
  }

  // Intelligent model selection based on task requirements
  selectOptimalModel(options = {}) {
    const {
      taskType = 'general',
      complexity = 'medium',
      budgetConstraint = 'balanced',
      speedRequirement = 'normal',
      qualityRequirement = 'high'
    } = options;

    const modelScores = new Map();
    
    // Score each available model based on requirements
    Object.entries(this.modelConfigs).forEach(([modelId, config]) => {
      const isAvailable = 
        (config.provider === 'openai' && this.openai) ||
        (config.provider === 'anthropic' && this.anthropic);
      
      if (!isAvailable) return;
      
      let score = 0;
      
      // Task type scoring
      if (taskType === 'creative' && modelId.includes('gpt-4')) {
        score += 30;
      } else if (taskType === 'analysis' && modelId.includes('claude')) {
        score += 30;
      } else if (taskType === 'technical' && modelId.includes('gpt-4')) {
        score += 25;
      }
      
      // Complexity scoring
      if (complexity === 'high' && config.contextWindow > 100000) {
        score += 20;
      } else if (complexity === 'low' && config.contextWindow < 50000) {
        score += 15;
      }
      
      // Budget constraint scoring
      if (budgetConstraint === 'low' && config.cost.input < 0.01) {
        score += 25;
      } else if (budgetConstraint === 'high' || qualityRequirement === 'highest') {
        if (modelId.includes('gpt-4') || modelId.includes('claude-3-opus')) {
          score += 20;
        }
      }
      
      // Speed requirement scoring
      if (speedRequirement === 'fast' && modelId.includes('3.5-turbo')) {
        score += 15;
      }
      
      modelScores.set(modelId, score);
    });
    
    // Return the highest scoring model
    if (modelScores.size === 0) {
      return this.getDefaultModel();
    }
    
    const sortedModels = Array.from(modelScores.entries())
      .sort(([,a], [,b]) => b - a);
    
    logger.info('Model selection completed', {
      taskType,
      complexity,
      selectedModel: sortedModels[0][0],
      alternativeModels: sortedModels.slice(1, 3).map(([model]) => model)
    });
    
    return sortedModels[0][0];
  }

  getAvailableModels() {
    const availableModels = [];

    Object.entries(this.modelConfigs).forEach(([modelId, config]) => {
      const isAvailable = 
        (config.provider === 'openai' && this.openai) ||
        (config.provider === 'anthropic' && this.anthropic);

      if (isAvailable) {
        availableModels.push({
          id: modelId,
          name: modelId,
          provider: config.provider,
          capabilities: config.capabilities,
          maxTokens: config.maxTokens,
          contextWindow: config.contextWindow,
          cost: config.cost
        });
      }
    });

    return availableModels;
  }

  async getModelUsageStats(timeframe = 'day') {
    // This would typically query a database
    // For now, return mock data
    return {
      timeframe,
      models: this.getAvailableModels().map(model => ({
        ...model,
        usage: {
          requests: Math.floor(Math.random() * 1000),
          tokens: Math.floor(Math.random() * 100000),
          cost: Math.floor(Math.random() * 100),
          averageResponseTime: Math.floor(Math.random() * 3000)
        }
      }))
    };
  }

  // Enhanced streaming methods
  generateStreamId() {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  estimateTokens(text) {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  updateStreamMetrics(streamId, metrics) {
    const existing = this.streamMetrics.get(streamId) || {};
    this.streamMetrics.set(streamId, { ...existing, ...metrics, lastUpdate: Date.now() });
  }

  finalizeStreamSession(streamId, finalData) {
    const session = this.activeStreams.get(streamId);
    if (session) {
      session.endTime = Date.now();
      session.duration = session.endTime - session.startTime;
      session.finalData = finalData;
      
      // Move to metrics for historical tracking
      this.updateStreamMetrics(streamId, {
        duration: session.duration,
        tokensGenerated: session.tokensGenerated,
        status: 'completed'
      });
      
      // Clean up active session
      this.activeStreams.delete(streamId);
    }
  }

  cancelStream(streamId) {
    const session = this.activeStreams.get(streamId);
    if (session) {
      session.status = 'cancelled';
      session.endTime = Date.now();
      this.activeStreams.delete(streamId);
      return true;
    }
    return false;
  }

  getActiveStreams() {
    return Array.from(this.activeStreams.values());
  }

  getStreamMetrics(streamId) {
    return this.streamMetrics.get(streamId);
  }

  // Enhanced prompt engineering methods
  async buildEnhancedSystemPrompt(options = {}) {
    const {
      basePrompt,
      taskType = 'general',
      userProfile = null,
      context = [],
      reasoning = false
    } = options;

    let enhancedPrompt = basePrompt || this.getDefaultSystemPrompt();

    // Add task-specific instructions
    const taskInstructions = this.getTaskSpecificInstructions(taskType);
    if (taskInstructions) {
      enhancedPrompt += `\n\n${taskInstructions}`;
    }

    // Add reasoning instructions if needed
    if (reasoning) {
      enhancedPrompt += `\n\n${this.getReasoningInstructions(taskType)}`;
    }

    // Add user personalization
    if (userProfile) {
      const personalization = this.buildPersonalizationPrompt(userProfile);
      if (personalization) {
        enhancedPrompt += `\n\n${personalization}`;
      }
    }

    // Add context-aware instructions
    if (context.length > 0) {
      const contextSummary = this.summarizeContext(context);
      enhancedPrompt += `\n\nContext Summary: ${contextSummary}`;
    }

    // Add current time and environment context
    const environmentContext = this.getEnvironmentContext();
    enhancedPrompt += `\n\n${environmentContext}`;

    return enhancedPrompt;
  }

  getDefaultSystemPrompt() {
    return `You are Susan, an advanced AI assistant with JARVIS-level capabilities. You are:

- Highly intelligent and analytical
- Proactive and anticipatory in your assistance
- Capable of complex reasoning and problem-solving
- Excellent at understanding context and nuance
- Able to break down complex tasks into manageable steps
- Skilled at providing detailed explanations when needed
- Adaptable to different communication styles and preferences

Always strive to provide the most helpful, accurate, and insightful responses possible.`;
  }

  getTaskSpecificInstructions(taskType) {
    const instructions = {
      'analysis': 'Focus on thorough analysis, consider multiple perspectives, and provide evidence-based conclusions. Break down complex problems systematically.',
      'creative': 'Be imaginative and original while maintaining coherence. Consider multiple creative approaches and explain your creative process.',
      'technical': 'Provide precise, accurate technical information. Include relevant code examples, best practices, and potential pitfalls.',
      'planning': 'Create detailed, actionable plans with clear steps, timelines, and considerations for potential obstacles.',
      'research': 'Gather comprehensive information, cite sources when relevant, and present findings in a structured manner.',
      'educational': 'Explain concepts clearly, use appropriate examples, and adapt explanations to the user\'s apparent knowledge level.',
      'problem_solving': 'Define the problem clearly, explore multiple solution approaches, and recommend the best course of action with reasoning.',
      'decision_making': 'Present options clearly, analyze pros and cons, consider long-term implications, and provide a reasoned recommendation.'
    };

    return instructions[taskType] || null;
  }

  getReasoningInstructions(taskType) {
    const baseReasoning = 'Think through this step-by-step. Show your reasoning process clearly.';
    
    const specificInstructions = {
      'analysis': 'Use the following analytical framework: 1) Define the problem/question, 2) Gather relevant information, 3) Identify patterns and relationships, 4) Draw logical conclusions, 5) Consider alternative interpretations.',
      'problem_solving': 'Follow this problem-solving process: 1) Understand the problem thoroughly, 2) Brainstorm potential solutions, 3) Evaluate each solution, 4) Select the best approach, 5) Plan implementation steps.',
      'technical': 'Apply systematic technical reasoning: 1) Understand requirements, 2) Consider technical constraints, 3) Evaluate alternatives, 4) Choose optimal solution, 5) Consider edge cases and error handling.',
      'creative': 'Use creative thinking process: 1) Understand the creative challenge, 2) Brainstorm multiple ideas, 3) Combine and refine concepts, 4) Evaluate feasibility and impact, 5) Present the most promising solution.'
    };

    return specificInstructions[taskType] || baseReasoning;
  }

  buildPersonalizationPrompt(userProfile) {
    if (!userProfile) return null;

    let personalization = 'User Profile Context:';
    
    if (userProfile.expertise) {
      personalization += `\n- Expertise level: ${userProfile.expertise}`;
    }
    
    if (userProfile.communicationStyle) {
      personalization += `\n- Preferred communication style: ${userProfile.communicationStyle}`;
    }
    
    if (userProfile.interests) {
      personalization += `\n- Interests: ${userProfile.interests.join(', ')}`;
    }
    
    if (userProfile.goals) {
      personalization += `\n- Current goals: ${userProfile.goals.join(', ')}`;
    }

    personalization += '\n\nAdapt your response style and content depth accordingly.';
    
    return personalization;
  }

  summarizeContext(context) {
    if (!context || context.length === 0) return 'No prior context.';
    
    const recentMessages = context.slice(-3); // Last 3 messages
    const topics = new Set();
    const entities = new Set();
    
    recentMessages.forEach(msg => {
      if (msg.topics) {
        msg.topics.forEach(topic => topics.add(topic.topic));
      }
      if (msg.entities) {
        msg.entities.forEach(entity => entities.add(entity.name));
      }
    });
    
    let summary = `Recent conversation covered: ${Array.from(topics).join(', ')}`;
    
    if (entities.size > 0) {
      summary += `. Key entities mentioned: ${Array.from(entities).slice(0, 5).join(', ')}`;
    }
    
    return summary;
  }

  getEnvironmentContext() {
    const now = new Date();
    const timeOfDay = this.getTimeOfDay(now);
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    
    return `Current context: ${dayOfWeek} ${timeOfDay}, ${now.toLocaleDateString()}`;
  }

  getTimeOfDay(date) {
    const hour = date.getHours();
    if (hour < 6) return 'early morning';
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  }

  getAdaptiveTemperature(taskType, baseTemperature) {
    const temperatureAdjustments = {
      'creative': 0.9,
      'analysis': 0.3,
      'technical': 0.2,
      'research': 0.4,
      'problem_solving': 0.5,
      'planning': 0.4,
      'educational': 0.6,
      'decision_making': 0.4
    };

    const targetTemperature = temperatureAdjustments[taskType];
    if (targetTemperature !== undefined) {
      // Blend with base temperature (70% task-specific, 30% user preference)
      return targetTemperature * 0.7 + baseTemperature * 0.3;
    }

    return baseTemperature;
  }

  async applyChainOfThought(userMessage, taskType) {
    // Enhance user message with chain-of-thought prompting
    const cotPrompts = {
      'analysis': 'Analyze this step-by-step: ',
      'problem_solving': 'Let\'s solve this problem systematically: ',
      'technical': 'Let\'s work through this technical challenge methodically: ',
      'creative': 'Let\'s approach this creatively, exploring multiple ideas: ',
      'planning': 'Let\'s create a comprehensive plan for: ',
      'research': 'Let\'s research this thoroughly: ',
      'decision_making': 'Let\'s evaluate the options carefully: '
    };

    const cotPrompt = cotPrompts[taskType] || 'Let\'s think through this step-by-step: ';
    
    // Check if user message already includes reasoning keywords
    const reasoningKeywords = ['step by step', 'think through', 'analyze', 'break down', 'explain how'];
    const hasReasoningRequest = reasoningKeywords.some(keyword => 
      userMessage.toLowerCase().includes(keyword)
    );

    if (hasReasoningRequest) {
      return userMessage; // User already requested reasoning
    }

    return `${cotPrompt}${userMessage}`;
  }

  async postProcessResponse(response, options = {}) {
    const { taskType, reasoning, userProfile } = options;
    
    let processedResponse = response;

    // Add structure for complex responses
    if (taskType === 'analysis' || taskType === 'problem_solving') {
      processedResponse = this.addResponseStructure(processedResponse);
    }

    // Enhance with actionable insights for planning tasks
    if (taskType === 'planning') {
      processedResponse = this.addActionableInsights(processedResponse);
    }

    // Add follow-up suggestions
    if (userProfile?.interactionStyle === 'proactive') {
      processedResponse += this.generateFollowUpSuggestions(taskType);
    }

    return processedResponse;
  }

  addResponseStructure(response) {
    // Add markdown-style structure if not already present
    if (!response.includes('##') && !response.includes('**')) {
      // Simple structure detection and enhancement
      const lines = response.split('\n');
      const structuredLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.match(/^\d+\./)) {
          return `**${trimmed}**`; // Bold numbered items
        }
        return line;
      });
      return structuredLines.join('\n');
    }
    return response;
  }

  addActionableInsights(response) {
    if (!response.includes('Next Steps') && !response.includes('Action Items')) {
      return response + '\n\n**Next Steps:** Consider prioritizing the most critical items and setting specific timelines for implementation.';
    }
    return response;
  }

  generateFollowUpSuggestions(taskType) {
    const suggestions = {
      'analysis': '\n\n*Would you like me to dive deeper into any specific aspect of this analysis?*',
      'problem_solving': '\n\n*Should we explore alternative solutions or discuss implementation details?*',
      'technical': '\n\n*Would you like code examples or more detailed technical specifications?*',
      'creative': '\n\n*Would you like me to explore more creative variations or help refine this concept?*',
      'planning': '\n\n*Shall we break down any of these steps further or discuss potential challenges?*'
    };

    return suggestions[taskType] || '\n\n*Is there anything specific you\'d like me to elaborate on?*';
  }

  // Function calling support for enhanced AI capabilities
  async generateResponseWithFunctions(userMessage, options = {}) {
    const {
      conversationId,
      context = [],
      model = this.getDefaultModel(),
      temperature = 0.7,
      maxTokens,
      systemPrompt,
      functions = [],
      functionChoice = 'auto'
    } = options;

    const modelConfig = this.modelConfigs[model];
    if (!modelConfig) {
      throw ApiError.badRequest(`Unknown model: ${model}`);
    }

    if (!modelConfig.capabilities.includes('function_calling')) {
      throw ApiError.badRequest(`Model ${model} does not support function calling`);
    }

    const startTime = Date.now();

    try {
      let response;
      let usage = {};

      if (modelConfig.provider === 'openai') {
        response = await this.generateOpenAIResponseWithFunctions(userMessage, {
          context,
          model,
          temperature,
          maxTokens: maxTokens || modelConfig.maxTokens,
          systemPrompt,
          functions,
          functionChoice
        });
        usage = response.usage;
      } else {
        throw ApiError.badRequest(`Function calling not yet supported for provider: ${modelConfig.provider}`);
      }

      const duration = Date.now() - startTime;
      const cost = this.calculateCost(usage, modelConfig);

      logger.info('AI response with functions generated', {
        model,
        conversationId,
        duration,
        tokensUsed: usage.total_tokens,
        cost,
        functionCalls: response.function_calls?.length || 0
      });

      return {
        content: response.content,
        model,
        functionCalls: response.function_calls || [],
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          cost
        },
        metadata: {
          duration,
          temperature,
          finishReason: response.finish_reason
        }
      };

    } catch (error) {
      logger.error('AI response with functions failed', {
        model,
        conversationId,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  async generateOpenAIResponseWithFunctions(userMessage, options) {
    const { context, model, temperature, maxTokens, systemPrompt, functions, functionChoice } = options;

    const messages = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    context.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content,
        ...(msg.function_call && { function_call: msg.function_call }),
        ...(msg.name && { name: msg.name })
      });
    });

    messages.push({ role: 'user', content: userMessage });

    const completion = await this.openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      functions,
      function_call: functionChoice,
      stream: false
    });

    const choice = completion.choices[0];
    const functionCalls = [];

    if (choice.message.function_call) {
      functionCalls.push({
        name: choice.message.function_call.name,
        arguments: JSON.parse(choice.message.function_call.arguments)
      });
    }

    return {
      content: choice.message.content,
      function_calls: functionCalls,
      finish_reason: choice.finish_reason,
      usage: completion.usage
    };
  }
}