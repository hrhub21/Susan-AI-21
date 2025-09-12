import express from 'express';
import multer from 'multer';
import { VideoGenerationService } from '../services/VideoGenerationService.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs-extra';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 50 // Max 50 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/tiff'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError.badRequest('Only image files are allowed'), false);
    }
  }
});

// Initialize video generation service
const videoService = new VideoGenerationService();

/**
 * @swagger
 * /api/video-generation/generate-claim-video:
 *   post:
 *     summary: Generate comprehensive video explanation for insurance claims
 *     tags: [Video Generation]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: photos
 *         type: array
 *         items:
 *           type: file
 *         required: true
 *         description: Photos of roof damage (max 50 files, 50MB each)
 *       - in: formData
 *         name: claimData
 *         type: string
 *         required: true
 *         description: JSON string containing claim information
 *       - in: formData
 *         name: templateId
 *         type: string
 *         description: Video template ID (default: comprehensive_report)
 *       - in: formData
 *         name: personalization
 *         type: string
 *         description: JSON string with personalization options
 *       - in: formData
 *         name: outputFormat
 *         type: string
 *         enum: [mp4, webm, avi]
 *         description: Output video format (default: mp4)
 *       - in: formData
 *         name: quality
 *         type: string
 *         enum: [low, medium, high]
 *         description: Video quality (default: high)
 *       - in: formData
 *         name: includeNarration
 *         type: boolean
 *         description: Include AI voice narration (default: true)
 *       - in: formData
 *         name: voiceSettings
 *         type: string
 *         description: JSON string with voice synthesis settings
 *     responses:
 *       200:
 *         description: Video generation started successfully
 *         schema:
 *           type: object
 *           properties:
 *             success:
 *               type: boolean
 *             videoId:
 *               type: string
 *             message:
 *               type: string
 *             estimatedDuration:
 *               type: number
 *       400:
 *         description: Bad request - invalid input
 *       500:
 *         description: Internal server error
 */
router.post('/generate-claim-video', upload.array('photos', 50), async (req, res, next) => {
  try {
    // Validate request
    if (!req.files || req.files.length === 0) {
      throw ApiError.badRequest('At least one photo is required');
    }

    if (!req.body.claimData) {
      throw ApiError.badRequest('Claim data is required');
    }

    // Parse JSON fields
    let claimData, personalization = {}, voiceSettings = {};

    try {
      claimData = JSON.parse(req.body.claimData);
    } catch (error) {
      throw ApiError.badRequest('Invalid claim data JSON format');
    }

    if (req.body.personalization) {
      try {
        personalization = JSON.parse(req.body.personalization);
      } catch (error) {
        throw ApiError.badRequest('Invalid personalization JSON format');
      }
    }

    if (req.body.voiceSettings) {
      try {
        voiceSettings = JSON.parse(req.body.voiceSettings);
      } catch (error) {
        throw ApiError.badRequest('Invalid voice settings JSON format');
      }
    }

    // Prepare photos with buffer data
    const photos = req.files.map(file => ({
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    }));

    // Configure video generation options
    const options = {
      templateId: req.body.templateId || 'comprehensive_report',
      personalization,
      outputFormat: req.body.outputFormat || 'mp4',
      quality: req.body.quality || 'high',
      includeNarration: req.body.includeNarration !== 'false',
      voiceSettings,
      userId: req.user?.id || 'anonymous'
    };

    logger.info('🎬 Starting video generation request', {
      photoCount: photos.length,
      templateId: options.templateId,
      outputFormat: options.outputFormat,
      quality: options.quality,
      userId: options.userId
    });

    // Start video generation (async)
    const result = await videoService.generateClaimVideo(photos, claimData, options);

    res.json({
      success: true,
      videoId: result.videoId,
      message: 'Video generation completed successfully',
      video: result.video,
      analysis: result.analysis,
      interactive: result.interactive,
      metadata: result.metadata,
      exports: result.exports
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/video-generation/quick-damage-video:
 *   post:
 *     summary: Generate quick damage assessment video
 *     tags: [Video Generation]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: photos
 *         type: array
 *         items:
 *           type: file
 *         required: true
 *         description: Photos of roof damage (max 10 files)
 *       - in: formData
 *         name: propertyAddress
 *         type: string
 *         required: true
 *         description: Property address
 *       - in: formData
 *         name: adjusterName
 *         type: string
 *         description: Insurance adjuster name
 *       - in: formData
 *         name: damageType
 *         type: string
 *         enum: [hail, wind, storm, general]
 *         description: Primary damage type (default: general)
 *     responses:
 *       200:
 *         description: Quick video generated successfully
 *       400:
 *         description: Bad request
 */
router.post('/quick-damage-video', upload.array('photos', 10), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw ApiError.badRequest('At least one photo is required');
    }

    if (!req.body.propertyAddress) {
      throw ApiError.badRequest('Property address is required');
    }

    // Prepare minimal claim data
    const claimData = {
      propertyAddress: req.body.propertyAddress,
      damageType: req.body.damageType || 'general',
      claimNumber: `QUICK_${Date.now()}`,
      dateOfLoss: new Date().toISOString()
    };

    const personalization = {
      adjusterName: req.body.adjusterName || 'Insurance Professional'
    };

    const photos = req.files.map(file => ({
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    }));

    // Use appropriate template based on damage type
    let templateId = 'adjuster_briefing';
    if (req.body.damageType === 'hail') {
      templateId = 'hail_damage_explanation';
    } else if (req.body.damageType === 'wind') {
      templateId = 'wind_damage_analysis';
    }

    const options = {
      templateId,
      personalization,
      outputFormat: 'mp4',
      quality: 'medium',
      includeNarration: true,
      userId: req.user?.id || 'anonymous'
    };

    const result = await videoService.generateClaimVideo(photos, claimData, options);

    res.json({
      success: true,
      videoId: result.videoId,
      message: 'Quick damage video generated successfully',
      video: result.video,
      analysis: result.analysis,
      processingTime: result.metadata.generationTime
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/video-generation/status/{videoId}:
 *   get:
 *     summary: Get video generation status
 *     tags: [Video Generation]
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         type: string
 *         description: Video generation ID
 *     responses:
 *       200:
 *         description: Video generation status
 *         schema:
 *           type: object
 *           properties:
 *             success:
 *               type: boolean
 *             status:
 *               type: string
 *               enum: [processing, completed, failed]
 *             progress:
 *               type: object
 *             result:
 *               type: object
 *       404:
 *         description: Video not found
 */
router.get('/status/:videoId', async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const status = videoService.getVideoStatus(videoId);

    if (!status) {
      throw ApiError.notFound('Video generation session not found');
    }

    res.json({
      success: true,
      videoId,
      status: status.status,
      progress: status.progress,
      result: status.result || null,
      error: status.error || null,
      startTime: status.startTime,
      duration: status.duration || null
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/video-generation/templates:
 *   get:
 *     summary: Get available video templates
 *     tags: [Video Generation]
 *     responses:
 *       200:
 *         description: List of available templates
 *         schema:
 *           type: object
 *           properties:
 *             success:
 *               type: boolean
 *             templates:
 *               type: array
 *               items:
 *                 type: object
 */
router.get('/templates', async (req, res, next) => {
  try {
    const templates = videoService.getAllTemplates();

    res.json({
      success: true,
      templates: templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        duration: template.duration,
        sections: template.sections.map(section => ({
          type: section.type,
          duration: section.duration,
          template: section.template
        })),
        style: template.style
      }))
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/video-generation/active:
 *   get:
 *     summary: Get active video generation sessions
 *     tags: [Video Generation]
 *     responses:
 *       200:
 *         description: List of active video generations
 */
router.get('/active', async (req, res, next) => {
  try {
    const activeVideos = videoService.getActiveVideos();

    res.json({
      success: true,
      activeVideos: activeVideos.map(video => ({
        videoId: video.id,
        userId: video.userId,
        status: video.status,
        progress: video.progress,
        template: video.template.name,
        startTime: video.startTime,
        photos: video.photos
      }))
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/video-generation/preview-script:
 *   post:
 *     summary: Generate preview script for video before full generation
 *     tags: [Video Generation]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: photos
 *         type: array
 *         items:
 *           type: file
 *         required: true
 *         description: Sample photos for script preview
 *       - in: formData
 *         name: claimData
 *         type: string
 *         required: true
 *         description: JSON string containing claim information
 *       - in: formData
 *         name: templateId
 *         type: string
 *         description: Video template ID
 *     responses:
 *       200:
 *         description: Preview script generated
 */
router.post('/preview-script', upload.array('photos', 5), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw ApiError.badRequest('At least one photo is required for script preview');
    }

    if (!req.body.claimData) {
      throw ApiError.badRequest('Claim data is required');
    }

    let claimData;
    try {
      claimData = JSON.parse(req.body.claimData);
    } catch (error) {
      throw ApiError.badRequest('Invalid claim data JSON format');
    }

    // Quick analysis of first few photos for script preview
    const samplePhotos = req.files.slice(0, 3).map(file => ({
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    }));

    // Analyze sample photos
    const analysisResults = await videoService.analyzePhotosForVideo(samplePhotos);

    // Generate script preview
    const templateId = req.body.templateId || 'comprehensive_report';
    const script = await videoService.generateVideoScript(
      analysisResults,
      claimData,
      templateId,
      {}
    );

    res.json({
      success: true,
      message: 'Script preview generated successfully',
      script: {
        sections: script.sections.map(section => ({
          type: section.type,
          text: section.text.substring(0, 200) + '...', // Truncated preview
          wordCount: section.wordCount,
          duration: section.duration
        })),
        totalWords: script.totalWords,
        estimatedDuration: script.estimatedDuration
      },
      damageAnalysis: {
        photosAnalyzed: analysisResults.length,
        damageTypes: videoService.extractDamageTypes(analysisResults),
        severityLevel: videoService.calculateSeverityLevel(analysisResults),
        confidenceScore: videoService.calculateOverallConfidence(analysisResults)
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/video-generation/download/{videoId}:
 *   get:
 *     summary: Download generated video
 *     tags: [Video Generation]
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         type: string
 *         description: Video generation ID
 *       - in: query
 *         name: format
 *         type: string
 *         enum: [mp4, webm, avi]
 *         description: Preferred download format
 *     responses:
 *       200:
 *         description: Video file download
 *         content:
 *           video/mp4:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Video not found
 */
router.get('/download/:videoId', async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const { format } = req.query;

    const videoSession = videoService.getVideoStatus(videoId);
    
    if (!videoSession || videoSession.status !== 'completed') {
      throw ApiError.notFound('Video not found or not completed');
    }

    let downloadPath = videoSession.result.video.path;
    
    // Find alternative format if requested
    if (format && videoSession.result.exports) {
      const exportFormat = videoSession.result.exports.find(exp => exp.format === format);
      if (exportFormat) {
        downloadPath = exportFormat.path;
      }
    }

    if (!fs.existsSync(downloadPath)) {
      throw ApiError.notFound('Video file not found on disk');
    }

    // Set appropriate headers
    const fileName = `damage_analysis_${videoId}.${path.extname(downloadPath).slice(1)}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', `video/${format || 'mp4'}`);
    
    // Stream the file
    const fileStream = fs.createReadStream(downloadPath);
    fileStream.pipe(res);

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/video-generation/interactive/{videoId}:
 *   get:
 *     summary: Get interactive elements for video player
 *     tags: [Video Generation]
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         type: string
 *         description: Video generation ID
 *     responses:
 *       200:
 *         description: Interactive elements data
 */
router.get('/interactive/:videoId', async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const videoSession = videoService.getVideoStatus(videoId);

    if (!videoSession || videoSession.status !== 'completed') {
      throw ApiError.notFound('Video not found or not completed');
    }

    const interactive = videoSession.result.interactive;

    res.json({
      success: true,
      videoId,
      interactive: {
        hotspots: interactive.hotspots || [],
        annotations: interactive.annotations || [],
        chapters: interactive.chapters || [],
        overlays: interactive.overlays || []
      },
      metadata: {
        videoDuration: videoSession.result.video.duration,
        photosAnalyzed: videoSession.result.analysis.photosAnalyzed
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/video-generation/cleanup:
 *   post:
 *     summary: Clean up old video generation files (admin only)
 *     tags: [Video Generation]
 *     responses:
 *       200:
 *         description: Cleanup completed
 */
router.post('/cleanup', async (req, res, next) => {
  try {
    // Check admin permissions (implement based on your auth system)
    if (!req.user?.isAdmin) {
      throw ApiError.forbidden('Admin access required');
    }

    videoService.cleanup();

    res.json({
      success: true,
      message: 'Video generation cleanup completed'
    });

  } catch (error) {
    next(error);
  }
});

// Error handling middleware specific to video generation
router.use((error, req, res, next) => {
  logger.error('🎬 Video Generation Error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    files: req.files?.length || 0
  });

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum 50MB per file.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Maximum 50 files allowed.'
      });
    }
  }

  next(error);
});

export default router;