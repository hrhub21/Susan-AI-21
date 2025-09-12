/**
 * Qwen2.5-VL Vision Language Model Service
 * Bridges Susan AI Enhanced with the Qwen2.5-VL model running on port 3030
 * Provides real AI vision analysis for roofing damage detection
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class QwenVLService {
    constructor() {
        this.baseUrl = 'http://localhost:3031';
        this.isModelLoaded = false;
        this.checkInterval = null;
        this.startHealthCheck();
    }

    /**
     * Start health check to monitor Qwen model status
     */
    startHealthCheck() {
        // Check immediately
        this.checkModelStatus();
        
        // Then check every 5 seconds
        this.checkInterval = setInterval(() => {
            this.checkModelStatus();
        }, 5000);
    }

    /**
     * Check if Qwen model is loaded and ready
     */
    async checkModelStatus() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout for health checks
            
            const response = await fetch(`${this.baseUrl}/status`, {
                signal: controller.signal,
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const status = await response.json();
                if (status.model_loaded && !this.isModelLoaded) {
                    console.log('✅ Qwen2.5-VL model is ready for inference');
                    this.isModelLoaded = true;
                } else if (!status.model_loaded && this.isModelLoaded) {
                    console.log('⚠️ Qwen2.5-VL model is loading...');
                    this.isModelLoaded = false;
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                // Silent timeout on health checks
                if (this.isModelLoaded) {
                    this.isModelLoaded = false;
                }
            } else {
                // Only try fallback if not a timeout
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2000);
                    
                    const response = await fetch(`${this.baseUrl}/`, {
                        signal: controller.signal,
                        method: 'GET'
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.ok && !this.isModelLoaded) {
                        console.log('✅ Qwen2.5-VL model is ready for inference');
                        this.isModelLoaded = true;
                    }
                } catch (fallbackError) {
                    if (this.isModelLoaded) {
                        console.log('⚠️ Qwen2.5-VL model connection lost');
                        this.isModelLoaded = false;
                    }
                }
            }
        }
    }

    /**
     * Analyze image for roofing damage using Qwen2.5-VL
     * @param {Buffer|String} imageData - Image buffer or base64 string
     * @param {Object} options - Analysis options
     * @returns {Object} Analysis results
     */
    async analyzeRoofingDamage(imageData, options = {}) {
        try {
            // Check if model is loaded
            if (!this.isModelLoaded) {
                console.log('⏳ Waiting for Qwen2.5-VL model to load...');
                throw new Error('Model is still loading. Please try again in a few moments.');
            }

            // Convert base64 to buffer if needed
            let imageBuffer;
            if (typeof imageData === 'string') {
                // Remove data URL prefix if present
                const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
                imageBuffer = Buffer.from(base64Data, 'base64');
            } else {
                imageBuffer = imageData;
            }

            // Create form data for multipart upload (compatible with FastAPI)
            const formData = new FormData();
            
            // Add image as file with proper stream handling for FastAPI compatibility
            formData.append('image', imageBuffer, {
                filename: options.filename || 'image.jpg',
                contentType: options.mimeType || 'image/jpeg'
            });

            // Create specialized roofing analysis prompt
            const roofingPrompt = `You are an expert roofing inspector analyzing this image for insurance claims. Please provide a detailed analysis:

1. DAMAGE DETECTION:
   - Is this image of a roof or building? (Yes/No)
   - If not a roof, what does the image show?
   - If it is a roof, identify any visible damage:
     * Hail damage (dents, impact marks, granule loss)
     * Wind damage (lifted/missing shingles, exposed underlayment)
     * Water damage (stains, pooling, rot)
     * General wear (cracking, curling, aging)

2. SEVERITY ASSESSMENT:
   - Damage severity: None/Low/Moderate/High/Severe
   - Affected area estimate (percentage of visible roof)
   - Urgency of repairs needed

3. SPECIFIC OBSERVATIONS:
   - Material type (asphalt shingle, tile, metal, etc.)
   - Visible damage patterns
   - Areas of concern
   - Overall roof condition

4. RECOMMENDATIONS:
   - Immediate action needed?
   - Type of repair recommended
   - Professional inspection needed?

Provide your response in JSON format:
{
    "isRoofingImage": boolean,
    "imageContent": "description of what's in the image",
    "damageType": "specific damage type or 'No damage detected'",
    "severity": "None/Low/Moderate/High/Severe",
    "confidence": 0-100,
    "specificFindings": ["list of specific observations"],
    "affectedArea": "percentage estimate",
    "materialType": "detected roofing material",
    "urgency": "Low/Medium/High/Critical",
    "recommendations": ["list of recommendations"],
    "requiresProfessionalInspection": boolean,
    "analysisNotes": "additional professional notes"
}`;

            formData.append('question', roofingPrompt);

            // Send to Qwen2.5-VL for analysis
            console.log('🔍 Sending image to Qwen2.5-VL for roofing analysis...');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for analysis
            
            const response = await fetch(`${this.baseUrl}/analyze`, {
                method: 'POST',
                body: formData,
                signal: controller.signal
                // Let fetch automatically set the correct multipart/form-data headers
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Qwen analysis failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('📊 Qwen2.5-VL raw result:', JSON.stringify(result, null, 2));

            // Parse the Qwen response
            let analysisData;
            try {
                // Get the response text from Qwen (it uses 'response' not 'answer')
                const responseText = result.response || result.answer || '';
                
                // Extract JSON from the response, handling markdown code blocks
                let jsonMatch = responseText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
                if (!jsonMatch) {
                    // Fallback to plain JSON extraction
                    jsonMatch = responseText.match(/\{[\s\S]*\}/);
                }
                
                if (jsonMatch) {
                    const jsonString = jsonMatch[1] || jsonMatch[0];
                    analysisData = JSON.parse(jsonString);
                } else {
                    // Fallback: parse the text response into structured data
                    analysisData = this.parseTextResponse(responseText);
                }
            } catch (parseError) {
                console.warn('Failed to parse structured response, using text analysis');
                const responseText = result.response || result.answer || 'No response';
                analysisData = this.parseTextResponse(responseText);
            }

            // Format response for Susan AI Enhanced
            return {
                success: true,
                damageType: analysisData.damageType || 'Analysis completed',
                severity: analysisData.severity || 'Unknown',
                confidence: analysisData.confidence || 75,
                description: analysisData.imageContent || result.response || 'Analysis completed',
                findings: analysisData.specificFindings || [],
                recommendations: analysisData.recommendations || [],
                isRoofingImage: analysisData.isRoofingImage !== false,
                materialType: analysisData.materialType || 'Unknown',
                affectedArea: analysisData.affectedArea || 'Unknown',
                urgency: analysisData.urgency || 'Medium',
                requiresProfessionalInspection: analysisData.requiresProfessionalInspection || false,
                modelUsed: 'Qwen2.5-VL-7B',
                processingTime: result.processing_time || 0,
                timestamp: new Date().toISOString(),
                rawResponse: result.response || result.answer
            };

        } catch (error) {
            console.error('❌ Qwen analysis error:', error);
            
            let errorMessage = error.message;
            if (error.name === 'AbortError') {
                errorMessage = 'Analysis timeout after 60 seconds - image may be too large or complex';
            }
            
            // Return structured error response
            return {
                success: false,
                damageType: 'Analysis failed',
                severity: 'Unknown',
                confidence: 0,
                description: `Unable to analyze image: ${errorMessage}`,
                findings: [],
                recommendations: ['Please try again with a smaller image or contact support'],
                isRoofingImage: false,
                error: errorMessage,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Parse text response into structured data
     * @param {String} text - Raw text response from Qwen
     * @returns {Object} Parsed analysis data
     */
    parseTextResponse(text) {
        if (!text || typeof text !== 'string') {
            console.warn('Invalid text for parsing:', text);
            text = 'Unable to parse response';
        }
        const lowerText = text.toLowerCase();
        
        // Detect if it's not a roofing image
        const notRoofingKeywords = ['person', 'people', 'human', 'face', 'employee', 'staff', 'portrait'];
        const isRoofingImage = !notRoofingKeywords.some(keyword => lowerText.includes(keyword));
        
        // Detect damage types
        let damageType = 'No damage detected';
        let severity = 'None';
        let confidence = 95;
        
        if (lowerText.includes('hail')) {
            damageType = 'Hail damage';
            severity = this.extractSeverity(text);
            confidence = 85;
        } else if (lowerText.includes('wind')) {
            damageType = 'Wind damage';
            severity = this.extractSeverity(text);
            confidence = 85;
        } else if (lowerText.includes('water') || lowerText.includes('leak')) {
            damageType = 'Water damage';
            severity = this.extractSeverity(text);
            confidence = 80;
        } else if (lowerText.includes('wear') || lowerText.includes('aging')) {
            damageType = 'General wear';
            severity = 'Low';
            confidence = 75;
        }
        
        if (!isRoofingImage) {
            damageType = 'Not a roofing image';
            severity = 'None';
            confidence = 100;
        }
        
        return {
            isRoofingImage,
            imageContent: text.substring(0, 200),
            damageType,
            severity,
            confidence,
            specificFindings: this.extractFindings(text),
            recommendations: this.extractRecommendations(text)
        };
    }

    /**
     * Extract severity from text
     * @param {String} text - Text to analyze
     * @returns {String} Severity level
     */
    extractSeverity(text) {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('severe') || lowerText.includes('critical')) return 'Severe';
        if (lowerText.includes('high') || lowerText.includes('significant')) return 'High';
        if (lowerText.includes('moderate') || lowerText.includes('medium')) return 'Moderate';
        if (lowerText.includes('low') || lowerText.includes('minor')) return 'Low';
        return 'Moderate';
    }

    /**
     * Extract findings from text
     * @param {String} text - Text to analyze
     * @returns {Array} List of findings
     */
    extractFindings(text) {
        const findings = [];
        const lines = text.split('\n');
        
        for (const line of lines) {
            if (line.includes('damage') || line.includes('found') || line.includes('observed')) {
                findings.push(line.trim());
                if (findings.length >= 3) break;
            }
        }
        
        return findings.length > 0 ? findings : ['Analysis completed'];
    }

    /**
     * Extract recommendations from text
     * @param {String} text - Text to analyze
     * @returns {Array} List of recommendations
     */
    extractRecommendations(text) {
        const recommendations = [];
        const lines = text.split('\n');
        
        for (const line of lines) {
            if (line.includes('recommend') || line.includes('should') || line.includes('need')) {
                recommendations.push(line.trim());
                if (recommendations.length >= 3) break;
            }
        }
        
        return recommendations.length > 0 ? recommendations : ['Professional inspection recommended'];
    }

    /**
     * Analyze document for roofing/insurance content using Qwen2.5-VL
     * @param {String} documentData - Base64 document data
     * @param {Object} options - Analysis options
     * @returns {Object} Analysis results
     */
    async analyzeDocument(documentData, options = {}) {
        try {
            // Check if model is loaded
            if (!this.isModelLoaded) {
                console.log('⏳ Waiting for Qwen2.5-VL model to load...');
                throw new Error('Model is still loading. Please try again in a few moments.');
            }

            // Convert base64 to buffer if needed
            let imageBuffer;
            if (typeof documentData === 'string') {
                // Remove data URL prefix if present
                const base64Data = documentData.replace(/^data:[^;]+;base64,/, '');
                imageBuffer = Buffer.from(base64Data, 'base64');
            } else {
                imageBuffer = documentData;
            }

            // Create form data for multipart upload
            const formData = new FormData();
            
            // Add document as image file (PDFs converted to images by frontend)
            formData.append('image', imageBuffer, {
                filename: options.filename || 'document.jpg',
                contentType: options.mimeType || 'image/jpeg'
            });

            // Create specialized document analysis prompt
            const documentPrompt = `You are an expert insurance document analyzer. Please analyze this document image and extract key information:

1. DOCUMENT IDENTIFICATION:
   - What type of document is this? (Insurance form, contract, estimate, report, etc.)
   - Is this related to roofing or property damage?
   - Document completeness (fully filled out, partial, blank)

2. KEY INFORMATION EXTRACTION:
   - Policy numbers or claim numbers (if visible)
   - Property address or location
   - Date information (inspection dates, incident dates)
   - Damage descriptions or findings
   - Cost estimates or amounts
   - Insurance company information
   - Contact information

3. PROFESSIONAL ASSESSMENT:
   - Document quality and legibility
   - Missing required fields
   - Compliance with standard insurance forms
   - Recommended next steps

4. CONTENT ANALYSIS:
   - Main purpose of the document
   - Critical information present
   - Areas requiring attention or completion

Provide your response in JSON format:
{
    "documentType": "specific document type",
    "isRoofingRelated": boolean,
    "completenessScore": 0-100,
    "extractedInfo": {
        "policyNumber": "extracted or null",
        "claimNumber": "extracted or null", 
        "propertyAddress": "extracted or null",
        "inspectionDate": "extracted or null",
        "incidentDate": "extracted or null",
        "damageDescription": "extracted or null",
        "estimatedCost": "extracted or null",
        "insuranceCompany": "extracted or null"
    },
    "keyFindings": ["list of key findings"],
    "missingFields": ["list of missing required fields"],
    "documentQuality": "Poor/Fair/Good/Excellent",
    "confidence": 0-100,
    "recommendations": ["list of recommendations"],
    "nextSteps": ["list of recommended next steps"],
    "analysisNotes": "additional professional notes"
}`;

            formData.append('question', documentPrompt);

            // Send to Qwen2.5-VL for analysis
            console.log('📄 Sending document to Qwen2.5-VL for analysis...');
            const response = await fetch(`${this.baseUrl}/analyze`, {
                method: 'POST',
                body: formData
                // Let fetch automatically set the correct multipart/form-data headers
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Qwen document analysis failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('📊 Qwen2.5-VL document analysis result:', JSON.stringify(result, null, 2));

            // Parse the Qwen response
            let analysisData;
            try {
                const responseText = result.response || result.answer || '';
                
                // Extract JSON from the response if it's embedded in text
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    analysisData = JSON.parse(jsonMatch[0]);
                } else {
                    // Fallback: parse the text response into structured data
                    analysisData = this.parseDocumentTextResponse(responseText);
                }
            } catch (parseError) {
                console.warn('Failed to parse structured document response, using text analysis');
                const responseText = result.response || result.answer || 'No response';
                analysisData = this.parseDocumentTextResponse(responseText);
            }

            // Format response for Susan AI Enhanced
            return {
                success: true,
                documentType: analysisData.documentType || 'Unknown Document',
                isRoofingRelated: analysisData.isRoofingRelated !== false,
                completenessScore: analysisData.completenessScore || 50,
                extractedInfo: analysisData.extractedInfo || {},
                keyFindings: analysisData.keyFindings || [],
                missingFields: analysisData.missingFields || [],
                documentQuality: analysisData.documentQuality || 'Fair',
                confidence: analysisData.confidence || 75,
                recommendations: analysisData.recommendations || [],
                nextSteps: analysisData.nextSteps || [],
                modelUsed: 'Qwen2.5-VL-7B',
                processingTime: result.processing_time || 0,
                timestamp: new Date().toISOString(),
                rawResponse: result.response || result.answer
            };

        } catch (error) {
            console.error('❌ Qwen document analysis error:', error);
            
            // Return structured error response
            return {
                success: false,
                documentType: 'Analysis failed',
                confidence: 0,
                keyFindings: [],
                recommendations: ['Please try again or contact support'],
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Parse document text response into structured data
     * @param {String} text - Raw text response from Qwen
     * @returns {Object} Parsed document analysis data
     */
    parseDocumentTextResponse(text) {
        if (!text || typeof text !== 'string') {
            console.warn('Invalid text for document parsing:', text);
            text = 'Unable to parse response';
        }
        const lowerText = text.toLowerCase();
        
        // Detect document type
        let documentType = 'Unknown Document';
        if (lowerText.includes('insurance') && lowerText.includes('form')) {
            documentType = 'Insurance Form';
        } else if (lowerText.includes('estimate')) {
            documentType = 'Repair Estimate';
        } else if (lowerText.includes('contract')) {
            documentType = 'Contract';
        } else if (lowerText.includes('report')) {
            documentType = 'Inspection Report';
        }

        // Check if roofing related
        const roofingKeywords = ['roof', 'shingle', 'gutter', 'hail', 'wind', 'storm', 'property'];
        const isRoofingRelated = roofingKeywords.some(keyword => lowerText.includes(keyword));

        return {
            documentType,
            isRoofingRelated,
            completenessScore: 75,
            extractedInfo: this.extractDocumentInfo(text),
            keyFindings: this.extractDocumentFindings(text),
            documentQuality: 'Fair',
            confidence: 80,
            recommendations: ['Review document details', 'Verify extracted information'],
            nextSteps: ['Complete any missing fields', 'Proceed with processing']
        };
    }

    /**
     * Extract document information from text
     * @param {String} text - Text to analyze
     * @returns {Object} Extracted info
     */
    extractDocumentInfo(text) {
        const info = {};
        const lines = text.split('\n');
        
        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('policy') && lowerLine.includes('number')) {
                const match = line.match(/\b\d{6,}\b/);
                if (match) info.policyNumber = match[0];
            }
            if (lowerLine.includes('claim') && lowerLine.includes('number')) {
                const match = line.match(/\b\d{6,}\b/);
                if (match) info.claimNumber = match[0];
            }
        }
        
        return info;
    }

    /**
     * Extract document findings from text
     * @param {String} text - Text to analyze
     * @returns {Array} List of findings
     */
    extractDocumentFindings(text) {
        const findings = [];
        const lines = text.split('\n');
        
        for (const line of lines) {
            if (line.includes('found') || line.includes('contains') || line.includes('shows')) {
                findings.push(line.trim());
                if (findings.length >= 3) break;
            }
        }
        
        return findings.length > 0 ? findings : ['Document analysis completed'];
    }

    /**
     * Analyze image for damage quantification using Qwen2.5-VL
     * @param {Buffer|String} imageData - Image buffer or base64 string
     * @param {Object} options - Analysis options
     * @returns {Object} Quantification results
     */
    async quantifyDamage(imageData, options = {}) {
        try {
            // Check if model is loaded
            if (!this.isModelLoaded) {
                console.log('⏳ Waiting for Qwen2.5-VL model to load...');
                throw new Error('Model is still loading. Please try again in a few moments.');
            }

            // Convert base64 to buffer if needed
            let imageBuffer;
            if (typeof imageData === 'string') {
                // Remove data URL prefix if present
                const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
                imageBuffer = Buffer.from(base64Data, 'base64');
            } else {
                imageBuffer = imageData;
            }

            // Create form data for multipart upload
            const formData = new FormData();
            
            // Add image as file
            formData.append('image', imageBuffer, {
                filename: options.filename || 'damage_analysis.jpg',
                contentType: options.mimeType || 'image/jpeg'
            });

            // Create specialized damage quantification prompt
            const quantificationPrompt = `You are a professional roofing damage quantification expert. Analyze this image and provide precise damage counting and assessment:

1. DAMAGE COUNTING & IDENTIFICATION:
   - Count all visible impact marks, dents, or damage points
   - Identify the type of each damage (hail impact, crack, puncture, etc.)
   - Estimate the size of each impact (small <1", medium 1-2", large >2")
   - Note the pattern and distribution of damage

2. AREA ASSESSMENT:
   - Estimate the total visible roof area in the image (in square feet)
   - Calculate damage density (impacts per square foot)
   - Identify the most heavily damaged areas
   - Assess overall coverage percentage of damage

3. QUANTITATIVE ANALYSIS:
   - Total impact count
   - Damage severity distribution (light, moderate, severe impacts)
   - Average impact size
   - Estimated repair area needed

4. PROFESSIONAL ASSESSMENT:
   - Insurance claim viability based on density
   - Urgency of repairs
   - Overall roof condition assessment

Provide your response in JSON format:
{
    "totalImpacts": number,
    "impactsBySize": {
        "small": number,
        "medium": number, 
        "large": number
    },
    "impactsByType": {
        "hailDamage": number,
        "windDamage": number,
        "wearDamage": number,
        "other": number
    },
    "areaAnalysis": {
        "totalVisibleArea": number,
        "impactsPerSqFt": number,
        "damagePercentage": number,
        "heavilyDamagedAreas": ["list of areas"]
    },
    "severity": "Low/Moderate/High/Severe",
    "confidence": 0-100,
    "claimViability": "Poor/Fair/Good/Excellent",
    "urgency": "Low/Medium/High/Critical",
    "repairRecommendation": "Monitor/Minor Repair/Major Repair/Replace",
    "detailedFindings": ["specific observations"],
    "quantificationNotes": "professional assessment notes"
}`;

            formData.append('question', quantificationPrompt);

            // Send to Qwen2.5-VL for analysis
            console.log('🔢 Sending image to Qwen2.5-VL for damage quantification...');
            const response = await fetch(`${this.baseUrl}/analyze`, {
                method: 'POST',
                body: formData
                // Let fetch automatically set the correct multipart/form-data headers
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Qwen quantification failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('📊 Qwen2.5-VL quantification result:', JSON.stringify(result, null, 2));

            // Parse the Qwen response
            let analysisData;
            try {
                // Get the response text from Qwen
                const responseText = result.response || result.answer || '';
                
                // Extract JSON from the response if it's embedded in text
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    analysisData = JSON.parse(jsonMatch[0]);
                } else {
                    // Fallback: parse the text response into quantification data
                    analysisData = this.parseQuantificationTextResponse(responseText);
                }
            } catch (parseError) {
                console.warn('Failed to parse structured quantification response, using text analysis');
                const responseText = result.response || result.answer || 'No response';
                analysisData = this.parseQuantificationTextResponse(responseText);
            }

            // Format response for Susan AI Enhanced
            return {
                success: true,
                totalImpacts: analysisData.totalImpacts || 0,
                impactsBySize: analysisData.impactsBySize || { small: 0, medium: 0, large: 0 },
                impactsByType: analysisData.impactsByType || { hailDamage: 0, windDamage: 0, wearDamage: 0, other: 0 },
                areaAnalysis: analysisData.areaAnalysis || { 
                    totalVisibleArea: 100, 
                    impactsPerSqFt: 0, 
                    damagePercentage: 0,
                    heavilyDamagedAreas: []
                },
                severity: analysisData.severity || 'Low',
                confidence: analysisData.confidence || 75,
                claimViability: analysisData.claimViability || 'Fair',
                urgency: analysisData.urgency || 'Medium',
                repairRecommendation: analysisData.repairRecommendation || 'Monitor',
                detailedFindings: analysisData.detailedFindings || [],
                quantificationNotes: analysisData.quantificationNotes || 'AI quantification completed',
                modelUsed: 'Qwen2.5-VL-7B',
                processingTime: result.processing_time || 0,
                timestamp: new Date().toISOString(),
                rawResponse: result.response || result.answer
            };

        } catch (error) {
            console.error('❌ Qwen quantification error:', error);
            
            // Return structured error response
            return {
                success: false,
                totalImpacts: 0,
                severity: 'Unknown',
                confidence: 0,
                detailedFindings: [],
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Parse quantification text response into structured data
     * @param {String} text - Raw text response from Qwen
     * @returns {Object} Parsed quantification data
     */
    parseQuantificationTextResponse(text) {
        if (!text || typeof text !== 'string') {
            console.warn('Invalid text for quantification parsing:', text);
            text = 'Unable to parse response';
        }
        const lowerText = text.toLowerCase();
        
        // Extract impact counts using regex
        let totalImpacts = 0;
        const impactMatches = text.match(/(\d+)\s*(impact|dent|damage|mark)/gi);
        if (impactMatches && impactMatches.length > 0) {
            // Take the highest number mentioned as total impacts
            const numbers = impactMatches.map(match => parseInt(match.match(/\d+/)[0]));
            totalImpacts = Math.max(...numbers);
        }
        
        // Estimate area if mentioned
        let estimatedArea = 100; // default
        const areaMatches = text.match(/(\d+)\s*(sq|square)\s*(ft|feet)/gi);
        if (areaMatches && areaMatches.length > 0) {
            estimatedArea = parseInt(areaMatches[0].match(/\d+/)[0]);
        }
        
        // Determine severity based on keywords
        let severity = 'Low';
        if (lowerText.includes('severe') || lowerText.includes('heavy')) {
            severity = 'Severe';
        } else if (lowerText.includes('moderate') || lowerText.includes('significant')) {
            severity = 'Moderate';
        } else if (lowerText.includes('high') || lowerText.includes('extensive')) {
            severity = 'High';
        }
        
        return {
            totalImpacts,
            impactsBySize: {
                small: Math.round(totalImpacts * 0.6),
                medium: Math.round(totalImpacts * 0.3),
                large: Math.round(totalImpacts * 0.1)
            },
            areaAnalysis: {
                totalVisibleArea: estimatedArea,
                impactsPerSqFt: (totalImpacts / estimatedArea).toFixed(1),
                damagePercentage: Math.min((totalImpacts / estimatedArea) * 10, 100),
                heavilyDamagedAreas: []
            },
            severity,
            confidence: 80,
            claimViability: severity === 'Low' ? 'Fair' : severity === 'Moderate' ? 'Good' : 'Excellent',
            detailedFindings: [text.substring(0, 150)]
        };
    }

    /**
     * Test if Qwen service is available
     * @returns {Boolean} Service availability
     */
    async testConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * Alias for analyzeRoofingDamage to maintain compatibility
     * @param {Buffer|String} imageData - Image buffer or base64 string
     * @param {String} filename - Optional filename
     * @returns {Object} Analysis results
     */
    async analyzeRoofingImage(imageData, filename) {
        return this.analyzeRoofingDamage(imageData, { filename });
    }

    /**
     * Check if service is available
     * @returns {Object} Availability status
     */
    async isAvailable() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
            
            const response = await fetch(`${this.baseUrl}/status`, {
                signal: controller.signal,
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const status = await response.json();
                return {
                    available: true,
                    modelLoaded: status.model_loaded || false,
                    modelName: status.model_name || 'Qwen2.5-VL-7B-Instruct',
                    device: status.device || 'unknown',
                    parameters: status.parameters || 'unknown'
                };
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('QwenVL service check timeout after 3 seconds');
            } else {
                console.warn('QwenVL service check failed:', error.message);
            }
        }
        
        return {
            available: false,
            modelLoaded: false,
            modelName: 'Qwen2.5-VL-7B-Instruct',
            device: 'unavailable',
            parameters: 'unavailable'
        };
    }

    /**
     * Get detailed health information
     * @returns {Object} Health information
     */
    async getHealthInfo() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
            
            const response = await fetch(`${this.baseUrl}/status`, {
                signal: controller.signal,
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const status = await response.json();
                return {
                    susanAI: {
                        available: true,
                        modelName: status.model_name || 'Qwen2.5-VL-7B-Instruct',
                        device: status.device || 'unknown',
                        parameters: status.parameters || 'unknown',
                        modelLoaded: status.model_loaded || false,
                        processorLoaded: status.processor_loaded || false
                    },
                    configuration: {
                        baseUrl: this.baseUrl,
                        healthCheckInterval: '5 seconds',
                        timeout: '3 seconds'
                    }
                };
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('QwenVL health check timeout after 3 seconds');
            } else {
                console.warn('QwenVL health check failed:', error.message);
            }
        }
        
        return {
            susanAI: {
                available: false,
                modelName: 'Qwen2.5-VL-7B-Instruct',
                device: 'unavailable',
                parameters: 'unavailable',
                modelLoaded: false,
                processorLoaded: false,
                error: 'Service unavailable or timeout'
            },
            configuration: {
                baseUrl: this.baseUrl,
                healthCheckInterval: '5 seconds',
                timeout: '3 seconds'
            }
        };
    }

    /**
     * Clean up resources
     */
    cleanup() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
}

// Export singleton instance
const qwenService = new QwenVLService();
export default qwenService;