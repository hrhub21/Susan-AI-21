import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import ExifReader from 'exifr';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

/**
 * Real AI-powered roofing damage analysis service using Claude's vision capabilities
 * Provides genuine image analysis for roofing damage assessment
 */
export class RealRoofingDamageAnalysisService {
    constructor() {
        this.initializeAI();
        this.setupImageProcessing();
        this.initialized = false;
        
        // Professional roofing damage assessment prompts
        this.prompts = this.setupRoofingPrompts();
        
        this.initialize();
    }

    initializeAI() {
        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error('ANTHROPIC_API_KEY is required for real roofing damage analysis');
        }
        
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    setupImageProcessing() {
        this.imageConfig = {
            targetSize: { width: 1024, height: 1024 },
            maxFileSize: 50 * 1024 * 1024, // 50MB
            supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
            quality: 90
        };
    }

    setupRoofingPrompts() {
        return {
            comprehensive: `You are a professional roofing inspector with 20+ years of experience analyzing storm damage. Analyze this roofing photograph for damage indicators.

ANALYSIS FRAMEWORK:
1. HAIL DAMAGE ASSESSMENT
   - Look for circular impact marks on shingles
   - Check for granule displacement around impacts
   - Identify exposed mat or substrate
   - Note impact size and depth patterns
   - Count visible impacts if present

2. WIND DAMAGE ASSESSMENT
   - Examine for lifted, creased, or missing shingles
   - Check for exposed nail heads or fastener issues
   - Look for edge lifting or tab separation
   - Assess shingle alignment and pattern disruption

3. GRANULE LOSS EVALUATION
   - Analyze overall granule coverage uniformity
   - Identify areas of significant granule loss
   - Check for exposed asphalt or mat
   - Note patterns that suggest normal aging vs. storm damage

4. GENERAL CONDITION ASSESSMENT
   - Overall roof condition and age indicators
   - Structural issues visible from this angle
   - Gutters, flashing, and collateral components
   - Safety hazards or immediate concerns

RESPONSE FORMAT:
Provide a detailed, professional assessment including:
- Specific observations with locations (e.g., "upper left section", "near ridge line")
- Damage severity classification (None, Minimal, Moderate, Severe)
- Confidence level in your assessment (High, Medium, Low)
- Recommended actions
- Insurance claim viability
- Professional disclaimers

Be honest and specific about what you can and cannot determine from this single photograph. Only report damage you can actually see and identify with reasonable confidence.`,

            hailSpecific: `Focus specifically on HAIL DAMAGE analysis of this roofing photograph.

As an expert hail damage inspector, examine for:
- Circular or oval impact marks on shingles
- "Bruising" where hail compressed granules
- Granule displacement creating "halos" around impacts
- Exposed mat or fiberglass substrate
- Fresh damage vs. weathered impacts
- Impact size patterns (measure against visible references)

Provide specific findings:
- Number of visible impacts you can identify
- Size range of impacts (small/medium/large)
- Severity classification
- Pattern analysis (scattered, clustered, or linear)
- Confidence level in hail damage determination

Only report impacts you can clearly identify. If no hail damage is visible, state that clearly.`,

            windSpecific: `Focus specifically on WIND DAMAGE analysis of this roofing photograph.

As an expert wind damage inspector, examine for:
- Lifted or creased shingle tabs
- Missing or partially detached shingles
- Exposed nail heads or fastener problems
- Edge lifting along rake or eave
- Shingle displacement or misalignment
- Collateral damage to gutters, vents, or flashing

Provide specific findings:
- Number and location of lifted/damaged shingles
- Severity of wind damage (minor lifting to complete loss)
- Pattern indicating wind direction or intensity
- Immediate repair needs for weather protection
- Confidence level in wind damage assessment

Be specific about visible wind damage vs. normal wear or aging.`,

            granuleSpecific: `Focus specifically on GRANULE LOSS analysis of this roofing photograph.

As an expert in roofing materials, analyze:
- Overall granule coverage density
- Areas of significant granule loss
- Pattern of loss (uniform aging vs. impact damage)
- Exposed asphalt or substrate visibility
- Color variations indicating granule displacement
- Gutter granule accumulation if visible

Provide specific findings:
- Estimated percentage of granule loss in visible areas
- Pattern analysis (normal weathering vs. damage)
- Areas of concern requiring closer inspection
- Impact on roof performance and longevity
- Confidence in granule loss assessment

Distinguish between normal granule loss from aging and accelerated loss from storm damage.`
        };
    }

    async initialize() {
        try {
            logger.info('🔧 Initializing Real Roofing Damage Analysis AI...');
            
            // Test the Anthropic connection
            await this.testAIConnection();
            
            this.initialized = true;
            logger.info('✅ Real Roofing Damage Analysis AI initialized successfully');
            
        } catch (error) {
            logger.error('❌ Failed to initialize Real Roofing Damage Analysis:', error);
            throw new Error(`Real damage analysis initialization failed: ${error.message}`);
        }
    }

    async testAIConnection() {
        try {
            const testResponse = await this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 100,
                messages: [
                    {
                        role: 'user',
                        content: 'Test connection for roofing analysis system. Respond with "Connection successful".'
                    }
                ]
            });
            
            if (!testResponse.content[0]?.text) {
                throw new Error('Invalid response from Claude API');
            }
            
            logger.info('🔗 Claude AI connection verified for roofing analysis');
        } catch (error) {
            throw new Error(`Claude AI connection failed: ${error.message}`);
        }
    }

    /**
     * Main method to analyze roofing damage using Claude's vision capabilities
     */
    async analyzeRoofingDamage(imageBuffer, metadata = {}) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            logger.info('🔍 Starting REAL roofing damage analysis with Claude Vision...');
            const analysisId = this.generateAnalysisId();
            
            // Extract image metadata
            const imageMetadata = await this.extractImageMetadata(imageBuffer);
            
            // Prepare image for Claude analysis
            const processedImage = await this.prepareImageForAnalysis(imageBuffer);
            
            // Run comprehensive analysis using Claude's vision
            const comprehensiveAnalysis = await this.performComprehensiveAnalysis(processedImage, metadata);
            
            // Run specific damage type analyses
            const [hailAnalysis, windAnalysis, granuleAnalysis] = await Promise.all([
                this.performHailDamageAnalysis(processedImage, metadata),
                this.performWindDamageAnalysis(processedImage, metadata),
                this.performGranuleLossAnalysis(processedImage, metadata)
            ]);

            // Synthesize all analyses into final assessment
            const damageAssessment = this.synthesizeAnalyses({
                comprehensive: comprehensiveAnalysis,
                hail: hailAnalysis,
                wind: windAnalysis,
                granule: granuleAnalysis
            });

            // Generate professional report
            const damageReport = this.generateProfessionalReport(damageAssessment, imageMetadata, metadata);

            const result = {
                analysisId,
                timestamp: new Date().toISOString(),
                analysisType: 'Real AI Vision Analysis',
                aiProvider: 'Claude-3 Sonnet (Anthropic)',
                image: {
                    metadata: imageMetadata,
                    processed: processedImage.info
                },
                damage: damageAssessment,
                report: damageReport,
                confidence: this.calculateOverallConfidence(damageAssessment),
                recommendations: this.generateRecommendations(damageAssessment),
                insuranceClaim: this.generateInsuranceClaimData(damageAssessment),
                disclaimer: this.getProfessionalDisclaimer()
            };

            logger.info(`✅ REAL roofing damage analysis completed - ID: ${analysisId}`);
            return result;

        } catch (error) {
            logger.error('❌ Error in REAL roofing damage analysis:', error);
            throw new ApiError.internalServerError(`Real damage analysis failed: ${error.message}`);
        }
    }

    async extractImageMetadata(imageBuffer) {
        try {
            const exifData = await ExifReader.parse(imageBuffer);
            const sharpMetadata = await sharp(imageBuffer).metadata();
            
            return {
                dimensions: {
                    width: sharpMetadata.width,
                    height: sharpMetadata.height
                },
                format: sharpMetadata.format,
                size: imageBuffer.length,
                exif: {
                    camera: exifData?.Make || 'Unknown',
                    model: exifData?.Model || 'Unknown',
                    dateTime: exifData?.DateTime || null,
                    gps: {
                        latitude: exifData?.latitude || null,
                        longitude: exifData?.longitude || null
                    },
                    settings: {
                        iso: exifData?.ISO || null,
                        aperture: exifData?.FNumber || null,
                        shutter: exifData?.ExposureTime || null
                    }
                }
            };
        } catch (error) {
            logger.warn('⚠️ Could not extract full image metadata:', error);
            return { error: 'Metadata extraction failed' };
        }
    }

    async prepareImageForAnalysis(imageBuffer) {
        try {
            // Process image to optimal size for Claude analysis while maintaining quality
            const processedImage = await sharp(imageBuffer)
                .resize(this.imageConfig.targetSize.width, this.imageConfig.targetSize.height, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: this.imageConfig.quality })
                .toBuffer({ resolveWithObject: true });

            return processedImage;

        } catch (error) {
            logger.error('❌ Error preparing image for analysis:', error);
            throw new Error('Image preparation failed');
        }
    }

    async performComprehensiveAnalysis(processedImage, metadata) {
        try {
            const imageBase64 = processedImage.data.toString('base64');
            
            const response = await this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 2000,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/jpeg',
                                    data: imageBase64
                                }
                            },
                            {
                                type: 'text',
                                text: this.prompts.comprehensive + (metadata.address ? `\n\nProperty: ${metadata.address}` : '') + (metadata.weatherEvent ? `\nWeather Event: ${metadata.weatherEvent}` : '')
                            }
                        ]
                    }
                ]
            });

            const analysisText = response.content[0]?.text;
            if (!analysisText) {
                throw new Error('No analysis response from Claude');
            }

            return {
                rawAnalysis: analysisText,
                findings: this.parseComprehensiveFindings(analysisText),
                confidence: this.extractConfidenceLevel(analysisText),
                tokenUsage: response.usage
            };

        } catch (error) {
            logger.error('❌ Error in comprehensive analysis:', error);
            return {
                error: `Comprehensive analysis failed: ${error.message}`,
                rawAnalysis: null,
                findings: {},
                confidence: 'low'
            };
        }
    }

    async performHailDamageAnalysis(processedImage, metadata) {
        try {
            const imageBase64 = processedImage.data.toString('base64');
            
            const response = await this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/jpeg',
                                    data: imageBase64
                                }
                            },
                            {
                                type: 'text',
                                text: this.prompts.hailSpecific
                            }
                        ]
                    }
                ]
            });

            const analysisText = response.content[0]?.text;
            return {
                rawAnalysis: analysisText,
                detected: this.extractHailDetection(analysisText),
                severity: this.extractSeverity(analysisText),
                impactCount: this.extractImpactCount(analysisText),
                confidence: this.extractConfidenceLevel(analysisText),
                tokenUsage: response.usage
            };

        } catch (error) {
            logger.error('❌ Error in hail damage analysis:', error);
            return {
                error: `Hail analysis failed: ${error.message}`,
                detected: false,
                severity: 'unknown',
                confidence: 'low'
            };
        }
    }

    async performWindDamageAnalysis(processedImage, metadata) {
        try {
            const imageBase64 = processedImage.data.toString('base64');
            
            const response = await this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/jpeg',
                                    data: imageBase64
                                }
                            },
                            {
                                type: 'text',
                                text: this.prompts.windSpecific
                            }
                        ]
                    }
                ]
            });

            const analysisText = response.content[0]?.text;
            return {
                rawAnalysis: analysisText,
                detected: this.extractWindDetection(analysisText),
                severity: this.extractSeverity(analysisText),
                liftedShingles: this.extractLiftedShingles(analysisText),
                confidence: this.extractConfidenceLevel(analysisText),
                tokenUsage: response.usage
            };

        } catch (error) {
            logger.error('❌ Error in wind damage analysis:', error);
            return {
                error: `Wind analysis failed: ${error.message}`,
                detected: false,
                severity: 'unknown',
                confidence: 'low'
            };
        }
    }

    async performGranuleLossAnalysis(processedImage, metadata) {
        try {
            const imageBase64 = processedImage.data.toString('base64');
            
            const response = await this.anthropic.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/jpeg',
                                    data: imageBase64
                                }
                            },
                            {
                                type: 'text',
                                text: this.prompts.granuleSpecific
                            }
                        ]
                    }
                ]
            });

            const analysisText = response.content[0]?.text;
            return {
                rawAnalysis: analysisText,
                detected: this.extractGranuleDetection(analysisText),
                severity: this.extractSeverity(analysisText),
                percentage: this.extractGranulePercentage(analysisText),
                confidence: this.extractConfidenceLevel(analysisText),
                tokenUsage: response.usage
            };

        } catch (error) {
            logger.error('❌ Error in granule loss analysis:', error);
            return {
                error: `Granule analysis failed: ${error.message}`,
                detected: false,
                severity: 'unknown',
                confidence: 'low'
            };
        }
    }

    synthesizeAnalyses(analyses) {
        const { comprehensive, hail, wind, granule } = analyses;
        
        // Determine overall damage severity
        const severities = [hail.severity, wind.severity, granule.severity].filter(s => s && s !== 'unknown');
        const overallSeverity = this.determineOverallSeverity(severities);
        
        // Calculate confidence scores
        const confidenceScores = [hail.confidence, wind.confidence, granule.confidence]
            .map(c => this.mapConfidenceToScore(c))
            .filter(s => s > 0);
        const averageConfidence = confidenceScores.length > 0 ? 
            confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length : 0;

        return {
            overall: {
                severity: overallSeverity,
                confidence: this.mapScoreToConfidence(averageConfidence),
                damageDetected: hail.detected || wind.detected || granule.detected,
                primaryDamageType: this.determinePrimaryDamageType({ hail, wind, granule }),
                repairRecommended: overallSeverity !== 'none' && overallSeverity !== 'minimal',
                urgency: this.assessUrgency({ hail, wind, granule })
            },
            hail: {
                detected: hail.detected,
                severity: hail.severity,
                impactCount: hail.impactCount || 0,
                confidence: hail.confidence,
                analysis: hail.rawAnalysis,
                error: hail.error
            },
            wind: {
                detected: wind.detected,
                severity: wind.severity,
                liftedShingles: wind.liftedShingles || 0,
                confidence: wind.confidence,
                analysis: wind.rawAnalysis,
                error: wind.error
            },
            granuleLoss: {
                detected: granule.detected,
                severity: granule.severity,
                percentage: granule.percentage || 0,
                confidence: granule.confidence,
                analysis: granule.rawAnalysis,
                error: granule.error
            },
            comprehensive: {
                analysis: comprehensive.rawAnalysis,
                findings: comprehensive.findings,
                confidence: comprehensive.confidence,
                error: comprehensive.error
            }
        };
    }

    // Text parsing methods to extract structured data from Claude's responses
    parseComprehensiveFindings(text) {
        const findings = {};
        
        // Extract key observations
        const observations = this.extractSection(text, ['observations', 'findings', 'assessment']);
        if (observations) findings.observations = observations;
        
        // Extract recommendations
        const recommendations = this.extractSection(text, ['recommendations', 'actions', 'next steps']);
        if (recommendations) findings.recommendations = recommendations;
        
        return findings;
    }

    extractHailDetection(text) {
        const lowerText = text.toLowerCase();
        const hailIndicators = [
            'hail impact', 'hail damage', 'circular impact', 'impact mark', 
            'bruising', 'granule displacement', 'impact visible'
        ];
        const noHailIndicators = [
            'no hail', 'no impact', 'no circular', 'no hail damage',
            'cannot identify hail', 'no visible hail'
        ];
        
        const hasHailIndicators = hailIndicators.some(indicator => lowerText.includes(indicator));
        const hasNoHailIndicators = noHailIndicators.some(indicator => lowerText.includes(indicator));
        
        return hasHailIndicators && !hasNoHailIndicators;
    }

    extractWindDetection(text) {
        const lowerText = text.toLowerCase();
        const windIndicators = [
            'lifted shingle', 'wind damage', 'shingle lifting', 'tab lifted',
            'missing shingle', 'displaced shingle', 'creased', 'edge lifting'
        ];
        const noWindIndicators = [
            'no wind', 'no lifting', 'no wind damage', 'shingles appear secure',
            'no visible wind'
        ];
        
        const hasWindIndicators = windIndicators.some(indicator => lowerText.includes(indicator));
        const hasNoWindIndicators = noWindIndicators.some(indicator => lowerText.includes(indicator));
        
        return hasWindIndicators && !hasNoWindIndicators;
    }

    extractGranuleDetection(text) {
        const lowerText = text.toLowerCase();
        const granuleIndicators = [
            'granule loss', 'granule displacement', 'exposed asphalt', 'exposed mat',
            'significant loss', 'granule coverage'
        ];
        const noGranuleIndicators = [
            'normal granule', 'good granule coverage', 'minimal loss',
            'no significant granule'
        ];
        
        const hasGranuleIndicators = granuleIndicators.some(indicator => lowerText.includes(indicator));
        const hasNoGranuleIndicators = noGranuleIndicators.some(indicator => lowerText.includes(indicator));
        
        return hasGranuleIndicators && !hasNoGranuleIndicators;
    }

    extractSeverity(text) {
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('severe') || lowerText.includes('significant') || lowerText.includes('major')) {
            return 'severe';
        } else if (lowerText.includes('moderate') || lowerText.includes('substantial')) {
            return 'moderate';
        } else if (lowerText.includes('mild') || lowerText.includes('minor') || lowerText.includes('slight')) {
            return 'mild';
        } else if (lowerText.includes('minimal') || lowerText.includes('very minor')) {
            return 'minimal';
        } else if (lowerText.includes('none') || lowerText.includes('no damage')) {
            return 'none';
        }
        
        return 'unknown';
    }

    extractConfidenceLevel(text) {
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('high confidence') || lowerText.includes('confident') || lowerText.includes('clearly visible')) {
            return 'high';
        } else if (lowerText.includes('medium confidence') || lowerText.includes('moderately confident')) {
            return 'medium';
        } else if (lowerText.includes('low confidence') || lowerText.includes('uncertain') || lowerText.includes('difficult to determine')) {
            return 'low';
        }
        
        return 'medium'; // Default
    }

    extractImpactCount(text) {
        // Try to extract number of impacts mentioned
        const matches = text.match(/(\d+)\s*(impact|hail|mark)/gi);
        if (matches && matches.length > 0) {
            const numbers = matches.map(match => parseInt(match.match(/\d+/)[0]));
            return Math.max(...numbers);
        }
        return 0;
    }

    extractLiftedShingles(text) {
        // Try to extract number of lifted shingles mentioned
        const matches = text.match(/(\d+)\s*(lifted|shingle|tab|missing)/gi);
        if (matches && matches.length > 0) {
            const numbers = matches.map(match => parseInt(match.match(/\d+/)[0]));
            return Math.max(...numbers);
        }
        return 0;
    }

    extractGranulePercentage(text) {
        // Try to extract granule loss percentage
        const matches = text.match(/(\d+)%?\s*(granule|loss|coverage)/gi);
        if (matches && matches.length > 0) {
            const numbers = matches.map(match => parseInt(match.match(/\d+/)[0]));
            return Math.max(...numbers);
        }
        return 0;
    }

    extractSection(text, keywords) {
        for (const keyword of keywords) {
            const regex = new RegExp(`${keyword}:?\\s*([^\\n]+(?:\\n[^\\n]+)*)`, 'gi');
            const match = text.match(regex);
            if (match) {
                return match[0].replace(new RegExp(`${keyword}:?\\s*`, 'gi'), '').trim();
            }
        }
        return null;
    }

    // Utility methods
    determineOverallSeverity(severities) {
        if (severities.includes('severe')) return 'severe';
        if (severities.includes('moderate')) return 'moderate';
        if (severities.includes('mild')) return 'mild';
        if (severities.includes('minimal')) return 'minimal';
        return 'none';
    }

    determinePrimaryDamageType({ hail, wind, granule }) {
        const damageTypes = [];
        
        if (hail.detected) damageTypes.push({ type: 'hail', confidence: this.mapConfidenceToScore(hail.confidence) });
        if (wind.detected) damageTypes.push({ type: 'wind', confidence: this.mapConfidenceToScore(wind.confidence) });
        if (granule.detected) damageTypes.push({ type: 'granule_loss', confidence: this.mapConfidenceToScore(granule.confidence) });
        
        if (damageTypes.length === 0) return 'none';
        
        // Return type with highest confidence
        damageTypes.sort((a, b) => b.confidence - a.confidence);
        return damageTypes[0].type;
    }

    assessUrgency({ hail, wind, granule }) {
        if (wind.detected && wind.severity === 'severe') return 'high';
        if (hail.detected && hail.severity === 'severe') return 'medium';
        if (granule.detected && granule.severity === 'severe') return 'medium';
        if (wind.detected || hail.detected) return 'medium';
        return 'low';
    }

    mapConfidenceToScore(confidence) {
        const mapping = { 'high': 90, 'medium': 70, 'low': 40 };
        return mapping[confidence] || 50;
    }

    mapScoreToConfidence(score) {
        if (score >= 85) return 'high';
        if (score >= 65) return 'medium';
        return 'low';
    }

    calculateOverallConfidence(damageAssessment) {
        const confidenceScores = [
            this.mapConfidenceToScore(damageAssessment.hail.confidence),
            this.mapConfidenceToScore(damageAssessment.wind.confidence),
            this.mapConfidenceToScore(damageAssessment.granuleLoss.confidence),
            this.mapConfidenceToScore(damageAssessment.comprehensive.confidence)
        ].filter(score => score > 0);

        if (confidenceScores.length === 0) return 0;
        
        const average = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
        return Math.round(average);
    }

    generateRecommendations(damageAssessment) {
        const recommendations = [];
        
        if (damageAssessment.overall.severity === 'none') {
            recommendations.push({
                type: 'maintenance',
                priority: 'low',
                action: 'Continue regular roof maintenance and inspections',
                timeline: 'Annual inspection recommended'
            });
        } else {
            if (damageAssessment.hail.detected) {
                recommendations.push({
                    type: 'documentation',
                    priority: damageAssessment.hail.severity === 'severe' ? 'high' : 'medium',
                    action: 'Document hail damage for insurance claim',
                    timeline: 'Within 30 days'
                });
            }
            
            if (damageAssessment.wind.detected) {
                recommendations.push({
                    type: 'repair',
                    priority: 'high',
                    action: 'Address wind damage to prevent water intrusion',
                    timeline: 'Within 48 hours for severe damage'
                });
            }
            
            if (damageAssessment.granuleLoss.detected) {
                recommendations.push({
                    type: 'evaluation',
                    priority: 'medium',
                    action: 'Professional assessment of granule loss impact on roof life',
                    timeline: 'Within 2 weeks'
                });
            }
            
            recommendations.push({
                type: 'professional',
                priority: 'high',
                action: 'Schedule professional on-site inspection for complete assessment',
                timeline: 'Within 1 week'
            });
        }
        
        return recommendations;
    }

    generateInsuranceClaimData(damageAssessment) {
        const claimViability = this.assessClaimViability(damageAssessment);
        
        return {
            claimable: claimViability.score > 60,
            claimStrength: {
                score: claimViability.score,
                rating: claimViability.rating,
                evidence: claimViability.evidence
            },
            documentation: {
                damageType: damageAssessment.overall.primaryDamageType,
                severity: damageAssessment.overall.severity,
                confidence: damageAssessment.overall.confidence,
                aiAnalysis: 'Real AI vision analysis using Claude-3 Sonnet'
            },
            recommendations: [
                'Professional on-site inspection required',
                'Document additional damage not visible in photos',
                'Obtain repair estimates from licensed contractors',
                'File claim promptly if damage is confirmed'
            ]
        };
    }

    assessClaimViability(damageAssessment) {
        let score = 0;
        const evidence = [];
        
        // Hail damage evidence
        if (damageAssessment.hail.detected) {
            score += 35;
            evidence.push(`Hail damage detected: ${damageAssessment.hail.impactCount} impacts`);
            if (damageAssessment.hail.severity === 'severe') score += 25;
        }
        
        // Wind damage evidence
        if (damageAssessment.wind.detected) {
            score += 30;
            evidence.push(`Wind damage detected: ${damageAssessment.wind.liftedShingles} affected shingles`);
            if (damageAssessment.wind.severity === 'severe') score += 20;
        }
        
        // Granule loss evidence
        if (damageAssessment.granuleLoss.detected) {
            score += 20;
            evidence.push(`Granule loss detected: ${damageAssessment.granuleLoss.percentage}% loss estimated`);
        }
        
        // Confidence adjustment
        const confidenceMultiplier = this.mapConfidenceToScore(damageAssessment.overall.confidence) / 100;
        score = Math.round(score * confidenceMultiplier);
        
        let rating;
        if (score >= 80) rating = 'strong';
        else if (score >= 60) rating = 'moderate';
        else if (score >= 40) rating = 'weak';
        else rating = 'insufficient';
        
        return { score, rating, evidence };
    }

    generateProfessionalReport(damageAssessment, imageMetadata, userMetadata) {
        return {
            reportId: this.generateReportId(),
            timestamp: new Date().toISOString(),
            analysisType: 'Real AI Vision Analysis',
            aiProvider: 'Claude-3 Sonnet (Anthropic)',
            
            property: {
                address: userMetadata.address || 'Not provided',
                inspector: userMetadata.inspector || 'AI Analysis System',
                weatherEvent: userMetadata.weatherEvent || 'Storm damage assessment'
            },
            
            imageInfo: {
                captureDate: imageMetadata.exif?.dateTime || 'Unknown',
                camera: `${imageMetadata.exif?.camera} ${imageMetadata.exif?.model}` || 'Unknown device',
                resolution: `${imageMetadata.dimensions?.width}x${imageMetadata.dimensions?.height}`,
                fileSize: `${Math.round(imageMetadata.size / 1024)} KB`
            },
            
            analysis: {
                overallAssessment: {
                    severity: damageAssessment.overall.severity,
                    confidence: `${damageAssessment.overall.confidence}%`,
                    primaryDamage: damageAssessment.overall.primaryDamageType,
                    repairNeeded: damageAssessment.overall.repairRecommended
                },
                
                hailDamage: {
                    detected: damageAssessment.hail.detected,
                    severity: damageAssessment.hail.severity,
                    impactCount: damageAssessment.hail.impactCount,
                    confidence: damageAssessment.hail.confidence,
                    notes: damageAssessment.hail.analysis ? 
                        this.extractKeyPoints(damageAssessment.hail.analysis) : 'Analysis not available'
                },
                
                windDamage: {
                    detected: damageAssessment.wind.detected,
                    severity: damageAssessment.wind.severity,
                    affectedShingles: damageAssessment.wind.liftedShingles,
                    confidence: damageAssessment.wind.confidence,
                    notes: damageAssessment.wind.analysis ? 
                        this.extractKeyPoints(damageAssessment.wind.analysis) : 'Analysis not available'
                },
                
                granuleLoss: {
                    detected: damageAssessment.granuleLoss.detected,
                    severity: damageAssessment.granuleLoss.severity,
                    estimatedPercentage: damageAssessment.granuleLoss.percentage,
                    confidence: damageAssessment.granuleLoss.confidence,
                    notes: damageAssessment.granuleLoss.analysis ? 
                        this.extractKeyPoints(damageAssessment.granuleLoss.analysis) : 'Analysis not available'
                }
            },
            
            recommendations: damageAssessment.recommendations || [],
            
            insurance: {
                claimViability: damageAssessment.insuranceClaim?.claimable ? 'Viable' : 'Requires further assessment',
                claimStrength: damageAssessment.insuranceClaim?.claimStrength?.rating || 'Unknown',
                evidence: damageAssessment.insuranceClaim?.claimStrength?.evidence || []
            },
            
            comprehensiveFindings: damageAssessment.comprehensive.analysis || 'Comprehensive analysis not available'
        };
    }

    extractKeyPoints(text) {
        // Extract first few sentences or key bullet points
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        return sentences.slice(0, 3).join('. ').trim() + (sentences.length > 3 ? '...' : '');
    }

    getProfessionalDisclaimer() {
        return {
            aiAnalysis: 'This assessment was performed using advanced AI vision analysis (Claude-3 Sonnet). While highly sophisticated, AI analysis may not detect all damage or provide complete accuracy.',
            professionalInspection: 'A professional on-site inspection is strongly recommended for insurance claims, repair planning, and safety assessment.',
            limitations: 'Analysis is limited to what is visible in the submitted photograph. Hidden damage, structural issues, and damage in non-visible areas cannot be assessed.',
            accuracy: 'AI analysis confidence levels indicate the system\'s certainty in its findings. Higher confidence suggests more reliable detection.',
            liability: 'This AI analysis is for informational purposes only and should not be used as the sole basis for insurance claims or repair decisions.'
        };
    }

    generateAnalysisId() {
        return `real-roof-analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    generateReportId() {
        return `real-damage-report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}