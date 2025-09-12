# Hover/EagleView Integration Setup Guide

## Overview

This guide provides step-by-step instructions for setting up and configuring the Hover/EagleView Integration Service in Susan AI. This integration provides advanced roof measurements and estimates for accurate damage assessment.

## Prerequisites

### Required Accounts and API Access
1. **Hover Account** - Contact Hover (https://hover.to) for API access
2. **EagleView Account** - Contact EagleView (https://eagleview.com) for API access
3. **Google Maps API** - For address geocoding (https://cloud.google.com/maps-platform)

### System Requirements
- Node.js 18.0 or higher
- Minimum 4GB RAM
- 2GB available disk space
- Internet connectivity for API calls

## Installation Steps

### 1. Environment Configuration

Create or update your `.env` file with the required API credentials:

```env
# Hover API Configuration
HOVER_API_URL=https://api.hover.to/v1
HOVER_API_KEY=your-hover-api-key-here

# EagleView API Configuration
EAGLEVIEW_API_URL=https://api.eagleview.com/v1
EAGLEVIEW_API_KEY=your-eagleview-api-key-here
EAGLEVIEW_USERNAME=your-eagleview-username
EAGLEVIEW_PASSWORD=your-eagleview-password

# Google Maps API (for geocoding)
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Optional: Custom timeout settings (in milliseconds)
HOVER_API_TIMEOUT=60000
EAGLEVIEW_API_TIMEOUT=60000

# Optional: Regional cost factors
DEFAULT_REGION=Midwest
ENABLE_COST_ESTIMATION=true
```

### 2. API Credentials Setup

#### Hover API Setup
1. Contact Hover sales team for API access
2. Complete the integration agreement
3. Receive your API key and documentation
4. Test the connection using the provided sandbox environment

#### EagleView API Setup
1. Sign up for EagleView developer access
2. Complete the verification process
3. Obtain your API credentials (key, username, password)
4. Review the API documentation and rate limits

#### Google Maps API Setup
1. Create a Google Cloud Platform account
2. Enable the Geocoding API
3. Generate an API key
4. Configure billing (required for geocoding)
5. Set up API key restrictions for security

### 3. Service Integration

The Hover/EagleView service is automatically initialized when the Susan AI API server starts. The integration includes:

- **Automatic Service Discovery** - The system detects available APIs
- **Graceful Degradation** - Works with partial API availability
- **Real-time Status Monitoring** - Health checks and status reporting

### 4. Testing the Integration

Run the comprehensive test suite to verify your setup:

```bash
# Run the integration test suite
node test-hover-eagleview-integration.js

# Check service status
curl -X GET "http://localhost:3000/api/hover-eagleview/service-status" \
  -H "Authorization: Bearer your-jwt-token"
```

## Configuration Options

### Cost Estimation Settings

The service includes configurable cost databases for accurate regional pricing:

```javascript
// Example cost configuration
const costConfig = {
  materials: {
    'asphalt_shingles': { costPerSqFt: 3.50, laborMultiplier: 1.5 },
    'metal_roofing': { costPerSqFt: 12.00, laborMultiplier: 2.0 },
    'tile_roofing': { costPerSqFt: 8.00, laborMultiplier: 2.5 }
  },
  regionalFactors: {
    'Northeast': 1.25,
    'Southeast': 0.85,
    'Midwest': 0.90,
    'Southwest': 0.95,
    'West': 1.35
  }
};
```

### Quality Thresholds

Configure quality validation thresholds based on your requirements:

```javascript
const qualityThresholds = {
  measurementAccuracy: 0.95,   // 95% accuracy required
  modelConfidence: 0.85,       // 85% confidence minimum
  imageResolution: { 
    minWidth: 1024, 
    minHeight: 768 
  },
  roofCoverage: 0.80,          // 80% roof visibility required
  overlayPrecision: 0.90       // 90% overlay accuracy
};
```

## API Usage Examples

### Basic Measurement Report

```javascript
// Create a measurement report
const response = await fetch('/api/hover-eagleview/measurement-report', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-jwt-token'
  },
  body: formData // FormData with address and images
});

const result = await response.json();
console.log('Report ID:', result.data.reportId);
```

### Damage Assessment

```javascript
// Calculate damage areas
const damageResponse = await fetch('/api/hover-eagleview/damage-assessment', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-jwt-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    reportId: 'hover-eagle-123',
    damageAreas: [
      {
        type: 'hail_damage',
        area: 45.5,
        coordinates: { x: 125, y: 89 }
      }
    ]
  })
});
```

### Cost Estimation

```javascript
// Generate cost estimates
const costResponse = await fetch('/api/hover-eagleview/cost-estimate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-jwt-token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    reportId: 'hover-eagle-123',
    materialType: 'metal_roofing',
    region: 'Northeast'
  })
});
```

## Monitoring and Maintenance

### Health Checks

The service provides comprehensive health monitoring:

```bash
# Check overall service health
curl -X GET "http://localhost:3000/api/hover-eagleview/service-status"

# Monitor API connectivity
curl -X GET "http://localhost:3000/api/health"
```

### Logging and Debugging

The service includes detailed logging for troubleshooting:

```javascript
// Log levels:
// - INFO: General operation information
// - WARN: Non-critical issues (e.g., single API unavailable)
// - ERROR: Critical failures requiring attention

// Example log output:
// 2024-08-21T15:30:00Z [INFO] 🏠 Initializing Hover/EagleView Integration Service...
// 2024-08-21T15:30:05Z [INFO] ✅ Hover API connection validated
// 2024-08-21T15:30:06Z [WARN] ⚠️ EagleView API validation failed: Authentication error
// 2024-08-21T15:30:10Z [INFO] ✅ Hover/EagleView Integration Service initialized successfully
```

### Performance Monitoring

Monitor key performance metrics:

- **Response Times** - API call duration
- **Success Rates** - Percentage of successful requests
- **Cache Hit Rates** - Efficiency of caching system
- **Queue Sizes** - Background processing load

## Troubleshooting

### Common Issues

#### 1. API Authentication Failures

**Symptoms:**
- "Authentication Error" in logs
- 401 Unauthorized responses

**Solutions:**
- Verify API credentials in `.env` file
- Check API key expiration
- Confirm account status with provider
- Test credentials with provider's diagnostic tools

#### 2. Geocoding Failures

**Symptoms:**
- "Address not found" errors
- Invalid coordinates returned

**Solutions:**
- Verify Google Maps API key
- Check API billing status
- Ensure Geocoding API is enabled
- Test with known valid addresses

#### 3. Measurement Discrepancies

**Symptoms:**
- High variance between sources
- Quality validation failures

**Solutions:**
- Review image quality requirements
- Check property address accuracy
- Verify roof visibility in images
- Consider manual verification for complex roofs

#### 4. Performance Issues

**Symptoms:**
- Slow response times
- Timeout errors

**Solutions:**
- Monitor network connectivity
- Check API provider status pages
- Optimize image sizes
- Consider implementing request queuing

### Error Codes and Solutions

| Error Code | Description | Solution |
|------------|-------------|----------|
| AUTH_001 | Invalid API key | Update credentials in `.env` |
| ADDR_002 | Address not found | Verify address format |
| IMG_003 | Image quality too low | Use higher resolution images |
| API_004 | Service temporarily unavailable | Retry request later |
| QUOTA_005 | API quota exceeded | Check usage limits |

## Best Practices

### Image Quality Guidelines

For optimal measurement accuracy:

1. **Resolution**: Minimum 1024x768 pixels
2. **Format**: JPEG, PNG, or TIFF preferred
3. **Lighting**: Clear, well-lit conditions
4. **Coverage**: Full roof visibility
5. **Angles**: Multiple perspectives recommended

### Data Security

Protect sensitive information:

1. **API Keys**: Never commit to version control
2. **Customer Data**: Encrypt sensitive property information
3. **Image Storage**: Implement secure storage solutions
4. **Access Control**: Use proper authentication and authorization

### Performance Optimization

Maximize system efficiency:

1. **Caching**: Leverage built-in caching for repeated requests
2. **Batch Processing**: Group multiple requests when possible
3. **Image Optimization**: Compress images before upload
4. **Regional Deployment**: Consider geographic API distribution

## Support and Resources

### Documentation
- **API Reference**: See `HOVER-EAGLEVIEW-API-DOCUMENTATION.md`
- **Integration Examples**: Check the `examples/` directory
- **Test Suite**: Run `test-hover-eagleview-integration.js`

### External Resources
- **Hover Documentation**: https://docs.hover.to
- **EagleView Developer Portal**: https://developer.eagleview.com
- **Google Maps Platform**: https://developers.google.com/maps

### Getting Help

1. **Technical Support**: api-support@susanai.com
2. **Community Forum**: https://community.susanai.com
3. **Status Updates**: https://status.susanai.com
4. **Issue Tracking**: GitHub Issues (if open source)

## Deployment Checklist

Before deploying to production:

- [ ] All API credentials configured and tested
- [ ] Environment variables properly set
- [ ] Integration tests passing
- [ ] Health checks responding correctly
- [ ] Monitoring and alerting configured
- [ ] Error handling tested
- [ ] Performance benchmarks met
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Team training completed

## Version History

### v1.0.0 (2024-08-21)
- Initial release
- Hover 3D integration
- EagleView aerial imagery integration
- AI-enhanced measurement processing
- Quality validation system
- Cost estimation engine
- 3D visualization support
- Claim tracking integration

---

## Conclusion

The Hover/EagleView Integration Service provides powerful capabilities for precise roof measurements and damage assessment. Follow this guide carefully to ensure a smooth setup and optimal performance.

For additional support or questions, contact the Susan AI development team or refer to the comprehensive API documentation.