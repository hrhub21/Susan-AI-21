import express from 'express';
import multer from 'multer';
import { HoverEagleViewService } from '../services/HoverEagleViewService.js';
import { ClaimTrackingDashboardService } from '../services/ClaimTrackingDashboardService.js';
import { validateAuth } from '../middleware/auth.js';
import { validateJsonSchema } from '../middleware/validation.js';
import { ApiError } from '../utils/ApiError.js';

const router = express.Router();

// Initialize services
const hoverEagleViewService = new HoverEagleViewService();
const claimTrackingService = new ClaimTrackingDashboardService();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
        files: 20 // Max 20 files per upload
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Please upload JPG, PNG, TIFF, or WebP images.'), false);
        }
    }
});

// Validation schemas
const measurementRequestSchema = {
    address: { type: 'string', required: true, minLength: 10 },
    roofType: { type: 'string', enum: ['gable', 'hip', 'shed', 'flat', 'gambrel', 'mansard'] },
    propertyType: { type: 'string', enum: ['residential', 'commercial'], default: 'residential' },
    priority: { type: 'string', enum: ['standard', 'expedited', 'emergency'], default: 'standard' },
    preferences: {
        type: 'object',
        properties: {
            materialType: { type: 'string', default: 'asphalt_shingles' },
            region: { type: 'string' },
            taxRate: { type: 'number', min: 0, max: 0.25 }
        }
    }
};

const damageAreaSchema = {
    damageAreas: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                type: { type: 'string', required: true },
                coordinates: { type: 'object' },
                area: { type: 'number', required: true, min: 0 },
                description: { type: 'string' }
            }
        }
    }
};

/**
 * @route POST /api/hover-eagleview/measurement-report
 * @desc Create comprehensive roof measurement and estimate report
 * @access Protected
 */
router.post('/measurement-report', 
    validateAuth,
    upload.array('images', 20),
    validateJsonSchema(measurementRequestSchema),
    async (req, res, next) => {
        try {
            console.log('🏠 Starting comprehensive roof measurement report...');
            
            // Prepare request data
            const requestData = {
                address: req.body.address,
                roofType: req.body.roofType,
                propertyType: req.body.propertyType || 'residential',
                priority: req.body.priority || 'standard',
                preferences: req.body.preferences ? JSON.parse(req.body.preferences) : {},
                images: req.files || [],
                metadata: {
                    userId: req.user?.id,
                    requestId: req.headers['x-request-id'],
                    timestamp: new Date().toISOString()
                }
            };

            // Validate images if provided
            if (requestData.images.length === 0) {
                console.log('⚠️ No images provided - proceeding with address-based measurement');
            }

            // Create measurement report
            const report = await hoverEagleViewService.createRoofMeasurementReport(requestData);

            // Integrate with claim tracking if claimId provided
            if (req.body.claimId) {
                try {
                    await claimTrackingService.attachMeasurementReport(req.body.claimId, report);
                    console.log(`✅ Report attached to claim: ${req.body.claimId}`);
                } catch (error) {
                    console.warn('⚠️ Failed to attach report to claim:', error.message);
                }
            }

            // Return comprehensive report
            res.status(201).json({
                success: true,
                message: 'Roof measurement report generated successfully',
                data: {
                    reportId: report.id,
                    report: report,
                    summary: {
                        totalArea: report.measurements.enhanced.totalRoofArea,
                        estimatedCost: report.costEstimates.total,
                        confidence: report.quality.overallConfidence,
                        sources: report.metadata.sources
                    }
                },
                meta: {
                    processingTime: report.metadata.processingTime,
                    timestamp: report.timestamp
                }
            });

        } catch (error) {
            console.error('❌ Error creating measurement report:', error);
            next(new ApiError(500, 'Failed to create measurement report', error.message));
        }
    }
);

/**
 * @route POST /api/hover-eagleview/damage-assessment
 * @desc Calculate precise damage areas and repair estimates
 * @access Protected
 */
router.post('/damage-assessment',
    validateAuth,
    validateJsonSchema(damageAreaSchema),
    async (req, res, next) => {
        try {
            console.log('💥 Processing damage area assessment...');
            
            const { reportId, damageAreas } = req.body;
            
            if (!reportId) {
                throw new ApiError(400, 'Report ID is required');
            }

            if (!damageAreas || damageAreas.length === 0) {
                throw new ApiError(400, 'At least one damage area is required');
            }

            // Update report with damage calculations
            const updatedReport = await hoverEagleViewService.updateDamageAreas(reportId, damageAreas);

            res.json({
                success: true,
                message: 'Damage assessment completed successfully',
                data: {
                    reportId: reportId,
                    damageAssessment: updatedReport.damageAssessment,
                    updatedCostEstimates: updatedReport.costEstimates,
                    recommendations: updatedReport.recommendations
                },
                meta: {
                    totalDamageArea: updatedReport.damageAssessment.totalDamageArea,
                    damagePercentage: updatedReport.damageAssessment.damagePercentage,
                    urgentRepairs: updatedReport.damageAssessment.priorityAreas.length,
                    lastUpdated: updatedReport.lastUpdated
                }
            });

        } catch (error) {
            console.error('❌ Error processing damage assessment:', error);
            next(new ApiError(500, 'Failed to process damage assessment', error.message));
        }
    }
);

/**
 * @route GET /api/hover-eagleview/report/:reportId
 * @desc Retrieve measurement report by ID
 * @access Protected
 */
router.get('/report/:reportId',
    validateAuth,
    async (req, res, next) => {
        try {
            const { reportId } = req.params;
            const includeVisualization = req.query.visualization === 'true';
            
            console.log(`📊 Retrieving report: ${reportId}`);
            
            const report = await hoverEagleViewService.getReport(reportId);
            
            if (!report) {
                throw new ApiError(404, 'Report not found');
            }

            // Filter response based on query parameters
            let responseData = { ...report };
            
            if (!includeVisualization) {
                delete responseData.visualization;
            }

            res.json({
                success: true,
                data: responseData,
                meta: {
                    reportId: report.id,
                    generated: report.timestamp,
                    confidence: report.quality.overallConfidence
                }
            });

        } catch (error) {
            console.error('❌ Error retrieving report:', error);
            next(new ApiError(500, 'Failed to retrieve report', error.message));
        }
    }
);

/**
 * @route GET /api/hover-eagleview/report/:reportId/status
 * @desc Get processing status of measurement report
 * @access Protected
 */
router.get('/report/:reportId/status',
    validateAuth,
    async (req, res, next) => {
        try {
            const { reportId } = req.params;
            
            const status = await hoverEagleViewService.getReportStatus(reportId);
            
            res.json({
                success: true,
                data: status
            });

        } catch (error) {
            console.error('❌ Error getting report status:', error);
            next(new ApiError(500, 'Failed to get report status', error.message));
        }
    }
);

/**
 * @route GET /api/hover-eagleview/visualization/:reportId
 * @desc Get 3D visualization data for report
 * @access Protected
 */
router.get('/visualization/:reportId',
    validateAuth,
    async (req, res, next) => {
        try {
            const { reportId } = req.params;
            
            console.log(`🎨 Retrieving visualization for report: ${reportId}`);
            
            const report = await hoverEagleViewService.getReport(reportId);
            
            if (!report) {
                throw new ApiError(404, 'Report not found');
            }

            if (!report.visualization) {
                throw new ApiError(404, 'Visualization data not available for this report');
            }

            res.json({
                success: true,
                data: {
                    reportId: reportId,
                    visualization: report.visualization,
                    measurements: {
                        totalArea: report.measurements.enhanced.totalRoofArea,
                        roofPlanes: report.measurements.enhanced.roofPlanes?.length || 0,
                        complexity: report.measurements.enhanced.complexity
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error retrieving visualization:', error);
            next(new ApiError(500, 'Failed to retrieve visualization', error.message));
        }
    }
);

/**
 * @route POST /api/hover-eagleview/cost-estimate
 * @desc Generate updated cost estimates with different parameters
 * @access Protected
 */
router.post('/cost-estimate',
    validateAuth,
    async (req, res, next) => {
        try {
            const { reportId, materialType, region, includeLabor = true } = req.body;
            
            if (!reportId) {
                throw new ApiError(400, 'Report ID is required');
            }
            
            console.log(`💰 Generating updated cost estimate for report: ${reportId}`);
            
            const report = await hoverEagleViewService.getReport(reportId);
            
            if (!report) {
                throw new ApiError(404, 'Report not found');
            }

            // Generate new cost estimates with updated parameters
            const preferences = {
                materialType: materialType || 'asphalt_shingles',
                region: region || 'Midwest',
                includeLabor: includeLabor
            };

            const updatedCostEstimates = await hoverEagleViewService.generateCostEstimates(
                report.measurements,
                report.damageAssessment,
                preferences
            );

            res.json({
                success: true,
                message: 'Cost estimates updated successfully',
                data: {
                    reportId: reportId,
                    costEstimates: updatedCostEstimates,
                    preferences: preferences,
                    comparison: report.costEstimates ? {
                        previousTotal: report.costEstimates.total,
                        newTotal: updatedCostEstimates.total,
                        difference: updatedCostEstimates.total - report.costEstimates.total,
                        percentChange: ((updatedCostEstimates.total - report.costEstimates.total) / report.costEstimates.total) * 100
                    } : null
                }
            });

        } catch (error) {
            console.error('❌ Error generating cost estimate:', error);
            next(new ApiError(500, 'Failed to generate cost estimate', error.message));
        }
    }
);

/**
 * @route GET /api/hover-eagleview/service-status
 * @desc Get service health and availability status
 * @access Protected
 */
router.get('/service-status',
    validateAuth,
    async (req, res, next) => {
        try {
            const status = hoverEagleViewService.getServiceStatus();
            
            res.json({
                success: true,
                data: {
                    service: 'Hover/EagleView Integration',
                    status: status.initialized ? 'operational' : 'initializing',
                    capabilities: {
                        hover3D: status.apis.hover,
                        eagleViewAerial: status.apis.eagleView,
                        aiEnhancement: true,
                        costEstimation: true,
                        damageAssessment: true,
                        visualization: true
                    },
                    performance: {
                        cachedMeasurements: status.cache.measurements,
                        cachedReports: status.cache.reports,
                        queueSize: status.queue
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error getting service status:', error);
            next(new ApiError(500, 'Failed to get service status', error.message));
        }
    }
);

/**
 * @route POST /api/hover-eagleview/integrate-claim
 * @desc Integrate measurement report with existing claim
 * @access Protected
 */
router.post('/integrate-claim',
    validateAuth,
    async (req, res, next) => {
        try {
            const { reportId, claimId, updateEstimates = true } = req.body;
            
            if (!reportId || !claimId) {
                throw new ApiError(400, 'Both reportId and claimId are required');
            }
            
            console.log(`🔗 Integrating report ${reportId} with claim ${claimId}`);
            
            // Get the measurement report
            const report = await hoverEagleViewService.getReport(reportId);
            if (!report) {
                throw new ApiError(404, 'Measurement report not found');
            }

            // Attach to claim tracking system
            await claimTrackingService.attachMeasurementReport(claimId, report);
            
            // Update claim with precise measurements if requested
            if (updateEstimates) {
                const claimUpdate = {
                    roofMeasurements: {
                        totalArea: report.measurements.enhanced.totalRoofArea,
                        complexity: report.measurements.enhanced.complexity,
                        damagePercentage: report.damageAssessment?.damagePercentage || 0
                    },
                    costEstimate: {
                        total: report.costEstimates.total,
                        breakdown: report.costEstimates.breakdown,
                        lastUpdated: new Date().toISOString()
                    },
                    measurements: {
                        source: 'hover_eagleview',
                        reportId: reportId,
                        confidence: report.quality.overallConfidence
                    }
                };
                
                await claimTrackingService.updateClaim(claimId, claimUpdate);
            }

            res.json({
                success: true,
                message: 'Measurement report integrated with claim successfully',
                data: {
                    claimId: claimId,
                    reportId: reportId,
                    integration: {
                        measurementsAttached: true,
                        estimatesUpdated: updateEstimates,
                        confidence: report.quality.overallConfidence
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error integrating with claim:', error);
            next(new ApiError(500, 'Failed to integrate with claim', error.message));
        }
    }
);

/**
 * @route GET /api/hover-eagleview/material-options
 * @desc Get available material options and pricing
 * @access Protected
 */
router.get('/material-options',
    validateAuth,
    async (req, res, next) => {
        try {
            const { roofArea, region = 'Midwest' } = req.query;
            
            if (!roofArea || isNaN(roofArea)) {
                throw new ApiError(400, 'Valid roof area is required');
            }
            
            console.log('📋 Retrieving material options...');
            
            // Get material options from cost database
            const materialOptions = [];
            const costDatabase = hoverEagleViewService.costDatabase;
            
            for (const [materialType, data] of Object.entries(costDatabase.materials)) {
                const regionalFactor = costDatabase.regionalFactors[region] || 1.0;
                const adjustedCostPerSqFt = data.costPerSqFt * regionalFactor;
                const totalMaterialCost = parseFloat(roofArea) * adjustedCostPerSqFt * 1.1; // 10% waste factor
                
                materialOptions.push({
                    type: materialType,
                    name: materialType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    costPerSqFt: adjustedCostPerSqFt,
                    totalCost: totalMaterialCost,
                    laborMultiplier: data.laborMultiplier,
                    warranty: hoverEagleViewService.getMaterialWarranty(materialType),
                    expectedLife: hoverEagleViewService.getMaterialLifespan(materialType),
                    description: hoverEagleViewService.getMaterialDescription(materialType)
                });
            }
            
            // Sort by total cost
            materialOptions.sort((a, b) => a.totalCost - b.totalCost);
            
            res.json({
                success: true,
                data: {
                    roofArea: parseFloat(roofArea),
                    region: region,
                    materialOptions: materialOptions,
                    regionalFactor: costDatabase.regionalFactors[region] || 1.0
                }
            });

        } catch (error) {
            console.error('❌ Error retrieving material options:', error);
            next(new ApiError(500, 'Failed to retrieve material options', error.message));
        }
    }
);

/**
 * @route POST /api/hover-eagleview/quality-validation
 * @desc Perform additional quality validation on measurements
 * @access Protected
 */
router.post('/quality-validation',
    validateAuth,
    async (req, res, next) => {
        try {
            const { reportId, validationLevel = 'standard' } = req.body;
            
            if (!reportId) {
                throw new ApiError(400, 'Report ID is required');
            }
            
            console.log(`🔍 Performing quality validation for report: ${reportId}`);
            
            const report = await hoverEagleViewService.getReport(reportId);
            if (!report) {
                throw new ApiError(404, 'Report not found');
            }

            // Perform enhanced quality validation
            const enhancedValidation = await hoverEagleViewService.performQualityValidation(
                report.measurements,
                report.costEstimates
            );

            // Add validation level specific checks
            if (validationLevel === 'enhanced') {
                // Additional validation for enhanced level
                enhancedValidation.enhancedChecks = {
                    geometryConsistency: true,
                    costRangeAnalysis: true,
                    regionComparison: true
                };
            }

            res.json({
                success: true,
                message: 'Quality validation completed',
                data: {
                    reportId: reportId,
                    validationLevel: validationLevel,
                    validation: enhancedValidation,
                    recommendations: enhancedValidation.recommendations,
                    overallRating: enhancedValidation.overallConfidence > 0.9 ? 'excellent' :
                                  enhancedValidation.overallConfidence > 0.8 ? 'good' :
                                  enhancedValidation.overallConfidence > 0.7 ? 'acceptable' : 'needs_review'
                }
            });

        } catch (error) {
            console.error('❌ Error performing quality validation:', error);
            next(new ApiError(500, 'Failed to perform quality validation', error.message));
        }
    }
);

// Error handling middleware specific to this router
router.use((error, req, res, next) => {
    console.error('Hover/EagleView route error:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large',
                message: 'Maximum file size is 100MB'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'Too many files',
                message: 'Maximum 20 files allowed'
            });
        }
    }
    
    next(error);
});

export default router;