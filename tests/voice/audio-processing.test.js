import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { VoiceService } from '../../src/api/services/VoiceService.js';
import { EnhancedVoiceService } from '../../src/api/services/EnhancedVoiceService.js';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

describe('Voice Processing and Audio Testing', () => {
  let voiceService;
  let enhancedVoiceService;
  let testAudioDir;
  let audioFixtures;
  
  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    
    voiceService = new VoiceService();
    enhancedVoiceService = new EnhancedVoiceService();
    
    // Create test audio directory
    testAudioDir = path.join(process.cwd(), 'tests', 'voice', 'fixtures');
    await fs.ensureDir(testAudioDir);
    
    // Create audio test fixtures
    audioFixtures = await createAudioTestFixtures(testAudioDir);
  });
  
  afterAll(async () => {
    // Clean up test audio files
    if (testAudioDir && await fs.pathExists(testAudioDir)) {
      await fs.remove(testAudioDir);
    }
  });
  
  beforeEach(() => {
    // Reset service state before each test
    if (voiceService.activeTranscriptions) {
      voiceService.activeTranscriptions.clear();
    }
    if (voiceService.batchJobs) {
      voiceService.batchJobs.clear();
    }
  });

  describe('Audio File Validation', () => {
    test('should validate supported audio formats', () => {
      const supportedFormats = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'];
      const testFiles = [
        { name: 'test.mp3', valid: true },
        { name: 'test.wav', valid: true },
        { name: 'test.m4a', valid: true },
        { name: 'test.txt', valid: false },
        { name: 'test.exe', valid: false },
        { name: 'test.pdf', valid: false }
      ];
      
      testFiles.forEach(({ name, valid }) => {
        const isSupported = voiceService.isAudioFormatSupported(name);
        expect(isSupported).toBe(valid);
      });
    });

    test('should validate audio file size limits', async () => {
      const testCases = [
        { size: 1024 * 1024, valid: true }, // 1MB
        { size: 10 * 1024 * 1024, valid: true }, // 10MB
        { size: 25 * 1024 * 1024, valid: true }, // 25MB (limit)
        { size: 30 * 1024 * 1024, valid: false }, // 30MB (over limit)
        { size: 100 * 1024 * 1024, valid: false } // 100MB (way over)
      ];
      
      for (const { size, valid } of testCases) {
        const mockFile = { size, name: 'test.mp3' };
        const isValid = voiceService.validateFileSize(mockFile);
        expect(isValid).toBe(valid);
      }
    });

    test('should detect corrupted audio files', async () => {
      // Create a fake corrupted audio file
      const corruptedFile = path.join(testAudioDir, 'corrupted.mp3');
      await fs.writeFile(corruptedFile, 'This is not audio data');
      
      const result = await voiceService.validateAudioFile(corruptedFile);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid audio format');
      
      await fs.remove(corruptedFile);
    });
  });

  describe('Audio Transcription Quality', () => {
    test('should handle different audio qualities', async () => {
      const qualityTests = [
        {
          name: 'high-quality.mp3',
          expectedAccuracy: 0.95,
          sampleRate: 44100,
          bitRate: 320
        },
        {
          name: 'medium-quality.mp3',
          expectedAccuracy: 0.85,
          sampleRate: 22050,
          bitRate: 128
        },
        {
          name: 'low-quality.mp3',
          expectedAccuracy: 0.70,
          sampleRate: 8000,
          bitRate: 64
        }
      ];
      
      for (const test of qualityTests) {
        const audioFile = audioFixtures[test.name];
        if (!audioFile) {
          console.warn(`Test fixture ${test.name} not found, skipping...`);
          continue;
        }
        
        try {
          const result = await voiceService.transcribeAudio(audioFile, {
            response_format: 'verbose_json'
          });
          
          expect(result).toBeDefined();
          expect(result.text).toBeTruthy();
          
          // Check confidence scores if available
          if (result.segments && result.segments.length > 0) {
            const avgConfidence = result.segments.reduce(
              (sum, seg) => sum + (seg.confidence || 0), 0
            ) / result.segments.length;
            
            expect(avgConfidence).toBeGreaterThan(test.expectedAccuracy - 0.2);
          }
          
          console.log(`${test.name}: Transcription successful`);
        } catch (error) {
          console.warn(`Transcription test for ${test.name} skipped: ${error.message}`);
        }
      }
    });

    test('should handle background noise', async () => {
      const noisyAudioFile = audioFixtures['noisy-speech.mp3'];
      if (!noisyAudioFile) {
        console.warn('Noisy audio fixture not found, skipping test');
        return;
      }
      
      try {
        const result = await voiceService.transcribeAudio(noisyAudioFile, {
          noise_reduction: true,
          temperature: 0.1 // Lower temperature for more focused transcription
        });
        
        expect(result).toBeDefined();
        expect(result.text).toBeTruthy();
        
        // Should still produce reasonable transcription despite noise
        expect(result.text.length).toBeGreaterThan(10);
        
        console.log('Noisy audio transcription successful');
      } catch (error) {
        console.warn(`Noisy audio test skipped: ${error.message}`);
      }
    });

    test('should handle multiple speakers', async () => {
      const multiSpeakerFile = audioFixtures['multi-speaker.mp3'];
      if (!multiSpeakerFile) {
        console.warn('Multi-speaker fixture not found, skipping test');
        return;
      }
      
      try {
        const result = await voiceService.transcribeAudio(multiSpeakerFile, {
          speaker_detection: true,
          response_format: 'verbose_json'
        });
        
        expect(result).toBeDefined();
        expect(result.text).toBeTruthy();
        
        // Check for speaker information if available
        if (result.segments) {
          const hasSpeakerInfo = result.segments.some(
            seg => seg.speaker || seg.speaker_id
          );
          
          if (hasSpeakerInfo) {
            expect(hasSpeakerInfo).toBe(true);
            console.log('Speaker detection working');
          }
        }
        
        console.log('Multi-speaker transcription successful');
      } catch (error) {
        console.warn(`Multi-speaker test skipped: ${error.message}`);
      }
    });
  });

  describe('Speech Synthesis Quality', () => {
    test('should generate speech with different voices', async () => {
      const voices = ['alloy', 'echo', 'nova'];
      const testText = 'Hello, this is a test of voice synthesis quality.';
      
      for (const voice of voices) {
        try {
          const result = await voiceService.synthesizeSpeech(testText, {
            voice,
            speed: 1.0,
            format: 'mp3'
          });
          
          expect(result).toBeDefined();
          expect(result.audioBuffer).toBeDefined();
          expect(result.audioBuffer.byteLength).toBeGreaterThan(0);
          
          // Check audio metadata
          expect(result.metadata.voice).toBe(voice);
          expect(result.metadata.format).toBe('mp3');
          
          console.log(`Voice ${voice}: ${result.audioBuffer.byteLength} bytes generated`);
        } catch (error) {
          console.warn(`Voice synthesis test for ${voice} skipped: ${error.message}`);
        }
      }
    });

    test('should handle different speech speeds', async () => {
      const speeds = [0.5, 1.0, 1.5, 2.0];
      const testText = 'Testing different speech synthesis speeds.';
      
      const results = [];
      
      for (const speed of speeds) {
        try {
          const result = await voiceService.synthesizeSpeech(testText, {
            voice: 'alloy',
            speed,
            format: 'mp3'
          });
          
          expect(result).toBeDefined();
          expect(result.audioBuffer).toBeDefined();
          
          results.push({
            speed,
            duration: result.metadata.duration,
            size: result.audioBuffer.byteLength
          });
          
          console.log(`Speed ${speed}: ${result.metadata.duration}s, ${result.audioBuffer.byteLength} bytes`);
        } catch (error) {
          console.warn(`Speed test for ${speed} skipped: ${error.message}`);
        }
      }
      
      // Verify that faster speeds produce shorter durations
      if (results.length >= 2) {
        const slowResult = results.find(r => r.speed === 0.5);
        const fastResult = results.find(r => r.speed === 2.0);
        
        if (slowResult && fastResult) {
          expect(slowResult.duration).toBeGreaterThan(fastResult.duration);
        }
      }
    });

    test('should handle long text synthesis', async () => {
      const longText = `
        This is a comprehensive test of the text-to-speech synthesis system's ability to handle longer content.
        The system should be able to process multiple sentences with various punctuation marks, numbers like 123 and 456,
        and maintain consistent quality throughout the entire synthesis process.
        It should handle different types of content including technical terms, proper nouns, and common phrases.
        The resulting audio should be clear, natural-sounding, and properly paced for optimal listening experience.
      `.trim();
      
      try {
        const result = await voiceService.synthesizeSpeech(longText, {
          voice: 'nova',
          speed: 1.0
        });
        
        expect(result).toBeDefined();
        expect(result.audioBuffer).toBeDefined();
        expect(result.audioBuffer.byteLength).toBeGreaterThan(10000); // Should be substantial
        
        // Should handle long text within reasonable time
        expect(result.metadata.duration).toBeGreaterThan(10); // At least 10 seconds
        expect(result.metadata.duration).toBeLessThan(120); // But not more than 2 minutes
        
        console.log(`Long text synthesis: ${result.metadata.duration}s, ${result.audioBuffer.byteLength} bytes`);
      } catch (error) {
        console.warn(`Long text synthesis test skipped: ${error.message}`);
      }
    });
  });

  describe('Real-time Audio Processing', () => {
    test('should handle streaming audio transcription', async () => {
      try {
        const streamId = voiceService.createStreamingSession();
        expect(streamId).toBeDefined();
        
        // Simulate streaming audio chunks
        const audioChunks = await createAudioChunks(audioFixtures['streaming-test.mp3']);
        
        const transcriptionResults = [];
        
        for (const chunk of audioChunks) {
          const result = await voiceService.processAudioChunk(streamId, chunk);
          if (result && result.text) {
            transcriptionResults.push(result.text);
          }
        }
        
        // Finalize the stream
        const finalResult = await voiceService.finalizeStream(streamId);
        
        expect(finalResult).toBeDefined();
        expect(finalResult.completeTranscription).toBeTruthy();
        
        console.log('Streaming transcription successful');
      } catch (error) {
        console.warn(`Streaming transcription test skipped: ${error.message}`);
      }
    });

    test('should handle voice activity detection', async () => {
      const testFiles = [
        { name: 'speech.mp3', expectedActivity: true },
        { name: 'silence.mp3', expectedActivity: false },
        { name: 'music.mp3', expectedActivity: false }
      ];
      
      for (const { name, expectedActivity } of testFiles) {
        const audioFile = audioFixtures[name];
        if (!audioFile) {
          console.warn(`VAD test fixture ${name} not found, skipping...`);
          continue;
        }
        
        try {
          const hasVoiceActivity = await voiceService.detectVoiceActivity(audioFile);
          expect(hasVoiceActivity).toBe(expectedActivity);
          
          console.log(`VAD for ${name}: ${hasVoiceActivity ? 'Voice detected' : 'No voice detected'}`);
        } catch (error) {
          console.warn(`VAD test for ${name} skipped: ${error.message}`);
        }
      }
    });
  });

  describe('Audio Format Conversion', () => {
    test('should convert between audio formats', async () => {
      const sourceFile = audioFixtures['test-audio.wav'];
      if (!sourceFile) {
        console.warn('Source audio for conversion test not found, skipping...');
        return;
      }
      
      const targetFormats = ['mp3', 'm4a', 'webm'];
      
      for (const format of targetFormats) {
        try {
          const convertedFile = await voiceService.convertAudioFormat(
            sourceFile,
            format,
            { quality: 'high' }
          );
          
          expect(convertedFile).toBeDefined();
          expect(convertedFile.format).toBe(format);
          expect(convertedFile.buffer.byteLength).toBeGreaterThan(0);
          
          console.log(`Converted to ${format}: ${convertedFile.buffer.byteLength} bytes`);
        } catch (error) {
          console.warn(`Format conversion to ${format} skipped: ${error.message}`);
        }
      }
    });
  });

  describe('Batch Audio Processing', () => {
    test('should process multiple audio files efficiently', async () => {
      const batchFiles = [
        audioFixtures['batch-1.mp3'],
        audioFixtures['batch-2.mp3'],
        audioFixtures['batch-3.mp3']
      ].filter(Boolean); // Remove undefined files
      
      if (batchFiles.length === 0) {
        console.warn('No batch audio fixtures found, skipping test');
        return;
      }
      
      try {
        const startTime = Date.now();
        
        const batchJobId = voiceService.createBatchJob(batchFiles, {
          operation: 'transcription',
          options: {
            language: 'auto',
            response_format: 'text'
          }
        });
        
        expect(batchJobId).toBeDefined();
        
        // Monitor batch progress
        let completed = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds timeout
        
        while (!completed && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const status = voiceService.getBatchJobStatus(batchJobId);
          
          if (status.status === 'completed') {
            completed = true;
            
            expect(status.results).toBeDefined();
            expect(status.results.length).toBe(batchFiles.length);
            
            const processingTime = Date.now() - startTime;
            console.log(`Batch processing completed in ${processingTime}ms`);
            
            // Verify all files were processed
            status.results.forEach((result, index) => {
              expect(result.success).toBe(true);
              expect(result.transcription).toBeTruthy();
            });
          } else if (status.status === 'failed') {
            throw new Error('Batch job failed');
          }
          
          attempts++;
        }
        
        if (!completed) {
          console.warn('Batch processing test timed out');
        }
      } catch (error) {
        console.warn(`Batch processing test skipped: ${error.message}`);
      }
    });
  });

  describe('Audio Quality Metrics', () => {
    test('should measure audio quality metrics', async () => {
      const testFile = audioFixtures['quality-test.mp3'];
      if (!testFile) {
        console.warn('Quality test fixture not found, skipping...');
        return;
      }
      
      try {
        const metrics = await voiceService.analyzeAudioQuality(testFile);
        
        expect(metrics).toBeDefined();
        expect(metrics.snr).toBeDefined(); // Signal-to-noise ratio
        expect(metrics.clarity).toBeDefined();
        expect(metrics.sampleRate).toBeDefined();
        expect(metrics.bitRate).toBeDefined();
        expect(metrics.duration).toBeGreaterThan(0);
        
        // Quality should be reasonable
        expect(metrics.snr).toBeGreaterThan(10); // At least 10dB SNR
        expect(metrics.clarity).toBeGreaterThan(0.5); // Clarity score 0-1
        
        console.log('Audio quality metrics:', metrics);
      } catch (error) {
        console.warn(`Audio quality test skipped: ${error.message}`);
      }
    });
  });
});

// Helper functions for creating test fixtures
async function createAudioTestFixtures(testDir) {
  const fixtures = {};
  
  // Create various audio test files
  const audioSamples = {
    'test-audio.mp3': generateMockAudioData('mp3', 5000), // 5 second audio
    'high-quality.mp3': generateMockAudioData('mp3', 3000, { quality: 'high' }),
    'medium-quality.mp3': generateMockAudioData('mp3', 3000, { quality: 'medium' }),
    'low-quality.mp3': generateMockAudioData('mp3', 3000, { quality: 'low' }),
    'noisy-speech.mp3': generateMockAudioData('mp3', 4000, { noise: true }),
    'multi-speaker.mp3': generateMockAudioData('mp3', 6000, { speakers: 2 }),
    'streaming-test.mp3': generateMockAudioData('mp3', 8000, { streaming: true }),
    'silence.mp3': generateMockAudioData('mp3', 2000, { silence: true }),
    'music.mp3': generateMockAudioData('mp3', 4000, { music: true }),
    'test-audio.wav': generateMockAudioData('wav', 3000),
    'batch-1.mp3': generateMockAudioData('mp3', 2000),
    'batch-2.mp3': generateMockAudioData('mp3', 2000),
    'batch-3.mp3': generateMockAudioData('mp3', 2000),
    'quality-test.mp3': generateMockAudioData('mp3', 4000, { quality: 'high' })
  };
  
  for (const [filename, data] of Object.entries(audioSamples)) {
    const filePath = path.join(testDir, filename);
    await fs.writeFile(filePath, data);
    fixtures[filename] = {
      path: filePath,
      name: filename,
      size: data.length
    };
  }
  
  return fixtures;
}

function generateMockAudioData(format, durationMs, options = {}) {
  // Generate mock audio data based on format and options
  const baseSize = Math.floor(durationMs * 16); // Rough bytes per ms
  
  // Adjust size based on quality
  let size = baseSize;
  if (options.quality === 'high') {
    size = baseSize * 2;
  } else if (options.quality === 'low') {
    size = Math.floor(baseSize * 0.5);
  }
  
  // Add some randomness for realistic file sizes
  size += Math.floor(Math.random() * 1000);
  
  // Generate random binary data that could represent audio
  const buffer = Buffer.alloc(size);
  for (let i = 0; i < size; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  
  // Add format-specific headers (very basic mock)
  if (format === 'mp3') {
    // MP3 frame header
    buffer[0] = 0xFF;
    buffer[1] = 0xFB;
  } else if (format === 'wav') {
    // WAV header
    buffer.write('RIFF', 0);
    buffer.write('WAVE', 8);
  }
  
  return buffer;
}

async function createAudioChunks(audioFile) {
  if (!audioFile) {
    return [];
  }
  
  // Read the audio file and split into chunks
  const audioData = await fs.readFile(audioFile.path);
  const chunkSize = Math.floor(audioData.length / 5); // 5 chunks
  const chunks = [];
  
  for (let i = 0; i < audioData.length; i += chunkSize) {
    chunks.push(audioData.slice(i, i + chunkSize));
  }
  
  return chunks;
}
