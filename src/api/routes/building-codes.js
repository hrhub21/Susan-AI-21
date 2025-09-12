import express from 'express';
import { BuildingCodeService } from '../services/BuildingCodeService.js';

const router = express.Router();
const buildingCodeService = new BuildingCodeService();

/**
 * @route GET /api/building-codes/status
 * @desc Get building code service status and statistics
 * @access Public
 */
router.get('/status', async (req, res) => {
    try {
        const status = buildingCodeService.getServiceStatus();
        
        res.json({
            success: true,
            status,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error getting building code service status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get service status',
            message: error.message
        });
    }
});

/**
 * @route GET /api/building-codes/requirements
 * @desc Get building code requirements for a specific location
 * @access Public
 */
router.get('/requirements', async (req, res) => {
    try {
        const { state, county, city, zipCode } = req.query;
        
        if (!state) {
            return res.status(400).json({
                success: false,
                error: 'State is required',
                message: 'Please provide at least a state code (e.g., FL, CA, TX)'
            });
        }

        const location = { state, county, city, zipCode };
        const requirements = await buildingCodeService.getBuildingCodeRequirements(location);
        
        res.json({
            success: true,
            requirements,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error getting building code requirements:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get building code requirements',
            message: error.message
        });
    }
});

/**
 * @route POST /api/building-codes/compliance-check
 * @desc Check compliance of roofing work against building codes
 * @access Public
 */
router.post('/compliance-check', async (req, res) => {
    try {
        const { workDescription, location } = req.body;
        
        if (!workDescription || !location) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                message: 'Both workDescription and location are required'
            });
        }

        console.log('🔍 Starting building code compliance check...');
        const complianceResult = await buildingCodeService.checkCompliance(workDescription, location);
        
        res.json({
            success: true,
            compliance: complianceResult,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error checking building code compliance:', error);
        res.status(500).json({
            success: false,
            error: 'Compliance check failed',
            message: error.message
        });
    }
});

/**
 * @route GET /api/building-codes/search
 * @desc Search building codes by keyword or topic
 * @access Public
 */
router.get('/search', async (req, res) => {
    try {
        const { query, state, county, city } = req.query;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required',
                message: 'Please provide a search query'
            });
        }

        const location = state ? { state, county, city } : null;
        const searchResults = await buildingCodeService.searchCodes(query, location);
        
        res.json({
            success: true,
            search: searchResults,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error searching building codes:', error);
        res.status(500).json({
            success: false,
            error: 'Code search failed',
            message: error.message
        });
    }
});

/**
 * @route GET /api/building-codes/materials/:materialType
 * @desc Get specific material requirements for a location
 * @access Public
 */
router.get('/materials/:materialType', async (req, res) => {
    try {
        const { materialType } = req.params;
        const { state, county, city } = req.query;
        
        if (!state) {
            return res.status(400).json({
                success: false,
                error: 'Location is required',
                message: 'Please provide at least a state code'
            });
        }

        const location = { state, county, city };
        const materialRequirements = await buildingCodeService.getMaterialRequirements(materialType, location);
        
        res.json({
            success: true,
            materialRequirements,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error getting material requirements:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get material requirements',
            message: error.message
        });
    }
});

/**
 * @route POST /api/building-codes/wind-load-calculation
 * @desc Calculate wind load requirements for a specific location and building
 * @access Public
 */
router.post('/wind-load-calculation', async (req, res) => {
    try {
        const { location, buildingHeight = 30, exposure = 'B' } = req.body;
        
        if (!location || !location.state) {
            return res.status(400).json({
                success: false,
                error: 'Location with state is required',
                message: 'Please provide location with at least state information'
            });
        }

        const windLoadRequirements = await buildingCodeService.calculateWindLoadRequirements(
            location,
            buildingHeight,
            exposure
        );
        
        res.json({
            success: true,
            windLoad: windLoadRequirements,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error calculating wind load requirements:', error);
        res.status(500).json({
            success: false,
            error: 'Wind load calculation failed',
            message: error.message
        });
    }
});

/**
 * @route GET /api/building-codes/states
 * @desc Get list of all supported states with their building code information
 * @access Public
 */
router.get('/states', async (req, res) => {
    try {
        const states = [];
        
        for (const [stateCode, stateData] of buildingCodeService.stateCodes.entries()) {
            states.push({
                code: stateCode,
                name: stateData.name,
                adoptedCode: stateData.adoptedCode,
                windZone: stateData.windZone,
                energyCode: stateData.roofingRequirements?.energyCode,
                hasLocalVariations: Object.keys(stateData.localVariations || {}).length > 0
            });
        }
        
        res.json({
            success: true,
            states: states.sort((a, b) => a.name.localeCompare(b.name)),
            total: states.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error getting states list:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get states list',
            message: error.message
        });
    }
});

/**
 * @route GET /api/building-codes/state/:stateCode
 * @desc Get detailed building code information for a specific state
 * @access Public
 */
router.get('/state/:stateCode', async (req, res) => {
    try {
        const { stateCode } = req.params;
        const stateData = buildingCodeService.stateCodes.get(stateCode.toUpperCase());
        
        if (!stateData) {
            return res.status(404).json({
                success: false,
                error: 'State not found',
                message: `Building code data for state ${stateCode} not found`
            });
        }
        
        res.json({
            success: true,
            state: {
                code: stateCode.toUpperCase(),
                ...stateData
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error getting state building codes:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get state building codes',
            message: error.message
        });
    }
});

/**
 * @route POST /api/building-codes/quick-compliance
 * @desc Quick compliance check for common roofing scenarios
 * @access Public
 */
router.post('/quick-compliance', async (req, res) => {
    try {
        const { materialType, location, workType = 'replacement' } = req.body;
        
        if (!materialType || !location || !location.state) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                message: 'materialType and location with state are required'
            });
        }

        // Create a simplified work description for common scenarios
        const workDescription = {
            scope: workType,
            materials: {
                type: materialType,
                weight: materialType === 'asphalt_shingles' ? 240 : 
                       materialType === 'metal_roofing' ? 150 : 600,
                windRating: 'Class F',
                fireRating: 'Class A'
            },
            installation: {
                nailsPerShingle: materialType === 'asphalt_shingles' ? 4 : null,
                ventilation: 'ridge_and_soffit',
                flashing: 'step_and_valley'
            },
            insulation: {
                rValue: 30
            },
            permit: {
                obtained: false
            }
        };

        const complianceResult = await buildingCodeService.checkCompliance(workDescription, location);
        
        // Simplify result for quick check
        const quickResult = {
            compliant: complianceResult.overallCompliance.score >= 70,
            score: complianceResult.overallCompliance.score,
            rating: complianceResult.overallCompliance.rating,
            criticalIssues: complianceResult.results
                .filter(r => !r.compliant && r.severity === 'critical')
                .map(r => r.description),
            recommendations: complianceResult.recommendations.slice(0, 3),
            permitRequired: complianceResult.results
                .some(r => r.ruleId === 'permit_compliance' && !r.compliant)
        };
        
        res.json({
            success: true,
            quickCompliance: quickResult,
            fullResult: complianceResult,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error performing quick compliance check:', error);
        res.status(500).json({
            success: false,
            error: 'Quick compliance check failed',
            message: error.message
        });
    }
});

/**
 * @route POST /api/building-codes/subscribe-updates
 * @desc Subscribe to building code update notifications
 * @access Public
 */
router.post('/subscribe-updates', async (req, res) => {
    try {
        const { email, states = [], topics = [] } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required',
                message: 'Please provide an email address for notifications'
            });
        }

        const filters = { states, topics };
        const subscriptionId = buildingCodeService.subscribeToUpdates(
            (update) => {
                // In a real implementation, this would send email notifications
                console.log(`📧 Sending update notification to ${email}:`, update);
            },
            filters
        );
        
        res.json({
            success: true,
            subscription: {
                id: subscriptionId,
                email,
                filters,
                created: new Date().toISOString()
            },
            message: 'Successfully subscribed to building code updates'
        });
        
    } catch (error) {
        console.error('❌ Error subscribing to updates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to subscribe to updates',
            message: error.message
        });
    }
});

/**
 * @route DELETE /api/building-codes/unsubscribe/:subscriptionId
 * @desc Unsubscribe from building code update notifications
 * @access Public
 */
router.delete('/unsubscribe/:subscriptionId', async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        
        const unsubscribed = buildingCodeService.unsubscribeFromUpdates(subscriptionId);
        
        if (unsubscribed) {
            res.json({
                success: true,
                message: 'Successfully unsubscribed from building code updates'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Subscription not found',
                message: 'The subscription ID was not found'
            });
        }
        
    } catch (error) {
        console.error('❌ Error unsubscribing from updates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to unsubscribe from updates',
            message: error.message
        });
    }
});

/**
 * @route GET /api/building-codes/material-types
 * @desc Get list of supported roofing material types
 * @access Public
 */
router.get('/material-types', async (req, res) => {
    try {
        const materialTypes = [];
        
        for (const [materialType, requirements] of buildingCodeService.materialRequirements.entries()) {
            materialTypes.push({
                type: materialType,
                name: materialType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                categories: Object.keys(requirements.categories || {}),
                description: this.getMaterialDescription(materialType)
            });
        }
        
        res.json({
            success: true,
            materialTypes,
            total: materialTypes.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error getting material types:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get material types',
            message: error.message
        });
    }
});

/**
 * @route GET /api/building-codes/citations
 * @desc Generate building code citations for a specific requirement
 * @access Public
 */
router.get('/citations', async (req, res) => {
    try {
        const { state, topic, materialType } = req.query;
        
        if (!state || !topic) {
            return res.status(400).json({
                success: false,
                error: 'State and topic are required',
                message: 'Please provide both state and topic parameters'
            });
        }

        const location = { state };
        const requirements = await buildingCodeService.getBuildingCodeRequirements(location);
        
        // Generate citations based on topic
        const citations = this.generateTopicCitations(topic, materialType, requirements);
        
        res.json({
            success: true,
            citations: {
                topic,
                state,
                materialType,
                references: citations,
                generated: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Error generating citations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate citations',
            message: error.message
        });
    }
});

// Helper method to get material descriptions
function getMaterialDescription(materialType) {
    const descriptions = {
        'asphalt_shingles': 'Traditional asphalt composition shingles',
        'metal_roofing': 'Standing seam and exposed fastener metal roofing systems',
        'tile_roofing': 'Clay and concrete tile roofing systems',
        'membrane_roofing': 'Single-ply membrane systems for low-slope roofs'
    };
    
    return descriptions[materialType] || 'Roofing material system';
}

// Helper method to generate topic-specific citations
function generateTopicCitations(topic, materialType, requirements) {
    const baseCitations = [
        'International Building Code (IBC)',
        'International Residential Code (IRC)',
        'International Energy Conservation Code (IECC)',
        'ASCE 7 - Minimum Design Loads for Buildings'
    ];
    
    const topicCitations = {
        'wind_resistance': [
            'ASTM D3161 - Standard Test Method for Wind Resistance',
            'ASTM D6381 - Standard Test Method for Measurement of Asphalt Shingle Uplift Force',
            'UL 997 - Standard for Wind Resistance of Prepared Roof Covering Materials'
        ],
        'fire_resistance': [
            'ASTM E108 - Standard Test Methods for Fire Tests of Roof Coverings',
            'UL 790 - Standard Test Methods for Fire Tests of Roof Covering Materials',
            'NFPA 101 - Life Safety Code'
        ],
        'energy_efficiency': [
            'ASHRAE 90.1 - Energy Standard for Buildings',
            'CRRC-1 - Cool Roof Rating Council Standard',
            'ENERGY STAR Roof Products Criteria'
        ]
    };
    
    return {
        base: baseCitations,
        topic: topicCitations[topic] || [],
        state: [`${requirements.location.state} Building Code`],
        federal: requirements.requirements ? Object.keys(requirements.requirements) : []
    };
}

export default router;