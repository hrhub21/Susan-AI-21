import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateJsonSchema } from '../middleware/validation.js';
import { aiModelRateLimit, fileUploadRateLimit } from '../middleware/rateLimit.js';
import { enhancedVoiceService } from '../services/EnhancedVoiceService.js';
import { streamingService } from '../services/StreamingService.js';
import { MultiLanguageVoiceController } from '../controllers/MultiLanguageVoiceController.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Initialize multi-language voice controller
const multiLanguageVoiceController = new MultiLanguageVoiceController();

// Configure multer for audio uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 25 * 1024 * 1024, // 25MB limit
        files: 10 // Support batch uploads
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a',
            'audio/webm', 'audio/ogg', 'audio/flac', 'audio/aac'
        ];
        
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new ApiError(400, `Unsupported audio format: ${file.mimetype}`), false);
        }
    }
});

/**
 * @route POST /api/v1/voice/enhanced/transcribe
 * @desc Enhanced audio transcription with streaming support
 * @access Public (for now)
 */
router.post('/transcribe',
    fileUploadRateLimit,
    upload.single('audio'),
    asyncHandler(async (req, res) => {
        if (!req.file) {
            throw new ApiError(400, 'No audio file provided');
        }

        const options = {
            language: req.body.language || 'en',
            model: req.body.model || 'whisper-1',
            responseFormat: req.body.response_format || 'verbose_json',
            includeTimestamps: req.body.include_timestamps === 'true',
            speakerDetection: req.body.speaker_detection === 'true',
            streamId: req.body.stream_id || null
        };

        logger.info('Enhanced transcription request', {
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            options
        });

        const result = await enhancedVoiceService.transcribeAudio(req.file.buffer, options);

        res.json({
            success: true,
            ...result
        });
    })
);

/**
 * @route POST /api/v1/voice/enhanced/batch-transcribe
 * @desc Batch audio transcription
 * @access Public (for now)
 */
router.post('/batch-transcribe',
    fileUploadRateLimit,
    upload.array('audio', 10),
    asyncHandler(async (req, res) => {
        if (!req.files || req.files.length === 0) {
            throw new ApiError(400, 'No audio files provided');
        }

        const audioFiles = req.files.map((file, index) => ({
            index,
            name: file.originalname,
            buffer: file.buffer,
            mimeType: file.mimetype,
            size: file.size
        }));

        const options = {
            language: req.body.language || 'en',
            model: req.body.model || 'whisper-1',
            responseFormat: req.body.response_format || 'verbose_json',
            includeTimestamps: req.body.include_timestamps === 'true',
            speakerDetection: req.body.speaker_detection === 'true',
            concurrency: parseInt(req.body.concurrency) || 3,
            streamId: req.body.stream_id || null
        };

        logger.info('Batch transcription request', {
            fileCount: audioFiles.length,
            totalSize: audioFiles.reduce((sum, file) => sum + file.size, 0),
            options
        });

        const result = await enhancedVoiceService.processBatch(audioFiles, options);

        res.json({
            success: true,
            ...result
        });
    })
);

/**
 * @route POST /api/v1/voice/enhanced/synthesize
 * @desc Enhanced speech synthesis
 * @access Public (for now)
 */
router.post('/synthesize',
    aiModelRateLimit,
    validateJsonSchema({
        type: 'object',
        required: ['text'],
        properties: {
            text: { type: 'string', minLength: 1, maxLength: 4000 },
            voice: { 
                type: 'string',
                enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']
            },
            speed: { type: 'number', minimum: 0.25, maximum: 4.0 },
            format: {
                type: 'string',
                enum: ['mp3', 'opus', 'aac', 'flac']
            },
            model: {
                type: 'string',
                enum: ['tts-1', 'tts-1-hd']
            },
            voice_profile: { type: 'string' },
            stream_id: { type: 'string' }
        },
        additionalProperties: false
    }),
    asyncHandler(async (req, res) => {
        const {
            text,
            voice = 'alloy',
            speed = 1.0,
            format = 'mp3',
            model = 'tts-1',
            voice_profile = null,
            stream_id = null
        } = req.body;

        logger.info('Enhanced synthesis request', {
            textLength: text.length,
            voice,
            model,
            format,
            voiceProfile: voice_profile
        });

        const result = await enhancedVoiceService.synthesizeSpeech(text, {
            voice,
            speed,
            format,
            model,
            voiceProfile: voice_profile,
            streamId: stream_id
        });

        res.set({
            'Content-Type': `audio/${format}`,
            'Content-Length': result.audioSize,
            'X-Audio-Info': JSON.stringify({
                voice: result.voice,
                textLength: result.textLength,
                format: result.format
            })
        });

        res.send(result.audio);
    })
);

/**
 * @route POST /api/v1/voice/enhanced/conversation/start
 * @desc Start real-time voice conversation
 * @access Public (for now)
 */
router.post('/conversation/start',
    aiModelRateLimit,
    validateJsonSchema({
        type: 'object',
        required: ['stream_id'],
        properties: {
            stream_id: { type: 'string' },
            voice_profile: { type: 'string' },
            language: { type: 'string' },
            ai_model: { type: 'string' }
        },
        additionalProperties: false
    }),
    asyncHandler(async (req, res) => {
        const { stream_id, voice_profile, language = 'en', ai_model = 'claude-3-sonnet' } = req.body;

        // Import AI service (assuming it's available)
        const { AIService } = await import('../services/AIService.js');
        const aiService = new AIService();

        logger.info('Starting voice conversation', {
            streamId: stream_id,
            voiceProfile: voice_profile,
            language,
            aiModel: ai_model
        });

        const conversationState = await enhancedVoiceService.startVoiceConversation(
            stream_id,
            aiService
        );

        res.json({
            success: true,
            conversationId: conversationState.streamId,
            status: 'active',
            capabilities: ['real_time_transcription', 'ai_processing', 'voice_synthesis'],
            supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'],
            availableVoices: Object.keys(enhancedVoiceService.voices)
        });
    })
);

/**
 * @route POST /api/v1/voice/enhanced/profile/create
 * @desc Create voice profile from samples
 * @access Public (for now)
 */
router.post('/profile/create',
    fileUploadRateLimit,
    upload.array('samples', 5),
    asyncHandler(async (req, res) => {
        if (!req.files || req.files.length === 0) {
            throw new ApiError(400, 'No voice samples provided');
        }

        const userId = req.user?.id || 'anonymous';
        const metadata = {
            name: req.body.name,
            description: req.body.description,
            language: req.body.language || 'en'
        };

        const samples = req.files.map(file => ({
            buffer: file.buffer,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size
        }));

        logger.info('Creating voice profile', {
            userId,
            sampleCount: samples.length,
            totalSize: samples.reduce((sum, sample) => sum + sample.size, 0),
            metadata
        });

        const profile = await enhancedVoiceService.createVoiceProfile(userId, samples, metadata);

        res.json({
            success: true,
            profile: {
                id: profile.id,
                name: profile.name,
                characteristics: profile.characteristics,
                preferredVoice: profile.preferredVoice,
                sampleCount: profile.sampleCount,
                createdAt: profile.createdAt
            }
        });
    })
);

/**
 * @route GET /api/v1/voice/enhanced/profiles
 * @desc Get user's voice profiles
 * @access Public (for now)
 */
router.get('/profiles',
    asyncHandler(async (req, res) => {
        const userId = req.user?.id || 'anonymous';
        
        const profiles = Array.from(enhancedVoiceService.voiceProfiles.values())
            .filter(profile => profile.userId === userId)
            .map(profile => ({
                id: profile.id,
                name: profile.name,
                preferredVoice: profile.preferredVoice,
                sampleCount: profile.sampleCount,
                createdAt: profile.createdAt,
                metadata: profile.metadata
            }));

        res.json({
            success: true,
            profiles,
            total: profiles.length
        });
    })
);

/**
 * @route GET /api/v1/voice/enhanced/stats
 * @desc Get enhanced voice service statistics
 * @access Public (for now)
 */
router.get('/stats',
    asyncHandler(async (req, res) => {
        const stats = enhancedVoiceService.getStats();
        const streamStats = streamingService.getStreamStats();

        res.json({
            success: true,
            voiceService: stats,
            streamingService: streamStats,
            timestamp: new Date().toISOString()
        });
    })
);

/**
 * @route GET /api/v1/voice/enhanced/health
 * @desc Health check for enhanced voice services
 * @access Public
 */
router.get('/health',
    asyncHandler(async (req, res) => {
        const health = {
            status: 'healthy',
            services: {
                voiceService: 'operational',
                streamingService: 'operational',
                openaiApi: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured'
            },
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        };

        res.json(health);
    })
);

// Multi-Language Voice Endpoints

/**
 * @route POST /api/v1/voice/enhanced/multi-language/process
 * @desc Process voice input with automatic language detection
 * @access Public
 */
router.post('/multi-language/process',
    fileUploadRateLimit,
    upload.single('audio'),
    asyncHandler(async (req, res) => {
        if (!req.file) {
            throw new ApiError(400, 'No audio file provided');
        }

        const options = {
            userId: req.body.userId,
            expectedLanguage: req.body.expectedLanguage,
            autoDetectLanguage: req.body.autoDetectLanguage !== 'false',
            translateResponse: req.body.translateResponse !== 'false',
            culturalAdaptation: req.body.culturalAdaptation !== 'false'
        };

        logger.info('Multi-language voice processing request', {
            fileSize: req.file.size,
            options
        });

        const result = await multiLanguageVoiceController.processVoiceInput(req.file, options);

        res.json({
            success: true,
            data: result
        });
    })
);

/**
 * @route POST /api/v1/voice/enhanced/multi-language/command
 * @desc Process voice command with multi-language support
 * @access Public
 */
router.post('/multi-language/command',
    aiModelRateLimit,
    validateJsonSchema({
        type: 'object',
        required: ['command'],
        properties: {
            command: { type: 'string', minLength: 1 },
            language: { type: 'string' },
            userId: { type: 'string' },
            translateResponse: { type: 'boolean' },
            culturalAdaptation: { type: 'boolean' },
            responseLanguage: { type: 'string' }
        },
        additionalProperties: false
    }),
    asyncHandler(async (req, res) => {
        const {
            command,
            language = 'en',
            userId,
            translateResponse = true,
            culturalAdaptation = true,
            responseLanguage
        } = req.body;

        logger.info('Multi-language voice command request', {
            command: command.substring(0, 50),
            language,
            userId
        });

        const result = await multiLanguageVoiceController.processVoiceCommand(command, language, {
            userId,
            translateResponse,
            culturalAdaptation,
            responseLanguage
        });

        res.json({
            success: true,
            data: result
        });
    })
);

/**
 * @route POST /api/v1/voice/enhanced/multi-language/synthesize
 * @desc Generate voice response in multiple languages
 * @access Public
 */
router.post('/multi-language/synthesize',
    aiModelRateLimit,
    validateJsonSchema({
        type: 'object',
        required: ['text'],
        properties: {
            text: { type: 'string', minLength: 1, maxLength: 4000 },
            language: { type: 'string' },
            voice: { type: 'string' },
            speed: { type: 'number', minimum: 0.25, maximum: 4.0 },
            format: { type: 'string', enum: ['mp3', 'opus', 'aac', 'flac'] },
            userId: { type: 'string' }
        },
        additionalProperties: false
    }),
    asyncHandler(async (req, res) => {
        const {
            text,
            language = 'en',
            voice,
            speed = 1.0,
            format = 'mp3',
            userId
        } = req.body;

        logger.info('Multi-language speech synthesis request', {
            textLength: text.length,
            language,
            voice,
            userId
        });

        const result = await multiLanguageVoiceController.generateVoiceResponse(text, language, {
            voice,
            speed,
            format,
            userId
        });

        res.set({
            'Content-Type': `audio/${format}`,
            'X-Language': language,
            'X-Voice': result.voice,
            'X-Duration': result.duration
        });

        res.send(result.audio);
    })
);

/**
 * @route POST /api/v1/voice/enhanced/multi-language/check-activation
 * @desc Check if text contains voice activation phrase
 * @access Public
 */
router.post('/multi-language/check-activation',
    aiModelRateLimit,
    validateJsonSchema({
        type: 'object',
        required: ['text'],
        properties: {
            text: { type: 'string', minLength: 1 },
            language: { type: 'string' }
        },
        additionalProperties: false
    }),
    asyncHandler(async (req, res) => {
        const { text, language = 'en' } = req.body;

        const isActivation = await multiLanguageVoiceController.checkActivationPhrase(text, language);

        res.json({
            success: true,
            data: {
                text,
                language,
                isActivation,
                timestamp: new Date().toISOString()
            }
        });
    })
);

/**
 * @route PUT /api/v1/voice/enhanced/multi-language/user-preferences/:userId
 * @desc Set user language preferences for voice
 * @access Public
 */
router.put('/multi-language/user-preferences/:userId',
    aiModelRateLimit,
    validateJsonSchema({
        type: 'object',
        required: ['language'],
        properties: {
            language: { type: 'string' },
            voiceSettings: { type: 'object' }
        },
        additionalProperties: false
    }),
    asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const { language, voiceSettings = {} } = req.body;

        const result = await multiLanguageVoiceController.setUserLanguagePreference(
            userId, 
            language, 
            voiceSettings
        );

        res.json({
            success: true,
            data: result
        });
    })
);

/**
 * @route GET /api/v1/voice/enhanced/multi-language/status
 * @desc Get multi-language voice service status
 * @access Public
 */
router.get('/multi-language/status',
    asyncHandler(async (req, res) => {
        const status = multiLanguageVoiceController.getServiceStatus();

        res.json({
            success: true,
            data: status,
            timestamp: new Date().toISOString()
        });
    })
);

export default router;