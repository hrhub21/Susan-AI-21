import express from 'express';
import { PredictiveAnalyticsService } from '../services/PredictiveAnalyticsService.js';
import { SuccessAnalyticsService } from '../services/SuccessAnalyticsService.js';
import { AdjusterIntelligenceService } from '../services/AdjusterIntelligenceService.js';

const router = express.Router();

// Initialize services
let predictiveService;
let successAnalyticsService;
let adjusterIntelligenceService;

// Initialize services
const initializeServices = async () => {
    if (!predictiveService) {
        predictiveService = new PredictiveAnalyticsService();
    }
    if (!successAnalyticsService) {
        successAnalyticsService = new SuccessAnalyticsService();
    }
    if (!adjusterIntelligenceService) {
        adjusterIntelligenceService = new AdjusterIntelligenceService();
    }
};

// Middleware to ensure services are initialized
router.use(async (req, res, next) => {
    try {
        await initializeServices();
        next();
    } catch (error) {
        console.error('Service initialization error:', error);
        res.status(500).json({
            error: 'Service initialization failed',
            message: error.message
        });
    }
});

/**
 * @route POST /api/predictive-analytics/approval-probability
 * @desc Predict claim approval probability
 * @access Private
 */
router.post('/approval-probability', async (req, res) => {
    try {
        const { claimData, adjusterId, contextData } = req.body;
        
        if (!claimData) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Claim data is required'
            });
        }
        
        // Get adjuster data if provided
        let adjusterData = null;
        if (adjusterId) {
            adjusterData = adjusterIntelligenceService.getAdjusterProfile(adjusterId);
        }
        
        // Generate prediction
        const prediction = await predictiveService.predictApprovalProbability(
            claimData, 
            adjusterData
        );
        
        res.json({
            success: true,
            data: prediction,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Approval probability prediction error:', error);
        res.status(500).json({
            error: 'Prediction Failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route POST /api/predictive-analytics/timeline-prediction
 * @desc Predict claim processing timeline
 * @access Private
 */
router.post('/timeline-prediction', async (req, res) => {
    try {
        const { claimData, adjusterId, currentContext } = req.body;
        
        if (!claimData) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Claim data is required'
            });
        }
        
        // Get adjuster data if provided
        let adjusterData = null;
        if (adjusterId) {
            adjusterData = adjusterIntelligenceService.getAdjusterProfile(adjusterId);
        }
        
        // Generate timeline prediction
        const prediction = await predictiveService.predictProcessingTimeline(
            claimData,
            adjusterData,
            currentContext || {}
        );
        
        res.json({
            success: true,
            data: prediction,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Timeline prediction error:', error);
        res.status(500).json({
            error: 'Timeline Prediction Failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route POST /api/predictive-analytics/settlement-ratio
 * @desc Predict settlement ratio and negotiation strategy
 * @access Private
 */
router.post('/settlement-ratio', async (req, res) => {
    try {
        const { claimData, adjusterId, negotiationContext } = req.body;
        
        if (!claimData) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Claim data is required'
            });
        }
        
        // Get adjuster data if provided
        let adjusterData = null;
        if (adjusterId) {
            adjusterData = adjusterIntelligenceService.getAdjusterProfile(adjusterId);
        }
        
        // Generate settlement prediction
        const prediction = await predictiveService.predictSettlementRatio(
            claimData,
            adjusterData,
            negotiationContext || {}
        );
        
        res.json({
            success: true,
            data: prediction,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Settlement ratio prediction error:', error);
        res.status(500).json({
            error: 'Settlement Prediction Failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route POST /api/predictive-analytics/risk-assessment
 * @desc Comprehensive claim risk assessment
 * @access Private
 */
router.post('/risk-assessment', async (req, res) => {
    try {
        const { claimData, adjusterId, contextData } = req.body;
        
        if (!claimData) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Claim data is required'
            });
        }
        
        // Get adjuster data if provided
        let adjusterData = null;
        if (adjusterId) {
            adjusterData = adjusterIntelligenceService.getAdjusterProfile(adjusterId);
        }
        
        // Generate risk assessment
        const assessment = await predictiveService.assessClaimRisk(
            claimData,
            adjusterData,
            contextData || {}
        );
        
        res.json({
            success: true,
            data: assessment,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Risk assessment error:', error);
        res.status(500).json({
            error: 'Risk Assessment Failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route POST /api/predictive-analytics/optimize-strategy
 * @desc Optimize claim strategy using ML
 * @access Private
 */
router.post('/optimize-strategy', async (req, res) => {
    try {
        const { claimData, adjusterId, constraints } = req.body;
        
        if (!claimData) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Claim data is required'
            });
        }
        
        // Get adjuster data if provided
        let adjusterData = null;
        if (adjusterId) {
            adjusterData = adjusterIntelligenceService.getAdjusterProfile(adjusterId);
        }
        
        // Generate optimized strategy
        const optimization = await predictiveService.optimizeStrategy(
            claimData,
            adjusterData,
            constraints || {}
        );
        
        res.json({
            success: true,
            data: optimization,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Strategy optimization error:', error);
        res.status(500).json({
            error: 'Strategy Optimization Failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route GET /api/predictive-analytics/market-intelligence
 * @desc Generate market intelligence insights
 * @access Private
 */
router.get('/market-intelligence', async (req, res) => {
    try {
        const filters = req.query;
        
        // Generate market intelligence
        const intelligence = await predictiveService.generateMarketIntelligence(filters);
        
        res.json({
            success: true,
            data: intelligence,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Market intelligence error:', error);
        res.status(500).json({
            error: 'Market Intelligence Failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route POST /api/predictive-analytics/decision-support
 * @desc Real-time decision support system
 * @access Private
 */
router.post('/decision-support', async (req, res) => {
    try {
        const { claimId, currentStage, urgencyLevel } = req.body;
        
        if (!claimId) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Claim ID is required'
            });
        }
        
        if (!currentStage) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Current stage is required'
            });
        }
        
        // Generate decision support
        const decisionSupport = await predictiveService.getDecisionSupport(
            claimId,
            currentStage,
            urgencyLevel || 'normal'
        );
        
        res.json({
            success: true,
            data: decisionSupport,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Decision support error:', error);
        res.status(500).json({
            error: 'Decision Support Failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route POST /api/predictive-analytics/comprehensive-analysis
 * @desc Generate comprehensive analysis with all predictions
 * @access Private
 */
router.post('/comprehensive-analysis', async (req, res) => {
    try {
        const { claimData, adjusterId, contextData, analysisType } = req.body;
        
        if (!claimData) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Claim data is required'
            });
        }
        
        // Get adjuster data if provided
        let adjusterData = null;
        if (adjusterId) {
            adjusterData = adjusterIntelligenceService.getAdjusterProfile(adjusterId);
        }
        
        // Generate all predictions in parallel
        const [
            approvalPrediction,
            timelinePrediction,
            settlementPrediction,
            riskAssessment,
            strategyOptimization
        ] = await Promise.all([
            predictiveService.predictApprovalProbability(claimData, adjusterData),
            predictiveService.predictProcessingTimeline(claimData, adjusterData, contextData),
            predictiveService.predictSettlementRatio(claimData, adjusterData, contextData),
            predictiveService.assessClaimRisk(claimData, adjusterData, contextData),
            predictiveService.optimizeStrategy(claimData, adjusterData, contextData)
        ]);
        
        // Compile comprehensive analysis
        const comprehensiveAnalysis = {
            analysisId: `COMP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`.toUpperCase(),
            timestamp: new Date().toISOString(),
            analysisType: analysisType || 'standard',
            
            summary: {
                approvalProbability: approvalPrediction.prediction.probability,
                estimatedTimeline: timelinePrediction.timeline.estimatedDays,
                expectedSettlement: settlementPrediction.settlement.predictedRatio,
                riskLevel: riskAssessment.risk.overallLevel,
                recommendedStrategy: strategyOptimization.strategies.primary.name
            },
            
            predictions: {
                approval: approvalPrediction,
                timeline: timelinePrediction,
                settlement: settlementPrediction
            },
            
            assessments: {
                risk: riskAssessment,
                strategy: strategyOptimization
            },
            
            insights: {
                keyFindings: [
                    ...approvalPrediction.analysis.keyDrivers.slice(0, 3),
                    ...riskAssessment.threats ? Object.keys(riskAssessment.threats).slice(0, 2) : [],
                    ...strategyOptimization.optimization.solutions.slice(0, 2)
                ],
                recommendations: [
                    ...approvalPrediction.recommendations.immediate.slice(0, 3),
                    ...riskAssessment.mitigation.immediate ? riskAssessment.mitigation.immediate.slice(0, 2) : [],
                    ...strategyOptimization.recommendations.immediate.slice(0, 2)
                ],
                alerts: [
                    ...(riskAssessment.risk.score > 0.8 ? ['High risk claim - requires immediate attention'] : []),
                    ...(approvalPrediction.prediction.probability < 0.5 ? ['Low approval probability - strengthen documentation'] : []),
                    ...(timelinePrediction.timeline.estimatedDays > 30 ? ['Extended timeline expected - proactive communication needed'] : [])
                ]
            },
            
            confidence: {
                overall: Math.round((
                    approvalPrediction.prediction.confidence +
                    timelinePrediction.timeline.confidence +
                    settlementPrediction.settlement.confidence +
                    riskAssessment.risk.confidence +
                    strategyOptimization.optimization.solutions[0]?.confidence || 0.7
                ) / 5 * 100) / 100,
                breakdown: {
                    approval: approvalPrediction.prediction.confidence,
                    timeline: timelinePrediction.timeline.confidence,
                    settlement: settlementPrediction.settlement.confidence,
                    risk: riskAssessment.risk.confidence,
                    strategy: strategyOptimization.optimization.solutions[0]?.confidence || 0.7
                }
            },
            
            metadata: {
                modelsUsed: ['approval_probability', 'timeline_prediction', 'settlement_ratio', 'risk_assessment', 'strategy_optimization'],
                analysisDepth: 'comprehensive',
                dataQuality: 'high',
                processingTime: new Date().toISOString()
            }
        };
        
        res.json({
            success: true,
            data: comprehensiveAnalysis,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Comprehensive analysis error:', error);
        res.status(500).json({
            error: 'Comprehensive Analysis Failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route GET /api/predictive-analytics/models/status
 * @desc Get status of all ML models
 * @access Private
 */
router.get('/models/status', async (req, res) => {
    try {
        const activeModels = await predictiveService.getActiveModels();
        
        res.json({
            success: true,
            data: {
                models: activeModels,
                totalModels: activeModels.length,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Model status error:', error);
        res.status(500).json({
            error: 'Model Status Failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route POST /api/predictive-analytics/models/train
 * @desc Train or retrain a specific model
 * @access Private
 */
router.post('/models/train', async (req, res) => {
    try {
        const { modelKey, trainingOptions } = req.body;
        
        if (!modelKey) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Model key is required'
            });
        }
        
        // Start training
        const trainingResult = await predictiveService.trainModel(modelKey, trainingOptions || {});
        
        res.json({
            success: true,
            data: trainingResult,
            message: `Model ${modelKey} training completed successfully`,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Model training error:', error);
        res.status(500).json({
            error: 'Model Training Failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route GET /api/predictive-analytics/models/performance
 * @desc Get performance metrics for all models
 * @access Private
 */
router.get('/models/performance', async (req, res) => {
    try {
        const performanceReport = await predictiveService.monitorModelPerformance();
        
        res.json({
            success: true,
            data: performanceReport,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Model performance error:', error);
        res.status(500).json({
            error: 'Performance Monitoring Failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route GET /api/predictive-analytics/predictions/:predictionId
 * @desc Get specific prediction by ID
 * @access Private
 */
router.get('/predictions/:predictionId', async (req, res) => {
    try {
        const { predictionId } = req.params;
        
        const prediction = await predictiveService.getPrediction(predictionId);
        
        if (!prediction) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Prediction not found',
                timestamp: new Date().toISOString()
            });
        }
        
        res.json({
            success: true,
            data: prediction,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Get prediction error:', error);
        res.status(500).json({
            error: 'Get Prediction Failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route GET /api/predictive-analytics/dashboard
 * @desc Get predictive analytics dashboard
 * @access Private
 */
router.get('/dashboard', async (req, res) => {
    try {
        const dashboard = await predictiveService.getDashboard();
        
        res.json({
            success: true,
            data: dashboard,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            error: 'Dashboard Failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route POST /api/predictive-analytics/feedback
 * @desc Provide feedback on predictions for model learning
 * @access Private
 */
router.post('/feedback', async (req, res) => {
    try {
        const { predictionId, actualOutcome, feedback, metadata } = req.body;
        
        if (!predictionId || !actualOutcome) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Prediction ID and actual outcome are required'
            });
        }
        
        // Store feedback for model improvement
        const feedbackResult = {
            feedbackId: `FB-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`.toUpperCase(),
            predictionId,
            actualOutcome,
            feedback: feedback || '',
            metadata: metadata || {},
            timestamp: new Date().toISOString(),
            status: 'received'
        };
        
        // In production, this would be used to retrain models
        console.log('📋 Prediction feedback received:', feedbackResult);
        
        res.json({
            success: true,
            data: feedbackResult,
            message: 'Feedback received and will be used for model improvement',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Feedback error:', error);
        res.status(500).json({
            error: 'Feedback Processing Failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

export default router;