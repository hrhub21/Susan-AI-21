import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { streamingService } from './StreamingService.js';

export class EnhancedVoiceService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        this.processingQueue = new Map();
        this.voiceProfiles = new Map();
        this.batchJobs = new Map();
        
        // Voice synthesis options
        this.voices = {
            'alloy': { gender: 'neutral', style: 'balanced' },
            'echo': { gender: 'male', style: 'warm' },
            'fable': { gender: 'neutral', style: 'expressive' },
            'onyx': { gender: 'male', style: 'deep' },
            'nova': { gender: 'female', style: 'bright' },
            'shimmer': { gender: 'female', style: 'gentle' }
        };
    }

    /**
     * Enhanced audio transcription with streaming support
     */
    async transcribeAudio(audioBuffer, options = {}) {
        const jobId = uuidv4();
        
        try {
            const {
                language = 'en',
                model = 'whisper-1',
                responseFormat = 'verbose_json',
                streamId = null,
                includeTimestamps = true,
                speakerDetection = false
            } = options;

            // Update stream if provided
            if (streamId) {
                streamingService.sendSSEMessage(streamId, 'transcription_start', {
                    jobId,
                    audioSize: audioBuffer.length,
                    model
                });
            }

            // Create temporary file
            const tempFileName = `audio_${jobId}.webm`;
            const tempFilePath = path.join('/tmp', tempFileName);
            
            await fs.writeFile(tempFilePath, audioBuffer);

            // Prepare form data
            const formData = new FormData();
            const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
            formData.append('file', audioBlob, tempFileName);
            formData.append('model', model);
            formData.append('language', language);
            formData.append('response_format', responseFormat);
            
            if (includeTimestamps) {
                formData.append('timestamp_granularities[]', 'word');
                formData.append('timestamp_granularities[]', 'segment');
            }

            // Send to OpenAI
            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.text();
                throw new ApiError(response.status, `Transcription failed: ${error}`);
            }

            const result = await response.json();

            // Enhanced response processing
            const enhancedResult = {
                id: jobId,
                text: result.text,
                language: result.language,
                duration: result.duration,
                segments: result.segments || [],
                words: result.words || [],
                confidence: this.calculateConfidence(result),
                metadata: {
                    model,
                    audioSize: audioBuffer.length,
                    processingTime: Date.now(),
                    speakerCount: speakerDetection ? await this.detectSpeakers(result) : null
                }
            };

            // Speaker detection if requested
            if (speakerDetection && result.segments) {
                enhancedResult.speakers = await this.performSpeakerDiarization(result.segments);
            }

            // Update stream
            if (streamId) {
                streamingService.sendSSEMessage(streamId, 'transcription_complete', enhancedResult);
            }

            // Cleanup temp file
            await fs.unlink(tempFilePath).catch(() => {});

            logger.info('Audio transcription completed', {
                jobId,
                textLength: result.text?.length,
                duration: result.duration,
                language: result.language
            });

            return enhancedResult;

        } catch (error) {
            logger.error('Transcription error', { jobId, error: error.message });
            
            if (options.streamId) {
                streamingService.sendSSEMessage(options.streamId, 'transcription_error', {
                    jobId,
                    error: error.message
                });
            }
            
            throw error;
        }
    }

    /**
     * Batch audio processing
     */
    async processBatch(audioFiles, options = {}) {
        const batchId = uuidv4();
        const jobs = [];

        try {
            this.batchJobs.set(batchId, {
                id: batchId,
                status: 'processing',
                totalFiles: audioFiles.length,
                completed: 0,
                failed: 0,
                results: [],
                startTime: Date.now()
            });

            // Update stream if provided
            if (options.streamId) {
                streamingService.sendSSEMessage(options.streamId, 'batch_start', {
                    batchId,
                    totalFiles: audioFiles.length
                });
            }

            // Process files concurrently (with limit)
            const concurrencyLimit = options.concurrency || 3;
            const chunks = this.chunkArray(audioFiles, concurrencyLimit);

            for (const chunk of chunks) {
                const chunkPromises = chunk.map(async (audioFile, index) => {
                    try {
                        const result = await this.transcribeAudio(audioFile.buffer, {
                            ...options,
                            streamId: null // Don't send individual updates
                        });

                        const jobResult = {
                            fileIndex: audioFile.index,
                            fileName: audioFile.name,
                            success: true,
                            result
                        };

                        this.updateBatchProgress(batchId, jobResult, options.streamId);
                        return jobResult;

                    } catch (error) {
                        const jobResult = {
                            fileIndex: audioFile.index,
                            fileName: audioFile.name,
                            success: false,
                            error: error.message
                        };

                        this.updateBatchProgress(batchId, jobResult, options.streamId);
                        return jobResult;
                    }
                });

                const chunkResults = await Promise.all(chunkPromises);
                jobs.push(...chunkResults);
            }

            // Finalize batch
            const batch = this.batchJobs.get(batchId);
            batch.status = 'completed';
            batch.endTime = Date.now();
            batch.duration = batch.endTime - batch.startTime;

            if (options.streamId) {
                streamingService.sendSSEMessage(options.streamId, 'batch_complete', batch);
            }

            logger.info('Batch processing completed', {
                batchId,
                totalFiles: audioFiles.length,
                completed: batch.completed,
                failed: batch.failed,
                duration: batch.duration
            });

            return batch;

        } catch (error) {
            logger.error('Batch processing error', { batchId, error: error.message });
            
            const batch = this.batchJobs.get(batchId);
            if (batch) {
                batch.status = 'failed';
                batch.error = error.message;
            }

            throw error;
        }
    }

    /**
     * Enhanced speech synthesis with custom voice profiles
     */
    async synthesizeSpeech(text, options = {}) {
        try {
            const {
                voice = 'alloy',
                speed = 1.0,
                format = 'mp3',
                model = 'tts-1',
                voiceProfile = null,
                streamId = null
            } = options;

            // Apply voice profile if specified
            let finalVoice = voice;
            if (voiceProfile && this.voiceProfiles.has(voiceProfile)) {
                const profile = this.voiceProfiles.get(voiceProfile);
                finalVoice = profile.preferredVoice || voice;
            }

            if (streamId) {
                streamingService.sendSSEMessage(streamId, 'synthesis_start', {
                    textLength: text.length,
                    voice: finalVoice,
                    model
                });
            }

            const response = await this.openai.audio.speech.create({
                model,
                voice: finalVoice,
                input: text,
                response_format: format,
                speed: Math.max(0.25, Math.min(4.0, speed))
            });

            const audioBuffer = Buffer.from(await response.arrayBuffer());

            if (streamId) {
                streamingService.sendSSEMessage(streamId, 'synthesis_complete', {
                    audioSize: audioBuffer.length,
                    format,
                    voice: finalVoice
                });
            }

            logger.info('Speech synthesis completed', {
                textLength: text.length,
                voice: finalVoice,
                audioSize: audioBuffer.length,
                format
            });

            return {
                audio: audioBuffer,
                format,
                voice: finalVoice,
                textLength: text.length,
                audioSize: audioBuffer.length
            };

        } catch (error) {
            logger.error('Speech synthesis error', { error: error.message });
            
            if (options.streamId) {
                streamingService.sendSSEMessage(options.streamId, 'synthesis_error', {
                    error: error.message
                });
            }
            
            throw error;
        }
    }

    /**
     * Real-time voice conversation with streaming
     */
    async startVoiceConversation(streamId, aiService) {
        try {
            streamingService.sendSSEMessage(streamId, 'voice_conversation_start', {
                capabilities: ['transcription', 'ai_processing', 'synthesis'],
                supportedFormats: ['webm', 'mp3', 'wav']
            });

            // Set up conversation state
            const conversationState = {
                streamId,
                isActive: true,
                history: [],
                voiceProfile: null
            };

            // Listen for audio chunks
            this.setupAudioStreamListener(streamId, conversationState, aiService);

            return conversationState;

        } catch (error) {
            logger.error('Voice conversation error', { streamId, error: error.message });
            throw error;
        }
    }

    /**
     * Create and manage voice profiles
     */
    async createVoiceProfile(userId, samples, metadata = {}) {
        const profileId = uuidv4();
        
        try {
            // Analyze voice samples to determine characteristics
            const characteristics = await this.analyzeVoiceSamples(samples);
            
            const profile = {
                id: profileId,
                userId,
                name: metadata.name || `Profile ${profileId.slice(0, 8)}`,
                characteristics,
                preferredVoice: this.selectBestVoice(characteristics),
                sampleCount: samples.length,
                createdAt: new Date().toISOString(),
                metadata
            };

            this.voiceProfiles.set(profileId, profile);
            
            logger.info('Voice profile created', {
                profileId,
                userId,
                sampleCount: samples.length,
                preferredVoice: profile.preferredVoice
            });

            return profile;

        } catch (error) {
            logger.error('Voice profile creation error', { profileId, error: error.message });
            throw error;
        }
    }

    // Helper methods
    calculateConfidence(result) {
        if (result.segments && result.segments.length > 0) {
            const avgConfidence = result.segments.reduce((sum, segment) => {
                return sum + (segment.avg_logprob || 0);
            }, 0) / result.segments.length;
            
            // Convert log probability to confidence percentage
            return Math.max(0, Math.min(100, (avgConfidence + 1) * 100));
        }
        return 95; // Default confidence for non-verbose responses
    }

    async detectSpeakers(result) {
        // Simple speaker detection based on audio segments
        if (!result.segments) return 1;
        
        const speakers = new Set();
        result.segments.forEach(segment => {
            // Basic heuristic: significant pause might indicate speaker change
            if (segment.start > 0 && segment.start - segment.end > 1.0) {
                speakers.add(`speaker_${speakers.size + 1}`);
            }
        });
        
        return Math.max(1, speakers.size);
    }

    async performSpeakerDiarization(segments) {
        // Enhanced speaker diarization would integrate with services like
        // Pyannote or similar. For now, provide basic grouping.
        return segments.map((segment, index) => ({
            ...segment,
            speaker: `Speaker_${(index % 2) + 1}` // Simple alternating assignment
        }));
    }

    updateBatchProgress(batchId, jobResult, streamId) {
        const batch = this.batchJobs.get(batchId);
        if (!batch) return;

        batch.results.push(jobResult);
        
        if (jobResult.success) {
            batch.completed++;
        } else {
            batch.failed++;
        }

        if (streamId) {
            streamingService.sendSSEMessage(streamId, 'batch_progress', {
                batchId,
                completed: batch.completed,
                failed: batch.failed,
                total: batch.totalFiles,
                progress: ((batch.completed + batch.failed) / batch.totalFiles) * 100
            });
        }
    }

    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    selectBestVoice(characteristics) {
        // Simple voice selection based on characteristics
        if (characteristics.gender === 'female') {
            return characteristics.energy > 0.7 ? 'nova' : 'shimmer';
        } else if (characteristics.gender === 'male') {
            return characteristics.pitch > 0.5 ? 'echo' : 'onyx';
        }
        return 'alloy'; // Neutral default
    }

    async analyzeVoiceSamples(samples) {
        // Placeholder for voice analysis
        // In a real implementation, this would use audio analysis libraries
        return {
            gender: 'neutral',
            pitch: 0.5,
            energy: 0.6,
            tempo: 0.7,
            quality: 0.8
        };
    }

    setupAudioStreamListener(streamId, conversationState, aiService) {
        // This would set up real-time audio processing
        // Implementation depends on WebSocket or WebRTC setup
        logger.info('Audio stream listener setup', { streamId });
    }

    /**
     * Get service statistics
     */
    getStats() {
        return {
            activeProcessing: this.processingQueue.size,
            voiceProfiles: this.voiceProfiles.size,
            batchJobs: this.batchJobs.size,
            availableVoices: Object.keys(this.voices),
            uptime: process.uptime()
        };
    }
}

export const enhancedVoiceService = new EnhancedVoiceService();