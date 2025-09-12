import express from 'express';
import { LegalComplianceService } from '../services/LegalComplianceService.js';

const router = express.Router();
const legalComplianceService = new LegalComplianceService();

/**
 * Legal Compliance API Routes
 * Comprehensive legal compliance endpoints for insurance communications and claims
 */

// Initialize service
let serviceInitialized = false;
legalComplianceService.on('serviceReady', () => {
    serviceInitialized = true;
    console.log('✅ Legal Compliance Service API ready');
});

// Middleware to check service initialization
const checkServiceReady = (req, res, next) => {
    if (!serviceInitialized) {
        return res.status(503).json({
            error: 'Legal Compliance Service not ready',
            message: 'Service is still initializing. Please try again shortly.',
            code: 'SERVICE_INITIALIZING'
        });
    }
    next();
};

/**
 * @route GET /api/legal-compliance/health
 * @desc Health check for Legal Compliance Service
 * @access Public
 */
router.get('/health', (req, res) => {
    res.json({
        status: serviceInitialized ? 'healthy' : 'initializing',
        service: 'Legal Compliance Service',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        features: {
            stateRegulations: true,
            communicationCompliance: true,
            claimValidation: true,
            documentAnalysis: true,
            riskAssessment: true,
            auditTrail: true,
            multiStateSupport: true,
            realTimeMonitoring: true
        }
    });
});

/**
 * @route GET /api/legal-compliance/regulations/:state
 * @desc Get regulations for a specific state
 * @access Protected
 */
router.get('/regulations/:state', checkServiceReady, async (req, res) => {
    try {
        const { state } = req.params;
        const regulations = legalComplianceService.getStateRegulations(state.toUpperCase());
        
        if (!regulations) {
            return res.status(404).json({
                error: 'State regulations not found',
                message: `No regulations found for state: ${state}`,
                code: 'STATE_NOT_FOUND'
            });
        }

        res.json({
            state: state.toUpperCase(),
            regulations,
            retrieved: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error retrieving state regulations:', error);
        res.status(500).json({
            error: 'Failed to retrieve regulations',
            message: error.message,
            code: 'REGULATIONS_RETRIEVAL_ERROR'
        });
    }
});

/**
 * @route GET /api/legal-compliance/regulations
 * @desc Get all available state regulations
 * @access Protected
 */
router.get('/regulations', checkServiceReady, async (req, res) => {
    try {
        const allStates = [];
        for (const [stateCode, regulations] of legalComplianceService.stateRegulations) {
            allStates.push({
                state: stateCode,
                name: regulations.name,
                regulatoryBody: regulations.regulatoryBody,
                lastUpdated: regulations.lastUpdated,
                complianceLevel: regulations.complianceLevel
            });
        }

        res.json({
            totalStates: allStates.length,
            states: allStates,
            retrieved: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error retrieving all regulations:', error);
        res.status(500).json({
            error: 'Failed to retrieve regulations',
            message: error.message,
            code: 'REGULATIONS_RETRIEVAL_ERROR'
        });
    }
});

/**
 * @route POST /api/legal-compliance/check/communication
 * @desc Check communication compliance
 * @access Protected
 */
router.post('/check/communication', checkServiceReady, async (req, res) => {
    try {
        const { content, type, state, recipientInfo, context } = req.body;

        // Validate required fields
        if (!content || !type || !state) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'content, type, and state are required',
                code: 'VALIDATION_ERROR'
            });
        }

        const communicationData = {
            content,
            type,
            state: state.toUpperCase(),
            recipientInfo: recipientInfo || {},
            context: context || {}
        };

        const complianceReport = await legalComplianceService.checkCommunicationCompliance(communicationData);

        res.json({
            success: true,
            complianceReport,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error checking communication compliance:', error);
        res.status(500).json({
            error: 'Compliance check failed',
            message: error.message,
            code: 'COMPLIANCE_CHECK_ERROR'
        });
    }
});

/**
 * @route POST /api/legal-compliance/validate/claim
 * @desc Validate claim compliance
 * @access Protected
 */
router.post('/validate/claim', checkServiceReady, async (req, res) => {
    try {
        const { claimId, state, status, timestamps, documents, communications } = req.body;

        // Validate required fields
        if (!claimId || !state || !status) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'claimId, state, and status are required',
                code: 'VALIDATION_ERROR'
            });
        }

        const claimData = {
            claimId,
            state: state.toUpperCase(),
            status,
            timestamps: timestamps || {},
            documents: documents || [],
            communications: communications || []
        };

        const validationReport = await legalComplianceService.validateClaimCompliance(claimData);

        res.json({
            success: true,
            validationReport,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error validating claim compliance:', error);
        res.status(500).json({
            error: 'Claim validation failed',
            message: error.message,
            code: 'CLAIM_VALIDATION_ERROR'
        });
    }
});

/**
 * @route POST /api/legal-compliance/analyze/document
 * @desc Analyze document compliance using NLP
 * @access Protected
 */
router.post('/analyze/document', checkServiceReady, async (req, res) => {
    try {
        const { documentId, content, type, state, context } = req.body;

        // Validate required fields
        if (!documentId || !content || !type || !state) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'documentId, content, type, and state are required',
                code: 'VALIDATION_ERROR'
            });
        }

        const documentData = {
            documentId,
            content,
            type,
            state: state.toUpperCase(),
            context: context || {}
        };

        const analysisReport = await legalComplianceService.analyzeDocumentCompliance(documentData);

        res.json({
            success: true,
            analysisReport,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error analyzing document compliance:', error);
        res.status(500).json({
            error: 'Document analysis failed',
            message: error.message,
            code: 'DOCUMENT_ANALYSIS_ERROR'
        });
    }
});

/**
 * @route POST /api/legal-compliance/assess/risk
 * @desc Assess compliance risk
 * @access Protected
 */
router.post('/assess/risk', checkServiceReady, async (req, res) => {
    try {
        const { entityId, entityType, data, context } = req.body;

        // Validate required fields
        if (!entityId || !entityType || !data) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'entityId, entityType, and data are required',
                code: 'VALIDATION_ERROR'
            });
        }

        const riskData = {
            entityId,
            entityType,
            data,
            context: context || {}
        };

        const riskAssessment = await legalComplianceService.assessComplianceRisk(riskData);

        res.json({
            success: true,
            riskAssessment,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error assessing compliance risk:', error);
        res.status(500).json({
            error: 'Risk assessment failed',
            message: error.message,
            code: 'RISK_ASSESSMENT_ERROR'
        });
    }
});

/**
 * @route GET /api/legal-compliance/audit/:entityId
 * @desc Get audit trail for an entity
 * @access Protected
 */
router.get('/audit/:entityId', checkServiceReady, async (req, res) => {
    try {
        const { entityId } = req.params;
        const { eventType, startDate, endDate, riskLevel } = req.query;

        const filters = {};
        if (eventType) filters.eventType = eventType;
        if (riskLevel) filters.riskLevel = riskLevel;
        if (startDate && endDate) {
            filters.dateRange = { start: startDate, end: endDate };
        }

        const auditTrail = await legalComplianceService.getAuditTrail(entityId, filters);

        res.json({
            success: true,
            auditTrail,
            retrieved: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error retrieving audit trail:', error);
        res.status(500).json({
            error: 'Audit trail retrieval failed',
            message: error.message,
            code: 'AUDIT_RETRIEVAL_ERROR'
        });
    }
});

/**
 * @route POST /api/legal-compliance/audit/log
 * @desc Log a compliance event to audit trail
 * @access Protected
 */
router.post('/audit/log', checkServiceReady, async (req, res) => {
    try {
        const eventData = req.body;

        // Validate required fields
        if (!eventData.type || !eventData.entityId || !eventData.action) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'type, entityId, and action are required',
                code: 'VALIDATION_ERROR'
            });
        }

        // Add request metadata
        eventData.ipAddress = req.ip;
        eventData.userAgent = req.get('User-Agent');
        eventData.user = req.user?.id || 'anonymous';

        const auditId = await legalComplianceService.logComplianceEvent(eventData);

        res.json({
            success: true,
            auditId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error logging audit event:', error);
        res.status(500).json({
            error: 'Audit logging failed',
            message: error.message,
            code: 'AUDIT_LOGGING_ERROR'
        });
    }
});

/**
 * @route GET /api/legal-compliance/status/:entityId
 * @desc Get compliance status for an entity
 * @access Protected
 */
router.get('/status/:entityId', checkServiceReady, async (req, res) => {
    try {
        const { entityId } = req.params;
        const complianceStatus = legalComplianceService.getComplianceStatus(entityId);

        res.json({
            entityId,
            complianceStatus,
            retrieved: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error retrieving compliance status:', error);
        res.status(500).json({
            error: 'Status retrieval failed',
            message: error.message,
            code: 'STATUS_RETRIEVAL_ERROR'
        });
    }
});

/**
 * @route GET /api/legal-compliance/violations/:entityId
 * @desc Get all violations for an entity
 * @access Protected
 */
router.get('/violations/:entityId', checkServiceReady, async (req, res) => {
    try {
        const { entityId } = req.params;
        const violations = legalComplianceService.getAllViolations(entityId);

        res.json({
            entityId,
            violationCount: violations.length,
            violations,
            retrieved: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error retrieving violations:', error);
        res.status(500).json({
            error: 'Violations retrieval failed',
            message: error.message,
            code: 'VIOLATIONS_RETRIEVAL_ERROR'
        });
    }
});

/**
 * @route GET /api/legal-compliance/metrics
 * @desc Get overall compliance metrics
 * @access Protected
 */
router.get('/metrics', checkServiceReady, async (req, res) => {
    try {
        const metrics = legalComplianceService.getComplianceMetrics();

        res.json({
            success: true,
            metrics,
            retrieved: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error retrieving compliance metrics:', error);
        res.status(500).json({
            error: 'Metrics retrieval failed',
            message: error.message,
            code: 'METRICS_RETRIEVAL_ERROR'
        });
    }
});

/**
 * @route POST /api/legal-compliance/monitor/start
 * @desc Start monitoring an entity for compliance
 * @access Protected
 */
router.post('/monitor/start', checkServiceReady, async (req, res) => {
    try {
        const { entityId, entityType, alertOnWarnings } = req.body;

        if (!entityId || !entityType) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'entityId and entityType are required',
                code: 'VALIDATION_ERROR'
            });
        }

        const monitoringConfig = {
            entityType,
            alertOnWarnings: alertOnWarnings || false,
            startedAt: new Date().toISOString(),
            startedBy: req.user?.id || 'system'
        };

        legalComplianceService.activeMonitoring.set(entityId, monitoringConfig);

        res.json({
            success: true,
            message: `Started monitoring ${entityType} ${entityId}`,
            monitoringConfig,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error starting compliance monitoring:', error);
        res.status(500).json({
            error: 'Monitoring start failed',
            message: error.message,
            code: 'MONITORING_START_ERROR'
        });
    }
});

/**
 * @route POST /api/legal-compliance/monitor/stop
 * @desc Stop monitoring an entity for compliance
 * @access Protected
 */
router.post('/monitor/stop', checkServiceReady, async (req, res) => {
    try {
        const { entityId } = req.body;

        if (!entityId) {
            return res.status(400).json({
                error: 'Missing required field',
                message: 'entityId is required',
                code: 'VALIDATION_ERROR'
            });
        }

        const wasMonitoring = legalComplianceService.activeMonitoring.has(entityId);
        legalComplianceService.activeMonitoring.delete(entityId);

        res.json({
            success: true,
            message: wasMonitoring ? 
                `Stopped monitoring ${entityId}` : 
                `${entityId} was not being monitored`,
            wasMonitoring,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error stopping compliance monitoring:', error);
        res.status(500).json({
            error: 'Monitoring stop failed',
            message: error.message,
            code: 'MONITORING_STOP_ERROR'
        });
    }
});

/**
 * @route GET /api/legal-compliance/alerts
 * @desc Get recent compliance alerts
 * @access Protected
 */
router.get('/alerts', checkServiceReady, async (req, res) => {
    try {
        const { limit = 50, severity, entityId } = req.query;
        let alerts = legalComplianceService.complianceAlerts || [];

        // Filter by severity
        if (severity) {
            alerts = alerts.filter(alert => alert.severity === severity);
        }

        // Filter by entity ID
        if (entityId) {
            alerts = alerts.filter(alert => alert.entityId === entityId);
        }

        // Sort by timestamp (newest first) and limit
        alerts = alerts
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, parseInt(limit));

        res.json({
            alertCount: alerts.length,
            alerts,
            retrieved: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error retrieving compliance alerts:', error);
        res.status(500).json({
            error: 'Alerts retrieval failed',
            message: error.message,
            code: 'ALERTS_RETRIEVAL_ERROR'
        });
    }
});

/**
 * @route POST /api/legal-compliance/bulk/check
 * @desc Bulk compliance check for multiple entities
 * @access Protected
 */
router.post('/bulk/check', checkServiceReady, async (req, res) => {
    try {
        const { entities } = req.body;

        if (!entities || !Array.isArray(entities)) {
            return res.status(400).json({
                error: 'Invalid entities data',
                message: 'entities must be an array',
                code: 'VALIDATION_ERROR'
            });
        }

        const results = [];
        const errors = [];

        for (const entity of entities) {
            try {
                let result;
                
                switch (entity.type) {
                    case 'communication':
                        result = await legalComplianceService.checkCommunicationCompliance(entity.data);
                        break;
                    case 'claim':
                        result = await legalComplianceService.validateClaimCompliance(entity.data);
                        break;
                    case 'document':
                        result = await legalComplianceService.analyzeDocumentCompliance(entity.data);
                        break;
                    default:
                        throw new Error(`Unsupported entity type: ${entity.type}`);
                }

                results.push({
                    entityId: entity.id || entity.data.id,
                    type: entity.type,
                    success: true,
                    result
                });

            } catch (error) {
                errors.push({
                    entityId: entity.id || entity.data.id,
                    type: entity.type,
                    success: false,
                    error: error.message
                });
            }
        }

        res.json({
            totalEntities: entities.length,
            successCount: results.length,
            errorCount: errors.length,
            results,
            errors,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error performing bulk compliance check:', error);
        res.status(500).json({
            error: 'Bulk check failed',
            message: error.message,
            code: 'BULK_CHECK_ERROR'
        });
    }
});

/**
 * @route GET /api/legal-compliance/reports/summary
 * @desc Get compliance summary report
 * @access Protected
 */
router.get('/reports/summary', checkServiceReady, async (req, res) => {
    try {
        const { startDate, endDate, state } = req.query;

        const summaryReport = {
            reportPeriod: {
                start: startDate || null,
                end: endDate || null,
                state: state || 'all'
            },
            overallMetrics: legalComplianceService.getComplianceMetrics(),
            alertsSummary: {
                total: (legalComplianceService.complianceAlerts || []).length,
                bySeverity: {},
                recent: (legalComplianceService.complianceAlerts || [])
                    .slice(-10)
                    .reverse()
            },
            topViolationTypes: {},
            complianceScoreDistribution: {},
            generatedAt: new Date().toISOString()
        };

        // Calculate alerts by severity
        (legalComplianceService.complianceAlerts || []).forEach(alert => {
            summaryReport.alertsSummary.bySeverity[alert.severity] = 
                (summaryReport.alertsSummary.bySeverity[alert.severity] || 0) + 1;
        });

        res.json({
            success: true,
            summaryReport,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error generating summary report:', error);
        res.status(500).json({
            error: 'Report generation failed',
            message: error.message,
            code: 'REPORT_GENERATION_ERROR'
        });
    }
});

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Legal Compliance API Error:', error);
    res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred in the Legal Compliance Service',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString()
    });
});

export default router;