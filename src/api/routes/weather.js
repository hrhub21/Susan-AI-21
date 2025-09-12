import express from 'express';
import { WeatherDataService } from '../services/WeatherDataService.js';
import { auth } from '../middleware/auth.js';
import { validation } from '../middleware/validation.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Initialize weather service (will be done in the main server)
let weatherService = null;

// Middleware to ensure weather service is available
const ensureWeatherService = (req, res, next) => {
    if (!weatherService) {
        return res.status(503).json({
            success: false,
            error: 'Weather service not available',
            message: 'Weather service is not initialized or temporarily unavailable'
        });
    }
    next();
};

// Initialize weather service
export const initializeWeatherService = (apiKeys = {}) => {
    weatherService = new WeatherDataService(apiKeys);
    return weatherService;
};

// Validation schemas
const locationValidation = {
    address: { type: 'string', required: true, minLength: 1 },
    lat: { type: 'number', min: -90, max: 90 },
    lon: { type: 'number', min: -180, max: 180 }
};

const dateValidation = {
    startDate: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/ },
    endDate: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/ }
};

/**
 * @swagger
 * components:
 *   schemas:
 *     WeatherLocation:
 *       type: object
 *       properties:
 *         address:
 *           type: string
 *           description: Address or location name
 *         lat:
 *           type: number
 *           description: Latitude coordinate
 *         lon:
 *           type: number
 *           description: Longitude coordinate
 *     CurrentWeather:
 *       type: object
 *       properties:
 *         location:
 *           $ref: '#/components/schemas/WeatherLocation'
 *         current:
 *           type: object
 *           description: Current weather conditions
 *         stormIndicators:
 *           type: object
 *           description: Storm activity indicators
 *         damageRisk:
 *           type: object
 *           description: Damage risk assessment
 *     StormEvent:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique storm event ID
 *         eventTypes:
 *           type: array
 *           items:
 *             type: string
 *           description: Types of storm events
 *         severityLevel:
 *           type: string
 *           description: Storm severity level
 *         conditions:
 *           type: object
 *           description: Weather conditions during storm
 *         damageRisk:
 *           type: object
 *           description: Damage risk assessment
 */

/**
 * @swagger
 * /api/weather/current:
 *   get:
 *     summary: Get current weather data
 *     tags: [Weather]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: address
 *         schema:
 *           type: string
 *         description: Address or location name
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitude coordinate
 *       - in: query
 *         name: lon
 *         schema:
 *           type: number
 *         description: Longitude coordinate
 *     responses:
 *       200:
 *         description: Current weather data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CurrentWeather'
 *       400:
 *         description: Invalid location parameters
 *       500:
 *         description: Weather service error
 */
router.get('/current', auth, ensureWeatherService, async (req, res) => {
    try {
        const { address, lat, lon } = req.query;
        
        // Validate location input
        let location;
        if (address) {
            location = address;
        } else if (lat && lon) {
            location = { lat: parseFloat(lat), lon: parseFloat(lon) };
        } else {
            return res.status(400).json({
                success: false,
                error: 'Invalid location parameters',
                message: 'Provide either address or lat/lon coordinates'
            });
        }
        
        const weatherData = await weatherService.getCurrentWeather(location);
        
        res.json({
            success: true,
            data: weatherData,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Current weather API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get current weather',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/weather/historical:
 *   get:
 *     summary: Get historical weather data
 *     tags: [Weather]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: address
 *         schema:
 *           type: string
 *         description: Address or location name
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitude coordinate
 *       - in: query
 *         name: lon
 *         schema:
 *           type: number
 *         description: Longitude coordinate
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Historical weather data retrieved successfully
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Weather service error
 */
router.get('/historical', auth, ensureWeatherService, async (req, res) => {
    try {
        const { address, lat, lon, startDate, endDate } = req.query;
        
        // Validate location
        let location;
        if (address) {
            location = address;
        } else if (lat && lon) {
            location = { lat: parseFloat(lat), lon: parseFloat(lon) };
        } else {
            return res.status(400).json({
                success: false,
                error: 'Invalid location parameters',
                message: 'Provide either address or lat/lon coordinates'
            });
        }
        
        // Validate dates
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                error: 'Missing date parameters',
                message: 'Both startDate and endDate are required'
            });
        }
        
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date format',
                message: 'Dates must be in YYYY-MM-DD format'
            });
        }
        
        const historicalData = await weatherService.getHistoricalWeather(location, startDate, endDate);
        
        res.json({
            success: true,
            data: historicalData,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Historical weather API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get historical weather',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/weather/forecast:
 *   get:
 *     summary: Get extended weather forecast
 *     tags: [Weather]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: address
 *         schema:
 *           type: string
 *         description: Address or location name
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitude coordinate
 *       - in: query
 *         name: lon
 *         schema:
 *           type: number
 *         description: Longitude coordinate
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *           default: 7
 *         description: Number of forecast days
 *     responses:
 *       200:
 *         description: Weather forecast retrieved successfully
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Weather service error
 */
router.get('/forecast', auth, ensureWeatherService, async (req, res) => {
    try {
        const { address, lat, lon, days = 7 } = req.query;
        
        // Validate location
        let location;
        if (address) {
            location = address;
        } else if (lat && lon) {
            location = { lat: parseFloat(lat), lon: parseFloat(lon) };
        } else {
            return res.status(400).json({
                success: false,
                error: 'Invalid location parameters',
                message: 'Provide either address or lat/lon coordinates'
            });
        }
        
        // Validate days parameter
        const forecastDays = parseInt(days);
        if (isNaN(forecastDays) || forecastDays < 1 || forecastDays > 10) {
            return res.status(400).json({
                success: false,
                error: 'Invalid days parameter',
                message: 'Days must be between 1 and 10'
            });
        }
        
        const forecastData = await weatherService.getExtendedWeatherForecast(location, forecastDays);
        
        res.json({
            success: true,
            data: forecastData,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Weather forecast API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get weather forecast',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/weather/storms/detect:
 *   post:
 *     summary: Detect storm events
 *     tags: [Weather]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               location:
 *                 $ref: '#/components/schemas/WeatherLocation'
 *               weatherData:
 *                 type: object
 *                 description: Optional weather data, if not provided current weather will be fetched
 *     responses:
 *       200:
 *         description: Storm detection completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StormEvent'
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Storm detection failed
 */
router.post('/storms/detect', auth, ensureWeatherService, async (req, res) => {
    try {
        const { location, weatherData } = req.body;
        
        if (!location) {
            return res.status(400).json({
                success: false,
                error: 'Missing location parameter',
                message: 'Location is required for storm detection'
            });
        }
        
        let inputWeatherData = weatherData;
        if (!inputWeatherData) {
            // Fetch current weather if not provided
            inputWeatherData = await weatherService.getCurrentWeather(location);
        }
        
        const stormEvents = await weatherService.detectStormEvents(inputWeatherData, location);
        
        res.json({
            success: true,
            data: stormEvents,
            detectedCount: stormEvents.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Storm detection API error:', error);
        res.status(500).json({
            success: false,
            error: 'Storm detection failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/weather/storms/severity:
 *   post:
 *     summary: Assess storm severity
 *     tags: [Weather]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stormData:
 *                 type: object
 *                 description: Storm event data
 *               location:
 *                 $ref: '#/components/schemas/WeatherLocation'
 *     responses:
 *       200:
 *         description: Storm severity assessment completed
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Severity assessment failed
 */
router.post('/storms/severity', auth, ensureWeatherService, async (req, res) => {
    try {
        const { stormData, location } = req.body;
        
        if (!stormData || !location) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters',
                message: 'Both stormData and location are required'
            });
        }
        
        const severityAssessment = await weatherService.assessStormSeverity(stormData, location);
        
        res.json({
            success: true,
            data: severityAssessment,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Storm severity API error:', error);
        res.status(500).json({
            success: false,
            error: 'Storm severity assessment failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/weather/correlation/damage:
 *   post:
 *     summary: Correlate damage with weather data
 *     tags: [Weather]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               claimData:
 *                 type: object
 *                 description: Insurance claim data
 *               weatherData:
 *                 type: object
 *                 description: Optional weather data
 *     responses:
 *       200:
 *         description: Damage correlation analysis completed
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Correlation analysis failed
 */
router.post('/correlation/damage', auth, ensureWeatherService, async (req, res) => {
    try {
        const { claimData, weatherData } = req.body;
        
        if (!claimData) {
            return res.status(400).json({
                success: false,
                error: 'Missing claim data',
                message: 'Claim data is required for correlation analysis'
            });
        }
        
        const correlation = await weatherService.correlateDamageWithWeather(claimData, weatherData);
        
        res.json({
            success: true,
            data: correlation,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Damage correlation API error:', error);
        res.status(500).json({
            success: false,
            error: 'Damage correlation analysis failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/weather/analysis/geographic:
 *   get:
 *     summary: Analyze geographic weather patterns
 *     tags: [Weather]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: address
 *         schema:
 *           type: string
 *         description: Center location address
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Center latitude
 *       - in: query
 *         name: lon
 *         schema:
 *           type: number
 *         description: Center longitude
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 50
 *         description: Analysis radius in miles
 *     responses:
 *       200:
 *         description: Geographic analysis completed
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Geographic analysis failed
 */
router.get('/analysis/geographic', auth, ensureWeatherService, async (req, res) => {
    try {
        const { address, lat, lon, radius = 50 } = req.query;
        
        // Validate location
        let location;
        if (address) {
            location = address;
        } else if (lat && lon) {
            location = { lat: parseFloat(lat), lon: parseFloat(lon) };
        } else {
            return res.status(400).json({
                success: false,
                error: 'Invalid location parameters',
                message: 'Provide either address or lat/lon coordinates'
            });
        }
        
        const radiusMiles = parseFloat(radius);
        if (isNaN(radiusMiles) || radiusMiles <= 0 || radiusMiles > 200) {
            return res.status(400).json({
                success: false,
                error: 'Invalid radius parameter',
                message: 'Radius must be between 1 and 200 miles'
            });
        }
        
        const analysis = await weatherService.analyzeGeographicWeatherPatterns(location, radiusMiles);
        
        res.json({
            success: true,
            data: analysis,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Geographic analysis API error:', error);
        res.status(500).json({
            success: false,
            error: 'Geographic analysis failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/weather/predictive/intelligence:
 *   get:
 *     summary: Generate predictive weather intelligence
 *     tags: [Weather]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: address
 *         schema:
 *           type: string
 *         description: Location address
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitude
 *       - in: query
 *         name: lon
 *         schema:
 *           type: number
 *         description: Longitude
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Forecast period in days
 *     responses:
 *       200:
 *         description: Predictive intelligence generated
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Predictive intelligence failed
 */
router.get('/predictive/intelligence', auth, ensureWeatherService, async (req, res) => {
    try {
        const { address, lat, lon, days = 7 } = req.query;
        
        // Validate location
        let location;
        if (address) {
            location = address;
        } else if (lat && lon) {
            location = { lat: parseFloat(lat), lon: parseFloat(lon) };
        } else {
            return res.status(400).json({
                success: false,
                error: 'Invalid location parameters',
                message: 'Provide either address or lat/lon coordinates'
            });
        }
        
        const forecastDays = parseInt(days);
        if (isNaN(forecastDays) || forecastDays < 1 || forecastDays > 14) {
            return res.status(400).json({
                success: false,
                error: 'Invalid days parameter',
                message: 'Days must be between 1 and 14'
            });
        }
        
        const intelligence = await weatherService.generatePredictiveWeatherIntelligence(location, forecastDays);
        
        res.json({
            success: true,
            data: intelligence,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Predictive intelligence API error:', error);
        res.status(500).json({
            success: false,
            error: 'Predictive intelligence generation failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/weather/alerts:
 *   get:
 *     summary: Get active weather alerts
 *     tags: [Weather]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: address
 *         schema:
 *           type: string
 *         description: Location address for filtering alerts
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [minor, moderate, severe, extreme]
 *         description: Filter by alert severity
 *     responses:
 *       200:
 *         description: Active alerts retrieved
 *       500:
 *         description: Failed to get alerts
 */
router.get('/alerts', auth, ensureWeatherService, async (req, res) => {
    try {
        const { address, severity } = req.query;
        
        let alerts;
        if (address) {
            alerts = weatherService.getActiveAlertsForLocation(address);
        } else {
            alerts = Array.from(weatherService.weatherAlerts.values())
                .filter(alert => alert.status === 'active');
        }
        
        // Filter by severity if specified
        if (severity) {
            alerts = alerts.filter(alert => alert.severity === severity);
        }
        
        res.json({
            success: true,
            data: alerts,
            count: alerts.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Weather alerts API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get weather alerts',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/weather/summary:
 *   get:
 *     summary: Get weather summary for location
 *     tags: [Weather]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: address
 *         schema:
 *           type: string
 *         description: Location address
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitude
 *       - in: query
 *         name: lon
 *         schema:
 *           type: number
 *         description: Longitude
 *     responses:
 *       200:
 *         description: Weather summary retrieved
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Failed to get weather summary
 */
router.get('/summary', auth, ensureWeatherService, async (req, res) => {
    try {
        const { address, lat, lon } = req.query;
        
        // Validate location
        let location;
        if (address) {
            location = address;
        } else if (lat && lon) {
            location = { lat: parseFloat(lat), lon: parseFloat(lon) };
        } else {
            return res.status(400).json({
                success: false,
                error: 'Invalid location parameters',
                message: 'Provide either address or lat/lon coordinates'
            });
        }
        
        const summary = await weatherService.getWeatherSummary(location);
        
        res.json({
            success: true,
            data: summary,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Weather summary API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get weather summary',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/weather/status:
 *   get:
 *     summary: Get weather service status and statistics
 *     tags: [Weather]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Weather service status retrieved
 *       503:
 *         description: Weather service not available
 */
router.get('/status', auth, ensureWeatherService, async (req, res) => {
    try {
        const status = {
            serviceStatus: 'active',
            lastUpdated: new Date().toISOString(),
            statistics: {
                activeStormEvents: weatherService.stormEvents.size,
                activeAlerts: Array.from(weatherService.weatherAlerts.values())
                    .filter(alert => alert.status === 'active').length,
                cachedWeatherData: weatherService.cache ? weatherService.cache.size : 0,
                correlationsMade: weatherService.damageCorrelations.size,
                monitoredRegions: weatherService.getMonitoredRegions().length
            },
            apiEndpoints: {
                current: '/api/weather/current',
                historical: '/api/weather/historical',
                forecast: '/api/weather/forecast',
                stormDetection: '/api/weather/storms/detect',
                severityAssessment: '/api/weather/storms/severity',
                damageCorrelation: '/api/weather/correlation/damage',
                geographicAnalysis: '/api/weather/analysis/geographic',
                predictiveIntelligence: '/api/weather/predictive/intelligence',
                alerts: '/api/weather/alerts',
                summary: '/api/weather/summary'
            }
        };
        
        res.json({
            success: true,
            data: status,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Weather status API error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get weather service status',
            message: error.message
        });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    const healthStatus = {
        status: weatherService ? 'healthy' : 'unavailable',
        service: 'Weather Data Integration Service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    };
    
    if (weatherService) {
        healthStatus.details = {
            activeStormEvents: weatherService.stormEvents.size,
            activeAlerts: Array.from(weatherService.weatherAlerts.values())
                .filter(alert => alert.status === 'active').length
        };
    }
    
    res.json(healthStatus);
});

// Error handling middleware for weather routes
router.use((error, req, res, next) => {
    logger.error('Weather API error:', error);
    
    if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
            success: false,
            error: error.message,
            statusCode: error.statusCode
        });
    }
    
    res.status(500).json({
        success: false,
        error: 'Internal weather service error',
        message: error.message
    });
});

export default router;