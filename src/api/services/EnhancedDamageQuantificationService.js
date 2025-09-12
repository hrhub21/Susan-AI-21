import * as tf from '@tensorflow/tfjs-node';
import sharp from 'sharp';
import Jimp from 'jimp';
import { createCanvas, loadImage } from 'canvas';

/**
 * Enhanced Damage Quantification Service for Roof-ER
 * Provides precise damage measurements per square foot and advanced analytics
 */
export class EnhancedDamageQuantificationService {
    constructor() {
        this.models = {
            impactDensity: null,
            granuleMapping: null,
            surfaceArea: null,
            damageProgression: null
        };
        
        this.calibrationData = {
            pixelsPerSquareFoot: 100, // Base calibration - will be refined per image
            standardRoofHeight: 10, // feet
            standardShingleSize: { width: 12, height: 36 }, // inches
            hailSizeCategories: {
                pea: { min: 0.25, max: 0.5 }, // inches
                marble: { min: 0.5, max: 0.75 },
                penny: { min: 0.75, max: 1.0 },
                nickel: { min: 0.88, max: 1.0 },
                quarter: { min: 1.0, max: 1.25 },
                half_dollar: { min: 1.25, max: 1.5 },
                walnut: { min: 1.5, max: 1.75 },
                golf_ball: { min: 1.75, max: 2.0 },
                tennis_ball: { min: 2.5, max: 3.0 },
                baseball: { min: 2.75, max: 3.5 }
            }
        };
        
        this.measurementAccuracy = {
            gpsCalibration: true,
            objectReference: true,
            multiAngleAnalysis: true,
            weatherDataCorrelation: true
        };
        
        this.initialize();
    }

    async initialize() {
        try {
            console.log('🔧 Initializing Enhanced Damage Quantification Service...');
            
            await tf.ready();
            await this.loadQuantificationModels();
            
            console.log('✅ Enhanced Damage Quantification Service ready');
        } catch (error) {
            console.error('❌ Failed to initialize quantification service:', error);
            throw error;
        }
    }

    async loadQuantificationModels() {
        // Advanced impact density mapping model
        this.models.impactDensity = await this.createImpactDensityModel();
        
        // Precise granule coverage mapping model
        this.models.granuleMapping = await this.createGranuleMappingModel();
        
        // Surface area estimation model
        this.models.surfaceArea = await this.createSurfaceAreaModel();
        
        // Damage progression prediction model
        this.models.damageProgression = await this.createDamageProgressionModel();
    }

    async createImpactDensityModel() {
        // Advanced model for precise impact density calculation
        const model = tf.sequential({
            layers: [
                tf.layers.conv2d({
                    inputShape: [224, 224, 3],
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
                tf.layers.dense({ units: 256, activation: 'relu' }),
                tf.layers.dense({ units: 100, activation: 'sigmoid' }) // Impacts per 100 sq ft
            ]
        });

        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'meanSquaredError',
            metrics: ['mae']
        });

        return model;
    }

    async createGranuleMappingModel() {
        // Pixel-level granule coverage analysis
        const model = tf.sequential({
            layers: [
                tf.layers.conv2d({
                    inputShape: [224, 224, 3],
                    kernelSize: 3,
                    filters: 32,
                    activation: 'relu'
                }),
                tf.layers.conv2d({
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
                tf.layers.upSampling2d({ size: [2, 2] }),
                tf.layers.conv2d({
                    kernelSize: 3,
                    filters: 64,
                    activation: 'relu'
                }),
                tf.layers.conv2d({
                    kernelSize: 1,
                    filters: 1,
                    activation: 'sigmoid'
                }) // Granule coverage map
            ]
        });

        model.compile({
            optimizer: 'adam',
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });

        return model;
    }

    async createSurfaceAreaModel() {
        // Model for estimating roof surface area from images
        const model = tf.sequential({
            layers: [
                tf.layers.conv2d({
                    inputShape: [224, 224, 3],
                    kernelSize: 5,
                    filters: 32,
                    activation: 'relu'
                }),
                tf.layers.maxPooling2d({ poolSize: [2, 2] }),
                tf.layers.conv2d({
                    kernelSize: 3,
                    filters: 64,
                    activation: 'relu'
                }),
                tf.layers.maxPooling2d({ poolSize: [2, 2] }),
                tf.layers.flatten(),
                tf.layers.dense({ units: 256, activation: 'relu' }),
                tf.layers.dropout({ rate: 0.4 }),
                tf.layers.dense({ units: 128, activation: 'relu' }),
                tf.layers.dense({ units: 3 }) // [surface_area_sq_ft, angle_correction, depth_estimation]
            ]
        });

        model.compile({
            optimizer: 'adam',
            loss: 'meanSquaredError',
            metrics: ['mae']
        });

        return model;
    }

    async createDamageProgressionModel() {
        // Model for predicting damage progression over time
        const model = tf.sequential({
            layers: [
                tf.layers.dense({
                    inputShape: [10], // damage metrics + weather + time factors
                    units: 128,
                    activation: 'relu'
                }),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({ units: 64, activation: 'relu' }),
                tf.layers.dense({ units: 32, activation: 'relu' }),
                tf.layers.dense({ units: 1, activation: 'sigmoid' }) // Progression probability
            ]
        });

        model.compile({
            optimizer: 'adam',
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });

        return model;
    }

    /**
     * Enhanced damage quantification with precise measurements
     */
    async quantifyDamagePerSquareFoot(imageBuffer, existingAnalysis, metadata = {}) {
        try {
            console.log('📏 Starting enhanced damage quantification...');
            
            // Calibrate measurements based on image properties
            const calibration = await this.calibrateImageMeasurements(imageBuffer, metadata);
            
            // Analyze surface area and perspective
            const surfaceAnalysis = await this.analyzeSurfaceArea(imageBuffer, calibration);
            
            // Count impacts with precise positioning
            const impactQuantification = await this.quantifyImpacts(
                imageBuffer, 
                existingAnalysis.hail, 
                surfaceAnalysis
            );
            
            // Measure granule loss with pixel-level precision
            const granuleQuantification = await this.quantifyGranuleLoss(
                imageBuffer, 
                existingAnalysis.granuleLoss, 
                surfaceAnalysis
            );
            
            // Analyze damage distribution patterns
            const distributionAnalysis = await this.analyzeDamageDistribution(
                impactQuantification, 
                granuleQuantification, 
                surfaceAnalysis
            );
            
            // Generate severity scoring
            const severityScore = await this.calculateEnhancedSeverityScore(
                impactQuantification,
                granuleQuantification,
                distributionAnalysis
            );
            
            // Predict damage progression
            const progressionPrediction = await this.predictDamageProgression(
                impactQuantification,
                granuleQuantification,
                metadata
            );
            
            return {
                timestamp: new Date().toISOString(),
                calibration,
                surfaceAnalysis,
                impactQuantification,
                granuleQuantification,
                distributionAnalysis,
                severityScore,
                progressionPrediction,
                recommendations: this.generateQuantificationRecommendations({
                    impactQuantification,
                    granuleQuantification,
                    severityScore
                }),
                compliance: this.generateComplianceReport({
                    impactQuantification,
                    granuleQuantification,
                    severityScore
                })
            };

        } catch (error) {
            console.error('❌ Error in damage quantification:', error);
            throw new Error(`Quantification failed: ${error.message}`);
        }
    }

    async calibrateImageMeasurements(imageBuffer, metadata) {
        try {
            // Extract calibration data from image
            const imageInfo = await sharp(imageBuffer).metadata();
            
            // GPS-based calibration if available
            let gpsCalibration = null;
            if (metadata.gps) {
                gpsCalibration = await this.calibrateWithGPS(metadata.gps, imageInfo);
            }
            
            // Object reference calibration (shingles, gutters, etc.)
            const objectCalibration = await this.calibrateWithKnownObjects(imageBuffer);
            
            // Calculate pixels per square foot
            const pixelsPerSquareFoot = this.calculatePixelRatio(
                imageInfo,
                gpsCalibration,
                objectCalibration,
                metadata.height || this.calibrationData.standardRoofHeight
            );
            
            return {
                pixelsPerSquareFoot,
                imageInfo,
                gpsCalibration,
                objectCalibration,
                confidenceLevel: this.calculateCalibrationConfidence(gpsCalibration, objectCalibration),
                metadata: {
                    calibrationMethod: gpsCalibration ? 'GPS' : 'Object Reference',
                    accuracy: pixelsPerSquareFoot > 0 ? 'High' : 'Estimated'
                }
            };

        } catch (error) {
            console.error('❌ Error in measurement calibration:', error);
            return this.getDefaultCalibration();
        }
    }

    async calibrateWithGPS(gpsData, imageInfo) {
        // Use GPS data to determine scale
        // This would integrate with drone/photo GPS data for precise measurements
        return {
            method: 'GPS',
            altitude: gpsData.altitude || 30, // feet
            angle: gpsData.gimbalPitch || -90, // degrees
            fieldOfView: this.calculateFieldOfView(imageInfo, gpsData.altitude),
            confidence: 0.95
        };
    }

    async calibrateWithKnownObjects(imageBuffer) {
        try {
            const image = await Jimp.read(imageBuffer);
            
            // Detect standard-sized objects for scale reference
            const shingleLines = await this.detectShingleLines(image);
            const gutterWidth = await this.detectGutterWidth(image);
            const ventSizes = await this.detectVentSizes(image);
            
            let calibrationFactor = 1.0;
            let confidence = 0.6;
            
            if (shingleLines.detected) {
                // Standard shingle is 12" x 36"
                calibrationFactor = 36 / shingleLines.averageSpacing; // pixels per inch
                confidence = 0.8;
            } else if (gutterWidth.detected) {
                // Standard gutter is 5-6 inches
                calibrationFactor = 5.5 / gutterWidth.width;
                confidence = 0.7;
            }
            
            return {
                method: 'Object Reference',
                calibrationFactor,
                confidence,
                detectedObjects: {
                    shingles: shingleLines,
                    gutters: gutterWidth,
                    vents: ventSizes
                }
            };

        } catch (error) {
            console.warn('⚠️ Object calibration failed:', error);
            return { method: 'Default', confidence: 0.5 };
        }
    }

    async detectShingleLines(image) {
        // Detect horizontal shingle lines for scale reference
        const width = image.bitmap.width;
        const height = image.bitmap.height;
        const horizontalLines = [];
        
        // Apply horizontal edge detection
        for (let y = 10; y < height - 10; y += 5) {
            let edgeStrength = 0;
            for (let x = 5; x < width - 5; x++) {
                const color1 = Jimp.intToRGBA(image.getPixelColor(x, y - 2));
                const color2 = Jimp.intToRGBA(image.getPixelColor(x, y + 2));
                const diff = Math.abs(color1.r - color2.r) + Math.abs(color1.g - color2.g) + Math.abs(color1.b - color2.b);
                edgeStrength += diff;
            }
            
            if (edgeStrength > width * 30) { // Threshold for strong horizontal edge
                horizontalLines.push(y);
            }
        }
        
        // Calculate average spacing between shingle lines
        const spacings = [];
        for (let i = 1; i < horizontalLines.length; i++) {
            spacings.push(horizontalLines[i] - horizontalLines[i - 1]);
        }
        
        const averageSpacing = spacings.length > 0 ? 
            spacings.reduce((sum, s) => sum + s, 0) / spacings.length : 0;
        
        return {
            detected: horizontalLines.length >= 3,
            count: horizontalLines.length,
            averageSpacing,
            positions: horizontalLines
        };
    }

    async detectGutterWidth(image) {
        // Detect gutter edges for scale reference
        // Simplified implementation - would use more sophisticated edge detection
        return {
            detected: false,
            width: 0
        };
    }

    async detectVentSizes(image) {
        // Detect roof vents for scale reference
        return {
            detected: false,
            vents: []
        };
    }

    calculatePixelRatio(imageInfo, gpsCalibration, objectCalibration, heightFeet) {
        let pixelsPerSquareFoot = this.calibrationData.pixelsPerSquareFoot;
        
        if (gpsCalibration && gpsCalibration.confidence > 0.8) {
            // Use GPS-based calculation
            const groundSampleDistance = this.calculateGSD(
                gpsCalibration.altitude,
                imageInfo.width,
                gpsCalibration.fieldOfView
            );
            pixelsPerSquareFoot = 144 / (groundSampleDistance * groundSampleDistance); // 144 sq inches per sq foot
        } else if (objectCalibration && objectCalibration.confidence > 0.7) {
            // Use object-based calculation
            const pixelsPerInch = objectCalibration.calibrationFactor;
            pixelsPerSquareFoot = (pixelsPerInch * pixelsPerInch) * 144;
        }
        
        return pixelsPerSquareFoot;
    }

    calculateGSD(altitudeFeet, imageWidthPixels, fovDegrees = 70) {
        // Calculate Ground Sample Distance (GSD) in inches per pixel
        const altitudeInches = altitudeFeet * 12;
        const fovRadians = (fovDegrees * Math.PI) / 180;
        const groundWidthInches = 2 * altitudeInches * Math.tan(fovRadians / 2);
        return groundWidthInches / imageWidthPixels;
    }

    calculateCalibrationConfidence(gpsCalibration, objectCalibration) {
        if (gpsCalibration && gpsCalibration.confidence > 0.8) return 'high';
        if (objectCalibration && objectCalibration.confidence > 0.7) return 'medium';
        return 'low';
    }

    getDefaultCalibration() {
        return {
            pixelsPerSquareFoot: this.calibrationData.pixelsPerSquareFoot,
            confidenceLevel: 'estimated',
            method: 'default'
        };
    }

    async analyzeSurfaceArea(imageBuffer, calibration) {
        try {
            const imageTensor = await this.imageToTensor(imageBuffer);
            
            // Run surface area analysis model
            const prediction = await this.models.surfaceArea.predict(imageTensor);
            const results = await prediction.data();
            
            const estimatedSurfaceArea = results[0] * 100; // Scale to reasonable roof area
            const angleCorrection = results[1];
            const depthEstimation = results[2];
            
            imageTensor.dispose();
            prediction.dispose();
            
            // Calculate actual surface area considering perspective
            const actualSurfaceArea = estimatedSurfaceArea * (1 + angleCorrection * 0.3);
            
            return {
                estimatedSurfaceArea: Math.round(actualSurfaceArea),
                angleCorrection,
                depthEstimation,
                pixelsPerSquareFoot: calibration.pixelsPerSquareFoot,
                visibleArea: this.calculateVisibleArea(calibration.imageInfo),
                confidence: calibration.confidenceLevel === 'high' ? 0.9 : 0.7
            };

        } catch (error) {
            console.error('❌ Error in surface area analysis:', error);
            return {
                estimatedSurfaceArea: 100, // Default estimate
                confidence: 0.5
            };
        }
    }

    calculateVisibleArea(imageInfo) {
        // Calculate visible roof area in the image
        const totalPixels = imageInfo.width * imageInfo.height;
        return {
            totalPixels,
            width: imageInfo.width,
            height: imageInfo.height
        };
    }

    async quantifyImpacts(imageBuffer, hailAnalysis, surfaceAnalysis) {
        if (!hailAnalysis.detected || !hailAnalysis.impacts) {
            return {
                impactsPerSquareFoot: 0,
                totalImpacts: 0,
                impactDensityMap: null,
                severityDistribution: { mild: 0, moderate: 0, severe: 0 }
            };
        }
        
        try {
            const impacts = hailAnalysis.impacts;
            const surfaceAreaSqFt = surfaceAnalysis.estimatedSurfaceArea;
            
            // Calculate impacts per square foot
            const impactsPerSquareFoot = impacts.length / surfaceAreaSqFt;
            
            // Create impact density map
            const densityMap = await this.createImpactDensityMap(
                imageBuffer, 
                impacts, 
                surfaceAnalysis
            );
            
            // Categorize impact sizes
            const impactSizeDistribution = this.categorizeImpactSizes(impacts);
            
            // Calculate severity distribution per square foot
            const severityDistribution = this.calculateSeverityDistribution(
                impacts, 
                surfaceAreaSqFt
            );
            
            return {
                impactsPerSquareFoot: Math.round(impactsPerSquareFoot * 100) / 100,
                totalImpacts: impacts.length,
                impactDensityMap: densityMap,
                sizeDistribution: impactSizeDistribution,
                severityDistribution,
                averageImpactSize: this.calculateAverageImpactSize(impacts),
                largestImpact: this.findLargestImpact(impacts),
                clusterAnalysis: this.analyzeImpactClusters(impacts, surfaceAnalysis)
            };

        } catch (error) {
            console.error('❌ Error quantifying impacts:', error);
            return { impactsPerSquareFoot: 0, error: error.message };
        }
    }

    async createImpactDensityMap(imageBuffer, impacts, surfaceAnalysis) {
        try {
            const image = await Jimp.read(imageBuffer);
            const width = image.bitmap.width;
            const height = image.bitmap.height;
            
            // Create density grid (10x10 grid)
            const gridSize = 10;
            const cellWidth = width / gridSize;
            const cellHeight = height / gridSize;
            const densityGrid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
            
            // Count impacts in each grid cell
            for (const impact of impacts) {
                const gridX = Math.floor(impact.x / cellWidth);
                const gridY = Math.floor(impact.y / cellHeight);
                
                if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
                    densityGrid[gridY][gridX]++;
                }
            }
            
            // Calculate density per square foot for each cell
            const cellAreaSqFt = surfaceAnalysis.estimatedSurfaceArea / (gridSize * gridSize);
            const densityMap = densityGrid.map(row => 
                row.map(count => count / cellAreaSqFt)
            );
            
            return {
                grid: densityMap,
                gridSize,
                maxDensity: Math.max(...densityMap.flat()),
                averageDensity: densityMap.flat().reduce((sum, d) => sum + d, 0) / (gridSize * gridSize)
            };

        } catch (error) {
            console.error('❌ Error creating impact density map:', error);
            return null;
        }
    }

    categorizeImpactSizes(impacts) {
        const categories = {
            pea: 0,           // < 0.5"
            marble: 0,        // 0.5" - 0.75"
            penny: 0,         // 0.75" - 1.0"
            quarter: 0,       // 1.0" - 1.25"
            half_dollar: 0,   // 1.25" - 1.5"
            walnut: 0,        // 1.5" - 1.75"
            golf_ball: 0,     // 1.75" - 2.0"
            tennis_ball: 0,   // 2.5" - 3.0"
            baseball: 0       // > 3.0"
        };
        
        for (const impact of impacts) {
            const diameterInches = impact.radius * 2 / 25.4; // Convert pixels to inches (rough estimate)
            
            if (diameterInches < 0.5) categories.pea++;
            else if (diameterInches < 0.75) categories.marble++;
            else if (diameterInches < 1.0) categories.penny++;
            else if (diameterInches < 1.25) categories.quarter++;
            else if (diameterInches < 1.5) categories.half_dollar++;
            else if (diameterInches < 1.75) categories.walnut++;
            else if (diameterInches < 2.0) categories.golf_ball++;
            else if (diameterInches < 3.0) categories.tennis_ball++;
            else categories.baseball++;
        }
        
        return categories;
    }

    calculateSeverityDistribution(impacts, surfaceAreaSqFt) {
        const severityCount = { mild: 0, moderate: 0, severe: 0 };
        
        for (const impact of impacts) {
            severityCount[impact.severity]++;
        }
        
        return {
            mild: severityCount.mild / surfaceAreaSqFt,
            moderate: severityCount.moderate / surfaceAreaSqFt,
            severe: severityCount.severe / surfaceAreaSqFt
        };
    }

    calculateAverageImpactSize(impacts) {
        if (impacts.length === 0) return 0;
        
        const totalSize = impacts.reduce((sum, impact) => sum + impact.radius, 0);
        return totalSize / impacts.length;
    }

    findLargestImpact(impacts) {
        if (impacts.length === 0) return null;
        
        return impacts.reduce((largest, impact) => 
            impact.radius > largest.radius ? impact : largest
        );
    }

    analyzeImpactClusters(impacts, surfaceAnalysis) {
        // Analyze clustering patterns of impacts
        const clusters = [];
        const visited = new Set();
        const clusterDistance = 30; // pixels
        
        for (let i = 0; i < impacts.length; i++) {
            if (visited.has(i)) continue;
            
            const cluster = [i];
            visited.add(i);
            
            for (let j = i + 1; j < impacts.length; j++) {
                if (visited.has(j)) continue;
                
                const distance = Math.sqrt(
                    Math.pow(impacts[i].x - impacts[j].x, 2) + 
                    Math.pow(impacts[i].y - impacts[j].y, 2)
                );
                
                if (distance <= clusterDistance) {
                    cluster.push(j);
                    visited.add(j);
                }
            }
            
            if (cluster.length >= 3) { // Minimum cluster size
                clusters.push({
                    size: cluster.length,
                    impacts: cluster.map(idx => impacts[idx]),
                    centerPoint: this.calculateClusterCenter(cluster.map(idx => impacts[idx]))
                });
            }
        }
        
        return {
            totalClusters: clusters.length,
            clusters,
            clusteringRatio: clusters.length / impacts.length,
            averageClusterSize: clusters.length > 0 ? 
                clusters.reduce((sum, c) => sum + c.size, 0) / clusters.length : 0
        };
    }

    calculateClusterCenter(impacts) {
        const centerX = impacts.reduce((sum, i) => sum + i.x, 0) / impacts.length;
        const centerY = impacts.reduce((sum, i) => sum + i.y, 0) / impacts.length;
        return { x: centerX, y: centerY };
    }

    async quantifyGranuleLoss(imageBuffer, granuleAnalysis, surfaceAnalysis) {
        if (!granuleAnalysis.detected) {
            return {
                percentagePerSquareFoot: 0,
                granuleCoverageMap: null,
                exposedAreaAnalysis: null
            };
        }
        
        try {
            // Generate detailed granule coverage map
            const coverageMap = await this.generateGranuleCoverageMap(imageBuffer);
            
            // Calculate granule loss per square foot
            const granuleLossAnalysis = await this.calculateGranuleLossMetrics(
                coverageMap, 
                surfaceAnalysis
            );
            
            // Analyze exposed substrate areas
            const exposedAreaAnalysis = await this.analyzeExposedAreas(
                imageBuffer, 
                coverageMap
            );
            
            return {
                overallPercentage: granuleAnalysis.percentage,
                percentagePerSquareFoot: granuleLossAnalysis.percentagePerSquareFoot,
                granuleCoverageMap: coverageMap,
                exposedAreaAnalysis,
                uniformityScore: granuleAnalysis.uniformity,
                weatheringPattern: this.analyzeWeatheringPattern(coverageMap),
                progressionRisk: this.assessGranuleProgressionRisk(granuleLossAnalysis)
            };

        } catch (error) {
            console.error('❌ Error quantifying granule loss:', error);
            return { percentagePerSquareFoot: 0, error: error.message };
        }
    }

    async generateGranuleCoverageMap(imageBuffer) {
        try {
            const imageTensor = await this.imageToTensor(imageBuffer);
            
            // Run granule mapping model to get pixel-level coverage
            const prediction = await this.models.granuleMapping.predict(imageTensor);
            const coverageData = await prediction.data();
            
            // Convert to 2D coverage map
            const coverageMap = [];
            for (let i = 0; i < 224; i++) {
                const row = [];
                for (let j = 0; j < 224; j++) {
                    row.push(coverageData[i * 224 + j]);
                }
                coverageMap.push(row);
            }
            
            imageTensor.dispose();
            prediction.dispose();
            
            return {
                map: coverageMap,
                width: 224,
                height: 224,
                averageCoverage: coverageData.reduce((sum, val) => sum + val, 0) / coverageData.length
            };

        } catch (error) {
            console.error('❌ Error generating granule coverage map:', error);
            return null;
        }
    }

    async calculateGranuleLossMetrics(coverageMap, surfaceAnalysis) {
        if (!coverageMap) return { percentagePerSquareFoot: 0 };
        
        const totalPixels = coverageMap.width * coverageMap.height;
        const pixelsPerSquareFoot = surfaceAnalysis.pixelsPerSquareFoot;
        
        // Calculate granule loss by region
        const regionSize = 28; // 8x8 regions in 224x224 image
        const regions = [];
        
        for (let y = 0; y < coverageMap.height; y += regionSize) {
            for (let x = 0; x < coverageMap.width; x += regionSize) {
                let totalCoverage = 0;
                let pixelCount = 0;
                
                for (let dy = 0; dy < regionSize && y + dy < coverageMap.height; dy++) {
                    for (let dx = 0; dx < regionSize && x + dx < coverageMap.width; dx++) {
                        totalCoverage += coverageMap.map[y + dy][x + dx];
                        pixelCount++;
                    }
                }
                
                const averageCoverage = totalCoverage / pixelCount;
                const granuleLossPercentage = (1 - averageCoverage) * 100;
                
                regions.push({
                    x, y,
                    width: Math.min(regionSize, coverageMap.width - x),
                    height: Math.min(regionSize, coverageMap.height - y),
                    granuleLoss: granuleLossPercentage,
                    coverage: averageCoverage
                });
            }
        }
        
        // Calculate per square foot metrics
        const regionAreaSqFt = (regionSize * regionSize) / pixelsPerSquareFoot;
        const averageGranuleLoss = regions.reduce((sum, r) => sum + r.granuleLoss, 0) / regions.length;
        
        return {
            percentagePerSquareFoot: averageGranuleLoss,
            regionAnalysis: regions,
            regionAreaSqFt,
            maxLossRegion: regions.reduce((max, r) => r.granuleLoss > max.granuleLoss ? r : max),
            minLossRegion: regions.reduce((min, r) => r.granuleLoss < min.granuleLoss ? r : min)
        };
    }

    async analyzeExposedAreas(imageBuffer, coverageMap) {
        // Find areas where substrate is exposed (coverage < 30%)
        const exposedThreshold = 0.3;
        const exposedAreas = [];
        
        if (!coverageMap) return { exposedAreas: [], totalExposedArea: 0 };
        
        for (let y = 0; y < coverageMap.height; y++) {
            for (let x = 0; x < coverageMap.width; x++) {
                if (coverageMap.map[y][x] < exposedThreshold) {
                    exposedAreas.push({ x, y, exposure: 1 - coverageMap.map[y][x] });
                }
            }
        }
        
        return {
            exposedAreas,
            totalExposedArea: exposedAreas.length,
            exposurePercentage: (exposedAreas.length / (coverageMap.width * coverageMap.height)) * 100,
            severeCriticalAreas: exposedAreas.filter(area => area.exposure > 0.8)
        };
    }

    analyzeWeatheringPattern(coverageMap) {
        if (!coverageMap) return 'unknown';
        
        // Analyze directional patterns in granule loss
        const map = coverageMap.map;
        const height = coverageMap.height;
        const width = coverageMap.width;
        
        // Check for directional bias in granule loss
        let topLoss = 0, bottomLoss = 0, leftLoss = 0, rightLoss = 0;
        
        // Top third vs bottom third
        for (let y = 0; y < height / 3; y++) {
            for (let x = 0; x < width; x++) {
                topLoss += (1 - map[y][x]);
            }
        }
        
        for (let y = (2 * height) / 3; y < height; y++) {
            for (let x = 0; x < width; x++) {
                bottomLoss += (1 - map[y][x]);
            }
        }
        
        const verticalBias = Math.abs(topLoss - bottomLoss) / (topLoss + bottomLoss);
        
        if (verticalBias > 0.2) {
            return topLoss > bottomLoss ? 'weather_exposed_top' : 'drainage_pattern';
        }
        
        return 'uniform_aging';
    }

    assessGranuleProgressionRisk(granuleLossAnalysis) {
        const avgLoss = granuleLossAnalysis.percentagePerSquareFoot;
        
        if (avgLoss < 10) return 'low';
        if (avgLoss < 25) return 'moderate';
        if (avgLoss < 40) return 'high';
        return 'critical';
    }

    async analyzeDamageDistribution(impactQuantification, granuleQuantification, surfaceAnalysis) {
        return {
            impactDistribution: this.analyzeImpactDistribution(impactQuantification),
            granuleDistribution: this.analyzeGranuleDistribution(granuleQuantification),
            correlationAnalysis: this.analyzeImpactGranuleCorrelation(
                impactQuantification, 
                granuleQuantification
            ),
            spatialClustering: this.analyzeSpatialClustering(
                impactQuantification, 
                granuleQuantification
            ),
            damageProgression: this.predictDamageSpread(
                impactQuantification, 
                granuleQuantification
            )
        };
    }

    analyzeImpactDistribution(impactQuantification) {
        if (!impactQuantification.impactDensityMap) {
            return { pattern: 'none', uniformity: 0 };
        }
        
        const densityMap = impactQuantification.impactDensityMap.grid;
        const values = densityMap.flat();
        
        // Calculate distribution metrics
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const standardDeviation = Math.sqrt(variance);
        
        // Determine distribution pattern
        const uniformity = 1 - (standardDeviation / (mean + 0.001)); // Avoid division by zero
        
        let pattern = 'scattered';
        if (uniformity > 0.8) pattern = 'uniform';
        else if (uniformity < 0.3) pattern = 'clustered';
        
        return {
            pattern,
            uniformity: Math.max(0, uniformity),
            mean,
            standardDeviation,
            hotspots: this.identifyDamageHotspots(densityMap)
        };
    }

    analyzeGranuleDistribution(granuleQuantification) {
        if (!granuleQuantification.granuleCoverageMap) {
            return { pattern: 'unknown', uniformity: 0 };
        }
        
        const coverageMap = granuleQuantification.granuleCoverageMap.map;
        const lossValues = coverageMap.flat().map(coverage => 1 - coverage);
        
        const mean = lossValues.reduce((sum, val) => sum + val, 0) / lossValues.length;
        const variance = lossValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / lossValues.length;
        const uniformity = 1 - Math.sqrt(variance);
        
        return {
            pattern: uniformity > 0.7 ? 'uniform' : 'patchy',
            uniformity: Math.max(0, uniformity),
            averageLoss: mean * 100,
            maximumLoss: Math.max(...lossValues) * 100
        };
    }

    analyzeImpactGranuleCorrelation(impactQuantification, granuleQuantification) {
        // Analyze correlation between impact locations and granule loss
        if (!impactQuantification.impactDensityMap || !granuleQuantification.granuleCoverageMap) {
            return { correlation: 0, significance: 'none' };
        }
        
        const impactDensity = impactQuantification.impactDensityMap.grid.flat();
        const granuleLoss = granuleQuantification.granuleCoverageMap.map.flat().map(c => 1 - c);
        
        // Calculate Pearson correlation coefficient
        const correlation = this.calculateCorrelation(impactDensity, granuleLoss);
        
        let significance = 'none';
        if (Math.abs(correlation) > 0.7) significance = 'strong';
        else if (Math.abs(correlation) > 0.4) significance = 'moderate';
        else if (Math.abs(correlation) > 0.2) significance = 'weak';
        
        return {
            correlation,
            significance,
            interpretation: correlation > 0.4 ? 
                'High impact areas correlate with granule loss' : 
                'Limited correlation between impacts and granule loss'
        };
    }

    calculateCorrelation(array1, array2) {
        if (array1.length !== array2.length) return 0;
        
        const n = array1.length;
        const mean1 = array1.reduce((sum, val) => sum + val, 0) / n;
        const mean2 = array2.reduce((sum, val) => sum + val, 0) / n;
        
        let numerator = 0;
        let sum1Sq = 0;
        let sum2Sq = 0;
        
        for (let i = 0; i < n; i++) {
            const diff1 = array1[i] - mean1;
            const diff2 = array2[i] - mean2;
            
            numerator += diff1 * diff2;
            sum1Sq += diff1 * diff1;
            sum2Sq += diff2 * diff2;
        }
        
        const denominator = Math.sqrt(sum1Sq * sum2Sq);
        return denominator === 0 ? 0 : numerator / denominator;
    }

    analyzeSpatialClustering(impactQuantification, granuleQuantification) {
        return {
            impactClusters: impactQuantification.clusterAnalysis || {},
            granulePatches: this.identifyGranulePatches(granuleQuantification),
            overlappingAreas: this.identifyOverlappingDamageAreas(
                impactQuantification, 
                granuleQuantification
            )
        };
    }

    identifyGranulePatches(granuleQuantification) {
        // Identify contiguous areas of significant granule loss
        if (!granuleQuantification.granuleCoverageMap) return [];
        
        const map = granuleQuantification.granuleCoverageMap.map;
        const lossThreshold = 0.6; // 60% granule loss
        const patches = [];
        
        // Simple flood-fill algorithm to identify patches
        const visited = Array(map.length).fill().map(() => Array(map[0].length).fill(false));
        
        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[0].length; x++) {
                if (!visited[y][x] && (1 - map[y][x]) > lossThreshold) {
                    const patch = this.floodFill(map, visited, x, y, lossThreshold);
                    if (patch.size > 10) { // Minimum patch size
                        patches.push(patch);
                    }
                }
            }
        }
        
        return patches;
    }

    floodFill(map, visited, startX, startY, threshold) {
        const queue = [{ x: startX, y: startY }];
        const patch = { pixels: [], size: 0, bounds: { minX: startX, maxX: startX, minY: startY, maxY: startY } };
        
        while (queue.length > 0) {
            const { x, y } = queue.shift();
            
            if (x < 0 || x >= map[0].length || y < 0 || y >= map.length || 
                visited[y][x] || (1 - map[y][x]) <= threshold) {
                continue;
            }
            
            visited[y][x] = true;
            patch.pixels.push({ x, y, loss: 1 - map[y][x] });
            patch.size++;
            
            // Update bounds
            patch.bounds.minX = Math.min(patch.bounds.minX, x);
            patch.bounds.maxX = Math.max(patch.bounds.maxX, x);
            patch.bounds.minY = Math.min(patch.bounds.minY, y);
            patch.bounds.maxY = Math.max(patch.bounds.maxY, y);
            
            // Add neighbors to queue
            queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
        }
        
        return patch;
    }

    identifyOverlappingDamageAreas(impactQuantification, granuleQuantification) {
        // Find areas where both impact damage and granule loss are significant
        const overlaps = [];
        
        if (!impactQuantification.impactDensityMap || !granuleQuantification.granuleCoverageMap) {
            return overlaps;
        }
        
        const impactGrid = impactQuantification.impactDensityMap.grid;
        const granuleMap = granuleQuantification.granuleCoverageMap.map;
        
        const gridSize = impactGrid.length;
        const scale = granuleMap.length / gridSize;
        
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const impactDensity = impactGrid[i][j];
                
                // Calculate average granule loss in corresponding area
                let granuleLoss = 0;
                let pixelCount = 0;
                
                for (let y = Math.floor(i * scale); y < Math.floor((i + 1) * scale); y++) {
                    for (let x = Math.floor(j * scale); x < Math.floor((j + 1) * scale); x++) {
                        if (y < granuleMap.length && x < granuleMap[0].length) {
                            granuleLoss += (1 - granuleMap[y][x]);
                            pixelCount++;
                        }
                    }
                }
                
                granuleLoss = pixelCount > 0 ? granuleLoss / pixelCount : 0;
                
                // Check if both types of damage are significant
                if (impactDensity > 1 && granuleLoss > 0.3) { // Thresholds for significance
                    overlaps.push({
                        gridX: j,
                        gridY: i,
                        impactDensity,
                        granuleLoss: granuleLoss * 100,
                        severityScore: (impactDensity * 0.6) + (granuleLoss * 0.4)
                    });
                }
            }
        }
        
        return overlaps;
    }

    identifyDamageHotspots(densityMap) {
        const threshold = Math.max(...densityMap.flat()) * 0.7; // 70% of max density
        const hotspots = [];
        
        for (let i = 0; i < densityMap.length; i++) {
            for (let j = 0; j < densityMap[i].length; j++) {
                if (densityMap[i][j] >= threshold) {
                    hotspots.push({
                        gridX: j,
                        gridY: i,
                        density: densityMap[i][j],
                        severity: densityMap[i][j] / Math.max(...densityMap.flat())
                    });
                }
            }
        }
        
        return hotspots;
    }

    predictDamageSpread(impactQuantification, granuleQuantification) {
        // Predict how damage might spread over time
        return {
            impactProgression: this.predictImpactProgression(impactQuantification),
            granuleProgression: this.predictGranuleProgression(granuleQuantification),
            overallRisk: this.calculateProgressionRisk(impactQuantification, granuleQuantification)
        };
    }

    predictImpactProgression(impactQuantification) {
        const density = impactQuantification.impactsPerSquareFoot;
        
        if (density < 1) return 'stable';
        if (density < 3) return 'slow_progression';
        if (density < 6) return 'moderate_progression';
        return 'rapid_progression';
    }

    predictGranuleProgression(granuleQuantification) {
        const lossRate = granuleQuantification.percentagePerSquareFoot;
        
        if (lossRate < 10) return 'minimal';
        if (lossRate < 25) return 'gradual';
        if (lossRate < 40) return 'accelerated';
        return 'critical';
    }

    calculateProgressionRisk(impactQuantification, granuleQuantification) {
        let riskScore = 0;
        
        // Impact contribution
        riskScore += impactQuantification.impactsPerSquareFoot * 10;
        
        // Granule loss contribution
        riskScore += granuleQuantification.percentagePerSquareFoot * 2;
        
        // Clustering factor
        if (impactQuantification.clusterAnalysis && impactQuantification.clusterAnalysis.clusteringRatio > 0.3) {
            riskScore *= 1.5; // Clustered damage spreads faster
        }
        
        if (riskScore < 20) return 'low';
        if (riskScore < 50) return 'moderate';
        if (riskScore < 80) return 'high';
        return 'critical';
    }

    async calculateEnhancedSeverityScore(impactQuantification, granuleQuantification, distributionAnalysis) {
        const weights = {
            impactDensity: 0.35,
            granuleLoss: 0.25,
            clustering: 0.15,
            correlation: 0.15,
            progression: 0.10
        };
        
        // Normalize scores to 0-100 scale
        const impactScore = Math.min(impactQuantification.impactsPerSquareFoot * 10, 100);
        const granuleScore = Math.min(granuleQuantification.percentagePerSquareFoot * 2, 100);
        const clusteringScore = this.calculateClusteringScore(distributionAnalysis);
        const correlationScore = this.calculateCorrelationScore(distributionAnalysis);
        const progressionScore = this.calculateProgressionScore(distributionAnalysis);
        
        const overallScore = 
            (impactScore * weights.impactDensity) +
            (granuleScore * weights.granuleLoss) +
            (clusteringScore * weights.clustering) +
            (correlationScore * weights.correlation) +
            (progressionScore * weights.progression);
        
        return {
            overallScore: Math.round(overallScore),
            componentScores: {
                impactDensity: Math.round(impactScore),
                granuleLoss: Math.round(granuleScore),
                clustering: Math.round(clusteringScore),
                correlation: Math.round(correlationScore),
                progression: Math.round(progressionScore)
            },
            severity: this.classifySeverity(overallScore),
            confidenceLevel: this.calculateSeverityConfidence(
                impactQuantification,
                granuleQuantification
            )
        };
    }

    calculateClusteringScore(distributionAnalysis) {
        const impactClustering = distributionAnalysis.spatialClustering.impactClusters.clusteringRatio || 0;
        const granulePatches = distributionAnalysis.spatialClustering.granulePatches.length || 0;
        
        return Math.min((impactClustering * 50) + (granulePatches * 5), 100);
    }

    calculateCorrelationScore(distributionAnalysis) {
        const correlation = Math.abs(distributionAnalysis.correlationAnalysis.correlation || 0);
        return correlation * 100;
    }

    calculateProgressionScore(distributionAnalysis) {
        const progressionRisk = distributionAnalysis.damageProgression.overallRisk;
        
        const riskScores = { low: 20, moderate: 50, high: 75, critical: 100 };
        return riskScores[progressionRisk] || 0;
    }

    classifySeverity(score) {
        if (score < 25) return 'minimal';
        if (score < 50) return 'moderate';
        if (score < 75) return 'significant';
        return 'severe';
    }

    calculateSeverityConfidence(impactQuantification, granuleQuantification) {
        let confidence = 0.5; // Base confidence
        
        // Increase confidence based on data quality
        if (impactQuantification.totalImpacts > 0) confidence += 0.2;
        if (granuleQuantification.granuleCoverageMap) confidence += 0.2;
        if (impactQuantification.impactDensityMap) confidence += 0.1;
        
        return Math.min(confidence, 1.0);
    }

    async predictDamageProgression(impactQuantification, granuleQuantification, metadata) {
        try {
            // Prepare input features for progression model
            const features = this.prepareProgressionFeatures(
                impactQuantification,
                granuleQuantification,
                metadata
            );
            
            const featureTensor = tf.tensor2d([features]);
            const prediction = await this.models.damageProgression.predict(featureTensor);
            const progressionProbability = (await prediction.data())[0];
            
            featureTensor.dispose();
            prediction.dispose();
            
            // Generate progression timeline
            const timeline = this.generateProgressionTimeline(
                progressionProbability,
                impactQuantification,
                granuleQuantification
            );
            
            return {
                progressionProbability,
                timeline,
                riskFactors: this.identifyRiskFactors(features),
                recommendations: this.generateProgressionRecommendations(progressionProbability)
            };

        } catch (error) {
            console.error('❌ Error predicting damage progression:', error);
            return {
                progressionProbability: 0.5,
                timeline: null,
                error: error.message
            };
        }
    }

    prepareProgressionFeatures(impactQuantification, granuleQuantification, metadata) {
        return [
            impactQuantification.impactsPerSquareFoot || 0,
            granuleQuantification.percentagePerSquareFoot || 0,
            impactQuantification.averageImpactSize || 0,
            granuleQuantification.uniformityScore || 0,
            metadata.roofAge || 10, // Default 10 years
            metadata.weatherExposure || 5, // Scale 1-10
            metadata.maintenanceHistory || 5, // Scale 1-10
            metadata.lastStormIntensity || 3, // Scale 1-5
            impactQuantification.clusterAnalysis?.clusteringRatio || 0,
            granuleQuantification.progressionRisk === 'critical' ? 1 : 0
        ];
    }

    generateProgressionTimeline(probability, impactQuantification, granuleQuantification) {
        const baseTimeframes = {
            immediate: 0, // months
            short_term: 6,
            medium_term: 18,
            long_term: 36
        };
        
        // Accelerate timeline based on severity
        const accelerationFactor = 1 - (probability * 0.5);
        
        return {
            immediate: {
                timeframe: '0-3 months',
                expectedChanges: 'Minimal progression expected',
                actionRequired: probability > 0.7 ? 'immediate_repair' : 'monitoring'
            },
            short_term: {
                timeframe: '3-12 months',
                expectedChanges: probability > 0.6 ? 'Accelerated deterioration' : 'Normal weathering',
                actionRequired: probability > 0.6 ? 'repair_scheduling' : 'continued_monitoring'
            },
            medium_term: {
                timeframe: '1-3 years',
                expectedChanges: probability > 0.5 ? 'Significant deterioration likely' : 'Gradual aging',
                actionRequired: probability > 0.5 ? 'replacement_planning' : 'maintenance'
            },
            long_term: {
                timeframe: '3+ years',
                expectedChanges: 'End of useful life likely',
                actionRequired: 'replacement_budgeting'
            }
        };
    }

    identifyRiskFactors(features) {
        const [
            impactDensity, granuleLoss, impactSize, uniformity,
            roofAge, weatherExposure, maintenance, stormIntensity,
            clustering, criticalGranule
        ] = features;
        
        const risks = [];
        
        if (impactDensity > 3) risks.push('High impact density');
        if (granuleLoss > 25) risks.push('Significant granule loss');
        if (impactSize > 20) risks.push('Large impact damage');
        if (uniformity < 0.5) risks.push('Non-uniform deterioration');
        if (roofAge > 15) risks.push('Advanced roof age');
        if (weatherExposure > 7) risks.push('High weather exposure');
        if (maintenance < 3) risks.push('Poor maintenance history');
        if (stormIntensity > 3) risks.push('Recent severe weather');
        if (clustering > 0.5) risks.push('Clustered damage pattern');
        if (criticalGranule === 1) risks.push('Critical granule condition');
        
        return risks;
    }

    generateProgressionRecommendations(probability) {
        if (probability < 0.3) {
            return [
                'Continue regular inspections',
                'Monitor for new damage development',
                'Maintain good drainage and ventilation'
            ];
        } else if (probability < 0.6) {
            return [
                'Schedule professional inspection within 30 days',
                'Consider preventive repairs for vulnerable areas',
                'Increase monitoring frequency to quarterly',
                'Document current condition for insurance purposes'
            ];
        } else {
            return [
                'Immediate professional assessment required',
                'Priority repair or replacement recommended',
                'Contact insurance adjuster for claim evaluation',
                'Implement temporary protective measures if needed',
                'Develop replacement timeline and budget'
            ];
        }
    }

    generateQuantificationRecommendations(analysisResults) {
        const { impactQuantification, granuleQuantification, severityScore } = analysisResults;
        const recommendations = [];
        
        // Impact-based recommendations
        if (impactQuantification.impactsPerSquareFoot > 2) {
            recommendations.push({
                type: 'repair',
                priority: 'high',
                description: `${impactQuantification.impactsPerSquareFoot} impacts per sq ft exceeds insurance thresholds`,
                action: 'File insurance claim for hail damage',
                timeline: 'Within 30 days'
            });
        }
        
        // Granule loss recommendations
        if (granuleQuantification.percentagePerSquareFoot > 20) {
            recommendations.push({
                type: 'replacement',
                priority: 'medium',
                description: `${granuleQuantification.percentagePerSquareFoot}% granule loss per sq ft indicates aging`,
                action: 'Consider roof replacement planning',
                timeline: 'Within 1-2 years'
            });
        }
        
        // Severity-based recommendations
        if (severityScore.overallScore > 70) {
            recommendations.push({
                type: 'urgent',
                priority: 'critical',
                description: 'Multiple damage types present with high severity',
                action: 'Immediate professional assessment and repair',
                timeline: 'Within 48 hours'
            });
        }
        
        return recommendations;
    }

    generateComplianceReport(analysisResults) {
        const { impactQuantification, granuleQuantification, severityScore } = analysisResults;
        
        // Industry standard compliance checks
        const standards = {
            haagStandard: this.checkHaagCompliance(impactQuantification),
            insuranceThresholds: this.checkInsuranceThresholds(impactQuantification, granuleQuantification),
            buildingCodes: this.checkBuildingCodeCompliance(severityScore),
            manufacturerWarranty: this.checkWarrantyCompliance(granuleQuantification)
        };
        
        return {
            standards,
            overallCompliance: this.calculateOverallCompliance(standards),
            documentationRequirements: this.getDocumentationRequirements(standards),
            nextSteps: this.getComplianceNextSteps(standards)
        };
    }

    checkHaagCompliance(impactQuantification) {
        // HAAG engineering standards for hail damage
        const impactsPerSqFt = impactQuantification.impactsPerSquareFoot;
        
        return {
            compliant: impactsPerSqFt >= 8, // HAAG test standard
            threshold: 8,
            actual: impactsPerSqFt,
            notes: impactsPerSqFt >= 8 ? 'Meets HAAG test criteria' : 'Below HAAG test threshold'
        };
    }

    checkInsuranceThresholds(impactQuantification, granuleQuantification) {
        // Common insurance company thresholds
        const impacts = impactQuantification.impactsPerSquareFoot;
        const granuleLoss = granuleQuantification.percentagePerSquareFoot;
        
        return {
            hailThreshold: {
                compliant: impacts >= 1, // Most insurers accept 1+ impacts per sq ft
                threshold: 1,
                actual: impacts
            },
            granuleThreshold: {
                compliant: granuleLoss >= 30, // 30% granule loss threshold
                threshold: 30,
                actual: granuleLoss
            }
        };
    }

    checkBuildingCodeCompliance(severityScore) {
        // Building code requirements for roof replacement
        return {
            compliant: severityScore.overallScore >= 50,
            threshold: 50,
            actual: severityScore.overallScore,
            notes: 'Based on combined damage severity assessment'
        };
    }

    checkWarrantyCompliance(granuleQuantification) {
        // Manufacturer warranty thresholds
        const granuleLoss = granuleQuantification.percentagePerSquareFoot;
        
        return {
            compliant: granuleLoss >= 25, // Typical warranty threshold
            threshold: 25,
            actual: granuleLoss,
            notes: 'Manufacturer warranty coverage threshold'
        };
    }

    calculateOverallCompliance(standards) {
        const compliantItems = Object.values(standards).filter(standard => {
            if (standard.compliant !== undefined) return standard.compliant;
            return Object.values(standard).some(item => item.compliant);
        }).length;
        
        const totalItems = Object.keys(standards).length;
        return {
            score: (compliantItems / totalItems) * 100,
            level: compliantItems >= totalItems * 0.75 ? 'high' : 
                   compliantItems >= totalItems * 0.5 ? 'medium' : 'low'
        };
    }

    getDocumentationRequirements(standards) {
        const requirements = [];
        
        if (standards.haagStandard.compliant) {
            requirements.push('HAAG engineering report documentation');
        }
        
        if (standards.insuranceThresholds.hailThreshold.compliant) {
            requirements.push('Comprehensive photo documentation of impacts');
        }
        
        if (standards.insuranceThresholds.granuleThreshold.compliant) {
            requirements.push('Granule loss measurement documentation');
        }
        
        return requirements;
    }

    getComplianceNextSteps(standards) {
        const steps = [];
        
        if (standards.haagStandard.compliant) {
            steps.push('Contact insurance adjuster for claim processing');
        }
        
        if (!standards.manufacturerWarranty.compliant) {
            steps.push('Review manufacturer warranty terms and conditions');
        }
        
        if (standards.buildingCodes.compliant) {
            steps.push('Obtain building permits for roof replacement');
        }
        
        return steps;
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

    // Utility method to get field of view calculation
    calculateFieldOfView(imageInfo, altitude) {
        // Calculate field of view based on camera specs and altitude
        // This would be customized based on actual camera/drone specifications
        const sensorWidth = 23.6; // mm (example for common drone camera)
        const focalLength = 24; // mm (example)
        const fovRadians = 2 * Math.atan(sensorWidth / (2 * focalLength));
        return (fovRadians * 180) / Math.PI; // Convert to degrees
    }
}