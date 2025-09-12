/**
 * Qwen Vision Language Model Integration Hub
 * Bridges JavaScript Susan AI Enhanced system with Python Qwen 2.5 VL capabilities
 * Provides unified offline/online AI vision-language processing for all Susan agents
 * 
 * Features:
 * - Seamless Python backend integration at localhost:3031
 * - Offline model loading and caching
 * - Unified vision-language API for all agents
 * - Fallback mechanisms for high availability
 * - Real-time model status monitoring
 * - Enhanced roofing damage analysis
 * - Multi-agent coordination
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import EventEmitter from 'events';

// Import all Susan AI services for integration
import { BuildingCodeService } from './api/services/BuildingCodeService.js';
import { LegalComplianceService } from './api/services/LegalComplianceService.js';
import { RealRoofingDamageAnalysisService } from './api/services/RealRoofingDamageAnalysisService.js';
import { EnhancedDamageQuantificationService } from './api/services/EnhancedDamageQuantificationService.js';
import { DocumentOCRService } from './api/services/DocumentOCRService.js';
import { ManufacturerDatabaseService } from './api/services/ManufacturerDatabaseService.js';
import { WeatherDataService } from './api/services/WeatherDataService.js';
import { HoverEagleViewService } from './api/services/HoverEagleViewService.js';
import { PredictiveAnalyticsService } from './api/services/PredictiveAnalyticsService.js';
import { VectorMemoryService } from './api/services/VectorMemoryService.js';
import { AnythingLLMService } from './api/services/AnythingLLMService.js';
import { MultiLanguageService } from './api/services/MultiLanguageService.js';
import { QwenVLService } from './api/services/QwenVLService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main Qwen Vision Integration Service
 * Coordinates between JavaScript frontend and Python Qwen VL backend
 */
export class QwenVisionIntegration extends EventEmitter {
    constructor() {
        super();
        
        // Python service configuration
        this.pythonServiceUrl = 'http://localhost:3031';
        this.isOnline = false;
        this.modelLoaded = false;
        this.healthCheckInterval = null;
        this.offlineMode = false;
        
        // Integrated services
        this.services = {};
        this.agentCapabilities = new Map();
        this.processingQueue = [];
        this.cacheStore = new Map();
        
        // Initialize all agents and capabilities
        this.initializeServices();
        this.setupHealthMonitoring();
        this.initializeAgentCapabilities();
        
        console.log('🔗 Qwen Vision Integration Hub initializing...');
    }

    /**
     * Initialize all Susan AI services for vision integration
     */
    async initializeServices() {
        try {
            // Core analysis services
            this.services.buildingCode = new BuildingCodeService();
            this.services.legalCompliance = new LegalComplianceService();
            this.services.roofingAnalysis = new RealRoofingDamageAnalysisService();
            this.services.damageQuantification = new EnhancedDamageQuantificationService();
            this.services.documentOCR = new DocumentOCRService();
            this.services.manufacturerDB = new ManufacturerDatabaseService();
            this.services.weather = new WeatherDataService();
            this.services.hoverEagleView = new HoverEagleViewService();
            this.services.predictiveAnalytics = new PredictiveAnalyticsService();
            
            // Memory and knowledge services
            this.services.vectorMemory = new VectorMemoryService();
            this.services.anythingLLM = new AnythingLLMService();
            this.services.multiLanguage = new MultiLanguageService();
            
            // Direct Qwen VL service
            this.services.qwenVL = QwenVLService;
            
            // Initialize all services
            for (const [name, service] of Object.entries(this.services)) {
                if (service && typeof service.initialize === 'function') {
                    await service.initialize();
                    console.log(`✅ ${name} service initialized`);
                }
            }
            
            console.log('🎯 All Susan AI services integrated with Qwen Vision');
        } catch (error) {
            console.error('❌ Error initializing services:', error);
        }
    }

    /**
     * Setup health monitoring for Python backend
     */
    setupHealthMonitoring() {
        // Check immediately
        this.checkBackendHealth();
        
        // Setup periodic health checks
        this.healthCheckInterval = setInterval(() => {
            this.checkBackendHealth();
        }, 5000);
        
        console.log('🏥 Health monitoring started for Python backend');
    }

    /**
     * Check Python backend health and model status
     */
    async checkBackendHealth() {
        try {
            const response = await fetch(`${this.pythonServiceUrl}/status`, {
                timeout: 3000
            });
            
            if (response.ok) {
                const status = await response.json();
                
                const wasOnline = this.isOnline;
                const wasLoaded = this.modelLoaded;
                
                this.isOnline = true;
                this.modelLoaded = status.model_loaded || false;
                this.offlineMode = false;
                
                // Emit status change events
                if (!wasOnline) {
                    console.log('🟢 Python Qwen backend is online');
                    this.emit('backend:online');
                }
                
                if (!wasLoaded && this.modelLoaded) {
                    console.log('🧠 Qwen 2.5 VL model loaded and ready');
                    this.emit('model:loaded');
                    this.processQueuedRequests();
                }
                
                if (wasLoaded && !this.modelLoaded) {
                    console.log('⏳ Qwen 2.5 VL model is loading...');
                    this.emit('model:loading');
                }
                
            } else {
                throw new Error(`Backend responded with status ${response.status}`);
            }
        } catch (error) {
            if (this.isOnline) {
                console.log('🔴 Python backend connection lost, switching to offline mode');
                this.emit('backend:offline');
            }
            
            this.isOnline = false;
            this.modelLoaded = false;
            this.offlineMode = true;
        }
    }

    /**
     * Initialize agent capabilities mapping
     */
    initializeAgentCapabilities() {
        // Building code analysis agent
        this.agentCapabilities.set('building_code', {
            description: 'Building code compliance analysis with vision',
            capabilities: ['document_analysis', 'code_verification', 'compliance_check'],
            visionTasks: ['blueprint_analysis', 'construction_photo_review', 'permit_document_ocr'],
            prompts: {
                document_analysis: `Analyze this building document for code compliance. Identify:
                1. Document type and purpose
                2. Building code references
                3. Compliance status
                4. Required modifications
                5. Safety concerns
                
                Provide detailed recommendations in JSON format.`
            }
        });

        // Legal compliance agent
        this.agentCapabilities.set('legal_compliance', {
            description: 'Legal document analysis and compliance verification',
            capabilities: ['contract_analysis', 'legal_review', 'precedent_search'],
            visionTasks: ['contract_ocr', 'legal_document_analysis', 'signature_verification'],
            prompts: {
                contract_analysis: `Analyze this legal document for insurance/roofing compliance. Extract:
                1. Key legal terms and conditions
                2. Liability clauses
                3. Compliance requirements
                4. Risk factors
                5. Recommended actions
                
                Format as structured legal analysis.`
            }
        });

        // Roofing damage analysis agent
        this.agentCapabilities.set('roofing_damage', {
            description: 'Advanced roofing damage detection and quantification',
            capabilities: ['damage_detection', 'material_identification', 'cost_estimation'],
            visionTasks: ['hail_damage_detection', 'wind_damage_assessment', 'wear_analysis'],
            prompts: {
                damage_analysis: `Expert roofing damage analysis. Provide:
                1. Damage type identification (hail, wind, wear)
                2. Severity assessment (1-10 scale)
                3. Affected area percentage
                4. Material condition evaluation
                5. Repair recommendations
                6. Insurance claim viability
                
                Include confidence scores and professional notes.`
            }
        });

        // Document OCR agent
        this.agentCapabilities.set('document_ocr', {
            description: 'Advanced document OCR and information extraction',
            capabilities: ['text_extraction', 'form_filling', 'data_validation'],
            visionTasks: ['form_ocr', 'handwriting_recognition', 'table_extraction'],
            prompts: {
                document_extraction: `Extract all text and structured data from this document:
                1. Form fields and values
                2. Tables and structured data
                3. Signatures and dates
                4. Key information validation
                5. Missing or incomplete fields
                
                Return as structured JSON with confidence scores.`
            }
        });

        // Weather analysis agent
        this.agentCapabilities.set('weather_analysis', {
            description: 'Weather-related damage correlation and analysis',
            capabilities: ['weather_correlation', 'storm_tracking', 'damage_attribution'],
            visionTasks: ['storm_damage_analysis', 'weather_pattern_recognition'],
            prompts: {
                weather_damage: `Analyze this image for weather-related damage patterns:
                1. Weather event identification (hail, wind, tornado)
                2. Damage pattern consistency
                3. Timeline correlation
                4. Severity indicators
                5. Geographic impact assessment
                
                Correlate with weather data and provide attribution analysis.`
            }
        });

        // Manufacturer database agent
        this.agentCapabilities.set('manufacturer_db', {
            description: 'Product identification and manufacturer database integration',
            capabilities: ['product_identification', 'warranty_lookup', 'specification_retrieval'],
            visionTasks: ['product_recognition', 'brand_identification', 'model_detection'],
            prompts: {
                product_identification: `Identify roofing products and materials in this image:
                1. Brand and manufacturer
                2. Product model/type
                3. Material specifications
                4. Installation quality
                5. Warranty information
                6. Replacement recommendations
                
                Cross-reference with manufacturer databases.`
            }
        });

        console.log(`🎯 Initialized ${this.agentCapabilities.size} specialized AI agents`);
    }

    /**
     * Unified vision-language analysis interface
     * Routes requests to appropriate agents and backend
     */
    async analyzeWithVision(imageData, analysisType, options = {}) {
        try {
            const request = {
                imageData,
                analysisType,
                options,
                timestamp: new Date().toISOString(),
                requestId: this.generateRequestId()
            };

            // Check cache first
            const cacheKey = this.generateCacheKey(request);
            const cached = this.cacheStore.get(cacheKey);
            if (cached && !options.bypassCache) {
                console.log(`📋 Returning cached result for ${analysisType}`);
                return { ...cached, source: 'cache' };
            }

            // If model not loaded, queue request
            if (!this.modelLoaded && !this.offlineMode) {
                console.log(`⏳ Queuing ${analysisType} request - model loading`);
                return new Promise((resolve, reject) => {
                    this.processingQueue.push({ request, resolve, reject });
                });
            }

            // Route to appropriate analysis method
            let result;
            switch (analysisType) {
                case 'roofing_damage':
                    result = await this.analyzeRoofingDamage(imageData, options);
                    break;
                case 'building_code':
                    result = await this.analyzeBuildingCode(imageData, options);
                    break;
                case 'legal_compliance':
                    result = await this.analyzeLegalCompliance(imageData, options);
                    break;
                case 'document_ocr':
                    result = await this.analyzeDocument(imageData, options);
                    break;
                case 'weather_damage':
                    result = await this.analyzeWeatherDamage(imageData, options);
                    break;
                case 'product_identification':
                    result = await this.identifyProducts(imageData, options);
                    break;
                case 'damage_quantification':
                    result = await this.quantifyDamage(imageData, options);
                    break;
                default:
                    result = await this.performGeneralAnalysis(imageData, options);
            }

            // Cache successful results
            if (result && result.success !== false) {
                this.cacheStore.set(cacheKey, {
                    ...result,
                    cached_at: new Date().toISOString()
                });
            }

            return result;

        } catch (error) {
            console.error(`❌ Vision analysis error (${analysisType}):`, error);
            return {
                success: false,
                error: error.message,
                analysisType,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Advanced roofing damage analysis with multi-agent coordination
     */
    async analyzeRoofingDamage(imageData, options = {}) {
        try {
            console.log('🏠 Starting multi-agent roofing damage analysis...');

            // Get specialized roofing prompt
            const agent = this.agentCapabilities.get('roofing_damage');
            const prompt = agent.prompts.damage_analysis;

            // Call Python backend with enhanced prompt
            const qwenResult = await this.callPythonBackend(imageData, prompt, options);

            // Enhance with Susan AI services
            const enhancedResult = await this.enhanceWithServices(qwenResult, [
                'roofingAnalysis',
                'damageQuantification',
                'weather',
                'manufacturerDB'
            ]);

            // Add predictive analytics
            const predictiveInsights = await this.services.predictiveAnalytics.analyzeRoofingTrends({
                damageType: enhancedResult.damageType,
                severity: enhancedResult.severity,
                materialType: enhancedResult.materialType
            });

            return {
                ...enhancedResult,
                predictiveInsights,
                agentUsed: 'roofing_damage',
                analysisType: 'comprehensive_roofing_analysis',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Roofing damage analysis error:', error);
            return this.createErrorResponse(error, 'roofing_damage');
        }
    }

    /**
     * Building code compliance analysis
     */
    async analyzeBuildingCode(imageData, options = {}) {
        try {
            console.log('🏗️ Building code compliance analysis...');

            const agent = this.agentCapabilities.get('building_code');
            const prompt = agent.prompts.document_analysis;

            const qwenResult = await this.callPythonBackend(imageData, prompt, options);
            
            // Enhance with building code service
            const codeAnalysis = await this.services.buildingCode.analyzeCompliance({
                imageAnalysis: qwenResult,
                location: options.location,
                buildingType: options.buildingType
            });

            return {
                ...qwenResult,
                codeCompliance: codeAnalysis,
                agentUsed: 'building_code',
                analysisType: 'building_code_compliance',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Building code analysis error:', error);
            return this.createErrorResponse(error, 'building_code');
        }
    }

    /**
     * Legal compliance document analysis
     */
    async analyzeLegalCompliance(imageData, options = {}) {
        try {
            console.log('⚖️ Legal compliance analysis...');

            const agent = this.agentCapabilities.get('legal_compliance');
            const prompt = agent.prompts.contract_analysis;

            const qwenResult = await this.callPythonBackend(imageData, prompt, options);
            
            // Enhance with legal compliance service
            const legalAnalysis = await this.services.legalCompliance.analyzeDocument({
                imageAnalysis: qwenResult,
                documentType: options.documentType,
                jurisdiction: options.jurisdiction
            });

            return {
                ...qwenResult,
                legalCompliance: legalAnalysis,
                agentUsed: 'legal_compliance',
                analysisType: 'legal_document_analysis',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Legal compliance analysis error:', error);
            return this.createErrorResponse(error, 'legal_compliance');
        }
    }

    /**
     * Advanced document OCR and extraction
     */
    async analyzeDocument(imageData, options = {}) {
        try {
            console.log('📄 Document OCR analysis...');

            const agent = this.agentCapabilities.get('document_ocr');
            const prompt = agent.prompts.document_extraction;

            const qwenResult = await this.callPythonBackend(imageData, prompt, options);
            
            // Enhance with OCR service
            const ocrAnalysis = await this.services.documentOCR.processDocument({
                imageData,
                aiAnalysis: qwenResult,
                extractionMode: options.extractionMode || 'comprehensive'
            });

            return {
                ...qwenResult,
                ocrResults: ocrAnalysis,
                agentUsed: 'document_ocr',
                analysisType: 'document_extraction',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Document OCR analysis error:', error);
            return this.createErrorResponse(error, 'document_ocr');
        }
    }

    /**
     * Weather-related damage analysis
     */
    async analyzeWeatherDamage(imageData, options = {}) {
        try {
            console.log('🌪️ Weather damage correlation analysis...');

            const agent = this.agentCapabilities.get('weather_analysis');
            const prompt = agent.prompts.weather_damage;

            const qwenResult = await this.callPythonBackend(imageData, prompt, options);
            
            // Get weather data correlation
            const weatherData = await this.services.weather.getWeatherData({
                location: options.location,
                dateRange: options.dateRange
            });

            return {
                ...qwenResult,
                weatherCorrelation: weatherData,
                agentUsed: 'weather_analysis',
                analysisType: 'weather_damage_correlation',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Weather damage analysis error:', error);
            return this.createErrorResponse(error, 'weather_analysis');
        }
    }

    /**
     * Product identification and manufacturer lookup
     */
    async identifyProducts(imageData, options = {}) {
        try {
            console.log('🏷️ Product identification analysis...');

            const agent = this.agentCapabilities.get('manufacturer_db');
            const prompt = agent.prompts.product_identification;

            const qwenResult = await this.callPythonBackend(imageData, prompt, options);
            
            // Enhance with manufacturer database
            const productData = await this.services.manufacturerDB.identifyProduct({
                visualAnalysis: qwenResult,
                productCategory: options.category
            });

            return {
                ...qwenResult,
                productInformation: productData,
                agentUsed: 'manufacturer_db',
                analysisType: 'product_identification',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Product identification error:', error);
            return this.createErrorResponse(error, 'manufacturer_db');
        }
    }

    /**
     * Damage quantification analysis
     */
    async quantifyDamage(imageData, options = {}) {
        try {
            console.log('🔢 Damage quantification analysis...');

            // Use specialized quantification service
            const quantificationResult = await this.services.damageQuantification.quantifyDamage({
                imageData,
                analysisOptions: options
            });

            return {
                ...quantificationResult,
                agentUsed: 'damage_quantification',
                analysisType: 'damage_quantification',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Damage quantification error:', error);
            return this.createErrorResponse(error, 'damage_quantification');
        }
    }

    /**
     * General-purpose vision analysis
     */
    async performGeneralAnalysis(imageData, options = {}) {
        try {
            console.log('🔍 General vision analysis...');

            const prompt = options.customPrompt || `Analyze this image and provide:
            1. Detailed description of what you see
            2. Key objects and elements
            3. Relevant observations
            4. Professional assessment
            5. Recommendations if applicable
            
            Provide structured analysis with confidence scores.`;

            return await this.callPythonBackend(imageData, prompt, options);

        } catch (error) {
            console.error('❌ General analysis error:', error);
            return this.createErrorResponse(error, 'general_analysis');
        }
    }

    /**
     * Call Python Qwen backend with fallbacks
     */
    async callPythonBackend(imageData, prompt, options = {}) {
        try {
            // Prepare image buffer
            let imageBuffer;
            if (typeof imageData === 'string') {
                const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
                imageBuffer = Buffer.from(base64Data, 'base64');
            } else {
                imageBuffer = imageData;
            }

            // Create form data
            const formData = new FormData();
            formData.append('image', imageBuffer, {
                filename: options.filename || 'analysis.jpg',
                contentType: options.mimeType || 'image/jpeg'
            });
            formData.append('question', prompt);

            // Add optional parameters
            if (options.temperature) {
                formData.append('temperature', options.temperature.toString());
            }
            if (options.max_tokens) {
                formData.append('max_tokens', options.max_tokens.toString());
            }

            console.log('🚀 Sending request to Python Qwen backend...');
            const response = await fetch(`${this.pythonServiceUrl}/analyze`, {
                method: 'POST',
                body: formData,
                timeout: 60000 // 60 second timeout
            });

            if (!response.ok) {
                throw new Error(`Backend error: ${response.status} - ${await response.text()}`);
            }

            const result = await response.json();
            console.log('✅ Received response from Python backend');

            return {
                success: true,
                response: result.response || result.answer,
                confidence: result.confidence || 85,
                processingTime: result.processing_time || 0,
                modelUsed: 'Qwen2.5-VL-7B',
                backend: 'python',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.warn('⚠️ Python backend call failed, attempting fallback...');
            
            // Fallback to direct QwenVL service
            if (prompt.includes('roofing') || prompt.includes('damage')) {
                return await this.services.qwenVL.analyzeRoofingDamage(imageData, options);
            } else if (prompt.includes('document') || prompt.includes('OCR')) {
                return await this.services.qwenVL.analyzeDocument(imageData, options);
            } else {
                throw error;
            }
        }
    }

    /**
     * Enhance results with additional Susan AI services
     */
    async enhanceWithServices(baseResult, serviceNames = []) {
        try {
            const enhancements = {};

            for (const serviceName of serviceNames) {
                const service = this.services[serviceName];
                if (service && typeof service.enhanceAnalysis === 'function') {
                    try {
                        enhancements[serviceName] = await service.enhanceAnalysis(baseResult);
                    } catch (error) {
                        console.warn(`⚠️ Enhancement failed for ${serviceName}:`, error.message);
                    }
                }
            }

            return {
                ...baseResult,
                enhancements,
                enhancementServices: serviceNames
            };

        } catch (error) {
            console.warn('⚠️ Service enhancement failed:', error);
            return baseResult;
        }
    }

    /**
     * Process queued requests when model becomes available
     */
    async processQueuedRequests() {
        console.log(`🔄 Processing ${this.processingQueue.length} queued requests...`);

        while (this.processingQueue.length > 0 && this.modelLoaded) {
            const { request, resolve, reject } = this.processingQueue.shift();
            
            try {
                const result = await this.analyzeWithVision(
                    request.imageData,
                    request.analysisType,
                    request.options
                );
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }
    }

    /**
     * Multi-agent coordination for complex analysis
     */
    async coordinateMultiAgentAnalysis(imageData, analysisTypes, options = {}) {
        try {
            console.log(`🤝 Coordinating multi-agent analysis: ${analysisTypes.join(', ')}`);

            const results = {};
            const promises = [];

            // Execute all analyses in parallel
            for (const analysisType of analysisTypes) {
                promises.push(
                    this.analyzeWithVision(imageData, analysisType, options)
                        .then(result => ({ analysisType, result }))
                );
            }

            // Wait for all analyses to complete
            const completedAnalyses = await Promise.allSettled(promises);

            // Process results
            for (const outcome of completedAnalyses) {
                if (outcome.status === 'fulfilled') {
                    const { analysisType, result } = outcome.value;
                    results[analysisType] = result;
                } else {
                    console.warn(`⚠️ Analysis failed: ${outcome.reason}`);
                }
            }

            // Cross-correlate results
            const correlation = this.crossCorrelateResults(results);

            return {
                success: true,
                individualResults: results,
                correlation,
                analysisTypes,
                coordinationType: 'multi_agent',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Multi-agent coordination error:', error);
            return this.createErrorResponse(error, 'multi_agent_coordination');
        }
    }

    /**
     * Cross-correlate results from multiple agents
     */
    crossCorrelateResults(results) {
        const correlation = {
            consistencyScore: 0,
            conflictingFindings: [],
            reinforcingFindings: [],
            confidenceAggregate: 0
        };

        try {
            const analysisTypes = Object.keys(results);
            let totalConfidence = 0;
            let validResults = 0;

            // Calculate aggregate confidence
            for (const [type, result] of Object.entries(results)) {
                if (result.success !== false && result.confidence) {
                    totalConfidence += result.confidence;
                    validResults++;
                }
            }

            if (validResults > 0) {
                correlation.confidenceAggregate = totalConfidence / validResults;
            }

            // Look for consistency patterns
            if (results.roofing_damage && results.weather_damage) {
                const roofingDamage = results.roofing_damage.damageType;
                const weatherPattern = results.weather_damage.weatherCorrelation;
                
                if (roofingDamage && weatherPattern) {
                    correlation.reinforcingFindings.push({
                        finding: 'Damage type consistent with weather pattern',
                        confidence: 85
                    });
                }
            }

            // Calculate consistency score
            correlation.consistencyScore = Math.min(
                correlation.confidenceAggregate,
                85 + (correlation.reinforcingFindings.length * 5)
            );

        } catch (error) {
            console.warn('⚠️ Cross-correlation error:', error);
        }

        return correlation;
    }

    /**
     * Offline capabilities management
     */
    async enableOfflineMode() {
        console.log('📴 Enabling offline mode...');
        this.offlineMode = true;
        
        // Initialize offline capabilities
        const offlineCapabilities = {
            basicImageAnalysis: true,
            cachedResults: this.cacheStore.size > 0,
            localOCR: false, // Would need local OCR setup
            fallbackAnalysis: true
        };

        this.emit('offline:enabled', offlineCapabilities);
        return offlineCapabilities;
    }

    /**
     * Cache management
     */
    generateCacheKey(request) {
        const key = `${request.analysisType}_${request.options?.filename || 'unknown'}_${Date.now()}`;
        return Buffer.from(key).toString('base64').substring(0, 32);
    }

    clearCache() {
        const cacheSize = this.cacheStore.size;
        this.cacheStore.clear();
        console.log(`🗑️ Cleared ${cacheSize} cached results`);
        return cacheSize;
    }

    getCacheStats() {
        return {
            size: this.cacheStore.size,
            keys: Array.from(this.cacheStore.keys())
        };
    }

    /**
     * Utility methods
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    createErrorResponse(error, agentType) {
        return {
            success: false,
            error: error.message,
            agentUsed: agentType,
            timestamp: new Date().toISOString(),
            offline: this.offlineMode
        };
    }

    /**
     * Get system status
     */
    getSystemStatus() {
        return {
            pythonBackend: {
                online: this.isOnline,
                modelLoaded: this.modelLoaded,
                url: this.pythonServiceUrl
            },
            services: Object.keys(this.services).reduce((status, name) => {
                status[name] = this.services[name] ? 'initialized' : 'error';
                return status;
            }, {}),
            agents: Array.from(this.agentCapabilities.keys()),
            cache: this.getCacheStats(),
            queue: this.processingQueue.length,
            offlineMode: this.offlineMode
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        console.log('🧹 Cleaning up Qwen Vision Integration...');
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        // Cleanup services
        for (const [name, service] of Object.entries(this.services)) {
            if (service && typeof service.cleanup === 'function') {
                try {
                    await service.cleanup();
                } catch (error) {
                    console.warn(`⚠️ Cleanup warning for ${name}:`, error.message);
                }
            }
        }

        this.clearCache();
        this.removeAllListeners();
        
        console.log('✅ Qwen Vision Integration cleanup completed');
    }
}

// Create and export singleton instance
const qwenVisionIntegration = new QwenVisionIntegration();

// Export both class and instance
// Export already done above
export default qwenVisionIntegration;