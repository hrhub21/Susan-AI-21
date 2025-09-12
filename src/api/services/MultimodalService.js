import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs-extra';
import path from 'path';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import EventEmitter from 'events';

export class MultimodalService extends EventEmitter {
  constructor() {
    super();
    this.initializeClients();
    this.processingQueue = new Map();
    this.supportedImageFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    this.supportedDocumentFormats = ['pdf', 'docx', 'doc', 'txt', 'md', 'rtf'];
    this.supportedVideoFormats = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
    this.maxFileSize = {
      image: 20 * 1024 * 1024, // 20MB
      document: 50 * 1024 * 1024, // 50MB
      video: 100 * 1024 * 1024 // 100MB
    };
  }

  initializeClients() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }

    if (!this.openai && !this.anthropic) {
      logger.warn('No multimodal AI providers configured.');
    }
  }

  /**
   * Comprehensive image analysis with multiple AI providers
   */
  async analyzeImage(imageFile, options = {}) {
    const {
      provider = 'auto',
      analysis_types = ['description', 'objects', 'text', 'faces', 'sentiment'],
      detail_level = 'high',
      custom_prompt,
      include_metadata = true,
      userId,
      language = 'en'
    } = options;

    await this.validateFile(imageFile, 'image');

    const analysisId = this.generateAnalysisId();
    const startTime = Date.now();

    try {
      // Convert image to base64 for API calls
      const imageData = await this.prepareImageForAnalysis(imageFile, detail_level);
      
      const analysisSession = {
        id: analysisId,
        userId,
        type: 'image_analysis',
        status: 'processing',
        startTime,
        file: {
          name: imageFile.originalname,
          size: imageFile.size,
          type: imageFile.mimetype
        }
      };

      this.processingQueue.set(analysisId, analysisSession);

      // Perform multiple analysis types
      const results = {};

      // Basic description
      if (analysis_types.includes('description')) {
        results.description = await this.getImageDescription(imageData, {
          provider,
          custom_prompt,
          language,
          detail_level
        });
      }

      // Object detection
      if (analysis_types.includes('objects')) {
        results.objects = await this.detectObjects(imageData, { provider });
      }

      // Text extraction (OCR)
      if (analysis_types.includes('text')) {
        results.text = await this.extractTextFromImage(imageData, { language });
      }

      // Face detection
      if (analysis_types.includes('faces')) {
        results.faces = await this.detectFaces(imageData);
      }

      // Sentiment analysis of visual content
      if (analysis_types.includes('sentiment')) {
        results.sentiment = await this.analyzeSentiment(imageData);
      }

      // Scene analysis
      if (analysis_types.includes('scene')) {
        results.scene = await this.analyzeScene(imageData);
      }

      // Color analysis
      if (analysis_types.includes('colors')) {
        results.colors = await this.analyzeColors(imageData);
      }

      // Safety and content moderation
      if (analysis_types.includes('safety')) {
        results.safety = await this.moderateContent(imageData);
      }

      // Extract metadata if requested
      let metadata = null;
      if (include_metadata) {
        metadata = await this.extractImageMetadata(imageFile);
      }

      const duration = Date.now() - startTime;

      const analysisResult = {
        id: analysisId,
        file: {
          name: imageFile.originalname,
          size: imageFile.size,
          type: imageFile.mimetype,
          metadata
        },
        analysis: results,
        processing: {
          duration,
          provider: provider === 'auto' ? this.selectBestProvider('vision') : provider,
          timestamp: new Date().toISOString()
        },
        confidence: this.calculateOverallConfidence(results)
      };

      // Update session
      analysisSession.status = 'completed';
      analysisSession.result = analysisResult;
      analysisSession.duration = duration;

      logger.info('Image analysis completed', {
        analysisId,
        userId,
        duration,
        analysisTypes: analysis_types,
        fileSize: imageFile.size
      });

      this.emit('analysis:completed', { analysisId, result: analysisResult, userId });

      return analysisResult;

    } catch (error) {
      const session = this.processingQueue.get(analysisId);
      if (session) {
        session.status = 'failed';
        session.error = error.message;
        session.duration = Date.now() - startTime;
      }

      logger.error('Image analysis failed', {
        analysisId,
        userId,
        error: error.message,
        duration: Date.now() - startTime
      });

      this.emit('analysis:failed', { analysisId, error, userId });

      throw ApiError.internalServerError(`Image analysis failed: ${error.message}`);
    } finally {
      // Clean up processing queue after delay
      setTimeout(() => {
        this.processingQueue.delete(analysisId);
      }, 300000); // Keep for 5 minutes
    }
  }

  /**
   * Advanced document processing and analysis
   */
  async processDocument(documentFile, options = {}) {
    const {
      analysis_types = ['extraction', 'summary', 'entities', 'sentiment'],
      extract_images = true,
      extract_tables = true,
      preserve_formatting = true,
      language = 'auto',
      custom_prompt,
      userId
    } = options;

    await this.validateFile(documentFile, 'document');

    const processingId = this.generateProcessingId();
    const startTime = Date.now();

    try {
      const processingSession = {
        id: processingId,
        userId,
        type: 'document_processing',
        status: 'processing',
        startTime,
        file: {
          name: documentFile.originalname,
          size: documentFile.size,
          type: documentFile.mimetype
        }
      };

      this.processingQueue.set(processingId, processingSession);

      // Extract content based on file type
      const extractedContent = await this.extractDocumentContent(documentFile, {
        extract_images,
        extract_tables,
        preserve_formatting
      });

      const results = {};

      // Text extraction and basic analysis
      if (analysis_types.includes('extraction')) {
        results.content = extractedContent;
      }

      // Document summarization
      if (analysis_types.includes('summary')) {
        results.summary = await this.summarizeDocument(extractedContent.text, {
          language,
          custom_prompt
        });
      }

      // Named entity recognition
      if (analysis_types.includes('entities')) {
        results.entities = await this.extractEntities(extractedContent.text, { language });
      }

      // Sentiment analysis
      if (analysis_types.includes('sentiment')) {
        results.sentiment = await this.analyzeDocumentSentiment(extractedContent.text);
      }

      // Key topics extraction
      if (analysis_types.includes('topics')) {
        results.topics = await this.extractTopics(extractedContent.text);
      }

      // Document classification
      if (analysis_types.includes('classification')) {
        results.classification = await this.classifyDocument(extractedContent.text);
      }

      // Language detection
      if (analysis_types.includes('language')) {
        results.language = await this.detectLanguage(extractedContent.text);
      }

      // Quality assessment
      if (analysis_types.includes('quality')) {
        results.quality = await this.assessDocumentQuality(extractedContent);
      }

      const duration = Date.now() - startTime;

      const processingResult = {
        id: processingId,
        file: {
          name: documentFile.originalname,
          size: documentFile.size,
          type: documentFile.mimetype,
          pages: extractedContent.metadata?.pages || null
        },
        analysis: results,
        processing: {
          duration,
          timestamp: new Date().toISOString(),
          extracted_elements: {
            text_length: extractedContent.text?.length || 0,
            images: extractedContent.images?.length || 0,
            tables: extractedContent.tables?.length || 0
          }
        }
      };

      // Update session
      processingSession.status = 'completed';
      processingSession.result = processingResult;
      processingSession.duration = duration;

      logger.info('Document processing completed', {
        processingId,
        userId,
        duration,
        analysisTypes: analysis_types,
        textLength: extractedContent.text?.length || 0
      });

      this.emit('processing:completed', { processingId, result: processingResult, userId });

      return processingResult;

    } catch (error) {
      const session = this.processingQueue.get(processingId);
      if (session) {
        session.status = 'failed';
        session.error = error.message;
        session.duration = Date.now() - startTime;
      }

      logger.error('Document processing failed', {
        processingId,
        userId,
        error: error.message,
        duration: Date.now() - startTime
      });

      this.emit('processing:failed', { processingId, error, userId });

      throw ApiError.internalServerError(`Document processing failed: ${error.message}`);
    }
  }

  /**
   * Video analysis and frame extraction
   */
  async analyzeVideo(videoFile, options = {}) {
    const {
      analysis_types = ['frames', 'audio', 'objects', 'activity'],
      frame_interval = 30, // Extract frame every 30 seconds
      max_frames = 20,
      extract_audio = true,
      detect_scenes = true,
      custom_prompt,
      userId
    } = options;

    await this.validateFile(videoFile, 'video');

    const analysisId = this.generateAnalysisId();
    const startTime = Date.now();

    try {
      const analysisSession = {
        id: analysisId,
        userId,
        type: 'video_analysis',
        status: 'processing',
        startTime,
        file: {
          name: videoFile.originalname,
          size: videoFile.size,
          type: videoFile.mimetype
        }
      };

      this.processingQueue.set(analysisId, analysisSession);

      const results = {};

      // Extract video metadata
      const videoMetadata = await this.extractVideoMetadata(videoFile);
      results.metadata = videoMetadata;

      // Frame extraction and analysis
      if (analysis_types.includes('frames')) {
        const frames = await this.extractVideoFrames(videoFile, {
          interval: frame_interval,
          max_frames
        });
        
        results.frames = await Promise.all(frames.map(async (frame, index) => {
          const frameAnalysis = await this.analyzeImage(frame, {
            analysis_types: ['description', 'objects'],
            detail_level: 'low'
          });

          return {
            timestamp: index * frame_interval,
            analysis: frameAnalysis.analysis
          };
        }));
      }

      // Audio extraction and transcription
      if (analysis_types.includes('audio') && extract_audio) {
        const audioTrack = await this.extractVideoAudio(videoFile);
        if (audioTrack) {
          results.audio = await this.transcribeVideoAudio(audioTrack);
        }
      }

      // Object tracking across frames
      if (analysis_types.includes('objects')) {
        results.object_tracking = await this.trackObjectsInVideo(videoFile, {
          frame_interval
        });
      }

      // Activity and motion detection
      if (analysis_types.includes('activity')) {
        results.activity = await this.detectVideoActivity(videoFile);
      }

      // Scene detection
      if (detect_scenes) {
        results.scenes = await this.detectVideoScenes(videoFile);
      }

      // Video summarization
      if (analysis_types.includes('summary')) {
        results.summary = await this.summarizeVideo(results, custom_prompt);
      }

      const duration = Date.now() - startTime;

      const analysisResult = {
        id: analysisId,
        file: {
          name: videoFile.originalname,
          size: videoFile.size,
          type: videoFile.mimetype,
          duration: videoMetadata.duration,
          resolution: videoMetadata.resolution
        },
        analysis: results,
        processing: {
          duration,
          timestamp: new Date().toISOString()
        }
      };

      // Update session
      analysisSession.status = 'completed';
      analysisSession.result = analysisResult;
      analysisSession.duration = duration;

      logger.info('Video analysis completed', {
        analysisId,
        userId,
        duration,
        videoDuration: videoMetadata.duration,
        analysisTypes: analysis_types
      });

      this.emit('analysis:completed', { analysisId, result: analysisResult, userId });

      return analysisResult;

    } catch (error) {
      const session = this.processingQueue.get(analysisId);
      if (session) {
        session.status = 'failed';
        session.error = error.message;
        session.duration = Date.now() - startTime;
      }

      logger.error('Video analysis failed', {
        analysisId,
        userId,
        error: error.message,
        duration: Date.now() - startTime
      });

      throw ApiError.internalServerError(`Video analysis failed: ${error.message}`);
    }
  }

  /**
   * Multi-file batch processing
   */
  async processBatch(files, options = {}) {
    const {
      userId,
      processing_options = {},
      priority = 'normal',
      webhook_url
    } = options;

    const batchId = this.generateBatchId();
    const batchSession = {
      id: batchId,
      userId,
      status: 'processing',
      files: files.map(file => ({
        id: this.generateFileId(),
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
        status: 'pending'
      })),
      results: [],
      progress: {
        total: files.length,
        completed: 0,
        failed: 0,
        percentage: 0
      },
      startTime: Date.now(),
      webhook_url
    };

    this.processingQueue.set(batchId, batchSession);

    // Process files concurrently with controlled concurrency
    this.processBatchFiles(batchId, files, processing_options);

    return {
      batchId,
      status: batchSession.status,
      fileCount: files.length
    };
  }

  // Helper Methods

  async validateFile(file, type) {
    if (!file) {
      throw ApiError.badRequest('No file provided');
    }

    const maxSize = this.maxFileSize[type] || 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw ApiError.badRequest(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
    }

    const ext = path.extname(file.originalname || '').toLowerCase().slice(1);
    let supportedFormats;

    switch (type) {
      case 'image':
        supportedFormats = this.supportedImageFormats;
        break;
      case 'document':
        supportedFormats = this.supportedDocumentFormats;
        break;
      case 'video':
        supportedFormats = this.supportedVideoFormats;
        break;
      default:
        throw ApiError.badRequest('Unsupported file type');
    }

    if (!supportedFormats.includes(ext)) {
      throw ApiError.badRequest(`Unsupported ${type} format. Supported: ${supportedFormats.join(', ')}`);
    }

    return true;
  }

  async prepareImageForAnalysis(imageFile, detailLevel) {
    // Convert image to base64 and optimize based on detail level
    const imageBuffer = await fs.readFile(imageFile.path);
    let processedBuffer = imageBuffer;

    // Resize if needed for API limits
    if (detailLevel === 'low' && imageBuffer.length > 1024 * 1024) {
      // Mock resize for low detail - in reality would use image processing library
      processedBuffer = imageBuffer.slice(0, 1024 * 1024);
    }

    return {
      buffer: processedBuffer,
      base64: processedBuffer.toString('base64'),
      mimeType: imageFile.mimetype
    };
  }

  async getImageDescription(imageData, options) {
    const { provider, custom_prompt, language, detail_level } = options;

    const prompt = custom_prompt || `Describe this image in detail. Focus on objects, people, activities, setting, and mood. Respond in ${language}.`;

    try {
      if (provider === 'openai' || (!provider && this.openai)) {
        const response = await this.openai.chat.completions.create({
          model: "gpt-4-vision-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${imageData.mimeType};base64,${imageData.base64}`,
                    detail: detail_level
                  }
                }
              ]
            }
          ],
          max_tokens: 1000
        });

        return {
          text: response.choices[0].message.content,
          confidence: 0.9,
          provider: 'openai'
        };
      } else if (provider === 'anthropic' || (!provider && this.anthropic)) {
        const response = await this.anthropic.messages.create({
          model: "claude-3-sonnet-20240229",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: imageData.mimeType,
                    data: imageData.base64
                  }
                },
                { type: "text", text: prompt }
              ]
            }
          ]
        });

        return {
          text: response.content[0].text,
          confidence: 0.9,
          provider: 'anthropic'
        };
      }
    } catch (error) {
      logger.error('Image description failed', { error: error.message, provider });
      throw error;
    }

    throw ApiError.serviceUnavailable('No vision-capable AI provider available');
  }

  async detectObjects(imageData, options) {
    // Mock object detection - in reality would use specialized CV models
    return {
      objects: [
        { name: 'person', confidence: 0.95, bbox: [100, 100, 200, 300] },
        { name: 'car', confidence: 0.87, bbox: [300, 150, 500, 250] }
      ],
      count: 2,
      provider: 'mock'
    };
  }

  async extractTextFromImage(imageData, options) {
    // Mock OCR - in reality would use OCR service like Tesseract or cloud OCR
    return {
      text: "Sample extracted text from image",
      confidence: 0.82,
      regions: [
        { text: "Sample extracted text", bbox: [50, 50, 300, 80], confidence: 0.85 },
        { text: "from image", bbox: [50, 90, 150, 110], confidence: 0.79 }
      ],
      language: options.language || 'en'
    };
  }

  async detectFaces(imageData) {
    // Mock face detection
    return {
      faces: [
        {
          bbox: [150, 100, 250, 200],
          confidence: 0.97,
          attributes: {
            age: { range: '25-35', confidence: 0.8 },
            gender: { value: 'female', confidence: 0.85 },
            emotion: { value: 'happy', confidence: 0.9 }
          }
        }
      ],
      count: 1
    };
  }

  async analyzeSentiment(imageData) {
    // Mock visual sentiment analysis
    return {
      overall: { sentiment: 'positive', confidence: 0.8 },
      elements: [
        { type: 'facial_expression', sentiment: 'happy', confidence: 0.9 },
        { type: 'color_palette', sentiment: 'warm', confidence: 0.7 },
        { type: 'scene_composition', sentiment: 'peaceful', confidence: 0.6 }
      ]
    };
  }

  async analyzeScene(imageData) {
    // Mock scene analysis
    return {
      scene_type: 'outdoor',
      confidence: 0.88,
      location: 'park',
      time_of_day: 'afternoon',
      weather: 'sunny',
      activities: ['walking', 'sitting'],
      atmosphere: 'relaxed'
    };
  }

  async analyzeColors(imageData) {
    // Mock color analysis
    return {
      dominant_colors: [
        { color: '#4A90E2', percentage: 35, name: 'blue' },
        { color: '#7ED321', percentage: 25, name: 'green' },
        { color: '#F5A623', percentage: 20, name: 'orange' }
      ],
      color_harmony: 'complementary',
      brightness: 'medium',
      saturation: 'high'
    };
  }

  async moderateContent(imageData) {
    // Mock content moderation
    return {
      safe: true,
      categories: {
        adult: { flagged: false, confidence: 0.02 },
        violence: { flagged: false, confidence: 0.01 },
        hate: { flagged: false, confidence: 0.00 },
        selfHarm: { flagged: false, confidence: 0.00 }
      },
      overall_risk: 'low'
    };
  }

  async extractImageMetadata(imageFile) {
    // Mock metadata extraction - in reality would use exif libraries
    return {
      dimensions: { width: 1920, height: 1080 },
      format: 'JPEG',
      fileSize: imageFile.size,
      colorSpace: 'sRGB',
      camera: {
        make: 'Canon',
        model: 'EOS 5D Mark IV',
        settings: {
          aperture: 'f/2.8',
          shutter: '1/250',
          iso: 400
        }
      },
      location: {
        latitude: 37.7749,
        longitude: -122.4194
      },
      timestamp: new Date().toISOString()
    };
  }

  async extractDocumentContent(documentFile, options) {
    // Mock document content extraction
    // In reality would use libraries like pdf-parse, mammoth, etc.
    return {
      text: "This is the extracted text content from the document...",
      images: options.extract_images ? [
        { page: 1, position: { x: 100, y: 200 }, size: { width: 300, height: 200 } }
      ] : [],
      tables: options.extract_tables ? [
        { page: 1, data: [['Name', 'Age'], ['John', '30'], ['Jane', '25']] }
      ] : [],
      metadata: {
        pages: 5,
        author: 'Sample Author',
        title: 'Sample Document',
        created: new Date().toISOString()
      }
    };
  }

  // More helper methods would continue here...
  // For brevity, I'll include the key infrastructure methods

  selectBestProvider(capability) {
    if (capability === 'vision') {
      return this.openai ? 'openai' : (this.anthropic ? 'anthropic' : null);
    }
    return 'openai';
  }

  calculateOverallConfidence(results) {
    const confidences = [];
    
    Object.values(results).forEach(result => {
      if (result && result.confidence) {
        confidences.push(result.confidence);
      }
    });

    return confidences.length > 0 
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length 
      : null;
  }

  // ID generators
  generateAnalysisId() {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateProcessingId() {
    return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateFileId() {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Status methods
  getProcessingStatus(id) {
    return this.processingQueue.get(id);
  }

  getActiveProcessing() {
    return Array.from(this.processingQueue.values());
  }
}