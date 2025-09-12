/**
 * Simple Qwen2.5-VL Vision Language Model Service
 * Lightweight version without complex health checking to avoid deadlocks
 */

import fetch from 'node-fetch';
import FormData from 'form-data';

class SimpleQwenVLService {
    constructor() {
        this.baseUrl = 'http://localhost:3031';
        console.log('🤖 Simple QwenVL Service initialized (no health checks)');
    }

    /**
     * Analyze image for roofing damage using Qwen2.5-VL
     * @param {Buffer|String} imageData - Image buffer or base64 string
     * @param {Object} options - Analysis options
     * @returns {Object} Analysis results
     */
    async analyzeRoofingDamage(imageData, options = {}) {
        try {
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
                filename: options.filename || 'image.jpg',
                contentType: options.mimeType || 'image/jpeg'
            });

            // Create roofing analysis prompt
            const roofingPrompt = `You are an expert roofing inspector analyzing this image for insurance claims. Please provide a detailed analysis:

1. DAMAGE DETECTION:
   - Is this image of a roof or building?
   - If it is a roof, identify any visible damage:
     * Hail damage (dents, impact marks, granule loss)
     * Wind damage (lifted/missing shingles, exposed underlayment)
     * Water damage (stains, pooling, rot)
     * General wear (cracking, curling, aging)

2. SEVERITY ASSESSMENT:
   - Damage severity: None/Low/Moderate/High/Severe
   - Affected area estimate
   - Urgency of repairs needed

3. PROFESSIONAL RECOMMENDATIONS:
   - Immediate action needed?
   - Type of repair recommended
   - Professional inspection needed?

Provide your response in JSON format:
{
    "isRoofingImage": boolean,
    "damageType": "specific damage type or 'No damage detected'",
    "severity": "None/Low/Moderate/High/Severe",
    "confidence": 0-100,
    "description": "detailed description",
    "findings": ["list of specific observations"],
    "recommendations": ["list of recommendations"]
}`;

            formData.append('question', roofingPrompt);

            // Send to Qwen2.5-VL for analysis
            console.log('🔍 Sending image to Qwen2.5-VL for analysis...');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
            
            const response = await fetch(`${this.baseUrl}/analyze`, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Qwen analysis failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('📊 Qwen2.5-VL analysis completed');

            // Parse the response
            let analysisData;
            try {
                const responseText = result.response || result.answer || '';
                
                // Extract JSON from the response
                let jsonMatch = responseText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
                if (!jsonMatch) {
                    jsonMatch = responseText.match(/\{[\s\S]*\}/);
                }
                
                if (jsonMatch) {
                    const jsonString = jsonMatch[1] || jsonMatch[0];
                    analysisData = JSON.parse(jsonString);
                } else {
                    // Fallback: parse the text response
                    analysisData = this.parseTextResponse(responseText);
                }
            } catch (parseError) {
                console.warn('Failed to parse structured response, using text analysis');
                const responseText = result.response || result.answer || 'No response';
                analysisData = this.parseTextResponse(responseText);
            }

            // Format response
            return {
                success: true,
                damageType: analysisData.damageType || 'Analysis completed',
                severity: analysisData.severity || 'Unknown',
                confidence: analysisData.confidence || 75,
                description: analysisData.description || result.response || 'Analysis completed',
                findings: analysisData.findings || [],
                recommendations: analysisData.recommendations || [],
                isRoofingImage: analysisData.isRoofingImage !== false,
                modelUsed: 'Qwen2.5-VL-7B',
                processingTime: result.processing_time || 0,
                timestamp: new Date().toISOString(),
                rawResponse: result.response || result.answer
            };

        } catch (error) {
            console.error('❌ Qwen analysis error:', error);
            
            let errorMessage = error.message;
            if (error.name === 'AbortError') {
                errorMessage = 'Analysis timeout after 60 seconds';
            }
            
            return {
                success: false,
                damageType: 'Analysis failed',
                severity: 'Unknown',
                confidence: 0,
                description: `Unable to analyze image: ${errorMessage}`,
                findings: [],
                recommendations: ['Please try again or contact support'],
                isRoofingImage: false,
                error: errorMessage,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Alias for backward compatibility
     */
    async analyzeRoofingImage(imageData, filename) {
        return this.analyzeRoofingDamage(imageData, { filename });
    }

    /**
     * Simple availability check (no complex health monitoring)
     * @returns {Object} Availability status
     */
    async isAvailable() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(`${this.baseUrl}/status`, {
                signal: controller.signal
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
            // Silent fail
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
     * Simple health info (no complex monitoring)
     */
    async getHealthInfo() {
        const status = await this.isAvailable();
        return {
            susanAI: status,
            configuration: {
                baseUrl: this.baseUrl,
                timeout: '60 seconds'
            }
        };
    }

    /**
     * Parse text response into structured data
     */
    parseTextResponse(text) {
        if (!text || typeof text !== 'string') {
            text = 'Unable to parse response';
        }
        
        const lowerText = text.toLowerCase();
        
        // Simple damage detection
        let damageType = 'No damage detected';
        let severity = 'None';
        
        if (lowerText.includes('hail')) {
            damageType = 'Hail damage';
            severity = 'Moderate';
        } else if (lowerText.includes('wind')) {
            damageType = 'Wind damage';
            severity = 'Moderate';
        } else if (lowerText.includes('water') || lowerText.includes('leak')) {
            damageType = 'Water damage';
            severity = 'High';
        } else if (lowerText.includes('wear') || lowerText.includes('aging')) {
            damageType = 'General wear';
            severity = 'Low';
        }
        
        const isRoofingImage = !lowerText.includes('person') && 
                               !lowerText.includes('people') && 
                               !lowerText.includes('face');
        
        return {
            isRoofingImage,
            damageType,
            severity,
            confidence: 80,
            description: text.substring(0, 200),
            findings: [damageType !== 'No damage detected' ? damageType : 'Analysis completed'],
            recommendations: ['Professional inspection recommended']
        };
    }
}

// Export singleton instance
const simpleQwenService = new SimpleQwenVLService();
export default simpleQwenService;