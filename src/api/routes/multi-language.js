import express from 'express';
import multer from 'multer';
import { MultiLanguageService } from '../services/MultiLanguageService.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const multiLanguageService = new MultiLanguageService();

// Configure multer for document uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/html',
      'application/json'
    ];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

/**
 * @route   GET /api/multi-language/supported-languages
 * @desc    Get list of supported languages
 * @access  Public
 */
router.get('/supported-languages', async (req, res, next) => {
  try {
    const languages = Array.from(multiLanguageService.supportedLanguages.values());
    
    res.json({
      success: true,
      data: {
        languages,
        defaultLanguage: 'en',
        count: languages.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/multi-language/detect
 * @desc    Detect language of provided text
 * @access  Public
 */
router.post('/detect', async (req, res, next) => {
  try {
    const { text, confidenceThreshold, fallbackLanguage } = req.body;

    if (!text) {
      throw new ApiError(400, 'Text is required for language detection');
    }

    const result = await multiLanguageService.detectLanguage(text, {
      confidenceThreshold,
      fallbackLanguage
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/multi-language/translate
 * @desc    Translate text between languages
 * @access  Public
 */
router.post('/translate', async (req, res, next) => {
  try {
    const {
      text,
      fromLanguage,
      toLanguage,
      industryContext = 'roofing',
      preserveFormatting = true,
      culturalAdaptation = true,
      useCache = true
    } = req.body;

    if (!text || !fromLanguage || !toLanguage) {
      throw new ApiError(400, 'Text, fromLanguage, and toLanguage are required');
    }

    const result = await multiLanguageService.translateText(text, fromLanguage, toLanguage, {
      industryContext,
      preserveFormatting,
      culturalAdaptation,
      useCache
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/multi-language/translate-voice-command
 * @desc    Translate voice commands between languages
 * @access  Public
 */
router.post('/translate-voice-command', async (req, res, next) => {
  try {
    const { command, fromLanguage, toLanguage } = req.body;

    if (!command || !fromLanguage || !toLanguage) {
      throw new ApiError(400, 'Command, fromLanguage, and toLanguage are required');
    }

    const result = await multiLanguageService.translateVoiceCommand(command, fromLanguage, toLanguage);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/multi-language/translate-document
 * @desc    Translate documents
 * @access  Public
 */
router.post('/translate-document', upload.single('document'), async (req, res, next) => {
  try {
    const { fromLanguage, toLanguage, documentType, preserveStructure } = req.body;
    
    let documentContent;
    
    if (req.file) {
      // Handle uploaded file
      documentContent = req.file.buffer.toString('utf-8');
    } else if (req.body.documentContent) {
      // Handle text content directly
      documentContent = req.body.documentContent;
    } else {
      throw new ApiError(400, 'Document file or content is required');
    }

    if (!fromLanguage || !toLanguage) {
      throw new ApiError(400, 'fromLanguage and toLanguage are required');
    }

    const result = await multiLanguageService.translateDocument(documentContent, fromLanguage, toLanguage, {
      documentType,
      preserveStructure: preserveStructure !== 'false'
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/multi-language/templates/:templateType/:language
 * @desc    Get localized template
 * @access  Public
 */
router.get('/templates/:templateType/:language', async (req, res, next) => {
  try {
    const { templateType, language } = req.params;
    const context = req.query;

    const result = await multiLanguageService.getLocalizedTemplate(templateType, language, context);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/multi-language/user-preferences/:userId
 * @desc    Update user language preferences
 * @access  Private
 */
router.put('/user-preferences/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { language } = req.body;

    if (!language) {
      throw new ApiError(400, 'Language is required');
    }

    const result = await multiLanguageService.switchUILanguage(userId, language);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/multi-language/user-preferences/:userId
 * @desc    Get user language preferences
 * @access  Private
 */
router.get('/user-preferences/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;

    const preferences = await multiLanguageService.getUserLanguagePreferences(userId);

    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/multi-language/terminology/:language
 * @desc    Get industry terminology for a language
 * @access  Public
 */
router.get('/terminology/:language', async (req, res, next) => {
  try {
    const { language } = req.params;
    const { category } = req.query;

    const terminology = await multiLanguageService.getIndustryTerminology(language, category);

    res.json({
      success: true,
      data: {
        language,
        category: category || 'all',
        terminology,
        count: Object.keys(terminology).length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/multi-language/terminology/:language
 * @desc    Update industry terminology for a language
 * @access  Private (Admin only)
 */
router.put('/terminology/:language', async (req, res, next) => {
  try {
    const { language } = req.params;
    const { terms } = req.body;

    if (!terms || typeof terms !== 'object') {
      throw new ApiError(400, 'Terms object is required');
    }

    const result = await multiLanguageService.updateTerminology(language, terms);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/multi-language/voice-commands/:language
 * @desc    Get voice commands for a language
 * @access  Public
 */
router.get('/voice-commands/:language', async (req, res, next) => {
  try {
    const { language } = req.params;

    const commands = multiLanguageService.voiceCommands.get(language);
    
    if (!commands) {
      throw new ApiError(404, `Voice commands not available for ${language}`);
    }

    res.json({
      success: true,
      data: {
        language,
        commands,
        count: Object.keys(commands).length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/multi-language/cultural-adaptations/:language
 * @desc    Get cultural adaptation settings for a language
 * @access  Public
 */
router.get('/cultural-adaptations/:language', async (req, res, next) => {
  try {
    const { language } = req.params;

    const adaptation = multiLanguageService.culturalAdaptations.get(language);
    
    if (!adaptation) {
      throw new ApiError(404, `Cultural adaptations not available for ${language}`);
    }

    res.json({
      success: true,
      data: {
        language,
        adaptation
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/multi-language/batch-translate
 * @desc    Translate multiple texts in batch
 * @access  Public
 */
router.post('/batch-translate', async (req, res, next) => {
  try {
    const { texts, fromLanguage, toLanguage, options = {} } = req.body;

    if (!texts || !Array.isArray(texts) || !fromLanguage || !toLanguage) {
      throw new ApiError(400, 'Texts array, fromLanguage, and toLanguage are required');
    }

    const results = [];
    
    for (const text of texts) {
      try {
        const result = await multiLanguageService.translateText(text, fromLanguage, toLanguage, options);
        results.push(result);
      } catch (error) {
        logger.error(`Batch translation failed for text: ${text.substring(0, 50)}...`, error);
        results.push({
          originalText: text,
          translatedText: text, // Fallback to original
          error: error.message,
          fromLanguage,
          toLanguage
        });
      }
    }

    res.json({
      success: true,
      data: {
        results,
        totalItems: texts.length,
        successfulTranslations: results.filter(r => !r.error).length,
        failedTranslations: results.filter(r => r.error).length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/multi-language/stats
 * @desc    Get multi-language service statistics
 * @access  Public
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = multiLanguageService.getServiceStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/multi-language/auto-detect-and-translate
 * @desc    Automatically detect language and translate to target language
 * @access  Public
 */
router.post('/auto-detect-and-translate', async (req, res, next) => {
  try {
    const {
      text,
      targetLanguage,
      industryContext = 'roofing',
      culturalAdaptation = true,
      confidenceThreshold = 0.8
    } = req.body;

    if (!text || !targetLanguage) {
      throw new ApiError(400, 'Text and targetLanguage are required');
    }

    // First detect the language
    const detection = await multiLanguageService.detectLanguage(text, {
      confidenceThreshold
    });

    let translationResult = null;

    // Only translate if detected language is different from target
    if (detection.language !== targetLanguage) {
      translationResult = await multiLanguageService.translateText(
        text, 
        detection.language, 
        targetLanguage, 
        {
          industryContext,
          culturalAdaptation
        }
      );
    }

    res.json({
      success: true,
      data: {
        detection,
        translation: translationResult,
        needsTranslation: detection.language !== targetLanguage
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;