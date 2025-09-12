# Susan AI Integration Architecture
**Production-Ready MLOps Integration for Seamless Deployment**

**Date:** August 24, 2025  
**Objective:** Design cohesive architecture integrating all phases into production system  
**Focus:** Scalability, reliability, and maintainability  

---

## System Architecture Overview

### **Current vs. Target Architecture**

#### **Current System (Phase 5 Issues)**
```
Client → WebSocket/API → Susan Brain → Basic Vision → Overconfident Results
   ↓                         ↓              ↓
Limited UI           Basic Memory    100% False Positives
```

#### **Target Production Architecture**
```
                            ┌─ Load Balancer ─┐
                            │                 │
Client ─→ API Gateway ─→ ┌─ Enhanced WebSocket Service ─┐
   │                     │  │                           │
   └─ Progressive Web App │  └─ RESTful API Service ─────┤
                          │                              │
                          ├─ Susan Brain (Enhanced) ─────┤
                          │  │                           │
                          │  ├─ Memory Service           │
                          │  ├─ Vector Database          │
                          │  └─ Context Management       │
                          │                              │
                          ├─ MLOps Vision Pipeline ──────┤
                          │  │                           │
                          │  ├─ Ensemble Model Service   │
                          │  ├─ Confidence Calibrator    │
                          │  ├─ Quality Assurance Engine │
                          │  └─ Fallback Service         │
                          │                              │
                          ├─ Training & Monitoring ──────┤
                          │  │                           │
                          │  ├─ Model Training Pipeline  │
                          │  ├─ Performance Monitor      │
                          │  ├─ Drift Detection         │
                          │  └─ Continuous Validation    │
                          │                              │
                          └─ Infrastructure Services ────┤
                             │                           │
                             ├─ Database Cluster         │
                             ├─ Message Queue            │
                             ├─ Caching Layer           │
                             └─ Monitoring Stack        │
```

---

## Core Integration Components

### 1. Enhanced API Gateway

#### **Production API Gateway**
```javascript
// enhanced_api_gateway.js
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { PrometheusMetrics } from './monitoring/prometheus.js';
import { LoadBalancer } from './infrastructure/load-balancer.js';

class ProductionAPIGateway {
    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupHealthChecks();
        this.setupMetrics();
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                }
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            }
        }));

        // CORS with production settings
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: true,
            optionsSuccessStatus: 200
        }));

        // Rate limiting
        this.app.use('/api', rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
        }));

        // Enhanced rate limiting for ML endpoints
        this.app.use('/api/vision', rateLimit({
            windowMs: 60 * 1000, // 1 minute
            max: 10, // limit ML requests per minute
            message: 'ML processing rate limit exceeded',
        }));

        // Compression and parsing
        this.app.use(compression());
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    }

    setupRoutes() {
        // Health and monitoring endpoints
        this.app.get('/health', this.healthCheck.bind(this));
        this.app.get('/metrics', this.metricsEndpoint.bind(this));
        this.app.get('/ready', this.readinessCheck.bind(this));

        // Core Susan AI endpoints
        this.app.use('/api/susan', this.susanRoutes);
        this.app.use('/api/vision', this.visionRoutes);
        this.app.use('/api/training', this.trainingRoutes);
        this.app.use('/api/monitoring', this.monitoringRoutes);

        // WebSocket upgrade handling
        this.app.get('/ws', this.handleWebSocketUpgrade.bind(this));
    }

    async healthCheck(req, res) {
        const healthStatus = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: process.env.APP_VERSION || 'unknown',
            services: {
                database: await this.checkDatabaseHealth(),
                mlModels: await this.checkMLModelHealth(),
                memoryService: await this.checkMemoryServiceHealth(),
                trainingPipeline: await this.checkTrainingPipelineHealth()
            }
        };

        const allHealthy = Object.values(healthStatus.services).every(
            service => service.status === 'healthy'
        );

        res.status(allHealthy ? 200 : 503).json(healthStatus);
    }

    async readinessCheck(req, res) {
        const readinessStatus = {
            ready: true,
            checks: {
                modelsLoaded: await this.checkModelsLoaded(),
                databaseConnected: await this.checkDatabaseConnection(),
                dependenciesReady: await this.checkDependencies()
            }
        };

        const isReady = Object.values(readinessStatus.checks).every(check => check);
        readinessStatus.ready = isReady;

        res.status(isReady ? 200 : 503).json(readinessStatus);
    }
}
```

### 2. MLOps Vision Pipeline Integration

#### **Enhanced Vision Service**
```javascript
// mlops_vision_service.js
import { EnsembleModelService } from './ml/ensemble_model_service.js';
import { ConfidenceCalibrator } from './ml/confidence_calibrator.js';
import { QualityAssuranceEngine } from './ml/quality_assurance.js';
import { FallbackService } from './ml/fallback_service.js';
import { PerformanceMonitor } from './monitoring/performance_monitor.js';

export class MLOpsVisionService {
    constructor() {
        this.ensembleService = new EnsembleModelService();
        this.confidenceCalibrator = new ConfidenceCalibrator();
        this.qualityAssurance = new QualityAssuranceEngine();
        this.fallbackService = new FallbackService();
        this.performanceMonitor = new PerformanceMonitor();
        
        this.initialized = false;
        this.healthStatus = 'initializing';
    }

    async initialize() {
        try {
            console.log('Initializing MLOps Vision Service...');
            
            // Initialize ensemble models
            await this.ensembleService.loadModels();
            console.log('✅ Ensemble models loaded');

            // Initialize confidence calibration
            await this.confidenceCalibrator.loadCalibrationData();
            console.log('✅ Confidence calibrator ready');

            // Initialize quality assurance
            await this.qualityAssurance.loadQualityRules();
            console.log('✅ Quality assurance engine ready');

            // Initialize fallback service
            await this.fallbackService.initialize();
            console.log('✅ Fallback service ready');

            // Start performance monitoring
            await this.performanceMonitor.start();
            console.log('✅ Performance monitoring active');

            this.initialized = true;
            this.healthStatus = 'healthy';
            
            console.log('🚀 MLOps Vision Service initialized successfully');
            
        } catch (error) {
            console.error('❌ MLOps Vision Service initialization failed:', error);
            this.healthStatus = 'failed';
            throw error;
        }
    }

    async analyzeDamage(imageBuffer, metadata = {}) {
        const startTime = Date.now();
        
        try {
            // Pre-flight checks
            if (!this.initialized) {
                throw new Error('MLOps Vision Service not initialized');
            }

            // Quality assurance pre-processing
            const qaCheck = await this.qualityAssurance.preProcessingCheck(imageBuffer, metadata);
            if (!qaCheck.passed) {
                return this.handleQualityFailure(qaCheck, imageBuffer);
            }

            // Ensemble model prediction
            const ensembleResults = await this.ensembleService.predict(imageBuffer);
            
            // Confidence calibration
            const calibratedResults = await this.confidenceCalibrator.calibrate(ensembleResults);
            
            // Post-processing quality assurance
            const finalQACheck = await this.qualityAssurance.postProcessingCheck(calibratedResults);
            if (!finalQACheck.passed) {
                return this.handleQualityFailure(finalQACheck, imageBuffer, calibratedResults);
            }

            // Format final response
            const response = this.formatResponse(calibratedResults, metadata);
            
            // Log performance metrics
            await this.performanceMonitor.logPrediction({
                processingTime: Date.now() - startTime,
                accuracy: response.confidence,
                prediction: response.damage_detected,
                qualityScore: finalQACheck.score
            });

            return response;

        } catch (error) {
            console.error('Vision analysis error:', error);
            
            // Attempt fallback service
            return await this.fallbackService.handleError(error, imageBuffer, metadata);
        }
    }

    formatResponse(calibratedResults, metadata) {
        return {
            damage_detected: calibratedResults.damage_detected,
            damage_type: calibratedResults.damage_type,
            severity_score: calibratedResults.severity_score,
            confidence: calibratedResults.calibrated_confidence,
            requires_human_review: this.shouldRequireHumanReview(calibratedResults),
            processing_metadata: {
                model_version: this.ensembleService.getVersion(),
                calibration_version: this.confidenceCalibrator.getVersion(),
                processing_time: calibratedResults.processing_time,
                quality_score: calibratedResults.quality_score,
                ensemble_agreement: calibratedResults.ensemble_agreement
            },
            technical_details: {
                individual_predictions: calibratedResults.individual_predictions,
                uncertainty_score: calibratedResults.uncertainty_score,
                edge_case_flags: calibratedResults.edge_case_flags
            }
        };
    }

    shouldRequireHumanReview(results) {
        const reviewCriteria = [
            results.calibrated_confidence < 0.85,
            results.damage_type === 'uncertain',
            results.severity_score > 0.8,
            results.ensemble_agreement < 0.7,
            results.edge_case_flags.length > 0,
            results.uncertainty_score > 0.3
        ];

        return reviewCriteria.some(criteria => criteria);
    }
}
```

### 3. Integrated Susan Brain Enhancement

#### **Production Susan Brain**
```javascript
// enhanced_susan_brain.js
import { MLOpsVisionService } from './mlops_vision_service.js';
import { VectorMemoryService } from '../api/services/VectorMemoryService.js';
import { ConversationService } from '../api/services/ConversationService.js';
import { QualityAssuranceEngine } from './ml/quality_assurance.js';

export class EnhancedSusanBrain {
    constructor() {
        this.visionService = new MLOpsVisionService();
        this.memoryService = new VectorMemoryService();
        this.conversationService = new ConversationService();
        this.qualityAssurance = new QualityAssuranceEngine();
        
        this.capabilities = {
            roofDamageAnalysis: true,
            conversationalAI: true,
            memoryRetrieval: true,
            qualityValidation: true,
            multimodalProcessing: true
        };
        
        this.initialize();
    }

    async initialize() {
        console.log('🧠 Initializing Enhanced Susan Brain...');
        
        // Initialize core services
        await this.visionService.initialize();
        await this.memoryService.initialize();
        await this.conversationService.initialize();
        
        console.log('✅ Enhanced Susan Brain ready');
    }

    async processRequest(request) {
        const { type, content, metadata = {} } = request;
        
        try {
            // Route request based on type
            switch (type) {
                case 'roof_damage_analysis':
                    return await this.handleRoofDamageAnalysis(content, metadata);
                
                case 'conversation':
                    return await this.handleConversation(content, metadata);
                
                case 'memory_retrieval':
                    return await this.handleMemoryRetrieval(content, metadata);
                
                default:
                    return await this.handleGenericRequest(request);
            }
            
        } catch (error) {
            console.error('Susan Brain processing error:', error);
            return this.handleError(error, request);
        }
    }

    async handleRoofDamageAnalysis(imageData, metadata) {
        console.log('🏠 Processing roof damage analysis...');
        
        // Enhanced vision analysis with quality assurance
        const visionResults = await this.visionService.analyzeDamage(imageData, metadata);
        
        // Store analysis in memory for future reference
        await this.memoryService.storeAnalysis({
            type: 'roof_damage_analysis',
            results: visionResults,
            metadata: metadata,
            timestamp: new Date().toISOString()
        });

        // Generate contextual response
        const contextualResponse = await this.generateContextualResponse(visionResults, metadata);
        
        return {
            analysis: visionResults,
            response: contextualResponse,
            recommendations: await this.generateRecommendations(visionResults),
            quality_assurance: {
                passed: true,
                score: visionResults.processing_metadata.quality_score,
                flags: visionResults.technical_details.edge_case_flags
            }
        };
    }

    async generateContextualResponse(visionResults, metadata) {
        const { damage_detected, damage_type, severity_score, confidence } = visionResults;
        
        // Create contextual, professional response
        if (!damage_detected) {
            return {
                summary: "No significant damage detected on this roof.",
                details: `After analyzing the provided image, my assessment shows no signs of storm damage or deterioration that would typically warrant insurance claims. The roof appears to be in good condition with normal wear patterns expected for its age.`,
                confidence_explanation: `I'm ${Math.round(confidence * 100)}% confident in this assessment based on comprehensive analysis of damage indicators.`
            };
        } else {
            return {
                summary: `${damage_type.charAt(0).toUpperCase() + damage_type.slice(1)} damage detected with ${this.getSeverityLabel(severity_score)} severity.`,
                details: this.generateDamageDetails(damage_type, severity_score, confidence),
                confidence_explanation: `This assessment has ${Math.round(confidence * 100)}% confidence based on visual damage indicators and pattern recognition.`,
                next_steps: this.generateNextSteps(damage_type, severity_score)
            };
        }
    }

    generateDamageDetails(damageType, severityScore, confidence) {
        const damageDescriptions = {
            hail: {
                high: "Significant hail damage with multiple impact marks visible on shingles. Granule loss and exposed mat substrate indicate recent storm activity requiring immediate attention.",
                medium: "Moderate hail damage with scattered impact marks. Some granule displacement visible, suggesting storm-related damage that should be documented for insurance purposes.",
                low: "Minor hail damage indicators present. Light impact marks and minimal granule loss detected, worth professional inspection for verification."
            },
            wind: {
                high: "Severe wind damage with lifted or missing shingle tabs. Multiple areas showing exposed underlayment and potential structural concerns requiring immediate repair.",
                medium: "Moderate wind damage with some shingle displacement. Creased or bent shingles visible, indicating storm-related damage suitable for insurance documentation.",
                low: "Minor wind damage signs present. Slight shingle displacement or edge lifting detected, worth professional evaluation for extent of damage."
            },
            wear: {
                high: "Advanced wear patterns indicating roof nearing end of useful life. Significant granule loss and material deterioration present.",
                medium: "Moderate wear patterns consistent with roof aging. Some granule loss and material degradation visible.",
                low: "Minor wear patterns typical of normal aging. Minimal granule loss and material changes detected."
            }
        };

        const severityLevel = severityScore > 0.7 ? 'high' : severityScore > 0.4 ? 'medium' : 'low';
        return damageDescriptions[damageType]?.[severityLevel] || "Damage detected requiring professional assessment.";
    }
}
```

### 4. Training Pipeline Integration

#### **Continuous Training System**
```python
# continuous_training_system.py
import asyncio
import logging
from datetime import datetime, timedelta
import torch
import mlflow
from pathlib import Path

class ContinuousTrainingSystem:
    """Integrated continuous training pipeline for production ML system"""
    
    def __init__(self, config_path="training_config.yaml"):
        self.config = self.load_config(config_path)
        self.mlflow_tracking = MLflowTrackingService()
        self.data_pipeline = DataPipelineService()
        self.model_service = ModelTrainingService()
        self.validation_service = ModelValidationService()
        self.deployment_service = ModelDeploymentService()
        
        self.training_active = False
        self.performance_monitor = PerformanceMonitor()
        
    async def initialize(self):
        """Initialize continuous training system"""
        logging.info("Initializing continuous training system...")
        
        await self.mlflow_tracking.initialize()
        await self.data_pipeline.initialize()
        await self.model_service.initialize()
        await self.validation_service.initialize()
        await self.deployment_service.initialize()
        
        # Start monitoring loop
        asyncio.create_task(self.monitoring_loop())
        
        logging.info("Continuous training system ready")
    
    async def monitoring_loop(self):
        """Continuous monitoring loop for training triggers"""
        while True:
            try:
                # Check for training triggers
                should_retrain = await self.check_retraining_triggers()
                
                if should_retrain and not self.training_active:
                    await self.trigger_retraining(should_retrain['reason'])
                
                # Monitor current model performance
                await self.monitor_model_performance()
                
                # Sleep for configured interval
                await asyncio.sleep(self.config['monitoring_interval'])
                
            except Exception as e:
                logging.error(f"Monitoring loop error: {e}")
                await asyncio.sleep(300)  # Wait 5 minutes on error
    
    async def check_retraining_triggers(self):
        """Check various conditions that might trigger retraining"""
        
        # Performance degradation trigger
        current_accuracy = await self.performance_monitor.get_rolling_accuracy(days=7)
        if current_accuracy < self.config['min_accuracy_threshold']:
            return {
                'trigger': True,
                'reason': 'performance_degradation',
                'details': f'Accuracy dropped to {current_accuracy:.1%}'
            }
        
        # Data drift trigger
        drift_score = await self.performance_monitor.get_data_drift_score()
        if drift_score > self.config['max_drift_threshold']:
            return {
                'trigger': True,
                'reason': 'data_drift',
                'details': f'Drift score: {drift_score:.3f}'
            }
        
        # New data availability trigger
        new_data_count = await self.data_pipeline.count_new_samples()
        if new_data_count > self.config['min_new_samples_for_retraining']:
            return {
                'trigger': True,
                'reason': 'new_data_available',
                'details': f'{new_data_count} new samples available'
            }
        
        # Scheduled retraining trigger
        last_training = await self.get_last_training_date()
        days_since_training = (datetime.now() - last_training).days
        if days_since_training > self.config['max_days_between_retraining']:
            return {
                'trigger': True,
                'reason': 'scheduled_retraining',
                'details': f'{days_since_training} days since last training'
            }
        
        return {'trigger': False}
    
    async def trigger_retraining(self, reason):
        """Trigger the retraining pipeline"""
        self.training_active = True
        
        try:
            logging.info(f"Starting retraining due to: {reason}")
            
            # Create new MLflow experiment run
            with mlflow.start_run(run_name=f"continuous_training_{datetime.now().strftime('%Y%m%d_%H%M%S')}"):
                
                # Log retraining trigger
                mlflow.log_param("trigger_reason", reason)
                mlflow.log_param("start_time", datetime.now().isoformat())
                
                # Prepare training data
                training_data = await self.data_pipeline.prepare_training_data()
                mlflow.log_param("training_samples", len(training_data))
                
                # Train new model
                new_model = await self.model_service.train_model(training_data)
                
                # Validate new model
                validation_results = await self.validation_service.validate_model(new_model)
                
                # Log validation metrics
                for metric, value in validation_results.items():
                    mlflow.log_metric(metric, value)
                
                # Check if new model passes quality gates
                if validation_results['accuracy'] >= self.config['min_accuracy_threshold']:
                    # Deploy new model
                    deployment_success = await self.deployment_service.deploy_model(new_model)
                    
                    if deployment_success:
                        mlflow.log_param("deployment_status", "successful")
                        logging.info("Model retraining and deployment successful")
                    else:
                        mlflow.log_param("deployment_status", "failed")
                        logging.error("Model deployment failed")
                else:
                    mlflow.log_param("deployment_status", "validation_failed")
                    logging.warning("New model failed validation, keeping current model")
                
        except Exception as e:
            logging.error(f"Retraining failed: {e}")
            mlflow.log_param("error", str(e))
        
        finally:
            self.training_active = False

class ModelDeploymentService:
    """Service for deploying models to production with canary deployment"""
    
    def __init__(self):
        self.deployment_config = {
            'canary_percentage': 5,     # Start with 5% traffic
            'validation_period': 3600,  # 1 hour validation
            'rollback_threshold': 0.75  # Rollback if accuracy < 75%
        }
        
    async def deploy_model(self, model):
        """Deploy model using canary deployment strategy"""
        
        try:
            # Stage 1: Deploy to canary environment
            canary_deployment = await self.deploy_canary(model)
            
            if not canary_deployment['success']:
                return False
            
            # Stage 2: Monitor canary performance
            canary_performance = await self.monitor_canary(canary_deployment['id'])
            
            if canary_performance['accuracy'] < self.deployment_config['rollback_threshold']:
                await self.rollback_canary(canary_deployment['id'])
                return False
            
            # Stage 3: Gradual rollout
            rollout_success = await self.gradual_rollout(canary_deployment['id'])
            
            return rollout_success
            
        except Exception as e:
            logging.error(f"Model deployment error: {e}")
            return False
    
    async def deploy_canary(self, model):
        """Deploy model to canary environment"""
        
        # Save model artifacts
        model_path = await self.save_model_artifacts(model)
        
        # Deploy to canary infrastructure
        canary_id = await self.deploy_to_canary_infrastructure(model_path)
        
        # Configure traffic routing (5% to canary)
        await self.configure_traffic_routing(canary_id, self.deployment_config['canary_percentage'])
        
        return {
            'success': True,
            'id': canary_id,
            'model_path': model_path,
            'traffic_percentage': self.deployment_config['canary_percentage']
        }
    
    async def monitor_canary(self, canary_id):
        """Monitor canary deployment performance"""
        
        # Collect metrics for validation period
        start_time = datetime.now()
        validation_period = timedelta(seconds=self.deployment_config['validation_period'])
        
        metrics = []
        while datetime.now() - start_time < validation_period:
            current_metrics = await self.collect_canary_metrics(canary_id)
            metrics.append(current_metrics)
            await asyncio.sleep(60)  # Check every minute
        
        # Calculate average performance
        avg_accuracy = sum(m['accuracy'] for m in metrics) / len(metrics)
        avg_latency = sum(m['latency'] for m in metrics) / len(metrics)
        error_rate = sum(m['error_rate'] for m in metrics) / len(metrics)
        
        return {
            'accuracy': avg_accuracy,
            'latency': avg_latency,
            'error_rate': error_rate,
            'sample_count': sum(m['sample_count'] for m in metrics)
        }
```

---

## Production Infrastructure

### 5. Scalable Infrastructure Design

#### **Kubernetes Deployment Configuration**
```yaml
# kubernetes/susan-ai-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: susan-ai-production
  labels:
    app: susan-ai
    version: v2.0
spec:
  replicas: 3
  selector:
    matchLabels:
      app: susan-ai
  template:
    metadata:
      labels:
        app: susan-ai
        version: v2.0
    spec:
      containers:
      - name: susan-api
        image: susan-ai:v2.0-production
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: susan-secrets
              key: database-url
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: susan-secrets
              key: anthropic-key
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: susan-ml-service
  labels:
    app: susan-ml
    version: v2.0
spec:
  replicas: 2
  selector:
    matchLabels:
      app: susan-ml
  template:
    metadata:
      labels:
        app: susan-ml
        version: v2.0
    spec:
      containers:
      - name: ml-service
        image: susan-ml:v2.0-production
        ports:
        - containerPort: 8000
        env:
        - name: MODEL_PATH
          value: "/app/models"
        resources:
          requests:
            memory: "4Gi"
            cpu: "2000m"
            nvidia.com/gpu: 1
          limits:
            memory: "8Gi"
            cpu: "4000m"
            nvidia.com/gpu: 1
        volumeMounts:
        - name: model-storage
          mountPath: /app/models
      volumes:
      - name: model-storage
        persistentVolumeClaim:
          claimName: model-storage-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: susan-ai-service
spec:
  selector:
    app: susan-ai
  ports:
  - port: 80
    targetPort: 3001
  type: LoadBalancer

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: susan-ai-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/rate-limit-connections: "20"
spec:
  tls:
  - hosts:
    - api.susanai.com
    secretName: susan-tls-secret
  rules:
  - host: api.susanai.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: susan-ai-service
            port:
              number: 80
```

#### **Docker Production Images**
```dockerfile
# Dockerfile.production
FROM node:18-alpine AS base

# Install dependencies for sharp and other native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Build production assets
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype

WORKDIR /app

# Copy built application
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/src ./src
COPY --from=base /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S susanai && \
    adduser -S susanai -u 1001
RUN chown -R susanai:susanai /app
USER susanai

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node healthcheck.js

EXPOSE 3001

CMD ["node", "src/server.js"]
```

### 6. Monitoring and Observability Stack

#### **Comprehensive Monitoring Setup**
```yaml
# monitoring/prometheus-config.yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "susan_ai_alerts.yml"

scrape_configs:
  - job_name: 'susan-ai'
    static_configs:
      - targets: ['susan-ai-service:80']
    metrics_path: /metrics
    scrape_interval: 30s

  - job_name: 'susan-ml'
    static_configs:
      - targets: ['susan-ml-service:8000']
    metrics_path: /metrics
    scrape_interval: 30s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

---
# monitoring/susan_ai_alerts.yml
groups:
- name: susan_ai_alerts
  rules:
  - alert: SusanAIHighErrorRate
    expr: rate(susan_ai_errors_total[5m]) > 0.05
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected in Susan AI"
      description: "Error rate is {{ $value }} which is above the threshold of 0.05"

  - alert: SusanAILowAccuracy
    expr: susan_ai_accuracy < 0.80
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Susan AI accuracy dropped below threshold"
      description: "Current accuracy is {{ $value }}, below threshold of 0.80"

  - alert: SusanAIHighLatency
    expr: histogram_quantile(0.95, rate(susan_ai_request_duration_seconds_bucket[5m])) > 10
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High latency detected in Susan AI"
      description: "95th percentile latency is {{ $value }}s"

  - alert: MLModelNotResponding
    expr: up{job="susan-ml"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "ML model service is down"
      description: "Susan AI ML service has been down for more than 1 minute"
```

#### **Grafana Dashboard Configuration**
```json
{
  "dashboard": {
    "title": "Susan AI Production Dashboard",
    "tags": ["susan-ai", "production", "mlops"],
    "panels": [
      {
        "title": "System Health Overview",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"susan-ai\"}",
            "legendFormat": "API Service"
          },
          {
            "expr": "up{job=\"susan-ml\"}",
            "legendFormat": "ML Service"
          }
        ]
      },
      {
        "title": "Model Accuracy (24h Rolling)",
        "type": "graph",
        "targets": [
          {
            "expr": "susan_ai_accuracy",
            "legendFormat": "Accuracy"
          }
        ],
        "yAxes": [
          {
            "min": 0.7,
            "max": 1.0,
            "unit": "percentunit"
          }
        ],
        "thresholds": [
          {
            "value": 0.85,
            "colorMode": "critical",
            "op": "lt"
          }
        ]
      },
      {
        "title": "False Positive Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "susan_ai_false_positive_rate",
            "legendFormat": "FPR"
          }
        ],
        "thresholds": [
          {
            "value": 0.10,
            "colorMode": "critical",
            "op": "gt"
          }
        ]
      },
      {
        "title": "Request Volume and Latency",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(susan_ai_requests_total[5m])",
            "legendFormat": "Requests/sec"
          },
          {
            "expr": "histogram_quantile(0.95, rate(susan_ai_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th Percentile Latency"
          }
        ]
      }
    ]
  }
}
```

---

## Data Management and Security

### 7. Production Data Pipeline

#### **Secure Data Handling**
```javascript
// data/secure_data_pipeline.js
import crypto from 'crypto';
import { S3 } from '@aws-sdk/client-s3';
import { KMS } from '@aws-sdk/client-kms';

class SecureDataPipeline {
    constructor() {
        this.s3Client = new S3({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
        
        this.kmsClient = new KMS({
            region: process.env.AWS_REGION
        });
        
        this.encryptionKeyId = process.env.KMS_KEY_ID;
    }

    async storeImageSecurely(imageBuffer, metadata) {
        // Generate unique identifier
        const imageId = crypto.randomUUID();
        
        // Encrypt image data
        const encryptedImage = await this.encryptData(imageBuffer);
        
        // Store in S3 with server-side encryption
        const uploadParams = {
            Bucket: process.env.SECURE_BUCKET,
            Key: `images/${imageId}`,
            Body: encryptedImage,
            ServerSideEncryption: 'aws:kms',
            SSEKMSKeyId: this.encryptionKeyId,
            Metadata: {
                'content-type': metadata.contentType,
                'upload-timestamp': new Date().toISOString(),
                'client-id': metadata.clientId,
                'analysis-status': 'pending'
            }
        };
        
        await this.s3Client.putObject(uploadParams);
        
        // Store metadata in encrypted database
        await this.storeMetadataSecurely(imageId, metadata);
        
        return imageId;
    }

    async retrieveImageSecurely(imageId) {
        // Retrieve from S3
        const getParams = {
            Bucket: process.env.SECURE_BUCKET,
            Key: `images/${imageId}`
        };
        
        const response = await this.s3Client.getObject(getParams);
        const encryptedData = await response.Body.transformToByteArray();
        
        // Decrypt data
        const decryptedImage = await this.decryptData(encryptedData);
        
        return {
            imageData: decryptedImage,
            metadata: response.Metadata
        };
    }

    async encryptData(data) {
        const params = {
            KeyId: this.encryptionKeyId,
            Plaintext: data
        };
        
        const result = await this.kmsClient.encrypt(params);
        return result.CiphertextBlob;
    }

    async decryptData(encryptedData) {
        const params = {
            CiphertextBlob: encryptedData
        };
        
        const result = await this.kmsClient.decrypt(params);
        return result.Plaintext;
    }
}
```

### 8. Compliance and Audit Framework

#### **GDPR and Privacy Compliance**
```javascript
// compliance/privacy_compliance.js
class PrivacyComplianceFramework {
    constructor() {
        this.dataRetentionPeriods = {
            'roof_images': 365, // days
            'analysis_results': 2555, // 7 years for insurance
            'user_data': 1095, // 3 years
            'audit_logs': 2555 // 7 years
        };
        
        this.consentManager = new ConsentManager();
        this.dataProcessor = new DataProcessor();
        this.auditLogger = new AuditLogger();
    }

    async processDataRequest(userId, requestType, dataTypes) {
        const audit = await this.auditLogger.startAudit({
            type: 'data_request',
            userId: userId,
            requestType: requestType,
            dataTypes: dataTypes,
            timestamp: new Date().toISOString()
        });

        try {
            switch (requestType) {
                case 'access':
                    return await this.handleDataAccess(userId, dataTypes, audit);
                
                case 'deletion':
                    return await this.handleDataDeletion(userId, dataTypes, audit);
                
                case 'portability':
                    return await this.handleDataPortability(userId, dataTypes, audit);
                
                case 'rectification':
                    return await this.handleDataRectification(userId, dataTypes, audit);
                
                default:
                    throw new Error(`Unsupported request type: ${requestType}`);
            }
        } catch (error) {
            await this.auditLogger.logError(audit.id, error);
            throw error;
        } finally {
            await this.auditLogger.completeAudit(audit.id);
        }
    }

    async handleDataDeletion(userId, dataTypes, audit) {
        const deletionResults = {};
        
        for (const dataType of dataTypes) {
            try {
                // Check if data can be deleted (legal hold, etc.)
                const canDelete = await this.checkDeletionEligibility(userId, dataType);
                
                if (canDelete) {
                    // Perform secure deletion
                    const deleteCount = await this.secureDelete(userId, dataType);
                    deletionResults[dataType] = {
                        status: 'deleted',
                        count: deleteCount
                    };
                    
                    await this.auditLogger.logDeletion(audit.id, {
                        dataType: dataType,
                        recordsDeleted: deleteCount
                    });
                } else {
                    deletionResults[dataType] = {
                        status: 'retention_required',
                        reason: 'Legal/regulatory retention requirement'
                    };
                }
            } catch (error) {
                deletionResults[dataType] = {
                    status: 'error',
                    error: error.message
                };
            }
        }
        
        return deletionResults;
    }

    async secureDelete(userId, dataType) {
        // Implement secure deletion based on data type
        switch (dataType) {
            case 'roof_images':
                return await this.deleteRoofImages(userId);
            
            case 'analysis_results':
                return await this.deleteAnalysisResults(userId);
            
            case 'user_profile':
                return await this.deleteUserProfile(userId);
            
            default:
                throw new Error(`Unknown data type: ${dataType}`);
        }
    }
}
```

---

## Performance Optimization and Caching

### 9. Multi-Layer Caching Strategy

#### **Intelligent Caching System**
```javascript
// caching/intelligent_cache.js
import Redis from 'ioredis';
import LRU from 'lru-cache';

class IntelligentCacheSystem {
    constructor() {
        // Redis for shared cache across instances
        this.redisClient = new Redis({
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
            password: process.env.REDIS_PASSWORD,
            retryDelayOnFailover: 100,
            maxRetriesPerRequest: 3
        });

        // LRU cache for in-memory hot data
        this.localCache = new LRU({
            max: 1000, // Maximum 1000 items
            ttl: 1000 * 60 * 15 // 15 minutes TTL
        });

        this.cacheStrategies = {
            'model_predictions': {
                ttl: 3600, // 1 hour
                layer: 'redis',
                keyGenerator: this.generatePredictionKey.bind(this)
            },
            'user_sessions': {
                ttl: 1800, // 30 minutes
                layer: 'redis',
                keyGenerator: this.generateSessionKey.bind(this)
            },
            'static_assets': {
                ttl: 86400, // 24 hours
                layer: 'local',
                keyGenerator: this.generateAssetKey.bind(this)
            }
        };
    }

    async get(cacheType, identifier, options = {}) {
        const strategy = this.cacheStrategies[cacheType];
        if (!strategy) {
            throw new Error(`Unknown cache type: ${cacheType}`);
        }

        const key = strategy.keyGenerator(identifier);
        
        // Try local cache first for applicable types
        if (strategy.layer === 'local' || options.preferLocal) {
            const localValue = this.localCache.get(key);
            if (localValue) {
                return JSON.parse(localValue);
            }
        }

        // Try Redis cache
        try {
            const redisValue = await this.redisClient.get(key);
            if (redisValue) {
                const parsed = JSON.parse(redisValue);
                
                // Populate local cache if applicable
                if (strategy.layer === 'local') {
                    this.localCache.set(key, redisValue);
                }
                
                return parsed;
            }
        } catch (error) {
            console.error('Redis cache error:', error);
            // Continue without cache on Redis errors
        }

        return null;
    }

    async set(cacheType, identifier, value, options = {}) {
        const strategy = this.cacheStrategies[cacheType];
        if (!strategy) {
            throw new Error(`Unknown cache type: ${cacheType}`);
        }

        const key = strategy.keyGenerator(identifier);
        const serializedValue = JSON.stringify(value);
        const ttl = options.ttl || strategy.ttl;

        // Set in local cache if applicable
        if (strategy.layer === 'local') {
            this.localCache.set(key, serializedValue);
        }

        // Set in Redis cache
        try {
            await this.redisClient.setex(key, ttl, serializedValue);
        } catch (error) {
            console.error('Redis cache set error:', error);
            // Don't fail on cache errors
        }
    }

    generatePredictionKey(imageHash) {
        return `prediction:${imageHash}`;
    }

    generateSessionKey(sessionId) {
        return `session:${sessionId}`;
    }

    generateAssetKey(assetPath) {
        return `asset:${assetPath}`;
    }

    async warmupCache() {
        """Pre-populate cache with commonly used data"""
        try {
            // Warm up model predictions for common scenarios
            await this.warmupModelPredictions();
            
            // Warm up static assets
            await this.warmupStaticAssets();
            
            console.log('Cache warmup completed successfully');
        } catch (error) {
            console.error('Cache warmup failed:', error);
        }
    }
}
```

This integration architecture provides a comprehensive foundation for deploying Susan AI's enhanced MLOps system in production. The architecture emphasizes:

1. **Scalability** - Kubernetes-based deployment with auto-scaling capabilities
2. **Reliability** - Multiple fallback layers and health monitoring
3. **Security** - End-to-end encryption and compliance frameworks
4. **Observability** - Comprehensive monitoring and alerting
5. **Performance** - Multi-layer caching and optimization
6. **Maintainability** - Clear separation of concerns and modular design

The integration ensures all phases work together seamlessly while providing the production-grade reliability and performance needed for Susan AI's critical roof damage assessment functionality.