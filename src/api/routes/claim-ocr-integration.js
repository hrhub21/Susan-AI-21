import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateParams } from '../middleware/validation.js';
import { fileUploadRateLimit, moderateRateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import OCRClaimIntegrationService from '../services/OCRClaimIntegrationService.js';
import { ClaimTrackingDashboardService } from '../services/ClaimTrackingDashboardService.js';

const router = express.Router();

// Initialize services
const ocrIntegrationService = new OCRClaimIntegrationService();
const claimTrackingService = new ClaimTrackingDashboardService();

// Connect services
ocrIntegrationService.setClaimTrackingService(claimTrackingService);

// Configure multer for insurance document uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = '/tmp/claim_documents';
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `claim-doc-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 5 // Max 5 files per claim
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/tiff',
      'image/bmp'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, `File type ${file.mimetype} not supported. Supported types: ${allowedMimeTypes.join(', ')}`), false);
    }
  }
});

/**
 * @swagger
 * /api/v1/claim-ocr/process-documents:
 *   post:
 *     summary: Process insurance documents for a claim with OCR
 *     description: Upload and process insurance documents with automatic claim integration
 *     tags: [Claim OCR Integration]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: claimId
 *         type: string
 *         required: true
 *         description: ID of the claim to associate documents with
 *       - in: formData
 *         name: documents
 *         type: file
 *         required: true
 *         description: Insurance documents to process
 *       - in: formData
 *         name: documentTypes
 *         type: string
 *         description: Comma-separated expected document types (claim_form,policy_document,estimate_form,inspection_report)
 *       - in: formData
 *         name: autoUpdate
 *         type: boolean
 *         default: true
 *         description: Automatically update claim with extracted data
 *       - in: formData
 *         name: language
 *         type: string
 *         default: en
 *         description: Document language
 *     responses:
 *       200:
 *         description: Documents processed successfully
 *       400:
 *         description: Invalid request or file format
 *       404:
 *         description: Claim not found
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/process-documents',
  fileUploadRateLimit,
  upload.array('documents', 5),
  validateParams({
    type: 'object',
    required: ['claimId'],
    properties: {
      claimId: { type: 'string', minLength: 1 },
      documentTypes: { type: 'string' },
      autoUpdate: { type: 'string' },
      language: { type: 'string', enum: ['en', 'es', 'fr'] }
    }
  }),
  asyncHandler(async (req, res) => {
    const {
      claimId,
      documentTypes = '',
      autoUpdate = 'true',
      language = 'en'
    } = req.body;

    if (!req.files || req.files.length === 0) {
      throw ApiError.badRequest('No documents provided');
    }

    // Verify claim exists
    const claim = await claimTrackingService.getClaim(claimId);
    if (!claim) {
      throw ApiError.notFound(`Claim ${claimId} not found`);
    }

    const expectedTypes = documentTypes ? documentTypes.split(',').map(t => t.trim()) : [];
    const processedDocuments = [];
    const errors = [];

    logger.info('Starting claim document processing', {
      claimId,
      documentCount: req.files.length,
      expectedTypes,
      requestId: req.requestId
    });

    try {
      // Process each document
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const expectedType = expectedTypes[i] || 'auto';

        try {
          const metadata = {
            originalFilename: file.originalname,
            documentType: expectedType,
            language,
            uploadedBy: getUserId(req),
            claimId
          };

          const result = await ocrIntegrationService.processClaimDocument(
            claimId,
            file.path,
            metadata
          );

          if (result.results.success) {
            processedDocuments.push({
              filename: file.originalname,
              documentType: result.results.documentType,
              confidence: result.results.confidence,
              extractedFields: Object.keys(result.results.structuredData?.fields || {}),
              processingTime: result.results.processingTime,
              processingId: result.id
            });
          } else {
            errors.push({
              filename: file.originalname,
              error: result.results.error || 'Processing failed'
            });
          }

        } catch (error) {
          logger.error('Document processing error', {
            filename: file.originalname,
            error: error.message,
            claimId,
            requestId: req.requestId
          });

          errors.push({
            filename: file.originalname,
            error: error.message
          });
        }

        // Clean up uploaded file
        await fs.remove(file.path).catch(() => {});
      }

      // Generate processing summary
      const summary = {
        claimId,
        totalDocuments: req.files.length,
        processedSuccessfully: processedDocuments.length,
        failed: errors.length,
        documents: processedDocuments,
        errors: errors.length > 0 ? errors : undefined
      };

      // Update claim status if documents were processed successfully
      if (processedDocuments.length > 0 && autoUpdate === 'true') {
        await claimTrackingService.updateClaimStatus(claimId, 'under_review', {
          reason: 'New documents processed with OCR',
          documentCount: processedDocuments.length
        });
      }

      logger.info('Claim document processing completed', {
        claimId,
        summary,
        requestId: req.requestId
      });

      res.json({
        success: true,
        data: summary,
        message: `Processed ${processedDocuments.length}/${req.files.length} documents successfully`,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });

    } catch (error) {
      // Clean up all uploaded files on error
      await Promise.all(req.files.map(file => fs.remove(file.path).catch(() => {})));
      throw error;
    }
  })
);

/**
 * @swagger
 * /api/v1/claim-ocr/create-claim-from-documents:
 *   post:
 *     summary: Create new claim from uploaded insurance documents
 *     description: Process documents and automatically create a new claim with extracted data
 *     tags: [Claim OCR Integration]
 */
router.post('/create-claim-from-documents',
  fileUploadRateLimit,
  upload.array('documents', 5),
  validateParams({
    type: 'object',
    properties: {
      propertyAddress: { type: 'string' },
      contactInfo: { type: 'object' },
      language: { type: 'string', enum: ['en', 'es', 'fr'] }
    }
  }),
  asyncHandler(async (req, res) => {
    const {
      propertyAddress = '',
      contactInfo = {},
      language = 'en'
    } = req.body;

    if (!req.files || req.files.length === 0) {
      throw ApiError.badRequest('No documents provided');
    }

    logger.info('Creating claim from documents', {
      documentCount: req.files.length,
      propertyAddress,
      requestId: req.requestId
    });

    try {
      // First, process all documents to extract data
      const ocrResults = [];
      for (const file of req.files) {
        const metadata = {
          originalFilename: file.originalname,
          language,
          uploadedBy: getUserId(req)
        };

        const result = await ocrIntegrationService.ocrService.processDocument(
          file.path,
          {
            language,
            documentType: 'auto',
            enhanceImage: true,
            extractStructuredData: true
          }
        );

        ocrResults.push({
          filename: file.originalname,
          filePath: file.path,
          metadata,
          ocrResult: result
        });
      }

      // Extract claim data from OCR results
      const claimData = await extractClaimDataFromDocuments(ocrResults, {
        propertyAddress,
        contactInfo
      });

      // Create new claim
      const claim = await claimTrackingService.createClaim(claimData);

      // Process documents for the new claim
      const documentProcessingResults = [];
      for (const result of ocrResults) {
        if (result.ocrResult.success) {
          const processingResult = await ocrIntegrationService.processOCRResults(
            claim.id,
            result.ocrResult,
            result.metadata
          );
          documentProcessingResults.push(processingResult);
        }
      }

      // Clean up uploaded files
      await Promise.all(req.files.map(file => fs.remove(file.path).catch(() => {})));

      logger.info('Claim created from documents', {
        claimId: claim.id,
        documentCount: ocrResults.length,
        requestId: req.requestId
      });

      res.status(201).json({
        success: true,
        data: {
          claim: {
            id: claim.id,
            status: claim.status,
            property: claim.property,
            insurance: claim.insurance,
            damage: claim.damage
          },
          processedDocuments: ocrResults.map(r => ({
            filename: r.filename,
            documentType: r.ocrResult.documentType,
            confidence: r.ocrResult.confidence,
            success: r.ocrResult.success
          })),
          extractedData: claimData
        },
        message: 'Claim created successfully from uploaded documents',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });

    } catch (error) {
      // Clean up uploaded files on error
      await Promise.all(req.files.map(file => fs.remove(file.path).catch(() => {})));
      throw error;
    }
  })
);

/**
 * @swagger
 * /api/v1/claim-ocr/processing-status/{processingId}:
 *   get:
 *     summary: Get OCR processing status
 *     description: Check the status of document OCR processing
 *     tags: [Claim OCR Integration]
 */
router.get('/processing-status/:processingId',
  moderateRateLimit,
  validateParams({
    type: 'object',
    required: ['processingId'],
    properties: {
      processingId: { type: 'string', minLength: 1 }
    }
  }),
  asyncHandler(async (req, res) => {
    const { processingId } = req.params;

    const status = getProcessingStatus(processingId);
    if (!status) {
      throw ApiError.notFound(`Processing ID ${processingId} not found`);
    }

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @swagger
 * /api/v1/claim-ocr/claim/{claimId}/documents:
 *   get:
 *     summary: Get processed documents for a claim
 *     description: Retrieve all OCR processed documents associated with a claim
 *     tags: [Claim OCR Integration]
 */
router.get('/claim/:claimId/documents',
  moderateRateLimit,
  validateParams({
    type: 'object',
    required: ['claimId'],
    properties: {
      claimId: { type: 'string', minLength: 1 }
    }
  }),
  asyncHandler(async (req, res) => {
    const { claimId } = req.params;
    const { includeOCRResults = 'false' } = req.query;

    const claim = await claimTrackingService.getClaim(claimId);
    if (!claim) {
      throw ApiError.notFound(`Claim ${claimId} not found`);
    }

    const documents = await getClaimDocuments(claimId, includeOCRResults === 'true');

    res.json({
      success: true,
      data: {
        claimId,
        documents,
        totalDocuments: documents.length
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @swagger
 * /api/v1/claim-ocr/statistics:
 *   get:
 *     summary: Get OCR integration statistics
 *     description: Retrieve processing statistics and performance metrics
 *     tags: [Claim OCR Integration]
 */
router.get('/statistics',
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const stats = ocrIntegrationService.getProcessingStatistics();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @swagger
 * /api/v1/claim-ocr/batch-process:
 *   post:
 *     summary: Process multiple documents for multiple claims
 *     description: Batch process documents with automatic claim association
 *     tags: [Claim OCR Integration]
 */
router.post('/batch-process',
  fileUploadRateLimit,
  upload.array('documents', 20),
  validateParams({
    type: 'object',
    required: ['claimMapping'],
    properties: {
      claimMapping: { type: 'string' }, // JSON string mapping file indexes to claim IDs
      language: { type: 'string', enum: ['en', 'es', 'fr'] },
      maxConcurrent: { type: 'string' }
    }
  }),
  asyncHandler(async (req, res) => {
    const {
      claimMapping,
      language = 'en',
      maxConcurrent = '3'
    } = req.body;

    if (!req.files || req.files.length === 0) {
      throw ApiError.badRequest('No documents provided');
    }

    let mapping;
    try {
      mapping = JSON.parse(claimMapping);
    } catch (error) {
      throw ApiError.badRequest('Invalid claimMapping JSON format');
    }

    logger.info('Starting batch document processing', {
      documentCount: req.files.length,
      claimsAffected: Object.keys(mapping).length,
      requestId: req.requestId
    });

    try {
      // Prepare documents for batch processing
      const documents = req.files.map((file, index) => ({
        path: file.path,
        claimId: mapping[index.toString()],
        metadata: {
          originalFilename: file.originalname,
          language,
          uploadedBy: getUserId(req),
          batchId: req.requestId
        }
      }));

      // Process batch
      const results = await ocrIntegrationService.processBatchDocuments(documents, {
        maxConcurrent: parseInt(maxConcurrent)
      });

      // Clean up uploaded files
      await Promise.all(req.files.map(file => fs.remove(file.path).catch(() => {})));

      logger.info('Batch document processing completed', {
        results: results,
        requestId: req.requestId
      });

      res.json({
        success: true,
        data: results,
        message: `Batch processed ${results.successful}/${results.total} documents successfully`,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });

    } catch (error) {
      // Clean up uploaded files on error
      await Promise.all(req.files.map(file => fs.remove(file.path).catch(() => {})));
      throw error;
    }
  })
);

/**
 * @swagger
 * /api/v1/claim-ocr/health:
 *   get:
 *     summary: OCR integration health check
 *     description: Check the health of OCR integration services
 *     tags: [Claim OCR Integration]
 */
router.get('/health',
  asyncHandler(async (req, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        ocrIntegration: 'healthy',
        claimTracking: 'healthy',
        ocrService: 'healthy'
      },
      statistics: ocrIntegrationService.getProcessingStatistics(),
      engineValidation: await ocrIntegrationService.ocrService.validateEngines()
    };

    // Check service health
    try {
      await claimTrackingService.healthCheck?.();
    } catch (error) {
      health.services.claimTracking = 'unhealthy';
      health.status = 'degraded';
    }

    const availableEngines = Object.values(health.engineValidation)
      .filter(engine => engine.available).length;
    
    if (availableEngines === 0) {
      health.services.ocrService = 'unhealthy';
      health.status = 'degraded';
    }

    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Helper functions
function getUserId(req) {
  if (req.auth?.user?.id) {
    return req.auth.user.id;
  }
  
  if (req.auth?.key) {
    return `api_user_${req.auth.key.slice(-8)}`;
  }
  
  return 'anonymous_user';
}

function getProcessingStatus(processingId) {
  // Check completed processing
  if (ocrIntegrationService.completedProcessing.has(processingId)) {
    return {
      id: processingId,
      status: 'completed',
      result: ocrIntegrationService.completedProcessing.get(processingId)
    };
  }

  // Check failed processing
  if (ocrIntegrationService.failedProcessing.has(processingId)) {
    return {
      id: processingId,
      status: 'failed',
      result: ocrIntegrationService.failedProcessing.get(processingId)
    };
  }

  // Check queue
  const queuedItem = ocrIntegrationService.processingQueue.find(item => item.id === processingId);
  if (queuedItem) {
    return {
      id: processingId,
      status: queuedItem.status,
      queuePosition: ocrIntegrationService.processingQueue.indexOf(queuedItem) + 1
    };
  }

  return null;
}

async function getClaimDocuments(claimId, includeOCRResults = false) {
  // Mock implementation - in production, fetch from database
  const documents = [];
  
  // Get documents from completed processing
  for (const [processingId, result] of ocrIntegrationService.completedProcessing) {
    if (result.claimId === claimId) {
      const doc = {
        id: processingId,
        filename: result.metadata?.originalFilename || 'unknown',
        documentType: result.results?.documentType || 'unknown',
        confidence: result.results?.confidence || 0,
        processedAt: result.endTime,
        status: 'completed'
      };

      if (includeOCRResults) {
        doc.ocrResults = result.results;
      }

      documents.push(doc);
    }
  }

  return documents;
}

async function extractClaimDataFromDocuments(ocrResults, additionalData = {}) {
  const claimData = {
    property: {
      address: additionalData.propertyAddress || '',
      owner: additionalData.contactInfo?.name || '',
      contactInfo: additionalData.contactInfo || {}
    },
    insurance: {},
    damage: {},
    financial: {}
  };

  // Extract data from each document
  for (const result of ocrResults) {
    if (result.ocrResult.success && result.ocrResult.structuredData?.fields) {
      const fields = result.ocrResult.structuredData.fields;

      // Extract common fields
      if (fields.policy_number) claimData.insurance.policyNumber = fields.policy_number.value;
      if (fields.claim_number) claimData.insurance.claimNumber = fields.claim_number.value;
      if (fields.date_of_loss) claimData.damage.dateOfLoss = fields.date_of_loss.value;
      if (fields.amount) claimData.financial.estimatedValue = parseFloat(fields.amount.value.replace(/[^0-9.]/g, ''));
      if (fields.insured_name && !claimData.property.owner) claimData.property.owner = fields.insured_name.value;
      if (fields.property_address && !claimData.property.address) claimData.property.address = fields.property_address.value;
    }
  }

  return claimData;
}

// Error handling middleware
router.use((error, req, res, next) => {
  if (req.file) {
    fs.remove(req.file.path).catch(() => {});
  }
  if (req.files) {
    Promise.all(req.files.map(file => fs.remove(file.path).catch(() => {}))).catch(() => {});
  }

  logger.error('Claim OCR integration error', {
    error: error.message,
    stack: error.stack,
    requestId: req.requestId
  });

  next(error);
});

export default router;