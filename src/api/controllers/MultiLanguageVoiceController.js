import { VoiceService } from '../services/VoiceService.js';
import { MultiLanguageService } from '../services/MultiLanguageService.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

/**
 * Multi-Language Voice Controller
 * Handles voice commands and responses in multiple languages
 * Integrates with existing VoiceService and new MultiLanguageService
 */
export class MultiLanguageVoiceController {
  constructor() {
    this.voiceService = new VoiceService();
    this.multiLanguageService = new MultiLanguageService();
    this.activeLanguage = 'en';
    this.userLanguagePreferences = new Map();
    this.voiceProfiles = new Map();
    this.initializeSpanishSupport();
  }

  async initializeSpanishSupport() {
    try {
      // Initialize Spanish voice commands and responses
      this.spanishActivationPhrases = [
        'hola susan',
        'oye susan',
        'susan',
        'susan ayuda',
        'susan asistencia'
      ];

      this.englishActivationPhrases = [
        'hello susan',
        'hey susan',
        'susan',
        'susan help',
        'susan assistance'
      ];

      logger.info('Multi-language voice support initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Spanish voice support:', error);
    }
  }

  /**
   * Process voice input with automatic language detection
   */
  async processVoiceInput(audioFile, options = {}) {
    try {
      const {
        userId,
        expectedLanguage,
        autoDetectLanguage = true,
        translateResponse = true,
        culturalAdaptation = true
      } = options;

      // Get user's language preference
      let userLanguage = expectedLanguage;
      if (userId && !userLanguage) {
        const preferences = await this.multiLanguageService.getUserLanguagePreferences(userId);
        userLanguage = preferences.language || 'en';
      }

      // Transcribe audio with language-specific settings
      const transcriptionOptions = {
        language: autoDetectLanguage ? 'auto' : userLanguage,
        model: 'whisper-1',
        response_format: 'verbose_json',
        userId,
        ...options
      };

      const transcriptionResult = await this.voiceService.transcribeAudio(audioFile, transcriptionOptions);
      
      let detectedLanguage = userLanguage;
      let translatedCommand = transcriptionResult.text;

      // Detect language if auto-detection is enabled
      if (autoDetectLanguage) {
        const detection = await this.multiLanguageService.detectLanguage(
          transcriptionResult.text,
          { confidenceThreshold: 0.7 }
        );
        detectedLanguage = detection.language;
      }

      // Check if this is a voice activation phrase
      const isActivationPhrase = await this.checkActivationPhrase(transcriptionResult.text, detectedLanguage);

      // Process voice command
      let commandResult = null;
      if (isActivationPhrase || this.isVoiceCommand(transcriptionResult.text, detectedLanguage)) {
        commandResult = await this.processVoiceCommand(transcriptionResult.text, detectedLanguage, {
          userId,
          translateResponse,
          culturalAdaptation
        });
      }

      // Translate command to English if needed for processing
      if (detectedLanguage !== 'en') {
        const translation = await this.multiLanguageService.translateVoiceCommand(
          transcriptionResult.text,
          detectedLanguage,
          'en'
        );
        translatedCommand = translation.translatedCommand;
      }

      const result = {
        transcription: {
          original: transcriptionResult.text,
          translated: translatedCommand,
          confidence: transcriptionResult.confidence || 0.9,
          language: detectedLanguage,
          duration: transcriptionResult.duration
        },
        command: commandResult,
        isActivation: isActivationPhrase,
        timestamp: new Date().toISOString(),
        userId
      };

      this.emitVoiceEvent('voiceInputProcessed', result);
      logger.info('Voice input processed successfully:', {
        language: detectedLanguage,
        isCommand: !!commandResult,
        isActivation: isActivationPhrase
      });

      return result;
    } catch (error) {
      logger.error('Voice input processing failed:', error);
      throw new ApiError(500, 'Voice input processing failed');
    }
  }

  /**
   * Process voice command with multi-language support
   */
  async processVoiceCommand(command, language, options = {}) {
    try {
      const {
        userId,
        translateResponse = true,
        culturalAdaptation = true,
        responseLanguage
      } = options;

      // Get command translation and action
      const commandTranslation = await this.multiLanguageService.translateVoiceCommand(
        command,
        language,
        'en'
      );

      // Process the command action
      let response = await this.executeVoiceCommand(commandTranslation.action, {
        originalCommand: command,
        language,
        userId
      });

      // Determine response language
      const targetLanguage = responseLanguage || language || 'en';

      // Translate response if needed
      if (translateResponse && targetLanguage !== 'en') {
        const translatedResponse = await this.multiLanguageService.translateText(
          response.message,
          'en',
          targetLanguage,
          {
            industryContext: 'roofing',
            culturalAdaptation
          }
        );

        response.message = translatedResponse.translatedText;
        response.language = targetLanguage;
      }

      // Apply cultural adaptation
      if (culturalAdaptation && targetLanguage !== 'en') {
        response.message = await this.multiLanguageService.applyCulturalAdaptation(
          response.message,
          targetLanguage
        );
      }

      return {
        command: commandTranslation,
        response,
        action: commandTranslation.action,
        language: targetLanguage,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Voice command processing failed:', error);
      throw error;
    }
  }

  /**
   * Check if text contains voice activation phrase
   */
  async checkActivationPhrase(text, language = 'en') {
    try {
      const normalizedText = text.toLowerCase().trim();
      
      let activationPhrases;
      if (language === 'es') {
        activationPhrases = this.spanishActivationPhrases;
      } else {
        activationPhrases = this.englishActivationPhrases;
      }

      // Check exact matches
      for (const phrase of activationPhrases) {
        if (normalizedText.includes(phrase)) {
          return true;
        }
      }

      // Check fuzzy matches for voice recognition errors
      for (const phrase of activationPhrases) {
        const similarity = this.calculateSimilarity(normalizedText, phrase);
        if (similarity > 0.8) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Activation phrase check failed:', error);
      return false;
    }
  }

  /**
   * Check if text is a voice command
   */
  isVoiceCommand(text, language = 'en') {
    try {
      const commands = this.multiLanguageService.voiceCommands.get(language);
      if (!commands) return false;

      const normalizedText = text.toLowerCase().trim();
      return Object.keys(commands).some(cmd => 
        normalizedText.includes(cmd) || this.calculateSimilarity(normalizedText, cmd) > 0.7
      );
    } catch (error) {
      logger.error('Voice command check failed:', error);
      return false;
    }
  }

  /**
   * Execute voice command actions
   */
  async executeVoiceCommand(action, context = {}) {
    try {
      const { originalCommand, language, userId } = context;

      switch (action) {
        case 'voice_activation':
          return await this.handleVoiceActivation(language, userId);

        case 'start_inspection':
          return await this.handleStartInspection(language, userId);

        case 'create_report':
          return await this.handleCreateReport(language, userId);

        case 'schedule_appointment':
          return await this.handleScheduleAppointment(language, userId);

        case 'check_claim_status':
          return await this.handleCheckClaimStatus(language, userId);

        case 'upload_photos':
          return await this.handleUploadPhotos(language, userId);

        case 'generate_estimate':
          return await this.handleGenerateEstimate(language, userId);

        case 'call_adjuster':
          return await this.handleCallAdjuster(language, userId);

        case 'review_documents':
          return await this.handleReviewDocuments(language, userId);

        case 'save_progress':
          return await this.handleSaveProgress(language, userId);

        case 'navigate_dashboard':
          return await this.handleNavigateDashboard(language, userId);

        case 'show_help':
          return await this.handleShowHelp(language, userId);

        case 'show_capabilities':
          return await this.handleShowCapabilities(language, userId);

        case 'end_session':
          return await this.handleEndSession(language, userId);

        case 'acknowledge':
          return await this.handleAcknowledge(language, userId);

        default:
          return {
            success: false,
            message: 'Command not recognized',
            action: 'unknown'
          };
      }
    } catch (error) {
      logger.error('Voice command execution failed:', error);
      return {
        success: false,
        message: 'Command execution failed',
        error: error.message
      };
    }
  }

  // Voice command handlers
  async handleVoiceActivation(language, userId) {
    const responses = {
      'en': 'Hello! I\'m Susan, your AI roofing assistant. How can I help you today?',
      'es': '¡Hola! Soy Susan, su asistente de techado con IA. ¿Cómo puedo ayudarle hoy?'
    };

    return {
      success: true,
      message: responses[language] || responses['en'],
      action: 'voice_activated',
      nextSteps: ['Ask me about inspections', 'Upload photos', 'Check claim status']
    };
  }

  async handleStartInspection(language, userId) {
    const responses = {
      'en': 'Starting roof inspection mode. Please provide the property address or upload photos to begin.',
      'es': 'Iniciando modo de inspección de techo. Por favor, proporcione la dirección de la propiedad o suba fotos para comenzar.'
    };

    return {
      success: true,
      message: responses[language] || responses['en'],
      action: 'inspection_started',
      ui_action: 'open_inspection_form'
    };
  }

  async handleCreateReport(language, userId) {
    const responses = {
      'en': 'Creating a new roofing report. I\'ll guide you through the process.',
      'es': 'Creando un nuevo informe de techado. Le guiaré a través del proceso.'
    };

    return {
      success: true,
      message: responses[language] || responses['en'],
      action: 'report_creation_started',
      ui_action: 'open_report_wizard'
    };
  }

  async handleScheduleAppointment(language, userId) {
    const responses = {
      'en': 'I\'ll help you schedule an appointment. What type of service do you need?',
      'es': 'Le ayudaré a programar una cita. ¿Qué tipo de servicio necesita?'
    };

    return {
      success: true,
      message: responses[language] || responses['en'],
      action: 'appointment_scheduling',
      ui_action: 'open_calendar'
    };
  }

  async handleCheckClaimStatus(language, userId) {
    const responses = {
      'en': 'Let me check your claim status. Please provide your claim number.',
      'es': 'Permíteme verificar el estado de su reclamo. Por favor, proporcione su número de reclamo.'
    };

    return {
      success: true,
      message: responses[language] || responses['en'],
      action: 'claim_status_check',
      ui_action: 'open_claim_lookup'
    };
  }

  async handleUploadPhotos(language, userId) {
    const responses = {
      'en': 'Ready to analyze roof photos. Please upload images of the damage.',
      'es': 'Listo para analizar fotos del techo. Por favor, suba imágenes del daño.'
    };

    return {
      success: true,
      message: responses[language] || responses['en'],
      action: 'photo_upload_ready',
      ui_action: 'open_photo_uploader'
    };
  }

  async handleGenerateEstimate(language, userId) {
    const responses = {
      'en': 'Generating cost estimate based on available data. This may take a moment.',
      'es': 'Generando estimación de costos basada en datos disponibles. Esto puede tomar un momento.'
    };

    return {
      success: true,
      message: responses[language] || responses['en'],
      action: 'estimate_generation',
      ui_action: 'start_estimate_process'
    };
  }

  async handleCallAdjuster(language, userId) {
    const responses = {
      'en': 'Looking up adjuster contact information for your claim.',
      'es': 'Buscando información de contacto del ajustador para su reclamo.'
    };

    return {
      success: true,
      message: responses[language] || responses['en'],
      action: 'adjuster_contact',
      ui_action: 'show_adjuster_info'
    };
  }

  async handleReviewDocuments(language, userId) {
    const responses = {
      'en': 'Opening document review interface. You can view and edit all project documents.',
      'es': 'Abriendo interfaz de revisión de documentos. Puede ver y editar todos los documentos del proyecto.'
    };

    return {
      success: true,
      message: responses[language] || responses['en'],
      action: 'document_review',
      ui_action: 'open_document_manager'
    };
  }

  async handleSaveProgress(language, userId) {
    const responses = {
      'en': 'Progress saved successfully. All your work has been backed up.',
      'es': 'Progreso guardado exitosamente. Todo su trabajo ha sido respaldado.'
    };

    return {
      success: true,
      message: responses[language] || responses['en'],
      action: 'progress_saved',
      ui_action: 'show_save_confirmation'
    };
  }

  async handleNavigateDashboard(language, userId) {
    const responses = {
      'en': 'Taking you to the main dashboard.',
      'es': 'Llevándole al panel principal.'
    };

    return {
      success: true,
      message: responses[language] || responses['en'],
      action: 'navigate_dashboard',
      ui_action: 'navigate_to_dashboard'
    };
  }

  async handleShowHelp(language, userId) {
    const responses = {
      'en': 'I can help with roof inspections, damage analysis, insurance claims, and more. What do you need help with?',
      'es': 'Puedo ayudar con inspecciones de techos, análisis de daños, reclamos de seguros y más. ¿Con qué necesita ayuda?'
    };

    return {
      success: true,
      message: responses[language] || responses['en'],
      action: 'help_displayed',
      ui_action: 'show_help_panel'
    };
  }

  async handleShowCapabilities(language, userId) {
    const capabilities = {
      'en': [
        'Roof damage analysis and assessment',
        'Insurance claim processing and documentation',
        'Cost estimation and material calculations',
        'Building code compliance checking',
        'Weather impact analysis',
        'Photo analysis and damage detection',
        'Report generation and documentation'
      ],
      'es': [
        'Análisis y evaluación de daños del techo',
        'Procesamiento y documentación de reclamos de seguros',
        'Estimación de costos y cálculos de materiales',
        'Verificación de cumplimiento del código de construcción',
        'Análisis de impacto climático',
        'Análisis de fotos y detección de daños',
        'Generación de informes y documentación'
      ]
    };

    const intro = {
      'en': 'Here are my main capabilities:',
      'es': 'Aquí están mis principales capacidades:'
    };

    return {
      success: true,
      message: intro[language] || intro['en'],
      capabilities: capabilities[language] || capabilities['en'],
      action: 'capabilities_displayed',
      ui_action: 'show_capabilities_panel'
    };
  }

  async handleEndSession(language, userId) {
    const responses = {
      'en': 'Thank you for using Susan AI. Have a great day!',
      'es': '¡Gracias por usar Susan AI. ¡Que tenga un excelente día!'
    };

    return {
      success: true,
      message: responses[language] || responses['en'],
      action: 'session_ended',
      ui_action: 'end_session'
    };
  }

  async handleAcknowledge(language, userId) {
    const responses = {
      'en': 'You\'re welcome! Is there anything else I can help you with?',
      'es': '¡De nada! ¿Hay algo más en lo que pueda ayudarle?'
    };

    return {
      success: true,
      message: responses[language] || responses['en'],
      action: 'acknowledged'
    };
  }

  /**
   * Generate voice response audio
   */
  async generateVoiceResponse(text, language = 'en', options = {}) {
    try {
      const {
        voice = 'alloy',
        speed = 1.0,
        format = 'mp3',
        userId
      } = options;

      // Use appropriate voice for language
      let selectedVoice = voice;
      if (language === 'es') {
        selectedVoice = 'nova'; // Better for Spanish pronunciation
      }

      const audioResult = await this.voiceService.generateSpeech(text, {
        voice: selectedVoice,
        speed,
        format,
        language
      });

      return {
        audio: audioResult.audio,
        text,
        language,
        voice: selectedVoice,
        duration: audioResult.duration,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Voice response generation failed:', error);
      throw new ApiError(500, 'Voice response generation failed');
    }
  }

  /**
   * Set user language preference
   */
  async setUserLanguagePreference(userId, language, voiceSettings = {}) {
    try {
      this.userLanguagePreferences.set(userId, {
        language,
        voiceSettings,
        updatedAt: new Date().toISOString()
      });

      await this.multiLanguageService.switchUILanguage(userId, language);

      return {
        userId,
        language,
        voiceSettings,
        success: true
      };
    } catch (error) {
      logger.error('Failed to set user language preference:', error);
      throw error;
    }
  }

  // Utility methods
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

  emitVoiceEvent(eventName, data) {
    try {
      this.voiceService.emit(eventName, data);
      this.multiLanguageService.emit(eventName, data);
    } catch (error) {
      logger.error('Failed to emit voice event:', error);
    }
  }

  /**
   * Get service status and statistics
   */
  getServiceStatus() {
    return {
      voiceService: this.voiceService ? 'active' : 'inactive',
      multiLanguageService: this.multiLanguageService ? 'active' : 'inactive',
      supportedLanguages: Array.from(this.multiLanguageService.supportedLanguages.keys()),
      activeUsers: this.userLanguagePreferences.size,
      spanishSupport: true,
      voiceActivation: true,
      status: 'operational'
    };
  }
}

export default MultiLanguageVoiceController;