/**
 * RynnEC Enhanced Roof Damage Analysis API
 * Advanced visual reasoning for superior damage detection
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { RynnECService } from '../services/RynnECService.js';

const router = express.Router();

// Initialize RynnEC service
const rynnecService = new RynnECService();

// Configure multer for file uploads
const upload = multer({
    dest: path.join(process.cwd(), 'temp', 'rynnec-uploads'),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'temp', 'rynnec-uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * POST /api/rynnec/analyze
 * Enhanced roof damage analysis with RynnEC
 */
router.post('/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No image file provided'
            });
        }
        
        const { 
            mode = 'comprehensive',
            focus = 'damage_detection',
            precision = 'high',
            includeSegmentation = true,
            includeSpatialReasoning = true
        } = req.body;
        
        console.log(`🔬 RynnEC Analysis Request: ${req.file.originalname}`);
        console.log(`   Mode: ${mode}, Focus: ${focus}, Precision: ${precision}`);
        
        // Analyze with RynnEC
        const analysisResult = await rynnecService.analyzeRoofDamage(req.file.path, {
            mode,
            focus,
            precision,
            includeSegmentation,
            includeSpatialReasoning
        });
        
        // Clean up uploaded file
        try {
            fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
            console.warn('⚠️ Failed to cleanup uploaded file:', cleanupError);
        }
        
        if (!analysisResult.success) {
            return res.status(500).json({
                success: false,
                error: 'RynnEC analysis failed',
                details: analysisResult.error
            });
        }
        
        // Enhanced response with RynnEC insights
        const response = {
            success: true,
            rynnecEnhanced: true,
            analysis: analysisResult.analysis,
            performance: {
                processingTime: analysisResult.processingTime,
                modelCapabilities: analysisResult.capabilities,
                enhancementLevel: 'maximum'
            },
            metadata: {
                filename: req.file.originalname,
                fileSize: req.file.size,
                analysisMode: mode,
                timestamp: new Date().toISOString()
            }
        };
        
        console.log('✅ RynnEC Analysis Complete');
        console.log(`   Confidence: ${(analysisResult.analysis.summary.confidence * 100).toFixed(1)}%`);
        console.log(`   Processing: ${analysisResult.processingTime}`);
        
        res.json(response);
        
    } catch (error) {
        console.error('❌ RynnEC Analysis Error:', error);
        
        // Clean up file if error occurs
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.warn('⚠️ Failed to cleanup file after error:', cleanupError);
            }
        }
        
        res.status(500).json({
            success: false,
            error: 'Internal server error during RynnEC analysis',
            details: error.message
        });
    }
});

/**
 * GET /api/rynnec/capabilities
 * Get RynnEC model capabilities and performance metrics
 */
router.get('/capabilities', async (req, res) => {
    try {
        const capabilities = rynnecService.getCapabilities();
        
        res.json({
            success: true,
            capabilities,
            status: 'enhanced_visual_reasoning_active'
        });
        
    } catch (error) {
        console.error('❌ Error getting RynnEC capabilities:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/rynnec/health
 * Health check for RynnEC service
 */
router.get('/health', async (req, res) => {
    try {
        const health = await rynnecService.healthCheck();
        
        res.json({
            success: true,
            service: 'RynnEC Enhanced Visual Reasoning',
            ...health
        });
        
    } catch (error) {
        console.error('❌ RynnEC health check failed:', error);
        res.status(503).json({
            success: false,
            service: 'RynnEC Enhanced Visual Reasoning',
            status: 'unavailable',
            error: error.message
        });
    }
});

/**
 * POST /api/rynnec/batch-analyze
 * Batch analysis for multiple images
 */
router.post('/batch-analyze', upload.array('images', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No image files provided'
            });
        }
        
        console.log(`🔬 RynnEC Batch Analysis: ${req.files.length} images`);
        
        // Analyze all images in parallel
        const batchPromises = req.files.map(async (file, index) => {
            try {
                const result = await rynnecService.analyzeRoofDamage(file.path, {
                    mode: 'comprehensive',
                    focus: 'damage_detection',
                    precision: 'high'
                });
                
                // Clean up file
                fs.unlinkSync(file.path);
                
                return {
                    index,
                    filename: file.originalname,
                    success: true,
                    analysis: result.analysis,
                    processingTime: result.processingTime
                };
                
            } catch (error) {
                // Clean up file on error
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
                
                return {
                    index,
                    filename: file.originalname,
                    success: false,
                    error: error.message
                };
            }
        });
        
        const results = await Promise.all(batchPromises);
        
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;
        
        console.log(`✅ Batch Analysis Complete: ${successCount} success, ${failureCount} failures`);
        
        res.json({
            success: true,
            batchResults: {
                total: results.length,
                successful: successCount,
                failed: failureCount,
                results: results
            },
            rynnecEnhanced: true,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Batch analysis error:', error);
        
        // Clean up any remaining files
        if (req.files) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    try {
                        fs.unlinkSync(file.path);
                    } catch (cleanupError) {
                        console.warn('⚠️ Failed to cleanup batch file:', cleanupError);
                    }
                }
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Batch analysis failed',
            details: error.message
        });
    }
});

export default router;