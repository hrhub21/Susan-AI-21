import * as tf from '@tensorflow/tfjs-node';
import sharp from 'sharp';
import Jimp from 'jimp';
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs-extra';

/**
 * Before/After Comparison Service for Roof-ER
 * Tracks repair progress and creates visual comparisons for documentation
 */
export class BeforeAfterComparisonService {
    constructor() {
        this.models = {
            imageAlignment: null,
            progressDetection: null,
            qualityAssessment: null,
            changeDetection: null
        };
        
        this.comparisonProjects = new Map(); // Active comparison projects
        
        this.progressStages = {
            initial_damage: { order: 1, name: 'Initial Damage Documentation' },
            materials_delivered: { order: 2, name: 'Materials Delivered' },
            tear_off_started: { order: 3, name: 'Tear-off Started' },
            tear_off_complete: { order: 4, name: 'Tear-off Complete' },
            deck_prep: { order: 5, name: 'Deck Preparation' },
            underlayment: { order: 6, name: 'Underlayment Installation' },
            shingles_started: { order: 7, name: 'Shingle Installation Started' },
            shingles_progress: { order: 8, name: 'Shingle Installation Progress' },
            shingles_complete: { order: 9, name: 'Shingle Installation Complete' },
            flashing_gutters: { order: 10, name: 'Flashing & Gutters' },
            cleanup_started: { order: 11, name: 'Cleanup Started' },
            final_inspection: { order: 12, name: 'Final Inspection' },
            project_complete: { order: 13, name: 'Project Complete' }
        };
        
        this.qualityMetrics = {
            alignment: { weight: 0.20, description: 'Proper shingle alignment' },
            coverage: { weight: 0.25, description: 'Complete coverage' },
            flashing: { weight: 0.15, description: 'Proper flashing installation' },
            cleanup: { weight: 0.15, description: 'Site cleanup quality' },
            finishing: { weight: 0.25, description: 'Overall finishing quality' }
        };
        
        this.initialize();
    }

    async initialize() {
        try {
            console.log('🔄 Initializing Before/After Comparison Service...');
            
            await tf.ready();
            await this.loadComparisonModels();
            
            console.log('✅ Before/After Comparison Service ready');
        } catch (error) {
            console.error('❌ Failed to initialize comparison service:', error);
            throw error;
        }
    }

    async loadComparisonModels() {
        // Image alignment model for accurate before/after registration
        this.models.imageAlignment = await this.createImageAlignmentModel();
        
        // Progress detection model to identify work stages
        this.models.progressDetection = await this.createProgressDetectionModel();
        
        // Quality assessment model for work verification
        this.models.qualityAssessment = await this.createQualityAssessmentModel();
        
        // Change detection model for highlighting differences
        this.models.changeDetection = await this.createChangeDetectionModel();
    }

    async createImageAlignmentModel() {
        // Feature matching model for image registration
        const model = tf.sequential({
            layers: [
                tf.layers.conv2d({
                    inputShape: [256, 256, 6], // Concatenated before/after images
                    kernelSize: 3,
                    filters: 64,
                    activation: 'relu'
                }),
                tf.layers.maxPooling2d({ poolSize: [2, 2] }),
                tf.layers.conv2d({
                    kernelSize: 3,
                    filters: 128,
                    activation: 'relu'
                }),
                tf.layers.maxPooling2d({ poolSize: [2, 2] }),
                tf.layers.conv2d({
                    kernelSize: 3,
                    filters: 256,
                    activation: 'relu'
                }),
                tf.layers.globalAveragePooling2d(),
                tf.layers.dense({ units: 512, activation: 'relu' }),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({ units: 8 }) // Homography parameters
            ]
        });

        model.compile({
            optimizer: 'adam',
            loss: 'meanSquaredError',
            metrics: ['mae']
        });

        return model;
    }

    async createProgressDetectionModel() {
        // Multi-class classification for construction stages
        const model = tf.sequential({
            layers: [
                tf.layers.conv2d({
                    inputShape: [224, 224, 3],
                    kernelSize: 3,
                    filters: 32,
                    activation: 'relu'
                }),
                tf.layers.batchNormalization(),
                tf.layers.maxPooling2d({ poolSize: [2, 2] }),
                tf.layers.conv2d({
                    kernelSize: 3,
                    filters: 64,
                    activation: 'relu'
                }),
                tf.layers.batchNormalization(),
                tf.layers.maxPooling2d({ poolSize: [2, 2] }),
                tf.layers.conv2d({
                    kernelSize: 3,
                    filters: 128,
                    activation: 'relu'
                }),
                tf.layers.batchNormalization(),
                tf.layers.maxPooling2d({ poolSize: [2, 2] }),
                tf.layers.conv2d({
                    kernelSize: 3,
                    filters: 256,
                    activation: 'relu'
                }),
                tf.layers.globalAveragePooling2d(),
                tf.layers.dense({ units: 512, activation: 'relu' }),
                tf.layers.dropout({ rate: 0.4 }),
                tf.layers.dense({ units: 256, activation: 'relu' }),
                tf.layers.dense({ units: Object.keys(this.progressStages).length, activation: 'softmax' })
            ]
        });

        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        return model;
    }

    async createQualityAssessmentModel() {
        // Multi-output model for various quality metrics
        const input = tf.input({ shape: [224, 224, 3] });
        
        // Shared feature extraction layers
        let features = tf.layers.conv2d({ kernelSize: 3, filters: 64, activation: 'relu' }).apply(input);
        features = tf.layers.maxPooling2d({ poolSize: [2, 2] }).apply(features);
        features = tf.layers.conv2d({ kernelSize: 3, filters: 128, activation: 'relu' }).apply(features);
        features = tf.layers.maxPooling2d({ poolSize: [2, 2] }).apply(features);
        features = tf.layers.conv2d({ kernelSize: 3, filters: 256, activation: 'relu' }).apply(features);
        features = tf.layers.globalAveragePooling2d().apply(features);
        features = tf.layers.dense({ units: 512, activation: 'relu' }).apply(features);
        
        // Quality metric outputs
        const alignmentOutput = tf.layers.dense({ 
            units: 1, 
            activation: 'sigmoid',
            name: 'alignment'
        }).apply(features);
        
        const coverageOutput = tf.layers.dense({ 
            units: 1, 
            activation: 'sigmoid',
            name: 'coverage'
        }).apply(features);
        
        const flashingOutput = tf.layers.dense({ 
            units: 1, 
            activation: 'sigmoid',
            name: 'flashing'
        }).apply(features);
        
        const cleanupOutput = tf.layers.dense({ 
            units: 1, 
            activation: 'sigmoid',
            name: 'cleanup'
        }).apply(features);
        
        const finishingOutput = tf.layers.dense({ 
            units: 1, 
            activation: 'sigmoid',
            name: 'finishing'
        }).apply(features);
        
        const model = tf.model({
            inputs: input,
            outputs: [alignmentOutput, coverageOutput, flashingOutput, cleanupOutput, finishingOutput]
        });

        model.compile({
            optimizer: 'adam',
            loss: {
                alignment: 'binaryCrossentropy',
                coverage: 'binaryCrossentropy',
                flashing: 'binaryCrossentropy',
                cleanup: 'binaryCrossentropy',
                finishing: 'binaryCrossentropy'
            },
            metrics: ['accuracy']
        });

        return model;
    }

    async createChangeDetectionModel() {
        // Siamese network for change detection
        const inputA = tf.input({ shape: [224, 224, 3], name: 'before' });
        const inputB = tf.input({ shape: [224, 224, 3], name: 'after' });
        
        // Shared feature extractor
        const sharedLayers = tf.sequential({
            layers: [
                tf.layers.conv2d({ kernelSize: 3, filters: 64, activation: 'relu' }),
                tf.layers.maxPooling2d({ poolSize: [2, 2] }),
                tf.layers.conv2d({ kernelSize: 3, filters: 128, activation: 'relu' }),
                tf.layers.maxPooling2d({ poolSize: [2, 2] }),
                tf.layers.conv2d({ kernelSize: 3, filters: 256, activation: 'relu' }),
                tf.layers.globalAveragePooling2d()
            ]
        });
        
        const featuresA = sharedLayers.apply(inputA);
        const featuresB = sharedLayers.apply(inputB);
        
        // Compute feature difference
        const diff = tf.layers.subtract().apply([featuresA, featuresB]);
        const absDiff = tf.layers.lambda({
            func: (x) => tf.abs(x)
        }).apply(diff);
        
        // Classification layers
        let output = tf.layers.dense({ units: 256, activation: 'relu' }).apply(absDiff);
        output = tf.layers.dropout({ rate: 0.3 }).apply(output);
        output = tf.layers.dense({ units: 128, activation: 'relu' }).apply(output);
        output = tf.layers.dense({ units: 1, activation: 'sigmoid' }).apply(output);
        
        const model = tf.model({
            inputs: [inputA, inputB],
            outputs: output
        });

        model.compile({
            optimizer: 'adam',
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });

        return model;
    }

    /**
     * Create new before/after comparison project
     */
    async createComparisonProject(projectData) {
        try {
            const projectId = this.generateProjectId();
            
            const project = {
                id: projectId,
                created: new Date().toISOString(),
                property: {
                    address: projectData.property?.address || 'Unknown Address',
                    owner: projectData.property?.owner || 'Unknown Owner',
                    contractor: projectData.property?.contractor || 'Roof-ER Team',
                    projectType: projectData.property?.projectType || 'roof_replacement'
                },
                timeline: {
                    estimatedStart: projectData.timeline?.estimatedStart,
                    estimatedCompletion: projectData.timeline?.estimatedCompletion,
                    actualStart: null,
                    actualCompletion: null
                },
                stages: this.initializeProjectStages(),
                images: new Map(),
                progressHistory: [],
                qualityScores: new Map(),
                notifications: [],
                status: 'initialized'
            };
            
            this.comparisonProjects.set(projectId, project);
            
            console.log(`📁 Created comparison project: ${projectId}`);
            
            return {
                projectId,
                project,
                nextSteps: this.getNextSteps(project),
                uploadInstructions: this.getUploadInstructions('initial_damage')
            };

        } catch (error) {
            console.error('❌ Error creating comparison project:', error);
            throw new Error(`Project creation failed: ${error.message}`);
        }
    }

    /**
     * Add image to comparison project
     */
    async addProjectImage(projectId, imageBuffer, metadata) {
        try {
            const project = this.comparisonProjects.get(projectId);
            if (!project) {
                throw new Error('Project not found');
            }
            
            console.log(`📸 Adding image to project ${projectId}...`);
            
            // Process and analyze the image
            const imageAnalysis = await this.analyzeProjectImage(imageBuffer, metadata);
            
            // Detect current progress stage
            const stageDetection = await this.detectProgressStage(imageBuffer);
            
            // Store image with analysis
            const imageId = this.generateImageId();
            const imageData = {
                id: imageId,
                timestamp: new Date().toISOString(),
                stage: metadata.stage || stageDetection.detectedStage,
                confidence: stageDetection.confidence,
                analysis: imageAnalysis,
                metadata: {
                    ...metadata,
                    fileSize: imageBuffer.length,
                    dimensions: imageAnalysis.dimensions
                },
                buffer: imageBuffer,
                processed: imageAnalysis.processed
            };
            
            project.images.set(imageId, imageData);
            
            // Update project progress
            await this.updateProjectProgress(project, imageData);
            
            // Generate comparisons if we have before/after pairs
            const comparisons = await this.generateRelevantComparisons(project, imageData);
            
            // Check for quality issues
            const qualityCheck = await this.performQualityCheck(project, imageData);
            
            // Update project status
            this.updateProjectStatus(project);
            
            return {
                imageId,
                stageDetected: stageDetection.detectedStage,
                confidence: stageDetection.confidence,
                progressUpdate: this.getProgressSummary(project),
                comparisons,
                qualityCheck,
                notifications: this.generateNotifications(project, imageData)
            };

        } catch (error) {
            console.error('❌ Error adding project image:', error);
            throw new Error(`Image addition failed: ${error.message}`);
        }
    }

    async analyzeProjectImage(imageBuffer, metadata) {
        try {
            // Basic image processing
            const processed = await sharp(imageBuffer)
                .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85 })
                .toBuffer({ resolveWithObject: true });
            
            // Extract image features for comparison
            const features = await this.extractImageFeatures(imageBuffer);
            
            // Detect objects and elements in the image
            const objectDetection = await this.detectRoofingElements(imageBuffer);
            
            return {
                dimensions: processed.info,
                features,
                objectDetection,
                processed: processed.data,
                processingTime: Date.now()
            };

        } catch (error) {
            console.error('❌ Error analyzing project image:', error);
            return { error: error.message };
        }
    }

    async extractImageFeatures(imageBuffer) {
        try {
            // Extract keypoints and descriptors for image matching
            const image = await Jimp.read(imageBuffer);
            
            // Simplified feature extraction (in production, use SIFT/SURF/ORB)
            const features = {
                edges: await this.detectEdges(image),
                corners: await this.detectCorners(image),
                textures: await this.analyzeTextures(image),
                colors: await this.analyzeColorDistribution(image)
            };
            
            return features;

        } catch (error) {
            console.error('❌ Error extracting image features:', error);
            return { error: error.message };
        }
    }

    async detectEdges(image) {
        // Simplified edge detection
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        const edges = [];
        
        // Apply simple edge detection
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const gx = this.getSobelX(image, x, y);
                const gy = this.getSobelY(image, x, y);
                const magnitude = Math.sqrt(gx * gx + gy * gy);
                
                if (magnitude > 100) {
                    edges.push({ x, y, magnitude });
                }
            }
        }
        
        return edges.slice(0, 1000); // Limit for performance
    }

    getSobelX(image, x, y) {
        const kernel = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
                const pixel = Jimp.intToRGBA(image.getPixelColor(x + kx, y + ky));
                const gray = 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b;
                sum += gray * kernel[ky + 1][kx + 1];
            }
        }
        return sum;
    }

    getSobelY(image, x, y) {
        const kernel = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
                const pixel = Jimp.intToRGBA(image.getPixelColor(x + kx, y + ky));
                const gray = 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b;
                sum += gray * kernel[ky + 1][kx + 1];
            }
        }
        return sum;
    }

    async detectCorners(image) {
        // Simplified corner detection (Harris corner detector approximation)
        const corners = [];
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        
        // Sample corner detection at reduced resolution
        for (let y = 10; y < height - 10; y += 10) {
            for (let x = 10; x < width - 10; x += 10) {
                const strength = this.calculateCornerStrength(image, x, y);
                if (strength > 1000) {
                    corners.push({ x, y, strength });
                }
            }
        }
        
        return corners.slice(0, 500); // Limit for performance
    }

    calculateCornerStrength(image, x, y) {
        // Simplified corner strength calculation
        const windowSize = 3;
        let Ix2 = 0, Iy2 = 0, IxIy = 0;
        
        for (let dy = -windowSize; dy <= windowSize; dy++) {
            for (let dx = -windowSize; dx <= windowSize; dx++) {
                const gx = this.getSobelX(image, x + dx, y + dy);
                const gy = this.getSobelY(image, x + dx, y + dy);
                
                Ix2 += gx * gx;
                Iy2 += gy * gy;
                IxIy += gx * gy;
            }
        }
        
        // Harris corner response
        const det = Ix2 * Iy2 - IxIy * IxIy;
        const trace = Ix2 + Iy2;
        const k = 0.04;
        
        return det - k * trace * trace;
    }

    async analyzeTextures(image) {
        // Analyze texture patterns for material identification
        const textures = {
            shingles: 0,
            metal: 0,
            underlayment: 0,
            wood: 0,
            debris: 0
        };
        
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        const blockSize = 32;
        
        for (let y = 0; y < height - blockSize; y += blockSize) {
            for (let x = 0; x < width - blockSize; x += blockSize) {
                const textureType = this.classifyTextureBlock(image, x, y, blockSize);
                textures[textureType]++;
            }
        }
        
        // Normalize to percentages
        const total = Object.values(textures).reduce((sum, val) => sum + val, 0);
        if (total > 0) {
            Object.keys(textures).forEach(key => {
                textures[key] = (textures[key] / total) * 100;
            });
        }
        
        return textures;
    }

    classifyTextureBlock(image, startX, startY, blockSize) {
        // Simplified texture classification based on variance and patterns
        let variance = 0;
        let avgBrightness = 0;
        let pixelCount = 0;
        
        for (let y = startY; y < startY + blockSize && y < image.bitmap.height; y++) {
            for (let x = startX; x < startX + blockSize && x < image.bitmap.width; x++) {
                const pixel = Jimp.intToRGBA(image.getPixelColor(x, y));
                const brightness = 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b;
                avgBrightness += brightness;
                pixelCount++;
            }
        }
        
        avgBrightness /= pixelCount;
        
        // Calculate variance
        for (let y = startY; y < startY + blockSize && y < image.bitmap.height; y++) {
            for (let x = startX; x < startX + blockSize && x < image.bitmap.width; x++) {
                const pixel = Jimp.intToRGBA(image.getPixelColor(x, y));
                const brightness = 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b;
                variance += Math.pow(brightness - avgBrightness, 2);
            }
        }
        
        variance /= pixelCount;
        
        // Simple classification rules
        if (variance > 2000 && avgBrightness > 100) return 'shingles';
        if (variance < 500 && avgBrightness > 150) return 'metal';
        if (variance < 800 && avgBrightness < 80) return 'underlayment';
        if (variance > 1500 && avgBrightness < 120) return 'wood';
        return 'debris';
    }

    async analyzeColorDistribution(image) {
        const colors = {
            red: 0, green: 0, blue: 0,
            hue: { brown: 0, gray: 0, black: 0, white: 0 }
        };
        
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        let pixelCount = 0;
        
        // Sample pixels for performance
        for (let y = 0; y < height; y += 5) {
            for (let x = 0; x < width; x += 5) {
                const pixel = Jimp.intToRGBA(image.getPixelColor(x, y));
                colors.red += pixel.r;
                colors.green += pixel.g;
                colors.blue += pixel.b;
                
                // Classify hue
                const hsv = this.rgbToHsv(pixel.r, pixel.g, pixel.b);
                const hue = this.classifyHue(hsv);
                colors.hue[hue]++;
                
                pixelCount++;
            }
        }
        
        // Normalize
        colors.red = Math.round(colors.red / pixelCount);
        colors.green = Math.round(colors.green / pixelCount);
        colors.blue = Math.round(colors.blue / pixelCount);
        
        Object.keys(colors.hue).forEach(hue => {
            colors.hue[hue] = (colors.hue[hue] / pixelCount) * 100;
        });
        
        return colors;
    }

    rgbToHsv(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;
        
        let h = 0;
        const s = max === 0 ? 0 : diff / max;
        const v = max;
        
        if (diff !== 0) {
            switch (max) {
                case r: h = ((g - b) / diff) % 6; break;
                case g: h = (b - r) / diff + 2; break;
                case b: h = (r - g) / diff + 4; break;
            }
        }
        
        return { h: h * 60, s, v };
    }

    classifyHue(hsv) {
        const { h, s, v } = hsv;
        
        if (v < 0.2) return 'black';
        if (v > 0.8 && s < 0.2) return 'white';
        if (s < 0.3) return 'gray';
        if ((h >= 0 && h <= 30) || (h >= 330 && h <= 360)) return 'brown';
        return 'brown'; // Default for roofing materials
    }

    async detectRoofingElements(imageBuffer) {
        // Detect specific roofing elements and materials
        const elements = {
            shingles: { detected: false, coverage: 0, condition: 'unknown' },
            gutters: { detected: false, visible: false, condition: 'unknown' },
            flashing: { detected: false, visible: false, condition: 'unknown' },
            vents: { detected: false, count: 0, condition: 'unknown' },
            debris: { detected: false, amount: 'none' },
            tarps: { detected: false, coverage: 0 },
            equipment: { detected: false, items: [] },
            workers: { detected: false, count: 0 }
        };
        
        try {
            const image = await Jimp.read(imageBuffer);
            
            // Simplified element detection based on image analysis
            const textures = await this.analyzeTextures(image);
            const colors = await this.analyzeColorDistribution(image);
            
            // Shingle detection
            elements.shingles.detected = textures.shingles > 30;
            elements.shingles.coverage = textures.shingles;
            
            // Debris detection (high variance, mixed colors)
            elements.debris.detected = textures.debris > 10;
            elements.debris.amount = textures.debris > 20 ? 'high' : textures.debris > 10 ? 'moderate' : 'low';
            
            // Tarp detection (bright blue/orange colors)
            // This would require more sophisticated color analysis
            
            return elements;

        } catch (error) {
            console.error('❌ Error detecting roofing elements:', error);
            return elements;
        }
    }

    async detectProgressStage(imageBuffer) {
        try {
            const imageTensor = await this.imageToTensor(imageBuffer);
            
            // Run progress detection model
            const prediction = await this.models.progressDetection.predict(imageTensor);
            const probabilities = await prediction.data();
            
            // Find highest probability stage
            const maxIndex = probabilities.indexOf(Math.max(...probabilities));
            const confidence = probabilities[maxIndex];
            
            const stages = Object.keys(this.progressStages);
            const detectedStage = stages[maxIndex] || 'unknown';
            
            imageTensor.dispose();
            prediction.dispose();
            
            return {
                detectedStage,
                confidence,
                allProbabilities: stages.reduce((acc, stage, index) => {
                    acc[stage] = probabilities[index];
                    return acc;
                }, {})
            };

        } catch (error) {
            console.error('❌ Error detecting progress stage:', error);
            return {
                detectedStage: 'unknown',
                confidence: 0,
                error: error.message
            };
        }
    }

    async updateProjectProgress(project, imageData) {
        const stage = imageData.stage;
        const timestamp = imageData.timestamp;
        
        // Update stage status
        if (project.stages[stage]) {
            project.stages[stage].status = 'completed';
            project.stages[stage].completedAt = timestamp;
            project.stages[stage].imageId = imageData.id;
        }
        
        // Add to progress history
        project.progressHistory.push({
            stage,
            timestamp,
            imageId: imageData.id,
            confidence: imageData.confidence,
            notes: imageData.metadata.notes || ''
        });
        
        // Update timeline
        if (stage === 'initial_damage' && !project.timeline.actualStart) {
            project.timeline.actualStart = timestamp;
        }
        
        if (stage === 'project_complete') {
            project.timeline.actualCompletion = timestamp;
        }
        
        // Calculate overall progress percentage
        const completedStages = Object.values(project.stages).filter(s => s.status === 'completed').length;
        const totalStages = Object.keys(project.stages).length;
        project.progressPercentage = Math.round((completedStages / totalStages) * 100);
    }

    async generateRelevantComparisons(project, newImageData) {
        const comparisons = [];
        
        try {
            // Find relevant before images for comparison
            const beforeImages = this.findBeforeImages(project, newImageData.stage);
            
            for (const beforeImage of beforeImages) {
                const comparison = await this.createImageComparison(
                    beforeImage,
                    newImageData,
                    project
                );
                
                if (comparison) {
                    comparisons.push(comparison);
                }
            }
            
            return comparisons;

        } catch (error) {
            console.error('❌ Error generating comparisons:', error);
            return [];
        }
    }

    findBeforeImages(project, currentStage) {
        const beforeImages = [];
        const currentOrder = this.progressStages[currentStage]?.order || 0;
        
        // Find images from earlier stages
        for (const [imageId, imageData] of project.images) {
            const imageOrder = this.progressStages[imageData.stage]?.order || 0;
            
            if (imageOrder < currentOrder) {
                beforeImages.push(imageData);
            }
        }
        
        // Sort by stage order (most recent before image first)
        beforeImages.sort((a, b) => {
            const orderA = this.progressStages[a.stage]?.order || 0;
            const orderB = this.progressStages[b.stage]?.order || 0;
            return orderB - orderA;
        });
        
        return beforeImages.slice(0, 3); // Limit to 3 most relevant comparisons
    }

    async createImageComparison(beforeImage, afterImage, project) {
        try {
            const comparisonId = this.generateComparisonId();
            
            // Align images for accurate comparison
            const alignment = await this.alignImages(beforeImage.buffer, afterImage.buffer);
            
            // Detect changes between images
            const changeDetection = await this.detectChanges(
                alignment.alignedBefore,
                alignment.alignedAfter
            );
            
            // Create visual comparison image
            const comparisonVisual = await this.createComparisonVisual(
                alignment.alignedBefore,
                alignment.alignedAfter,
                changeDetection
            );
            
            // Calculate progress metrics
            const progressMetrics = this.calculateProgressMetrics(
                beforeImage,
                afterImage,
                changeDetection
            );
            
            const comparison = {
                id: comparisonId,
                projectId: project.id,
                beforeImage: {
                    id: beforeImage.id,
                    stage: beforeImage.stage,
                    timestamp: beforeImage.timestamp
                },
                afterImage: {
                    id: afterImage.id,
                    stage: afterImage.stage,
                    timestamp: afterImage.timestamp
                },
                alignment: {
                    success: alignment.success,
                    confidence: alignment.confidence,
                    transformParams: alignment.transformParams
                },
                changes: changeDetection,
                visual: comparisonVisual,
                metrics: progressMetrics,
                created: new Date().toISOString(),
                type: this.getComparisonType(beforeImage.stage, afterImage.stage)
            };
            
            return comparison;

        } catch (error) {
            console.error('❌ Error creating image comparison:', error);
            return null;
        }
    }

    async alignImages(beforeBuffer, afterBuffer) {
        try {
            // Simplified image alignment (in production, use more sophisticated methods)
            const before = await Jimp.read(beforeBuffer);
            const after = await Jimp.read(afterBuffer);
            
            // Resize to same dimensions
            const targetWidth = Math.min(before.bitmap.width, after.bitmap.width);
            const targetHeight = Math.min(before.bitmap.height, after.bitmap.height);
            
            before.resize(targetWidth, targetHeight);
            after.resize(targetWidth, targetHeight);
            
            // For now, return resized images (in production, implement feature matching)
            const alignedBefore = await before.getBufferAsync(Jimp.MIME_JPEG);
            const alignedAfter = await after.getBufferAsync(Jimp.MIME_JPEG);
            
            return {
                success: true,
                confidence: 0.8, // Simplified confidence
                alignedBefore,
                alignedAfter,
                transformParams: { scale: 1.0, rotation: 0, translation: [0, 0] }
            };

        } catch (error) {
            console.error('❌ Error aligning images:', error);
            return {
                success: false,
                confidence: 0,
                alignedBefore: beforeBuffer,
                alignedAfter: afterBuffer
            };
        }
    }

    async detectChanges(beforeBuffer, afterBuffer) {
        try {
            const beforeTensor = await this.imageToTensor(beforeBuffer);
            const afterTensor = await this.imageToTensor(afterBuffer);
            
            // Run change detection model
            const prediction = await this.models.changeDetection.predict([beforeTensor, afterTensor]);
            const changeScore = (await prediction.data())[0];
            
            // Create change map by pixel differences
            const changeMap = await this.createChangeMap(beforeBuffer, afterBuffer);
            
            beforeTensor.dispose();
            afterTensor.dispose();
            prediction.dispose();
            
            return {
                overallChangeScore: changeScore,
                changeMap,
                significantChanges: changeScore > 0.5,
                changeAreas: this.identifyChangeAreas(changeMap),
                summary: this.summarizeChanges(changeScore, changeMap)
            };

        } catch (error) {
            console.error('❌ Error detecting changes:', error);
            return {
                overallChangeScore: 0,
                changeMap: null,
                significantChanges: false,
                error: error.message
            };
        }
    }

    async createChangeMap(beforeBuffer, afterBuffer) {
        try {
            const before = await Jimp.read(beforeBuffer);
            const after = await Jimp.read(afterBuffer);
            
            const width = before.bitmap.width;
            const height = before.bitmap.height;
            const changeMap = new Jimp(width, height, 0x00000000);
            
            // Calculate pixel differences
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const beforePixel = Jimp.intToRGBA(before.getPixelColor(x, y));
                    const afterPixel = Jimp.intToRGBA(after.getPixelColor(x, y));
                    
                    const diff = Math.abs(beforePixel.r - afterPixel.r) +
                                Math.abs(beforePixel.g - afterPixel.g) +
                                Math.abs(beforePixel.b - afterPixel.b);
                    
                    const intensity = Math.min(255, diff);
                    const changeColor = Jimp.rgbaToInt(intensity, 0, 0, intensity > 30 ? 128 : 0);
                    
                    changeMap.setPixelColor(changeColor, x, y);
                }
            }
            
            return await changeMap.getBufferAsync(Jimp.MIME_PNG);

        } catch (error) {
            console.error('❌ Error creating change map:', error);
            return null;
        }
    }

    identifyChangeAreas(changeMapBuffer) {
        if (!changeMapBuffer) return [];
        
        // Simplified change area identification
        // In production, use connected component analysis
        return [
            { x: 100, y: 100, width: 50, height: 50, confidence: 0.8, type: 'material_change' },
            { x: 200, y: 150, width: 75, height: 30, confidence: 0.9, type: 'installation_progress' }
        ];
    }

    summarizeChanges(changeScore, changeMap) {
        if (changeScore < 0.2) return 'Minimal changes detected';
        if (changeScore < 0.5) return 'Moderate progress visible';
        if (changeScore < 0.8) return 'Significant work completed';
        return 'Major transformation completed';
    }

    async createComparisonVisual(beforeBuffer, afterBuffer, changeDetection) {
        try {
            const canvas = createCanvas(1200, 600);
            const ctx = canvas.getContext('2d');
            
            // Load images
            const beforeImg = await loadImage(beforeBuffer);
            const afterImg = await loadImage(afterBuffer);
            
            // Draw side-by-side comparison
            ctx.drawImage(beforeImg, 0, 0, 600, 600);
            ctx.drawImage(afterImg, 600, 0, 600, 600);
            
            // Add labels
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(0, 0, 600, 40);
            ctx.fillRect(600, 0, 600, 40);
            
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '24px Arial';
            ctx.fillText('BEFORE', 20, 30);
            ctx.fillText('AFTER', 620, 30);
            
            // Add change indicators
            if (changeDetection.changeAreas) {
                ctx.strokeStyle = '#FF0000';
                ctx.lineWidth = 3;
                
                changeDetection.changeAreas.forEach(area => {
                    // Draw on after image
                    ctx.strokeRect(600 + area.x, area.y, area.width, area.height);
                });
            }
            
            // Add comparison metrics
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(20, 520, 560, 60);
            
            ctx.fillStyle = '#000000';
            ctx.font = '16px Arial';
            ctx.fillText(`Change Score: ${Math.round(changeDetection.overallChangeScore * 100)}%`, 30, 545);
            ctx.fillText(`Status: ${changeDetection.summary}`, 30, 565);
            
            return {
                buffer: canvas.toBuffer('image/jpeg', { quality: 0.9 }),
                format: 'jpeg',
                dimensions: { width: 1200, height: 600 }
            };

        } catch (error) {
            console.error('❌ Error creating comparison visual:', error);
            return null;
        }
    }

    calculateProgressMetrics(beforeImage, afterImage, changeDetection) {
        const timeDiff = new Date(afterImage.timestamp) - new Date(beforeImage.timestamp);
        const daysDiff = Math.round(timeDiff / (1000 * 60 * 60 * 24));
        
        return {
            timeElapsed: {
                days: daysDiff,
                hours: Math.round(timeDiff / (1000 * 60 * 60)),
                formatted: this.formatTimeDuration(timeDiff)
            },
            changeMetrics: {
                overallChange: changeDetection.overallChangeScore,
                significantAreas: changeDetection.changeAreas?.length || 0,
                progressIndicator: this.calculateProgressIndicator(beforeImage.stage, afterImage.stage)
            },
            workQuality: {
                assessmentPending: true,
                estimatedCompletion: this.estimateCompletionFromStages(beforeImage.stage, afterImage.stage)
            }
        };
    }

    calculateProgressIndicator(beforeStage, afterStage) {
        const beforeOrder = this.progressStages[beforeStage]?.order || 0;
        const afterOrder = this.progressStages[afterStage]?.order || 0;
        const totalStages = Object.keys(this.progressStages).length;
        
        const stagesAdvanced = afterOrder - beforeOrder;
        const progressPercent = (afterOrder / totalStages) * 100;
        
        return {
            stagesAdvanced,
            currentProgress: Math.round(progressPercent),
            onTrack: stagesAdvanced > 0
        };
    }

    estimateCompletionFromStages(beforeStage, afterStage) {
        // Simple estimation based on typical project timelines
        const stageTimelines = {
            initial_damage: 0,
            materials_delivered: 1,
            tear_off_started: 2,
            tear_off_complete: 3,
            deck_prep: 4,
            underlayment: 5,
            shingles_started: 6,
            shingles_progress: 8,
            shingles_complete: 10,
            flashing_gutters: 11,
            cleanup_started: 12,
            final_inspection: 13,
            project_complete: 14
        };
        
        const currentDay = stageTimelines[afterStage] || 0;
        const totalDays = stageTimelines.project_complete;
        const remainingDays = totalDays - currentDay;
        
        return {
            estimatedDaysRemaining: remainingDays,
            estimatedCompletionDate: new Date(Date.now() + remainingDays * 24 * 60 * 60 * 1000).toISOString()
        };
    }

    getComparisonType(beforeStage, afterStage) {
        const stageTypes = {
            'initial_damage->materials_delivered': 'preparation',
            'tear_off_started->tear_off_complete': 'demolition',
            'deck_prep->underlayment': 'preparation',
            'underlayment->shingles_started': 'installation_start',
            'shingles_started->shingles_progress': 'installation_progress',
            'shingles_progress->shingles_complete': 'installation_completion',
            'shingles_complete->flashing_gutters': 'finishing',
            'cleanup_started->final_inspection': 'completion',
            'final_inspection->project_complete': 'final_completion'
        };
        
        const key = `${beforeStage}->${afterStage}`;
        return stageTypes[key] || 'progress_update';
    }

    async performQualityCheck(project, imageData) {
        try {
            const qualityAssessment = await this.assessWorkQuality(imageData.buffer);
            
            // Store quality scores
            project.qualityScores.set(imageData.id, {
                timestamp: imageData.timestamp,
                stage: imageData.stage,
                scores: qualityAssessment.scores,
                overallScore: qualityAssessment.overallScore,
                issues: qualityAssessment.issues,
                recommendations: qualityAssessment.recommendations
            });
            
            return qualityAssessment;

        } catch (error) {
            console.error('❌ Error performing quality check:', error);
            return {
                overallScore: 0,
                scores: {},
                issues: ['Quality assessment failed'],
                error: error.message
            };
        }
    }

    async assessWorkQuality(imageBuffer) {
        try {
            const imageTensor = await this.imageToTensor(imageBuffer);
            
            // Run quality assessment model
            const predictions = await this.models.qualityAssessment.predict(imageTensor);
            
            // Extract scores for each quality metric
            const scores = {};
            const metricNames = Object.keys(this.qualityMetrics);
            
            for (let i = 0; i < metricNames.length; i++) {
                const score = (await predictions[i].data())[0];
                scores[metricNames[i]] = Math.round(score * 100);
            }
            
            // Calculate weighted overall score
            let overallScore = 0;
            Object.entries(scores).forEach(([metric, score]) => {
                const weight = this.qualityMetrics[metric].weight;
                overallScore += score * weight;
            });
            
            overallScore = Math.round(overallScore);
            
            // Identify issues and recommendations
            const issues = this.identifyQualityIssues(scores);
            const recommendations = this.generateQualityRecommendations(scores, issues);
            
            // Clean up tensors
            imageTensor.dispose();
            predictions.forEach(pred => pred.dispose());
            
            return {
                overallScore,
                scores,
                issues,
                recommendations,
                grade: this.calculateQualityGrade(overallScore),
                passesInspection: overallScore >= 80
            };

        } catch (error) {
            console.error('❌ Error assessing work quality:', error);
            return {
                overallScore: 0,
                scores: {},
                issues: ['Quality assessment failed'],
                error: error.message
            };
        }
    }

    identifyQualityIssues(scores) {
        const issues = [];
        const threshold = 70; // Minimum acceptable score
        
        Object.entries(scores).forEach(([metric, score]) => {
            if (score < threshold) {
                const description = this.qualityMetrics[metric].description;
                issues.push({
                    metric,
                    score,
                    description,
                    severity: score < 50 ? 'critical' : score < 60 ? 'major' : 'minor'
                });
            }
        });
        
        return issues;
    }

    generateQualityRecommendations(scores, issues) {
        const recommendations = [];
        
        issues.forEach(issue => {
            switch (issue.metric) {
                case 'alignment':
                    recommendations.push('Check shingle alignment and straightness');
                    break;
                case 'coverage':
                    recommendations.push('Ensure complete coverage without gaps');
                    break;
                case 'flashing':
                    recommendations.push('Verify proper flashing installation and sealing');
                    break;
                case 'cleanup':
                    recommendations.push('Complete site cleanup and debris removal');
                    break;
                case 'finishing':
                    recommendations.push('Address finishing details and touch-ups');
                    break;
            }
        });
        
        if (recommendations.length === 0) {
            recommendations.push('Work quality meets professional standards');
        }
        
        return recommendations;
    }

    calculateQualityGrade(overallScore) {
        if (overallScore >= 95) return 'A+';
        if (overallScore >= 90) return 'A';
        if (overallScore >= 85) return 'B+';
        if (overallScore >= 80) return 'B';
        if (overallScore >= 75) return 'C+';
        if (overallScore >= 70) return 'C';
        if (overallScore >= 65) return 'D+';
        if (overallScore >= 60) return 'D';
        return 'F';
    }

    updateProjectStatus(project) {
        const completedStages = Object.values(project.stages).filter(s => s.status === 'completed').length;
        const totalStages = Object.keys(project.stages).length;
        const progressPercent = (completedStages / totalStages) * 100;
        
        if (progressPercent === 0) {
            project.status = 'not_started';
        } else if (progressPercent < 25) {
            project.status = 'planning';
        } else if (progressPercent < 75) {
            project.status = 'in_progress';
        } else if (progressPercent < 100) {
            project.status = 'finishing';
        } else {
            project.status = 'completed';
        }
        
        project.lastUpdated = new Date().toISOString();
    }

    generateNotifications(project, imageData) {
        const notifications = [];
        
        // Progress notifications
        const stageName = this.progressStages[imageData.stage]?.name || imageData.stage;
        notifications.push({
            type: 'progress_update',
            title: 'Progress Update',
            message: `${stageName} documented`,
            timestamp: imageData.timestamp,
            priority: 'info'
        });
        
        // Quality notifications
        const latestQuality = Array.from(project.qualityScores.values()).pop();
        if (latestQuality && latestQuality.issues.length > 0) {
            notifications.push({
                type: 'quality_issue',
                title: 'Quality Check Alert',
                message: `${latestQuality.issues.length} quality issue(s) identified`,
                timestamp: imageData.timestamp,
                priority: 'warning'
            });
        }
        
        // Milestone notifications
        if (imageData.stage === 'project_complete') {
            notifications.push({
                type: 'milestone',
                title: 'Project Completed!',
                message: 'Roof replacement project has been completed',
                timestamp: imageData.timestamp,
                priority: 'success'
            });
        }
        
        return notifications;
    }

    /**
     * Get comprehensive progress summary
     */
    getProgressSummary(project) {
        const completedStages = Object.values(project.stages).filter(s => s.status === 'completed');
        const totalStages = Object.keys(project.stages).length;
        const progressPercent = Math.round((completedStages.length / totalStages) * 100);
        
        return {
            projectId: project.id,
            overallProgress: progressPercent,
            currentStage: this.getCurrentStage(project),
            nextStage: this.getNextStage(project),
            completedStages: completedStages.length,
            totalStages,
            timeline: {
                started: project.timeline.actualStart,
                estimatedCompletion: project.timeline.estimatedCompletion,
                daysElapsed: this.calculateDaysElapsed(project.timeline.actualStart),
                onSchedule: this.isProjectOnSchedule(project)
            },
            quality: this.getOverallQualityScore(project),
            images: {
                total: project.images.size,
                byStage: this.getImageCountByStage(project)
            },
            lastUpdate: project.lastUpdated
        };
    }

    getCurrentStage(project) {
        const completedStages = Object.entries(project.stages)
            .filter(([stage, data]) => data.status === 'completed')
            .sort(([a], [b]) => {
                const orderA = this.progressStages[a]?.order || 0;
                const orderB = this.progressStages[b]?.order || 0;
                return orderB - orderA;
            });
        
        if (completedStages.length === 0) return null;
        
        const [latestStage] = completedStages[0];
        return {
            stage: latestStage,
            name: this.progressStages[latestStage]?.name || latestStage,
            completedAt: project.stages[latestStage].completedAt
        };
    }

    getNextStage(project) {
        const completedOrders = Object.entries(project.stages)
            .filter(([stage, data]) => data.status === 'completed')
            .map(([stage]) => this.progressStages[stage]?.order || 0);
        
        const maxOrder = Math.max(...completedOrders, 0);
        
        const nextStageEntry = Object.entries(this.progressStages)
            .find(([stage, data]) => data.order === maxOrder + 1);
        
        if (!nextStageEntry) return null;
        
        const [nextStage, nextStageData] = nextStageEntry;
        return {
            stage: nextStage,
            name: nextStageData.name,
            order: nextStageData.order
        };
    }

    calculateDaysElapsed(startDate) {
        if (!startDate) return 0;
        
        const start = new Date(startDate);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    isProjectOnSchedule(project) {
        if (!project.timeline.estimatedCompletion || !project.timeline.actualStart) {
            return null; // Cannot determine
        }
        
        const estimatedDuration = new Date(project.timeline.estimatedCompletion) - new Date(project.timeline.actualStart);
        const actualDuration = new Date() - new Date(project.timeline.actualStart);
        const progressPercent = project.progressPercentage || 0;
        
        const expectedProgress = (actualDuration / estimatedDuration) * 100;
        const variance = progressPercent - expectedProgress;
        
        return {
            onSchedule: variance >= -10, // Within 10% is considered on schedule
            variance,
            status: variance >= 10 ? 'ahead' : variance <= -10 ? 'behind' : 'on_track'
        };
    }

    getOverallQualityScore(project) {
        const qualityScores = Array.from(project.qualityScores.values());
        
        if (qualityScores.length === 0) {
            return { score: null, grade: null, assessments: 0 };
        }
        
        const avgScore = qualityScores.reduce((sum, assessment) => sum + assessment.overallScore, 0) / qualityScores.length;
        
        return {
            score: Math.round(avgScore),
            grade: this.calculateQualityGrade(avgScore),
            assessments: qualityScores.length,
            trend: this.calculateQualityTrend(qualityScores)
        };
    }

    calculateQualityTrend(qualityScores) {
        if (qualityScores.length < 2) return 'insufficient_data';
        
        const recent = qualityScores.slice(-3); // Last 3 assessments
        const older = qualityScores.slice(-6, -3); // Previous 3 assessments
        
        if (older.length === 0) return 'insufficient_data';
        
        const recentAvg = recent.reduce((sum, a) => sum + a.overallScore, 0) / recent.length;
        const olderAvg = older.reduce((sum, a) => sum + a.overallScore, 0) / older.length;
        
        const difference = recentAvg - olderAvg;
        
        if (difference > 5) return 'improving';
        if (difference < -5) return 'declining';
        return 'stable';
    }

    getImageCountByStage(project) {
        const counts = {};
        
        for (const [imageId, imageData] of project.images) {
            const stage = imageData.stage;
            counts[stage] = (counts[stage] || 0) + 1;
        }
        
        return counts;
    }

    // Utility methods
    initializeProjectStages() {
        const stages = {};
        
        Object.keys(this.progressStages).forEach(stageKey => {
            stages[stageKey] = {
                status: 'pending',
                completedAt: null,
                imageId: null,
                notes: ''
            };
        });
        
        return stages;
    }

    getNextSteps(project) {
        const currentStage = this.getCurrentStage(project);
        const nextStage = this.getNextStage(project);
        
        if (!nextStage) {
            return ['Project appears to be complete'];
        }
        
        return [
            `Next: ${nextStage.name}`,
            'Take photos to document progress',
            'Upload images with stage selection',
            'Review quality assessment results'
        ];
    }

    getUploadInstructions(stage) {
        const instructions = {
            initial_damage: [
                'Document all existing damage from multiple angles',
                'Include close-ups of specific damage areas',
                'Capture overall roof condition'
            ],
            materials_delivered: [
                'Show materials organized on site',
                'Document material quantities and condition',
                'Include delivery documentation if visible'
            ],
            tear_off_started: [
                'Document removal progress',
                'Show exposed deck areas',
                'Capture safety measures in place'
            ],
            shingles_complete: [
                'Show completed shingle installation',
                'Document alignment and finishing',
                'Include overall roof appearance'
            ],
            project_complete: [
                'Final documentation from all angles',
                'Show completed work and cleanup',
                'Document any remaining punch list items'
            ]
        };
        
        return instructions[stage] || [
            'Document current work progress',
            'Include clear, well-lit photos',
            'Capture both overview and detail shots'
        ];
    }

    formatTimeDuration(milliseconds) {
        const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
        const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`;
        } else {
            return `${hours} hour${hours > 1 ? 's' : ''}`;
        }
    }

    async imageToTensor(imageBuffer) {
        try {
            const imageTensor = tf.node.decodeImage(imageBuffer, 3)
                .resizeBilinear([224, 224])
                .cast('float32')
                .div(255.0)
                .expandDims(0);
            
            return imageTensor;
        } catch (error) {
            console.error('❌ Error converting image to tensor:', error);
            throw error;
        }
    }

    // ID generation methods
    generateProjectId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        return `PROJ-${timestamp}-${random}`.toUpperCase();
    }

    generateImageId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 4);
        return `IMG-${timestamp}-${random}`.toUpperCase();
    }

    generateComparisonId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 4);
        return `CMP-${timestamp}-${random}`.toUpperCase();
    }

    // Public API methods
    getAllProjects() {
        return Array.from(this.comparisonProjects.values()).map(project => ({
            id: project.id,
            property: project.property,
            status: project.status,
            progressPercentage: project.progressPercentage || 0,
            lastUpdated: project.lastUpdated,
            imageCount: project.images.size
        }));
    }

    getProject(projectId) {
        return this.comparisonProjects.get(projectId);
    }

    async generateProjectReport(projectId, options = {}) {
        const project = this.comparisonProjects.get(projectId);
        if (!project) {
            throw new Error('Project not found');
        }
        
        // Generate comprehensive before/after report
        // This would integrate with the AutomaticPhotoReportService
        return {
            projectId,
            reportGenerated: true,
            reportType: options.reportType || 'progress_report',
            // Additional report generation logic would go here
        };
    }
}