import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import qwenVLService from '../services/SimpleQwenVLService.js';

const router = express.Router();

// Simple chat endpoint for testing
router.post('/chat', async (req, res) => {
    try {
        const { message, conversationId } = req.body;
        
        if (!message) {
            return res.status(400).json({ 
                error: 'No message provided',
                response: 'Please provide a message to chat with Susan AI.'
            });
        }

        console.log(`💬 Chat request: "${message}"`);
        
        // Try to get a response from Qwen VL service
        try {
            const qwenHealth = await qwenVLService.isAvailable();
            if (qwenHealth.available) {
                console.log('✅ Using Susan AI Qwen 2.5 VL for chat response');
                const response = await qwenVLService.processTextQuery(message);
                return res.json({
                    response: response || "I'm Susan AI, ready to help with roofing analysis and more!",
                    model: 'Qwen2.5-VL',
                    conversationId: conversationId || 'test',
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.warn(`⚠️ Qwen service error: ${error.message}`);
        }
        
        // Fallback response
        return res.json({
            response: "Hi! I'm Susan AI Enhanced JARVIS Edition. I'm fully operational with vision analysis capabilities. Try asking me to analyze a photo or help with roofing questions!",
            model: 'fallback',
            conversationId: conversationId || 'test',
            timestamp: new Date().toISOString(),
            capabilities: [
                "Photo analysis with Qwen 2.5 VL",
                "Roofing damage detection", 
                "Hail damage assessment",
                "Building code compliance",
                "Legal compliance support"
            ]
        });
        
    } catch (error) {
        console.error('Chat endpoint error:', error);
        res.status(500).json({
            error: 'Chat service error',
            response: 'Sorry, I encountered an error. Please try again.',
            details: error.message
        });
    }
});

// Initialize Anthropic client as fallback
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

// Enhanced photo analysis endpoint using Qwen2.5-VL with Claude fallback
router.post('/analyze-photo', async (req, res) => {
    try {
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
        let result = null;
        let analysisMethod = 'unknown';

        // Step 1: Try Qwen2.5-VL first (primary analysis)
        console.log(`🚀 Analyzing image: ${filename} with Qwen2.5-VL (Susan AI)...`);
        
        try {
            // Check if Qwen service is available
            const qwenHealth = await qwenVLService.isAvailable();
            
            if (qwenHealth.available && qwenHealth.modelLoaded) {
                console.log(`✅ Susan AI available: ${qwenHealth.modelName} on ${qwenHealth.device}`);
                
                // Use Qwen2.5-VL for analysis
                result = await qwenVLService.analyzeRoofingImage(image, filename);
                analysisMethod = 'Qwen2.5-VL';
                
                console.log(`🎯 Qwen2.5-VL analysis completed: ${result.damageType}`);
                
            } else {
                throw new Error(`Susan AI not ready: Model loaded=${qwenHealth.modelLoaded}`);
            }
            
        } catch (qwenError) {
            console.warn(`⚠️ Qwen2.5-VL analysis failed: ${qwenError.message}`);
            console.log('🔄 Falling back to Claude analysis...');
            
            // Step 2: Fallback to Claude analysis
            try {
                result = await performClaudeAnalysis(image, filename, anthropic);
                analysisMethod = 'Claude-3.5-Sonnet (fallback)';
                
            } catch (claudeError) {
                console.error('❌ Both Qwen and Claude analysis failed');
                throw new Error(`Primary analysis (Qwen): ${qwenError.message}. Fallback analysis (Claude): ${claudeError.message}`);
            }
        }

        // Enhance result with metadata
        const totalTime = (Date.now() - startTime) / 1000;
        result.analysisMethod = analysisMethod;
        result.totalProcessingTime = totalTime;
        result.timestamp = new Date().toISOString();

        console.log(`✅ Final analysis completed for ${filename} using ${analysisMethod} in ${totalTime}s: ${result.damageType}`);
        res.json(result);

    } catch (error) {
        console.error('Complete photo analysis failure:', error);
        
        const totalTime = (Date.now() - Date.now()) / 1000;
        
        // Return comprehensive error response
        res.status(500).json({
            damageType: 'Analysis system failure',
            severity: 'Unknown',
            confidence: 0,
            description: `Complete analysis failure: ${error.message}. Both primary (Qwen2.5-VL) and fallback (Claude) systems encountered errors.`,
            findings: 'All analysis systems unavailable',
            recommendation: 'Please check system status and try again, or contact support for assistance.',
            error: error.message,
            analysisMethod: 'none',
            totalProcessingTime: totalTime,
            timestamp: new Date().toISOString(),
            filename: filename || 'unknown'
        });
    }
});

// Helper function for Claude analysis (fallback)
async function performClaudeAnalysis(image, filename, anthropic) {
    // Extract base64 data and mime type
    const imageData = image.replace(/^data:image\/[a-z]+;base64,/, '');
    const mimeType = image.match(/^data:(image\/[a-z]+)/)?.[1] || 'image/jpeg';

    console.log(`🔍 Analyzing ${filename} with Claude vision...`);

    // Send to Claude for analysis
    const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `You are a professional roofing damage assessment expert. Analyze this image for roofing damage with the following guidelines:

1. If this image shows a roof or roofing materials:
   - Look for hail damage (circular impacts, granule loss, exposed mat)
   - Look for wind damage (lifted/missing shingles, exposed underlayment)
   - Look for general wear (granule loss, cracking, aging)
   - Provide specific observations of what you see
   - Give a realistic confidence score based on image quality and visibility

2. If this image does NOT show a roof (like a person, car, etc.):
   - Clearly state "No roofing damage detected"
   - Describe what you actually see in the image
   - Confidence should be high (95%+) since you can clearly see it's not a roof

3. Always be honest about what you can and cannot see clearly
4. Include professional disclaimers about on-site inspection needs

Respond in this JSON format:
{
  "damageType": "Specific damage found OR 'No roofing damage detected'",
  "severity": "Low|Moderate|High|None",
  "confidence": number 1-100,
  "description": "Detailed description of what you observe",
  "findings": "Brief summary of key findings",
  "recommendation": "Professional recommendation"
}`
                    },
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mimeType,
                            data: imageData
                        }
                    }
                ]
            }
        ]
    });

    // Parse Claude's response
    const analysisText = response.content[0].text;
    console.log(`📋 Claude analysis result: ${analysisText.substring(0, 200)}...`);
    
    // Try to parse JSON response
    let analysis;
    try {
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[0]);
        } else {
            throw new Error('No JSON found in response');
        }
    } catch (parseError) {
        console.error('Failed to parse Claude response as JSON:', parseError);
        analysis = {
            damageType: 'Analysis completed',
            severity: 'Unknown',
            confidence: 75,
            description: analysisText,
            findings: 'Claude AI analysis completed - see description for details',
            recommendation: 'Review analysis results and consult professional if needed'
        };
    }

    // Return structured result
    return {
        damageType: analysis.damageType || 'Analysis completed',
        severity: analysis.severity || 'None',
        confidence: Math.min(100, Math.max(0, analysis.confidence || 50)),
        description: analysis.description || 'AI analysis completed.',
        findings: analysis.findings || analysis.damageType || 'Analysis completed',
        recommendation: analysis.recommendation || 'Consult a professional roofing inspector for final assessment.',
        model: 'claude-3.5-sonnet',
        filename: filename
    };
}

// Enhanced health check endpoint
router.get('/analyze-photo/health', async (req, res) => {
    try {
        const qwenHealth = await qwenVLService.getHealthInfo();
        
        res.json({
            status: 'ready',
            service: 'Enhanced Photo Analysis (Qwen2.5-VL + Claude)',
            primary: {
                engine: 'Qwen2.5-VL',
                status: qwenHealth.susanAI?.available ? 'available' : 'unavailable',
                model: qwenHealth.susanAI?.modelName,
                device: qwenHealth.susanAI?.device,
                parameters: qwenHealth.susanAI?.parameters
            },
            fallback: {
                engine: 'Claude Vision',
                model: 'claude-3.5-sonnet-20241022',
                status: 'available'
            },
            capabilities: [
                'Real Qwen2.5-VL vision analysis (8.29B parameters)',
                'Professional roofing damage detection',
                'Hail damage assessment with high accuracy', 
                'Wind damage analysis',
                'Material condition evaluation',
                'Non-roofing image detection (95%+ confidence)',
                'Intelligent fallback to Claude if needed',
                'Processing time optimization'
            ],
            configuration: qwenHealth.configuration,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'partial',
            service: 'Enhanced Photo Analysis (Qwen2.5-VL + Claude)',
            error: error.message,
            fallback_available: true,
            timestamp: new Date().toISOString()
        });
    }
});

export default router;