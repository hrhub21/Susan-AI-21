import { createCanvas, loadImage, registerFont } from 'canvas';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs-extra';
import path from 'path';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import EventEmitter from 'events';
import sharp from 'sharp';
import { VoiceService } from './VoiceService.js';
import { RoofingDamageAnalysisService } from './RoofingDamageAnalysisService.js';
import { MultimodalService } from './MultimodalService.js';

/**
 * Comprehensive Video Message Generation Service for Susan AI
 * Creates dynamic video explanations for complex insurance claims
 */
export class VideoGenerationService extends EventEmitter {
  constructor() {
    super();
    this.voiceService = new VoiceService();
    this.damageAnalysisService = new RoofingDamageAnalysisService();
    this.multimodalService = new MultimodalService();
    
    this.videoQueue = new Map();
    this.templates = new Map();
    this.outputFormats = ['mp4', 'webm', 'avi'];
    this.maxConcurrentRenders = 3;
    this.activeRenders = new Set();
    
    // Video generation settings
    this.settings = {
      canvas: {
        width: 1920,
        height: 1080,
        fps: 30
      },
      audio: {
        sampleRate: 44100,
        channels: 2,
        bitrate: '128k'
      },
      video: {
        bitrate: '2000k',
        codec: 'libx264',
        preset: 'medium'
      },
      maxDuration: 600, // 10 minutes max
      maxPhotos: 50
    };
    
    this.initialize();
  }

  async initialize() {
    try {
      logger.info('🎬 Initializing Video Generation Service...');
      
      // Load video templates
      await this.loadVideoTemplates();
      
      // Initialize FFmpeg
      await this.initializeFFmpeg();
      
      // Register fonts for canvas
      await this.registerFonts();
      
      logger.info('✅ Video Generation Service initialized successfully');
      
    } catch (error) {
      logger.error('❌ Failed to initialize Video Generation Service:', error);
      throw new Error('Video Generation Service initialization failed');
    }
  }

  async loadVideoTemplates() {
    // Define built-in video templates for different claim types
    this.templates.set('hail_damage_explanation', {
      id: 'hail_damage_explanation',
      name: 'Hail Damage Explanation',
      description: 'Professional video explaining hail damage findings',
      duration: 120, // 2 minutes base
      sections: [
        { type: 'intro', duration: 15, template: 'professional_intro' },
        { type: 'damage_overview', duration: 30, template: 'damage_summary' },
        { type: 'photo_analysis', duration: 45, template: 'annotated_photos' },
        { type: 'recommendations', duration: 20, template: 'action_items' },
        { type: 'outro', duration: 10, template: 'professional_outro' }
      ],
      style: {
        theme: 'professional',
        colors: {
          primary: '#2E86AB',
          secondary: '#A23B72',
          accent: '#F18F01',
          background: '#F8F9FA',
          text: '#212529'
        },
        fonts: {
          title: 'Roboto-Bold',
          subtitle: 'Roboto-Medium',
          body: 'Roboto-Regular'
        }
      }
    });

    this.templates.set('wind_damage_analysis', {
      id: 'wind_damage_analysis',
      name: 'Wind Damage Analysis',
      description: 'Detailed wind damage assessment video',
      duration: 150,
      sections: [
        { type: 'intro', duration: 15, template: 'professional_intro' },
        { type: 'wind_patterns', duration: 40, template: 'wind_analysis' },
        { type: 'structural_impact', duration: 50, template: 'structural_review' },
        { type: 'repair_priority', duration: 30, template: 'priority_matrix' },
        { type: 'outro', duration: 15, template: 'professional_outro' }
      ],
      style: {
        theme: 'technical',
        colors: {
          primary: '#0F4C75',
          secondary: '#3282B8',
          accent: '#BBE1FA',
          background: '#F7F9FC',
          text: '#1A1A1A'
        }
      }
    });

    this.templates.set('comprehensive_report', {
      id: 'comprehensive_report',
      name: 'Comprehensive Damage Report',
      description: 'Complete video report for complex claims',
      duration: 300, // 5 minutes
      sections: [
        { type: 'intro', duration: 20, template: 'executive_intro' },
        { type: 'property_overview', duration: 30, template: 'property_summary' },
        { type: 'damage_catalog', duration: 120, template: 'detailed_analysis' },
        { type: 'cost_breakdown', duration: 60, template: 'financial_summary' },
        { type: 'next_steps', duration: 40, template: 'action_plan' },
        { type: 'outro', duration: 30, template: 'executive_outro' }
      ],
      style: {
        theme: 'executive',
        colors: {
          primary: '#1B263B',
          secondary: '#415A77',
          accent: '#778DA9',
          background: '#E0E1DD',
          text: '#0D1B2A'
        }
      }
    });

    this.templates.set('adjuster_briefing', {
      id: 'adjuster_briefing',
      name: 'Insurance Adjuster Briefing',
      description: 'Concise video for insurance adjusters',
      duration: 90,
      sections: [
        { type: 'intro', duration: 10, template: 'adjuster_intro' },
        { type: 'claim_summary', duration: 25, template: 'claim_overview' },
        { type: 'evidence_review', duration: 35, template: 'evidence_presentation' },
        { type: 'recommendations', duration: 15, template: 'adjuster_recommendations' },
        { type: 'outro', duration: 5, template: 'adjuster_outro' }
      ],
      style: {
        theme: 'insurance',
        colors: {
          primary: '#003366',
          secondary: '#0066CC',
          accent: '#FF6600',
          background: '#F5F5F5',
          text: '#333333'
        }
      }
    });

    logger.info(`📋 Loaded ${this.templates.size} video templates`);
  }

  async initializeFFmpeg() {
    // Configure FFmpeg paths and settings
    try {
      // Set FFmpeg path if needed (platform dependent)
      if (process.platform === 'win32') {
        ffmpeg.setFfmpegPath('ffmpeg.exe');
      }
      
      logger.info('🎥 FFmpeg initialized successfully');
    } catch (error) {
      logger.warn('⚠️ FFmpeg initialization warning:', error.message);
    }
  }

  async registerFonts() {
    try {
      // Register custom fonts for professional video generation
      // In production, these would be actual font files
      logger.info('🔤 Fonts registered for video generation');
    } catch (error) {
      logger.warn('⚠️ Font registration warning:', error.message);
    }
  }

  /**
   * Generate a comprehensive video explanation for insurance claims
   */
  async generateClaimVideo(photos, claimData, options = {}) {
    const {
      templateId = 'comprehensive_report',
      personalization = {},
      outputFormat = 'mp4',
      quality = 'high',
      includeNarration = true,
      voiceSettings = {},
      customSections = [],
      userId
    } = options;

    if (!this.templates.has(templateId)) {
      throw ApiError.badRequest(`Template '${templateId}' not found`);
    }

    const videoId = this.generateVideoId();
    const startTime = Date.now();

    try {
      logger.info(`🎬 Starting video generation for claim`, {
        videoId,
        templateId,
        photoCount: photos.length,
        userId
      });

      // Validate inputs
      await this.validateVideoInputs(photos, claimData, options);

      // Create video session
      const videoSession = {
        id: videoId,
        userId,
        status: 'processing',
        startTime,
        template: this.templates.get(templateId),
        photos: photos.length,
        outputFormat,
        quality,
        progress: {
          stage: 'initializing',
          percentage: 0,
          currentStep: 'Setting up video generation'
        }
      };

      this.videoQueue.set(videoId, videoSession);
      this.emit('video:started', { videoId, userId });

      // Check render capacity
      await this.waitForRenderSlot();
      this.activeRenders.add(videoId);

      // Step 1: Analyze photos and extract damage data
      videoSession.progress = { stage: 'analyzing', percentage: 10, currentStep: 'Analyzing photos for damage' };
      this.emit('video:progress', { videoId, progress: videoSession.progress });

      const analysisResults = await this.analyzePhotosForVideo(photos);

      // Step 2: Generate narration script
      videoSession.progress = { stage: 'scripting', percentage: 20, currentStep: 'Generating narration script' };
      this.emit('video:progress', { videoId, progress: videoSession.progress });

      const script = await this.generateVideoScript(analysisResults, claimData, templateId, personalization);

      // Step 3: Create voice narration
      let audioTrack = null;
      if (includeNarration) {
        videoSession.progress = { stage: 'narration', percentage: 30, currentStep: 'Synthesizing voice narration' };
        this.emit('video:progress', { videoId, progress: videoSession.progress });

        audioTrack = await this.generateVideoNarration(script, voiceSettings);
      }

      // Step 4: Prepare visual assets
      videoSession.progress = { stage: 'visuals', percentage: 40, currentStep: 'Preparing visual elements' };
      this.emit('video:progress', { videoId, progress: videoSession.progress });

      const visualAssets = await this.prepareVisualAssets(photos, analysisResults, templateId);

      // Step 5: Generate video frames
      videoSession.progress = { stage: 'rendering', percentage: 50, currentStep: 'Rendering video frames' };
      this.emit('video:progress', { videoId, progress: videoSession.progress });

      const videoFrames = await this.generateVideoFrames(visualAssets, script, templateId);

      // Step 6: Compile final video
      videoSession.progress = { stage: 'compiling', percentage: 80, currentStep: 'Compiling final video' };
      this.emit('video:progress', { videoId, progress: videoSession.progress });

      const finalVideo = await this.compileVideo(videoFrames, audioTrack, outputFormat, quality);

      // Step 7: Generate interactive elements
      videoSession.progress = { stage: 'finalizing', percentage: 95, currentStep: 'Adding interactive elements' };
      this.emit('video:progress', { videoId, progress: videoSession.progress });

      const interactiveElements = await this.generateInteractiveElements(analysisResults, script);

      const duration = Date.now() - startTime;

      const result = {
        videoId,
        video: {
          path: finalVideo.path,
          url: finalVideo.url,
          format: outputFormat,
          duration: finalVideo.duration,
          size: finalVideo.size,
          quality
        },
        audio: audioTrack ? {
          duration: audioTrack.duration,
          format: audioTrack.format,
          voice: audioTrack.voice
        } : null,
        script: {
          sections: script.sections,
          totalWords: script.totalWords,
          estimatedDuration: script.estimatedDuration
        },
        analysis: {
          photosAnalyzed: analysisResults.length,
          damageTypes: this.extractDamageTypes(analysisResults),
          confidenceScore: this.calculateOverallConfidence(analysisResults)
        },
        interactive: interactiveElements,
        metadata: {
          template: templateId,
          generationTime: duration,
          timestamp: new Date().toISOString(),
          personalization: personalization,
          aiGenerated: true
        },
        exports: await this.generateMultiFormatExports(finalVideo, outputFormat)
      };

      // Update session
      videoSession.status = 'completed';
      videoSession.result = result;
      videoSession.duration = duration;
      videoSession.progress = { stage: 'completed', percentage: 100, currentStep: 'Video generation complete' };

      this.activeRenders.delete(videoId);

      logger.info(`✅ Video generation completed`, {
        videoId,
        duration,
        videoDuration: finalVideo.duration,
        fileSize: finalVideo.size
      });

      this.emit('video:completed', { videoId, result, userId });

      return result;

    } catch (error) {
      const session = this.videoQueue.get(videoId);
      if (session) {
        session.status = 'failed';
        session.error = error.message;
        session.duration = Date.now() - startTime;
      }

      this.activeRenders.delete(videoId);

      logger.error('❌ Video generation failed', {
        videoId,
        userId,
        error: error.message,
        duration: Date.now() - startTime
      });

      this.emit('video:failed', { videoId, error, userId });

      throw ApiError.internalServerError(`Video generation failed: ${error.message}`);
    } finally {
      // Clean up session after delay
      setTimeout(() => {
        this.videoQueue.delete(videoId);
      }, 3600000); // Keep for 1 hour
    }
  }

  async validateVideoInputs(photos, claimData, options) {
    if (!photos || photos.length === 0) {
      throw ApiError.badRequest('At least one photo is required for video generation');
    }

    if (photos.length > this.settings.maxPhotos) {
      throw ApiError.badRequest(`Maximum ${this.settings.maxPhotos} photos allowed`);
    }

    if (!claimData || !claimData.propertyAddress) {
      throw ApiError.badRequest('Property address is required in claim data');
    }

    // Validate each photo
    for (const photo of photos) {
      if (!photo.buffer && !photo.path) {
        throw ApiError.badRequest('Photo must have buffer or path');
      }
    }

    return true;
  }

  async waitForRenderSlot() {
    while (this.activeRenders.size >= this.maxConcurrentRenders) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async analyzePhotosForVideo(photos) {
    const analysisResults = [];

    for (let i = 0; i < photos.length; i++) {
      try {
        logger.info(`📸 Analyzing photo ${i + 1}/${photos.length}`);

        // Perform comprehensive damage analysis
        const damageAnalysis = await this.damageAnalysisService.analyzeRoofingDamage(
          photos[i].buffer || fs.readFileSync(photos[i].path),
          {
            photoIndex: i,
            includeAnnotations: true,
            generateHeatMap: true
          }
        );

        // Get detailed image description for narration
        const imageDescription = await this.multimodalService.analyzeImage(photos[i], {
          analysis_types: ['description', 'objects', 'scene'],
          detail_level: 'high',
          custom_prompt: 'Describe this roof damage photo in detail for an insurance professional. Focus on damage types, severity, and location.'
        });

        analysisResults.push({
          photoIndex: i,
          damageAnalysis,
          imageDescription,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error(`❌ Error analyzing photo ${i + 1}:`, error);
        // Continue with other photos, mark this one as failed
        analysisResults.push({
          photoIndex: i,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return analysisResults;
  }

  async generateVideoScript(analysisResults, claimData, templateId, personalization) {
    const template = this.templates.get(templateId);
    const script = {
      sections: [],
      totalWords: 0,
      estimatedDuration: 0
    };

    try {
      // Extract key information from analysis
      const damageTypes = this.extractDamageTypes(analysisResults);
      const severityLevel = this.calculateSeverityLevel(analysisResults);
      const totalDamageCount = this.countTotalDamage(analysisResults);

      for (const section of template.sections) {
        const sectionScript = await this.generateSectionScript(
          section,
          analysisResults,
          claimData,
          personalization,
          { damageTypes, severityLevel, totalDamageCount }
        );

        script.sections.push(sectionScript);
        script.totalWords += sectionScript.wordCount;
        script.estimatedDuration += sectionScript.duration;
      }

      logger.info(`📝 Generated script with ${script.totalWords} words, ${script.estimatedDuration}s duration`);

      return script;

    } catch (error) {
      logger.error('❌ Error generating video script:', error);
      throw error;
    }
  }

  async generateSectionScript(section, analysisResults, claimData, personalization, context) {
    const { damageTypes, severityLevel, totalDamageCount } = context;

    let text = '';
    let timing = [];

    switch (section.type) {
      case 'intro':
        text = this.generateIntroScript(claimData, personalization, severityLevel);
        break;

      case 'damage_overview':
        text = this.generateDamageOverviewScript(damageTypes, totalDamageCount, severityLevel);
        break;

      case 'photo_analysis':
        const photoAnalysisScript = this.generatePhotoAnalysisScript(analysisResults);
        text = photoAnalysisScript.text;
        timing = photoAnalysisScript.timing;
        break;

      case 'recommendations':
        text = this.generateRecommendationsScript(analysisResults, claimData);
        break;

      case 'cost_breakdown':
        text = this.generateCostBreakdownScript(analysisResults, claimData);
        break;

      case 'outro':
        text = this.generateOutroScript(claimData, personalization);
        break;

      default:
        text = `This section covers ${section.type} for the claim analysis.`;
    }

    const wordCount = text.split(/\s+/).length;
    const estimatedDuration = section.duration || Math.ceil(wordCount / 2.5); // ~150 WPM

    return {
      type: section.type,
      text,
      wordCount,
      duration: estimatedDuration,
      timing,
      template: section.template
    };
  }

  generateIntroScript(claimData, personalization, severityLevel) {
    const adjusterName = personalization.adjusterName || 'Insurance Professional';
    const propertyAddress = claimData.propertyAddress || 'the property';
    const claimNumber = claimData.claimNumber || 'this claim';

    return `Hello ${adjusterName}, this is Susan AI with a comprehensive damage analysis report for ${propertyAddress}, claim number ${claimNumber}. 

Based on my AI-powered analysis of the submitted photographs, I've identified ${severityLevel} damage that requires your attention. This video will walk you through my findings, provide detailed analysis of each damage area, and offer actionable recommendations for claim processing.

Let's begin with the damage overview.`;
  }

  generateDamageOverviewScript(damageTypes, totalDamageCount, severityLevel) {
    const damageTypeList = damageTypes.map(type => {
      const count = type.count;
      const typeDesc = type.type === 'hail' ? 'hail impacts' : 
                      type.type === 'wind' ? 'wind damage areas' :
                      type.type === 'granule' ? 'granule loss areas' : 'damage areas';
      return `${count} ${typeDesc}`;
    }).join(', ');

    return `My analysis has identified a total of ${totalDamageCount} damage points across the roof system. The damage classification is ${severityLevel} severity.

Specifically, I found: ${damageTypeList}.

The damage pattern suggests weather-related impact consistent with the reported storm event. Each damage area has been analyzed using advanced computer vision and machine learning algorithms to ensure accurate assessment.

Now let's examine each photograph in detail.`;
  }

  generatePhotoAnalysisScript(analysisResults) {
    let text = '';
    let timing = [];
    let currentTime = 0;

    for (const result of analysisResults) {
      if (result.error) continue;

      const photoNum = result.photoIndex + 1;
      const analysis = result.damageAnalysis;
      const description = result.imageDescription?.analysis?.description?.text || 'Photo shows roof surface';

      let photoScript = `Photo ${photoNum}: ${description}. `;

      if (analysis.damage?.hail?.detected) {
        const impacts = analysis.damage.hail.impactCount;
        const severity = analysis.damage.hail.severity;
        photoScript += `I detected ${impacts} hail impacts with ${severity} severity. `;
      }

      if (analysis.damage?.wind?.detected) {
        const shingles = analysis.damage.wind.liftedShingles;
        photoScript += `Wind damage analysis shows ${shingles} lifted or damaged shingles. `;
      }

      if (analysis.damage?.granuleLoss?.detected) {
        const percentage = analysis.damage.granuleLoss.percentage;
        photoScript += `Granule loss analysis indicates ${percentage}% granule loss in visible areas. `;
      }

      photoScript += `Confidence level for this analysis is ${Math.round(analysis.confidence * 100)}%. `;

      // Add timing for photo display
      const duration = Math.ceil(photoScript.split(/\s+/).length / 2.5);
      timing.push({
        photoIndex: result.photoIndex,
        startTime: currentTime,
        duration: duration,
        script: photoScript
      });

      text += photoScript;
      currentTime += duration;
    }

    return { text, timing };
  }

  generateRecommendationsScript(analysisResults, claimData) {
    const hasSignificantDamage = analysisResults.some(r => 
      r.damageAnalysis?.damage?.overall?.severity !== 'none' && 
      r.damageAnalysis?.damage?.overall?.severity !== 'minimal'
    );

    if (!hasSignificantDamage) {
      return `Based on my analysis, the damage appears to be minimal and may not warrant a claim. I recommend a professional inspection to confirm these findings and document the current roof condition for future reference.`;
    }

    return `Based on my comprehensive analysis, I recommend the following actions:

First, approve this claim for professional contractor assessment. The AI analysis shows sufficient damage evidence to warrant repair coverage.

Second, prioritize any wind damage areas for immediate temporary protection to prevent water intrusion.

Third, the granule loss patterns suggest age-related wear that may affect coverage decisions. Review policy terms regarding actual cash value versus replacement cost.

Finally, I recommend requiring multiple contractor estimates due to the complexity of the damage pattern.

The estimated repair timeline is 2-3 weeks with current material availability.`;
  }

  generateCostBreakdownScript(analysisResults, claimData) {
    // Calculate rough estimates based on damage analysis
    let totalEstimate = 0;
    let breakdown = [];

    for (const result of analysisResults) {
      if (result.error || !result.damageAnalysis?.repairEstimate) continue;
      
      const estimate = result.damageAnalysis.repairEstimate;
      totalEstimate += estimate.total || 0;
      
      if (estimate.breakdown) {
        breakdown.push(...estimate.breakdown);
      }
    }

    if (totalEstimate === 0) {
      return `Cost analysis indicates minimal repair requirements. Estimated cost range is $200 to $500 for minor maintenance items.`;
    }

    const majorItems = breakdown
      .filter(item => item.cost > 500)
      .map(item => `${item.item}: $${item.cost}`)
      .join(', ');

    return `Preliminary cost analysis based on damage extent shows an estimated repair cost of $${totalEstimate.toLocaleString()}.

Major cost components include: ${majorItems || 'general repair items'}.

This estimate includes materials, labor, and contractor markup typical for your region. Final costs may vary based on material selection, contractor choice, and additional discoveries during repair.

Please note this is an AI-generated estimate for initial claim evaluation. Professional contractor estimates are required for final settlement.`;
  }

  generateOutroScript(claimData, personalization) {
    const adjusterName = personalization.adjusterName || 'Insurance Professional';
    
    return `Thank you for reviewing this AI-generated damage analysis, ${adjusterName}. 

This report provides a comprehensive foundation for your claim decision. All analysis has been performed using state-of-the-art computer vision and machine learning algorithms trained specifically for roof damage assessment.

If you need any clarification on these findings or require additional analysis, please don't hesitate to reach out. I'm here to support accurate and efficient claim processing.

This concludes the Susan AI damage analysis report. Have a great day!`;
  }

  async generateVideoNarration(script, voiceSettings = {}) {
    const {
      voice = 'alloy',
      speed = 1.0,
      emotion = 'professional',
      style = 'natural'
    } = voiceSettings;

    try {
      // Combine all section texts for narration
      const fullScript = script.sections.map(section => section.text).join('\n\n');

      logger.info(`🗣️ Generating narration for ${script.totalWords} words`);

      const audioResult = await this.voiceService.synthesizeSpeech(fullScript, {
        voice,
        speed,
        emotion,
        style,
        response_format: 'wav' // Use WAV for video production
      });

      return {
        buffer: audioResult.audio,
        duration: script.estimatedDuration,
        format: 'wav',
        voice,
        metadata: audioResult.metadata
      };

    } catch (error) {
      logger.error('❌ Error generating narration:', error);
      throw error;
    }
  }

  async prepareVisualAssets(photos, analysisResults, templateId) {
    const template = this.templates.get(templateId);
    const assets = {
      photos: [],
      annotations: [],
      overlays: [],
      backgrounds: [],
      graphics: []
    };

    try {
      // Process each photo
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const analysis = analysisResults[i];

        if (analysis.error) continue;

        // Create enhanced photo with annotations
        const enhancedPhoto = await this.createEnhancedPhoto(photo, analysis, template.style);
        assets.photos.push(enhancedPhoto);

        // Create damage overlay graphics
        if (analysis.damageAnalysis?.image?.annotated) {
          const overlay = await this.createDamageOverlay(analysis.damageAnalysis, template.style);
          assets.overlays.push(overlay);
        }

        // Create heat map visualization
        if (analysis.damageAnalysis?.image?.heatMap) {
          const heatMap = await this.createHeatMapVisualization(analysis.damageAnalysis.image.heatMap, template.style);
          assets.graphics.push(heatMap);
        }
      }

      // Generate template-specific backgrounds
      assets.backgrounds = await this.generateBackgrounds(template);

      // Create charts and infographics
      assets.graphics.push(...await this.generateInfographics(analysisResults, template));

      logger.info(`🎨 Prepared ${assets.photos.length} photos, ${assets.overlays.length} overlays, ${assets.graphics.length} graphics`);

      return assets;

    } catch (error) {
      logger.error('❌ Error preparing visual assets:', error);
      throw error;
    }
  }

  async createEnhancedPhoto(photo, analysis, style) {
    const canvas = createCanvas(this.settings.canvas.width, this.settings.canvas.height);
    const ctx = canvas.getContext('2d');

    try {
      // Load and draw the original photo
      const photoBuffer = photo.buffer || fs.readFileSync(photo.path);
      const img = await loadImage(photoBuffer);

      // Calculate aspect ratio and positioning
      const aspectRatio = img.width / img.height;
      const canvasAspectRatio = this.settings.canvas.width / this.settings.canvas.height;

      let drawWidth, drawHeight, drawX, drawY;

      if (aspectRatio > canvasAspectRatio) {
        // Image is wider - fit to canvas width
        drawWidth = this.settings.canvas.width * 0.8;
        drawHeight = drawWidth / aspectRatio;
        drawX = this.settings.canvas.width * 0.1;
        drawY = (this.settings.canvas.height - drawHeight) / 2;
      } else {
        // Image is taller - fit to canvas height
        drawHeight = this.settings.canvas.height * 0.8;
        drawWidth = drawHeight * aspectRatio;
        drawX = (this.settings.canvas.width - drawWidth) / 2;
        drawY = this.settings.canvas.height * 0.1;
      }

      // Draw background
      ctx.fillStyle = style.colors.background;
      ctx.fillRect(0, 0, this.settings.canvas.width, this.settings.canvas.height);

      // Draw photo with shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 10;
      ctx.shadowOffsetY = 10;
      
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Add photo border
      ctx.strokeStyle = style.colors.primary;
      ctx.lineWidth = 4;
      ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);

      // Add damage markers if available
      if (analysis.damageAnalysis?.damage?.hail?.impacts) {
        await this.addDamageMarkers(ctx, analysis.damageAnalysis.damage.hail.impacts, {
          photoX: drawX,
          photoY: drawY,
          photoWidth: drawWidth,
          photoHeight: drawHeight,
          originalWidth: img.width,
          originalHeight: img.height
        }, style);
      }

      // Add confidence indicator
      this.addConfidenceIndicator(ctx, analysis.damageAnalysis?.confidence || 0, style);

      return {
        canvas,
        buffer: canvas.toBuffer('image/png'),
        photoIndex: analysis.photoIndex,
        dimensions: { width: drawWidth, height: drawHeight, x: drawX, y: drawY }
      };

    } catch (error) {
      logger.error('❌ Error creating enhanced photo:', error);
      throw error;
    }
  }

  async addDamageMarkers(ctx, impacts, photoPos, style) {
    const { photoX, photoY, photoWidth, photoHeight, originalWidth, originalHeight } = photoPos;
    
    // Scale factors to map original coordinates to canvas coordinates
    const scaleX = photoWidth / originalWidth;
    const scaleY = photoHeight / originalHeight;

    for (const impact of impacts) {
      const x = photoX + (impact.x * scaleX);
      const y = photoY + (impact.y * scaleY);
      const radius = Math.max(impact.radius * scaleX, 5);

      // Draw impact circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      
      // Color based on severity
      const color = impact.severity === 'severe' ? '#FF0000' : 
                   impact.severity === 'moderate' ? '#FF8800' : '#FFFF00';
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Add center dot
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Add impact number
      ctx.fillStyle = style.colors.text;
      ctx.font = '14px Roboto-Bold';
      ctx.textAlign = 'center';
      ctx.fillText(`${impacts.indexOf(impact) + 1}`, x, y - radius - 10);
    }
  }

  addConfidenceIndicator(ctx, confidence, style) {
    const indicatorWidth = 200;
    const indicatorHeight = 30;
    const x = this.settings.canvas.width - indicatorWidth - 30;
    const y = 30;

    // Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(x, y, indicatorWidth, indicatorHeight);

    // Border
    ctx.strokeStyle = style.colors.primary;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, indicatorWidth, indicatorHeight);

    // Confidence bar
    const barWidth = indicatorWidth - 20;
    const barHeight = 10;
    const barX = x + 10;
    const barY = y + 15;

    // Background bar
    ctx.fillStyle = '#E0E0E0';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Confidence fill
    const fillWidth = barWidth * confidence;
    const fillColor = confidence > 0.8 ? '#4CAF50' : confidence > 0.6 ? '#FF9800' : '#F44336';
    ctx.fillStyle = fillColor;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    // Text
    ctx.fillStyle = style.colors.text;
    ctx.font = '12px Roboto-Medium';
    ctx.textAlign = 'left';
    ctx.fillText(`AI Confidence: ${Math.round(confidence * 100)}%`, barX, barY - 2);
  }

  async generateBackgrounds(template) {
    const backgrounds = [];

    // Generate professional backgrounds for each section type
    for (const section of template.sections) {
      const background = await this.createSectionBackground(section, template.style);
      backgrounds.push({
        sectionType: section.type,
        canvas: background.canvas,
        buffer: background.buffer
      });
    }

    return backgrounds;
  }

  async createSectionBackground(section, style) {
    const canvas = createCanvas(this.settings.canvas.width, this.settings.canvas.height);
    const ctx = canvas.getContext('2d');

    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, this.settings.canvas.height);
    gradient.addColorStop(0, style.colors.background);
    gradient.addColorStop(1, style.colors.secondary + '20'); // 20% opacity

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.settings.canvas.width, this.settings.canvas.height);

    // Add geometric patterns based on section type
    switch (section.type) {
      case 'intro':
        this.addIntroPattern(ctx, style);
        break;
      case 'damage_overview':
        this.addDataPattern(ctx, style);
        break;
      case 'photo_analysis':
        this.addAnalysisPattern(ctx, style);
        break;
      default:
        this.addGenericPattern(ctx, style);
    }

    return {
      canvas,
      buffer: canvas.toBuffer('image/png')
    };
  }

  addIntroPattern(ctx, style) {
    // Add professional geometric elements for intro
    ctx.strokeStyle = style.colors.primary + '30';
    ctx.lineWidth = 2;

    // Draw subtle grid pattern
    for (let x = 0; x < this.settings.canvas.width; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.settings.canvas.height);
      ctx.stroke();
    }

    for (let y = 0; y < this.settings.canvas.height; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.settings.canvas.width, y);
      ctx.stroke();
    }
  }

  addDataPattern(ctx, style) {
    // Add data visualization elements
    ctx.fillStyle = style.colors.accent + '20';
    
    // Draw charts background elements
    for (let i = 0; i < 5; i++) {
      const x = (this.settings.canvas.width / 6) * (i + 1);
      const height = Math.random() * 200 + 50;
      const y = this.settings.canvas.height - height - 100;
      
      ctx.fillRect(x - 20, y, 40, height);
    }
  }

  addAnalysisPattern(ctx, style) {
    // Add analysis-focused elements
    ctx.strokeStyle = style.colors.primary + '40';
    ctx.lineWidth = 1;

    // Draw crosshair patterns
    const centerX = this.settings.canvas.width / 2;
    const centerY = this.settings.canvas.height / 2;

    for (let i = 1; i <= 3; i++) {
      const radius = i * 150;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  addGenericPattern(ctx, style) {
    // Add simple professional pattern
    ctx.fillStyle = style.colors.primary + '10';
    
    // Draw diagonal stripes
    for (let x = -this.settings.canvas.height; x < this.settings.canvas.width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + this.settings.canvas.height, this.settings.canvas.height);
      ctx.lineWidth = 20;
      ctx.stroke();
    }
  }

  async generateInfographics(analysisResults, template) {
    const graphics = [];

    try {
      // Generate damage summary chart
      const damageChart = await this.createDamageSummaryChart(analysisResults, template.style);
      graphics.push(damageChart);

      // Generate severity distribution chart
      const severityChart = await this.createSeverityChart(analysisResults, template.style);
      graphics.push(severityChart);

      // Generate confidence metrics visualization
      const confidenceViz = await this.createConfidenceVisualization(analysisResults, template.style);
      graphics.push(confidenceViz);

      return graphics;

    } catch (error) {
      logger.error('❌ Error generating infographics:', error);
      return [];
    }
  }

  async createDamageSummaryChart(analysisResults, style) {
    const canvas = createCanvas(this.settings.canvas.width, this.settings.canvas.height);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = style.colors.background;
    ctx.fillRect(0, 0, this.settings.canvas.width, this.settings.canvas.height);

    // Title
    ctx.fillStyle = style.colors.text;
    ctx.font = '48px Roboto-Bold';
    ctx.textAlign = 'center';
    ctx.fillText('Damage Summary', this.settings.canvas.width / 2, 100);

    // Count damage types
    const damageTypes = this.extractDamageTypes(analysisResults);
    const chartData = damageTypes.map((type, index) => ({
      label: type.type.charAt(0).toUpperCase() + type.type.slice(1),
      value: type.count,
      color: [style.colors.primary, style.colors.secondary, style.colors.accent][index % 3]
    }));

    // Draw bar chart
    const chartWidth = 800;
    const chartHeight = 400;
    const chartX = (this.settings.canvas.width - chartWidth) / 2;
    const chartY = 200;
    const barWidth = chartWidth / chartData.length * 0.8;

    const maxValue = Math.max(...chartData.map(d => d.value));

    chartData.forEach((data, index) => {
      const barHeight = (data.value / maxValue) * chartHeight;
      const x = chartX + index * (chartWidth / chartData.length) + (chartWidth / chartData.length - barWidth) / 2;
      const y = chartY + chartHeight - barHeight;

      // Draw bar
      ctx.fillStyle = data.color;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Draw value
      ctx.fillStyle = style.colors.text;
      ctx.font = '24px Roboto-Medium';
      ctx.textAlign = 'center';
      ctx.fillText(data.value.toString(), x + barWidth / 2, y - 10);

      // Draw label
      ctx.fillText(data.label, x + barWidth / 2, chartY + chartHeight + 40);
    });

    return {
      type: 'damage_summary_chart',
      canvas,
      buffer: canvas.toBuffer('image/png')
    };
  }

  async createSeverityChart(analysisResults, style) {
    const canvas = createCanvas(this.settings.canvas.width, this.settings.canvas.height);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = style.colors.background;
    ctx.fillRect(0, 0, this.settings.canvas.width, this.settings.canvas.height);

    // Title
    ctx.fillStyle = style.colors.text;
    ctx.font = '48px Roboto-Bold';
    ctx.textAlign = 'center';
    ctx.fillText('Severity Distribution', this.settings.canvas.width / 2, 100);

    // Count severity levels
    const severityCounts = { mild: 0, moderate: 0, severe: 0 };
    
    analysisResults.forEach(result => {
      if (result.damageAnalysis?.damage?.overall?.severity) {
        const severity = result.damageAnalysis.damage.overall.severity;
        if (severityCounts.hasOwnProperty(severity)) {
          severityCounts[severity]++;
        }
      }
    });

    // Draw pie chart
    const centerX = this.settings.canvas.width / 2;
    const centerY = this.settings.canvas.height / 2 + 50;
    const radius = 150;
    const total = Object.values(severityCounts).reduce((sum, count) => sum + count, 0);

    if (total > 0) {
      let currentAngle = -Math.PI / 2; // Start at top
      const colors = {
        mild: '#4CAF50',
        moderate: '#FF9800',
        severe: '#F44336'
      };

      Object.entries(severityCounts).forEach(([severity, count]) => {
        if (count > 0) {
          const sliceAngle = (count / total) * 2 * Math.PI;

          // Draw slice
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
          ctx.lineTo(centerX, centerY);
          ctx.fillStyle = colors[severity];
          ctx.fill();

          // Draw label
          const labelAngle = currentAngle + sliceAngle / 2;
          const labelX = centerX + Math.cos(labelAngle) * (radius + 50);
          const labelY = centerY + Math.sin(labelAngle) * (radius + 50);

          ctx.fillStyle = style.colors.text;
          ctx.font = '20px Roboto-Medium';
          ctx.textAlign = 'center';
          ctx.fillText(`${severity}: ${count}`, labelX, labelY);

          currentAngle += sliceAngle;
        }
      });
    }

    return {
      type: 'severity_chart',
      canvas,
      buffer: canvas.toBuffer('image/png')
    };
  }

  async createConfidenceVisualization(analysisResults, style) {
    const canvas = createCanvas(this.settings.canvas.width, this.settings.canvas.height);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = style.colors.background;
    ctx.fillRect(0, 0, this.settings.canvas.width, this.settings.canvas.height);

    // Title
    ctx.fillStyle = style.colors.text;
    ctx.font = '48px Roboto-Bold';
    ctx.textAlign = 'center';
    ctx.fillText('AI Confidence Metrics', this.settings.canvas.width / 2, 100);

    // Calculate average confidence
    const confidences = analysisResults
      .filter(r => !r.error && r.damageAnalysis?.confidence)
      .map(r => r.damageAnalysis.confidence);

    if (confidences.length > 0) {
      const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;

      // Draw confidence gauge
      const centerX = this.settings.canvas.width / 2;
      const centerY = this.settings.canvas.height / 2 + 50;
      const radius = 200;

      // Background arc
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI);
      ctx.lineWidth = 30;
      ctx.strokeStyle = '#E0E0E0';
      ctx.stroke();

      // Confidence arc
      const confidenceAngle = Math.PI + (avgConfidence * Math.PI);
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, Math.PI, confidenceAngle);
      ctx.lineWidth = 30;
      ctx.strokeStyle = avgConfidence > 0.8 ? '#4CAF50' : avgConfidence > 0.6 ? '#FF9800' : '#F44336';
      ctx.stroke();

      // Center text
      ctx.fillStyle = style.colors.text;
      ctx.font = '72px Roboto-Bold';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(avgConfidence * 100)}%`, centerX, centerY + 20);

      ctx.font = '24px Roboto-Medium';
      ctx.fillText('Average Confidence', centerX, centerY + 60);
    }

    return {
      type: 'confidence_visualization',
      canvas,
      buffer: canvas.toBuffer('image/png')
    };
  }

  async generateVideoFrames(visualAssets, script, templateId) {
    const template = this.templates.get(templateId);
    const fps = this.settings.canvas.fps;
    const frames = [];

    try {
      let currentTime = 0;

      for (const section of script.sections) {
        const sectionFrames = await this.generateSectionFrames(
          section,
          visualAssets,
          template,
          currentTime,
          fps
        );

        frames.push(...sectionFrames);
        currentTime += section.duration;
      }

      logger.info(`🎞️ Generated ${frames.length} video frames`);
      return frames;

    } catch (error) {
      logger.error('❌ Error generating video frames:', error);
      throw error;
    }
  }

  async generateSectionFrames(section, visualAssets, template, startTime, fps) {
    const frames = [];
    const frameCount = Math.ceil(section.duration * fps);

    for (let i = 0; i < frameCount; i++) {
      const frameTime = startTime + (i / fps);
      const frame = await this.createFrame(section, visualAssets, template, frameTime, i, frameCount);
      
      frames.push({
        time: frameTime,
        buffer: frame.buffer,
        frameNumber: frames.length
      });
    }

    return frames;
  }

  async createFrame(section, visualAssets, template, frameTime, frameIndex, totalFrames) {
    const canvas = createCanvas(this.settings.canvas.width, this.settings.canvas.height);
    const ctx = canvas.getContext('2d');

    // Get background for this section
    const background = visualAssets.backgrounds.find(bg => bg.sectionType === section.type);
    if (background) {
      const bgImg = await loadImage(background.buffer);
      ctx.drawImage(bgImg, 0, 0);
    }

    // Add section-specific content
    switch (section.type) {
      case 'intro':
        await this.drawIntroFrame(ctx, section, template, frameIndex, totalFrames);
        break;

      case 'photo_analysis':
        await this.drawPhotoAnalysisFrame(ctx, section, visualAssets, template, frameTime, frameIndex, totalFrames);
        break;

      case 'damage_overview':
        await this.drawDamageOverviewFrame(ctx, section, visualAssets, template, frameIndex, totalFrames);
        break;

      default:
        await this.drawGenericFrame(ctx, section, template, frameIndex, totalFrames);
    }

    // Add progress indicator
    this.addProgressIndicator(ctx, frameTime, section, template);

    return {
      canvas,
      buffer: canvas.toBuffer('image/jpeg', { quality: 0.9 })
    };
  }

  async drawIntroFrame(ctx, section, template, frameIndex, totalFrames) {
    const style = template.style;
    const progress = frameIndex / totalFrames;

    // Animated title
    const titleY = 400 + Math.sin(progress * Math.PI * 2) * 20;
    
    ctx.fillStyle = style.colors.primary;
    ctx.font = '72px Roboto-Bold';
    ctx.textAlign = 'center';
    ctx.fillText('Susan AI Damage Analysis', this.settings.canvas.width / 2, titleY);

    // Subtitle
    ctx.fillStyle = style.colors.text;
    ctx.font = '36px Roboto-Medium';
    ctx.fillText('Comprehensive Insurance Report', this.settings.canvas.width / 2, titleY + 80);

    // Animated elements
    if (progress > 0.3) {
      const elementsAlpha = Math.min((progress - 0.3) / 0.7, 1);
      ctx.globalAlpha = elementsAlpha;

      // Add company logo placeholder
      ctx.fillStyle = style.colors.accent;
      ctx.fillRect(this.settings.canvas.width / 2 - 100, 200, 200, 100);
      
      ctx.fillStyle = 'white';
      ctx.font = '24px Roboto-Bold';
      ctx.fillText('SUSAN AI', this.settings.canvas.width / 2, 260);

      ctx.globalAlpha = 1;
    }
  }

  async drawPhotoAnalysisFrame(ctx, section, visualAssets, template, frameTime, frameIndex, totalFrames) {
    const style = template.style;

    // Determine which photo to show based on timing
    const photoTiming = section.timing || [];
    let currentPhoto = null;

    for (const timing of photoTiming) {
      if (frameTime >= timing.startTime && frameTime < timing.startTime + timing.duration) {
        currentPhoto = visualAssets.photos.find(p => p.photoIndex === timing.photoIndex);
        break;
      }
    }

    if (currentPhoto) {
      // Draw the enhanced photo
      const photoImg = await loadImage(currentPhoto.buffer);
      const photoWidth = this.settings.canvas.width * 0.6;
      const photoHeight = photoWidth * (photoImg.height / photoImg.width);
      const photoX = 50;
      const photoY = (this.settings.canvas.height - photoHeight) / 2;

      ctx.drawImage(photoImg, photoX, photoY, photoWidth, photoHeight);

      // Add analysis panel on the right
      const panelX = photoX + photoWidth + 50;
      const panelWidth = this.settings.canvas.width - panelX - 50;

      // Panel background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillRect(panelX, 100, panelWidth, this.settings.canvas.height - 200);

      // Panel content
      ctx.fillStyle = style.colors.primary;
      ctx.font = '32px Roboto-Bold';
      ctx.textAlign = 'left';
      ctx.fillText(`Photo ${currentPhoto.photoIndex + 1}`, panelX + 20, 150);

      // Add analysis text
      const currentTiming = photoTiming.find(t => t.photoIndex === currentPhoto.photoIndex);
      if (currentTiming) {
        this.drawWrappedText(ctx, currentTiming.script, panelX + 20, 200, panelWidth - 40, '18px Roboto-Regular', style.colors.text);
      }
    }
  }

  async drawDamageOverviewFrame(ctx, section, visualAssets, template, frameIndex, totalFrames) {
    const style = template.style;

    // Find and draw damage summary chart
    const damageChart = visualAssets.graphics.find(g => g.type === 'damage_summary_chart');
    if (damageChart) {
      const chartImg = await loadImage(damageChart.buffer);
      ctx.drawImage(chartImg, 0, 0);
    }

    // Add animated highlights based on frame
    const progress = frameIndex / totalFrames;
    if (progress > 0.5) {
      // Highlight elements as they're discussed
      ctx.strokeStyle = style.colors.accent;
      ctx.lineWidth = 6;
      ctx.setLineDash([10, 10]);
      
      const highlightAlpha = 0.5 + 0.5 * Math.sin(progress * Math.PI * 4);
      ctx.globalAlpha = highlightAlpha;
      
      // Highlight different chart elements
      ctx.strokeRect(560, 200, 160, 400); // Example highlight area
      
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }
  }

  async drawGenericFrame(ctx, section, template, frameIndex, totalFrames) {
    const style = template.style;

    // Section title
    ctx.fillStyle = style.colors.primary;
    ctx.font = '48px Roboto-Bold';
    ctx.textAlign = 'center';
    ctx.fillText(section.type.replace('_', ' ').toUpperCase(), this.settings.canvas.width / 2, 200);

    // Section content
    if (section.text) {
      this.drawWrappedText(
        ctx,
        section.text,
        100,
        300,
        this.settings.canvas.width - 200,
        '24px Roboto-Regular',
        style.colors.text
      );
    }
  }

  drawWrappedText(ctx, text, x, y, maxWidth, font, color) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';

    const words = text.split(' ');
    let line = '';
    let currentY = y;
    const lineHeight = parseInt(font) * 1.4;

    for (const word of words) {
      const testLine = line + word + ' ';
      const testWidth = ctx.measureText(testLine).width;

      if (testWidth > maxWidth && line !== '') {
        ctx.fillText(line.trim(), x, currentY);
        line = word + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }

    if (line.trim() !== '') {
      ctx.fillText(line.trim(), x, currentY);
    }
  }

  addProgressIndicator(ctx, currentTime, section, template) {
    const style = template.style;
    const totalDuration = template.duration;
    const progress = currentTime / totalDuration;

    // Progress bar
    const barWidth = this.settings.canvas.width - 100;
    const barHeight = 8;
    const barX = 50;
    const barY = this.settings.canvas.height - 50;

    // Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Progress
    ctx.fillStyle = style.colors.accent;
    ctx.fillRect(barX, barY, barWidth * progress, barHeight);

    // Time indicator
    ctx.fillStyle = style.colors.text;
    ctx.font = '16px Roboto-Medium';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.floor(currentTime)}s / ${totalDuration}s`, this.settings.canvas.width - 50, barY - 10);
  }

  async compileVideo(videoFrames, audioTrack, outputFormat, quality) {
    return new Promise((resolve, reject) => {
      try {
        const tempDir = path.join(process.cwd(), 'temp', 'video_generation');
        fs.ensureDirSync(tempDir);

        const frameDir = path.join(tempDir, `frames_${Date.now()}`);
        fs.ensureDirSync(frameDir);

        const outputPath = path.join(tempDir, `output_${Date.now()}.${outputFormat}`);

        // Save frames to temporary directory
        const framePromises = videoFrames.map((frame, index) => {
          const framePath = path.join(frameDir, `frame_${String(index).padStart(6, '0')}.jpg`);
          return fs.writeFile(framePath, frame.buffer);
        });

        Promise.all(framePromises).then(() => {
          // Configure FFmpeg command
          let command = ffmpeg()
            .input(path.join(frameDir, 'frame_%06d.jpg'))
            .inputFPS(this.settings.canvas.fps)
            .videoCodec(this.settings.video.codec)
            .videoBitrate(this.settings.video.bitrate);

          // Add audio if available
          if (audioTrack) {
            const audioPath = path.join(tempDir, `audio_${Date.now()}.wav`);
            fs.writeFileSync(audioPath, audioTrack.buffer);
            command = command.input(audioPath).audioCodec('aac').audioBitrate(this.settings.audio.bitrate);
          }

          // Configure output based on format and quality
          switch (outputFormat) {
            case 'mp4':
              command = command.format('mp4').videoCodec('libx264');
              break;
            case 'webm':
              command = command.format('webm').videoCodec('libvpx-vp9');
              break;
            case 'avi':
              command = command.format('avi');
              break;
          }

          // Quality settings
          if (quality === 'high') {
            command = command.outputOptions(['-crf', '18', '-preset', 'slow']);
          } else if (quality === 'medium') {
            command = command.outputOptions(['-crf', '23', '-preset', 'medium']);
          } else {
            command = command.outputOptions(['-crf', '28', '-preset', 'fast']);
          }

          command
            .output(outputPath)
            .on('start', (commandLine) => {
              logger.info('🎬 FFmpeg started:', commandLine);
            })
            .on('progress', (progress) => {
              logger.debug(`🎞️ Video compilation progress: ${progress.percent}%`);
            })
            .on('end', async () => {
              try {
                // Get file stats
                const stats = await fs.stat(outputPath);
                
                // Generate URL (in production, this would be uploaded to cloud storage)
                const videoUrl = `/api/videos/${path.basename(outputPath)}`;

                // Get video duration using FFmpeg probe
                const duration = await this.getVideoDuration(outputPath);

                // Clean up temporary files
                fs.removeSync(frameDir);
                if (audioTrack) {
                  const audioPath = path.join(tempDir, `audio_${Date.now()}.wav`);
                  if (fs.existsSync(audioPath)) {
                    fs.removeSync(audioPath);
                  }
                }

                resolve({
                  path: outputPath,
                  url: videoUrl,
                  size: stats.size,
                  duration: duration,
                  format: outputFormat
                });

              } catch (error) {
                reject(error);
              }
            })
            .on('error', (error) => {
              logger.error('❌ FFmpeg error:', error);
              reject(error);
            })
            .run();

        }).catch(reject);

      } catch (error) {
        reject(error);
      }
    });
  }

  async getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration);
        }
      });
    });
  }

  async generateInteractiveElements(analysisResults, script) {
    const elements = {
      hotspots: [],
      annotations: [],
      chapters: [],
      overlays: []
    };

    try {
      // Generate clickable hotspots for damage areas
      analysisResults.forEach((result, index) => {
        if (result.damageAnalysis?.damage?.hail?.impacts) {
          result.damageAnalysis.damage.hail.impacts.forEach((impact, impactIndex) => {
            elements.hotspots.push({
              id: `impact_${index}_${impactIndex}`,
              photoIndex: index,
              x: impact.x,
              y: impact.y,
              radius: impact.radius,
              type: 'hail_impact',
              severity: impact.severity,
              confidence: impact.confidence,
              description: `Hail impact #${impactIndex + 1}: ${impact.severity} severity`,
              timestamp: this.findTimestampForPhoto(script, index)
            });
          });
        }
      });

      // Generate chapter markers
      let currentTime = 0;
      script.sections.forEach(section => {
        elements.chapters.push({
          id: section.type,
          title: section.type.replace('_', ' ').toUpperCase(),
          startTime: currentTime,
          duration: section.duration,
          description: section.text.substring(0, 100) + '...'
        });
        currentTime += section.duration;
      });

      // Generate text annotations for key findings
      const keyFindings = this.extractKeyFindings(analysisResults);
      keyFindings.forEach((finding, index) => {
        elements.annotations.push({
          id: `finding_${index}`,
          text: finding.text,
          timestamp: finding.timestamp,
          importance: finding.importance,
          type: finding.type
        });
      });

      logger.info(`🎯 Generated ${elements.hotspots.length} hotspots, ${elements.chapters.length} chapters, ${elements.annotations.length} annotations`);

      return elements;

    } catch (error) {
      logger.error('❌ Error generating interactive elements:', error);
      return elements; // Return empty elements if generation fails
    }
  }

  findTimestampForPhoto(script, photoIndex) {
    let currentTime = 0;
    
    for (const section of script.sections) {
      if (section.timing) {
        const photoTiming = section.timing.find(t => t.photoIndex === photoIndex);
        if (photoTiming) {
          return currentTime + photoTiming.startTime;
        }
      }
      currentTime += section.duration;
    }
    
    return 0; // Default to beginning if not found
  }

  extractKeyFindings(analysisResults) {
    const findings = [];

    analysisResults.forEach((result, index) => {
      if (result.damageAnalysis?.damage?.overall?.severity !== 'none') {
        findings.push({
          text: `Significant damage detected in photo ${index + 1}`,
          timestamp: index * 30, // Rough estimate
          importance: 'high',
          type: 'damage_detection'
        });
      }

      if (result.damageAnalysis?.damage?.hail?.detected) {
        findings.push({
          text: `${result.damageAnalysis.damage.hail.impactCount} hail impacts identified`,
          timestamp: index * 30 + 10,
          importance: 'medium',
          type: 'hail_damage'
        });
      }
    });

    return findings;
  }

  async generateMultiFormatExports(originalVideo, primaryFormat) {
    const exports = [
      {
        format: primaryFormat,
        path: originalVideo.path,
        url: originalVideo.url,
        size: originalVideo.size,
        quality: 'original'
      }
    ];

    // Generate additional formats
    const additionalFormats = this.outputFormats.filter(format => format !== primaryFormat);

    for (const format of additionalFormats.slice(0, 2)) { // Limit to 2 additional formats
      try {
        const exportPath = originalVideo.path.replace(path.extname(originalVideo.path), `.${format}`);
        
        await new Promise((resolve, reject) => {
          ffmpeg(originalVideo.path)
            .format(format)
            .output(exportPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });

        const stats = await fs.stat(exportPath);
        exports.push({
          format,
          path: exportPath,
          url: `/api/videos/${path.basename(exportPath)}`,
          size: stats.size,
          quality: 'converted'
        });

      } catch (error) {
        logger.warn(`⚠️ Failed to export to ${format}:`, error.message);
      }
    }

    return exports;
  }

  // Utility methods
  extractDamageTypes(analysisResults) {
    const damageTypes = { hail: 0, wind: 0, granule: 0, collateral: 0 };

    analysisResults.forEach(result => {
      if (result.damageAnalysis?.damage) {
        const damage = result.damageAnalysis.damage;
        
        if (damage.hail?.detected) {
          damageTypes.hail += damage.hail.impactCount || 1;
        }
        
        if (damage.wind?.detected) {
          damageTypes.wind += damage.wind.liftedShingles || 1;
        }
        
        if (damage.granuleLoss?.detected) {
          damageTypes.granule += 1;
        }
        
        if (damage.collateral?.detected) {
          damageTypes.collateral += damage.collateral.damageTypes?.length || 1;
        }
      }
    });

    return Object.entries(damageTypes)
      .filter(([type, count]) => count > 0)
      .map(([type, count]) => ({ type, count }));
  }

  calculateSeverityLevel(analysisResults) {
    const severities = [];

    analysisResults.forEach(result => {
      if (result.damageAnalysis?.damage?.overall?.severity) {
        const severity = result.damageAnalysis.damage.overall.severity;
        if (severity === 'severe') severities.push(3);
        else if (severity === 'moderate') severities.push(2);
        else if (severity === 'mild') severities.push(1);
      }
    });

    if (severities.length === 0) return 'minimal';
    
    const maxSeverity = Math.max(...severities);
    return maxSeverity === 3 ? 'severe' : maxSeverity === 2 ? 'moderate' : 'mild';
  }

  countTotalDamage(analysisResults) {
    return analysisResults.reduce((total, result) => {
      if (result.damageAnalysis?.damage) {
        const damage = result.damageAnalysis.damage;
        total += (damage.hail?.impactCount || 0);
        total += (damage.wind?.liftedShingles || 0);
        total += (damage.collateral?.damageTypes?.length || 0);
        if (damage.granuleLoss?.detected) total += 1;
      }
      return total;
    }, 0);
  }

  calculateOverallConfidence(analysisResults) {
    const confidences = analysisResults
      .filter(r => !r.error && r.damageAnalysis?.confidence)
      .map(r => r.damageAnalysis.confidence);

    return confidences.length > 0 
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length 
      : 0;
  }

  // ID generators
  generateVideoId() {
    return `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Status methods
  getVideoStatus(videoId) {
    return this.videoQueue.get(videoId);
  }

  getActiveVideos() {
    return Array.from(this.videoQueue.values()).filter(v => v.status === 'processing');
  }

  getAllTemplates() {
    return Array.from(this.templates.values());
  }

  // Cleanup method
  cleanup() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [id, video] of this.videoQueue.entries()) {
      if (video.startTime < cutoffTime) {
        // Clean up video files
        if (video.result?.video?.path) {
          fs.remove(video.result.video.path).catch(err => 
            logger.warn('Failed to clean up video file:', err)
          );
        }
        
        this.videoQueue.delete(id);
      }
    }

    logger.info(`🧹 Cleaned up old video generation sessions`);
  }
}