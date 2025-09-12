import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import EventEmitter from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Comprehensive Multi-Language Support Service for Susan AI
 * 
 * Features:
 * - Language Detection & Auto-switching
 * - Real-time Translation Engine
 * - Industry-specific Terminology
 * - Voice Commands in Multiple Languages
 * - Document Translation
 * - Cultural Adaptation
 * - Spanish Language Pack
 * - Template Localization
 */
export class MultiLanguageService extends EventEmitter {
  constructor() {
    super();
    this.dataDir = path.join(__dirname, '../../../data/languages');
    this.initializeService();
    this.supportedLanguages = new Map();
    this.terminologyDatabases = new Map();
    this.culturalAdaptations = new Map();
    this.translationCache = new Map();
    this.voiceCommands = new Map();
    this.initializeLanguagePacks();
  }

  async initializeService() {
    try {
      await fs.ensureDir(this.dataDir);
      await fs.ensureDir(path.join(this.dataDir, 'translations'));
      await fs.ensureDir(path.join(this.dataDir, 'terminology'));
      await fs.ensureDir(path.join(this.dataDir, 'templates'));
      await fs.ensureDir(path.join(this.dataDir, 'voice-commands'));
      await fs.ensureDir(path.join(this.dataDir, 'cultural-adaptations'));
      
      // Initialize Google Translate client if API key is available
      if (process.env.GOOGLE_TRANSLATE_API_KEY) {
        this.googleTranslateApiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
        this.googleTranslateUrl = 'https://translation.googleapis.com/language/translate/v2';
      } else {
        logger.warn('Google Translate API key not configured. Translation features will use fallback methods.');
      }

      await this.loadLanguageData();
      logger.info('MultiLanguageService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MultiLanguageService:', error);
      throw new ApiError(500, 'Failed to initialize multi-language service');
    }
  }

  async initializeLanguagePacks() {
    // Initialize supported languages with comprehensive roofing industry support
    this.supportedLanguages.set('en', {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      isDefault: true,
      voiceModel: 'en-US',
      culturalContext: 'direct',
      formality: 'professional'
    });

    this.supportedLanguages.set('es', {
      code: 'es',
      name: 'Spanish',
      nativeName: 'Español',
      isDefault: false,
      voiceModel: 'es-ES',
      culturalContext: 'respectful',
      formality: 'formal'
    });

    // Add more languages for future expansion
    this.supportedLanguages.set('fr', {
      code: 'fr',
      name: 'French',
      nativeName: 'Français',
      isDefault: false,
      voiceModel: 'fr-FR',
      culturalContext: 'formal',
      formality: 'very_formal'
    });

    await this.initializeSpanishLanguagePack();
    await this.initializeVoiceCommands();
    await this.initializeCulturalAdaptations();
  }

  async initializeSpanishLanguagePack() {
    // Comprehensive Spanish roofing industry terminology
    const spanishTerminology = {
      // Basic roofing terms
      'roof': 'techo',
      'roofing': 'techado',
      'roofer': 'techador',
      'contractor': 'contratista',
      'estimate': 'presupuesto',
      'inspection': 'inspección',
      'damage': 'daño',
      'repair': 'reparación',
      'replacement': 'reemplazo',
      'installation': 'instalación',
      
      // Materials
      'shingles': 'tejas',
      'tile': 'teja',
      'metal roofing': 'techado metálico',
      'membrane': 'membrana',
      'underlayment': 'subcapa',
      'flashing': 'tapajuntas',
      'gutter': 'canalón',
      'downspout': 'bajante',
      'ridge': 'caballete',
      'valley': 'valle',
      'fascia': 'tabla de alero',
      'soffit': 'sofito',
      'drip edge': 'gotero',
      
      // Damage types
      'hail damage': 'daño por granizo',
      'wind damage': 'daño por viento',
      'storm damage': 'daño por tormenta',
      'leak': 'filtración',
      'missing shingles': 'tejas faltantes',
      'cracked tiles': 'tejas agrietadas',
      'structural damage': 'daño estructural',
      
      // Insurance terms
      'claim': 'reclamo',
      'adjuster': 'ajustador',
      'policy': 'póliza',
      'deductible': 'deducible',
      'coverage': 'cobertura',
      'depreciation': 'depreciación',
      'settlement': 'liquidación',
      'supplement': 'suplemento',
      
      // Professional greetings and responses
      'Hello Susan': 'Hola Susan',
      'Good morning': 'Buenos días',
      'Good afternoon': 'Buenas tardes',
      'Good evening': 'Buenas noches',
      'Thank you': 'Gracias',
      'You\'re welcome': 'De nada',
      'Please': 'Por favor',
      'Excuse me': 'Disculpe',
      'I understand': 'Entiendo',
      'Can you help me': '¿Puede ayudarme?',
      'What is the status': '¿Cuál es el estado?',
      'Schedule inspection': 'Programar inspección',
      'Generate report': 'Generar informe',
      'Upload photos': 'Subir fotos',
      'Review estimate': 'Revisar presupuesto'
    };

    this.terminologyDatabases.set('es', spanishTerminology);

    // Spanish UI translations
    const spanishUI = {
      // Navigation
      'Dashboard': 'Panel de Control',
      'Claims': 'Reclamos',
      'Reports': 'Informes',
      'Settings': 'Configuración',
      'Help': 'Ayuda',
      'Logout': 'Cerrar Sesión',
      
      // Common actions
      'Save': 'Guardar',
      'Cancel': 'Cancelar',
      'Delete': 'Eliminar',
      'Edit': 'Editar',
      'Create': 'Crear',
      'Submit': 'Enviar',
      'Upload': 'Subir',
      'Download': 'Descargar',
      'Print': 'Imprimir',
      'Export': 'Exportar',
      
      // Status messages
      'Success': 'Éxito',
      'Error': 'Error',
      'Warning': 'Advertencia',
      'Loading': 'Cargando',
      'Processing': 'Procesando',
      'Complete': 'Completo',
      'Pending': 'Pendiente',
      
      // Forms
      'First Name': 'Nombre',
      'Last Name': 'Apellido',
      'Email': 'Correo Electrónico',
      'Phone': 'Teléfono',
      'Address': 'Dirección',
      'City': 'Ciudad',
      'State': 'Estado',
      'Zip Code': 'Código Postal',
      'Date': 'Fecha',
      'Time': 'Hora',
      'Description': 'Descripción',
      'Comments': 'Comentarios',
      
      // Roofing specific
      'Roof Inspection': 'Inspección de Techo',
      'Damage Assessment': 'Evaluación de Daños',
      'Material List': 'Lista de Materiales',
      'Labor Cost': 'Costo de Mano de Obra',
      'Total Cost': 'Costo Total',
      'Insurance Information': 'Información del Seguro',
      'Claim Number': 'Número de Reclamo',
      'Policy Number': 'Número de Póliza',
      'Adjuster Name': 'Nombre del Ajustador',
      'Date of Loss': 'Fecha de Pérdida'
    };

    await this.saveTranslations('es', 'ui', spanishUI);
    logger.info('Spanish language pack initialized successfully');
  }

  async initializeVoiceCommands() {
    // English voice commands
    const englishCommands = {
      'hello susan': 'voice_activation',
      'hey susan': 'voice_activation',
      'susan': 'voice_activation',
      'start inspection': 'start_inspection',
      'create report': 'create_report',
      'schedule appointment': 'schedule_appointment',
      'check claim status': 'check_claim_status',
      'upload photos': 'upload_photos',
      'generate estimate': 'generate_estimate',
      'call adjuster': 'call_adjuster',
      'review documents': 'review_documents',
      'save progress': 'save_progress',
      'navigate to dashboard': 'navigate_dashboard',
      'help me': 'show_help',
      'what can you do': 'show_capabilities',
      'goodbye': 'end_session',
      'thank you': 'acknowledge'
    };

    // Spanish voice commands
    const spanishCommands = {
      'hola susan': 'voice_activation',
      'oye susan': 'voice_activation',
      'susan': 'voice_activation',
      'iniciar inspección': 'start_inspection',
      'crear informe': 'create_report',
      'programar cita': 'schedule_appointment',
      'verificar estado del reclamo': 'check_claim_status',
      'subir fotos': 'upload_photos',
      'generar presupuesto': 'generate_estimate',
      'llamar ajustador': 'call_adjuster',
      'revisar documentos': 'review_documents',
      'guardar progreso': 'save_progress',
      'ir al panel': 'navigate_dashboard',
      'ayúdame': 'show_help',
      'qué puedes hacer': 'show_capabilities',
      'adiós': 'end_session',
      'gracias': 'acknowledge'
    };

    this.voiceCommands.set('en', englishCommands);
    this.voiceCommands.set('es', spanishCommands);

    await this.saveVoiceCommands('en', englishCommands);
    await this.saveVoiceCommands('es', spanishCommands);
    
    logger.info('Voice commands initialized for multiple languages');
  }

  async initializeCulturalAdaptations() {
    // Cultural communication styles
    const culturalAdaptations = {
      'en': {
        greeting: 'professional',
        formality: 'moderate',
        directness: 'high',
        timeContext: 'monochronic',
        personalSpace: 'formal',
        decisionMaking: 'individual',
        communicationStyle: 'low-context'
      },
      'es': {
        greeting: 'warm',
        formality: 'high',
        directness: 'moderate',
        timeContext: 'polychronic',
        personalSpace: 'close',
        decisionMaking: 'relationship-based',
        communicationStyle: 'high-context'
      }
    };

    this.culturalAdaptations = new Map(Object.entries(culturalAdaptations));
    await this.saveCulturalAdaptations(culturalAdaptations);
    
    logger.info('Cultural adaptations initialized');
  }

  /**
   * Detect language from text input
   */
  async detectLanguage(text, options = {}) {
    try {
      const { confidenceThreshold = 0.8, fallbackLanguage = 'en' } = options;
      
      // Simple heuristic detection using key language indicators
      const languageIndicators = {
        'es': ['el', 'la', 'los', 'las', 'de', 'en', 'que', 'con', 'por', 'para', 'se', 'no', 'un', 'una', 'su', 'como', 'más', 'pero', 'muy', 'todo', 'hacer', 'tiempo', 'año', 'día', 'vida', 'agua', 'trabajo', 'lugar', 'momento', 'país', 'hora', 'nombre', 'ciudad', 'persona', 'problema', 'número', 'estado', 'poder', 'madre', 'hijo', 'tipo', 'nivel', 'punto', 'semana', 'mes', 'sistema', 'derecho', 'libro', 'papel', 'precio', 'paso', 'capital', 'material', 'centro', 'servicio', 'escuela', 'guerra', 'paz', 'mesa', 'calle', 'verdad', 'animal', 'planta', 'futuro', 'pasado', 'presente', 'grande', 'pequeño', 'nuevo', 'viejo', 'bueno', 'malo', 'mejor', 'peor', 'primero', 'último', 'mismo', 'otro', 'nada', 'mucho', 'poco', 'menos', 'siempre', 'nunca', 'aquí', 'allí', 'donde', 'cuando', 'porque', 'aunque', 'mientras', 'durante', 'desde', 'hasta', 'entre', 'sobre', 'bajo', 'dentro', 'fuera', 'cerca', 'lejos'],
        'en': ['the', 'and', 'to', 'of', 'a', 'in', 'that', 'have', 'for', 'not', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'water', 'been', 'call', 'oil', 'sit', 'down', 'side', 'find', 'head', 'stand', 'own', 'page', 'should', 'country', 'found', 'answer', 'school', 'grow', 'study', 'still', 'learn', 'plant', 'cover', 'food', 'sun', 'four', 'between', 'state', 'keep', 'eye', 'never', 'last', 'let', 'thought', 'city', 'tree', 'cross', 'farm', 'hard', 'start', 'might', 'story', 'saw', 'far', 'sea', 'draw', 'left', 'late', 'run', 'while', 'press', 'close', 'night', 'real', 'life', 'few', 'north', 'book', 'carry', 'took', 'science', 'eat', 'room', 'friend', 'began', 'idea', 'fish', 'mountain', 'stop', 'once', 'base', 'hear', 'horse', 'cut', 'sure', 'watch', 'color', 'face', 'wood', 'main', 'open', 'seem', 'together', 'next', 'white', 'children', 'begin', 'got', 'walk', 'example', 'ease', 'paper', 'group', 'always', 'music', 'those', 'both', 'mark', 'often', 'letter', 'until', 'mile', 'river', 'car', 'feet', 'care', 'second', 'enough', 'plain', 'girl', 'usual', 'young', 'ready', 'above', 'ever', 'red', 'list', 'though', 'feel', 'talk', 'bird', 'soon', 'body', 'dog', 'family', 'direct', 'pose', 'leave', 'song', 'measure', 'door', 'product', 'black', 'short', 'numeral', 'class', 'wind', 'question', 'happen', 'complete', 'ship', 'area', 'half', 'rock', 'order', 'fire', 'south', 'problem', 'piece', 'told', 'knew', 'pass', 'since', 'top', 'whole', 'king', 'space', 'heard', 'best', 'hour', 'better', 'during', 'hundred', 'five', 'remember', 'step', 'early', 'hold', 'west', 'ground', 'interest', 'reach', 'fast', 'verb', 'sing', 'listen', 'six', 'table', 'travel', 'less', 'morning', 'ten', 'simple', 'several', 'vowel', 'toward', 'war', 'lay', 'against', 'pattern', 'slow', 'center', 'love', 'person', 'money', 'serve', 'appear', 'road', 'map', 'rain', 'rule', 'govern', 'pull', 'cold', 'notice', 'voice', 'unit', 'power', 'town', 'fine', 'certain', 'fly', 'fall', 'lead', 'cry', 'dark', 'machine', 'note', 'wait', 'plan', 'figure', 'star', 'box', 'noun', 'field', 'rest', 'correct', 'able', 'pound', 'done', 'beauty', 'drive', 'stood', 'contain', 'front', 'teach', 'week', 'final', 'gave', 'green', 'oh', 'quick', 'develop', 'ocean', 'warm', 'free', 'minute', 'strong', 'special', 'mind', 'behind', 'clear', 'tail', 'produce', 'fact', 'street', 'inch', 'multiply', 'nothing', 'course', 'stay', 'wheel', 'full', 'force', 'blue', 'object', 'decide', 'surface', 'deep', 'moon', 'island', 'foot', 'system', 'busy', 'test', 'record', 'boat', 'common', 'gold', 'possible', 'plane', 'stead', 'dry', 'wonder', 'laugh', 'thousands', 'ago', 'ran', 'check', 'game', 'shape', 'equate', 'hot', 'miss', 'brought', 'heat', 'snow', 'tire', 'bring', 'yes', 'distant', 'fill', 'east', 'paint', 'language', 'among', 'grand', 'ball', 'yet', 'wave', 'drop', 'heart', 'am', 'present', 'heavy', 'dance', 'engine', 'position', 'arm', 'wide', 'sail', 'material', 'size', 'vary', 'settle', 'speak', 'weight', 'general', 'ice', 'matter', 'circle', 'pair', 'include', 'divide', 'syllable', 'felt', 'perhaps', 'pick', 'sudden', 'count', 'square', 'reason', 'length', 'represent', 'art', 'subject', 'region', 'energy', 'hunt', 'probable', 'bed', 'brother', 'egg', 'ride', 'cell', 'believe', 'fraction', 'forest', 'race', 'window', 'store', 'summer', 'train', 'sleep', 'prove', 'lone', 'leg', 'exercise', 'wall', 'catch', 'mount', 'wish', 'sky', 'board', 'joy', 'winter', 'sat', 'written', 'wild', 'instrument', 'kept', 'glass', 'grass', 'cow', 'job', 'edge', 'sign', 'visit', 'past', 'soft', 'fun', 'bright', 'gas', 'weather', 'month', 'million', 'bear', 'finish', 'happy', 'hope', 'flower', 'clothe', 'strange', 'gone', 'jump', 'baby', 'eight', 'village', 'meet', 'root', 'buy', 'raise', 'solve', 'metal', 'whether', 'push', 'seven', 'paragraph', 'third', 'shall', 'held', 'hair', 'describe', 'cook', 'floor', 'either', 'result', 'burn', 'hill', 'safe', 'cat', 'century', 'consider', 'type', 'law', 'bit', 'coast', 'copy', 'phrase', 'silent', 'tall', 'sand', 'soil', 'roll', 'temperature', 'finger', 'industry', 'value', 'fight', 'lie', 'beat', 'excite', 'natural', 'view', 'sense', 'ear', 'else', 'quite', 'broke', 'case', 'middle', 'kill', 'son', 'lake', 'moment', 'scale', 'loud', 'spring', 'observe', 'child', 'straight', 'consonant', 'nation', 'dictionary', 'milk', 'speed', 'method', 'organ', 'pay', 'age', 'section', 'dress', 'cloud', 'surprise', 'quiet', 'stone', 'tiny', 'climb', 'bad', 'blood', 'touch', 'grew', 'cent', 'mix', 'team', 'wire', 'cost', 'lost', 'brown', 'wear', 'garden', 'equal', 'sent', 'choose', 'fell', 'fit', 'flow', 'fair', 'bank', 'collect', 'save', 'control', 'decimal', 'gentle', 'woman', 'captain', 'practice', 'separate', 'difficult', 'doctor', 'please', 'protect', 'noon', 'whose', 'locate', 'ring', 'character', 'insect', 'caught', 'period', 'indicate', 'radio', 'spoke', 'atom', 'human', 'history', 'effect', 'electric', 'expect', 'crop', 'modern', 'element', 'hit', 'student', 'corner', 'party', 'supply', 'bone', 'rail', 'imagine', 'provide', 'agree', 'thus', 'capital', 'chair', 'danger', 'fruit', 'rich', 'thick', 'soldier', 'process', 'operate', 'guess', 'necessary', 'sharp', 'wing', 'create', 'neighbor', 'wash', 'bat', 'rather', 'crowd', 'corn', 'compare', 'poem', 'string', 'bell', 'depend', 'meat', 'rub', 'tube', 'famous', 'dollar', 'stream', 'fear', 'sight', 'thin', 'triangle', 'planet', 'hurry', 'chief', 'colony', 'clock', 'mine', 'tie', 'enter', 'major', 'fresh', 'search', 'send', 'yellow', 'gun', 'allow', 'print', 'dead', 'spot', 'desert', 'suit', 'current', 'lift', 'rose', 'continue', 'block', 'chart', 'hat', 'sell', 'success', 'company', 'subtract']
      };

      let detectedLanguage = fallbackLanguage;
      let confidence = 0;

      const words = text.toLowerCase().split(/\s+/);
      const wordCount = words.length;

      // Count matches for each language
      for (const [lang, indicators] of Object.entries(languageIndicators)) {
        let matches = 0;
        for (const word of words) {
          if (indicators.includes(word)) {
            matches++;
          }
        }
        
        const langConfidence = wordCount > 0 ? matches / wordCount : 0;

        if (langConfidence > confidence && langConfidence >= confidenceThreshold) {
          confidence = langConfidence;
          detectedLanguage = lang;
        }
      }

      // Use Google Translate API for more accurate detection if available
      if (this.googleTranslateApiKey && confidence < confidenceThreshold) {
        try {
          const response = await axios.post(`${this.googleTranslateUrl}/detect`, null, {
            params: {
              key: this.googleTranslateApiKey,
              q: text
            }
          });

          if (response.data && response.data.data && response.data.data.detections) {
            const detection = response.data.data.detections[0][0];
            if (detection.confidence >= confidenceThreshold) {
              detectedLanguage = detection.language;
              confidence = detection.confidence;
            }
          }
        } catch (error) {
          logger.warn('Google Translate API detection failed:', error.message);
        }
      }

      const result = {
        language: detectedLanguage,
        confidence,
        isSupported: this.supportedLanguages.has(detectedLanguage),
        timestamp: new Date().toISOString()
      };

      this.emit('languageDetected', result);
      logger.info('Language detected:', result);

      return result;
    } catch (error) {
      logger.error('Language detection failed:', error);
      throw new ApiError(500, 'Language detection failed');
    }
  }

  /**
   * Translate text between languages
   */
  async translateText(text, fromLang, toLang, options = {}) {
    try {
      const {
        useCache = true,
        industryContext = 'roofing',
        preserveFormatting = true,
        culturalAdaptation = true
      } = options;

      // Check cache first
      const cacheKey = `${fromLang}_${toLang}_${text}`;
      if (useCache && this.translationCache.has(cacheKey)) {
        const cached = this.translationCache.get(cacheKey);
        logger.info('Translation served from cache');
        return cached;
      }

      let translatedText = text;

      // Use terminology database for industry-specific terms
      if (industryContext === 'roofing') {
        translatedText = await this.applyIndustryTerminology(text, fromLang, toLang);
      }

      // Use Google Translate API if available
      if (this.googleTranslateApiKey && fromLang !== toLang) {
        try {
          const response = await axios.post(this.googleTranslateUrl, null, {
            params: {
              key: this.googleTranslateApiKey,
              q: translatedText,
              source: fromLang,
              target: toLang,
              format: preserveFormatting ? 'html' : 'text'
            }
          });

          if (response.data && response.data.data && response.data.data.translations) {
            translatedText = response.data.data.translations[0].translatedText;
          }
        } catch (error) {
          logger.warn('Google Translate API failed, using fallback:', error.message);
        }
      }

      // Apply cultural adaptation
      if (culturalAdaptation) {
        translatedText = await this.applyCulturalAdaptation(translatedText, toLang);
      }

      const result = {
        originalText: text,
        translatedText,
        fromLanguage: fromLang,
        toLanguage: toLang,
        confidence: 0.9,
        timestamp: new Date().toISOString(),
        metadata: {
          industryContext,
          culturallyAdapted: culturalAdaptation,
          cacheUsed: false
        }
      };

      // Cache the result
      if (useCache) {
        this.translationCache.set(cacheKey, result);
      }

      this.emit('textTranslated', result);
      logger.info('Text translated successfully:', {
        fromLang,
        toLang,
        originalLength: text.length,
        translatedLength: translatedText.length
      });

      return result;
    } catch (error) {
      logger.error('Translation failed:', error);
      throw new ApiError(500, 'Translation failed');
    }
  }

  /**
   * Apply industry-specific terminology
   */
  async applyIndustryTerminology(text, fromLang, toLang) {
    try {
      const fromTerms = this.terminologyDatabases.get(fromLang);
      const toTerms = this.terminologyDatabases.get(toLang);

      if (!fromTerms || !toTerms) {
        return text;
      }

      let processedText = text;

      // Replace terms based on direction of translation
      if (fromLang === 'en' && toLang === 'es') {
        // English to Spanish
        for (const [englishTerm, spanishTerm] of Object.entries(toTerms)) {
          const regex = new RegExp(`\\b${englishTerm}\\b`, 'gi');
          processedText = processedText.replace(regex, spanishTerm);
        }
      } else if (fromLang === 'es' && toLang === 'en') {
        // Spanish to English
        for (const [englishTerm, spanishTerm] of Object.entries(toTerms)) {
          const regex = new RegExp(`\\b${spanishTerm}\\b`, 'gi');
          processedText = processedText.replace(regex, englishTerm);
        }
      }

      return processedText;
    } catch (error) {
      logger.error('Industry terminology application failed:', error);
      return text;
    }
  }

  /**
   * Apply cultural adaptation to translated text
   */
  async applyCulturalAdaptation(text, language) {
    try {
      const adaptation = this.culturalAdaptations.get(language);
      if (!adaptation) {
        return text;
      }

      let adaptedText = text;

      // Apply formality adjustments
      if (language === 'es' && adaptation.formality === 'high') {
        // Add formal Spanish markers
        adaptedText = adaptedText.replace(/\btú\b/g, 'usted');
        adaptedText = adaptedText.replace(/\btu\b/g, 'su');
        
        // Add respectful greetings if starting conversation
        if (text.toLowerCase().includes('hello') || text.toLowerCase().includes('hi')) {
          adaptedText = adaptedText.replace(/hello|hi/gi, 'Buenos días');
        }
      }

      // Apply communication style adaptations
      if (adaptation.communicationStyle === 'high-context') {
        // Add context and relationship building for high-context cultures
        if (text.toLowerCase().includes('we need to')) {
          adaptedText = adaptedText.replace(/we need to/gi, 'sería muy apreciado si pudiéramos');
        }
      }

      return adaptedText;
    } catch (error) {
      logger.error('Cultural adaptation failed:', error);
      return text;
    }
  }

  /**
   * Translate voice commands
   */
  async translateVoiceCommand(command, fromLang, toLang) {
    try {
      const fromCommands = this.voiceCommands.get(fromLang);
      const toCommands = this.voiceCommands.get(toLang);

      if (!fromCommands || !toCommands) {
        throw new ApiError(400, `Voice commands not available for ${fromLang} or ${toLang}`);
      }

      const normalizedCommand = command.toLowerCase().trim();
      const commandAction = fromCommands[normalizedCommand];

      if (!commandAction) {
        // Try fuzzy matching
        const possibleCommands = Object.keys(fromCommands);
        const fuzzyMatch = possibleCommands.find(cmd => 
          this.calculateSimilarity(normalizedCommand, cmd) > 0.7
        );

        if (fuzzyMatch) {
          const action = fromCommands[fuzzyMatch];
          // Find the equivalent command in target language
          const targetCommand = Object.keys(toCommands).find(cmd => 
            toCommands[cmd] === action
          );
          
          return {
            originalCommand: command,
            translatedCommand: targetCommand || command,
            action,
            confidence: 0.7,
            fuzzyMatch: true
          };
        }

        throw new ApiError(404, 'Voice command not recognized');
      }

      // Find the equivalent command in target language
      const targetCommand = Object.keys(toCommands).find(cmd => 
        toCommands[cmd] === commandAction
      );

      const result = {
        originalCommand: command,
        translatedCommand: targetCommand || command,
        action: commandAction,
        confidence: 1.0,
        fuzzyMatch: false
      };

      this.emit('voiceCommandTranslated', result);
      return result;
    } catch (error) {
      logger.error('Voice command translation failed:', error);
      throw error;
    }
  }

  /**
   * Translate documents (insurance documents, reports, etc.)
   */
  async translateDocument(documentContent, fromLang, toLang, options = {}) {
    try {
      const {
        documentType = 'general',
        preserveStructure = true,
        translateMetadata = true
      } = options;

      const chunks = this.splitDocumentIntoChunks(documentContent, 4000);
      const translatedChunks = [];

      for (const chunk of chunks) {
        const translatedChunk = await this.translateText(chunk, fromLang, toLang, {
          industryContext: 'roofing',
          preserveFormatting: preserveStructure,
          culturalAdaptation: true
        });
        translatedChunks.push(translatedChunk.translatedText);
      }

      const translatedDocument = translatedChunks.join(' ');

      const result = {
        originalDocument: documentContent,
        translatedDocument,
        fromLanguage: fromLang,
        toLanguage: toLang,
        documentType,
        chunkCount: chunks.length,
        timestamp: new Date().toISOString(),
        metadata: {
          originalLength: documentContent.length,
          translatedLength: translatedDocument.length,
          structurePreserved: preserveStructure
        }
      };

      this.emit('documentTranslated', result);
      logger.info('Document translated successfully:', {
        documentType,
        fromLang,
        toLang,
        chunkCount: chunks.length
      });

      return result;
    } catch (error) {
      logger.error('Document translation failed:', error);
      throw new ApiError(500, 'Document translation failed');
    }
  }

  /**
   * Get localized templates for communication
   */
  async getLocalizedTemplate(templateType, language, context = {}) {
    try {
      const templatePath = path.join(this.dataDir, 'templates', language, `${templateType}.json`);
      
      let template;
      if (await fs.pathExists(templatePath)) {
        template = await fs.readJSON(templatePath);
      } else {
        // Load default English template and translate
        const defaultPath = path.join(this.dataDir, 'templates', 'en', `${templateType}.json`);
        if (await fs.pathExists(defaultPath)) {
          const defaultTemplate = await fs.readJSON(defaultPath);
          template = await this.translateTemplate(defaultTemplate, 'en', language);
          
          // Save translated template for future use
          await fs.ensureDir(path.dirname(templatePath));
          await fs.writeJSON(templatePath, template, { spaces: 2 });
        } else {
          throw new ApiError(404, `Template ${templateType} not found`);
        }
      }

      // Replace template variables with context values
      const populatedTemplate = this.populateTemplate(template, context);

      return {
        template: populatedTemplate,
        language,
        templateType,
        context,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get localized template:', error);
      throw error;
    }
  }

  /**
   * Switch user interface language
   */
  async switchUILanguage(userId, newLanguage) {
    try {
      if (!this.supportedLanguages.has(newLanguage)) {
        throw new ApiError(400, `Language ${newLanguage} is not supported`);
      }

      const userPreferencesPath = path.join(this.dataDir, 'user-preferences', `${userId}.json`);
      
      let preferences = {};
      if (await fs.pathExists(userPreferencesPath)) {
        preferences = await fs.readJSON(userPreferencesPath);
      }

      preferences.language = newLanguage;
      preferences.updatedAt = new Date().toISOString();

      await fs.ensureDir(path.dirname(userPreferencesPath));
      await fs.writeJSON(userPreferencesPath, preferences, { spaces: 2 });

      const languageInfo = this.supportedLanguages.get(newLanguage);
      
      const result = {
        userId,
        previousLanguage: preferences.previousLanguage || 'en',
        newLanguage,
        languageInfo,
        timestamp: new Date().toISOString()
      };

      this.emit('languageSwitched', result);
      logger.info('UI language switched:', result);

      return result;
    } catch (error) {
      logger.error('Failed to switch UI language:', error);
      throw error;
    }
  }

  /**
   * Get user's language preferences
   */
  async getUserLanguagePreferences(userId) {
    try {
      const userPreferencesPath = path.join(this.dataDir, 'user-preferences', `${userId}.json`);
      
      if (await fs.pathExists(userPreferencesPath)) {
        const preferences = await fs.readJSON(userPreferencesPath);
        return {
          ...preferences,
          supportedLanguages: Array.from(this.supportedLanguages.values())
        };
      }

      // Return default preferences
      return {
        language: 'en',
        voiceLanguage: 'en',
        culturalAdaptation: true,
        formalityLevel: 'professional',
        supportedLanguages: Array.from(this.supportedLanguages.values())
      };
    } catch (error) {
      logger.error('Failed to get user language preferences:', error);
      throw new ApiError(500, 'Failed to get language preferences');
    }
  }

  /**
   * Get industry terminology for a specific language
   */
  async getIndustryTerminology(language, category = 'all') {
    try {
      const terminology = this.terminologyDatabases.get(language);
      if (!terminology) {
        throw new ApiError(404, `Terminology not available for ${language}`);
      }

      if (category === 'all') {
        return terminology;
      }

      // Filter by category if implemented
      return terminology;
    } catch (error) {
      logger.error('Failed to get industry terminology:', error);
      throw error;
    }
  }

  /**
   * Add or update terminology
   */
  async updateTerminology(language, terms) {
    try {
      if (!this.terminologyDatabases.has(language)) {
        this.terminologyDatabases.set(language, {});
      }

      const currentTerms = this.terminologyDatabases.get(language);
      const updatedTerms = { ...currentTerms, ...terms };
      
      this.terminologyDatabases.set(language, updatedTerms);

      // Save to file
      const terminologyPath = path.join(this.dataDir, 'terminology', `${language}.json`);
      await fs.ensureDir(path.dirname(terminologyPath));
      await fs.writeJSON(terminologyPath, updatedTerms, { spaces: 2 });

      logger.info(`Terminology updated for ${language}`, { termCount: Object.keys(terms).length });

      return {
        language,
        addedTerms: Object.keys(terms).length,
        totalTerms: Object.keys(updatedTerms).length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to update terminology:', error);
      throw new ApiError(500, 'Failed to update terminology');
    }
  }

  // Helper methods
  splitDocumentIntoChunks(text, maxChunkSize) {
    const chunks = [];
    const sentences = text.split(/[.!?]+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
      }
      currentChunk += sentence + '.';
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    return (longer.length - this.editDistance(longer, shorter)) / longer.length;
  }

  editDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  populateTemplate(template, context) {
    let populated = JSON.stringify(template);
    
    for (const [key, value] of Object.entries(context)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      populated = populated.replace(placeholder, value);
    }
    
    return JSON.parse(populated);
  }

  async translateTemplate(template, fromLang, toLang) {
    const translated = {};
    
    for (const [key, value] of Object.entries(template)) {
      if (typeof value === 'string') {
        const translation = await this.translateText(value, fromLang, toLang);
        translated[key] = translation.translatedText;
      } else if (typeof value === 'object' && value !== null) {
        translated[key] = await this.translateTemplate(value, fromLang, toLang);
      } else {
        translated[key] = value;
      }
    }
    
    return translated;
  }

  // Data persistence methods
  async saveTranslations(language, category, translations) {
    const filePath = path.join(this.dataDir, 'translations', language, `${category}.json`);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeJSON(filePath, translations, { spaces: 2 });
  }

  async saveVoiceCommands(language, commands) {
    const filePath = path.join(this.dataDir, 'voice-commands', `${language}.json`);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeJSON(filePath, commands, { spaces: 2 });
  }

  async saveCulturalAdaptations(adaptations) {
    const filePath = path.join(this.dataDir, 'cultural-adaptations', 'adaptations.json');
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeJSON(filePath, adaptations, { spaces: 2 });
  }

  async loadLanguageData() {
    try {
      // Load existing translations, terminology, etc.
      const languageDirs = await fs.readdir(path.join(this.dataDir, 'translations')).catch(() => []);
      
      for (const langDir of languageDirs) {
        // Load language-specific data
        logger.info(`Loading language data for: ${langDir}`);
      }
    } catch (error) {
      logger.warn('No existing language data found, using defaults');
    }
  }

  /**
   * Get service statistics
   */
  getServiceStats() {
    return {
      supportedLanguages: this.supportedLanguages.size,
      terminologyEntries: Array.from(this.terminologyDatabases.values())
        .reduce((total, terms) => total + Object.keys(terms).length, 0),
      voiceCommands: Array.from(this.voiceCommands.values())
        .reduce((total, commands) => total + Object.keys(commands).length, 0),
      cacheSize: this.translationCache.size,
      culturalAdaptations: this.culturalAdaptations.size,
      status: 'active',
      version: '1.0.0'
    };
  }
}

export default MultiLanguageService;