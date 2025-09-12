import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateParams } from '../middleware/validation.js';
import { fileUploadRateLimit, moderateRateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import DocumentOCRService from '../services/DocumentOCRService.js';

const router = express.Router();
const ocrService = new DocumentOCRService();

// Configure multer for OCR document uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = '/tmp/ocr_uploads';
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for OCR documents
    files: 10 // Max 10 files for batch processing
  },
  fileFilter: (req, file, cb) => {
    // Only allow document and image files for OCR
    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/tiff',
      'image/bmp',
      'image/webp'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, `File type ${file.mimetype} not supported for OCR. Supported types: ${allowedMimeTypes.join(', ')}`), false);
    }
  }
});

/**
 * @swagger
 * /api/v1/ocr/process:
 *   post:
 *     summary: Process single document with OCR
 *     description: Extract text from insurance documents using advanced OCR engines
 *     tags: [OCR]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: document
 *         type: file
 *         required: true
 *         description: Document file to process (PDF, PNG, JPG, TIFF, BMP)
 *       - in: formData
 *         name: language
 *         type: string
 *         default: en
 *         description: Document language (en, es, fr)
 *       - in: formData
 *         name: documentType
 *         type: string
 *         default: auto
 *         description: Document type (auto, claim_form, policy_document, estimate_form, inspection_report)
 *       - in: formData
 *         name: preferredEngine
 *         type: string
 *         default: auto
 *         description: Preferred OCR engine (auto, tesseract, google, aws)
 *       - in: formData
 *         name: enhanceImage
 *         type: boolean
 *         default: true
 *         description: Apply image preprocessing for better OCR accuracy
 *       - in: formData
 *         name: extractStructuredData
 *         type: boolean
 *         default: true
 *         description: Extract structured fields based on document type
 *     responses:
 *       200:
 *         description: OCR processing completed successfully
 *       400:
 *         description: Invalid request or file format
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post('/process',
  fileUploadRateLimit,
  upload.single('document'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw ApiError.badRequest('No document file provided');
    }

    const {
      language = 'en',
      documentType = 'auto',
      preferredEngine = 'auto',
      enhanceImage = true,
      extractStructuredData = true
    } = req.body;

    const options = {
      language,
      documentType,
      preferredEngine,
      enhanceImage: enhanceImage === 'true' || enhanceImage === true,
      extractStructuredData: extractStructuredData === 'true' || extractStructuredData === true
    };

    logger.info('Starting OCR processing', {
      filename: req.file.originalname,
      size: req.file.size,
      options,
      requestId: req.requestId
    });

    try {
      const result = await ocrService.processDocument(req.file.path, options);

      // Clean up uploaded file
      await fs.remove(req.file.path);

      logger.info('OCR processing completed', {
        filename: req.file.originalname,
        success: result.success,
        confidence: result.confidence,
        processingTime: result.processingTime,
        requestId: req.requestId
      });

      res.json({
        success: true,
        data: result,
        message: 'Document processed successfully',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });

    } catch (error) {
      // Clean up uploaded file on error
      await fs.remove(req.file.path).catch(() => {});
      throw error;
    }
  })
);

/**
 * @swagger
 * /api/v1/ocr/batch:
 *   post:
 *     summary: Process multiple documents with OCR
 *     description: Batch process multiple insurance documents
 *     tags: [OCR]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: documents
 *         type: file
 *         required: true
 *         description: Multiple document files to process
 *       - in: formData
 *         name: language
 *         type: string
 *         default: en
 *         description: Document language
 *       - in: formData
 *         name: maxConcurrent
 *         type: integer
 *         default: 3
 *         description: Maximum concurrent processing (1-5)
 *       - in: formData
 *         name: stopOnError
 *         type: boolean
 *         default: false
 *         description: Stop processing if any document fails
 *     responses:
 *       200:
 *         description: Batch processing completed
 *       400:
 *         description: Invalid request
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/batch',
  fileUploadRateLimit,
  upload.array('documents', 10),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      throw ApiError.badRequest('No document files provided');
    }

    const {
      language = 'en',
      maxConcurrent = 3,
      stopOnError = false
    } = req.body;

    const options = {
      language,
      maxConcurrent: Math.min(5, Math.max(1, parseInt(maxConcurrent))),
      stopOnError: stopOnError === 'true' || stopOnError === true,
      progressCallback: (progress) => {
        logger.info('Batch OCR progress', {
          processed: progress.processed,
          total: progress.total,
          current: path.basename(progress.current),
          requestId: req.requestId
        });
      }
    };

    const filePaths = req.files.map(file => file.path);

    logger.info('Starting batch OCR processing', {
      fileCount: filePaths.length,
      options,
      requestId: req.requestId
    });

    try {
      const results = await ocrService.batchProcess(filePaths, options);

      // Clean up uploaded files
      await Promise.all(filePaths.map(filePath => fs.remove(filePath).catch(() => {})));

      logger.info('Batch OCR processing completed', {
        totalProcessed: results.totalProcessed,
        successful: results.successful,
        failed: results.failed,
        averageProcessingTime: results.averageProcessingTime,
        requestId: req.requestId
      });

      res.json({
        success: true,
        data: results,
        message: `Batch processing completed: ${results.successful}/${results.totalProcessed} successful`,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });

    } catch (error) {
      // Clean up uploaded files on error
      await Promise.all(filePaths.map(filePath => fs.remove(filePath).catch(() => {})));
      throw error;
    }
  })
);

/**
 * @swagger
 * /api/v1/ocr/classify:
 *   post:
 *     summary: Classify document type
 *     description: Classify insurance document type without full OCR processing
 *     tags: [OCR]
 */
router.post('/classify',
  fileUploadRateLimit,
  upload.single('document'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw ApiError.badRequest('No document file provided');
    }

    try {
      // Quick OCR for classification only
      const result = await ocrService.processDocument(req.file.path, {
        language: req.body.language || 'en',
        extractStructuredData: false,
        enhanceImage: false
      });

      // Clean up uploaded file
      await fs.remove(req.file.path);

      const classification = {
        filename: req.file.originalname,
        documentType: result.documentType,
        confidence: result.confidence,
        detectedLanguage: result.language,
        processingTime: result.processingTime
      };

      res.json({
        success: true,
        data: classification,
        message: 'Document classified successfully',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });

    } catch (error) {
      await fs.remove(req.file.path).catch(() => {});
      throw error;
    }
  })
);

/**
 * @swagger
 * /api/v1/ocr/extract-fields:
 *   post:
 *     summary: Extract specific fields from insurance documents
 *     description: Extract structured data fields from insurance forms
 *     tags: [OCR]
 */
router.post('/extract-fields',
  fileUploadRateLimit,
  upload.single('document'),
  validateParams({
    type: 'object',
    properties: {
      documentType: {
        type: 'string',
        enum: ['claim_form', 'policy_document', 'estimate_form', 'inspection_report']
      },
      requiredFields: {
        type: 'array',
        items: { type: 'string' }
      }
    }
  }),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw ApiError.badRequest('No document file provided');
    }

    const { documentType, requiredFields } = req.body;

    if (!documentType) {
      throw ApiError.badRequest('documentType is required for field extraction');
    }

    try {
      const result = await ocrService.processDocument(req.file.path, {
        language: req.body.language || 'en',
        documentType,
        extractStructuredData: true,
        enhanceImage: true
      });

      // Clean up uploaded file
      await fs.remove(req.file.path);

      const extractedFields = result.structuredData;
      
      // Filter to only requested fields if specified
      if (requiredFields && Array.isArray(requiredFields)) {
        const filteredFields = {};
        for (const field of requiredFields) {
          if (extractedFields.fields[field]) {
            filteredFields[field] = extractedFields.fields[field];
          }
        }
        extractedFields.fields = filteredFields;
      }

      res.json({
        success: true,
        data: {
          filename: req.file.originalname,
          documentType: result.documentType,
          extractedFields,
          qualityAssessment: result.qualityAssessment,
          processingTime: result.processingTime
        },
        message: 'Field extraction completed successfully',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });

    } catch (error) {
      await fs.remove(req.file.path).catch(() => {});
      throw error;
    }
  })
);

/**
 * @swagger
 * /api/v1/ocr/engines/validate:
 *   get:
 *     summary: Validate OCR engine availability
 *     description: Check which OCR engines are available and properly configured
 *     tags: [OCR]
 */
router.get('/engines/validate',
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const validation = await ocrService.validateEngines();

    res.json({
      success: true,
      data: {
        engines: validation,
        availableEngines: Object.entries(validation)
          .filter(([name, config]) => config.available)
          .map(([name]) => name),
        recommendedEngine: Object.entries(validation)
          .filter(([name, config]) => config.available)
          .sort((a, b) => (ocrService.ocrEngines[b[0]]?.confidence || 0) - (ocrService.ocrEngines[a[0]]?.confidence || 0))[0]?.[0] || 'tesseract'
      },
      message: 'Engine validation completed',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @swagger
 * /api/v1/ocr/statistics:
 *   get:
 *     summary: Get OCR processing statistics
 *     description: Retrieve processing statistics and performance metrics
 *     tags: [OCR]
 */
router.get('/statistics',
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const stats = ocrService.getStatistics();

    res.json({
      success: true,
      data: stats,
      message: 'Statistics retrieved successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @swagger
 * /api/v1/ocr/templates:
 *   get:
 *     summary: Get supported document templates
 *     description: Retrieve list of supported insurance document templates and their field mappings
 *     tags: [OCR]
 */
router.get('/templates',
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const templates = Object.entries(ocrService.insuranceTemplates).map(([key, template]) => ({
      type: key,
      name: template.name,
      requiredFields: template.requiredFields,
      confidence: template.confidence,
      availableFields: Object.keys(template.patterns)
    }));

    res.json({
      success: true,
      data: {
        templates,
        totalTemplates: templates.length,
        supportedLanguages: Object.keys(ocrService.languageConfig)
      },
      message: 'Document templates retrieved successfully',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

/**
 * @swagger
 * /api/v1/ocr/export:
 *   post:
 *     summary: Export OCR results
 *     description: Export OCR processing results in various formats
 *     tags: [OCR]
 */
router.post('/export',
  moderateRateLimit,
  validateParams({
    type: 'object',
    required: ['results', 'format'],
    properties: {
      results: { type: 'object' },
      format: {
        type: 'string',
        enum: ['json', 'csv', 'xml']
      },
      filename: { type: 'string' }
    }
  }),
  asyncHandler(async (req, res) => {
    const { results, format, filename } = req.body;

    try {
      const exportPath = await ocrService.exportResults(results, format, filename);
      
      // In production, you would typically return a download link or stream the file
      const exportData = await fs.readFile(exportPath, 'utf8');
      
      // Clean up export file
      await fs.remove(exportPath);

      res.setHeader('Content-Type', getContentType(format));
      res.setHeader('Content-Disposition', `attachment; filename="ocr_export.${format}"`);
      
      res.send(exportData);

    } catch (error) {
      throw ApiError.internalServer(`Export failed: ${error.message}`);
    }
  })
);

/**
 * @swagger
 * /api/v1/ocr/health:
 *   get:
 *     summary: OCR service health check
 *     description: Check the health and status of the OCR service
 *     tags: [OCR]
 */
router.get('/health',
  asyncHandler(async (req, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'DocumentOCRService',
      version: '1.0.0',
      engines: ocrService.ocrEngines,
      statistics: ocrService.getStatistics(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };

    // Check if at least one OCR engine is available
    const availableEngines = Object.values(ocrService.ocrEngines).filter(engine => engine.available);
    if (availableEngines.length === 0) {
      health.status = 'degraded';
      health.warning = 'No OCR engines available';
    }

    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Helper function to get content type for export formats
function getContentType(format) {
  switch (format.toLowerCase()) {
    case 'json':
      return 'application/json';
    case 'csv':
      return 'text/csv';
    case 'xml':
      return 'application/xml';
    default:
      return 'text/plain';
  }
}

// Error handling middleware specific to OCR routes
router.use((error, req, res, next) => {
  // Clean up any uploaded files on error
  if (req.file) {
    fs.remove(req.file.path).catch(() => {});
  }
  if (req.files) {
    Promise.all(req.files.map(file => fs.remove(file.path).catch(() => {}))).catch(() => {});
  }

  // Log OCR-specific errors
  logger.error('OCR route error', {
    error: error.message,
    stack: error.stack,
    filename: req.file?.originalname || req.files?.map(f => f.originalname),
    requestId: req.requestId
  });

  next(error);
});

export default router;