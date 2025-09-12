#!/usr/bin/env node

/**
 * Susan AI Video Generation Service Demo
 * 
 * This demo showcases the comprehensive video generation capabilities
 * for insurance claim explanations and damage analysis reports.
 */

import { VideoGenerationService } from './src/api/services/VideoGenerationService.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorLog(color, ...args) {
  console.log(color + args.join(' ') + colors.reset);
}

class VideoGenerationDemo {
  constructor() {
    this.videoService = new VideoGenerationService();
  }

  async runDemo() {
    try {
      colorLog(colors.cyan + colors.bright, '🎬 Susan AI Video Generation Service Demo');
      colorLog(colors.blue, '=' * 60);
      
      console.log('\nThis demo showcases the comprehensive video generation capabilities');
      console.log('for creating dynamic insurance claim explanations and damage analysis reports.\n');

      // Initialize the service
      colorLog(colors.yellow, '📋 Initializing Video Generation Service...');
      await this.videoService.initialize();
      colorLog(colors.green, '✅ Service initialized successfully\n');

      // Demo 1: Show available templates
      await this.showTemplates();

      // Demo 2: Create mock photos for testing
      await this.createMockPhotos();

      // Demo 3: Generate comprehensive claim video
      await this.generateComprehensiveClaimVideo();

      // Demo 4: Generate quick damage assessment
      await this.generateQuickDamageVideo();

      // Demo 5: Show interactive elements
      await this.showInteractiveElements();

      // Demo 6: Export multiple formats
      await this.showMultiFormatExport();

      colorLog(colors.green + colors.bright, '\n🎉 Video Generation Demo Completed Successfully!');
      colorLog(colors.blue, '=' * 60);

    } catch (error) {
      colorLog(colors.red, '❌ Demo Error:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
    }
  }

  async showTemplates() {
    colorLog(colors.magenta + colors.bright, '\n📝 Available Video Templates:');
    colorLog(colors.blue, '-' * 40);

    const templates = this.videoService.getAllTemplates();
    
    templates.forEach((template, index) => {
      console.log(`\n${index + 1}. ${colors.bright}${template.name}${colors.reset}`);
      console.log(`   ID: ${template.id}`);
      console.log(`   Duration: ${template.duration} seconds`);
      console.log(`   Description: ${template.description}`);
      console.log(`   Sections: ${template.sections.length}`);
      
      template.sections.forEach((section, i) => {
        console.log(`     ${i + 1}. ${section.type} (${section.duration}s)`);
      });
    });
  }

  async createMockPhotos() {
    colorLog(colors.magenta + colors.bright, '\n📸 Creating Mock Damage Photos:');
    colorLog(colors.blue, '-' * 40);

    const mockPhotosDir = path.join(__dirname, 'demo_photos');
    await fs.ensureDir(mockPhotosDir);

    // Create mock photo data
    this.mockPhotos = [
      {
        filename: 'roof_overview.jpg',
        description: 'Overall roof view showing multiple damage areas',
        damageType: 'hail',
        severity: 'moderate'
      },
      {
        filename: 'hail_impacts_close.jpg',
        description: 'Close-up view of hail impacts on shingles',
        damageType: 'hail',
        severity: 'severe'
      },
      {
        filename: 'wind_damage_edge.jpg',
        description: 'Wind damage along roof edge with lifted shingles',
        damageType: 'wind',
        severity: 'moderate'
      },
      {
        filename: 'granule_loss_area.jpg',
        description: 'Area showing significant granule loss',
        damageType: 'granule',
        severity: 'moderate'
      },
      {
        filename: 'gutter_damage.jpg',
        description: 'Damaged gutters and downspouts',
        damageType: 'collateral',
        severity: 'mild'
      }
    ];

    // Create mock photo buffers (in real implementation, these would be actual photos)
    this.mockPhotoBuffers = [];
    
    for (const photo of this.mockPhotos) {
      console.log(`   📸 Creating mock photo: ${photo.filename}`);
      
      // Create a simple colored rectangle as mock photo data
      const mockBuffer = Buffer.from('Mock photo data for ' + photo.filename);
      
      this.mockPhotoBuffers.push({
        buffer: mockBuffer,
        originalname: photo.filename,
        mimetype: 'image/jpeg',
        size: mockBuffer.length,
        description: photo.description,
        damageType: photo.damageType,
        severity: photo.severity
      });
    }

    colorLog(colors.green, `✅ Created ${this.mockPhotos.length} mock photos`);
  }

  async generateComprehensiveClaimVideo() {
    colorLog(colors.magenta + colors.bright, '\n🎬 Generating Comprehensive Claim Video:');
    colorLog(colors.blue, '-' * 50);

    const claimData = {
      propertyAddress: '123 Maple Street, Austin, TX 78701',
      claimNumber: 'DEMO-2024-001',
      dateOfLoss: '2024-01-15',
      policyNumber: 'POL-123456789',
      insured: {
        name: 'John and Mary Smith',
        phone: '(555) 123-4567',
        email: 'smith@example.com'
      },
      adjuster: {
        name: 'Sarah Johnson',
        company: 'ABC Insurance',
        phone: '(555) 987-6543'
      },
      stormEvent: {
        date: '2024-01-15',
        type: 'Hailstorm',
        windSpeed: '65 mph',
        hailSize: '1.5 inches'
      }
    };

    const personalization = {
      adjusterName: 'Sarah Johnson',
      companyName: 'ABC Insurance',
      contractorName: 'Susan AI Systems',
      reportingPerson: 'Dr. Susan Miller, AI Damage Analyst'
    };

    const voiceSettings = {
      voice: 'alloy',
      speed: 1.0,
      emotion: 'professional',
      style: 'natural'
    };

    const options = {
      templateId: 'comprehensive_report',
      personalization,
      outputFormat: 'mp4',
      quality: 'high',
      includeNarration: true,
      voiceSettings,
      userId: 'demo_user'
    };

    console.log('📋 Claim Details:');
    console.log(`   Property: ${claimData.propertyAddress}`);
    console.log(`   Claim #: ${claimData.claimNumber}`);
    console.log(`   Storm Date: ${claimData.dateOfLoss}`);
    console.log(`   Adjuster: ${claimData.adjuster.name}`);

    console.log('\n🎬 Video Configuration:');
    console.log(`   Template: ${options.templateId}`);
    console.log(`   Format: ${options.outputFormat}`);
    console.log(`   Quality: ${options.quality}`);
    console.log(`   Narration: ${options.includeNarration ? 'Enabled' : 'Disabled'}`);
    console.log(`   Voice: ${voiceSettings.voice}`);

    try {
      colorLog(colors.yellow, '\n⚙️ Starting video generation...');
      
      // Note: In a real implementation, this would generate an actual video
      // For demo purposes, we'll simulate the process
      const simulatedResult = await this.simulateVideoGeneration(
        this.mockPhotoBuffers,
        claimData,
        options
      );

      colorLog(colors.green, '✅ Comprehensive claim video generated successfully!');
      console.log('\n📊 Generation Results:');
      console.log(`   Video ID: ${simulatedResult.videoId}`);
      console.log(`   Duration: ${simulatedResult.video.duration} seconds`);
      console.log(`   File Size: ${(simulatedResult.video.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Processing Time: ${simulatedResult.metadata.generationTime} ms`);
      console.log(`   Photos Analyzed: ${simulatedResult.analysis.photosAnalyzed}`);
      console.log(`   Damage Types Found: ${simulatedResult.analysis.damageTypes.join(', ')}`);
      console.log(`   AI Confidence: ${Math.round(simulatedResult.analysis.confidenceScore * 100)}%`);

      console.log('\n🎯 Interactive Elements:');
      console.log(`   Hotspots: ${simulatedResult.interactive.hotspots.length}`);
      console.log(`   Chapters: ${simulatedResult.interactive.chapters.length}`);
      console.log(`   Annotations: ${simulatedResult.interactive.annotations.length}`);

      this.comprehensiveVideoResult = simulatedResult;

    } catch (error) {
      colorLog(colors.red, '❌ Error generating comprehensive video:', error.message);
    }
  }

  async generateQuickDamageVideo() {
    colorLog(colors.magenta + colors.bright, '\n⚡ Generating Quick Damage Assessment Video:');
    colorLog(colors.blue, '-' * 55);

    const quickClaimData = {
      propertyAddress: '456 Oak Avenue, Dallas, TX 75201',
      claimNumber: 'QUICK-2024-002',
      dateOfLoss: '2024-01-20',
      damageType: 'hail'
    };

    const quickPersonalization = {
      adjusterName: 'Mike Wilson'
    };

    const quickOptions = {
      templateId: 'hail_damage_explanation',
      personalization: quickPersonalization,
      outputFormat: 'mp4',
      quality: 'medium',
      includeNarration: true,
      userId: 'demo_user'
    };

    // Use first 3 photos for quick assessment
    const quickPhotos = this.mockPhotoBuffers.slice(0, 3);

    console.log('📋 Quick Assessment Details:');
    console.log(`   Property: ${quickClaimData.propertyAddress}`);
    console.log(`   Damage Type: ${quickClaimData.damageType}`);
    console.log(`   Photos: ${quickPhotos.length}`);
    console.log(`   Template: ${quickOptions.templateId}`);

    try {
      colorLog(colors.yellow, '\n⚙️ Starting quick video generation...');
      
      const quickResult = await this.simulateVideoGeneration(
        quickPhotos,
        quickClaimData,
        quickOptions
      );

      colorLog(colors.green, '✅ Quick damage video generated successfully!');
      console.log('\n📊 Quick Generation Results:');
      console.log(`   Video ID: ${quickResult.videoId}`);
      console.log(`   Duration: ${quickResult.video.duration} seconds`);
      console.log(`   Processing Time: ${quickResult.metadata.generationTime} ms`);
      console.log(`   File Size: ${(quickResult.video.size / 1024 / 1024).toFixed(2)} MB`);

    } catch (error) {
      colorLog(colors.red, '❌ Error generating quick video:', error.message);
    }
  }

  async showInteractiveElements() {
    if (!this.comprehensiveVideoResult) {
      colorLog(colors.yellow, '\n⚠️ Skipping interactive elements demo - no comprehensive video available');
      return;
    }

    colorLog(colors.magenta + colors.bright, '\n🎯 Interactive Video Elements:');
    colorLog(colors.blue, '-' * 40);

    const interactive = this.comprehensiveVideoResult.interactive;

    console.log('\n📍 Clickable Hotspots:');
    interactive.hotspots.forEach((hotspot, index) => {
      console.log(`   ${index + 1}. ${hotspot.description}`);
      console.log(`      Position: (${hotspot.x}, ${hotspot.y})`);
      console.log(`      Type: ${hotspot.type}`);
      console.log(`      Severity: ${hotspot.severity}`);
      console.log(`      Timestamp: ${hotspot.timestamp}s`);
    });

    console.log('\n📑 Chapter Markers:');
    interactive.chapters.forEach((chapter, index) => {
      console.log(`   ${index + 1}. ${chapter.title}`);
      console.log(`      Time: ${chapter.startTime}s - ${chapter.startTime + chapter.duration}s`);
      console.log(`      Description: ${chapter.description}`);
    });

    console.log('\n📝 Text Annotations:');
    interactive.annotations.forEach((annotation, index) => {
      console.log(`   ${index + 1}. [${annotation.timestamp}s] ${annotation.text}`);
      console.log(`      Type: ${annotation.type}`);
      console.log(`      Importance: ${annotation.importance}`);
    });

    console.log('\n🎮 Interactive Features:');
    console.log('   • Click on damage markers to see detailed analysis');
    console.log('   • Jump to specific sections using chapter navigation');
    console.log('   • View contextual annotations at key moments');
    console.log('   • Toggle between normal and heat map views');
    console.log('   • Export timestamped damage reports');
  }

  async showMultiFormatExport() {
    if (!this.comprehensiveVideoResult) {
      colorLog(colors.yellow, '\n⚠️ Skipping multi-format export demo - no video available');
      return;
    }

    colorLog(colors.magenta + colors.bright, '\n📤 Multi-Format Export Options:');
    colorLog(colors.blue, '-' * 40);

    const exports = this.comprehensiveVideoResult.exports;

    console.log('\n🎞️ Available Formats:');
    exports.forEach((exportFormat, index) => {
      console.log(`   ${index + 1}. ${exportFormat.format.toUpperCase()}`);
      console.log(`      Quality: ${exportFormat.quality}`);
      console.log(`      Size: ${(exportFormat.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`      URL: ${exportFormat.url}`);
    });

    console.log('\n📱 Optimized Delivery:');
    console.log('   • MP4: Best for general viewing and sharing');
    console.log('   • WebM: Optimized for web browsers and streaming');
    console.log('   • AVI: High quality for professional analysis');

    console.log('\n☁️ Cloud Integration:');
    console.log('   • Automatic upload to cloud storage');
    console.log('   • CDN distribution for fast delivery');
    console.log('   • Secure sharing with time-limited URLs');
    console.log('   • Integration with major insurance platforms');
  }

  async simulateVideoGeneration(photos, claimData, options) {
    // Simulate the video generation process for demo purposes
    const videoId = `demo_video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate processing steps
    const steps = [
      'Analyzing photos for damage...',
      'Generating narration script...',
      'Synthesizing voice narration...',
      'Preparing visual assets...',
      'Rendering video frames...',
      'Compiling final video...',
      'Generating interactive elements...'
    ];

    for (let i = 0; i < steps.length; i++) {
      const progress = Math.round(((i + 1) / steps.length) * 100);
      process.stdout.write(`\r   ${steps[i]} ${progress}%`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing time
    }
    
    console.log(); // New line after progress

    // Generate mock results
    const mockResult = {
      videoId,
      video: {
        path: `/demo/videos/${videoId}.mp4`,
        url: `/api/videos/${videoId}.mp4`,
        format: options.outputFormat,
        duration: options.templateId === 'comprehensive_report' ? 300 : 120,
        size: 25 * 1024 * 1024, // 25MB
        quality: options.quality
      },
      audio: options.includeNarration ? {
        duration: 280,
        format: 'wav',
        voice: options.voiceSettings?.voice || 'alloy'
      } : null,
      script: {
        sections: this.generateMockScript(options.templateId),
        totalWords: 850,
        estimatedDuration: 280
      },
      analysis: {
        photosAnalyzed: photos.length,
        damageTypes: ['hail', 'wind', 'granule'],
        confidenceScore: 0.89
      },
      interactive: this.generateMockInteractiveElements(photos.length),
      metadata: {
        template: options.templateId,
        generationTime: 15000 + Math.random() * 10000,
        timestamp: new Date().toISOString(),
        personalization: options.personalization,
        aiGenerated: true
      },
      exports: [
        {
          format: 'mp4',
          path: `/demo/videos/${videoId}.mp4`,
          url: `/api/videos/${videoId}.mp4`,
          size: 25 * 1024 * 1024,
          quality: 'original'
        },
        {
          format: 'webm',
          path: `/demo/videos/${videoId}.webm`,
          url: `/api/videos/${videoId}.webm`,
          size: 18 * 1024 * 1024,
          quality: 'converted'
        },
        {
          format: 'avi',
          path: `/demo/videos/${videoId}.avi`,
          url: `/api/videos/${videoId}.avi`,
          size: 35 * 1024 * 1024,
          quality: 'converted'
        }
      ]
    };

    return mockResult;
  }

  generateMockScript(templateId) {
    const scripts = {
      comprehensive_report: [
        { type: 'intro', text: 'Hello, this is Susan AI with a comprehensive damage analysis report...', duration: 20 },
        { type: 'property_overview', text: 'The property at 123 Maple Street shows multiple areas of storm damage...', duration: 30 },
        { type: 'damage_catalog', text: 'I have identified 47 hail impacts, 12 areas of wind damage...', duration: 120 },
        { type: 'cost_breakdown', text: 'The estimated repair cost is $18,500 including materials and labor...', duration: 60 },
        { type: 'next_steps', text: 'I recommend immediate approval for contractor assessment...', duration: 40 },
        { type: 'outro', text: 'This concludes the Susan AI damage analysis report...', duration: 30 }
      ],
      hail_damage_explanation: [
        { type: 'intro', text: 'This is a specialized hail damage analysis report...', duration: 15 },
        { type: 'damage_overview', text: 'Hail damage analysis shows 23 impact points...', duration: 30 },
        { type: 'photo_analysis', text: 'Each photo has been analyzed for impact size and severity...', duration: 45 },
        { type: 'recommendations', text: 'Based on the severity, I recommend immediate claim approval...', duration: 20 },
        { type: 'outro', text: 'Thank you for reviewing this hail damage assessment...', duration: 10 }
      ]
    };

    return scripts[templateId] || scripts.comprehensive_report;
  }

  generateMockInteractiveElements(photoCount) {
    const hotspots = [];
    const chapters = [];
    const annotations = [];

    // Generate hotspots for each photo
    for (let i = 0; i < photoCount; i++) {
      const impactCount = Math.floor(Math.random() * 5) + 1;
      for (let j = 0; j < impactCount; j++) {
        hotspots.push({
          id: `impact_${i}_${j}`,
          photoIndex: i,
          x: Math.floor(Math.random() * 800) + 100,
          y: Math.floor(Math.random() * 600) + 100,
          radius: Math.floor(Math.random() * 20) + 10,
          type: 'hail_impact',
          severity: ['mild', 'moderate', 'severe'][Math.floor(Math.random() * 3)],
          confidence: 0.7 + Math.random() * 0.3,
          description: `Hail impact #${j + 1}: ${['mild', 'moderate', 'severe'][Math.floor(Math.random() * 3)]} severity`,
          timestamp: i * 30 + j * 5
        });
      }
    }

    // Generate chapter markers
    const chapterTitles = ['Introduction', 'Property Overview', 'Damage Analysis', 'Cost Assessment', 'Recommendations', 'Conclusion'];
    let currentTime = 0;
    
    chapterTitles.forEach((title, index) => {
      const duration = [20, 30, 120, 60, 40, 30][index] || 30;
      chapters.push({
        id: `chapter_${index}`,
        title,
        startTime: currentTime,
        duration,
        description: `${title} section of the damage analysis report`
      });
      currentTime += duration;
    });

    // Generate annotations
    const annotationTexts = [
      'Significant hail damage detected',
      'Wind damage pattern consistent with storm data',
      'Granule loss exceeds normal wear threshold',
      'Collateral damage requires immediate attention',
      'High confidence AI analysis results'
    ];

    annotationTexts.forEach((text, index) => {
      annotations.push({
        id: `annotation_${index}`,
        text,
        timestamp: index * 50 + 25,
        importance: ['high', 'medium', 'high', 'medium', 'low'][index],
        type: ['damage_detection', 'weather_correlation', 'wear_analysis', 'priority_alert', 'confidence_note'][index]
      });
    });

    return { hotspots, chapters, annotations, overlays: [] };
  }
}

// Run the demo
async function main() {
  const demo = new VideoGenerationDemo();
  await demo.runDemo();
}

// Execute only if this file is run directly
if (import.meta.url === `file://${__filename}`) {
  main().catch(console.error);
}

export { VideoGenerationDemo };