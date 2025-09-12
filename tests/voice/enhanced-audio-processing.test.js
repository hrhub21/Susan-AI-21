import { describe, test, expect, beforeEach, afterEach, beforeAll, jest } from '@jest/globals';
import { VoiceService } from '../../src/api/services/VoiceService.js';
import { EnhancedVoiceService } from '../../src/api/services/EnhancedVoiceService.js';
import { mockVoiceData, resetAllMocks } from '../utils/mocks.js';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

describe('Enhanced Audio Processing Tests', () => {
  let voiceService;
  let enhancedVoiceService;
  let testAudioDirectory;
  
  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    
    testAudioDirectory = path.join(process.cwd(), 'tests', 'voice', 'test-audio');
    await fs.ensureDir(testAudioDirectory);
    
    // Generate test audio files
    await generateTestAudioFiles();
  });
  
  beforeEach(() => {
    resetAllMocks();
    voiceService = new VoiceService();
    enhancedVoiceService = new EnhancedVoiceService();
  });
  
  afterEach(() => {
    resetAllMocks();
  });

  describe('Text-to-Speech Synthesis', () => {
    test('should synthesize speech with different voices', async () => {
      const testTexts = [
        'Hello, this is a test of the text-to-speech system.',
        'The quick brown fox jumps over the lazy dog.',
        'How are you doing today? I hope everything is going well.'
      ];
      
      const voices = ['alloy', 'echo', 'nova', 'shimmer'];
      
      for (const voice of voices) {
        for (const text of testTexts) {
          const result = await voiceService.synthesizeSpeech(text, {
            voice,
            speed: 1.0,
            format: 'mp3'
          });
          
          expect(result).toBeDefined();
          expect(result.audioBuffer).toBeTruthy();
          expect(result.duration).toBeGreaterThan(0);
          expect(result.voice).toBe(voice);
          expect(result.format).toBe('mp3');
          
          // Validate audio buffer properties
          expect(result.audioBuffer).toBeInstanceOf(ArrayBuffer);
          expect(result.audioBuffer.byteLength).toBeGreaterThan(0);
        }
      }
    });

    test('should handle different speech speeds', async () => {
      const text = 'This is a test of variable speech speed synthesis.';
      const speeds = [0.25, 0.5, 1.0, 1.5, 2.0, 4.0];
      
      const results = [];
      
      for (const speed of speeds) {
        const result = await voiceService.synthesizeSpeech(text, {
          voice: 'alloy',
          speed,
          format: 'mp3'
        });
        
        results.push({ speed, duration: result.duration });
        
        expect(result.audioBuffer.byteLength).toBeGreaterThan(0);
        expect(result.speed).toBe(speed);
      }
      
      // Verify that faster speeds result in shorter durations
      for (let i = 1; i < results.length; i++) {
        if (results[i].speed > results[i-1].speed) {
          expect(results[i].duration).toBeLessThanOrEqual(results[i-1].duration);
        }
      }
    });

    test('should support different audio formats', async () => {
      const text = 'Testing different audio format support.';
      const formats = ['mp3', 'opus', 'aac', 'flac'];
      
      for (const format of formats) {
        const result = await voiceService.synthesizeSpeech(text, {
          voice: 'alloy',
          speed: 1.0,
          format
        });
        
        expect(result.format).toBe(format);
        expect(result.audioBuffer.byteLength).toBeGreaterThan(0);
        
        // Basic format validation based on file headers
        const uint8Array = new Uint8Array(result.audioBuffer.slice(0, 8));
        
        switch (format) {
          case 'mp3':
            // MP3 files start with ID3 tag or sync frame
            expect(
              (uint8Array[0] === 0x49 && uint8Array[1] === 0x44 && uint8Array[2] === 0x33) || // ID3
              (uint8Array[0] === 0xFF && (uint8Array[1] & 0xE0) === 0xE0) // Sync frame
            ).toBe(true);
            break;
          case 'flac':
            // FLAC files start with 'fLaC'
            expect(uint8Array[0]).toBe(0x66); // 'f'
            expect(uint8Array[1]).toBe(0x4C); // 'L'
            expect(uint8Array[2]).toBe(0x61); // 'a'
            expect(uint8Array[3]).toBe(0x43); // 'C'
            break;
        }
      }
    });

    test('should handle long text input with chunking', async () => {
      const longText = `
        This is a very long piece of text that should test the text-to-speech system's
        ability to handle extended content. It contains multiple sentences and should
        demonstrate proper chunking and processing of lengthy input. The system should
        be able to maintain consistent voice quality and timing throughout the entire
        synthesis process. Additionally, it should properly handle punctuation, pauses,
        and natural speech patterns even with extended content like this example.
      `.repeat(10); // Make it even longer
      
      const result = await voiceService.synthesizeSpeech(longText, {
        voice: 'alloy',
        speed: 1.5,
        format: 'mp3'
      });
      
      expect(result.audioBuffer.byteLength).toBeGreaterThan(100000); // Should be substantial
      expect(result.duration).toBeGreaterThan(30); // Should be at least 30 seconds
      expect(result.chunks).toBeDefined();
      expect(Array.isArray(result.chunks)).toBe(true);
      expect(result.chunks.length).toBeGreaterThan(1);
    });

    test('should handle special characters and emojis', async () => {
      const specialTexts = [
        'Hello! How are you? I\'m doing great today. 😊',
        'The price is $29.99 for a 50% discount! 🎉',
        'Email me at test@example.com for more info.',
        'Visit https://www.example.com/path?param=value&other=123',
        'Français: Bonjour! Español: ¡Hola! Deutsch: Hallo!',
        'Mathematical symbols: ∞ ≈ ± √ ∑ ∏ ∂ ∫'
      ];
      
      for (const text of specialTexts) {
        const result = await voiceService.synthesizeSpeech(text, {
          voice: 'nova',
          speed: 1.0,
          format: 'mp3'
        });
        
        expect(result.audioBuffer.byteLength).toBeGreaterThan(0);
        expect(result.duration).toBeGreaterThan(0);
      }
    });
  });

  describe('Speech-to-Text Transcription', () => {
    test('should transcribe audio files accurately', async () => {
      const testAudioFile = path.join(testAudioDirectory, 'test-speech.wav');
      
      // Ensure test file exists
      if (await fs.pathExists(testAudioFile)) {
        const audioBuffer = await fs.readFile(testAudioFile);
        
        const result = await voiceService.transcribeAudio(audioBuffer, {
          language: 'en',
          model: 'whisper-1',
          temperature: 0.2
        });
        
        expect(result.text).toBeDefined();
        expect(typeof result.text).toBe('string');
        expect(result.text.length).toBeGreaterThan(0);
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.duration).toBeGreaterThan(0);
        expect(result.language).toBe('en');
      }
    });

    test('should handle different audio formats for transcription', async () => {
      const audioFormats = ['wav', 'mp3', 'mp4', 'mpeg', 'm4a', 'ogg', 'webm'];
      
      for (const format of audioFormats) {
        const testFile = path.join(testAudioDirectory, `test-audio.${format}`);
        
        if (await fs.pathExists(testFile)) {
          const audioBuffer = await fs.readFile(testFile);
          
          const result = await voiceService.transcribeAudio(audioBuffer, {
            language: 'en',
            model: 'whisper-1'
          });
          
          expect(result.text).toBeDefined();
          expect(result.format).toBe(format);
        }
      }
    });

    test('should provide detailed transcription with timestamps', async () => {
      const testAudioFile = path.join(testAudioDirectory, 'test-speech.wav');
      
      if (await fs.pathExists(testAudioFile)) {
        const audioBuffer = await fs.readFile(testAudioFile);
        
        const result = await voiceService.transcribeAudio(audioBuffer, {
          language: 'en',
          model: 'whisper-1',
          response_format: 'verbose_json',
          timestamp_granularities: ['word', 'segment']
        });
        
        expect(result.text).toBeDefined();
        expect(result.words).toBeDefined();
        expect(Array.isArray(result.words)).toBe(true);
        expect(result.segments).toBeDefined();
        expect(Array.isArray(result.segments)).toBe(true);
        
        // Validate word-level timestamps
        result.words.forEach(word => {
          expect(word.word).toBeDefined();
          expect(typeof word.start).toBe('number');
          expect(typeof word.end).toBe('number');
          expect(word.end).toBeGreaterThan(word.start);
        });
        
        // Validate segment-level timestamps
        result.segments.forEach(segment => {
          expect(segment.text).toBeDefined();
          expect(typeof segment.start).toBe('number');
          expect(typeof segment.end).toBe('number');
          expect(segment.end).toBeGreaterThan(segment.start);
        });
      }
    });

    test('should handle multiple languages', async () => {
      const languageTests = [
        { language: 'en', expectedText: 'english' },
        { language: 'es', expectedText: 'español' },
        { language: 'fr', expectedText: 'français' },
        { language: 'de', expectedText: 'deutsch' },
        { language: 'it', expectedText: 'italiano' }
      ];
      
      for (const test of languageTests) {
        const testFile = path.join(testAudioDirectory, `test-${test.language}.wav`);
        
        if (await fs.pathExists(testFile)) {
          const audioBuffer = await fs.readFile(testFile);
          
          const result = await voiceService.transcribeAudio(audioBuffer, {
            language: test.language,
            model: 'whisper-1'
          });
          
          expect(result.text).toBeDefined();
          expect(result.language).toBe(test.language);
          expect(result.text.toLowerCase()).toContain(test.expectedText);
        }
      }
    });
  });

  describe('Real-time Voice Processing', () => {
    test('should handle streaming audio transcription', async () => {
      const chunks = [];
      const audioFile = path.join(testAudioDirectory, 'test-speech.wav');
      
      if (await fs.pathExists(audioFile)) {
        const fullAudio = await fs.readFile(audioFile);
        const chunkSize = 4096;
        
        // Split audio into chunks
        for (let i = 0; i < fullAudio.length; i += chunkSize) {
          chunks.push(fullAudio.slice(i, i + chunkSize));
        }
        
        const transcriptionStream = enhancedVoiceService.createTranscriptionStream({
          language: 'en',
          model: 'whisper-1',
          realtime: true
        });
        
        const results = [];
        
        transcriptionStream.on('partial', (result) => {
          results.push({ type: 'partial', text: result.text });
        });
        
        transcriptionStream.on('final', (result) => {
          results.push({ type: 'final', text: result.text });
        });
        
        // Send chunks with realistic timing
        for (const chunk of chunks) {
          transcriptionStream.write(chunk);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        transcriptionStream.end();
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(r => r.type === 'partial')).toBe(true);
        expect(results.some(r => r.type === 'final')).toBe(true);
      }
    });

    test('should handle real-time voice activity detection', async () => {
      const voiceActivityDetector = enhancedVoiceService.createVoiceActivityDetector({
        sensitivity: 0.5,
        minSpeechDuration: 300,
        minSilenceDuration: 500
      });
      
      const audioFile = path.join(testAudioDirectory, 'test-with-silence.wav');
      
      if (await fs.pathExists(audioFile)) {
        const audioBuffer = await fs.readFile(audioFile);
        const events = [];
        
        voiceActivityDetector.on('speech_start', () => {
          events.push({ type: 'speech_start', timestamp: Date.now() });
        });
        
        voiceActivityDetector.on('speech_end', () => {
          events.push({ type: 'speech_end', timestamp: Date.now() });
        });
        
        voiceActivityDetector.process(audioBuffer);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        expect(events.length).toBeGreaterThan(0);
        expect(events.some(e => e.type === 'speech_start')).toBe(true);
        expect(events.some(e => e.type === 'speech_end')).toBe(true);
      }
    });
  });

  describe('Audio Quality and Validation', () => {
    test('should validate audio quality metrics', async () => {
      const text = 'This is a quality test for audio synthesis validation.';
      
      const result = await voiceService.synthesizeSpeech(text, {
        voice: 'alloy',
        speed: 1.0,
        format: 'wav' // Use uncompressed format for quality analysis
      });
      
      const qualityMetrics = await enhancedVoiceService.analyzeAudioQuality(result.audioBuffer);
      
      expect(qualityMetrics).toBeDefined();
      expect(qualityMetrics.sampleRate).toBeGreaterThan(0);
      expect(qualityMetrics.bitDepth).toBeGreaterThan(0);
      expect(qualityMetrics.duration).toBeGreaterThan(0);
      expect(qualityMetrics.rms).toBeGreaterThan(0);
      expect(qualityMetrics.peak).toBeGreaterThan(0);
      expect(qualityMetrics.snr).toBeGreaterThan(10); // Signal-to-noise ratio
      expect(qualityMetrics.thd).toBeLessThan(5); // Total harmonic distortion percentage
    });

    test('should detect audio corruption or artifacts', async () => {
      // Create a corrupted audio buffer
      const corruptedBuffer = new ArrayBuffer(1024);
      const view = new Uint8Array(corruptedBuffer);
      
      // Fill with random noise
      for (let i = 0; i < view.length; i++) {
        view[i] = Math.floor(Math.random() * 256);
      }
      
      const analysis = await enhancedVoiceService.detectAudioArtifacts(corruptedBuffer);
      
      expect(analysis.corruption.detected).toBe(true);
      expect(analysis.corruption.confidence).toBeGreaterThan(0.8);
      expect(analysis.artifacts).toBeDefined();
      expect(Array.isArray(analysis.artifacts.types)).toBe(true);
    });

    test('should normalize audio levels', async () => {
      const testAudioFile = path.join(testAudioDirectory, 'test-quiet-audio.wav');
      
      if (await fs.pathExists(testAudioFile)) {
        const audioBuffer = await fs.readFile(testAudioFile);
        
        const normalized = await enhancedVoiceService.normalizeAudio(audioBuffer, {
          targetLevel: -23, // LUFS
          maxPeak: -1, // dBFS
          method: 'rms'
        });
        
        expect(normalized.audioBuffer).toBeDefined();
        expect(normalized.audioBuffer.byteLength).toBeGreaterThan(0);
        expect(normalized.appliedGain).toBeDefined();
        expect(normalized.finalLevel).toBeCloseTo(-23, 1);
        expect(normalized.peakLevel).toBeLessThanOrEqual(-1);
      }
    });
  });

  describe('Voice Cloning and Synthesis', () => {
    test('should analyze voice characteristics', async () => {
      const referenceAudioFile = path.join(testAudioDirectory, 'reference-voice.wav');
      
      if (await fs.pathExists(referenceAudioFile)) {
        const audioBuffer = await fs.readFile(referenceAudioFile);
        
        const voiceProfile = await enhancedVoiceService.analyzeVoiceCharacteristics(audioBuffer);
        
        expect(voiceProfile).toBeDefined();
        expect(voiceProfile.fundamentalFrequency).toBeGreaterThan(0);
        expect(voiceProfile.formants).toBeDefined();
        expect(Array.isArray(voiceProfile.formants)).toBe(true);
        expect(voiceProfile.spectralCentroid).toBeGreaterThan(0);
        expect(voiceProfile.voiceType).toMatch(/male|female|child/);
        expect(voiceProfile.age).toBeGreaterThan(0);
        expect(voiceProfile.emotion).toBeDefined();
      }
    });

    test('should detect voice similarity', async () => {
      const voice1File = path.join(testAudioDirectory, 'voice1.wav');
      const voice2File = path.join(testAudioDirectory, 'voice2.wav');
      
      if (await fs.pathExists(voice1File) && await fs.pathExists(voice2File)) {
        const voice1Buffer = await fs.readFile(voice1File);
        const voice2Buffer = await fs.readFile(voice2File);
        
        const similarity = await enhancedVoiceService.compareVoices(voice1Buffer, voice2Buffer);
        
        expect(similarity).toBeDefined();
        expect(similarity.score).toBeGreaterThanOrEqual(0);
        expect(similarity.score).toBeLessThanOrEqual(1);
        expect(similarity.features).toBeDefined();
        expect(similarity.features.pitchSimilarity).toBeDefined();
        expect(similarity.features.timbreSimilarity).toBeDefined();
        expect(similarity.features.paceSimilarity).toBeDefined();
      }
    });
  });

  describe('Performance and Optimization', () => {
    test('should handle concurrent voice synthesis requests', async () => {
      const texts = [
        'First concurrent synthesis test.',
        'Second concurrent synthesis test.',
        'Third concurrent synthesis test.',
        'Fourth concurrent synthesis test.',
        'Fifth concurrent synthesis test.'
      ];
      
      const startTime = Date.now();
      
      const promises = texts.map((text, index) => 
        voiceService.synthesizeSpeech(text, {
          voice: index % 2 === 0 ? 'alloy' : 'nova',
          speed: 1.0,
          format: 'mp3'
        })
      );
      
      const results = await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(results.length).toBe(5);
      expect(results.every(r => r.audioBuffer.byteLength > 0)).toBe(true);
      expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds
    });

    test('should cache repeated synthesis requests', async () => {
      const text = 'This is a caching test for voice synthesis.';
      const options = {
        voice: 'alloy',
        speed: 1.0,
        format: 'mp3'
      };
      
      // First request
      const startTime1 = Date.now();
      const result1 = await voiceService.synthesizeSpeech(text, options);
      const endTime1 = Date.now();
      const firstRequestTime = endTime1 - startTime1;
      
      // Second request (should be cached)
      const startTime2 = Date.now();
      const result2 = await voiceService.synthesizeSpeech(text, options);
      const endTime2 = Date.now();
      const secondRequestTime = endTime2 - startTime2;
      
      expect(result1.audioBuffer.byteLength).toBe(result2.audioBuffer.byteLength);
      expect(secondRequestTime).toBeLessThan(firstRequestTime * 0.5); // Cached should be much faster
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty text input', async () => {
      await expect(
        voiceService.synthesizeSpeech('', { voice: 'alloy' })
      ).rejects.toThrow('Text cannot be empty');
    });

    test('should handle invalid voice selection', async () => {
      await expect(
        voiceService.synthesizeSpeech('Test text', { voice: 'invalid-voice' })
      ).rejects.toThrow('Invalid voice');
    });

    test('should handle corrupted audio files', async () => {
      const corruptedBuffer = Buffer.from('not-audio-data');
      
      await expect(
        voiceService.transcribeAudio(corruptedBuffer)
      ).rejects.toThrow('Invalid audio format');
    });

    test('should handle network timeouts gracefully', async () => {
      // Mock network timeout
      const originalTimeout = voiceService.requestTimeout;
      voiceService.requestTimeout = 1; // 1ms timeout
      
      await expect(
        voiceService.synthesizeSpeech('Test timeout handling', { voice: 'alloy' })
      ).rejects.toThrow('timeout');
      
      // Restore original timeout
      voiceService.requestTimeout = originalTimeout;
    });
  });
});

// Helper function to generate test audio files
async function generateTestAudioFiles() {
  const testAudioDirectory = path.join(process.cwd(), 'tests', 'voice', 'test-audio');
  
  // Generate a simple sine wave WAV file for testing
  const generateSineWave = (frequency, duration, sampleRate = 44100) => {
    const samples = Math.floor(sampleRate * duration);
    const data = new Int16Array(samples);
    
    for (let i = 0; i < samples; i++) {
      const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate);
      data[i] = sample * 32767; // Convert to 16-bit
    }
    
    return data;
  };
  
  const createWavFile = (audioData, sampleRate = 44100) => {
    const buffer = new ArrayBuffer(44 + audioData.length * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + audioData.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, audioData.length * 2, true);
    
    // Audio data
    for (let i = 0; i < audioData.length; i++) {
      view.setInt16(44 + i * 2, audioData[i], true);
    }
    
    return buffer;
  };
  
  // Generate test files
  const testFiles = [
    { name: 'test-speech.wav', frequency: 440, duration: 2 },
    { name: 'test-quiet-audio.wav', frequency: 220, duration: 1 },
    { name: 'test-with-silence.wav', frequency: 880, duration: 0.5 },
    { name: 'reference-voice.wav', frequency: 330, duration: 3 },
    { name: 'voice1.wav', frequency: 440, duration: 2 },
    { name: 'voice2.wav', frequency: 450, duration: 2 }
  ];
  
  for (const file of testFiles) {
    const audioData = generateSineWave(file.frequency, file.duration);
    const wavBuffer = createWavFile(audioData);
    const filePath = path.join(testAudioDirectory, file.name);
    
    await fs.writeFile(filePath, Buffer.from(wavBuffer));
  }
}
