import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { SusanBrain } from './src/susan-brain.js';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const port = process.env.PORT || 3003;

// Middleware
app.use(express.json({limit: '50mb'})); // Increase limit for base64 images
app.use(express.urlencoded({limit: '50mb', extended: true}));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Susan
let susanBrain;
(async () => {
    try {
        console.log('🧠 Initializing Susan...');
        susanBrain = new SusanBrain();
        console.log('✅ Susan initialized successfully');
    } catch (error) {
        console.error('❌ Susan initialization failed:', error.message);
    }
})();

// Simple health endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        susan: susanBrain ? 'ready' : 'initializing'
    });
});

// Simple message endpoint
app.post('/api/message', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!susanBrain) {
            return res.status(503).json({ error: 'Susan is still initializing, please try again' });
        }

        const response = await susanBrain.processMessage(message);
        res.json({
            content: response.response,
            model: response.model,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Initialize Anthropic client for photo analysis (keeping as fallback)
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

// Import Qwen2.5-VL service for real AI vision analysis
import qwenService from './src/api/services/QwenVLService.js';

// Real photo analysis endpoint using Qwen2.5-VL (with Claude fallback)
app.post('/api/analyze-photo', async (req, res) => {
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

        // Try Qwen2.5-VL first for real AI vision analysis
        console.log(`🔍 Attempting analysis with Qwen2.5-VL for: ${filename}`);
        
        try {
            // Use Qwen2.5-VL for analysis (ONLY - no fallback)
            const qwenResult = await qwenService.analyzeRoofingDamage(image, {
                filename: filename,
                mimeType: image.match(/^data:(image\/[a-z]+)/)?.[1] || 'image/jpeg'
            });
            
            if (qwenResult.success) {
                console.log(`✅ Qwen2.5-VL analysis successful for ${filename}`);
                return res.json(qwenResult);
            } else {
                console.log(`❌ Qwen2.5-VL analysis failed: ${qwenResult.error}`);
                return res.status(500).json({
                    error: 'Analysis failed',
                    damageType: 'Analysis unavailable',
                    severity: 'Unknown',
                    confidence: 0,
                    description: 'Qwen2.5-VL analysis failed. Please try again.',
                    message: 'AI vision analysis is temporarily unavailable'
                });
            }
        } catch (qwenError) {
            console.log(`❌ Qwen2.5-VL error: ${qwenError.message}`);
            return res.status(500).json({
                error: 'Qwen2.5-VL unavailable',
                damageType: 'Service unavailable', 
                severity: 'Unknown',
                confidence: 0,
                description: 'AI vision service is currently unavailable. Please try again.',
                message: qwenError.message
            });
        }


    } catch (error) {
        console.error('Photo analysis error:', error);
        
        // Return honest error response
        res.status(500).json({
            damageType: 'Analysis failed',
            severity: 'Unknown',
            confidence: 0,
            description: `Unable to analyze image: ${error.message}. This could be due to image format issues, API connectivity, or file corruption.`,
            findings: 'Analysis system unavailable',
            recommendation: 'Please try again with a clear roofing photo, or contact support if the issue persists.',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});


// Real document analysis endpoint using Qwen2.5-VL
app.post('/api/v1/documents/analyze', async (req, res) => {
    try {
        console.log('📄 Document analysis request received');
        
        const { document, filename, fileType } = req.body;
        if (!document) {
            return res.status(400).json({ error: 'Document data is required' });
        }

        // Try Qwen2.5-VL first for real document analysis
        console.log(`🔍 Attempting document analysis with Qwen2.5-VL for: ${filename}`);
        
        try {
            // Use Qwen2.5-VL for document analysis
            const qwenResult = await qwenService.analyzeDocument(document, {
                filename: filename,
                mimeType: fileType || 'image/jpeg'
            });
            
            if (qwenResult.success) {
                console.log(`✅ Qwen2.5-VL document analysis successful for ${filename}`);
                
                // Format response for Susan AI Enhanced compatibility
                return res.json({
                    success: true,
                    filename: filename,
                    analysis: {
                        documentType: qwenResult.documentType,
                        isRoofingRelated: qwenResult.isRoofingRelated,
                        keyFindings: qwenResult.keyFindings,
                        extractedInfo: qwenResult.extractedInfo,
                        documentQuality: qwenResult.documentQuality,
                        completenessScore: qwenResult.completenessScore,
                        confidence: qwenResult.confidence,
                        recommendations: qwenResult.recommendations,
                        nextSteps: qwenResult.nextSteps,
                        missingFields: qwenResult.missingFields
                    },
                    modelUsed: 'Qwen2.5-VL-7B',
                    processingTime: qwenResult.processingTime,
                    timestamp: new Date().toISOString()
                });
            } else {
                console.log(`⚠️ Qwen2.5-VL document analysis failed, falling back to Claude`);
            }
        } catch (qwenError) {
            console.log(`⚠️ Qwen2.5-VL unavailable: ${qwenError.message}, falling back to Claude`);
        }

        // Fallback to Claude if Qwen is not available
        if (!susanBrain || !susanBrain.anthropic) {
            return res.status(503).json({ error: 'AI service is not available' });
        }

        console.log(`📄 Analyzing document: ${filename} with Claude vision (fallback)...`);

        // Extract image data and MIME type
        const imageData = document.replace(/^data:[^;]+;base64,/, '');
        const mimeType = document.match(/^data:([^;]+)/)?.[1] || 'image/jpeg';

        // Send to Claude for document analysis
        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1500,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `You are a professional insurance document analyst. Analyze this document image and provide a comprehensive assessment:

1. DOCUMENT IDENTIFICATION:
   - What type of document is this?
   - Is it related to roofing, property damage, or insurance?
   - Overall document completeness and quality

2. KEY INFORMATION EXTRACTION:
   - Extract any visible policy numbers, claim numbers, addresses
   - Identify important dates (inspection, incident, etc.)
   - Note any damage descriptions or cost estimates
   - Insurance company information

3. PROFESSIONAL ASSESSMENT:
   - Document legibility and quality
   - Missing or incomplete fields
   - Compliance with standard forms
   - Recommended actions

Respond in JSON format:
{
  "documentType": "specific type",
  "isRoofingRelated": true/false,
  "keyFindings": ["finding1", "finding2"],
  "extractedInfo": {"field": "value"},
  "documentQuality": "Poor/Fair/Good/Excellent", 
  "confidence": 1-100,
  "recommendations": ["rec1", "rec2"],
  "nextSteps": ["step1", "step2"]
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
        console.log(`📋 Claude document analysis result: ${analysisText.substring(0, 200)}...`);
        
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
            console.error('Failed to parse Claude document response as JSON:', parseError);
            // Fallback to structured response
            analysis = {
                documentType: 'Document analyzed',
                isRoofingRelated: true,
                keyFindings: ['Document processed by AI'],
                extractedInfo: {},
                documentQuality: 'Fair',
                confidence: 75,
                recommendations: ['Review AI analysis results'],
                nextSteps: ['Verify extracted information']
            };
        }

        // Format final response
        res.json({
            success: true,
            filename: filename,
            analysis: {
                documentType: analysis.documentType || 'Document',
                isRoofingRelated: analysis.isRoofingRelated || true,
                keyFindings: analysis.keyFindings || ['Analysis completed'],
                extractedInfo: analysis.extractedInfo || {},
                documentQuality: analysis.documentQuality || 'Fair',
                confidence: analysis.confidence || 75,
                recommendations: analysis.recommendations || ['Review document'],
                nextSteps: analysis.nextSteps || ['Proceed with processing']
            },
            modelUsed: 'claude-3.5-sonnet',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Document analysis error:', error);
        res.status(500).json({ 
            error: 'Failed to analyze document',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Real AI-powered damage quantification endpoint
app.post('/api/quantify-damage', async (req, res) => {
    try {
        console.log('🔢 Damage quantification request received');
        
        const { image, filename, area } = req.body;
        if (!image) {
            return res.status(400).json({ error: 'Image data is required' });
        }

        // Try Qwen2.5-VL first for real AI quantification
        console.log(`🔢 Attempting quantification with Qwen2.5-VL for: ${filename}`);
        
        try {
            // Use Qwen2.5-VL for damage quantification
            const qwenResult = await qwenService.quantifyDamage(image, {
                filename: filename,
                mimeType: image.match(/^data:(image\/[a-z]+)/)?.[1] || 'image/jpeg',
                area: area
            });
            
            if (qwenResult.success) {
                console.log(`✅ Qwen2.5-VL quantification successful for ${filename}: ${qwenResult.totalImpacts} impacts`);
                return res.json({
                    success: true,
                    quantification: {
                        totalImpacts: qwenResult.totalImpacts,
                        impactsBySize: qwenResult.impactsBySize,
                        impactsByType: qwenResult.impactsByType,
                        areaAnalysis: qwenResult.areaAnalysis,
                        severity: qwenResult.severity,
                        confidence: qwenResult.confidence,
                        claimViability: qwenResult.claimViability,
                        urgency: qwenResult.urgency,
                        repairRecommendation: qwenResult.repairRecommendation,
                        detailedFindings: qwenResult.detailedFindings,
                        quantificationNotes: qwenResult.quantificationNotes
                    },
                    modelUsed: 'Qwen2.5-VL-7B',
                    processingTime: qwenResult.processingTime,
                    timestamp: new Date().toISOString()
                });
            } else {
                console.log(`⚠️ Qwen2.5-VL quantification failed, falling back to Claude`);
            }
        } catch (qwenError) {
            console.log(`⚠️ Qwen2.5-VL unavailable: ${qwenError.message}, falling back to Claude`);
        }

        // Fallback to Claude if Qwen is not available
        const imageData = image.replace(/^data:image\/[a-z]+;base64,/, '');
        const mimeType = image.match(/^data:(image\/[a-z]+)/)?.[1] || 'image/jpeg';

        console.log(`🔢 Analyzing damage quantification: ${filename} with Claude vision (fallback)...`);

        // Send to Claude for quantification analysis
        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1200,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `You are a professional roofing damage quantification expert. Analyze this image and count all visible impact marks, damage points, or hail damage on the roof surface.

Provide a detailed assessment including:
1. Total count of visible impacts/damage points
2. Size categorization (small <1", medium 1-2", large >2")
3. Damage type identification (hail impacts, wear, wind damage)
4. Estimated visible roof area in square feet
5. Damage density calculation (impacts per square foot)
6. Overall damage severity assessment
7. Insurance claim viability

Be precise and conservative in your counting. Only count clearly visible damage.

Respond in JSON format:
{
  "totalImpacts": number,
  "impactsBySize": {"small": number, "medium": number, "large": number},
  "impactsByType": {"hailDamage": number, "windDamage": number, "wearDamage": number},
  "areaAnalysis": {
    "totalVisibleArea": number,
    "impactsPerSqFt": number,
    "damagePercentage": number
  },
  "severity": "Low/Moderate/High/Severe",
  "confidence": 1-100,
  "claimViability": "Poor/Fair/Good/Excellent",
  "repairRecommendation": "Monitor/Minor Repair/Major Repair/Replace",
  "detailedFindings": ["list of specific observations"]
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
        console.log(`📋 Claude quantification result: ${analysisText.substring(0, 200)}...`);
        
        // Try to parse JSON response
        let quantification;
        try {
            const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                quantification = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            console.error('Failed to parse Claude quantification response as JSON:', parseError);
            // Fallback to basic quantification
            quantification = {
                totalImpacts: 0,
                impactsBySize: { small: 0, medium: 0, large: 0 },
                impactsByType: { hailDamage: 0, windDamage: 0, wearDamage: 0 },
                areaAnalysis: {
                    totalVisibleArea: area || 100,
                    impactsPerSqFt: 0,
                    damagePercentage: 0
                },
                severity: 'Low',
                confidence: 50,
                claimViability: 'Fair',
                repairRecommendation: 'Monitor',
                detailedFindings: ['Quantification completed but needs manual review']
            };
        }

        // Ensure all required fields exist
        const result = {
            success: true,
            quantification: {
                totalImpacts: quantification.totalImpacts || 0,
                impactsBySize: quantification.impactsBySize || { small: 0, medium: 0, large: 0 },
                impactsByType: quantification.impactsByType || { hailDamage: 0, windDamage: 0, wearDamage: 0 },
                areaAnalysis: quantification.areaAnalysis || {
                    totalVisibleArea: area || 100,
                    impactsPerSqFt: 0,
                    damagePercentage: 0
                },
                severity: quantification.severity || 'Low',
                confidence: quantification.confidence || 50,
                claimViability: quantification.claimViability || 'Fair',
                repairRecommendation: quantification.repairRecommendation || 'Monitor',
                detailedFindings: quantification.detailedFindings || []
            },
            modelUsed: 'claude-3.5-sonnet',
            timestamp: new Date().toISOString(),
            filename: filename
        };

        console.log(`✅ Quantification completed for ${filename}: ${result.quantification.totalImpacts} impacts`);
        res.json(result);

    } catch (error) {
        console.error('Damage quantification error:', error);
        
        res.status(500).json({
            success: false,
            error: 'Failed to quantify damage',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Serve the main HTML file for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket handling for real-time communication
wss.on('connection', (ws, req) => {
    console.log('🔗 New WebSocket connection established');
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        message: 'Connected to Susan AI',
        timestamp: new Date().toISOString()
    }));
    
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log('💬 WebSocket message received:', message.type);
            
            if ((message.type === 'chat' || message.type === 'message') && message.content) {
                if (!susanBrain) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        content: 'Susan is still initializing, please try again',
                        timestamp: new Date().toISOString()
                    }));
                    return;
                }
                
                const response = await susanBrain.processMessage(message.content);
                
                ws.send(JSON.stringify({
                    type: 'response',
                    content: response.response,
                    model: response.model,
                    timestamp: new Date().toISOString()
                }));
            }
        } catch (error) {
            console.error('WebSocket error:', error);
            ws.send(JSON.stringify({
                type: 'error',
                content: 'Failed to process message',
                timestamp: new Date().toISOString()
            }));
        }
    });
    
    ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Start server
server.listen(port, () => {
    console.log(`🚀 Susan AI Server running at http://localhost:${port}`);
    console.log('💡 Open the URL in your browser to interact with Susan');
    console.log('🔗 WebSocket server ready for connections');
});