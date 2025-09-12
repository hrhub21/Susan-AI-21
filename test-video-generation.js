#!/usr/bin/env node

/**
 * Quick Test Script for Video Generation Service
 * 
 * This script provides a quick way to test the video generation
 * functionality without running the full demo.
 */

import { VideoGenerationService } from './src/api/services/VideoGenerationService.js';

async function quickTest() {
  console.log('🎬 Testing Video Generation Service...\n');

  try {
    // Initialize service
    console.log('📋 Initializing service...');
    const videoService = new VideoGenerationService();
    await videoService.initialize();
    console.log('✅ Service initialized\n');

    // Test 1: Check templates
    console.log('📝 Testing template system...');
    const templates = videoService.getAllTemplates();
    console.log(`✅ Found ${templates.size} templates:`);
    templates.forEach(template => {
      console.log(`   • ${template.name} (${template.duration}s)`);
    });
    console.log();

    // Test 2: Create mock data
    console.log('📸 Creating mock test data...');
    const mockPhotos = [
      {
        buffer: Buffer.from('Mock photo 1 data'),
        originalname: 'test1.jpg',
        mimetype: 'image/jpeg',
        size: 1024
      },
      {
        buffer: Buffer.from('Mock photo 2 data'),
        originalname: 'test2.jpg',
        mimetype: 'image/jpeg',
        size: 2048
      }
    ];

    const claimData = {
      propertyAddress: '123 Test Street, Test City, TX 12345',
      claimNumber: 'TEST-001',
      dateOfLoss: new Date().toISOString(),
      policyNumber: 'TEST-POL-123'
    };

    console.log('✅ Mock data created\n');

    // Test 3: Validate inputs
    console.log('🔍 Testing input validation...');
    await videoService.validateVideoInputs(mockPhotos, claimData, {});
    console.log('✅ Input validation passed\n');

    // Test 4: Test utility methods
    console.log('🛠️ Testing utility methods...');
    
    // Test damage type extraction (with mock analysis)
    const mockAnalysis = [
      {
        damageAnalysis: {
          damage: {
            hail: { detected: true, impactCount: 5 },
            wind: { detected: true, liftedShingles: 3 },
            granuleLoss: { detected: false }
          }
        }
      }
    ];

    const damageTypes = videoService.extractDamageTypes(mockAnalysis);
    console.log('✅ Damage types extracted:', damageTypes.map(d => `${d.type}: ${d.count}`));

    const severityLevel = videoService.calculateSeverityLevel(mockAnalysis);
    console.log('✅ Severity level calculated:', severityLevel);

    const confidence = videoService.calculateOverallConfidence(mockAnalysis);
    console.log('✅ Confidence calculated:', Math.round(confidence * 100) + '%');

    console.log();

    // Test 5: ID generation
    console.log('🔢 Testing ID generation...');
    const videoId = videoService.generateVideoId();
    console.log('✅ Video ID generated:', videoId);
    console.log();

    // Test 6: Status tracking
    console.log('📊 Testing status tracking...');
    const activeVideos = videoService.getActiveVideos();
    console.log('✅ Active videos count:', activeVideos.length);
    console.log();

    console.log('🎉 All tests passed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Service initialization');
    console.log('   ✅ Template system');
    console.log('   ✅ Mock data creation');
    console.log('   ✅ Input validation');
    console.log('   ✅ Utility methods');
    console.log('   ✅ ID generation');
    console.log('   ✅ Status tracking');

    console.log('\n🚀 Ready for video generation!');
    console.log('   Run "npm run demo:video" for full demo');
    console.log('   Use API endpoints for production usage');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
quickTest();