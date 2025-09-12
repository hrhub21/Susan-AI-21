# Susan AI - Comprehensive OCR System for Insurance Documents

## Overview

The Susan AI Enhanced OCR System is a comprehensive solution for extracting text and structured data from insurance documents. It features advanced OCR engines, specialized insurance document recognition, intelligent field mapping, and seamless integration with claim tracking workflows.

## Features

### 🔍 Advanced OCR Engine
- **Multiple OCR Engines**: Tesseract.js, Google Vision API, AWS Textract with intelligent fallback
- **High Accuracy**: Automatic engine selection based on confidence scores
- **Image Enhancement**: Preprocessing for improved OCR accuracy
- **Multi-format Support**: PDF, PNG, JPG, TIFF, BMP files

### 📋 Insurance Document Recognition
- **Specialized Templates**: Pre-configured templates for insurance forms and policies
- **Document Classification**: Automatic identification of document types
- **Field Mapping**: Intelligent extraction of key insurance fields
- **Quality Assessment**: Confidence scoring and accuracy validation

### 🔄 Integration Features
- **Claim Tracking Integration**: Automatic claim updates with extracted data
- **Workflow Automation**: Triggered workflows based on document types
- **Real-time Processing**: Immediate processing with progress tracking
- **Batch Processing**: Efficient handling of multiple documents

### 🌐 Multi-Language Support
- **Language Detection**: Automatic language identification
- **Supported Languages**: English, Spanish, French
- **Regional Formats**: Support for different date and currency formats

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Susan AI OCR System                      │
├─────────────────────────────────────────────────────────────┤
│  API Endpoints                                              │
│  ├── /api/v1/ocr/*                (Core OCR Operations)    │
│  └── /api/v1/claim-ocr/*          (Claim Integration)      │
├─────────────────────────────────────────────────────────────┤
│  Services Layer                                             │
│  ├── DocumentOCRService           (Core OCR Processing)    │
│  ├── OCRClaimIntegrationService   (Claim Integration)      │
│  └── ClaimTrackingDashboardService (Claim Management)      │
├─────────────────────────────────────────────────────────────┤
│  OCR Engines                                                │
│  ├── Tesseract.js                 (Local Processing)       │
│  ├── Google Vision API            (Cloud Service)          │
│  └── AWS Textract                 (Cloud Service)          │
├─────────────────────────────────────────────────────────────┤
│  Document Templates                                         │
│  ├── Claim Forms                  (Insurance Claims)       │
│  ├── Policy Documents             (Insurance Policies)     │
│  ├── Estimate Forms               (Repair Estimates)       │
│  └── Inspection Reports           (Property Inspections)   │
└─────────────────────────────────────────────────────────────┘
```

## Installation & Setup

### 1. Dependencies

The OCR system requires several dependencies that are already included in the package.json:

```json
{
  "tesseract.js": "^5.1.0",
  "form-data": "^4.0.0",
  "sharp": "^0.34.3",
  "jimp": "^1.6.0",
  "multer": "^1.4.5-lts.1"
}
```

### 2. Environment Configuration

Set up your environment variables for cloud OCR services:

```bash
# Google Vision API (Optional)
GOOGLE_VISION_API_KEY=your_google_vision_api_key

# AWS Textract (Optional)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
```

### 3. System Requirements

- **Node.js**: 18.0 or higher
- **Memory**: 4GB RAM minimum for optimal performance
- **Storage**: 2GB free space for temporary processing files
- **Network**: Internet access for cloud OCR services (optional)

### 4. External Dependencies (Optional)

For PDF processing and enhanced image conversion:

```bash
# Install poppler-utils for PDF conversion (Linux/Mac)
sudo apt-get install poppler-utils  # Ubuntu/Debian
brew install poppler               # macOS

# For Windows, download from: https://poppler.freedesktop.org/
```

## API Documentation

### Core OCR Endpoints

#### 1. Process Single Document
```http
POST /api/v1/ocr/process
Content-Type: multipart/form-data

Form Data:
- document: [file] Document to process
- language: [string] Document language (en, es, fr)
- documentType: [string] Expected document type (auto, claim_form, policy_document, estimate_form, inspection_report)
- preferredEngine: [string] OCR engine preference (auto, tesseract, google, aws)
- enhanceImage: [boolean] Apply image preprocessing (default: true)
- extractStructuredData: [boolean] Extract structured fields (default: true)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "filePath": "/path/to/document.pdf",
    "fileName": "insurance_claim.pdf",
    "documentType": "claim_form",
    "language": "en",
    "engine": "tesseract",
    "text": "Extracted text content...",
    "confidence": 0.89,
    "structuredData": {
      "documentType": "claim_form",
      "confidence": 0.8,
      "fields": {
        "policy_number": {
          "value": "POL-123456789",
          "confidence": 0.95,
          "position": 245
        },
        "claim_number": {
          "value": "CLM-987654321",
          "confidence": 0.92,
          "position": 389
        }
      }
    },
    "qualityAssessment": {
      "overallScore": 0.85,
      "quality": "good",
      "issues": [],
      "recommendations": []
    }
  }
}
```

#### 2. Batch Process Documents
```http
POST /api/v1/ocr/batch
Content-Type: multipart/form-data

Form Data:
- documents: [files] Multiple documents to process
- language: [string] Document language
- maxConcurrent: [integer] Maximum concurrent processing (1-5)
- stopOnError: [boolean] Stop processing if any document fails
```

#### 3. Classify Document Type
```http
POST /api/v1/ocr/classify
Content-Type: multipart/form-data

Form Data:
- document: [file] Document to classify
- language: [string] Document language
```

### Claim Integration Endpoints

#### 1. Process Documents for Claim
```http
POST /api/v1/claim-ocr/process-documents
Content-Type: multipart/form-data

Form Data:
- claimId: [string] ID of the claim to associate documents with
- documents: [files] Insurance documents to process
- documentTypes: [string] Comma-separated expected document types
- autoUpdate: [boolean] Automatically update claim with extracted data
- language: [string] Document language
```

#### 2. Create Claim from Documents
```http
POST /api/v1/claim-ocr/create-claim-from-documents
Content-Type: multipart/form-data

Form Data:
- documents: [files] Insurance documents
- propertyAddress: [string] Property address
- contactInfo: [object] Contact information
- language: [string] Document language
```

## Document Types & Templates

### 1. Claim Forms
**Fields Extracted:**
- Policy Number
- Claim Number
- Date of Loss
- Claim Amount
- Insured Name
- Adjuster Information

**File Patterns:**
- Keywords: claim, policy holder, loss, damage, adjuster
- Typical formats: PDF forms, scanned documents

### 2. Policy Documents
**Fields Extracted:**
- Policy Number
- Effective Date
- Expiration Date
- Premium Amount
- Coverage Amount
- Deductible

**File Patterns:**
- Keywords: policy, coverage, premium, effective date
- Typical formats: Multi-page PDF documents

### 3. Estimate Forms
**Fields Extracted:**
- Estimate Number
- Total Amount
- Date
- Contractor Information
- Scope of Work

**File Patterns:**
- Keywords: estimate, repair, contractor, materials
- Typical formats: Contractor estimates, repair quotes

### 4. Inspection Reports
**Fields Extracted:**
- Report Number
- Inspection Date
- Property Address
- Inspector Name
- Damage Assessment

**File Patterns:**
- Keywords: inspection, property, condition, assessment
- Typical formats: Professional inspection reports

## Usage Examples

### JavaScript Client Example

```javascript
// Process a single insurance document
const processDocument = async (file) => {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('language', 'en');
  formData.append('documentType', 'auto');
  formData.append('enhanceImage', 'true');

  const response = await fetch('/api/v1/ocr/process', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer your-api-token'
    },
    body: formData
  });

  const result = await response.json();
  return result.data;
};

// Process documents for an existing claim
const processClaimDocuments = async (claimId, files) => {
  const formData = new FormData();
  formData.append('claimId', claimId);
  formData.append('autoUpdate', 'true');
  
  files.forEach(file => {
    formData.append('documents', file);
  });

  const response = await fetch('/api/v1/claim-ocr/process-documents', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer your-api-token'
    },
    body: formData
  });

  return await response.json();
};
```

### Python Client Example

```python
import requests

def process_document(file_path, api_token):
    """Process a single document with OCR"""
    
    with open(file_path, 'rb') as file:
        files = {'document': file}
        data = {
            'language': 'en',
            'documentType': 'auto',
            'enhanceImage': 'true',
            'extractStructuredData': 'true'
        }
        headers = {'Authorization': f'Bearer {api_token}'}
        
        response = requests.post(
            'http://localhost:3000/api/v1/ocr/process',
            files=files,
            data=data,
            headers=headers
        )
        
        return response.json()

def create_claim_from_documents(document_paths, property_address, api_token):
    """Create a new claim from uploaded documents"""
    
    files = []
    for path in document_paths:
        files.append(('documents', open(path, 'rb')))
    
    data = {
        'propertyAddress': property_address,
        'language': 'en'
    }
    headers = {'Authorization': f'Bearer {api_token}'}
    
    response = requests.post(
        'http://localhost:3000/api/v1/claim-ocr/create-claim-from-documents',
        files=files,
        data=data,
        headers=headers
    )
    
    # Close file handles
    for _, file_handle in files:
        file_handle.close()
    
    return response.json()
```

## Configuration

### OCR Engine Configuration

The system automatically selects the best available OCR engine based on:

1. **Engine Availability**: Checks API keys and service status
2. **Confidence Scores**: Historical performance data
3. **Document Type**: Some engines perform better on specific document types
4. **Fallback Strategy**: Automatic retry with different engines

### Quality Thresholds

```javascript
const qualityThresholds = {
    excellent: 0.95,  // Very high confidence, minimal review needed
    good: 0.85,       // Good confidence, spot check recommended
    acceptable: 0.70, // Acceptable confidence, review recommended
    poor: 0.50        // Poor confidence, manual review required
};
```

### Processing Limits

- **File Size**: 100MB maximum per document
- **Batch Size**: 10 documents per batch request
- **Concurrent Processing**: 5 documents maximum
- **Rate Limits**: Applied per API key/user

## Monitoring & Analytics

### Processing Statistics

Access processing statistics via:
```http
GET /api/v1/ocr/statistics
GET /api/v1/claim-ocr/statistics
```

**Metrics Tracked:**
- Documents processed
- Success/failure rates
- Average processing times
- Engine usage statistics
- Confidence score distributions

### Health Monitoring

```http
GET /api/v1/ocr/health
GET /api/v1/claim-ocr/health
```

**Health Indicators:**
- OCR engine availability
- Service connectivity
- Processing queue status
- Memory usage
- Error rates

## Troubleshooting

### Common Issues

#### 1. Low OCR Confidence
**Symptoms**: Confidence scores below 0.7, inaccurate text extraction
**Solutions**:
- Enable image enhancement
- Try different OCR engines
- Scan documents at higher resolution (300 DPI minimum)
- Ensure good lighting and contrast

#### 2. Missing Field Extraction
**Symptoms**: Required fields not detected in structured data
**Solutions**:
- Verify document type classification
- Check document template configuration
- Ensure clear field labels and values
- Review pattern matching rules

#### 3. Processing Failures
**Symptoms**: OCR processing returns errors
**Solutions**:
- Check file format compatibility
- Verify file size limits
- Ensure stable network connection for cloud engines
- Review API key configuration

#### 4. Slow Processing
**Symptoms**: Long processing times
**Solutions**:
- Optimize image preprocessing
- Use local Tesseract for simple documents
- Implement batch processing for multiple documents
- Monitor system resources

### Error Codes

- **400**: Invalid file format or missing parameters
- **401**: Authentication required or invalid API key
- **404**: Claim or processing ID not found
- **413**: File size exceeds limits
- **429**: Rate limit exceeded
- **500**: Internal processing error
- **503**: OCR service temporarily unavailable

### Logging

The system provides comprehensive logging for debugging:

```javascript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Log locations
// - Processing events: logs/ocr-processing.log
// - Error events: logs/ocr-errors.log
// - Performance metrics: logs/ocr-performance.log
```

## Performance Optimization

### Image Preprocessing

- **Resolution**: Optimal range 200-300 DPI
- **Format**: PNG for best quality, JPEG for smaller files
- **Contrast**: High contrast improves recognition
- **Noise Reduction**: Automatic filtering applied

### Engine Selection

- **Tesseract**: Best for simple text documents, offline processing
- **Google Vision**: Excellent for complex layouts, handwriting
- **AWS Textract**: Superior for forms and tables

### Batch Processing

- **Concurrent Limits**: Balance speed vs. resource usage
- **Queue Management**: FIFO processing with priority options
- **Error Handling**: Graceful failure handling with retry logic

## Security & Compliance

### Data Protection

- **Temporary Storage**: Documents deleted after processing
- **Encryption**: In-transit and at-rest encryption
- **Access Control**: API-based authentication and authorization
- **Audit Logging**: Complete processing audit trail

### Privacy Considerations

- **PII Handling**: Sensitive data identification and masking
- **Retention Policies**: Configurable data retention periods
- **Compliance**: GDPR, CCPA, and insurance industry standards

## Support & Maintenance

### Regular Maintenance

- **Engine Updates**: Keep OCR engines updated
- **Template Updates**: Update document templates as forms change
- **Performance Monitoring**: Regular performance review
- **Error Analysis**: Analyze and address common errors

### Support Resources

- **Documentation**: This README and inline code documentation
- **API Reference**: OpenAPI/Swagger documentation
- **Issue Tracking**: GitHub issues for bug reports and feature requests
- **Community**: Developer community forum

## Roadmap

### Planned Features

- **Advanced ML Models**: Custom trained models for insurance documents
- **Real-time Collaboration**: Multi-user document processing
- **Mobile SDK**: Mobile app integration
- **Advanced Analytics**: Predictive processing analytics
- **API Webhooks**: Event-driven processing notifications

### Integration Enhancements

- **CRM Integration**: Direct integration with popular CRM systems
- **Document Management**: Integration with document management systems
- **Workflow Automation**: Advanced workflow automation capabilities
- **Reporting**: Enhanced reporting and dashboard features

---

For technical support or feature requests, please contact the Susan AI development team or create an issue in the project repository.