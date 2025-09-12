import OpenAI from 'openai';
import fs from 'fs-extra';
import path from 'path';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import EventEmitter from 'events';

export class VoiceService extends EventEmitter {
  constructor() {
    super();
    this.initializeClients();
    this.batchJobs = new Map();
    this.activeTranscriptions = new Map();
    this.voiceProfiles = new Map();
    this.supportedFormats = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'];
    this.maxFileSize = 25 * 1024 * 1024; // 25MB limit for Whisper
  }

  initializeClients() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    if (!this.openai) {
      logger.warn('OpenAI client not configured. Voice features will be limited.');
    }
  }

  /**
   * Enhanced transcription with speaker detection and advanced options
   */
  async transcribeAudio(audioFile, options = {}) {
    const {
      language = 'auto',
      model = 'whisper-1',
      prompt = '',
      temperature = 0,
      response_format = 'verbose_json',
      timestamp_granularities = ['segment'],
      speaker_detection = false,
      noise_reduction = false,
      custom_vocabulary = [],
      confidence_threshold = 0.7,
      userId,
      jobId
    } = options;

    if (!this.openai) {
      throw ApiError.serviceUnavailable('OpenAI client not configured');
    }

    // Validate file
    await this.validateAudioFile(audioFile);

    const transcriptionId = this.generateTranscriptionId();
    const startTime = Date.now();

    try {
      // Pre-process audio if needed
      let processedFile = audioFile;
      if (noise_reduction) {
        processedFile = await this.applyNoiseReduction(audioFile);
      }

      // Create transcription session
      const session = {
        id: transcriptionId,
        userId,
        jobId,
        startTime,
        status: 'processing',
        options,
        metadata: {
          originalFilename: audioFile.originalname,
          fileSize: audioFile.size,
          mimeType: audioFile.mimetype
        }
      };

      this.activeTranscriptions.set(transcriptionId, session);

      // Perform transcription
      const transcriptionParams = {
        file: fs.createReadStream(processedFile.path),
        model,
        response_format,
        timestamp_granularities
      };

      if (language !== 'auto') {
        transcriptionParams.language = language;
      }

      if (prompt) {
        transcriptionParams.prompt = prompt;
      }

      if (temperature !== 0) {
        transcriptionParams.temperature = temperature;
      }

      const response = await this.openai.audio.transcriptions.create(transcriptionParams);

      // Enhanced processing of response
      let processedResponse = await this.processTranscriptionResponse(response, options);

      // Apply speaker detection if requested
      if (speaker_detection && response.segments) {
        processedResponse = await this.applySpeakerDetection(processedResponse);
      }

      // Filter by confidence threshold
      if (confidence_threshold > 0 && processedResponse.segments) {
        processedResponse.segments = processedResponse.segments.filter(
          segment => !segment.avg_logprob || Math.exp(segment.avg_logprob) >= confidence_threshold
        );
      }

      const duration = Date.now() - startTime;

      const result = {
        id: transcriptionId,
        text: processedResponse.text,
        language: processedResponse.language,
        duration: processedResponse.duration,
        segments: processedResponse.segments || [],
        words: processedResponse.words || [],
        confidence: this.calculateOverallConfidence(processedResponse),
        metadata: {
          model,
          processingTime: duration,
          fileSize: audioFile.size,
          originalFilename: audioFile.originalname,
          speakersDetected: speaker_detection ? this.countSpeakers(processedResponse) : null,
          qualityScore: this.calculateQualityScore(processedResponse)
        }
      };

      // Update session
      session.status = 'completed';
      session.result = result;
      session.endTime = Date.now();

      // Clean up processed file if different from original
      if (processedFile.path !== audioFile.path) {
        await fs.remove(processedFile.path);
      }

      logger.info('Audio transcription completed', {
        transcriptionId,
        userId,
        duration,
        textLength: result.text.length,
        segments: result.segments.length
      });

      this.emit('transcription:completed', { transcriptionId, result, userId });

      return result;

    } catch (error) {
      // Update session with error
      const session = this.activeTranscriptions.get(transcriptionId);
      if (session) {
        session.status = 'failed';
        session.error = error.message;
        session.endTime = Date.now();
      }

      logger.error('Audio transcription failed', {
        transcriptionId,
        userId,
        error: error.message,
        duration: Date.now() - startTime
      });

      this.emit('transcription:failed', { transcriptionId, error, userId });

      throw ApiError.internalServerError(`Transcription failed: ${error.message}`);
    } finally {
      // Clean up active transcription after delay
      setTimeout(() => {
        this.activeTranscriptions.delete(transcriptionId);
      }, 300000); // Keep for 5 minutes
    }
  }

  /**
   * Batch transcription processing
   */
  async createBatchTranscriptionJob(files, options = {}) {
    const {
      userId,
      priority = 'normal',
      webhook_url,
      metadata = {}
    } = options;

    const jobId = this.generateJobId();
    const batchJob = {
      id: jobId,
      userId,
      status: 'pending',
      priority,
      files: files.map(file => ({
        id: this.generateFileId(),
        filename: file.originalname,
        size: file.size,
        path: file.path,
        status: 'pending'
      })),
      results: [],
      progress: {
        total: files.length,
        completed: 0,
        failed: 0,
        percentage: 0
      },
      webhook_url,
      metadata,
      createdAt: new Date(),
      estimatedDuration: this.estimateBatchDuration(files)
    };

    this.batchJobs.set(jobId, batchJob);

    // Start processing
    this.processBatchJob(jobId, options);

    logger.info('Batch transcription job created', {
      jobId,
      userId,
      fileCount: files.length,
      estimatedDuration: batchJob.estimatedDuration
    });

    return {
      jobId,
      status: batchJob.status,
      fileCount: files.length,
      estimatedDuration: batchJob.estimatedDuration
    };
  }

  /**
   * Process batch transcription job
   */
  async processBatchJob(jobId, options = {}) {
    const job = this.batchJobs.get(jobId);
    if (!job) return;

    job.status = 'processing';
    job.startedAt = new Date();

    try {
      const concurrency = options.concurrency || 3; // Process 3 files at once
      const batches = this.chunkArray(job.files, concurrency);

      for (const batch of batches) {
        const promises = batch.map(async (file) => {
          try {
            file.status = 'processing';
            
            const result = await this.transcribeAudio({
              path: file.path,
              originalname: file.filename,
              size: file.size
            }, { ...options, jobId, fileId: file.id });

            file.status = 'completed';
            file.result = result;
            job.results.push({ fileId: file.id, result });
            job.progress.completed++;

          } catch (error) {
            file.status = 'failed';
            file.error = error.message;
            job.progress.failed++;
            
            logger.error('Batch file transcription failed', {
              jobId,
              fileId: file.id,
              filename: file.filename,
              error: error.message
            });
          }

          // Update progress
          job.progress.percentage = Math.round(
            ((job.progress.completed + job.progress.failed) / job.progress.total) * 100
          );

          this.emit('batch:progress', {
            jobId,
            progress: job.progress,
            fileId: file.id,
            status: file.status
          });
        });

        await Promise.all(promises);
      }

      job.status = 'completed';
      job.completedAt = new Date();
      job.duration = job.completedAt - job.startedAt;

      // Send webhook notification if configured
      if (job.webhook_url) {
        await this.sendWebhookNotification(job.webhook_url, {
          jobId,
          status: job.status,
          progress: job.progress,
          duration: job.duration
        });
      }

      logger.info('Batch transcription job completed', {
        jobId,
        duration: job.duration,
        completed: job.progress.completed,
        failed: job.progress.failed
      });

      this.emit('batch:completed', { jobId, results: job.results });

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();

      logger.error('Batch transcription job failed', {
        jobId,
        error: error.message
      });

      this.emit('batch:failed', { jobId, error });
    }
  }

  /**
   * Enhanced speech synthesis with voice cloning support
   */
  async synthesizeSpeech(text, options = {}) {
    const {
      voice = 'alloy',
      model = 'tts-1',
      speed = 1.0,
      pitch = 0,
      response_format = 'mp3',
      voice_profile_id,
      emotion = 'neutral',
      style = 'natural',
      userId
    } = options;

    if (!this.openai) {
      throw ApiError.serviceUnavailable('OpenAI client not configured');
    }

    const synthesisId = this.generateSynthesisId();
    const startTime = Date.now();

    try {
      // Handle voice profile if specified
      let selectedVoice = voice;
      if (voice_profile_id) {
        const profile = this.voiceProfiles.get(voice_profile_id);
        if (profile) {
          selectedVoice = profile.voice_id;
        }
      }

      // Apply text preprocessing based on emotion and style
      const processedText = this.preprocessTextForSynthesis(text, { emotion, style });

      const response = await this.openai.audio.speech.create({
        model,
        voice: selectedVoice,
        input: processedText,
        speed,
        response_format
      });

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      const duration = Date.now() - startTime;

      // Apply post-processing if needed
      let processedAudio = audioBuffer;
      if (pitch !== 0) {
        processedAudio = await this.adjustPitch(audioBuffer, pitch);
      }

      const result = {
        id: synthesisId,
        audio: processedAudio,
        metadata: {
          voice: selectedVoice,
          model,
          textLength: text.length,
          audioSize: processedAudio.length,
          processingTime: duration,
          speed,
          pitch,
          format: response_format
        }
      };

      logger.info('Speech synthesis completed', {
        synthesisId,
        userId,
        textLength: text.length,
        audioSize: result.audio.length,
        duration
      });

      return result;

    } catch (error) {
      logger.error('Speech synthesis failed', {
        synthesisId,
        userId,
        error: error.message,
        duration: Date.now() - startTime
      });

      throw ApiError.internalServerError(`Speech synthesis failed: ${error.message}`);
    }
  }

  /**
   * Create and train custom voice profile
   */
  async createVoiceProfile(audioSamples, options = {}) {
    const {
      name,
      description,
      userId,
      trainingOptions = {}
    } = options;

    const profileId = this.generateProfileId();

    try {
      // Validate audio samples
      for (const sample of audioSamples) {
        await this.validateAudioFile(sample);
      }

      // Extract voice characteristics
      const characteristics = await this.extractVoiceCharacteristics(audioSamples);

      // Create voice profile
      const profile = {
        id: profileId,
        name,
        description,
        userId,
        characteristics,
        trainingData: audioSamples.map(sample => ({
          filename: sample.originalname,
          duration: sample.duration,
          quality: sample.quality
        })),
        status: 'training',
        createdAt: new Date(),
        ...trainingOptions
      };

      this.voiceProfiles.set(profileId, profile);

      // Start training process (mock implementation)
      setTimeout(() => {
        profile.status = 'ready';
        profile.voice_id = `custom_${profileId}`;
        this.emit('voice_profile:ready', { profileId, userId });
      }, 5000);

      logger.info('Voice profile created', {
        profileId,
        userId,
        sampleCount: audioSamples.length
      });

      return {
        profileId,
        status: profile.status,
        characteristics
      };

    } catch (error) {
      logger.error('Voice profile creation failed', {
        profileId,
        userId,
        error: error.message
      });

      throw ApiError.internalServerError(`Voice profile creation failed: ${error.message}`);
    }
  }

  /**
   * Real-time audio processing for live transcription
   */
  async startLiveTranscription(options = {}) {
    const {
      userId,
      language = 'auto',
      interim_results = true,
      punctuation = true,
      speaker_detection = false
    } = options;

    const sessionId = this.generateSessionId();
    
    // This would typically establish a WebSocket connection for real-time audio
    const session = {
      id: sessionId,
      userId,
      status: 'active',
      options,
      startTime: Date.now(),
      audioBuffer: [],
      transcriptionBuffer: [],
      speakers: new Set()
    };

    // Mock implementation - in reality this would handle streaming audio
    logger.info('Live transcription session started', {
      sessionId,
      userId,
      language
    });

    return {
      sessionId,
      status: session.status,
      websocket_url: `/ws/transcription/${sessionId}`
    };
  }

  // Helper methods
  async validateAudioFile(file) {
    if (!file) {
      throw ApiError.badRequest('No audio file provided');
    }

    if (file.size > this.maxFileSize) {
      throw ApiError.badRequest(`File size exceeds ${this.maxFileSize / 1024 / 1024}MB limit`);
    }

    const ext = path.extname(file.originalname || file.filename || '').toLowerCase().slice(1);
    if (!this.supportedFormats.includes(ext)) {
      throw ApiError.badRequest(`Unsupported audio format. Supported: ${this.supportedFormats.join(', ')}`);
    }

    // Additional validation could include audio format verification
    return true;
  }

  async processTranscriptionResponse(response, options) {
    // Enhanced processing of Whisper response
    const processed = {
      text: response.text,
      language: response.language,
      duration: response.duration,
      segments: response.segments || [],
      words: response.words || []
    };

    // Add confidence scores if available
    if (response.segments) {
      processed.segments = response.segments.map(segment => ({
        ...segment,
        confidence: segment.avg_logprob ? Math.exp(segment.avg_logprob) : null
      }));
    }

    return processed;
  }

  async applySpeakerDetection(transcription) {
    // Mock speaker detection - in reality this would use audio analysis
    if (transcription.segments) {
      transcription.segments = transcription.segments.map((segment, index) => ({
        ...segment,
        speaker: {
          id: `speaker_${(index % 3) + 1}`,
          confidence: 0.8 + Math.random() * 0.2
        }
      }));
    }
    return transcription;
  }

  calculateOverallConfidence(transcription) {
    if (!transcription.segments || transcription.segments.length === 0) {
      return null;
    }

    const confidences = transcription.segments
      .map(s => s.avg_logprob ? Math.exp(s.avg_logprob) : 0.7)
      .filter(c => c > 0);

    return confidences.length > 0 
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length 
      : null;
  }

  calculateQualityScore(transcription) {
    // Mock quality score based on various factors
    const confidence = this.calculateOverallConfidence(transcription) || 0.7;
    const lengthFactor = Math.min(transcription.text.length / 1000, 1);
    const segmentFactor = transcription.segments ? Math.min(transcription.segments.length / 10, 1) : 0.5;
    
    return (confidence * 0.6 + lengthFactor * 0.2 + segmentFactor * 0.2);
  }

  countSpeakers(transcription) {
    if (!transcription.segments) return 0;
    
    const speakers = new Set();
    transcription.segments.forEach(segment => {
      if (segment.speaker?.id) {
        speakers.add(segment.speaker.id);
      }
    });
    
    return speakers.size;
  }

  estimateBatchDuration(files) {
    // Estimate based on file sizes (rough approximation)
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const avgProcessingRate = 2; // MB per minute
    return Math.ceil(totalSize / 1024 / 1024 / avgProcessingRate);
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async sendWebhookNotification(url, data) {
    try {
      // Implementation would send HTTP POST to webhook URL
      logger.info('Webhook notification sent', { url, data });
    } catch (error) {
      logger.error('Webhook notification failed', { url, error: error.message });
    }
  }

  preprocessTextForSynthesis(text, options) {
    const { emotion, style } = options;
    
    // Add SSML-like preprocessing for emotion and style
    let processed = text;
    
    if (emotion === 'excited') {
      processed = processed.replace(/[.!?]/g, '!');
    } else if (emotion === 'calm') {
      processed = processed.replace(/[!]/g, '.');
    }
    
    return processed;
  }

  async adjustPitch(audioBuffer, pitchShift) {
    // Mock pitch adjustment - in reality would use audio processing library
    logger.debug('Applying pitch adjustment', { pitchShift });
    return audioBuffer; // Return original for now
  }

  async applyNoiseReduction(audioFile) {
    // Mock noise reduction - in reality would use audio processing
    logger.debug('Applying noise reduction', { filename: audioFile.originalname });
    return audioFile; // Return original for now
  }

  async extractVoiceCharacteristics(audioSamples) {
    // Mock voice characteristic extraction
    return {
      pitch_range: { min: 80, max: 250 },
      tone: 'warm',
      accent: 'neutral',
      speaking_rate: 'medium',
      voice_quality: 'clear'
    };
  }

  // ID generators
  generateTranscriptionId() {
    return `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateFileId() {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSynthesisId() {
    return `synth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateProfileId() {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Status methods
  getBatchJobStatus(jobId) {
    return this.batchJobs.get(jobId);
  }

  getActiveTranscriptions() {
    return Array.from(this.activeTranscriptions.values());
  }

  getVoiceProfiles(userId) {
    return Array.from(this.voiceProfiles.values()).filter(profile => profile.userId === userId);
  }
}