# Susan AI Multi-Language Support - API Integration Guide

## Overview

The Susan AI Multi-Language Support system provides comprehensive internationalization capabilities for the roofing industry, starting with full Spanish support and expandable to other languages. This guide covers all API endpoints and integration patterns.

## Base URL
```
http://localhost:3003/api
```

## Supported Languages

| Language Code | Language | Native Name | Voice Support | Industry Terms |
|---------------|----------|-------------|---------------|----------------|
| `en` | English | English | ✅ | ✅ |
| `es` | Spanish | Español | ✅ | ✅ |
| `fr` | French | Français | ✅ | 🔄 |

## API Endpoints

### 1. Language Detection

#### Detect Language
```http
POST /multi-language/detect
Content-Type: application/json

{
  "text": "Hola, necesito una inspección del techo",
  "confidenceThreshold": 0.8,
  "fallbackLanguage": "en"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "language": "es",
    "confidence": 0.95,
    "isSupported": true,
    "timestamp": "2025-08-21T10:30:00Z"
  }
}
```

### 2. Text Translation

#### Translate Text
```http
POST /multi-language/translate
Content-Type: application/json

{
  "text": "The roof has extensive hail damage",
  "fromLanguage": "en",
  "toLanguage": "es",
  "industryContext": "roofing",
  "preserveFormatting": true,
  "culturalAdaptation": true,
  "useCache": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "originalText": "The roof has extensive hail damage",
    "translatedText": "El techo tiene daños extensos por granizo",
    "fromLanguage": "en",
    "toLanguage": "es",
    "confidence": 0.9,
    "timestamp": "2025-08-21T10:30:00Z",
    "metadata": {
      "industryContext": "roofing",
      "culturallyAdapted": true,
      "cacheUsed": false
    }
  }
}
```

#### Batch Translation
```http
POST /multi-language/batch-translate
Content-Type: application/json

{
  "texts": [
    "Roof inspection",
    "Damage assessment",
    "Insurance claim"
  ],
  "fromLanguage": "en",
  "toLanguage": "es",
  "options": {
    "industryContext": "roofing"
  }
}
```

#### Auto-Detect and Translate
```http
POST /multi-language/auto-detect-and-translate
Content-Type: application/json

{
  "text": "Necesito un presupuesto para reparar el techo",
  "targetLanguage": "en",
  "industryContext": "roofing",
  "culturalAdaptation": true,
  "confidenceThreshold": 0.8
}
```

### 3. Voice Commands and Processing

#### Process Voice Input (Multi-Language)
```http
POST /voice/enhanced/multi-language/process
Content-Type: multipart/form-data

audio: [audio file]
userId: "user_123"
expectedLanguage: "es"
autoDetectLanguage: true
translateResponse: true
culturalAdaptation: true
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transcription": {
      "original": "Hola Susan, necesito ayuda",
      "translated": "Hello Susan, I need help",
      "confidence": 0.92,
      "language": "es",
      "duration": 3.2
    },
    "command": {
      "command": {
        "originalCommand": "Hola Susan",
        "translatedCommand": "Hello Susan",
        "action": "voice_activation",
        "confidence": 1.0
      },
      "response": {
        "message": "¡Hola! Soy Susan, su asistente de IA para techado. ¿Cómo puedo ayudarle hoy?",
        "language": "es",
        "action": "voice_activated"
      }
    },
    "isActivation": true,
    "timestamp": "2025-08-21T10:30:00Z"
  }
}
```

#### Process Voice Command
```http
POST /voice/enhanced/multi-language/command
Content-Type: application/json

{
  "command": "iniciar inspección",
  "language": "es",
  "userId": "user_123",
  "translateResponse": true,
  "culturalAdaptation": true,
  "responseLanguage": "es"
}
```

#### Generate Voice Response
```http
POST /voice/enhanced/multi-language/synthesize
Content-Type: application/json

{
  "text": "La inspección del techo está programada para mañana",
  "language": "es",
  "voice": "nova",
  "speed": 1.0,
  "format": "mp3",
  "userId": "user_123"
}
```

#### Check Voice Activation
```http
POST /voice/enhanced/multi-language/check-activation
Content-Type: application/json

{
  "text": "Hola Susan",
  "language": "es"
}
```

### 4. Voice Commands by Language

#### Get Voice Commands
```http
GET /multi-language/voice-commands/es
```

**Response:**
```json
{
  "success": true,
  "data": {
    "language": "es",
    "commands": {
      "hola susan": "voice_activation",
      "iniciar inspección": "start_inspection",
      "crear informe": "create_report",
      "programar cita": "schedule_appointment",
      "verificar estado del reclamo": "check_claim_status",
      "subir fotos": "upload_photos",
      "generar presupuesto": "generate_estimate"
    },
    "count": 7
  }
}
```

### 5. Document Translation

#### Translate Document
```http
POST /multi-language/translate-document
Content-Type: multipart/form-data

document: [file upload]
fromLanguage: "en"
toLanguage: "es"
documentType: "insurance_report"
preserveStructure: true
```

**Or with text content:**
```http
POST /multi-language/translate-document
Content-Type: application/json

{
  "documentContent": "ROOF INSPECTION REPORT\n\nProperty Address: 123 Main St\nInspection Date: 08/21/2025\n\nDamage Assessment:\n- Hail damage to shingles\n- Missing flashing\n- Gutter damage",
  "fromLanguage": "en",
  "toLanguage": "es",
  "documentType": "inspection_report",
  "preserveStructure": true
}
```

### 6. Localized Templates

#### Get Template
```http
GET /multi-language/templates/claim_submission/es?claimNumber=CLM-2025-001&adjusterName=Juan%20García&propertyAddress=123%20Main%20St
```

**Response:**
```json
{
  "success": true,
  "data": {
    "template": {
      "subject": "Presentación de Reclamo por Daños al Techo - CLM-2025-001",
      "greeting": "Estimado Juan García,",
      "body": "Me comunico para presentar un reclamo por daños al techo en la propiedad ubicada en 123 Main St...",
      "closing": "Atentamente,\n{{contractorName}}\n{{companyName}}"
    },
    "language": "es",
    "templateType": "claim_submission",
    "context": {
      "claimNumber": "CLM-2025-001",
      "adjusterName": "Juan García",
      "propertyAddress": "123 Main St"
    },
    "timestamp": "2025-08-21T10:30:00Z"
  }
}
```

### 7. User Language Preferences

#### Update User Language
```http
PUT /multi-language/user-preferences/user_123
Content-Type: application/json

{
  "language": "es"
}
```

#### Get User Preferences
```http
GET /multi-language/user-preferences/user_123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "language": "es",
    "voiceLanguage": "es",
    "culturalAdaptation": true,
    "formalityLevel": "professional",
    "supportedLanguages": [
      {
        "code": "en",
        "name": "English",
        "nativeName": "English",
        "isDefault": true
      },
      {
        "code": "es",
        "name": "Spanish",
        "nativeName": "Español",
        "isDefault": false
      }
    ]
  }
}
```

#### Set Voice Language Preferences
```http
PUT /voice/enhanced/multi-language/user-preferences/user_123
Content-Type: application/json

{
  "language": "es",
  "voiceSettings": {
    "preferredVoice": "nova",
    "speed": 1.0,
    "culturalAdaptation": true
  }
}
```

### 8. Industry Terminology

#### Get Terminology
```http
GET /multi-language/terminology/es?category=roofing
```

**Response:**
```json
{
  "success": true,
  "data": {
    "language": "es",
    "category": "roofing",
    "terminology": {
      "roof": "techo",
      "shingles": "tejas",
      "hail damage": "daño por granizo",
      "wind damage": "daño por viento",
      "estimate": "presupuesto",
      "inspection": "inspección",
      "adjuster": "ajustador",
      "claim": "reclamo"
    },
    "count": 8
  }
}
```

#### Update Terminology
```http
PUT /multi-language/terminology/es
Content-Type: application/json

{
  "terms": {
    "ridge vent": "ventilación de caballete",
    "ice dam": "represa de hielo",
    "membrane": "membrana"
  }
}
```

### 9. Cultural Adaptations

#### Get Cultural Settings
```http
GET /multi-language/cultural-adaptations/es
```

**Response:**
```json
{
  "success": true,
  "data": {
    "language": "es",
    "adaptation": {
      "greeting": "warm",
      "formality": "high",
      "directness": "moderate",
      "timeContext": "polychronic",
      "personalSpace": "close",
      "decisionMaking": "relationship-based",
      "communicationStyle": "high-context"
    }
  }
}
```

### 10. System Information

#### Get Supported Languages
```http
GET /multi-language/supported-languages
```

**Response:**
```json
{
  "success": true,
  "data": {
    "languages": [
      {
        "code": "en",
        "name": "English",
        "nativeName": "English",
        "isDefault": true,
        "voiceModel": "en-US",
        "culturalContext": "direct",
        "formality": "professional"
      },
      {
        "code": "es",
        "name": "Spanish",
        "nativeName": "Español",
        "isDefault": false,
        "voiceModel": "es-ES",
        "culturalContext": "respectful",
        "formality": "formal"
      }
    ],
    "defaultLanguage": "en",
    "count": 2
  }
}
```

#### Get Service Statistics
```http
GET /multi-language/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "supportedLanguages": 2,
    "terminologyEntries": 156,
    "voiceCommands": 26,
    "cacheSize": 234,
    "culturalAdaptations": 2,
    "status": "active",
    "version": "1.0.0"
  }
}
```

#### Get Voice Service Status
```http
GET /voice/enhanced/multi-language/status
```

## Integration Examples

### JavaScript/Frontend Integration

```javascript
// Language detection and translation
async function detectAndTranslate(text, targetLanguage = 'es') {
  try {
    const response = await fetch('/api/multi-language/auto-detect-and-translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        targetLanguage,
        industryContext: 'roofing',
        culturalAdaptation: true
      })
    });
    
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Translation failed:', error);
  }
}

// Voice command processing
async function processVoiceCommand(audioBlob, userId, language = 'auto') {
  const formData = new FormData();
  formData.append('audio', audioBlob);
  formData.append('userId', userId);
  formData.append('expectedLanguage', language);
  formData.append('autoDetectLanguage', 'true');
  formData.append('translateResponse', 'true');
  
  try {
    const response = await fetch('/api/voice/enhanced/multi-language/process', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Voice processing failed:', error);
  }
}

// Get localized template
async function getLocalizedTemplate(templateType, language, context) {
  const params = new URLSearchParams(context);
  
  try {
    const response = await fetch(
      `/api/multi-language/templates/${templateType}/${language}?${params}`
    );
    
    const result = await response.json();
    return result.data.template;
  } catch (error) {
    console.error('Template fetch failed:', error);
  }
}

// Switch UI language
async function switchLanguage(userId, language) {
  try {
    const response = await fetch(`/api/multi-language/user-preferences/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ language })
    });
    
    const result = await response.json();
    
    // Update UI with new language
    await updateUILanguage(language);
    
    return result.data;
  } catch (error) {
    console.error('Language switch failed:', error);
  }
}

// Update UI elements with translated text
async function updateUILanguage(language) {
  try {
    const response = await fetch(`/api/multi-language/terminology/${language}`);
    const uiResponse = await fetch(`/data/languages/translations/${language}/ui.json`);
    
    const terminology = await response.json();
    const uiTranslations = await uiResponse.json();
    
    // Update UI elements
    document.querySelectorAll('[data-translate]').forEach(element => {
      const key = element.getAttribute('data-translate');
      const translation = getNestedValue(uiTranslations.data.terminology, key);
      if (translation) {
        element.textContent = translation;
      }
    });
  } catch (error) {
    console.error('UI update failed:', error);
  }
}

// Utility function to get nested object values
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current && current[key], obj);
}
```

### React Component Example

```jsx
import React, { useState, useEffect } from 'react';

const MultiLanguageVoiceInterface = () => {
  const [language, setLanguage] = useState('en');
  const [isListening, setIsListening] = useState(false);
  const [response, setResponse] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState(null);

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        await processVoiceInput(audioBlob);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsListening(true);
    } catch (error) {
      console.error('Voice recording failed:', error);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsListening(false);
    }
  };

  const processVoiceInput = async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    formData.append('userId', 'user_123');
    formData.append('expectedLanguage', language);
    formData.append('autoDetectLanguage', 'true');

    try {
      const response = await fetch('/api/voice/enhanced/multi-language/process', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.success && result.data.command) {
        setResponse(result.data.command.response.message);
        
        // Generate voice response
        await generateVoiceResponse(result.data.command.response.message, language);
      }
    } catch (error) {
      console.error('Voice processing failed:', error);
    }
  };

  const generateVoiceResponse = async (text, lang) => {
    try {
      const response = await fetch('/api/voice/enhanced/multi-language/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          language: lang,
          voice: lang === 'es' ? 'nova' : 'alloy',
          format: 'mp3'
        })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audio = new Audio(URL.createObjectURL(audioBlob));
        audio.play();
      }
    } catch (error) {
      console.error('Voice synthesis failed:', error);
    }
  };

  const switchLanguage = async (newLanguage) => {
    setLanguage(newLanguage);
    
    try {
      await fetch('/api/multi-language/user-preferences/user_123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ language: newLanguage })
      });
    } catch (error) {
      console.error('Language switch failed:', error);
    }
  };

  return (
    <div className="voice-interface">
      <div className="language-selector">
        <button 
          onClick={() => switchLanguage('en')}
          className={language === 'en' ? 'active' : ''}
        >
          English
        </button>
        <button 
          onClick={() => switchLanguage('es')}
          className={language === 'es' ? 'active' : ''}
        >
          Español
        </button>
      </div>

      <div className="voice-controls">
        <button
          onMouseDown={startVoiceRecording}
          onMouseUp={stopVoiceRecording}
          onTouchStart={startVoiceRecording}
          onTouchEnd={stopVoiceRecording}
          className={`voice-button ${isListening ? 'listening' : ''}`}
        >
          {isListening 
            ? (language === 'es' ? 'Escuchando...' : 'Listening...') 
            : (language === 'es' ? 'Mantener para hablar' : 'Hold to speak')
          }
        </button>
      </div>

      {response && (
        <div className="response">
          <p>{response}</p>
        </div>
      )}
    </div>
  );
};

export default MultiLanguageVoiceInterface;
```

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": {
    "code": "TRANSLATION_FAILED",
    "message": "Translation service unavailable",
    "details": "Google Translate API quota exceeded"
  },
  "timestamp": "2025-08-21T10:30:00Z"
}
```

Common error codes:
- `LANGUAGE_NOT_SUPPORTED`
- `TRANSLATION_FAILED`
- `VOICE_PROCESSING_FAILED`
- `INVALID_AUDIO_FORMAT`
- `TEMPLATE_NOT_FOUND`
- `USER_NOT_FOUND`

## Rate Limiting

- Text translation: 100 requests/minute
- Voice processing: 20 requests/minute
- Batch operations: 10 requests/minute
- User preferences: 50 requests/minute

## Environment Variables

```bash
# Google Translate API (optional)
GOOGLE_TRANSLATE_API_KEY=your_api_key_here

# OpenAI API for voice (required)
OPENAI_API_KEY=your_openai_key_here

# Language service settings
DEFAULT_LANGUAGE=en
ENABLE_CULTURAL_ADAPTATION=true
CACHE_TRANSLATIONS=true
MAX_TRANSLATION_CACHE_SIZE=1000
```

## Testing

### Test Voice Activation in Spanish
```bash
curl -X POST http://localhost:3003/api/voice/enhanced/multi-language/check-activation \
  -H "Content-Type: application/json" \
  -d '{"text": "Hola Susan", "language": "es"}'
```

### Test Translation
```bash
curl -X POST http://localhost:3003/api/multi-language/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The roof needs immediate repair",
    "fromLanguage": "en",
    "toLanguage": "es",
    "industryContext": "roofing"
  }'
```

### Test Template Retrieval
```bash
curl -X GET "http://localhost:3003/api/multi-language/templates/claim_submission/es?claimNumber=TEST-001&adjusterName=Test%20Adjuster"
```

## Next Steps

1. **Add More Languages**: Expand support to French, German, Portuguese
2. **Enhanced Voice Models**: Train custom voice models for industry terminology
3. **Regional Dialects**: Support for Mexican Spanish, Argentine Spanish, etc.
4. **AI-Powered Cultural Insights**: Machine learning for cultural communication patterns
5. **Mobile SDK**: Native mobile integration for iOS and Android

This comprehensive multi-language system ensures that Susan AI can effectively serve Spanish-speaking customers and contractors in the roofing industry while maintaining the same level of functionality and intelligence as the English version.