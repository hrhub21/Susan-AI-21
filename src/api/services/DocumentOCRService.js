import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import sharp from 'sharp';
import { Jimp } from 'jimp';
import { createWorker } from 'tesseract.js';
import axios from 'axios';
import FormData from 'form-data';

/**
 * Advanced OCR Service for Insurance Document Processing
 * Provides comprehensive text extraction, document classification, and intelligent field mapping
 * for insurance-related documents with multi-language support and quality assessment.
 */
export class DocumentOCRService {
    constructor() {
        this.ocrEngines = {
            tesseract: { available: true, confidence: 0.75 },
            google: { available: !!process.env.GOOGLE_VISION_API_KEY, confidence: 0.90 },
            aws: { available: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY), confidence: 0.88 }
        };

        // Insurance document templates and field mappings
        this.insuranceTemplates = {
            'claim_form': {
                name: 'Insurance Claim Form',
                requiredFields: ['policy_number', 'claim_number', 'date_of_loss', 'amount'],
                patterns: {
                    policy_number: /(?:policy|pol\.?\s*#|pol\.?\s*no\.?)[:\s]*([A-Z0-9-]{6,20})/i,
                    claim_number: /(?:claim|clm\.?\s*#|clm\.?\s*no\.?)[:\s]*([A-Z0-9-]{6,20})/i,
                    date_of_loss: /(?:date\s*of\s*loss|loss\s*date)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
                    amount: /(?:amount|total|claim\s*amount)[:\s]*\$?([\d,]+\.?\d{0,2})/i,
                    insured_name: /(?:insured|policy\s*holder)[:\s]*([A-Za-z\s]{2,50})/i,
                    adjuster: /(?:adjuster|adj\.)[:\s]*([A-Za-z\s]{2,50})/i
                },
                confidence: 0.8
            },
            'policy_document': {
                name: 'Insurance Policy',
                requiredFields: ['policy_number', 'effective_date', 'premium_amount'],
                patterns: {
                    policy_number: /(?:policy|pol\.?\s*#)[:\s]*([A-Z0-9-]{6,20})/i,
                    effective_date: /(?:effective|eff\.?\s*date)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
                    expiration_date: /(?:expiration|exp\.?\s*date)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
                    premium_amount: /(?:premium|prem\.?\s*amount)[:\s]*\$?([\d,]+\.?\d{0,2})/i,
                    coverage_amount: /(?:coverage|limit)[:\s]*\$?([\d,]+\.?\d{0,2})/i,
                    deductible: /(?:deductible|ded\.)[:\s]*\$?([\d,]+\.?\d{0,2})/i
                },
                confidence: 0.85
            },
            'estimate_form': {
                name: 'Repair Estimate',
                requiredFields: ['estimate_number', 'total_amount', 'date'],
                patterns: {
                    estimate_number: /(?:estimate|est\.?\s*#)[:\s]*([A-Z0-9-]{4,15})/i,
                    total_amount: /(?:total|grand\s*total)[:\s]*\$?([\d,]+\.?\d{0,2})/i,
                    date: /(?:date|est\.?\s*date)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
                    contractor: /(?:contractor|company)[:\s]*([A-Za-z\s&]{2,50})/i,
                    scope_of_work: /(?:scope|work\s*description)[:\s]*([A-Za-z0-9\s,.-]{10,200})/i
                },
                confidence: 0.75
            },
            'inspection_report': {
                name: 'Property Inspection Report',
                requiredFields: ['report_number', 'inspection_date', 'property_address'],
                patterns: {
                    report_number: /(?:report|inspection\s*#)[:\s]*([A-Z0-9-]{4,15})/i,
                    inspection_date: /(?:inspection|insp\.?\s*date)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
                    property_address: /(?:property|address)[:\s]*([0-9A-Za-z\s,.-]{10,100})/i,
                    inspector: /(?:inspector|insp\.?\s*by)[:\s]*([A-Za-z\s]{2,50})/i,
                    damage_assessment: /(?:damage|assessment)[:\s]*([A-Za-z0-9\s,.-]{10,200})/i
                },
                confidence: 0.80
            }
        };

        // Document classification ML features
        this.documentClassifier = {
            keywords: {
                'claim_form': ['claim', 'policy holder', 'loss', 'damage', 'adjuster', 'deductible'],
                'policy_document': ['policy', 'coverage', 'premium', 'effective date', 'insured'],
                'estimate_form': ['estimate', 'repair', 'contractor', 'materials', 'labor'],
                'inspection_report': ['inspection', 'property', 'condition', 'assessment', 'findings'],
                'correspondence': ['letter', 'email', 'communication', 'response', 'notification']
            },
            structuralFeatures: {
                'claim_form': { hasFormFields: true, hasSignature: true, hasCheckboxes: true },
                'policy_document': { hasLegalText: true, hasTermsAndConditions: true, multiPage: true },
                'estimate_form': { hasLineItems: true, hasTotals: true, hasCompanyHeader: true },
                'inspection_report': { hasPhotos: true, hasCheckboxes: true, hasSections: true }
            }
        };

        // Language support configurations
        this.languageConfig = {
            'en': { tesseract: 'eng', google: 'en', aws: 'en' },
            'es': { tesseract: 'spa', google: 'es', aws: 'es' },
            'fr': { tesseract: 'fra', google: 'fr', aws: 'fr' }
        };

        // Quality assessment thresholds
        this.qualityThresholds = {
            excellent: 0.95,
            good: 0.85,
            acceptable: 0.70,
            poor: 0.50
        };

        // Initialize processing statistics
        this.stats = {
            documentsProcessed: 0,
            successfulExtractions: 0,
            averageConfidence: 0,
            processingTimes: [],
            engineUsage: { tesseract: 0, google: 0, aws: 0 }
        };

        this.processingQueue = [];
        this.isProcessing = false;
    }

    /**
     * Main OCR processing method with engine fallback
     */
    async processDocument(filePath, options = {}) {
        const startTime = Date.now();
        
        try {
            const {
                language = 'en',
                preferredEngine = 'auto',
                documentType = 'auto',
                enhanceImage = true,
                extractStructuredData = true
            } = options;

            console.log(`📄 Starting OCR processing for: ${path.basename(filePath)}`);

            // Validate file existence and type
            if (!await fs.pathExists(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const fileExtension = path.extname(filePath).toLowerCase();
            if (!['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.bmp'].includes(fileExtension)) {
                throw new Error(`Unsupported file type: ${fileExtension}`);
            }

            // Preprocess image for better OCR accuracy
            let processedImagePath = filePath;
            if (enhanceImage && ['.png', '.jpg', '.jpeg', '.tiff', '.bmp'].includes(fileExtension)) {
                processedImagePath = await this.preprocessImage(filePath);
            }

            // Convert PDF to images if necessary
            let imagePaths = [];
            if (fileExtension === '.pdf') {
                imagePaths = await this.convertPdfToImages(filePath);
            } else {
                imagePaths = [processedImagePath];
            }

            // Process each page/image
            let allResults = [];
            for (let i = 0; i < imagePaths.length; i++) {
                const imagePath = imagePaths[i];
                const pageResult = await this.extractTextFromImage(imagePath, language, preferredEngine);
                pageResult.pageNumber = i + 1;
                allResults.push(pageResult);
            }

            // Combine results from all pages
            const combinedText = allResults.map(r => r.text).join('\n\n');
            const avgConfidence = allResults.reduce((sum, r) => sum + r.confidence, 0) / allResults.length;

            // Classify document type if auto-detection is enabled
            let detectedType = documentType;
            if (documentType === 'auto') {
                detectedType = await this.classifyDocument(combinedText, filePath);
            }

            // Extract structured data based on document type
            let structuredData = {};
            if (extractStructuredData && detectedType !== 'unknown') {
                structuredData = await this.extractStructuredFields(combinedText, detectedType);
            }

            // Assess quality
            const qualityAssessment = this.assessExtractionQuality(combinedText, avgConfidence, allResults);

            // Update statistics
            this.updateStatistics(Date.now() - startTime, avgConfidence, allResults[0].engine);

            const result = {
                success: true,
                filePath: filePath,
                fileName: path.basename(filePath),
                documentType: detectedType,
                language: language,
                engine: allResults[0].engine,
                text: combinedText,
                confidence: avgConfidence,
                pages: allResults,
                structuredData: structuredData,
                qualityAssessment: qualityAssessment,
                processingTime: Date.now() - startTime,
                metadata: {
                    fileSize: (await fs.stat(filePath)).size,
                    pageCount: allResults.length,
                    processedAt: new Date().toISOString()
                }
            };

            // Clean up temporary files
            await this.cleanupTempFiles(imagePaths, processedImagePath, filePath);

            console.log(`✅ OCR processing completed for ${path.basename(filePath)} in ${result.processingTime}ms`);
            return result;

        } catch (error) {
            console.error(`❌ OCR processing failed for ${path.basename(filePath)}:`, error.message);
            
            return {
                success: false,
                filePath: filePath,
                fileName: path.basename(filePath),
                error: error.message,
                processingTime: Date.now() - startTime,
                metadata: {
                    processedAt: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Image preprocessing for enhanced OCR accuracy
     */
    async preprocessImage(imagePath) {
        try {
            const outputPath = imagePath.replace(/\.[^.]+$/, '_processed.png');
            
            await sharp(imagePath)
                .resize(null, 2000, { 
                    withoutEnlargement: true,
                    kernel: sharp.kernel.lanczos3 
                })
                .normalize()
                .sharpen()
                .grayscale()
                .png({ quality: 100, compressionLevel: 0 })
                .toFile(outputPath);

            // Additional enhancement with Jimp for better text clarity
            const image = await Jimp.read(outputPath);
            
            await image
                .contrast(0.2)
                .brightness(0.1)
                .quality(100)
                .writeAsync(outputPath);

            return outputPath;

        } catch (error) {
            console.warn(`⚠️ Image preprocessing failed, using original: ${error.message}`);
            return imagePath;
        }
    }

    /**
     * Convert PDF to images for OCR processing
     */
    async convertPdfToImages(pdfPath) {
        try {
            const outputDir = path.join(path.dirname(pdfPath), 'pdf_pages');
            await fs.ensureDir(outputDir);

            const outputPattern = path.join(outputDir, 'page_%d.png');

            return new Promise((resolve, reject) => {
                // Using poppler-utils pdftoppm for high-quality conversion
                const process = spawn('pdftoppm', [
                    '-png',
                    '-r', '300', // 300 DPI for good OCR quality
                    pdfPath,
                    path.join(outputDir, 'page')
                ]);

                process.on('close', async (code) => {
                    if (code === 0) {
                        try {
                            const files = await fs.readdir(outputDir);
                            const imageFiles = files
                                .filter(f => f.endsWith('.png'))
                                .sort()
                                .map(f => path.join(outputDir, f));
                            resolve(imageFiles);
                        } catch (error) {
                            reject(error);
                        }
                    } else {
                        reject(new Error(`PDF conversion failed with code ${code}`));
                    }
                });

                process.on('error', (error) => {
                    // Fallback: Use a simple PDF-to-image approach
                    this.fallbackPdfConversion(pdfPath, outputDir)
                        .then(resolve)
                        .catch(reject);
                });
            });

        } catch (error) {
            throw new Error(`PDF conversion failed: ${error.message}`);
        }
    }

    /**
     * Fallback PDF conversion method
     */
    async fallbackPdfConversion(pdfPath, outputDir) {
        // Placeholder for alternative PDF conversion
        // In production, you might use pdf2pic or similar library
        const outputPath = path.join(outputDir, 'page_1.png');
        
        // For now, create a placeholder indicating PDF processing limitation
        await fs.writeFile(
            outputPath.replace('.png', '.txt'),
            `PDF conversion fallback: ${path.basename(pdfPath)}\nManual OCR processing required.`
        );
        
        return [outputPath.replace('.png', '.txt')];
    }

    /**
     * Extract text using multiple OCR engines with fallback
     */
    async extractTextFromImage(imagePath, language = 'en', preferredEngine = 'auto') {
        const engines = this.getAvailableEngines(preferredEngine);
        
        for (const engine of engines) {
            try {
                console.log(`🔍 Attempting OCR with ${engine} engine...`);
                
                const result = await this.runOCREngine(engine, imagePath, language);
                
                if (result.confidence >= this.qualityThresholds.acceptable) {
                    console.log(`✅ Successfully extracted text with ${engine} (confidence: ${result.confidence.toFixed(2)})`);
                    this.stats.engineUsage[engine]++;
                    return { ...result, engine };
                }
                
                console.log(`⚠️ ${engine} confidence too low (${result.confidence.toFixed(2)}), trying next engine...`);
                
            } catch (error) {
                console.warn(`❌ ${engine} engine failed: ${error.message}`);
                continue;
            }
        }
        
        throw new Error('All OCR engines failed to produce acceptable results');
    }

    /**
     * Run specific OCR engine
     */
    async runOCREngine(engine, imagePath, language) {
        switch (engine) {
            case 'tesseract':
                return await this.runTesseract(imagePath, language);
            case 'google':
                return await this.runGoogleVision(imagePath, language);
            case 'aws':
                return await this.runAWSTextract(imagePath, language);
            default:
                throw new Error(`Unknown OCR engine: ${engine}`);
        }
    }

    /**
     * Tesseract OCR implementation
     */
    async runTesseract(imagePath, language) {
        const worker = await createWorker();
        
        try {
            const langCode = this.languageConfig[language]?.tesseract || 'eng';
            await worker.loadLanguage(langCode);
            await worker.initialize(langCode);
            
            // Configure Tesseract for better accuracy
            await worker.setParameters({
                tessedit_pageseg_mode: '1', // Automatic page segmentation with OSD
                tessedit_ocr_engine_mode: '1', // Neural nets LSTM engine
                preserve_interword_spaces: '1'
            });

            const { data } = await worker.recognize(imagePath);
            
            return {
                text: data.text.trim(),
                confidence: data.confidence / 100,
                words: data.words,
                lines: data.lines,
                paragraphs: data.paragraphs
            };
            
        } finally {
            await worker.terminate();
        }
    }

    /**
     * Google Vision API implementation
     */
    async runGoogleVision(imagePath, language) {
        if (!process.env.GOOGLE_VISION_API_KEY) {
            throw new Error('Google Vision API key not configured');
        }

        const imageBuffer = await fs.readFile(imagePath);
        const base64Image = imageBuffer.toString('base64');
        
        const requestData = {
            requests: [{
                image: { content: base64Image },
                features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
                imageContext: {
                    languageHints: [this.languageConfig[language]?.google || 'en']
                }
            }]
        };

        const response = await axios.post(
            `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
            requestData
        );

        const textAnnotations = response.data.responses[0]?.textAnnotations;
        if (!textAnnotations || textAnnotations.length === 0) {
            throw new Error('No text detected by Google Vision');
        }

        const fullText = textAnnotations[0].description;
        const confidence = this.calculateGoogleVisionConfidence(textAnnotations);

        return {
            text: fullText.trim(),
            confidence: confidence,
            annotations: textAnnotations
        };
    }

    /**
     * AWS Textract implementation
     */
    async runAWSTextract(imagePath, language) {
        // Placeholder for AWS Textract implementation
        // In production, you would use AWS SDK
        throw new Error('AWS Textract integration not yet implemented');
    }

    /**
     * Calculate Google Vision confidence score
     */
    calculateGoogleVisionConfidence(annotations) {
        if (annotations.length <= 1) return 0.8; // Default confidence
        
        let totalConfidence = 0;
        let wordCount = 0;
        
        for (let i = 1; i < annotations.length; i++) {
            const annotation = annotations[i];
            if (annotation.confidence !== undefined) {
                totalConfidence += annotation.confidence;
                wordCount++;
            }
        }
        
        return wordCount > 0 ? totalConfidence / wordCount : 0.8;
    }

    /**
     * Get available OCR engines in order of preference
     */
    getAvailableEngines(preferred = 'auto') {
        const available = Object.entries(this.ocrEngines)
            .filter(([name, config]) => config.available)
            .sort((a, b) => b[1].confidence - a[1].confidence)
            .map(([name]) => name);

        if (preferred !== 'auto' && available.includes(preferred)) {
            return [preferred, ...available.filter(e => e !== preferred)];
        }

        return available;
    }

    /**
     * Classify document type using ML and pattern matching
     */
    async classifyDocument(text, filePath) {
        const fileName = path.basename(filePath).toLowerCase();
        const textLower = text.toLowerCase();
        
        let scores = {};
        
        // Keyword-based classification
        for (const [docType, keywords] of Object.entries(this.documentClassifier.keywords)) {
            let score = 0;
            
            // Check filename
            for (const keyword of keywords) {
                if (fileName.includes(keyword.toLowerCase())) {
                    score += 0.3;
                }
            }
            
            // Check content
            for (const keyword of keywords) {
                const matches = (textLower.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
                score += matches * 0.1;
            }
            
            scores[docType] = score;
        }
        
        // Pattern-based classification
        for (const [templateType, template] of Object.entries(this.insuranceTemplates)) {
            let patternScore = 0;
            let foundFields = 0;
            
            for (const [fieldName, pattern] of Object.entries(template.patterns)) {
                if (pattern.test(text)) {
                    foundFields++;
                    patternScore += 0.2;
                }
            }
            
            // Bonus for finding required fields
            const requiredFound = template.requiredFields.filter(field => 
                template.patterns[field] && template.patterns[field].test(text)
            ).length;
            
            patternScore += (requiredFound / template.requiredFields.length) * 0.5;
            
            if (scores[templateType]) {
                scores[templateType] += patternScore;
            } else {
                scores[templateType] = patternScore;
            }
        }
        
        // Find the highest scoring type
        const bestMatch = Object.entries(scores)
            .sort((a, b) => b[1] - a[1])[0];
        
        if (bestMatch && bestMatch[1] > 0.5) {
            console.log(`📋 Classified document as: ${bestMatch[0]} (confidence: ${bestMatch[1].toFixed(2)})`);
            return bestMatch[0];
        }
        
        console.log(`❓ Could not classify document type, using 'unknown'`);
        return 'unknown';
    }

    /**
     * Extract structured fields based on document type
     */
    async extractStructuredFields(text, documentType) {
        const template = this.insuranceTemplates[documentType];
        if (!template) {
            return {};
        }

        const extractedData = {
            documentType: documentType,
            confidence: template.confidence,
            fields: {},
            missingRequiredFields: []
        };

        // Extract fields using patterns
        for (const [fieldName, pattern] of Object.entries(template.patterns)) {
            const matches = text.match(pattern);
            if (matches && matches[1]) {
                extractedData.fields[fieldName] = {
                    value: matches[1].trim(),
                    confidence: 0.8,
                    position: text.indexOf(matches[0])
                };
            }
        }

        // Check for missing required fields
        for (const requiredField of template.requiredFields) {
            if (!extractedData.fields[requiredField]) {
                extractedData.missingRequiredFields.push(requiredField);
            }
        }

        // Calculate overall extraction confidence
        const foundRequired = template.requiredFields.length - extractedData.missingRequiredFields.length;
        extractedData.extractionCompleteness = foundRequired / template.requiredFields.length;

        console.log(`📊 Extracted ${Object.keys(extractedData.fields).length} fields from ${documentType}`);
        
        return extractedData;
    }

    /**
     * Assess quality of OCR extraction
     */
    assessExtractionQuality(text, confidence, pageResults) {
        const assessment = {
            overallScore: 0,
            confidence: confidence,
            issues: [],
            recommendations: []
        };

        // Text length assessment
        if (text.length < 50) {
            assessment.issues.push('Very short text extraction - may indicate poor scan quality');
            assessment.overallScore -= 0.2;
        }

        // Confidence assessment
        if (confidence >= this.qualityThresholds.excellent) {
            assessment.quality = 'excellent';
            assessment.overallScore += 0.3;
        } else if (confidence >= this.qualityThresholds.good) {
            assessment.quality = 'good';
            assessment.overallScore += 0.2;
        } else if (confidence >= this.qualityThresholds.acceptable) {
            assessment.quality = 'acceptable';
            assessment.overallScore += 0.1;
        } else {
            assessment.quality = 'poor';
            assessment.issues.push('Low OCR confidence score');
            assessment.recommendations.push('Consider rescanning with higher quality');
        }

        // Character analysis
        const specialCharCount = (text.match(/[^\w\s]/g) || []).length;
        const totalChars = text.length;
        const specialCharRatio = specialCharCount / totalChars;

        if (specialCharRatio > 0.1) {
            assessment.issues.push('High number of special characters - may indicate OCR errors');
            assessment.recommendations.push('Manual review recommended');
            assessment.overallScore -= 0.1;
        }

        // Word analysis
        const words = text.split(/\s+/);
        const shortWords = words.filter(w => w.length <= 2).length;
        const shortWordRatio = shortWords / words.length;

        if (shortWordRatio > 0.3) {
            assessment.issues.push('High ratio of very short words - possible segmentation issues');
            assessment.overallScore -= 0.1;
        }

        // Page consistency (for multi-page documents)
        if (pageResults.length > 1) {
            const confidences = pageResults.map(p => p.confidence);
            const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
            const variance = confidences.reduce((acc, c) => acc + Math.pow(c - avgConfidence, 2), 0) / confidences.length;
            
            if (variance > 0.05) {
                assessment.issues.push('Inconsistent quality across pages');
                assessment.recommendations.push('Review individual pages for quality issues');
            }
        }

        // Final score calculation
        assessment.overallScore = Math.max(0, Math.min(1, 0.5 + assessment.overallScore));
        
        return assessment;
    }

    /**
     * Batch processing for multiple documents
     */
    async batchProcess(filePaths, options = {}) {
        const {
            maxConcurrent = 3,
            progressCallback = null,
            stopOnError = false
        } = options;

        console.log(`🔄 Starting batch processing of ${filePaths.length} documents...`);
        
        const results = [];
        const errors = [];
        let processed = 0;

        // Process in chunks to control concurrency
        for (let i = 0; i < filePaths.length; i += maxConcurrent) {
            const chunk = filePaths.slice(i, i + maxConcurrent);
            
            const chunkPromises = chunk.map(async (filePath) => {
                try {
                    const result = await this.processDocument(filePath, options);
                    processed++;
                    
                    if (progressCallback) {
                        progressCallback({
                            processed,
                            total: filePaths.length,
                            current: filePath,
                            result
                        });
                    }
                    
                    return result;
                } catch (error) {
                    const errorResult = {
                        success: false,
                        filePath,
                        error: error.message
                    };
                    
                    errors.push(errorResult);
                    
                    if (stopOnError) {
                        throw error;
                    }
                    
                    return errorResult;
                }
            });

            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults);
        }

        const summary = {
            totalProcessed: filePaths.length,
            successful: results.filter(r => r.success).length,
            failed: errors.length,
            results: results,
            errors: errors,
            averageProcessingTime: results
                .filter(r => r.processingTime)
                .reduce((sum, r) => sum + r.processingTime, 0) / results.length || 0
        };

        console.log(`✅ Batch processing completed: ${summary.successful}/${summary.totalProcessed} successful`);
        
        return summary;
    }

    /**
     * Update processing statistics
     */
    updateStatistics(processingTime, confidence, engine) {
        this.stats.documentsProcessed++;
        this.stats.processingTimes.push(processingTime);
        
        if (confidence >= this.qualityThresholds.acceptable) {
            this.stats.successfulExtractions++;
        }
        
        const totalConfidence = this.stats.averageConfidence * (this.stats.documentsProcessed - 1) + confidence;
        this.stats.averageConfidence = totalConfidence / this.stats.documentsProcessed;
    }

    /**
     * Clean up temporary files
     */
    async cleanupTempFiles(imagePaths, processedImagePath, originalPath) {
        try {
            // Clean up processed image if different from original
            if (processedImagePath !== originalPath && await fs.pathExists(processedImagePath)) {
                await fs.remove(processedImagePath);
            }

            // Clean up PDF conversion directory
            for (const imagePath of imagePaths) {
                const dir = path.dirname(imagePath);
                if (dir.includes('pdf_pages')) {
                    await fs.remove(dir);
                    break;
                }
            }
        } catch (error) {
            console.warn(`⚠️ Cleanup warning: ${error.message}`);
        }
    }

    /**
     * Get processing statistics
     */
    getStatistics() {
        const avgProcessingTime = this.stats.processingTimes.length > 0
            ? this.stats.processingTimes.reduce((a, b) => a + b, 0) / this.stats.processingTimes.length
            : 0;

        return {
            ...this.stats,
            averageProcessingTime: Math.round(avgProcessingTime),
            successRate: this.stats.documentsProcessed > 0 
                ? this.stats.successfulExtractions / this.stats.documentsProcessed 
                : 0,
            engineAvailability: this.ocrEngines
        };
    }

    /**
     * Validate and configure OCR engines
     */
    async validateEngines() {
        const validation = {
            tesseract: { available: false, error: null },
            google: { available: false, error: null },
            aws: { available: false, error: null }
        };

        // Test Tesseract
        try {
            const worker = await createWorker();
            await worker.loadLanguage('eng');
            await worker.initialize('eng');
            await worker.terminate();
            validation.tesseract.available = true;
            this.ocrEngines.tesseract.available = true;
        } catch (error) {
            validation.tesseract.error = error.message;
            this.ocrEngines.tesseract.available = false;
        }

        // Test Google Vision
        if (process.env.GOOGLE_VISION_API_KEY) {
            try {
                // Simple API test
                await axios.get(`https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`);
                validation.google.available = true;
                this.ocrEngines.google.available = true;
            } catch (error) {
                validation.google.error = error.response?.data?.error?.message || error.message;
                this.ocrEngines.google.available = false;
            }
        } else {
            validation.google.error = 'API key not configured';
            this.ocrEngines.google.available = false;
        }

        // Test AWS Textract
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            validation.aws.available = true;
            this.ocrEngines.aws.available = true;
        } else {
            validation.aws.error = 'AWS credentials not configured';
            this.ocrEngines.aws.available = false;
        }

        return validation;
    }

    /**
     * Export extracted data in various formats
     */
    async exportResults(results, format = 'json', outputPath = null) {
        const timestamp = new Date().toISOString().split('T')[0];
        const defaultPath = outputPath || `/tmp/ocr_results_${timestamp}.${format}`;

        switch (format.toLowerCase()) {
            case 'json':
                await fs.writeFile(defaultPath, JSON.stringify(results, null, 2));
                break;
            
            case 'csv':
                const csvData = this.convertToCSV(results);
                await fs.writeFile(defaultPath, csvData);
                break;
            
            case 'xml':
                const xmlData = this.convertToXML(results);
                await fs.writeFile(defaultPath, xmlData);
                break;
            
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }

        return defaultPath;
    }

    /**
     * Convert results to CSV format
     */
    convertToCSV(results) {
        if (!Array.isArray(results)) {
            results = [results];
        }

        const headers = ['fileName', 'documentType', 'confidence', 'processingTime', 'success', 'extractedText'];
        const rows = results.map(result => [
            result.fileName || '',
            result.documentType || '',
            result.confidence || 0,
            result.processingTime || 0,
            result.success || false,
            (result.text || '').replace(/"/g, '""').replace(/\n/g, ' ')
        ]);

        return [headers, ...rows].map(row => 
            row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
    }

    /**
     * Convert results to XML format
     */
    convertToXML(results) {
        if (!Array.isArray(results)) {
            results = [results];
        }

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<ocrResults>\n';
        
        for (const result of results) {
            xml += '  <document>\n';
            xml += `    <fileName>${this.escapeXML(result.fileName || '')}</fileName>\n`;
            xml += `    <documentType>${this.escapeXML(result.documentType || '')}</documentType>\n`;
            xml += `    <confidence>${result.confidence || 0}</confidence>\n`;
            xml += `    <processingTime>${result.processingTime || 0}</processingTime>\n`;
            xml += `    <success>${result.success || false}</success>\n`;
            xml += `    <extractedText><![CDATA[${result.text || ''}]]></extractedText>\n`;
            xml += '  </document>\n';
        }
        
        xml += '</ocrResults>';
        return xml;
    }

    /**
     * Escape XML special characters
     */
    escapeXML(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

export default DocumentOCRService;