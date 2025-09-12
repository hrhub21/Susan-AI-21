import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import multer from 'multer';
import fs from 'fs-extra';
import path from 'path';
import { VoiceController } from '../../../src/api/controllers/VoiceController.js';
import { VoiceService } from '../../../src/api/services/VoiceService.js';
import { testDataGenerators, mockVoiceData } from '../../utils/mocks.js';

describe('Voice API Integration Tests', () => {
  let app;
  let server;
  let testUser;
  let authToken;
  let tempDir;
  
  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    
    // Create temporary directory for test files
    tempDir = path.join(process.cwd(), 'tests', 'temp');
    await fs.ensureDir(tempDir);
    
    // Create test Express app
    app = express();
    app.use(express.json());
    
    // Set up multer for file uploads
    const upload = multer({ dest: tempDir });
    
    // Mock authentication middleware
    app.use((req, res, next) => {
      req.user = testUser;
      next();
    });
    
    // Set up voice routes
    const voiceController = new VoiceController();
    app.post('/api/v1/voice/transcribe', upload.single('audio'), voiceController.transcribeAudio.bind(voiceController));
    app.post('/api/v1/voice/synthesize', voiceController.synthesizeSpeech.bind(voiceController));
    app.get('/api/v1/voice/voices', voiceController.getAvailableVoices.bind(voiceController));
    app.post('/api/v1/voice/batch-transcribe', upload.array('audio'), voiceController.batchTranscribe.bind(voiceController));
    app.get('/api/v1/voice/batch/:jobId', voiceController.getBatchJobStatus.bind(voiceController));
    app.post('/api/v1/voice/profiles', voiceController.createVoiceProfile.bind(voiceController));
    app.get('/api/v1/voice/profiles/:profileId', voiceController.getVoiceProfile.bind(voiceController));
    app.put('/api/v1/voice/profiles/:profileId', voiceController.updateVoiceProfile.bind(voiceController));
    
    // Start test server
    server = app.listen(0);
  });
  
  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    
    // Clean up temporary directory
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });
  
  beforeEach(() => {
    testUser = testDataGenerators.user();
    authToken = 'test-jwt-token';
  });
  
  afterEach(async () => {
    await global.testHelpers.cleanupTestData();
  });

  describe('POST /api/v1/voice/transcribe', () => {
    let testAudioFile;
    
    beforeEach(async () => {
      // Create a mock audio file for testing
      testAudioFile = path.join(tempDir, 'test-audio.mp3');
      await fs.writeFile(testAudioFile, Buffer.from('mock audio data'));
    });
    
    afterEach(async () => {
      if (await fs.pathExists(testAudioFile)) {
        await fs.remove(testAudioFile);
      }
    });

    test('should transcribe audio file successfully', async () => {
      const response = await request(app)
        .post('/api/v1/voice/transcribe')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', testAudioFile)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.transcription).toBeDefined();
      expect(response.body.data.transcription.text).toBeTruthy();
      expect(response.body.data.transcription.confidence).toBeGreaterThan(0);
    });

    test('should handle transcription with custom options', async () => {
      const response = await request(app)
        .post('/api/v1/voice/transcribe')
        .set('Authorization', `Bearer ${authToken}`)
        .field('language', 'es')
        .field('temperature', '0.2')
        .field('speaker_detection', 'true')
        .attach('audio', testAudioFile)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.transcription.language).toBe('es');
      expect(response.body.data.transcription.segments).toBeDefined();
    });

    test('should validate audio file format', async () => {
      const invalidFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(invalidFile, 'not an audio file');
      
      const response = await request(app)
        .post('/api/v1/voice/transcribe')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', invalidFile)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('format');
      
      await fs.remove(invalidFile);
    });

    test('should validate file size limits', async () => {
      const largeFile = path.join(tempDir, 'large-audio.mp3');
      const largeBuffer = Buffer.alloc(30 * 1024 * 1024); // 30MB
      await fs.writeFile(largeFile, largeBuffer);
      
      const response = await request(app)
        .post('/api/v1/voice/transcribe')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', largeFile)
        .expect(413);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('size');
      
      await fs.remove(largeFile);
    });

    test('should require audio file', async () => {
      const response = await request(app)
        .post('/api/v1/voice/transcribe')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('audio file required');
    });
  });

  describe('POST /api/v1/voice/synthesize', () => {
    test('should synthesize speech from text', async () => {
      const requestData = {
        text: 'Hello, this is a test of text-to-speech functionality.',
        voice: 'alloy',
        speed: 1.0,
        format: 'mp3'
      };
      
      const response = await request(app)
        .post('/api/v1/voice/synthesize')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.audioUrl).toBeDefined();
      expect(response.body.data.audioBuffer).toBeDefined();
      expect(response.body.data.metadata.voice).toBe('alloy');
      expect(response.body.data.metadata.duration).toBeGreaterThan(0);
    });

    test('should validate text input', async () => {
      const requestData = {
        text: '',
        voice: 'alloy'
      };
      
      const response = await request(app)
        .post('/api/v1/voice/synthesize')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('text');
    });

    test('should validate voice selection', async () => {
      const requestData = {
        text: 'Hello world',
        voice: 'invalid-voice'
      };
      
      const response = await request(app)
        .post('/api/v1/voice/synthesize')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('voice');
    });

    test('should handle long text with chunking', async () => {
      const longText = 'This is a very long text that exceeds normal limits. '.repeat(100);
      
      const requestData = {
        text: longText,
        voice: 'nova'
      };
      
      const response = await request(app)
        .post('/api/v1/voice/synthesize')
        .set('Authorization', `Bearer ${authToken}`)
        .send(requestData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.chunks).toBeDefined();
      expect(response.body.data.chunks.length).toBeGreaterThan(1);
    });
  });

  describe('GET /api/v1/voice/voices', () => {
    test('should return available voices', async () => {
      const response = await request(app)
        .get('/api/v1/voice/voices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.voices).toBeDefined();
      expect(Array.isArray(response.body.data.voices)).toBe(true);
      expect(response.body.data.voices.length).toBeGreaterThan(0);
      
      const voice = response.body.data.voices[0];
      expect(voice.id).toBeDefined();
      expect(voice.name).toBeDefined();
      expect(voice.language).toBeDefined();
    });

    test('should filter voices by language', async () => {
      const response = await request(app)
        .get('/api/v1/voice/voices?language=en')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.voices.every(voice => voice.language === 'en')).toBe(true);
    });
  });

  describe('POST /api/v1/voice/batch-transcribe', () => {
    let testAudioFiles;
    
    beforeEach(async () => {
      testAudioFiles = [];
      for (let i = 0; i < 3; i++) {
        const filePath = path.join(tempDir, `test-audio-${i}.mp3`);
        await fs.writeFile(filePath, Buffer.from(`mock audio data ${i}`));
        testAudioFiles.push(filePath);
      }
    });
    
    afterEach(async () => {
      for (const file of testAudioFiles) {
        if (await fs.pathExists(file)) {
          await fs.remove(file);
        }
      }
    });

    test('should create batch transcription job', async () => {
      const request_obj = request(app)
        .post('/api/v1/voice/batch-transcribe')
        .set('Authorization', `Bearer ${authToken}`);
      
      for (const file of testAudioFiles) {
        request_obj.attach('audio', file);
      }
      
      const response = await request_obj.expect(202);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBeDefined();
      expect(response.body.data.status).toBe('queued');
      expect(response.body.data.fileCount).toBe(3);
    });

    test('should validate batch size limits', async () => {
      const manyFiles = [];
      
      // Create more files than allowed
      for (let i = 0; i < 50; i++) {
        const filePath = path.join(tempDir, `test-audio-batch-${i}.mp3`);
        await fs.writeFile(filePath, Buffer.from(`mock audio data ${i}`));
        manyFiles.push(filePath);
      }
      
      const request_obj = request(app)
        .post('/api/v1/voice/batch-transcribe')
        .set('Authorization', `Bearer ${authToken}`);
      
      for (const file of manyFiles.slice(0, 30)) { // Add 30 files
        request_obj.attach('audio', file);
      }
      
      const response = await request_obj.expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('batch size');
      
      // Clean up
      for (const file of manyFiles) {
        await fs.remove(file);
      }
    });
  });

  describe('GET /api/v1/voice/batch/:jobId', () => {
    let batchJobId;
    
    beforeEach(async () => {
      // Create a batch job first
      const testFile = path.join(tempDir, 'batch-test-audio.mp3');
      await fs.writeFile(testFile, Buffer.from('mock audio data'));
      
      const createResponse = await request(app)
        .post('/api/v1/voice/batch-transcribe')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('audio', testFile);
      
      batchJobId = createResponse.body.data.jobId;
      
      await fs.remove(testFile);
    });

    test('should get batch job status', async () => {
      const response = await request(app)
        .get(`/api/v1/voice/batch/${batchJobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBe(batchJobId);
      expect(response.body.data.status).toBeDefined();
      expect(response.body.data.progress).toBeDefined();
    });

    test('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/v1/voice/batch/non-existent-job')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('not found');
    });
  });

  describe('Voice Profiles', () => {
    describe('POST /api/v1/voice/profiles', () => {
      test('should create voice profile', async () => {
        const profileData = {
          name: 'My Voice Profile',
          voicePreference: 'alloy',
          speechRate: 1.1,
          pitch: 0.9,
          settings: {
            autoDetectLanguage: true,
            noiseReduction: true
          }
        };
        
        const response = await request(app)
          .post('/api/v1/voice/profiles')
          .set('Authorization', `Bearer ${authToken}`)
          .send(profileData)
          .expect(201);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.profile.id).toBeDefined();
        expect(response.body.data.profile.name).toBe(profileData.name);
        expect(response.body.data.profile.userId).toBe(testUser.id);
      });

      test('should validate profile data', async () => {
        const invalidProfileData = {
          // Missing required fields
          speechRate: 2.5 // Invalid rate
        };
        
        const response = await request(app)
          .post('/api/v1/voice/profiles')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidProfileData)
          .expect(400);
        
        expect(response.body.success).toBe(false);
        expect(response.body.error.validationErrors).toBeDefined();
      });
    });

    describe('GET /api/v1/voice/profiles/:profileId', () => {
      let testProfile;
      
      beforeEach(async () => {
        const createResponse = await request(app)
          .post('/api/v1/voice/profiles')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test Profile',
            voicePreference: 'echo'
          });
        
        testProfile = createResponse.body.data.profile;
      });

      test('should get voice profile', async () => {
        const response = await request(app)
          .get(`/api/v1/voice/profiles/${testProfile.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(testProfile.id);
        expect(response.body.data.name).toBe(testProfile.name);
      });

      test('should not allow access to other users profiles', async () => {
        // Change user context
        testUser = testDataGenerators.user({ id: 'different-user' });
        
        const response = await request(app)
          .get(`/api/v1/voice/profiles/${testProfile.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);
        
        expect(response.body.success).toBe(false);
        expect(response.body.error.message).toContain('access denied');
      });
    });

    describe('PUT /api/v1/voice/profiles/:profileId', () => {
      let testProfile;
      
      beforeEach(async () => {
        const createResponse = await request(app)
          .post('/api/v1/voice/profiles')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test Profile',
            voicePreference: 'alloy'
          });
        
        testProfile = createResponse.body.data.profile;
      });

      test('should update voice profile', async () => {
        const updateData = {
          name: 'Updated Profile',
          voicePreference: 'nova',
          speechRate: 1.2
        };
        
        const response = await request(app)
          .put(`/api/v1/voice/profiles/${testProfile.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Updated Profile');
        expect(response.body.data.voicePreference).toBe('nova');
        expect(response.body.data.speechRate).toBe(1.2);
      });
    });
  });

  describe('Real-time Voice Processing', () => {
    test('should handle streaming audio transcription', async () => {
      // This would test WebSocket-based streaming transcription
      // Implementation depends on your WebSocket setup
      const streamingEndpoint = '/api/v1/voice/stream-transcribe';
      
      // Mock WebSocket connection for streaming
      const response = await request(app)
        .post(streamingEndpoint)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ streamId: 'test-stream-123' })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.streamId).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle OpenAI API errors', async () => {
      // Simulate API error by using invalid API key
      process.env.OPENAI_API_KEY = 'invalid-key';
      
      const response = await request(app)
        .post('/api/v1/voice/synthesize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ text: 'Test text', voice: 'alloy' })
        .expect(500);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('API');
      
      // Restore valid key
      process.env.OPENAI_API_KEY = 'test-openai-key';
    });

    test('should handle file system errors', async () => {
      // Create a file in a non-existent directory to trigger error
      const invalidPath = '/non-existent-directory/audio.mp3';
      
      const response = await request(app)
        .post('/api/v1/voice/transcribe')
        .set('Authorization', `Bearer ${authToken}`)
        .field('filePath', invalidPath)
        .expect(500);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('file');
    });
  });

  describe('Performance', () => {
    test('should handle concurrent transcription requests', async () => {
      const testFile = path.join(tempDir, 'concurrent-test.mp3');
      await fs.writeFile(testFile, Buffer.from('mock audio data'));
      
      const requests = [];
      const concurrentCount = 5;
      
      for (let i = 0; i < concurrentCount; i++) {
        requests.push(
          request(app)
            .post('/api/v1/voice/transcribe')
            .set('Authorization', `Bearer ${authToken}`)
            .attach('audio', testFile)
        );
      }
      
      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      
      expect(responses.every(res => res.status === 200)).toBe(true);
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds
      
      await fs.remove(testFile);
    });
  });
});
