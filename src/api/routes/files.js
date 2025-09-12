import express from 'express';
import multer from 'multer';
import fs from 'fs-extra';
import path from 'path';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateParams } from '../middleware/validation.js';
import { fileUploadRateLimit, moderateRateLimit } from '../middleware/rateLimit.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { DocumentProcessingService } from '../services/DocumentProcessingService.js';

const router = express.Router();
const documentProcessor = new DocumentProcessingService();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
fs.ensureDir(uploadsDir).catch(console.error);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 5 // Max 5 files at once
  },
  fileFilter: (req, file, cb) => {
    // Allow most common file types
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
      'application/json',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'audio/mp3',
      'video/mp4',
      'video/avi'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, `File type ${file.mimetype} not supported`), false);
    }
  }
});

// Upload files
router.post('/upload',
  fileUploadRateLimit,
  upload.array('files', 5),
  asyncHandler(async (req, res) => {
    const { purpose = 'general', metadata = {} } = req.body;
    const userId = getUserId(req);
    
    if (!req.files || req.files.length === 0) {
      throw ApiError.badRequest('No files provided');
    }
    
    const uploadedFiles = [];
    
    for (const file of req.files) {
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const filename = file.originalname;
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = path.join(uploadsDir, `${fileId}_${sanitizedFilename}`);
      
      try {
        // Save file to disk
        await fs.writeFile(filePath, file.buffer);
        
        // Process file content if it's a supported document
        let processedContent = null;
        let analysisResults = null;
        
        const ext = path.extname(filename).toLowerCase();
        if (['.pdf', '.txt', '.docx', '.md'].includes(ext)) {
          try {
            processedContent = await documentProcessor.processDocument(filePath);
            analysisResults = {
              textLength: processedContent?.length || 0,
              contentType: 'document',
              extractedSuccessfully: !!processedContent
            };
          } catch (processError) {
            logger.warn('Document processing failed', { 
              filename, 
              error: processError.message 
            });
            analysisResults = {
              error: `Document processing failed: ${processError.message}`,
              contentType: 'document',
              extractedSuccessfully: false
            };
          }
        }
        
        const fileRecord = {
          id: fileId,
          filename: filename,
          sanitizedFilename: sanitizedFilename,
          mimeType: file.mimetype,
          size: file.size,
          purpose,
          filePath: filePath,
          metadata: {
            ...metadata,
            uploadedBy: userId,
            encoding: file.encoding
          },
          uploadedAt: new Date().toISOString(),
          url: `/api/v1/files/${fileId}/download`,
          status: 'uploaded',
          processed: !!processedContent,
          content: processedContent,
          analysis: analysisResults
        };
        
        uploadedFiles.push(fileRecord);
        
        logger.info('File uploaded and processed', {
          fileId: fileRecord.id,
          filename: file.originalname,
          size: file.size,
          processed: !!processedContent,
          userId
        });
        
      } catch (error) {
        logger.error('File upload failed', {
          filename,
          error: error.message,
          userId
        });
        
        // Clean up partial file if it exists
        try {
          await fs.unlink(filePath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        
        throw new ApiError(500, `Failed to upload file ${filename}: ${error.message}`);
      }
    }
    
    res.status(201).json({
      success: true,
      data: {
        files: uploadedFiles,
        count: uploadedFiles.length
      },
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Get file information
router.get('/:fileId',
  moderateRateLimit,
  validateParams({
    type: 'object',
    required: ['fileId'],
    properties: {
      fileId: { type: 'string', minLength: 1 }
    }
  }),
  asyncHandler(async (req, res) => {
    const { fileId } = req.params;
    
    // Mock file data (in production, fetch from database)
    const file = {
      id: fileId,
      filename: 'example-document.pdf',
      mimeType: 'application/pdf',
      size: 1024000,
      purpose: 'analysis',
      metadata: {
        uploadedBy: getUserId(req),
        pages: 5,
        language: 'en'
      },
      uploadedAt: new Date().toISOString(),
      url: `/api/v1/files/${fileId}/download`,
      status: 'processed',
      analysis: {
        textExtracted: true,
        wordCount: 1250,
        summary: 'This document contains information about...'
      }
    };
    
    res.json({
      success: true,
      data: file,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Delete file
router.delete('/:fileId',
  moderateRateLimit,
  validateParams({
    type: 'object',
    required: ['fileId'],
    properties: {
      fileId: { type: 'string', minLength: 1 }
    }
  }),
  asyncHandler(async (req, res) => {
    const { fileId } = req.params;
    const userId = getUserId(req);
    
    // In production, delete from storage and database
    logger.info('File deleted', { fileId, userId });
    
    res.status(204).send();
  })
);

// Analyze file
router.post('/:fileId/analyze',
  moderateRateLimit,
  validateParams({
    type: 'object',
    required: ['fileId'],
    properties: {
      fileId: { type: 'string', minLength: 1 }
    }
  }),
  asyncHandler(async (req, res) => {
    const { fileId } = req.params;
    const { analysisType = 'content_extraction', options = {} } = req.body;
    
    // Mock analysis results
    const analysisResults = {
      fileId,
      analysisType,
      status: 'completed',
      results: generateMockAnalysisResults(analysisType),
      processedAt: new Date().toISOString(),
      processingTime: Math.floor(Math.random() * 5000) + 1000
    };
    
    logger.info('File analysis completed', {
      fileId,
      analysisType,
      processingTime: analysisResults.processingTime
    });
    
    res.json({
      success: true,
      data: analysisResults,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

// Download file
router.get('/:fileId/download',
  moderateRateLimit,
  validateParams({
    type: 'object',
    required: ['fileId'],
    properties: {
      fileId: { type: 'string', minLength: 1 }
    }
  }),
  asyncHandler(async (req, res) => {
    const { fileId } = req.params;
    
    // In production, stream file from storage
    res.status(200).json({
      message: 'File download would be initiated here',
      fileId,
      note: 'In production, this would stream the actual file content'
    });
  })
);

// List user files
router.get('/',
  moderateRateLimit,
  asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      purpose, 
      mimeType,
      sortBy = 'uploadedAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Mock file list
    const files = Array.from({ length: parseInt(limit) }, (_, i) => ({
      id: `file_${Date.now()}_${i}`,
      filename: `document_${i + 1}.pdf`,
      mimeType: 'application/pdf',
      size: Math.floor(Math.random() * 5000000),
      purpose: purpose || 'general',
      uploadedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'processed'
    }));
    
    res.json({
      success: true,
      data: {
        files,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 100, // Mock total
          totalPages: Math.ceil(100 / parseInt(limit))
        }
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  })
);

function generateMockAnalysisResults(analysisType) {
  switch (analysisType) {
    case 'ocr':
      return {
        extractedText: 'This is the extracted text from the image...',
        confidence: 0.95,
        language: 'en',
        wordCount: 234
      };
    case 'content_extraction':
      return {
        text: 'Extracted content from the document...',
        summary: 'This document discusses...',
        keywords: ['technology', 'AI', 'innovation'],
        wordCount: 1250
      };
    case 'image_analysis':
      return {
        objects: ['person', 'computer', 'desk'],
        colors: ['blue', 'white', 'gray'],
        mood: 'professional',
        confidence: 0.87
      };
    case 'document_parsing':
      return {
        structure: {
          title: 'Document Title',
          sections: ['Introduction', 'Main Content', 'Conclusion'],
          pages: 5
        },
        metadata: {
          author: 'Unknown',
          created: '2024-01-01',
          language: 'en'
        }
      };
    default:
      return {
        message: 'Analysis completed',
        type: analysisType
      };
  }
}

function getUserId(req) {
  if (req.auth?.user?.id) {
    return req.auth.user.id;
  }
  
  if (req.auth?.key) {
    return `api_user_${req.auth.key.slice(-8)}`;
  }
  
  throw ApiError.unauthorized('User identification required');
}

export default router;