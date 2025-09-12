import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { AIService } from '../services/AIService.js';

export class VoiceController {
    constructor() {
        this.openaiApiKey = process.env.OPENAI_API_KEY;
        this.aiService = new AIService();
        
        if (!this.openaiApiKey) {
            logger.warn('OpenAI API key not found. Voice features will be limited.');
        }
    }

    async transcribeAudio(req, res) {
        try {
            if (!req.file) {
                throw new ApiError(400, 'No audio file provided');
            }

            if (!this.openaiApiKey) {
                throw new ApiError(503, 'OpenAI API key not configured');
            }

            // Create a temporary file buffer for OpenAI
            const audioBuffer = req.file.buffer;
            const fileName = `audio_${Date.now()}.${req.file.originalname?.split('.').pop() || 'webm'}`;
            
            // Create FormData for OpenAI API
            const formData = new FormData();
            const audioBlob = new Blob([audioBuffer], { type: req.file.mimetype });
            formData.append('file', audioBlob, fileName);
            formData.append('model', 'whisper-1');
            formData.append('language', 'en'); // Specify English for better accuracy
            formData.append('response_format', 'verbose_json'); // Get more details

            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.text();
                logger.error('OpenAI Whisper transcription error:', error);
                throw new ApiError(response.status, 'Whisper transcription failed');
            }

            const result = await response.json();
            
            logger.info('Audio transcribed successfully with Whisper', {
                text: result.text?.substring(0, 50) + '...',
                duration: result.duration,
                language: result.language
            });

            res.json({
                success: true,
                text: result.text,
                duration: result.duration || (req.file.size / (16000 * 2)),
                language: result.language,
                segments: result.segments || [],
                confidence: 0.95 // Whisper is generally very accurate
            });

        } catch (error) {
            logger.error('Whisper transcription error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(500, 'Whisper transcription failed');
        }
    }

    async synthesizeSpeech(req, res) {
        try {
            const { text, voice = 'alloy', speed = 1.0, format = 'mp3' } = req.body;

            if (!this.openaiApiKey) {
                throw new ApiError(503, 'OpenAI API key not configured');
            }

            const response = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'tts-1',
                    input: text,
                    voice: voice,
                    response_format: format,
                    speed: speed
                })
            });

            if (!response.ok) {
                const error = await response.text();
                logger.error('OpenAI TTS error:', error);
                throw new ApiError(response.status, 'Speech synthesis failed');
            }

            const audioBuffer = await response.arrayBuffer();
            
            res.set({
                'Content-Type': `audio/${format}`,
                'Content-Length': audioBuffer.byteLength,
                'Cache-Control': 'private, max-age=3600'
            });

            logger.info('Speech synthesized successfully');
            res.send(Buffer.from(audioBuffer));

        } catch (error) {
            logger.error('Speech synthesis error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(500, 'Speech synthesis failed');
        }
    }

    async getAvailableVoices(req, res) {
        try {
            const voices = [
                { id: 'alloy', name: 'Alloy', gender: 'neutral', description: 'Balanced and clear' },
                { id: 'echo', name: 'Echo', gender: 'male', description: 'Warm and friendly' },
                { id: 'fable', name: 'Fable', gender: 'neutral', description: 'Expressive and engaging' },
                { id: 'onyx', name: 'Onyx', gender: 'male', description: 'Deep and authoritative' },
                { id: 'nova', name: 'Nova', gender: 'female', description: 'Bright and energetic' },
                { id: 'shimmer', name: 'Shimmer', gender: 'female', description: 'Soft and gentle' }
            ];

            res.json({
                success: true,
                voices: voices,
                default: 'alloy'
            });

        } catch (error) {
            logger.error('Get voices error:', error);
            throw new ApiError(500, 'Failed to get available voices');
        }
    }

    async voiceConversation(req, res) {
        try {
            if (!req.file) {
                throw new ApiError(400, 'No audio file provided');
            }

            // Step 1: Transcribe the audio
            const transcriptionData = await this.transcribeAudioInternal(req.file);
            const userText = transcriptionData.text;

            if (!userText || userText.trim().length === 0) {
                throw new ApiError(400, 'No speech detected in audio');
            }

            // Step 2: Process the text with AI (placeholder - integrate with your AI service)
            const aiResponse = await this.processWithAI(userText);

            // Step 3: Convert AI response to speech
            const audioResponse = await this.synthesizeSpeechInternal(aiResponse.text);

            // Return both text and audio
            res.json({
                success: true,
                conversation: {
                    userInput: {
                        text: userText,
                        duration: transcriptionData.duration
                    },
                    aiResponse: {
                        text: aiResponse.text,
                        audioUrl: `/api/voice/temp-audio/${Date.now()}.mp3`, // Temporary URL
                        voice: 'alloy'
                    }
                }
            });

        } catch (error) {
            logger.error('Voice conversation error:', error);
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(500, 'Voice conversation failed');
        }
    }

    // Internal helper methods
    async transcribeAudioInternal(file) {
        const fileName = `audio_${Date.now()}.${file.originalname?.split('.').pop() || 'webm'}`;
        
        const formData = new FormData();
        const audioBlob = new Blob([file.buffer], { type: file.mimetype });
        formData.append('file', audioBlob, fileName);
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');
        formData.append('response_format', 'verbose_json');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openaiApiKey}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('Whisper internal transcription error:', errorText);
            throw new Error('Whisper transcription failed');
        }

        const result = await response.json();
        return {
            text: result.text,
            duration: result.duration || (file.size / (16000 * 2)),
            language: result.language,
            confidence: 0.95
        };
    }

    async synthesizeSpeechInternal(text, voice = 'alloy') {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: text,
                voice: voice,
                response_format: 'mp3'
            })
        });

        if (!response.ok) {
            throw new Error('Speech synthesis failed');
        }

        return await response.arrayBuffer();
    }

    async processWithAI(text) {
        try {
            const systemPrompt = `You are Susan, a helpful AI assistant with a friendly and conversational voice. 
            You're speaking to someone through voice interaction, so keep your responses natural and conversational.
            Be concise but helpful, and speak as if you're having a real conversation.`;

            const response = await this.aiService.generateResponse(text, {
                systemPrompt,
                model: process.env.DEFAULT_MODEL || 'claude-3-sonnet',
                temperature: 0.7,
                maxTokens: 150 // Keep voice responses shorter
            });
            
            return {
                text: response.content,
                confidence: 0.95,
                model: response.model,
                usage: response.usage
            };
        } catch (error) {
            logger.error('AI processing error:', error);
            return {
                text: "I'm sorry, I'm having trouble processing that right now. Could you try again?",
                confidence: 0.8
            };
        }
    }
}