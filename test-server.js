/**
 * Minimal test server for photo analysis testing
 */

import express from 'express';
import simpleQwenService from './src/api/services/SimpleQwenVLService.js';

const app = express();
const PORT = 3004;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS for testing
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// Health check endpoint
app.get('/api/photo-analysis/analyze-photo/health', async (req, res) => {
  try {
    console.log('🏥 Health check requested');
    
    const qwenHealth = await simpleQwenService.isAvailable();
    
    res.json({
      status: 'ready',
      service: 'Test Photo Analysis Server',
      primary: {
        engine: 'Qwen2.5-VL',
        status: qwenHealth.available ? 'available' : 'unavailable',
        model: qwenHealth.modelName,
        device: qwenHealth.device,
        parameters: qwenHealth.parameters
      },
      fallback: {
        engine: 'None (test mode)',
        status: 'unavailable'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Photo analysis endpoint
app.post('/api/photo-analysis/analyze-photo', async (req, res) => {
  try {
    console.log('🖼️  Photo analysis requested');
    
    const { image, filename } = req.body;
    
    if (!image) {
      return res.status(400).json({
        error: 'No image data provided',
        damageType: 'Error: No image',
        severity: 'Unknown',
        confidence: 0,
        description: 'Please provide image data for analysis.'
      });
    }

    const startTime = Date.now();
    
    // Use Simple Qwen VL Service
    console.log(`🔍 Analyzing image: ${filename || 'unknown'} with Qwen2.5-VL...`);
    
    const result = await simpleQwenService.analyzeRoofingImage(image, filename);
    
    // Add metadata
    const totalTime = (Date.now() - startTime) / 1000;
    result.analysisMethod = 'Qwen2.5-VL (Test Server)';
    result.totalProcessingTime = totalTime;
    result.timestamp = new Date().toISOString();

    console.log(`✅ Analysis completed: ${result.damageType} (${result.confidence}% confidence)`);
    
    res.json(result);

  } catch (error) {
    console.error('Photo analysis error:', error);
    
    const totalTime = (Date.now() - Date.now()) / 1000;
    
    res.status(500).json({
      damageType: 'Analysis system failure',
      severity: 'Unknown',
      confidence: 0,
      description: `Analysis failure: ${error.message}`,
      findings: 'System error',
      recommendation: 'Please try again or contact support',
      error: error.message,
      analysisMethod: 'error',
      totalProcessingTime: totalTime,
      timestamp: new Date().toISOString(),
      filename: req.body.filename || 'unknown'
    });
  }
});

// Chat endpoint for testing
app.post('/api/photo-analysis/chat', async (req, res) => {
  const { message } = req.body;
  
  res.json({
    response: "Hi! I'm Susan AI Test Server. I can analyze roofing photos using Qwen 2.5 VL.",
    model: 'test-server',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Test Photo Analysis Server running on port ${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/api/photo-analysis/analyze-photo/health`);
  console.log(`📸 Analysis: http://localhost:${PORT}/api/photo-analysis/analyze-photo`);
  console.log(`🤖 Simple QwenVL Service initialized`);
});

process.on('SIGINT', () => {
  console.log('\n👋 Test server shutting down...');
  process.exit(0);
});