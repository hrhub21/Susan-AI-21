import express from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateJsonSchema, schemas } from '../middleware/validation.js';
import { aiModelRateLimit, fileUploadRateLimit } from '../middleware/rateLimit.js';
import { VoiceController } from '../controllers/VoiceController.js';

const router = express.Router();
const voiceController = new VoiceController();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for audio files
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Allow common audio formats
    const allowedMimeTypes = [
      'audio/mpeg',
      'audio/wav',
      'audio/mp3',
      'audio/m4a',
      'audio/webm',
      'audio/ogg',
      'audio/flac'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file format'), false);
    }
  }
});

// Transcribe audio to text
router.post('/transcribe',
  fileUploadRateLimit,
  upload.single('audio'),
  asyncHandler(voiceController.transcribeAudio.bind(voiceController))
);

// Convert text to speech
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
      }
    },
    additionalProperties: false
  }),
  asyncHandler(voiceController.synthesizeSpeech.bind(voiceController))
);

// Get available voices
router.get('/voices',
  asyncHandler(voiceController.getAvailableVoices.bind(voiceController))
);

// Voice conversation (transcribe + process + synthesize)
router.post('/conversation',
  fileUploadRateLimit,
  upload.single('audio'),
  asyncHandler(voiceController.voiceConversation.bind(voiceController))
);

export default router;