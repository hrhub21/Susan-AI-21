# Hover/EagleView Integration API Documentation

## Overview

The Hover/EagleView Integration Service provides advanced roof measurements and estimates for accurate damage assessment in Susan AI. This service combines the power of Hover's 3D modeling technology with EagleView's aerial imagery expertise to deliver precise roof measurements, damage calculations, and cost estimates.

## Features

### 🏠 Core Capabilities
- **Hover 3D Integration** - Connect with Hover API for 3D roof models and measurements
- **EagleView Integration** - Integrate with EagleView for aerial imagery and measurements
- **Measurement Processing** - Extract roof dimensions, slopes, and material estimates
- **Damage Area Calculation** - Calculate precise damage areas and repair estimates
- **Cost Estimation** - Generate material and labor cost estimates based on measurements
- **Report Integration** - Integrate measurements into Susan AI damage reports
- **3D Visualization** - Provide 3D visualization and measurement overlays
- **Quality Validation** - Verify measurement accuracy and flag discrepancies

### 🔧 Technical Features
- **AI Enhancement** - Machine learning models for measurement validation and enhancement
- **Cross-Validation** - Compare and validate measurements from multiple sources
- **Regional Cost Factors** - Adjust pricing based on geographic location
- **Material Options** - Support for multiple roofing materials with accurate pricing
- **Real-time Processing** - Live measurement updates and progress tracking

## API Endpoints

### Base URL
```
https://api.susanai.com/api/hover-eagleview
```

### Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <your-jwt-token>
```

---

## 1. Create Measurement Report

Create a comprehensive roof measurement and estimate report.

**Endpoint:** `POST /measurement-report`

**Content-Type:** `multipart/form-data`

### Request Parameters

#### Required
- `address` (string): Property address for measurement
- `images` (files): Roof images for analysis (optional but recommended)

#### Optional
- `roofType` (string): Type of roof structure
  - Options: `gable`, `hip`, `shed`, `flat`, `gambrel`, `mansard`
- `propertyType` (string): Property classification
  - Options: `residential`, `commercial`
  - Default: `residential`
- `priority` (string): Processing priority
  - Options: `standard`, `expedited`, `emergency`
  - Default: `standard`
- `preferences` (JSON string): Processing preferences
  ```json
  {
    "materialType": "asphalt_shingles",
    "region": "Midwest",
    "taxRate": 0.08
  }
  ```
- `claimId` (string): Existing claim ID to integrate with

### Example Request

```bash
curl -X POST "https://api.susanai.com/api/hover-eagleview/measurement-report" \
  -H "Authorization: Bearer your-jwt-token" \
  -F "address=123 Main St, Anytown, ST 12345" \
  -F "roofType=gable" \
  -F "propertyType=residential" \
  -F "priority=standard" \
  -F "preferences={\"materialType\":\"asphalt_shingles\",\"region\":\"Midwest\"}" \
  -F "images=@roof-image-1.jpg" \
  -F "images=@roof-image-2.jpg" \
  -F "claimId=claim-123456"
```

### Response

```json
{
  "success": true,
  "message": "Roof measurement report generated successfully",
  "data": {
    "reportId": "hover-eagle-1692825600-abc123def",
    "report": {
      "id": "hover-eagle-1692825600-abc123def",
      "timestamp": "2024-08-21T15:30:00.000Z",
      "property": {
        "address": "123 Main St, Anytown, ST 12345",
        "location": {
          "coordinates": { "lat": 40.7128, "lng": -74.0060 },
          "formattedAddress": "123 Main St, Anytown, ST 12345",
          "region": "Northeast"
        },
        "characteristics": {
          "roofType": "gable",
          "pitchCategory": "moderate_slope",
          "complexity": "moderate",
          "accessibility": "easy"
        }
      },
      "measurements": {
        "source": {
          "primary": {
            "source": "hover",
            "confidence": 0.92
          },
          "secondary": {
            "source": "eagleView",
            "confidence": 0.87
          }
        },
        "enhanced": {
          "totalRoofArea": 2450,
          "roofPlanes": [
            {
              "id": "plane_1",
              "area": 1225,
              "slope": 6.5,
              "orientation": "south"
            },
            {
              "id": "plane_2", 
              "area": 1225,
              "slope": 6.5,
              "orientation": "north"
            }
          ],
          "ridgeLength": 45,
          "gutterLength": 180,
          "measurements": {
            "length": 50,
            "width": 30,
            "height": 25,
            "perimeter": 160
          },
          "complexity": "moderate"
        }
      },
      "costEstimates": {
        "materials": {
          "primary": {
            "type": "asphalt_shingles",
            "total": 8575
          },
          "total": 12450
        },
        "labor": {
          "total": 9800
        },
        "total": 25750,
        "options": [
          {
            "material": "asphalt_shingles",
            "total": 25750,
            "warranty": "25 years",
            "preferred": true
          },
          {
            "material": "metal_roofing",
            "total": 45200,
            "warranty": "50 years",
            "preferred": false
          }
        ]
      },
      "quality": {
        "overallConfidence": 0.90,
        "validated": true,
        "checks": [
          {
            "type": "measurement_accuracy",
            "passed": true,
            "score": 0.92
          },
          {
            "type": "cross_validation",
            "passed": true,
            "score": 0.95
          }
        ]
      }
    },
    "summary": {
      "totalArea": 2450,
      "estimatedCost": 25750,
      "confidence": 0.90,
      "sources": {
        "hover": true,
        "eagleView": true
      }
    }
  },
  "meta": {
    "processingTime": 45000,
    "timestamp": "2024-08-21T15:30:45.000Z"
  }
}
```

---

## 2. Calculate Damage Assessment

Calculate precise damage areas and repair estimates based on identified damage.

**Endpoint:** `POST /damage-assessment`

### Request Body

```json
{
  "reportId": "hover-eagle-1692825600-abc123def",
  "damageAreas": [
    {
      "id": "damage-001",
      "type": "hail_damage",
      "coordinates": { "x": 125, "y": 89 },
      "area": 45.5,
      "description": "Multiple hail impacts on south-facing slope"
    },
    {
      "id": "damage-002", 
      "type": "wind_damage",
      "coordinates": { "x": 200, "y": 150 },
      "area": 28.0,
      "description": "Lifted shingles along ridge line"
    }
  ]
}
```

### Response

```json
{
  "success": true,
  "message": "Damage assessment completed successfully",
  "data": {
    "reportId": "hover-eagle-1692825600-abc123def",
    "damageAssessment": {
      "totalDamageArea": 73.5,
      "damagePercentage": 3.0,
      "damagesByPlane": [
        {
          "id": "damage-001",
          "type": "hail_damage",
          "area": 45.5,
          "severity": "moderate",
          "urgent": false,
          "repairMethod": "section_replacement",
          "estimatedCost": 1137.50
        },
        {
          "id": "damage-002",
          "type": "wind_damage", 
          "area": 28.0,
          "severity": "major",
          "urgent": true,
          "repairMethod": "structural_repair",
          "estimatedCost": 1540.00
        }
      ],
      "priorityAreas": [
        {
          "id": "damage-002",
          "urgency": "high"
        }
      ],
      "repairRequirements": {
        "immediateAction": true,
        "timeline": "within_week"
      }
    },
    "updatedCostEstimates": {
      "total": 28427.50,
      "damage": {
        "total": 2677.50
      }
    },
    "recommendations": [
      {
        "category": "urgent_repair",
        "priority": "critical",
        "title": "Urgent repairs needed",
        "description": "1 areas require immediate attention"
      }
    ]
  },
  "meta": {
    "totalDamageArea": 73.5,
    "damagePercentage": 3.0,
    "urgentRepairs": 1,
    "lastUpdated": "2024-08-21T15:32:15.000Z"
  }
}
```

---

## 3. Retrieve Report

Get a specific measurement report by ID.

**Endpoint:** `GET /report/{reportId}`

### Query Parameters

- `visualization` (boolean): Include 3D visualization data
  - Default: `false`

### Example Request

```bash
curl -X GET "https://api.susanai.com/api/hover-eagleview/report/hover-eagle-1692825600-abc123def?visualization=true" \
  -H "Authorization: Bearer your-jwt-token"
```

### Response

Returns the complete measurement report with all data included in the creation response.

---

## 4. Get Report Status

Check the processing status of a measurement report.

**Endpoint:** `GET /report/{reportId}/status`

### Response

```json
{
  "success": true,
  "data": {
    "status": "completed",
    "reportId": "hover-eagle-1692825600-abc123def",
    "timestamp": "2024-08-21T15:30:00.000Z",
    "confidence": 0.90
  }
}
```

---

## 5. Get 3D Visualization

Retrieve 3D visualization data for a report.

**Endpoint:** `GET /visualization/{reportId}`

### Response

```json
{
  "success": true,
  "data": {
    "reportId": "hover-eagle-1692825600-abc123def",
    "visualization": {
      "model": {
        "type": "3d_model",
        "url": "https://hover.com/models/abc123def",
        "viewerUrl": "https://hover.com/viewer/abc123def",
        "format": "obj"
      },
      "overlays": [
        {
          "type": "roof_outline",
          "data": {
            "area": 2450,
            "color": "#2563eb"
          }
        }
      ],
      "damageMarkers": [
        {
          "type": "damage_area",
          "id": "damage-001",
          "severity": "moderate",
          "color": "#f97316"
        }
      ]
    },
    "measurements": {
      "totalArea": 2450,
      "roofPlanes": 2,
      "complexity": "moderate"
    }
  }
}
```

---

## 6. Generate Cost Estimate

Create updated cost estimates with different parameters.

**Endpoint:** `POST /cost-estimate`

### Request Body

```json
{
  "reportId": "hover-eagle-1692825600-abc123def",
  "materialType": "metal_roofing",
  "region": "Northeast",
  "includeLabor": true
}
```

### Response

```json
{
  "success": true,
  "message": "Cost estimates updated successfully",
  "data": {
    "reportId": "hover-eagle-1692825600-abc123def",
    "costEstimates": {
      "materials": {
        "primary": {
          "type": "metal_roofing",
          "total": 36750
        },
        "total": 41200
      },
      "labor": {
        "total": 19600
      },
      "total": 65300
    },
    "preferences": {
      "materialType": "metal_roofing",
      "region": "Northeast",
      "includeLabor": true
    },
    "comparison": {
      "previousTotal": 25750,
      "newTotal": 65300,
      "difference": 39550,
      "percentChange": 153.7
    }
  }
}
```

---

## 7. Get Service Status

Check the health and availability of the integration service.

**Endpoint:** `GET /service-status`

### Response

```json
{
  "success": true,
  "data": {
    "service": "Hover/EagleView Integration",
    "status": "operational",
    "capabilities": {
      "hover3D": true,
      "eagleViewAerial": true,
      "aiEnhancement": true,
      "costEstimation": true,
      "damageAssessment": true,
      "visualization": true
    },
    "performance": {
      "cachedMeasurements": 145,
      "cachedReports": 89,
      "queueSize": 3
    }
  }
}
```

---

## 8. Integrate with Claim

Integrate a measurement report with an existing insurance claim.

**Endpoint:** `POST /integrate-claim`

### Request Body

```json
{
  "reportId": "hover-eagle-1692825600-abc123def",
  "claimId": "claim-123456",
  "updateEstimates": true
}
```

### Response

```json
{
  "success": true,
  "message": "Measurement report integrated with claim successfully",
  "data": {
    "claimId": "claim-123456",
    "reportId": "hover-eagle-1692825600-abc123def",
    "integration": {
      "measurementsAttached": true,
      "estimatesUpdated": true,
      "confidence": 0.90
    }
  }
}
```

---

## 9. Get Material Options

Retrieve available material options and pricing.

**Endpoint:** `GET /material-options`

### Query Parameters

- `roofArea` (number, required): Total roof area in square feet
- `region` (string): Geographic region for pricing adjustments
  - Default: `Midwest`

### Example Request

```bash
curl -X GET "https://api.susanai.com/api/hover-eagleview/material-options?roofArea=2450&region=Northeast" \
  -H "Authorization: Bearer your-jwt-token"
```

### Response

```json
{
  "success": true,
  "data": {
    "roofArea": 2450,
    "region": "Northeast",
    "materialOptions": [
      {
        "type": "asphalt_shingles",
        "name": "Asphalt Shingles",
        "costPerSqFt": 4.38,
        "totalCost": 11827.25,
        "warranty": "25 years",
        "expectedLife": 25,
        "description": "Standard asphalt shingles - economical and reliable"
      },
      {
        "type": "metal_roofing",
        "name": "Metal Roofing",
        "costPerSqFt": 15.00,
        "totalCost": 40537.50,
        "warranty": "50 years",
        "expectedLife": 50,
        "description": "Premium metal roofing - durable and energy efficient"
      }
    ],
    "regionalFactor": 1.25
  }
}
```

---

## 10. Quality Validation

Perform additional quality validation on measurements.

**Endpoint:** `POST /quality-validation`

### Request Body

```json
{
  "reportId": "hover-eagle-1692825600-abc123def",
  "validationLevel": "enhanced"
}
```

### Response

```json
{
  "success": true,
  "message": "Quality validation completed",
  "data": {
    "reportId": "hover-eagle-1692825600-abc123def",
    "validationLevel": "enhanced",
    "validation": {
      "overallConfidence": 0.90,
      "checks": [
        {
          "type": "measurement_accuracy",
          "passed": true,
          "score": 0.92
        },
        {
          "type": "cross_validation",
          "passed": true,
          "score": 0.95
        }
      ],
      "warnings": [],
      "recommendations": []
    },
    "overallRating": "excellent"
  }
}
```

---

## Error Responses

All endpoints return consistent error responses:

### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Property address is required",
  "details": {
    "field": "address",
    "code": "REQUIRED_FIELD_MISSING"
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication Error",
  "message": "Invalid or expired token"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Resource Not Found",
  "message": "Report not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal Server Error",
  "message": "Failed to create measurement report",
  "details": "Service temporarily unavailable"
}
```

---

## Rate Limits

- **Standard**: 100 requests per hour
- **Expedited**: 500 requests per hour (premium)
- **Emergency**: No limits (emergency response)

---

## Environment Configuration

Required environment variables:

```env
# Hover API Configuration
HOVER_API_URL=https://api.hover.to/v1
HOVER_API_KEY=your-hover-api-key

# EagleView API Configuration
EAGLEVIEW_API_URL=https://api.eagleview.com/v1
EAGLEVIEW_API_KEY=your-eagleview-api-key
EAGLEVIEW_USERNAME=your-username
EAGLEVIEW_PASSWORD=your-password

# Google Maps (for geocoding)
GOOGLE_MAPS_API_KEY=your-google-maps-key
```

---

## SDK Examples

### JavaScript/Node.js

```javascript
const SusanAI = require('susan-ai-sdk');

const client = new SusanAI({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.susanai.com'
});

// Create measurement report
const report = await client.hoverEagleView.createMeasurementReport({
  address: '123 Main St, Anytown, ST 12345',
  roofType: 'gable',
  images: [
    fs.createReadStream('./roof-image-1.jpg'),
    fs.createReadStream('./roof-image-2.jpg')
  ],
  preferences: {
    materialType: 'asphalt_shingles',
    region: 'Northeast'
  }
});

console.log('Report ID:', report.reportId);
console.log('Total Area:', report.summary.totalArea);
console.log('Estimated Cost:', report.summary.estimatedCost);
```

### Python

```python
from susan_ai import SusanAI

client = SusanAI(api_key='your-api-key')

# Create measurement report
with open('roof-image-1.jpg', 'rb') as img1, \
     open('roof-image-2.jpg', 'rb') as img2:
    
    report = client.hover_eagle_view.create_measurement_report(
        address='123 Main St, Anytown, ST 12345',
        roof_type='gable',
        images=[img1, img2],
        preferences={
            'material_type': 'asphalt_shingles',
            'region': 'Northeast'
        }
    )

print(f"Report ID: {report['reportId']}")
print(f"Total Area: {report['summary']['totalArea']}")
print(f"Estimated Cost: {report['summary']['estimatedCost']}")
```

---

## Support

For technical support and API questions:

- **Documentation**: https://docs.susanai.com/hover-eagleview
- **Email**: api-support@susanai.com
- **Status Page**: https://status.susanai.com
- **Community Forum**: https://community.susanai.com

---

## Changelog

### v1.0.0 (2024-08-21)
- Initial release of Hover/EagleView Integration
- Support for 3D roof modeling and aerial imagery
- AI-enhanced measurement processing
- Quality validation and cross-source verification
- Integration with claim tracking system
- Material options and cost estimation
- 3D visualization and technical drawings