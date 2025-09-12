import express from 'express';
import { TemplateController } from '../controllers/TemplateController.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { validateJsonSchema } from '../middleware/validation.js';

const router = express.Router();
const templateController = new TemplateController();

// Validation schemas for request bodies
const templateGenerationSchema = {
    type: 'object',
    properties: {
        templateType: {
            type: 'string',
            enum: ['initial_contact', 'follow_up', 'supplemental_request', 'negotiation', 'escalation', 'closure']
        },
        claimDetails: {
            type: 'object',
            properties: {
                claimId: { type: 'string' },
                claimNumber: { type: 'string' },
                claimValue: { type: 'number', minimum: 0 },
                damageType: { 
                    type: 'string',
                    enum: ['wind', 'hail', 'water', 'structural', 'cosmetic', 'fire', 'other']
                },
                propertyAddress: { type: 'string' },
                policyNumber: { type: 'string' },
                dateOfLoss: { type: 'string', format: 'date' },
                complexity: {
                    type: 'string',
                    enum: ['low', 'medium', 'high', 'critical']
                },
                urgency: {
                    type: 'string',
                    enum: ['low', 'normal', 'high', 'critical']
                },
                weatherConditions: { type: 'string' },
                multipleBuildings: { type: 'boolean' },
                disputedItems: { type: 'array', items: { type: 'string' } },
                waterDamage: { type: 'boolean' },
                structuralSafety: { type: 'boolean' },
                recentStorm: { type: 'boolean' },
                deadlines: { type: 'array', items: { type: 'string' } }
            },
            required: ['claimId'],
            additionalProperties: true
        },
        adjusterId: { type: 'string' },
        previousCommunications: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    date: { type: 'string', format: 'date-time' },
                    type: { type: 'string' },
                    outcome: { type: 'string' },
                    responseTime: { type: 'number' }
                }
            }
        },
        urgencyLevel: {
            type: 'string',
            enum: ['low', 'normal', 'high', 'critical'],
            default: 'normal'
        },
        customRequirements: {
            type: 'object',
            additionalProperties: true
        }
    },
    required: ['templateType', 'claimDetails'],
    additionalProperties: false
};

const performanceDataSchema = {
    type: 'object',
    properties: {
        responseReceived: { type: 'boolean', default: false },
        responseTime: { type: 'number', minimum: 0 },
        approved: { type: 'boolean', default: false },
        settlementRatio: { type: 'number', minimum: 0, maximum: 100 },
        adjusterFeedback: { type: 'string' },
        escalationOccurred: { type: 'boolean', default: false },
        finalOutcome: {
            type: 'string',
            enum: ['pending', 'approved', 'denied', 'negotiating', 'escalated', 'settled']
        },
        communicationQuality: { type: 'number', minimum: 1, maximum: 10 },
        relationshipImpact: {
            type: 'string',
            enum: ['positive', 'neutral', 'negative']
        }
    },
    additionalProperties: true
};

const abTestSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        description: { type: 'string', maxLength: 500 },
        templateType: {
            type: 'string',
            enum: ['initial_contact', 'follow_up', 'supplemental_request', 'negotiation', 'escalation', 'closure']
        },
        variants: {
            type: 'array',
            minItems: 2,
            maxItems: 5,
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    changes: { type: 'object' },
                    trafficPercentage: { type: 'number', minimum: 0, maximum: 100 }
                },
                required: ['name', 'changes']
            }
        },
        targetAudience: {
            type: 'object',
            properties: {
                adjusterTypes: { type: 'array', items: { type: 'string' } },
                claimValueRange: {
                    type: 'object',
                    properties: {
                        min: { type: 'number', minimum: 0 },
                        max: { type: 'number', minimum: 0 }
                    }
                },
                damageTypes: { type: 'array', items: { type: 'string' } }
            }
        },
        duration: { type: 'number', minimum: 1, maximum: 90, default: 30 },
        successMetrics: {
            type: 'array',
            items: {
                type: 'string',
                enum: ['approval_rate', 'response_time', 'response_rate', 'settlement_ratio', 'relationship_score']
            },
            default: ['approval_rate', 'response_time']
        },
        minimumSampleSize: { type: 'number', minimum: 10, maximum: 1000, default: 50 }
    },
    required: ['name', 'templateType', 'variants'],
    additionalProperties: false
};

// Apply middleware
router.use(rateLimitMiddleware);

// Template generation endpoints
/**
 * @swagger
 * /api/v1/templates/generate:
 *   post:
 *     summary: Generate a dynamic template
 *     description: Generate a personalized communication template based on claim details and adjuster intelligence
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TemplateGenerationRequest'
 *     responses:
 *       201:
 *         description: Template generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemplateGenerationResponse'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Template generation failed
 */
router.post('/generate', 
    authMiddleware,
    validateJsonSchema(templateGenerationSchema),
    async (req, res, next) => {
        try {
            await templateController.generateTemplate(req, res);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/templates/bulk-generate:
 *   post:
 *     summary: Generate multiple templates in bulk
 *     description: Generate up to 50 templates in a single request
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               requests:
 *                 type: array
 *                 maxItems: 50
 *                 items:
 *                   $ref: '#/components/schemas/TemplateGenerationRequest'
 *     responses:
 *       201:
 *         description: Bulk generation completed
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication required
 */
router.post('/bulk-generate',
    authMiddleware,
    async (req, res, next) => {
        try {
            await templateController.bulkGenerate(req, res);
        } catch (error) {
            next(error);
        }
    }
);

// Template performance and learning endpoints
/**
 * @swagger
 * /api/v1/templates/{templateId}/performance:
 *   post:
 *     summary: Submit template performance data
 *     description: Submit performance metrics for machine learning optimization
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PerformanceData'
 *     responses:
 *       200:
 *         description: Performance data processed successfully
 *       400:
 *         description: Invalid performance data
 *       404:
 *         description: Template not found
 */
router.post('/:templateId/performance',
    authMiddleware,
    validateJsonSchema(performanceDataSchema),
    async (req, res, next) => {
        try {
            await templateController.submitPerformance(req, res);
        } catch (error) {
            next(error);
        }
    }
);

// Analytics and reporting endpoints
/**
 * @swagger
 * /api/v1/templates/analytics:
 *   get:
 *     summary: Get template performance analytics
 *     description: Retrieve comprehensive analytics on template performance
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: templateType
 *         schema:
 *           type: string
 *         description: Filter by template type
 *       - in: query
 *         name: adjusterId
 *         schema:
 *           type: string
 *         description: Filter by adjuster ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for date range filter
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for date range filter
 *       - in: query
 *         name: claimValueMin
 *         schema:
 *           type: number
 *         description: Minimum claim value filter
 *       - in: query
 *         name: claimValueMax
 *         schema:
 *           type: number
 *         description: Maximum claim value filter
 *       - in: query
 *         name: damageType
 *         schema:
 *           type: string
 *         description: Filter by damage type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Analytics data retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/analytics',
    authMiddleware,
    async (req, res, next) => {
        try {
            await templateController.getAnalytics(req, res);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/templates/dashboard:
 *   get:
 *     summary: Get performance dashboard
 *     description: Get a comprehensive performance dashboard with key metrics
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Timeframe for dashboard data
 *       - in: query
 *         name: adjusterId
 *         schema:
 *           type: string
 *         description: Filter by specific adjuster
 *       - in: query
 *         name: templateType
 *         schema:
 *           type: string
 *         description: Filter by template type
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 */
router.get('/dashboard',
    authMiddleware,
    async (req, res, next) => {
        try {
            await templateController.getDashboard(req, res);
        } catch (error) {
            next(error);
        }
    }
);

// Template configuration endpoints
/**
 * @swagger
 * /api/v1/templates/types:
 *   get:
 *     summary: Get available template types
 *     description: Retrieve all available template types and their configurations
 *     tags: [Templates]
 *     responses:
 *       200:
 *         description: Template types retrieved successfully
 */
router.get('/types', async (req, res, next) => {
    try {
        await templateController.getTemplateTypes(req, res);
    } catch (error) {
        next(error);
    }
});

// Template retrieval endpoints
/**
 * @swagger
 * /api/v1/templates/{templateId}:
 *   get:
 *     summary: Get template by ID
 *     description: Retrieve a specific template by its ID
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *       - in: query
 *         name: includePerformance
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include performance data in response
 *     responses:
 *       200:
 *         description: Template retrieved successfully
 *       404:
 *         description: Template not found
 */
router.get('/:templateId',
    authMiddleware,
    async (req, res, next) => {
        try {
            await templateController.getTemplateById(req, res);
        } catch (error) {
            next(error);
        }
    }
);

// A/B testing endpoints
/**
 * @swagger
 * /api/v1/templates/ab-tests:
 *   post:
 *     summary: Start an A/B test
 *     description: Create and start an A/B test for template optimization
 *     tags: [A/B Testing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ABTestRequest'
 *     responses:
 *       201:
 *         description: A/B test started successfully
 *       400:
 *         description: Invalid test configuration
 */
router.post('/ab-tests',
    authMiddleware,
    validateJsonSchema(abTestSchema),
    async (req, res, next) => {
        try {
            await templateController.startABTest(req, res);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/templates/ab-tests:
 *   get:
 *     summary: Get A/B tests
 *     description: Retrieve A/B tests and their results
 *     tags: [A/B Testing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, paused]
 *         description: Filter by test status
 *       - in: query
 *         name: templateType
 *         schema:
 *           type: string
 *         description: Filter by template type
 *       - in: query
 *         name: testId
 *         schema:
 *           type: string
 *         description: Get specific test by ID
 *     responses:
 *       200:
 *         description: A/B tests retrieved successfully
 */
router.get('/ab-tests',
    authMiddleware,
    async (req, res, next) => {
        try {
            await templateController.getABTests(req, res);
        } catch (error) {
            next(error);
        }
    }
);

/**
 * @swagger
 * /api/v1/templates/ab-tests/{testId}/stop:
 *   post:
 *     summary: Stop an A/B test
 *     description: Stop an active A/B test and finalize results
 *     tags: [A/B Testing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: string
 *         description: Test ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for stopping the test
 *     responses:
 *       200:
 *         description: A/B test stopped successfully
 *       404:
 *         description: Test not found
 */
router.post('/ab-tests/:testId/stop',
    authMiddleware,
    async (req, res, next) => {
        try {
            await templateController.stopABTest(req, res);
        } catch (error) {
            next(error);
        }
    }
);

// Recommendation endpoints
/**
 * @swagger
 * /api/v1/templates/recommendations:
 *   post:
 *     summary: Get template recommendations
 *     description: Get personalized template recommendations for specific context
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               claimDetails:
 *                 $ref: '#/components/schemas/ClaimDetails'
 *               adjusterId:
 *                 type: string
 *               communicationHistory:
 *                 type: array
 *                 items:
 *                   type: object
 *               goalType:
 *                 type: string
 *                 enum: [approval, negotiation, relationship, speed]
 *                 default: approval
 *     responses:
 *       200:
 *         description: Recommendations generated successfully
 */
router.post('/recommendations',
    authMiddleware,
    async (req, res, next) => {
        try {
            await templateController.getRecommendations(req, res);
        } catch (error) {
            next(error);
        }
    }
);

// Export endpoints
/**
 * @swagger
 * /api/v1/templates/export:
 *   get:
 *     summary: Export template data
 *     description: Export template and performance data in various formats
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv, xlsx]
 *           default: json
 *         description: Export format
 *       - in: query
 *         name: templateType
 *         schema:
 *           type: string
 *         description: Filter by template type
 *       - in: query
 *         name: adjusterId
 *         schema:
 *           type: string
 *         description: Filter by adjuster ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter
 *       - in: query
 *         name: includePerformance
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include performance data in export
 *     responses:
 *       200:
 *         description: Data exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *           text/csv:
 *             schema:
 *               type: string
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/export',
    authMiddleware,
    async (req, res, next) => {
        try {
            await templateController.exportTemplateData(req, res);
        } catch (error) {
            next(error);
        }
    }
);

export default router;