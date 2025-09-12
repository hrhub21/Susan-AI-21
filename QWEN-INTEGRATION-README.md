# Qwen Vision Language Integration

This document describes the comprehensive integration between Susan AI Enhanced (JavaScript) and the Qwen 2.5 VL model capabilities from the Python Susan_AI system.

## Overview

The integration provides:
- **Unified Vision-Language API** for all Susan AI agents
- **Offline/Online capability** with automatic fallbacks
- **Multi-agent coordination** for complex analysis tasks
- **Real-time model status monitoring**
- **Advanced caching and performance optimization**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Susan AI Enhanced                       │
│                   (JavaScript Frontend)                     │
├─────────────────────────────────────────────────────────────┤
│              Qwen Vision Integration Hub                    │
│           (src/qwen-vision-integration.js)                  │
├─────────────────────────────────────────────────────────────┤
│    Building   │ Legal      │ Roofing    │ Document   │ ... │
│    Code       │ Compliance │ Analysis   │ OCR        │     │
│    Agent      │ Agent      │ Agent      │ Agent      │     │
├─────────────────────────────────────────────────────────────┤
│              Python Qwen 2.5 VL Backend                    │
│                (localhost:3031)                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Qwen Vision Integration Hub (`src/qwen-vision-integration.js`)
- Central coordination service
- Manages all AI agents and their capabilities
- Handles offline/online modes
- Provides unified API for vision-language tasks

### 2. Specialized AI Agents
- **Building Code Agent**: Analyzes blueprints and construction documents
- **Legal Compliance Agent**: Reviews contracts and legal documents
- **Roofing Damage Agent**: Advanced damage detection and quantification
- **Document OCR Agent**: Extracts text and structured data
- **Weather Analysis Agent**: Correlates damage with weather patterns
- **Manufacturer DB Agent**: Identifies products and materials

### 3. Deployment Script (`deploy-full-susan.js`)
- Orchestrates startup of all services
- Health monitoring and status reporting
- Graceful shutdown handling

## Quick Start

### 1. Start the Complete System
```bash
# Start all services with one command
node deploy-full-susan.js

# Or start in development mode
node deploy-full-susan.js --dev

# Or start in offline mode (without Python backend)
node deploy-full-susan.js --offline
```

### 2. Test the Integration
```bash
# Run comprehensive tests
node test-qwen-integration.js

# Test specific components
node test-qwen-integration.js roofing
node test-qwen-integration.js multi-agent
```

### 3. Access the Services
- **Susan AI API**: http://localhost:3001
- **Python Backend**: http://localhost:3031
- **API Documentation**: http://localhost:3001/api/docs

## Available Endpoints

### Vision Analysis Endpoints
```bash
# Roofing damage analysis
POST /api/v1/roofing-analysis
Content-Type: multipart/form-data
{
  "image": <file>,
  "analysisType": "comprehensive",
  "location": "optional"
}

# Document OCR analysis
POST /api/v1/document-ocr
Content-Type: multipart/form-data
{
  "document": <file>,
  "extractionMode": "comprehensive"
}

# Building code compliance
POST /api/v1/building-codes
Content-Type: multipart/form-data
{
  "image": <file>,
  "location": "City, State",
  "buildingType": "residential"
}

# Legal document analysis
POST /api/v1/legal-compliance
Content-Type: multipart/form-data
{
  "document": <file>,
  "documentType": "contract",
  "jurisdiction": "State"
}
```

### Multi-Agent Coordination
```bash
# Coordinate multiple agents
POST /api/v1/analyze/multi-agent
Content-Type: multipart/form-data
{
  "image": <file>,
  "analysisTypes": ["roofing_damage", "weather_damage", "building_code"],
  "options": { "comprehensive": true }
}
```

## Usage Examples

### 1. Basic Roofing Analysis
```javascript
import qwenIntegration from './src/qwen-vision-integration.js';

const result = await qwenIntegration.analyzeWithVision(
  imageData,
  'roofing_damage',
  {
    filename: 'roof_photo.jpg',
    location: 'Denver, CO'
  }
);

console.log('Damage Type:', result.damageType);
console.log('Severity:', result.severity);
console.log('Confidence:', result.confidence);
```

### 2. Multi-Agent Analysis
```javascript
const result = await qwenIntegration.coordinateMultiAgentAnalysis(
  imageData,
  ['roofing_damage', 'weather_damage', 'building_code'],
  { comprehensive: true }
);

console.log('Individual Results:', result.individualResults);
console.log('Cross-Correlation:', result.correlation);
```

### 3. Document Processing
```javascript
const result = await qwenIntegration.analyzeWithVision(
  documentImage,
  'document_ocr',
  {
    extractionMode: 'insurance_forms',
    filename: 'claim_form.pdf'
  }
);

console.log('Extracted Data:', result.extractedInfo);
console.log('Missing Fields:', result.missingFields);
```

## Configuration

### Environment Variables
```bash
# Python backend configuration
PYTHON_BACKEND_URL=http://localhost:3031
QWEN_MODEL_PATH=/path/to/qwen/model

# Susan AI configuration
SUSAN_NAME=Susan
NODE_ENV=production
PORT=3001

# Optional API keys for enhanced features
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
```

### Agent Configuration
Each agent can be customized in the integration file:

```javascript
this.agentCapabilities.set('roofing_damage', {
  description: 'Advanced roofing damage detection',
  capabilities: ['damage_detection', 'material_identification'],
  visionTasks: ['hail_damage_detection', 'wind_damage_assessment'],
  prompts: {
    damage_analysis: 'Custom prompt for roofing analysis...'
  }
});
```

## Offline Mode

The system supports offline operation when the Python backend is unavailable:

```javascript
// Enable offline mode
await qwenIntegration.enableOfflineMode();

// Check offline capabilities
const capabilities = qwenIntegration.getSystemStatus();
console.log('Offline capabilities:', capabilities.offlineMode);
```

## Performance Optimization

### Caching
- Automatic response caching with TTL
- LRU eviction for memory management
- Cache statistics and monitoring

### Multi-Threading
- Parallel agent processing
- Background model loading
- Asynchronous request handling

## Monitoring and Health Checks

### System Status
```bash
# Check overall system status
curl http://localhost:3001/api/v1/health

# Check Python backend status
curl http://localhost:3031/status

# Get integration status
node -e "
import('./src/qwen-vision-integration.js').then(m => 
  console.log(JSON.stringify(m.default.getSystemStatus(), null, 2))
)"
```

### Health Monitoring
The deployment script includes automatic health monitoring:
- Python backend connectivity
- Model loading status
- Service availability
- Performance metrics

## Troubleshooting

### Common Issues

1. **Python Backend Not Available**
   ```bash
   # Ensure Python service is running
   cd /Users/a21/Susan_AI
   python3 web_interface.py
   ```

2. **Model Loading Timeout**
   ```bash
   # Check model loading progress
   curl http://localhost:3031/status
   ```

3. **Port Conflicts**
   ```bash
   # Check port usage
   lsof -i :3001
   lsof -i :3031
   ```

4. **Memory Issues**
   ```bash
   # Clear cache and restart
   node -e "
   import('./src/qwen-vision-integration.js').then(m => {
     m.default.clearCache();
     console.log('Cache cleared');
   })"
   ```

### Debug Mode
```bash
# Start with verbose logging
node deploy-full-susan.js --dev --verbose

# Run tests with detailed output
node test-qwen-integration.js --verbose
```

## API Reference

### Main Integration Class
- `analyzeWithVision(imageData, analysisType, options)` - Single agent analysis
- `coordinateMultiAgentAnalysis(imageData, types, options)` - Multi-agent coordination
- `getSystemStatus()` - Get current system status
- `enableOfflineMode()` - Switch to offline operation
- `clearCache()` - Clear response cache

### Agent Types
- `roofing_damage` - Roofing damage analysis
- `building_code` - Building code compliance
- `legal_compliance` - Legal document analysis
- `document_ocr` - Document OCR and extraction
- `weather_damage` - Weather correlation analysis
- `product_identification` - Product and manufacturer identification

## Performance Metrics

The system tracks various performance metrics:
- Response times per agent
- Cache hit rates
- Model loading times
- Success/failure rates
- Resource utilization

Access metrics via:
```javascript
const metrics = qwenIntegration.getPerformanceMetrics();
```

## Security Considerations

- All file uploads are validated
- Image processing is sandboxed
- API rate limiting is enforced
- Sensitive data is not cached
- CORS policies are configured

## Contributing

To add new agents or capabilities:

1. Define agent capabilities in `initializeAgentCapabilities()`
2. Create analysis method in the integration class
3. Add corresponding API endpoint
4. Update tests and documentation

## Support

For issues and questions:
- Check the troubleshooting section
- Run the test suite: `node test-qwen-integration.js`
- Review logs in the `./logs/` directory
- Ensure all dependencies are installed