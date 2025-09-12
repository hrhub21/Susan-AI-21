import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { DynamicTemplateGenerationService } from '../services/DynamicTemplateGenerationService.js';

/**
 * Template Controller
 * Handles all dynamic template generation API endpoints
 */
export class TemplateController {
    constructor() {
        this.templateService = new DynamicTemplateGenerationService();
        this.initializeService();
    }

    async initializeService() {
        try {
            await this.templateService.initialize();
            console.log('✅ Template service initialized in controller');
        } catch (error) {
            console.error('❌ Failed to initialize template service:', error);
        }
    }

    /**
     * Generate a dynamic template
     * POST /api/v1/templates/generate
     */
    async generateTemplate(req, res) {
        try {
            const {
                templateType,
                claimDetails,
                adjusterId,
                previousCommunications = [],
                urgencyLevel = 'normal',
                customRequirements = {}
            } = req.body;

            // Validate required fields
            if (!templateType) {
                throw new ApiError('Template type is required', 400);
            }

            if (!claimDetails || !claimDetails.claimId) {
                throw new ApiError('Claim details with claim ID are required', 400);
            }

            // Generate template
            const result = await this.templateService.generateTemplate({
                templateType,
                claimDetails,
                adjusterId,
                previousCommunications,
                urgencyLevel,
                customRequirements
            });

            // Log successful generation
            logger.info('Template generated successfully', {
                templateId: result.template.id,
                templateType,
                adjusterId,
                claimId: claimDetails.claimId,
                confidence: result.analytics.confidence
            });

            res.status(201).json({
                success: true,
                data: result,
                message: 'Template generated successfully',
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            });

        } catch (error) {
            logger.apiError(error, req);
            
            if (error instanceof ApiError) {
                throw error;
            }
            
            throw new ApiError(
                `Template generation failed: ${error.message}`,
                500,
                'TEMPLATE_GENERATION_ERROR'
            );
        }
    }

    /**
     * Learn from template performance
     * POST /api/v1/templates/:templateId/performance
     */
    async submitPerformance(req, res) {
        try {
            const { templateId } = req.params;
            const performanceData = req.body;

            if (!templateId) {
                throw new ApiError('Template ID is required', 400);
            }

            // Learn from performance data
            const result = await this.templateService.learnFromPerformance(templateId, performanceData);

            logger.info('Template performance data submitted', {
                templateId,
                performanceScore: result.performanceScore,
                insights: result.insights?.length || 0
            });

            res.json({
                success: true,
                data: result,
                message: 'Performance data processed successfully',
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            });

        } catch (error) {
            logger.apiError(error, req);
            
            if (error instanceof ApiError) {
                throw error;
            }
            
            throw new ApiError(
                `Performance learning failed: ${error.message}`,
                500,
                'PERFORMANCE_LEARNING_ERROR'
            );
        }
    }

    /**
     * Get template analytics
     * GET /api/v1/templates/analytics
     */
    async getAnalytics(req, res) {
        try {
            const {
                templateType,
                adjusterId,
                startDate,
                endDate,
                claimValueMin,
                claimValueMax,
                damageType,
                page = 1,
                limit = 100
            } = req.query;

            // Build filters
            const filters = {};
            if (templateType) filters.templateType = templateType;
            if (adjusterId) filters.adjusterId = adjusterId;
            if (startDate && endDate) {
                filters.dateRange = { start: startDate, end: endDate };
            }
            if (claimValueMin || claimValueMax) {
                filters.claimValueRange = {
                    min: claimValueMin ? parseInt(claimValueMin) : 0,
                    max: claimValueMax ? parseInt(claimValueMax) : Infinity
                };
            }
            if (damageType) filters.damageType = damageType;

            // Get analytics
            const analytics = await this.templateService.getTemplateAnalytics(filters);

            logger.info('Template analytics retrieved', {
                filters,
                templateCount: analytics.overview.totalTemplates,
                interactionCount: analytics.overview.totalInteractions
            });

            res.json({
                success: true,
                data: analytics,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: analytics.overview.totalTemplates
                },
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            });

        } catch (error) {
            logger.apiError(error, req);
            throw new ApiError(
                `Analytics retrieval failed: ${error.message}`,
                500,
                'ANALYTICS_ERROR'
            );
        }
    }

    /**
     * Get template types and their configurations
     * GET /api/v1/templates/types
     */
    async getTemplateTypes(req, res) {
        try {
            const templateTypes = this.templateService.templateTypes;
            
            res.json({
                success: true,
                data: {
                    templateTypes: Object.entries(templateTypes).map(([key, config]) => ({
                        type: key,
                        ...config
                    }))
                },
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            });

        } catch (error) {
            logger.apiError(error, req);
            throw new ApiError(
                `Template types retrieval failed: ${error.message}`,
                500,
                'TEMPLATE_TYPES_ERROR'
            );
        }
    }

    /**
     * Start A/B test for template optimization
     * POST /api/v1/templates/ab-tests
     */
    async startABTest(req, res) {
        try {
            const {
                name,
                description,
                templateType,
                variants = [],
                targetAudience = {},
                duration = 30,
                successMetrics = ['approval_rate', 'response_time'],
                minimumSampleSize = 50
            } = req.body;

            // Validate required fields
            if (!name || !templateType || variants.length < 2) {
                throw new ApiError('Name, template type, and at least 2 variants are required', 400);
            }

            // Start A/B test
            const result = await this.templateService.startABTest({
                name,
                description,
                templateType,
                variants,
                targetAudience,
                duration,
                successMetrics,
                minimumSampleSize
            });

            logger.info('A/B test started', {
                testId: result.testId,
                templateType,
                variantCount: variants.length,
                duration
            });

            res.status(201).json({
                success: true,
                data: result,
                message: 'A/B test started successfully',
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            });

        } catch (error) {
            logger.apiError(error, req);
            
            if (error instanceof ApiError) {
                throw error;
            }
            
            throw new ApiError(
                `A/B test creation failed: ${error.message}`,
                500,
                'AB_TEST_ERROR'
            );
        }
    }

    /**
     * Get A/B test results
     * GET /api/v1/templates/ab-tests
     */
    async getABTests(req, res) {
        try {
            const {
                status,
                templateType,
                testId
            } = req.query;

            const filters = {};
            if (status) filters.status = status;
            if (templateType) filters.templateType = templateType;
            if (testId) filters.testId = testId;

            const tests = await this.templateService.getABTests(filters);

            logger.info('A/B tests retrieved', {
                filters,
                activeCount: tests.summary.activeCount,
                completedCount: tests.summary.completedCount
            });

            res.json({
                success: true,
                data: tests,
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            });

        } catch (error) {
            logger.apiError(error, req);
            throw new ApiError(
                `A/B tests retrieval failed: ${error.message}`,
                500,
                'AB_TEST_RETRIEVAL_ERROR'
            );
        }
    }

    /**
     * Stop an active A/B test
     * POST /api/v1/templates/ab-tests/:testId/stop
     */
    async stopABTest(req, res) {
        try {
            const { testId } = req.params;
            const { reason = 'Manual stop' } = req.body;

            if (!testId) {
                throw new ApiError('Test ID is required', 400);
            }

            const result = await this.templateService.stopABTest(testId, reason);

            logger.info('A/B test stopped', {
                testId,
                reason,
                finalResults: result.finalResults
            });

            res.json({
                success: true,
                data: result,
                message: 'A/B test stopped successfully',
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            });

        } catch (error) {
            logger.apiError(error, req);
            
            if (error instanceof ApiError) {
                throw error;
            }
            
            throw new ApiError(
                `A/B test stop failed: ${error.message}`,
                500,
                'AB_TEST_STOP_ERROR'
            );
        }
    }

    /**
     * Get template recommendations for specific context
     * POST /api/v1/templates/recommendations
     */
    async getRecommendations(req, res) {
        try {
            const {
                claimDetails,
                adjusterId,
                communicationHistory = [],
                goalType = 'approval'
            } = req.body;

            if (!claimDetails) {
                throw new ApiError('Claim details are required', 400);
            }

            const recommendations = await this.templateService.getTemplateRecommendations({
                claimDetails,
                adjusterId,
                communicationHistory,
                goalType
            });

            logger.info('Template recommendations generated', {
                adjusterId,
                claimId: claimDetails.claimId,
                recommendationCount: recommendations.templates?.length || 0
            });

            res.json({
                success: true,
                data: recommendations,
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            });

        } catch (error) {
            logger.apiError(error, req);
            throw new ApiError(
                `Recommendation generation failed: ${error.message}`,
                500,
                'RECOMMENDATION_ERROR'
            );
        }
    }

    /**
     * Get performance dashboard
     * GET /api/v1/templates/dashboard
     */
    async getDashboard(req, res) {
        try {
            const {
                timeframe = '30d',
                adjusterId,
                templateType
            } = req.query;

            const dashboard = await this.templateService.getPerformanceDashboard({
                timeframe,
                adjusterId,
                templateType
            });

            res.json({
                success: true,
                data: dashboard,
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            });

        } catch (error) {
            logger.apiError(error, req);
            throw new ApiError(
                `Dashboard retrieval failed: ${error.message}`,
                500,
                'DASHBOARD_ERROR'
            );
        }
    }

    /**
     * Export template data
     * GET /api/v1/templates/export
     */
    async exportTemplateData(req, res) {
        try {
            const {
                format = 'json',
                templateType,
                adjusterId,
                startDate,
                endDate,
                includePerformance = 'true'
            } = req.query;

            const filters = {};
            if (templateType) filters.templateType = templateType;
            if (adjusterId) filters.adjusterId = adjusterId;
            if (startDate && endDate) {
                filters.dateRange = { start: startDate, end: endDate };
            }

            const exportData = await this.templateService.exportTemplateData({
                filters,
                format,
                includePerformance: includePerformance === 'true'
            });

            // Set appropriate headers for download
            res.setHeader('Content-Disposition', `attachment; filename=template-data-${Date.now()}.${format}`);
            res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');

            res.send(exportData);

        } catch (error) {
            logger.apiError(error, req);
            throw new ApiError(
                `Template data export failed: ${error.message}`,
                500,
                'EXPORT_ERROR'
            );
        }
    }

    /**
     * Get template by ID
     * GET /api/v1/templates/:templateId
     */
    async getTemplateById(req, res) {
        try {
            const { templateId } = req.params;
            const { includePerformance = 'false' } = req.query;

            if (!templateId) {
                throw new ApiError('Template ID is required', 400);
            }

            const template = await this.templateService.getTemplateById(templateId, {
                includePerformance: includePerformance === 'true'
            });

            if (!template) {
                throw new ApiError('Template not found', 404);
            }

            res.json({
                success: true,
                data: template,
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            });

        } catch (error) {
            logger.apiError(error, req);
            
            if (error instanceof ApiError) {
                throw error;
            }
            
            throw new ApiError(
                `Template retrieval failed: ${error.message}`,
                500,
                'TEMPLATE_RETRIEVAL_ERROR'
            );
        }
    }

    /**
     * Bulk generate templates
     * POST /api/v1/templates/bulk-generate
     */
    async bulkGenerate(req, res) {
        try {
            const { requests = [] } = req.body;

            if (!Array.isArray(requests) || requests.length === 0) {
                throw new ApiError('Array of template requests is required', 400);
            }

            if (requests.length > 50) {
                throw new ApiError('Maximum 50 templates can be generated in bulk', 400);
            }

            const results = await this.templateService.bulkGenerateTemplates(requests);

            logger.info('Bulk template generation completed', {
                requestCount: requests.length,
                successCount: results.successful.length,
                failureCount: results.failed.length
            });

            res.status(201).json({
                success: true,
                data: results,
                message: `Generated ${results.successful.length} of ${requests.length} templates`,
                timestamp: new Date().toISOString(),
                requestId: req.requestId
            });

        } catch (error) {
            logger.apiError(error, req);
            
            if (error instanceof ApiError) {
                throw error;
            }
            
            throw new ApiError(
                `Bulk generation failed: ${error.message}`,
                500,
                'BULK_GENERATION_ERROR'
            );
        }
    }

    // Helper method to get user ID from request
    getUserId(req) {
        return req.user?.id || req.headers['x-user-id'] || 'anonymous';
    }

    // Helper method to validate pagination parameters
    validatePagination(page, limit) {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 20;
        
        if (pageNum < 1) {
            throw new ApiError('Page must be greater than 0', 400);
        }
        
        if (limitNum < 1 || limitNum > 100) {
            throw new ApiError('Limit must be between 1 and 100', 400);
        }
        
        return { page: pageNum, limit: limitNum };
    }
}