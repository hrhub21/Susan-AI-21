# Susan AI Video Generation Service

## Overview

The Susan AI Video Generation Service is a comprehensive system for creating dynamic video explanations for complex insurance claims. This service automatically generates professional videos that explain roof damage, repair processes, and claim justifications to improve communication between contractors, adjusters, and clients.

## 🎬 Features

### Dynamic Video Creation
- **Automated Compilation**: Transforms photos and damage analysis into professional videos
- **Canvas/HTML5 Generation**: High-quality video rendering using Node.js Canvas
- **Photo Sequence Integration**: Seamlessly integrates multiple damage photos
- **Real-Time Processing**: Quick video generation for immediate use

### AI Narration
- **Professional Voice Synthesis**: High-quality text-to-speech narration
- **Multiple Voice Options**: Various voice styles and emotions
- **Script Generation**: AI-generated scripts based on damage analysis
- **Customizable Speed & Tone**: Adjustable narration parameters

### Visual Overlays & Annotations
- **Damage Markers**: Clickable hotspots on damage areas
- **Measurement Overlays**: Visual indicators for size and severity
- **Heat Maps**: Color-coded damage intensity visualization
- **Professional Graphics**: Charts, diagrams, and infographics

### Template System
- **Pre-built Templates**: Ready-to-use video formats for different claim types
- **Customizable Sections**: Modular video components
- **Professional Themes**: Insurance industry-appropriate styling
- **Responsive Layouts**: Optimized for various viewing devices

### Personalization
- **Adjuster-Specific**: Customized videos for specific insurance professionals
- **Client Branding**: Company logos and color schemes
- **Property Details**: Specific address and claim information
- **Contact Information**: Relevant contact details and next steps

### Interactive Elements
- **Clickable Hotspots**: Interactive damage markers with detailed information
- **Chapter Navigation**: Jump to specific video sections
- **Timestamped Annotations**: Context-aware information overlays
- **Progress Indicators**: Visual progress through video content

### Multi-Format Export
- **MP4**: Standard format for general viewing
- **WebM**: Optimized for web streaming
- **AVI**: High-quality format for professional analysis
- **Streaming Ready**: Cloud-optimized delivery formats

## 🏗️ Architecture

### Core Components

```
VideoGenerationService/
├── Video Templates          # Pre-built video formats
├── Photo Analysis Engine    # AI-powered damage assessment
├── Script Generator         # Automated narration creation
├── Voice Synthesis          # Text-to-speech conversion
├── Visual Asset Processor   # Image enhancement and overlays
├── Frame Generator          # Video frame creation
├── Video Compiler           # FFmpeg-based video assembly
└── Interactive Generator    # Hotspot and annotation creation
```

### Integration Points

- **RoofingDamageAnalysisService**: AI damage detection and assessment
- **VoiceService**: Professional voice synthesis and audio processing
- **MultimodalService**: Image analysis and content understanding
- **Canvas API**: High-performance graphics rendering
- **FFmpeg**: Professional video compilation and encoding

## 📋 Available Templates

### 1. Comprehensive Report (`comprehensive_report`)
- **Duration**: 5 minutes
- **Sections**: Intro, Property Overview, Damage Catalog, Cost Breakdown, Next Steps, Conclusion
- **Use Case**: Detailed insurance claim documentation
- **Features**: Complete analysis with financial breakdown

### 2. Hail Damage Explanation (`hail_damage_explanation`)
- **Duration**: 2 minutes
- **Sections**: Intro, Damage Overview, Photo Analysis, Recommendations, Outro
- **Use Case**: Hail-specific damage assessment
- **Features**: Impact counting and severity classification

### 3. Wind Damage Analysis (`wind_damage_analysis`)
- **Duration**: 2.5 minutes
- **Sections**: Intro, Wind Patterns, Structural Impact, Repair Priority, Outro
- **Use Case**: Wind damage assessment and repair prioritization
- **Features**: Structural analysis and safety recommendations

### 4. Adjuster Briefing (`adjuster_briefing`)
- **Duration**: 1.5 minutes
- **Sections**: Intro, Claim Summary, Evidence Review, Recommendations, Outro
- **Use Case**: Quick professional briefing for adjusters
- **Features**: Concise evidence presentation

## 🚀 Quick Start

### Installation

```bash
# Install required dependencies
npm install fluent-ffmpeg ffmpeg-static ffprobe-static canvas sharp

# Initialize the service
npm run demo:video
```

### Basic Usage

```javascript
import { VideoGenerationService } from './src/api/services/VideoGenerationService.js';

const videoService = new VideoGenerationService();
await videoService.initialize();

// Generate a comprehensive claim video
const result = await videoService.generateClaimVideo(
  photos,           // Array of photo buffers/files
  claimData,        // Claim information object
  {
    templateId: 'comprehensive_report',
    personalization: {
      adjusterName: 'John Smith',
      companyName: 'ABC Insurance'
    },
    outputFormat: 'mp4',
    quality: 'high',
    includeNarration: true
  }
);

console.log('Video generated:', result.video.url);
```

### API Endpoints

#### Generate Comprehensive Video
```http
POST /api/video-generation/generate-claim-video
Content-Type: multipart/form-data

photos: [file1.jpg, file2.jpg, ...]
claimData: {"propertyAddress": "123 Main St", ...}
templateId: "comprehensive_report"
outputFormat: "mp4"
quality: "high"
```

#### Quick Damage Assessment
```http
POST /api/video-generation/quick-damage-video
Content-Type: multipart/form-data

photos: [file1.jpg, file2.jpg]
propertyAddress: "123 Main St"
adjusterName: "John Smith"
damageType: "hail"
```

#### Check Generation Status
```http
GET /api/video-generation/status/{videoId}
```

#### Download Generated Video
```http
GET /api/video-generation/download/{videoId}?format=mp4
```

## 📊 Configuration Options

### Video Quality Settings

```javascript
const qualitySettings = {
  low: {
    resolution: '720p',
    bitrate: '1000k',
    fps: 24
  },
  medium: {
    resolution: '1080p',
    bitrate: '2000k',
    fps: 30
  },
  high: {
    resolution: '1080p',
    bitrate: '4000k',
    fps: 30
  }
};
```

### Voice Configuration

```javascript
const voiceSettings = {
  voice: 'alloy',          // Voice model
  speed: 1.0,              // Speaking speed
  emotion: 'professional', // Emotional tone
  style: 'natural'         // Speaking style
};
```

### Personalization Options

```javascript
const personalization = {
  adjusterName: 'Sarah Johnson',
  companyName: 'ABC Insurance',
  contractorName: 'Susan AI Systems',
  reportingPerson: 'Dr. Susan Miller',
  brandColors: {
    primary: '#2E86AB',
    secondary: '#A23B72',
    accent: '#F18F01'
  }
};
```

## 🎯 Interactive Features

### Clickable Hotspots
- **Damage Markers**: Click to view detailed damage analysis
- **Severity Indicators**: Color-coded severity levels
- **Confidence Scores**: AI analysis confidence ratings
- **Measurement Data**: Size and impact measurements

### Chapter Navigation
- **Section Jumping**: Direct navigation to video sections
- **Progress Tracking**: Visual progress through content
- **Bookmarking**: Save specific moments for review
- **Timestamped Notes**: Add custom annotations

### Real-Time Overlays
- **Damage Heat Maps**: Visual damage intensity overlays
- **Before/After Comparisons**: Side-by-side damage views
- **Measurement Tools**: On-screen rulers and measuring tools
- **Zoom Functionality**: Detailed examination of damage areas

## 🔧 Advanced Features

### Custom Template Creation

```javascript
const customTemplate = {
  id: 'custom_template',
  name: 'Custom Analysis',
  duration: 180,
  sections: [
    { type: 'intro', duration: 15, template: 'custom_intro' },
    { type: 'analysis', duration: 120, template: 'detailed_analysis' },
    { type: 'outro', duration: 45, template: 'recommendations' }
  ],
  style: {
    theme: 'corporate',
    colors: { /* custom colors */ },
    fonts: { /* custom fonts */ }
  }
};
```

### Batch Processing

```javascript
// Process multiple claim videos simultaneously
const batchResult = await videoService.processBatch(
  [photos1, photos2, photos3],
  {
    templateId: 'adjuster_briefing',
    concurrency: 3,
    webhook_url: 'https://your-app.com/webhook'
  }
);
```

### Cloud Integration

```javascript
// Configure cloud storage and CDN
const cloudConfig = {
  storage: {
    provider: 'aws-s3',
    bucket: 'insurance-videos',
    region: 'us-east-1'
  },
  cdn: {
    provider: 'cloudfront',
    domain: 'videos.yourcompany.com'
  }
};
```

## 📈 Performance & Scalability

### Rendering Performance
- **Concurrent Processing**: Up to 3 simultaneous video renders
- **Queue Management**: Intelligent job scheduling and prioritization
- **Resource Optimization**: Memory and CPU usage optimization
- **Caching**: Intelligent asset caching for faster renders

### File Size Optimization
- **Adaptive Bitrates**: Quality-based encoding optimization
- **Format Selection**: Best format for intended use case
- **Compression**: Lossless compression where appropriate
- **Streaming Optimization**: Progressive download support

### System Requirements
- **Memory**: Minimum 8GB RAM (16GB recommended)
- **Storage**: SSD recommended for video processing
- **CPU**: Multi-core processor for FFmpeg encoding
- **Network**: High bandwidth for cloud operations

## 🛡️ Security & Compliance

### Data Protection
- **Encrypted Storage**: All video files encrypted at rest
- **Secure Transmission**: HTTPS/TLS for all API communications
- **Access Control**: Role-based video access permissions
- **Audit Logging**: Complete audit trail for all operations

### Compliance Features
- **GDPR Compliance**: Personal data handling and deletion
- **Insurance Regulations**: Industry-specific compliance checks
- **Data Retention**: Configurable retention policies
- **Privacy Controls**: Configurable privacy and sharing settings

## 🔍 Monitoring & Analytics

### Performance Metrics
- **Generation Time**: Average video creation duration
- **Success Rate**: Percentage of successful generations
- **Quality Scores**: AI confidence and video quality metrics
- **User Engagement**: Interactive element usage statistics

### Error Handling
- **Graceful Degradation**: Fallback options for failed operations
- **Detailed Logging**: Comprehensive error tracking and reporting
- **Recovery Mechanisms**: Automatic retry and recovery systems
- **User Feedback**: Clear error messages and resolution steps

## 📚 Examples

### Complete Implementation Example

```javascript
import { VideoGenerationService } from './src/api/services/VideoGenerationService.js';
import fs from 'fs-extra';

async function generateInsuranceVideo() {
  const videoService = new VideoGenerationService();
  await videoService.initialize();

  // Prepare photo data
  const photos = [
    {
      buffer: await fs.readFile('damage1.jpg'),
      originalname: 'roof_overview.jpg',
      mimetype: 'image/jpeg',
      size: 2048576
    },
    {
      buffer: await fs.readFile('damage2.jpg'),
      originalname: 'hail_closeup.jpg',
      mimetype: 'image/jpeg',
      size: 1536789
    }
  ];

  // Claim information
  const claimData = {
    propertyAddress: '123 Maple Street, Austin, TX 78701',
    claimNumber: 'CLM-2024-001',
    dateOfLoss: '2024-01-15',
    policyNumber: 'POL-123456789',
    insured: {
      name: 'John Smith',
      phone: '(555) 123-4567'
    },
    adjuster: {
      name: 'Sarah Johnson',
      company: 'ABC Insurance'
    }
  };

  // Generation options
  const options = {
    templateId: 'comprehensive_report',
    personalization: {
      adjusterName: 'Sarah Johnson',
      companyName: 'ABC Insurance'
    },
    outputFormat: 'mp4',
    quality: 'high',
    includeNarration: true,
    voiceSettings: {
      voice: 'alloy',
      speed: 1.0,
      emotion: 'professional'
    }
  };

  try {
    const result = await videoService.generateClaimVideo(photos, claimData, options);
    
    console.log('✅ Video generated successfully!');
    console.log('Video URL:', result.video.url);
    console.log('Duration:', result.video.duration, 'seconds');
    console.log('File Size:', (result.video.size / 1024 / 1024).toFixed(2), 'MB');
    console.log('Interactive Hotspots:', result.interactive.hotspots.length);
    
    return result;
  } catch (error) {
    console.error('❌ Video generation failed:', error.message);
    throw error;
  }
}

// Run the example
generateInsuranceVideo();
```

## 🤝 Contributing

### Development Setup

```bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run the demo
npm run demo:video
```

### Testing

```bash
# Run video generation tests
npm test -- --testPathPattern=video

# Run performance tests
npm run test:performance

# Run the interactive demo
npm run demo:video
```

## 📞 Support

For technical support or questions about the Video Generation Service:

- **Documentation**: Full API documentation available at `/api/docs`
- **Demo**: Interactive demo at `npm run demo:video`
- **Issues**: Report bugs and feature requests via GitHub issues
- **Community**: Join our developer community for discussions and updates

## 🔄 Roadmap

### Upcoming Features
- **AI Script Enhancement**: More sophisticated script generation
- **3D Visualization**: Three-dimensional damage modeling
- **Virtual Reality**: VR-compatible video formats
- **Mobile Optimization**: Mobile-specific video templates
- **Real-Time Collaboration**: Live video editing and annotation
- **Advanced Analytics**: Detailed viewer engagement metrics

### Integration Enhancements
- **CRM Integration**: Direct integration with insurance CRM systems
- **Mobile Apps**: Native mobile app support
- **API Webhooks**: Real-time notifications and callbacks
- **Third-Party Tools**: Integration with popular insurance tools

---

*Built with ❤️ by the Susan AI Team*