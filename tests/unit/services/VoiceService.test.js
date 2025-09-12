import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { VoiceService } from '../../../src/api/services/VoiceService.js';
import { mockOpenAI, resetAllMocks } from '../../utils/mocks.js';
import fs from 'fs-extra';
import path from 'path';

// Mock the external dependencies
jest.unstable_mockModule('openai', () => ({
  default: jest.fn(() => mockOpenAI)
}));

jest.unstable_mockModule('fs-extra', () => ({
  default: {
    stat: jest.fn(),
    createReadStream: jest.fn(),
    ensureDir: jest.fn()
  }
}));

describe('VoiceService', () => {
  let voiceService;
  
  beforeEach(() => {
    resetAllMocks();
    
    // Set test environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key';
    
    voiceService = new VoiceService();
  });
  
  afterEach(() => {
    resetAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with proper configuration', () => {
      expect(voiceService).toBeDefined();
      expect(voiceService.batchJobs).toBeInstanceOf(Map);
      expect(voiceService.activeTranscriptions).toBeInstanceOf(Map);
      expect(voiceService.voiceProfiles).toBeInstanceOf(Map);
      expect(voiceService.supportedFormats).toContain('mp3');
      expect(voiceService.maxFileSize).toBe(25 * 1024 * 1024);
    });

    test('should have OpenAI client when API key is provided', () => {
      expect(voiceService.openai).toBeDefined();
    });

    test('should handle missing OpenAI API key gracefully', () => {
      delete process.env.OPENAI_API_KEY;
      
      const serviceWithoutKey = new VoiceService();
      expect(serviceWithoutKey.openai).toBeUndefined();
    });
  });

  describe('Audio Transcription', () => {
    test('should transcribe audio with default options', async () => {
      const mockFile = {
        path: '/test/audio.mp3',
        size: 1024 * 1024 // 1MB
      };
      
      fs.stat = jest.fn().mockResolvedValue({ size: mockFile.size });
      fs.createReadStream = jest.fn().mockReturnValue('mock-stream');
      
      mockOpenAI.audio.transcriptions.create.mockResolvedValueOnce({
        text: 'Hello, this is a test transcription',
        segments: [{
          start: 0,
          end: 2.5,
          text: 'Hello, this is a test transcription'
        }]
      });
      
      const result = await voiceService.transcribeAudio(mockFile);
      
      expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
      expect(result.text).toBe('Hello, this is a test transcription');
    });

    test('should validate file format', async () => {
      const mockFile = {
        path: '/test/audio.xyz',
        size: 1024
      };
      
      await expect(
        voiceService.transcribeAudio(mockFile)
      ).rejects.toThrow('Unsupported audio format');
    });

    test('should validate file size', async () => {
      const mockFile = {
        path: '/test/audio.mp3',
        size: 30 * 1024 * 1024 // 30MB - exceeds limit
      };
      
      fs.stat = jest.fn().mockResolvedValue({ size: mockFile.size });
      
      await expect(
        voiceService.transcribeAudio(mockFile)
      ).rejects.toThrow('File size exceeds maximum limit');
    });

    test('should handle transcription with custom options', async () => {
      const mockFile = {
        path: '/test/audio.wav',
        size: 1024
      };
      
      const options = {
        language: 'es',
        temperature: 0.2,
        speaker_detection: true,
        custom_vocabulary: ['AI', 'Susan']
      };
      
      fs.stat = jest.fn().mockResolvedValue({ size: mockFile.size });
      fs.createReadStream = jest.fn().mockReturnValue('mock-stream');
      
      mockOpenAI.audio.transcriptions.create.mockResolvedValueOnce({
        text: 'Hola, esto es una transcripción de prueba'
      });
      
      const result = await voiceService.transcribeAudio(mockFile, options);
      
      expect(result).toBeDefined();
      expect(result.language).toBe('es');
    });
  });

  describe('Text-to-Speech', () => {
    test('should synthesize speech with default options', async () => {
      const mockAudioBuffer = new ArrayBuffer(1024);
      
      mockOpenAI.audio.speech.create.mockResolvedValueOnce({
        arrayBuffer: jest.fn().mockResolvedValue(mockAudioBuffer)
      });
      
      const result = await voiceService.synthesizeSpeech('Hello world');
      
      expect(mockOpenAI.audio.speech.create).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
      expect(result.audioBuffer).toBe(mockAudioBuffer);
    });

    test('should validate text input', async () => {
      await expect(
        voiceService.synthesizeSpeech('')
      ).rejects.toThrow('Text input cannot be empty');
      
      const longText = 'A'.repeat(5000); // Exceeds typical limits
      await expect(
        voiceService.synthesizeSpeech(longText)
      ).rejects.toThrow('Text input too long');
    });

    test('should use custom voice and settings', async () => {
      const mockAudioBuffer = new ArrayBuffer(2048);
      
      mockOpenAI.audio.speech.create.mockResolvedValueOnce({
        arrayBuffer: jest.fn().mockResolvedValue(mockAudioBuffer)
      });
      
      const options = {
        voice: 'nova',
        speed: 1.2,
        format: 'mp3'
      };
      
      const result = await voiceService.synthesizeSpeech('Test speech', options);
      
      expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: 'nova',
          speed: 1.2,
          response_format: 'mp3'
        })
      );
      expect(result.audioBuffer).toBe(mockAudioBuffer);
    });
  });

  describe('Voice Profiles', () => {
    test('should create voice profile', () => {
      const profileData = {
        userId: 'user-123',
        voicePreference: 'alloy',
        speechRate: 1.1,
        pitch: 0.9
      };
      
      const profile = voiceService.createVoiceProfile(profileData);
      
      expect(profile).toBeDefined();
      expect(profile.id).toBeDefined();
      expect(voiceService.voiceProfiles.has(profile.id)).toBe(true);
    });

    test('should get voice profile', () => {
      const profileData = {
        userId: 'user-123',
        voicePreference: 'echo'
      };
      
      const created = voiceService.createVoiceProfile(profileData);
      const retrieved = voiceService.getVoiceProfile(created.id);
      
      expect(retrieved).toEqual(created);
    });

    test('should update voice profile', () => {
      const profileData = {
        userId: 'user-123',
        voicePreference: 'alloy'
      };
      
      const created = voiceService.createVoiceProfile(profileData);
      const updates = { voicePreference: 'nova', pitch: 1.2 };
      
      const updated = voiceService.updateVoiceProfile(created.id, updates);
      
      expect(updated.voicePreference).toBe('nova');
      expect(updated.pitch).toBe(1.2);
    });
  });

  describe('Batch Processing', () => {
    test('should create batch transcription job', () => {
      const files = [
        { path: '/test/audio1.mp3', size: 1024 },
        { path: '/test/audio2.mp3', size: 2048 }
      ];
      
      const jobId = voiceService.createBatchJob(files, {
        operation: 'transcription',
        language: 'en'
      });
      
      expect(jobId).toBeDefined();
      expect(voiceService.batchJobs.has(jobId)).toBe(true);
    });

    test('should get batch job status', () => {
      const files = [{ path: '/test/audio.mp3', size: 1024 }];
      const jobId = voiceService.createBatchJob(files, { operation: 'transcription' });
      
      const status = voiceService.getBatchJobStatus(jobId);
      
      expect(status).toBeDefined();
      expect(status.id).toBe(jobId);
      expect(status.status).toBe('pending');
    });
  });

  describe('Error Handling', () => {
    test('should handle OpenAI API errors', async () => {
      const mockFile = {
        path: '/test/audio.mp3',
        size: 1024
      };
      
      fs.stat = jest.fn().mockResolvedValue({ size: mockFile.size });
      fs.createReadStream = jest.fn().mockReturnValue('mock-stream');
      
      mockOpenAI.audio.transcriptions.create.mockRejectedValueOnce(
        new Error('OpenAI API Error')
      );
      
      await expect(
        voiceService.transcribeAudio(mockFile)
      ).rejects.toThrow('OpenAI API Error');
    });

    test('should handle file system errors', async () => {
      const mockFile = {
        path: '/nonexistent/audio.mp3'
      };
      
      fs.stat = jest.fn().mockRejectedValueOnce(
        new Error('File not found')
      );
      
      await expect(
        voiceService.transcribeAudio(mockFile)
      ).rejects.toThrow('File not found');
    });
  });

  describe('Event Emission', () => {
    test('should emit transcription events', async () => {
      const mockFile = {
        path: '/test/audio.mp3',
        size: 1024
      };
      
      fs.stat = jest.fn().mockResolvedValue({ size: mockFile.size });
      fs.createReadStream = jest.fn().mockReturnValue('mock-stream');
      
      const startSpy = jest.fn();
      const completeSpy = jest.fn();
      
      voiceService.on('transcription:start', startSpy);
      voiceService.on('transcription:complete', completeSpy);
      
      mockOpenAI.audio.transcriptions.create.mockResolvedValueOnce({
        text: 'Test transcription'
      });
      
      await voiceService.transcribeAudio(mockFile);
      
      expect(startSpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    });
  });
});
