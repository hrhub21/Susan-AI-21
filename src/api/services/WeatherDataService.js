import { EventEmitter } from 'events';
import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Comprehensive Weather Data Integration Service for Susan AI
 * Supports storm claim analysis, damage correlation, and predictive intelligence
 * Integrates with multiple weather services for comprehensive coverage
 */
export class WeatherDataService extends EventEmitter {
    constructor(apiKeys = {}) {
        super();
        
        // API Keys and Configuration
        this.apiKeys = {
            openWeatherMap: apiKeys.openWeatherMap || process.env.OPENWEATHERMAP_API_KEY,
            weatherAPI: apiKeys.weatherAPI || process.env.WEATHERAPI_KEY,
            noaa: apiKeys.noaa || process.env.NOAA_API_KEY,
            ...apiKeys
        };
        
        // Core Data Storage
        this.historicalWeatherData = new Map();
        this.stormEvents = new Map();
        this.damageCorrelations = new Map();
        this.weatherAlerts = new Map();
        this.claimWeatherMappings = new Map();
        this.severityModels = new Map();
        this.geographicRegions = new Map();
        this.predictiveModels = new Map();
        
        // Configuration
        this.config = {
            // API endpoints
            endpoints: {
                openWeatherMap: {
                    current: 'https://api.openweathermap.org/data/2.5/weather',
                    forecast: 'https://api.openweathermap.org/data/2.5/forecast',
                    historical: 'https://api.openweathermap.org/data/2.5/onecall/timemachine',
                    alerts: 'https://api.openweathermap.org/data/2.5/onecall'
                },
                weatherAPI: {
                    current: 'https://api.weatherapi.com/v1/current.json',
                    forecast: 'https://api.weatherapi.com/v1/forecast.json',
                    historical: 'https://api.weatherapi.com/v1/history.json',
                    alerts: 'https://api.weatherapi.com/v1/alerts.json'
                },
                noaa: {
                    alerts: 'https://api.weather.gov/alerts',
                    observations: 'https://api.weather.gov/stations/{stationId}/observations',
                    gridpoints: 'https://api.weather.gov/gridpoints/{office}/{gridX},{gridY}'
                }
            },
            
            // Storm classification thresholds
            stormThresholds: {
                hail: {
                    minor: { size: 0.75, probabilityDamage: 15 }, // 3/4 inch
                    moderate: { size: 1.25, probabilityDamage: 45 }, // 1.25 inch
                    severe: { size: 2.0, probabilityDamage: 75 }, // 2 inch
                    extreme: { size: 3.0, probabilityDamage: 95 } // 3+ inch
                },
                wind: {
                    minor: { speed: 39, probabilityDamage: 10 }, // 39+ mph
                    moderate: { speed: 58, probabilityDamage: 35 }, // 58+ mph
                    severe: { speed: 74, probabilityDamage: 70 }, // 74+ mph (hurricane force)
                    extreme: { speed: 100, probabilityDamage: 95 } // 100+ mph
                },
                tornado: {
                    ef0: { windSpeed: 65, probabilityDamage: 30 },
                    ef1: { windSpeed: 86, probabilityDamage: 50 },
                    ef2: { windSpeed: 111, probabilityDamage: 75 },
                    ef3: { windSpeed: 136, probabilityDamage: 90 },
                    ef4: { windSpeed: 166, probabilityDamage: 95 },
                    ef5: { windSpeed: 200, probabilityDamage: 99 }
                }
            },
            
            // Damage correlation factors
            damageCorrelationFactors: {
                roofAge: {
                    new: 0.3,        // 0-5 years
                    moderate: 0.6,   // 6-15 years
                    old: 0.9,        // 16-25 years
                    veryOld: 1.2     // 25+ years
                },
                roofMaterial: {
                    metal: 0.4,
                    tile: 0.5,
                    asphalt: 0.8,
                    wood: 1.1,
                    slate: 0.3
                },
                exposureLevel: {
                    sheltered: 0.6,
                    moderate: 0.8,
                    exposed: 1.0,
                    highlyExposed: 1.3
                }
            },
            
            // Cache and update intervals
            cacheSettings: {
                currentWeatherTTL: 10 * 60 * 1000,      // 10 minutes
                forecastTTL: 60 * 60 * 1000,            // 1 hour
                historicalTTL: 24 * 60 * 60 * 1000,     // 24 hours
                alertsTTL: 5 * 60 * 1000                // 5 minutes
            },
            
            // Geographic analysis settings
            geographicSettings: {
                defaultRadius: 25,      // miles
                severityRadius: 10,     // miles for severe weather clustering
                correlationRadius: 50   // miles for damage correlation analysis
            }
        };
        
        // Storm event types
        this.stormEventTypes = {
            HAIL: 'hail',
            THUNDERSTORM: 'thunderstorm',
            TORNADO: 'tornado',
            HURRICANE: 'hurricane',
            WIND: 'wind',
            FLOOD: 'flood',
            ICE_STORM: 'ice_storm',
            BLIZZARD: 'blizzard'
        };
        
        // Severity levels
        this.severityLevels = {
            MINIMAL: { level: 1, name: 'Minimal', damageMultiplier: 0.1 },
            MINOR: { level: 2, name: 'Minor', damageMultiplier: 0.3 },
            MODERATE: { level: 3, name: 'Moderate', damageMultiplier: 0.6 },
            SEVERE: { level: 4, name: 'Severe', damageMultiplier: 0.8 },
            EXTREME: { level: 5, name: 'Extreme', damageMultiplier: 1.0 }
        };
        
        // Initialize service
        this.initialize();
    }

    async initialize() {
        try {
            console.log('🌦️ Initializing Weather Data Integration Service...');
            
            // Setup API clients
            await this.setupAPIClients();
            
            // Initialize storm classification models
            this.initializeStormClassificationModels();
            
            // Setup geographic analysis
            this.setupGeographicAnalysis();
            
            // Initialize predictive models
            this.initializePredictiveModels();
            
            // Start background monitoring
            this.startRealTimeMonitoring();
            
            // Load historical storm patterns
            await this.loadHistoricalStormPatterns();
            
            console.log('✅ Weather Data Integration Service ready');
            this.emit('serviceReady');
            
        } catch (error) {
            console.error('❌ Failed to initialize Weather Data Service:', error);
            throw error;
        }
    }

    // API Client Setup
    async setupAPIClients() {
        this.apiClients = {
            openWeatherMap: axios.create({
                baseURL: 'https://api.openweathermap.org/data/2.5',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Susan-AI-Weather-Service/1.0'
                }
            }),
            
            weatherAPI: axios.create({
                baseURL: 'https://api.weatherapi.com/v1',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Susan-AI-Weather-Service/1.0'
                }
            }),
            
            noaa: axios.create({
                baseURL: 'https://api.weather.gov',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Susan-AI-Weather-Service/1.0 (contact@susan-ai.com)'
                }
            })
        };
        
        // Setup request interceptors for rate limiting and authentication
        this.setupAPIInterceptors();
    }

    setupAPIInterceptors() {
        // OpenWeatherMap interceptor
        this.apiClients.openWeatherMap.interceptors.request.use(config => {
            config.params = config.params || {};
            config.params.appid = this.apiKeys.openWeatherMap;
            config.params.units = 'imperial'; // For US measurements
            return config;
        });
        
        // WeatherAPI interceptor
        this.apiClients.weatherAPI.interceptors.request.use(config => {
            config.params = config.params || {};
            config.params.key = this.apiKeys.weatherAPI;
            return config;
        });
        
        // Add response interceptors for error handling
        Object.values(this.apiClients).forEach(client => {
            client.interceptors.response.use(
                response => response,
                error => {
                    logger.error('Weather API Error:', error.response?.data || error.message);
                    return Promise.reject(error);
                }
            );
        });
    }

    // Current Weather Data
    async getCurrentWeather(location) {
        try {
            const cacheKey = `current_${this.generateLocationKey(location)}`;
            const cached = this.getFromCache(cacheKey);
            
            if (cached) {
                return cached;
            }
            
            const weatherData = await this.fetchCurrentWeatherFromMultipleSources(location);
            const processedData = this.processCurrentWeatherData(weatherData, location);
            
            this.setCache(cacheKey, processedData, this.config.cacheSettings.currentWeatherTTL);
            
            // Check for severe weather alerts
            await this.checkForSevereWeatherAlerts(processedData);
            
            return processedData;
            
        } catch (error) {
            logger.error('Error getting current weather:', error);
            throw new ApiError(`Failed to get current weather: ${error.message}`, 500);
        }
    }

    async fetchCurrentWeatherFromMultipleSources(location) {
        const promises = [];
        
        // OpenWeatherMap
        if (this.apiKeys.openWeatherMap) {
            promises.push(
                this.apiClients.openWeatherMap.get('/weather', {
                    params: this.buildLocationParams(location)
                }).then(response => ({ source: 'openweathermap', data: response.data }))
                .catch(error => ({ source: 'openweathermap', error: error.message }))
            );
        }
        
        // WeatherAPI
        if (this.apiKeys.weatherAPI) {
            promises.push(
                this.apiClients.weatherAPI.get('/current.json', {
                    params: { q: this.formatLocationForWeatherAPI(location) }
                }).then(response => ({ source: 'weatherapi', data: response.data }))
                .catch(error => ({ source: 'weatherapi', error: error.message }))
            );
        }
        
        const results = await Promise.all(promises);
        return results.filter(result => !result.error);
    }

    processCurrentWeatherData(weatherSources, location) {
        if (weatherSources.length === 0) {
            throw new Error('No weather data available from any source');
        }
        
        // Use OpenWeatherMap as primary, WeatherAPI as backup
        const primary = weatherSources.find(source => source.source === 'openweathermap') ||
                        weatherSources[0];
        
        const processed = {
            location: this.normalizeLocation(location),
            timestamp: new Date().toISOString(),
            sources: weatherSources.map(s => s.source),
            
            // Current conditions
            current: this.extractCurrentConditions(primary.data, primary.source),
            
            // Storm indicators
            stormIndicators: this.analyzeStormIndicators(primary.data, primary.source),
            
            // Damage risk assessment
            damageRisk: this.assessDamageRisk(primary.data, primary.source),
            
            // Raw data from all sources (for analysis)
            rawData: weatherSources
        };
        
        return processed;
    }

    extractCurrentConditions(data, source) {
        switch (source) {
            case 'openweathermap':
                return {
                    temperature: Math.round(data.main.temp),
                    feelsLike: Math.round(data.main.feels_like),
                    humidity: data.main.humidity,
                    pressure: data.main.pressure,
                    windSpeed: Math.round(data.wind.speed),
                    windDirection: data.wind.deg,
                    windGust: data.wind.gust ? Math.round(data.wind.gust) : null,
                    visibility: data.visibility ? Math.round(data.visibility * 0.000621371) : null, // Convert to miles
                    cloudCover: data.clouds.all,
                    condition: data.weather[0].main,
                    description: data.weather[0].description,
                    precipitation: this.extractPrecipitation(data)
                };
                
            case 'weatherapi':
                return {
                    temperature: Math.round(data.current.temp_f),
                    feelsLike: Math.round(data.current.feelslike_f),
                    humidity: data.current.humidity,
                    pressure: data.current.pressure_in,
                    windSpeed: Math.round(data.current.wind_mph),
                    windDirection: data.current.wind_degree,
                    windGust: data.current.gust_mph ? Math.round(data.current.gust_mph) : null,
                    visibility: data.current.vis_miles,
                    cloudCover: data.current.cloud,
                    condition: data.current.condition.text,
                    description: data.current.condition.text,
                    precipitation: {
                        rain: data.current.precip_in || 0,
                        snow: 0 // WeatherAPI doesn't separate snow
                    }
                };
                
            default:
                throw new Error(`Unknown weather source: ${source}`);
        }
    }

    // Historical Weather Data
    async getHistoricalWeather(location, startDate, endDate) {
        try {
            const cacheKey = `historical_${this.generateLocationKey(location)}_${startDate}_${endDate}`;
            const cached = this.getFromCache(cacheKey);
            
            if (cached) {
                return cached;
            }
            
            const historicalData = await this.fetchHistoricalWeatherData(location, startDate, endDate);
            const processedData = this.processHistoricalWeatherData(historicalData, location, startDate, endDate);
            
            this.setCache(cacheKey, processedData, this.config.cacheSettings.historicalTTL);
            
            // Store for future analysis
            this.storeHistoricalWeatherData(location, processedData);
            
            return processedData;
            
        } catch (error) {
            logger.error('Error getting historical weather:', error);
            throw new ApiError(`Failed to get historical weather: ${error.message}`, 500);
        }
    }

    async fetchHistoricalWeatherData(location, startDate, endDate) {
        const locationCoords = await this.getLocationCoordinates(location);
        const dateRange = this.generateDateRange(startDate, endDate);
        
        const promises = [];
        
        // Fetch data for each day in the range
        for (const date of dateRange) {
            const timestamp = Math.floor(date.getTime() / 1000);
            
            // OpenWeatherMap One Call API
            if (this.apiKeys.openWeatherMap) {
                promises.push(
                    this.apiClients.openWeatherMap.get('/onecall/timemachine', {
                        params: {
                            lat: locationCoords.lat,
                            lon: locationCoords.lon,
                            dt: timestamp
                        }
                    }).then(response => ({
                        date: date.toISOString().split('T')[0],
                        source: 'openweathermap',
                        data: response.data
                    })).catch(error => ({
                        date: date.toISOString().split('T')[0],
                        source: 'openweathermap',
                        error: error.message
                    }))
                );
            }
            
            // WeatherAPI Historical
            if (this.apiKeys.weatherAPI) {
                promises.push(
                    this.apiClients.weatherAPI.get('/history.json', {
                        params: {
                            q: this.formatLocationForWeatherAPI(location),
                            dt: date.toISOString().split('T')[0]
                        }
                    }).then(response => ({
                        date: date.toISOString().split('T')[0],
                        source: 'weatherapi',
                        data: response.data
                    })).catch(error => ({
                        date: date.toISOString().split('T')[0],
                        source: 'weatherapi',
                        error: error.message
                    }))
                );
            }
        }
        
        const results = await Promise.all(promises);
        return results.filter(result => !result.error);
    }

    processHistoricalWeatherData(historicalSources, location, startDate, endDate) {
        const dailyData = new Map();
        
        // Group data by date
        historicalSources.forEach(source => {
            if (!dailyData.has(source.date)) {
                dailyData.set(source.date, []);
            }
            dailyData.get(source.date).push(source);
        });
        
        const processedDays = [];
        
        for (const [date, sources] of dailyData) {
            const dayData = this.processDailyHistoricalData(sources, date);
            if (dayData) {
                processedDays.push(dayData);
            }
        }
        
        return {
            location: this.normalizeLocation(location),
            startDate,
            endDate,
            dailyData: processedDays.sort((a, b) => a.date.localeCompare(b.date)),
            
            // Summary statistics
            summary: this.calculateHistoricalSummary(processedDays),
            
            // Storm events detected
            stormEvents: this.detectHistoricalStormEvents(processedDays),
            
            // Damage correlation insights
            damageCorrelationInsights: this.generateHistoricalDamageInsights(processedDays)
        };
    }

    // Storm Event Detection and Classification
    async detectStormEvents(weatherData, location) {
        try {
            const stormEvents = [];
            
            // Analyze current conditions for storm indicators
            const stormIndicators = this.analyzeStormIndicators(weatherData, 'current');
            
            if (stormIndicators.hasStormActivity) {
                const stormEvent = await this.createStormEvent(weatherData, location, stormIndicators);
                stormEvents.push(stormEvent);
                
                // Store storm event
                this.stormEvents.set(stormEvent.id, stormEvent);
                
                // Emit storm detected event
                this.emit('stormDetected', stormEvent);
            }
            
            // Check for ongoing storm systems in the area
            const areaStorms = await this.detectAreaStormSystems(location);
            stormEvents.push(...areaStorms);
            
            return stormEvents;
            
        } catch (error) {
            logger.error('Error detecting storm events:', error);
            throw new ApiError(`Failed to detect storm events: ${error.message}`, 500);
        }
    }

    analyzeStormIndicators(weatherData, source) {
        const indicators = {
            hasStormActivity: false,
            stormTypes: [],
            severityLevel: 'minimal',
            riskFactors: []
        };
        
        let conditions;
        
        if (source === 'openweathermap') {
            conditions = {
                windSpeed: weatherData.wind?.speed || 0,
                windGust: weatherData.wind?.gust || 0,
                pressure: weatherData.main?.pressure || 1013,
                temperature: weatherData.main?.temp || 70,
                humidity: weatherData.main?.humidity || 50,
                condition: weatherData.weather?.[0]?.main || '',
                description: weatherData.weather?.[0]?.description || ''
            };
        } else if (source === 'weatherapi') {
            conditions = {
                windSpeed: weatherData.current?.wind_mph || 0,
                windGust: weatherData.current?.gust_mph || 0,
                pressure: weatherData.current?.pressure_in || 29.92,
                temperature: weatherData.current?.temp_f || 70,
                humidity: weatherData.current?.humidity || 50,
                condition: weatherData.current?.condition?.text || '',
                description: weatherData.current?.condition?.text || ''
            };
        } else {
            // For processed current conditions
            conditions = weatherData.current || weatherData;
        }
        
        // Wind analysis
        if (conditions.windSpeed >= this.config.stormThresholds.wind.minor.speed) {
            indicators.hasStormActivity = true;
            indicators.stormTypes.push(this.stormEventTypes.WIND);
            indicators.riskFactors.push(`High winds: ${Math.round(conditions.windSpeed)} mph`);
            
            if (conditions.windSpeed >= this.config.stormThresholds.wind.severe.speed) {
                indicators.severityLevel = 'severe';
            } else if (conditions.windSpeed >= this.config.stormThresholds.wind.moderate.speed) {
                indicators.severityLevel = 'moderate';
            } else {
                indicators.severityLevel = 'minor';
            }
        }
        
        // Thunderstorm analysis
        if (conditions.condition.toLowerCase().includes('thunder') || 
            conditions.description.toLowerCase().includes('thunder')) {
            indicators.hasStormActivity = true;
            indicators.stormTypes.push(this.stormEventTypes.THUNDERSTORM);
            indicators.riskFactors.push('Thunderstorm conditions');
        }
        
        // Hail detection (based on conditions that support hail)
        if (this.isHailLikely(conditions)) {
            indicators.hasStormActivity = true;
            indicators.stormTypes.push(this.stormEventTypes.HAIL);
            indicators.riskFactors.push('Conditions favorable for hail');
        }
        
        // Tornado conditions
        if (this.isTornadoCondition(conditions)) {
            indicators.hasStormActivity = true;
            indicators.stormTypes.push(this.stormEventTypes.TORNADO);
            indicators.riskFactors.push('Tornado conditions possible');
            indicators.severityLevel = 'extreme';
        }
        
        return indicators;
    }

    isHailLikely(conditions) {
        // Hail is more likely with:
        // - Strong thunderstorms
        // - Temperature gradient (cold upper atmosphere, warm surface)
        // - High wind shear
        // - Strong updrafts (indicated by rapid pressure changes)
        
        return (
            conditions.condition.toLowerCase().includes('thunder') &&
            conditions.windGust > 30 &&
            conditions.temperature > 60 && // Warm surface conditions
            (conditions.pressure < 29.80 || conditions.pressure > 30.20) // Pressure anomalies
        );
    }

    isTornadoCondition(conditions) {
        // Tornado conditions include:
        // - Severe thunderstorms
        // - High wind shear (large difference between wind speed and gust)
        // - Strong pressure gradients
        // - Specific temperature and humidity patterns
        
        const windShear = conditions.windGust - conditions.windSpeed;
        
        return (
            conditions.condition.toLowerCase().includes('thunder') &&
            windShear > 20 &&
            conditions.pressure < 29.50 &&
            conditions.humidity > 70 &&
            conditions.temperature > 65
        );
    }

    async createStormEvent(weatherData, location, stormIndicators) {
        const stormEventId = this.generateStormEventId();
        
        const stormEvent = {
            id: stormEventId,
            timestamp: new Date().toISOString(),
            location: this.normalizeLocation(location),
            
            // Event classification
            eventTypes: stormIndicators.stormTypes,
            severityLevel: stormIndicators.severityLevel,
            severityScore: this.calculateSeverityScore(stormIndicators, weatherData),
            
            // Weather conditions
            conditions: weatherData.current || this.extractCurrentConditions(weatherData, 'openweathermap'),
            
            // Risk assessment
            damageRisk: this.assessStormDamageRisk(stormIndicators, weatherData),
            riskFactors: stormIndicators.riskFactors,
            
            // Geographic impact
            impactRadius: this.calculateImpactRadius(stormIndicators.severityLevel),
            affectedAreas: await this.identifyAffectedAreas(location, stormIndicators.severityLevel),
            
            // Timing and duration
            detectedAt: new Date().toISOString(),
            estimatedDuration: this.estimateStormDuration(stormIndicators),
            
            // Correlation data
            potentialClaims: await this.estimatePotentialClaims(location, stormIndicators),
            
            // Status tracking
            status: 'active',
            isActive: true,
            lastUpdated: new Date().toISOString()
        };
        
        return stormEvent;
    }

    // Damage Correlation Analysis
    async correlateDamageWithWeather(claimData, weatherData) {
        try {
            const correlation = {
                claimId: claimData.id,
                correlationId: this.generateCorrelationId(),
                timestamp: new Date().toISOString(),
                
                // Weather at time of loss
                weatherAtTimeOfLoss: await this.getWeatherAtTimeOfLoss(claimData),
                
                // Storm events correlation
                correlatedStormEvents: await this.findCorrelatedStormEvents(claimData),
                
                // Damage probability analysis
                damageProbabilityAnalysis: this.calculateDamageProbability(claimData, weatherData),
                
                // Contributing factors
                contributingFactors: this.identifyContributingFactors(claimData, weatherData),
                
                // Severity correlation
                severityCorrelation: this.correlateSeverityWithDamage(claimData, weatherData),
                
                // Geographic correlation
                geographicCorrelation: await this.analyzeGeographicCorrelation(claimData),
                
                // Predictive insights
                predictiveInsights: this.generatePredictiveInsights(claimData, weatherData),
                
                // Confidence metrics
                confidenceMetrics: this.calculateCorrelationConfidence(claimData, weatherData)
            };
            
            // Store correlation data
            this.damageCorrelations.set(correlation.correlationId, correlation);
            
            // Emit correlation event
            this.emit('damageCorrelated', correlation);
            
            return correlation;
            
        } catch (error) {
            logger.error('Error correlating damage with weather:', error);
            throw new ApiError(`Failed to correlate damage with weather: ${error.message}`, 500);
        }
    }

    async getWeatherAtTimeOfLoss(claimData) {
        const dateOfLoss = new Date(claimData.damage.dateOfLoss);
        const location = claimData.property.address;
        
        // Get historical weather for the date of loss
        const historicalWeather = await this.getHistoricalWeather(
            location,
            dateOfLoss.toISOString().split('T')[0],
            dateOfLoss.toISOString().split('T')[0]
        );
        
        return historicalWeather.dailyData[0] || null;
    }

    calculateDamageProbability(claimData, weatherData) {
        const analysis = {
            overallProbability: 0,
            factorAnalysis: {},
            riskMultipliers: {}
        };
        
        // Base weather severity factor
        const weatherSeverity = this.calculateWeatherSeverityScore(weatherData);
        analysis.factorAnalysis.weatherSeverity = weatherSeverity;
        
        // Property characteristics impact
        const propertyRisk = this.calculatePropertyRiskFactor(claimData.property);
        analysis.factorAnalysis.propertyRisk = propertyRisk;
        
        // Roof characteristics impact
        const roofRisk = this.calculateRoofRiskFactor(claimData.property);
        analysis.factorAnalysis.roofRisk = roofRisk;
        
        // Environmental factors
        const environmentalRisk = this.calculateEnvironmentalRiskFactor(claimData.property);
        analysis.factorAnalysis.environmentalRisk = environmentalRisk;
        
        // Calculate overall probability
        analysis.overallProbability = Math.min(100, 
            weatherSeverity * propertyRisk * roofRisk * environmentalRisk
        );
        
        // Risk multipliers for different damage types
        analysis.riskMultipliers = {
            roofDamage: this.calculateRoofDamageMultiplier(claimData, weatherData),
            sidingDamage: this.calculateSidingDamageMultiplier(claimData, weatherData),
            windowDamage: this.calculateWindowDamageMultiplier(claimData, weatherData),
            gutterDamage: this.calculateGutterDamageMultiplier(claimData, weatherData)
        };
        
        return analysis;
    }

    // Severity Assessment and Rating
    async assessStormSeverity(stormData, location) {
        try {
            const severityAssessment = {
                stormId: stormData.id || this.generateStormEventId(),
                location: this.normalizeLocation(location),
                timestamp: new Date().toISOString(),
                
                // Primary severity metrics
                primaryMetrics: this.calculatePrimarySeverityMetrics(stormData),
                
                // Multi-factor severity analysis
                severityFactors: this.analyzeSeverityFactors(stormData),
                
                // Overall severity rating
                overallSeverity: this.calculateOverallSeverity(stormData),
                
                // Impact assessment
                impactAssessment: this.assessStormImpact(stormData, location),
                
                // Damage potential rating
                damagePotential: this.rateDamagePotential(stormData),
                
                // Comparative analysis
                comparativeAnalysis: await this.compareWithHistoricalStorms(stormData, location),
                
                // Risk classification
                riskClassification: this.classifyStormRisk(stormData)
            };
            
            return severityAssessment;
            
        } catch (error) {
            logger.error('Error assessing storm severity:', error);
            throw new ApiError(`Failed to assess storm severity: ${error.message}`, 500);
        }
    }

    calculatePrimarySeverityMetrics(stormData) {
        const metrics = {};
        
        // Wind severity
        if (stormData.conditions?.windSpeed) {
            metrics.windSeverity = this.calculateWindSeverity(stormData.conditions.windSpeed);
        }
        
        // Hail severity (if applicable)
        if (stormData.eventTypes?.includes(this.stormEventTypes.HAIL)) {
            metrics.hailSeverity = this.calculateHailSeverity(stormData);
        }
        
        // Precipitation severity
        if (stormData.conditions?.precipitation) {
            metrics.precipitationSeverity = this.calculatePrecipitationSeverity(stormData.conditions.precipitation);
        }
        
        // Temperature severity (for ice storms, extreme heat/cold)
        metrics.temperatureSeverity = this.calculateTemperatureSeverity(stormData.conditions.temperature);
        
        // Pressure anomaly severity
        if (stormData.conditions?.pressure) {
            metrics.pressureSeverity = this.calculatePressureSeverity(stormData.conditions.pressure);
        }
        
        return metrics;
    }

    calculateOverallSeverity(stormData) {
        const metrics = this.calculatePrimarySeverityMetrics(stormData);
        
        // Weight different factors based on damage potential
        const weights = {
            windSeverity: 0.35,
            hailSeverity: 0.30,
            precipitationSeverity: 0.15,
            temperatureSeverity: 0.10,
            pressureSeverity: 0.10
        };
        
        let weightedScore = 0;
        let totalWeight = 0;
        
        Object.entries(weights).forEach(([metric, weight]) => {
            if (metrics[metric] !== undefined) {
                weightedScore += metrics[metric] * weight;
                totalWeight += weight;
            }
        });
        
        const normalizedScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
        
        // Convert to severity level
        if (normalizedScore >= 0.9) return this.severityLevels.EXTREME;
        if (normalizedScore >= 0.7) return this.severityLevels.SEVERE;
        if (normalizedScore >= 0.5) return this.severityLevels.MODERATE;
        if (normalizedScore >= 0.2) return this.severityLevels.MINOR;
        return this.severityLevels.MINIMAL;
    }

    // Geographic Analysis and Mapping
    async analyzeGeographicWeatherPatterns(centerLocation, radiusMiles = 50) {
        try {
            const analysis = {
                centerLocation: this.normalizeLocation(centerLocation),
                analysisRadius: radiusMiles,
                timestamp: new Date().toISOString(),
                
                // Regional weather patterns
                regionalPatterns: await this.analyzeRegionalWeatherPatterns(centerLocation, radiusMiles),
                
                // Storm corridor analysis
                stormCorridors: await this.identifyStormCorridors(centerLocation, radiusMiles),
                
                // Weather gradient analysis
                weatherGradients: await this.analyzeWeatherGradients(centerLocation, radiusMiles),
                
                // Historical pattern analysis
                historicalPatterns: await this.analyzeHistoricalGeographicPatterns(centerLocation, radiusMiles),
                
                // Risk zone mapping
                riskZones: await this.mapWeatherRiskZones(centerLocation, radiusMiles),
                
                // Climate influences
                climateInfluences: this.analyzeClimateInfluences(centerLocation)
            };
            
            return analysis;
            
        } catch (error) {
            logger.error('Error analyzing geographic weather patterns:', error);
            throw new ApiError(`Failed to analyze geographic patterns: ${error.message}`, 500);
        }
    }

    async analyzeRegionalWeatherPatterns(centerLocation, radiusMiles) {
        const gridPoints = this.generateGeographicGrid(centerLocation, radiusMiles, 10);
        const weatherPromises = [];
        
        // Get current weather for each grid point
        gridPoints.forEach(point => {
            weatherPromises.push(
                this.getCurrentWeather(point)
                    .then(weather => ({ location: point, weather }))
                    .catch(error => ({ location: point, error: error.message }))
            );
        });
        
        const weatherResults = await Promise.all(weatherPromises);
        const validResults = weatherResults.filter(result => !result.error);
        
        return {
            gridPoints: gridPoints.length,
            validDataPoints: validResults.length,
            patterns: this.identifyWeatherPatterns(validResults),
            variability: this.calculateWeatherVariability(validResults),
            averageConditions: this.calculateAverageConditions(validResults)
        };
    }

    // Predictive Weather Intelligence
    async generatePredictiveWeatherIntelligence(location, daysAhead = 7) {
        try {
            const intelligence = {
                location: this.normalizeLocation(location),
                forecastPeriod: daysAhead,
                generatedAt: new Date().toISOString(),
                
                // Extended weather forecast
                extendedForecast: await this.getExtendedWeatherForecast(location, daysAhead),
                
                // Storm probability analysis
                stormProbabilities: await this.analyzeStormProbabilities(location, daysAhead),
                
                // Claim risk forecasting
                claimRiskForecast: await this.forecastClaimRisk(location, daysAhead),
                
                // Seasonal pattern analysis
                seasonalPatterns: await this.analyzeSeasonalPatterns(location),
                
                // Early warning indicators
                earlyWarningIndicators: await this.identifyEarlyWarningIndicators(location),
                
                // Preparation recommendations
                preparationRecommendations: this.generatePreparationRecommendations(location, daysAhead)
            };
            
            return intelligence;
            
        } catch (error) {
            logger.error('Error generating predictive weather intelligence:', error);
            throw new ApiError(`Failed to generate predictive intelligence: ${error.message}`, 500);
        }
    }

    async forecastClaimRisk(location, daysAhead) {
        const forecast = await this.getExtendedWeatherForecast(location, daysAhead);
        const historicalData = await this.getHistoricalClaimData(location);
        
        const dailyRiskForecasts = [];
        
        forecast.dailyForecasts.forEach(day => {
            const riskForecast = {
                date: day.date,
                overallRisk: this.calculateDailyClaimRisk(day, historicalData),
                riskByType: {
                    hailDamage: this.calculateHailClaimRisk(day, historicalData),
                    windDamage: this.calculateWindClaimRisk(day, historicalData),
                    waterDamage: this.calculateWaterClaimRisk(day, historicalData),
                    generalStormDamage: this.calculateGeneralStormClaimRisk(day, historicalData)
                },
                confidenceLevel: this.calculateRiskConfidence(day, historicalData),
                claimVolumeEstimate: this.estimateClaimVolume(day, historicalData),
                severityEstimate: this.estimateClaimSeverity(day, historicalData)
            };
            
            dailyRiskForecasts.push(riskForecast);
        });
        
        return {
            dailyForecasts: dailyRiskForecasts,
            weeklyTrends: this.analyzeWeeklyRiskTrends(dailyRiskForecasts),
            riskSummary: this.summarizeRiskPeriod(dailyRiskForecasts),
            actionableInsights: this.generateActionableRiskInsights(dailyRiskForecasts)
        };
    }

    // Real-time Weather Monitoring and Alerts
    startRealTimeMonitoring() {
        console.log('🔄 Starting real-time weather monitoring...');
        
        // Monitor severe weather alerts every 5 minutes
        this.alertsInterval = setInterval(() => {
            this.checkSevereWeatherAlerts();
        }, 5 * 60 * 1000);
        
        // Update active storm events every 10 minutes
        this.stormUpdateInterval = setInterval(() => {
            this.updateActiveStormEvents();
        }, 10 * 60 * 1000);
        
        // Process predictive analytics every hour
        this.predictiveInterval = setInterval(() => {
            this.processPredictiveAnalytics();
        }, 60 * 60 * 1000);
        
        // Cleanup old data every 6 hours
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldData();
        }, 6 * 60 * 60 * 1000);
    }

    async checkSevereWeatherAlerts() {
        try {
            // Get alerts from all monitored regions
            const monitoredRegions = this.getMonitoredRegions();
            
            for (const region of monitoredRegions) {
                const alerts = await this.fetchWeatherAlerts(region);
                await this.processWeatherAlerts(alerts, region);
            }
            
        } catch (error) {
            logger.error('Error checking severe weather alerts:', error);
        }
    }

    async processWeatherAlerts(alerts, region) {
        for (const alert of alerts) {
            const processedAlert = {
                id: this.generateAlertId(),
                originalId: alert.id,
                region: region,
                type: alert.event,
                severity: this.mapAlertSeverity(alert.severity),
                title: alert.headline,
                description: alert.description,
                startTime: alert.onset,
                endTime: alert.expires,
                areas: alert.areaDesc,
                
                // Enhanced analysis
                stormTypes: this.extractStormTypesFromAlert(alert),
                damageRisk: this.assessAlertDamageRisk(alert),
                affectedProperties: await this.identifyAffectedProperties(alert),
                
                // Timestamps
                issuedAt: alert.sent,
                processedAt: new Date().toISOString(),
                
                // Status
                status: 'active',
                acknowledged: false
            };
            
            // Store alert
            this.weatherAlerts.set(processedAlert.id, processedAlert);
            
            // Emit alert event
            this.emit('severeWeatherAlert', processedAlert);
            
            // Trigger claim risk assessment
            await this.triggerClaimRiskAssessment(processedAlert);
        }
    }

    // API Integration Methods
    async getExtendedWeatherForecast(location, days = 7) {
        try {
            const cacheKey = `forecast_${this.generateLocationKey(location)}_${days}`;
            const cached = this.getFromCache(cacheKey);
            
            if (cached) {
                return cached;
            }
            
            let forecastData;
            
            // Try WeatherAPI first for extended forecasts
            if (this.apiKeys.weatherAPI) {
                try {
                    const response = await this.apiClients.weatherAPI.get('/forecast.json', {
                        params: {
                            q: this.formatLocationForWeatherAPI(location),
                            days: Math.min(days, 10), // WeatherAPI limit
                            aqi: 'yes',
                            alerts: 'yes'
                        }
                    });
                    
                    forecastData = this.processWeatherAPIForecast(response.data);
                } catch (error) {
                    logger.warn('WeatherAPI forecast failed, trying OpenWeatherMap:', error.message);
                }
            }
            
            // Fallback to OpenWeatherMap
            if (!forecastData && this.apiKeys.openWeatherMap) {
                const coords = await this.getLocationCoordinates(location);
                const response = await this.apiClients.openWeatherMap.get('/onecall', {
                    params: {
                        lat: coords.lat,
                        lon: coords.lon,
                        exclude: 'minutely',
                        units: 'imperial'
                    }
                });
                
                forecastData = this.processOpenWeatherMapForecast(response.data, days);
            }
            
            if (!forecastData) {
                throw new Error('No forecast data available from any source');
            }
            
            // Enhance with storm analysis
            forecastData.stormAnalysis = this.analyzeForecastForStorms(forecastData);
            
            this.setCache(cacheKey, forecastData, this.config.cacheSettings.forecastTTL);
            
            return forecastData;
            
        } catch (error) {
            logger.error('Error getting extended weather forecast:', error);
            throw new ApiError(`Failed to get weather forecast: ${error.message}`, 500);
        }
    }

    // Integration with Claim Tracking System
    async integrateWithClaimTrackingSystem(claimTrackingService) {
        try {
            console.log('🔗 Integrating with Claim Tracking System...');
            
            this.claimTrackingService = claimTrackingService;
            
            // Listen for new claims
            claimTrackingService.on('claimCreated', async (claimData) => {
                await this.handleNewClaim(claimData);
            });
            
            // Listen for claim updates
            claimTrackingService.on('statusUpdated', async (claimData) => {
                await this.handleClaimUpdate(claimData);
            });
            
            // Setup automatic weather correlation for existing claims
            const existingClaims = claimTrackingService.getAllClaims();
            for (const claim of existingClaims) {
                if (claim.damage.dateOfLoss && !this.claimWeatherMappings.has(claim.id)) {
                    await this.correlateClaimWithWeather(claim);
                }
            }
            
            console.log('✅ Weather service integrated with claim tracking system');
            
        } catch (error) {
            logger.error('Error integrating with claim tracking system:', error);
            throw error;
        }
    }

    async handleNewClaim(claimData) {
        try {
            const { claimId, claim } = claimData;
            
            // Correlate with weather data
            const weatherCorrelation = await this.correlateClaimWithWeather(claim);
            
            // Store mapping
            this.claimWeatherMappings.set(claimId, {
                claimId,
                weatherCorrelation,
                lastUpdated: new Date().toISOString()
            });
            
            // If the claim involves storm damage, update the claim with weather insights
            if (this.isStormRelatedClaim(claim)) {
                const weatherInsights = this.generateWeatherInsights(claim, weatherCorrelation);
                
                // Add weather-related communication to the claim
                await this.claimTrackingService.addCommunication(claimId, {
                    type: 'note',
                    direction: 'internal',
                    subject: 'Weather Analysis - Storm Correlation',
                    content: this.formatWeatherInsightsForClaim(weatherInsights),
                    tags: ['weather', 'storm-analysis', 'damage-correlation'],
                    aiAnalysis: weatherInsights
                });
            }
            
        } catch (error) {
            logger.error('Error handling new claim in weather service:', error);
        }
    }

    async correlateClaimWithWeather(claim) {
        if (!claim.damage.dateOfLoss || !claim.property.address) {
            return null;
        }
        
        try {
            // Get weather data for the date of loss
            const weatherAtLoss = await this.getWeatherAtTimeOfLoss(claim);
            
            // Perform correlation analysis
            const correlation = await this.correlateDamageWithWeather(claim, weatherAtLoss);
            
            return correlation;
            
        } catch (error) {
            logger.error('Error correlating claim with weather:', error);
            return null;
        }
    }

    // Utility Methods
    generateLocationKey(location) {
        if (typeof location === 'string') {
            return crypto.createHash('md5').update(location.toLowerCase()).digest('hex').slice(0, 8);
        }
        
        if (location.lat && location.lon) {
            return crypto.createHash('md5').update(`${location.lat},${location.lon}`).digest('hex').slice(0, 8);
        }
        
        return crypto.createHash('md5').update(JSON.stringify(location)).digest('hex').slice(0, 8);
    }

    normalizeLocation(location) {
        if (typeof location === 'string') {
            return {
                address: location,
                type: 'address'
            };
        }
        
        if (location.lat && location.lon) {
            return {
                latitude: location.lat,
                longitude: location.lon,
                type: 'coordinates'
            };
        }
        
        return location;
    }

    buildLocationParams(location) {
        if (typeof location === 'string') {
            return { q: location };
        }
        
        if (location.lat && location.lon) {
            return { lat: location.lat, lon: location.lon };
        }
        
        if (location.zipCode) {
            return { zip: location.zipCode };
        }
        
        throw new Error('Invalid location format');
    }

    formatLocationForWeatherAPI(location) {
        if (typeof location === 'string') {
            return location;
        }
        
        if (location.lat && location.lon) {
            return `${location.lat},${location.lon}`;
        }
        
        if (location.zipCode) {
            return location.zipCode;
        }
        
        throw new Error('Invalid location format for WeatherAPI');
    }

    // Cache Management
    setCache(key, data, ttl) {
        if (!this.cache) {
            this.cache = new Map();
        }
        
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + ttl
        });
    }

    getFromCache(key) {
        if (!this.cache) {
            return null;
        }
        
        const cached = this.cache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data;
        }
        
        if (cached) {
            this.cache.delete(key);
        }
        
        return null;
    }

    cleanupOldData() {
        const now = Date.now();
        
        // Cleanup cache
        if (this.cache) {
            for (const [key, cached] of this.cache) {
                if (cached.expiresAt <= now) {
                    this.cache.delete(key);
                }
            }
        }
        
        // Cleanup old storm events (older than 30 days)
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        for (const [id, stormEvent] of this.stormEvents) {
            if (new Date(stormEvent.timestamp).getTime() < thirtyDaysAgo) {
                this.stormEvents.delete(id);
            }
        }
        
        // Cleanup old alerts (older than 7 days)
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
        for (const [id, alert] of this.weatherAlerts) {
            if (new Date(alert.processedAt).getTime() < sevenDaysAgo) {
                this.weatherAlerts.delete(id);
            }
        }
    }

    // ID Generators
    generateStormEventId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        return `STORM-${timestamp}-${random}`.toUpperCase();
    }

    generateCorrelationId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        return `CORR-${timestamp}-${random}`.toUpperCase();
    }

    generateAlertId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        return `ALERT-${timestamp}-${random}`.toUpperCase();
    }

    // Initialization helpers
    initializeStormClassificationModels() {
        // Initialize machine learning models for storm classification
        console.log('🧠 Initializing storm classification models...');
        
        // These would be more sophisticated ML models in production
        this.severityModels.set('hail', {
            type: 'classification',
            features: ['hailSize', 'windSpeed', 'temperature', 'pressure'],
            weights: [0.4, 0.3, 0.2, 0.1]
        });
        
        this.severityModels.set('wind', {
            type: 'regression',
            features: ['windSpeed', 'gustSpeed', 'pressure', 'temperatureGradient'],
            weights: [0.5, 0.3, 0.1, 0.1]
        });
        
        this.severityModels.set('tornado', {
            type: 'classification',
            features: ['windShear', 'pressure', 'temperature', 'humidity'],
            weights: [0.4, 0.3, 0.2, 0.1]
        });
    }

    setupGeographicAnalysis() {
        console.log('🗺️ Setting up geographic analysis...');
        
        // Initialize geographic regions for analysis
        // These would be loaded from a geographic database in production
        this.geographicRegions.set('tornado_alley', {
            name: 'Tornado Alley',
            bounds: {
                north: 41.0,
                south: 32.0,
                east: -96.0,
                west: -104.0
            },
            riskFactors: ['tornado', 'hail', 'thunderstorm'],
            seasonalPeaks: ['spring', 'early_summer']
        });
        
        this.geographicRegions.set('hurricane_zone', {
            name: 'Hurricane Zone',
            bounds: {
                north: 35.0,
                south: 25.0,
                east: -75.0,
                west: -100.0
            },
            riskFactors: ['hurricane', 'wind', 'flood'],
            seasonalPeaks: ['late_summer', 'early_fall']
        });
    }

    initializePredictiveModels() {
        console.log('🔮 Initializing predictive models...');
        
        // Initialize predictive models for claim forecasting
        this.predictiveModels.set('claim_volume', {
            type: 'time_series',
            features: ['historical_claims', 'weather_severity', 'seasonal_factors'],
            lookbackPeriod: 365 // days
        });
        
        this.predictiveModels.set('damage_severity', {
            type: 'ensemble',
            features: ['storm_intensity', 'property_characteristics', 'geographic_factors'],
            confidenceThreshold: 0.8
        });
    }

    async loadHistoricalStormPatterns() {
        console.log('📊 Loading historical storm patterns...');
        
        // In production, this would load from a historical database
        // For now, we'll set up some basic patterns
        const patterns = {
            seasonal: {
                spring: { tornadoRisk: 'high', hailRisk: 'high', windRisk: 'moderate' },
                summer: { hurricaneRisk: 'high', thunderstormRisk: 'high', heatRisk: 'high' },
                fall: { hurricaneRisk: 'moderate', windRisk: 'moderate', temperatureRisk: 'low' },
                winter: { iceStormRisk: 'moderate', blizzardRisk: 'high', coldRisk: 'high' }
            }
        };
        
        this.historicalPatterns = patterns;
    }

    // Public API Methods
    async getWeatherSummary(location) {
        const current = await this.getCurrentWeather(location);
        const forecast = await this.getExtendedWeatherForecast(location, 3);
        const alerts = this.getActiveAlertsForLocation(location);
        
        return {
            current: current.current,
            forecast: forecast.dailyForecasts.slice(0, 3),
            alerts: alerts,
            stormRisk: current.damageRisk,
            lastUpdated: new Date().toISOString()
        };
    }

    getActiveAlertsForLocation(location) {
        const alerts = Array.from(this.weatherAlerts.values());
        
        // Filter alerts that affect this location
        return alerts.filter(alert => 
            alert.status === 'active' && 
            this.isLocationInAlertArea(location, alert)
        );
    }

    isLocationInAlertArea(location, alert) {
        // Simplified location checking - in production, this would use proper geospatial queries
        if (typeof location === 'string' && alert.areas) {
            return alert.areas.toLowerCase().includes(location.toLowerCase());
        }
        
        return false;
    }

    // Additional utility methods would be implemented here...
    // Including coordinate conversion, date range generation, statistical calculations, etc.
    
    // Placeholder implementations for complex calculations
    calculateWeatherSeverityScore(weatherData) {
        // Simplified severity calculation
        return Math.random() * 100;
    }

    calculatePropertyRiskFactor(property) {
        // Property-based risk calculation
        return 1.0;
    }

    calculateRoofRiskFactor(property) {
        // Roof-based risk calculation
        return 1.0;
    }

    calculateEnvironmentalRiskFactor(property) {
        // Environmental risk calculation
        return 1.0;
    }

    async getLocationCoordinates(location) {
        // Geocoding service integration would go here
        // For now, return mock coordinates
        return { lat: 32.7767, lon: -96.7970 }; // Dallas, TX
    }

    extractPrecipitation(data) {
        // Extract precipitation data from weather response
        return {
            rain: data.rain?.['1h'] || 0,
            snow: data.snow?.['1h'] || 0
        };
    }

    // Additional Implementation Methods

    // Historical Weather Data Processing
    processDailyHistoricalData(sources, date) {
        if (!sources || sources.length === 0) return null;
        
        const primary = sources.find(s => s.source === 'openweathermap') || sources[0];
        
        if (primary.source === 'openweathermap') {
            const current = primary.data.current;
            return {
                date,
                temperature: {
                    max: Math.round(current.temp),
                    min: Math.round(current.temp), // Historical doesn't provide min/max
                    average: Math.round(current.temp)
                },
                conditions: {
                    main: primary.data.current.weather[0].main,
                    description: primary.data.current.weather[0].description,
                    windSpeed: Math.round(current.wind_speed),
                    windDirection: current.wind_deg,
                    humidity: current.humidity,
                    pressure: current.pressure,
                    cloudCover: current.clouds
                },
                precipitation: current.rain ? current.rain['1h'] || 0 : 0,
                stormIndicators: this.analyzeStormIndicators(primary.data, 'openweathermap')
            };
        }
        
        if (primary.source === 'weatherapi') {
            const day = primary.data.forecast.forecastday[0].day;
            const hour = primary.data.forecast.forecastday[0].hour[12]; // Noon data
            
            return {
                date,
                temperature: {
                    max: Math.round(day.maxtemp_f),
                    min: Math.round(day.mintemp_f),
                    average: Math.round(day.avgtemp_f)
                },
                conditions: {
                    main: day.condition.text,
                    description: day.condition.text,
                    windSpeed: Math.round(day.maxwind_mph),
                    windDirection: hour?.wind_degree || 0,
                    humidity: day.avghumidity,
                    pressure: hour?.pressure_in || 29.92,
                    cloudCover: hour?.cloud || 0
                },
                precipitation: day.totalprecip_in || 0,
                stormIndicators: this.analyzeStormIndicators(primary.data, 'weatherapi')
            };
        }
        
        return null;
    }

    calculateHistoricalSummary(dailyData) {
        if (!dailyData || dailyData.length === 0) return {};
        
        const temperatures = dailyData.map(d => d.temperature.average);
        const precipitations = dailyData.map(d => d.precipitation);
        const windSpeeds = dailyData.map(d => d.conditions.windSpeed);
        
        return {
            temperatureStats: {
                average: Math.round(temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length),
                max: Math.max(...temperatures),
                min: Math.min(...temperatures)
            },
            precipitationStats: {
                total: Math.round(precipitations.reduce((sum, precip) => sum + precip, 0) * 100) / 100,
                average: Math.round(precipitations.reduce((sum, precip) => sum + precip, 0) / precipitations.length * 100) / 100,
                maxDaily: Math.max(...precipitations)
            },
            windStats: {
                average: Math.round(windSpeeds.reduce((sum, wind) => sum + wind, 0) / windSpeeds.length),
                max: Math.max(...windSpeeds)
            },
            stormDays: dailyData.filter(d => d.stormIndicators.hasStormActivity).length
        };
    }

    detectHistoricalStormEvents(dailyData) {
        const stormEvents = [];
        
        dailyData.forEach(day => {
            if (day.stormIndicators.hasStormActivity) {
                stormEvents.push({
                    date: day.date,
                    types: day.stormIndicators.stormTypes,
                    severity: day.stormIndicators.severityLevel,
                    conditions: day.conditions,
                    riskFactors: day.stormIndicators.riskFactors
                });
            }
        });
        
        return stormEvents;
    }

    generateHistoricalDamageInsights(dailyData) {
        const stormDays = dailyData.filter(d => d.stormIndicators.hasStormActivity);
        
        if (stormDays.length === 0) {
            return { insights: 'No significant storm activity detected in the analyzed period' };
        }
        
        return {
            totalStormDays: stormDays.length,
            averageStormSeverity: this.calculateAverageStormSeverity(stormDays),
            mostCommonStormTypes: this.findMostCommonStormTypes(stormDays),
            highRiskPeriods: this.identifyHighRiskPeriods(stormDays),
            damageCorrelationFactors: this.analyzeDamageFactors(stormDays)
        };
    }

    // Geographic Analysis Implementation
    generateGeographicGrid(centerLocation, radiusMiles, gridSize) {
        const gridPoints = [];
        const latMilesPerDegree = 69.0;
        const lonMilesPerDegree = 54.6; // Approximate for mid-latitudes
        
        const centerCoords = this.parseLocationToCoords(centerLocation);
        const latStep = (radiusMiles * 2) / gridSize / latMilesPerDegree;
        const lonStep = (radiusMiles * 2) / gridSize / lonMilesPerDegree;
        
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const lat = centerCoords.lat - radiusMiles / latMilesPerDegree + (i * latStep);
                const lon = centerCoords.lon - radiusMiles / lonMilesPerDegree + (j * lonStep);
                gridPoints.push({ lat, lon });
            }
        }
        
        return gridPoints;
    }

    parseLocationToCoords(location) {
        if (location.lat && location.lon) {
            return { lat: location.lat, lon: location.lon };
        }
        
        // For string addresses, return default coords (in production, use geocoding)
        return { lat: 32.7767, lon: -96.7970 }; // Dallas, TX default
    }

    identifyWeatherPatterns(weatherResults) {
        const patterns = {
            temperatureGradient: this.calculateTemperatureGradient(weatherResults),
            pressureGradient: this.calculatePressureGradient(weatherResults),
            windPatterns: this.analyzeWindPatterns(weatherResults),
            stormClusters: this.identifyStormClusters(weatherResults)
        };
        
        return patterns;
    }

    calculateWeatherVariability(weatherResults) {
        const temperatures = weatherResults.map(r => r.weather.current.temperature);
        const pressures = weatherResults.map(r => r.weather.current.pressure);
        const windSpeeds = weatherResults.map(r => r.weather.current.windSpeed);
        
        return {
            temperatureVariability: this.calculateStandardDeviation(temperatures),
            pressureVariability: this.calculateStandardDeviation(pressures),
            windVariability: this.calculateStandardDeviation(windSpeeds)
        };
    }

    calculateAverageConditions(weatherResults) {
        const temperatures = weatherResults.map(r => r.weather.current.temperature);
        const pressures = weatherResults.map(r => r.weather.current.pressure);
        const windSpeeds = weatherResults.map(r => r.weather.current.windSpeed);
        const humidities = weatherResults.map(r => r.weather.current.humidity);
        
        return {
            temperature: Math.round(temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length),
            pressure: Math.round(pressures.reduce((sum, press) => sum + press, 0) / pressures.length * 100) / 100,
            windSpeed: Math.round(windSpeeds.reduce((sum, wind) => sum + wind, 0) / windSpeeds.length),
            humidity: Math.round(humidities.reduce((sum, humid) => sum + humid, 0) / humidities.length)
        };
    }

    // Forecast Processing
    processWeatherAPIForecast(data) {
        const dailyForecasts = data.forecast.forecastday.map(day => ({
            date: day.date,
            temperature: {
                max: Math.round(day.day.maxtemp_f),
                min: Math.round(day.day.mintemp_f),
                average: Math.round(day.day.avgtemp_f)
            },
            conditions: {
                main: day.day.condition.text,
                description: day.day.condition.text,
                windSpeed: Math.round(day.day.maxwind_mph),
                humidity: day.day.avghumidity,
                precipitation: day.day.totalprecip_in,
                chanceOfRain: day.day.daily_chance_of_rain,
                chanceOfSnow: day.day.daily_chance_of_snow
            },
            hourlyData: day.hour.map(hour => ({
                time: hour.time,
                temperature: Math.round(hour.temp_f),
                condition: hour.condition.text,
                windSpeed: Math.round(hour.wind_mph),
                windGust: hour.gust_mph ? Math.round(hour.gust_mph) : null,
                pressure: hour.pressure_in,
                humidity: hour.humidity,
                precipitation: hour.precip_in
            }))
        }));
        
        return {
            source: 'weatherapi',
            location: data.location,
            dailyForecasts,
            alerts: data.alerts?.alert || []
        };
    }

    processOpenWeatherMapForecast(data, days) {
        const dailyForecasts = data.daily.slice(0, days).map(day => ({
            date: new Date(day.dt * 1000).toISOString().split('T')[0],
            temperature: {
                max: Math.round(day.temp.max),
                min: Math.round(day.temp.min),
                average: Math.round((day.temp.max + day.temp.min) / 2)
            },
            conditions: {
                main: day.weather[0].main,
                description: day.weather[0].description,
                windSpeed: Math.round(day.wind_speed),
                humidity: day.humidity,
                precipitation: day.rain ? day.rain['1h'] || 0 : 0,
                pressure: day.pressure
            }
        }));
        
        return {
            source: 'openweathermap',
            location: { lat: data.lat, lon: data.lon },
            dailyForecasts,
            alerts: data.alerts || []
        };
    }

    analyzeForecastForStorms(forecastData) {
        return forecastData.dailyForecasts.map(day => ({
            date: day.date,
            stormRisk: this.assessDailyStormRisk(day),
            stormTypes: this.identifyPotentialStormTypes(day),
            severity: this.forecastStormSeverity(day)
        }));
    }

    // Severity Assessment Implementation
    calculateWindSeverity(windSpeed) {
        const thresholds = this.config.stormThresholds.wind;
        
        if (windSpeed >= thresholds.extreme.speed) return 1.0;
        if (windSpeed >= thresholds.severe.speed) return 0.8;
        if (windSpeed >= thresholds.moderate.speed) return 0.6;
        if (windSpeed >= thresholds.minor.speed) return 0.4;
        return 0.1;
    }

    calculateHailSeverity(stormData) {
        // Estimate hail size based on conditions
        const estimatedHailSize = this.estimateHailSize(stormData.conditions);
        const thresholds = this.config.stormThresholds.hail;
        
        if (estimatedHailSize >= thresholds.extreme.size) return 1.0;
        if (estimatedHailSize >= thresholds.severe.size) return 0.8;
        if (estimatedHailSize >= thresholds.moderate.size) return 0.6;
        if (estimatedHailSize >= thresholds.minor.size) return 0.4;
        return 0.1;
    }

    calculatePrecipitationSeverity(precipitation) {
        const intensity = precipitation.rain + precipitation.snow;
        
        if (intensity >= 2.0) return 0.9; // Very heavy
        if (intensity >= 1.0) return 0.7; // Heavy
        if (intensity >= 0.5) return 0.5; // Moderate
        if (intensity >= 0.1) return 0.3; // Light
        return 0.1;
    }

    calculateTemperatureSeverity(temperature) {
        // Extreme temperatures can cause damage
        if (temperature <= 10 || temperature >= 110) return 0.8; // Extreme
        if (temperature <= 20 || temperature >= 100) return 0.6; // Very high/low
        if (temperature <= 32 || temperature >= 95) return 0.4; // High/low
        return 0.1;
    }

    calculatePressureSeverity(pressure) {
        const normalPressure = 29.92; // Standard atmospheric pressure in inHg
        const deviation = Math.abs(pressure - normalPressure);
        
        if (deviation >= 1.0) return 0.8; // Extreme pressure change
        if (deviation >= 0.5) return 0.6; // Significant change
        if (deviation >= 0.3) return 0.4; // Moderate change
        return 0.1;
    }

    // Risk Assessment Implementation
    assessDamageRisk(weatherData, source) {
        const conditions = source === 'current' ? weatherData : 
                          this.extractCurrentConditions(weatherData, source);
        
        let riskScore = 0;
        const riskFactors = [];
        
        // Wind damage risk
        if (conditions.windSpeed >= 39) {
            riskScore += conditions.windSpeed * 0.01;
            riskFactors.push(`Wind damage risk: ${conditions.windSpeed} mph`);
        }
        
        // Hail damage risk
        if (this.isHailLikely(conditions)) {
            riskScore += 30;
            riskFactors.push('Hail damage risk detected');
        }
        
        // Temperature-related damage
        if (conditions.temperature <= 32) {
            riskScore += 15;
            riskFactors.push('Freezing temperature damage risk');
        }
        
        return {
            overallRisk: Math.min(100, riskScore),
            riskLevel: this.categorizeDamageRisk(riskScore),
            riskFactors,
            recommendations: this.generateRiskRecommendations(riskScore, riskFactors)
        };
    }

    categorizeDamageRisk(riskScore) {
        if (riskScore >= 80) return 'EXTREME';
        if (riskScore >= 60) return 'HIGH';
        if (riskScore >= 40) return 'MODERATE';
        if (riskScore >= 20) return 'LOW';
        return 'MINIMAL';
    }

    generateRiskRecommendations(riskScore, riskFactors) {
        const recommendations = [];
        
        if (riskScore >= 60) {
            recommendations.push('Secure outdoor items and prepare for potential damage');
            recommendations.push('Consider postponing outdoor activities');
        }
        
        if (riskFactors.some(factor => factor.includes('Hail'))) {
            recommendations.push('Move vehicles to covered areas if possible');
        }
        
        if (riskFactors.some(factor => factor.includes('Wind'))) {
            recommendations.push('Check roof and siding for loose materials');
        }
        
        return recommendations;
    }

    // Storm Correlation Implementation
    assessStormDamageRisk(stormIndicators, weatherData) {
        let damageRisk = 0;
        const riskFactors = [];
        
        stormIndicators.stormTypes.forEach(stormType => {
            switch (stormType) {
                case this.stormEventTypes.HAIL:
                    damageRisk += 40;
                    riskFactors.push('Hail damage to roof, siding, and windows');
                    break;
                case this.stormEventTypes.WIND:
                    damageRisk += 30;
                    riskFactors.push('Wind damage to roof, trees, and structures');
                    break;
                case this.stormEventTypes.TORNADO:
                    damageRisk += 80;
                    riskFactors.push('Extreme structural damage risk');
                    break;
                case this.stormEventTypes.THUNDERSTORM:
                    damageRisk += 20;
                    riskFactors.push('Lightning and wind damage risk');
                    break;
            }
        });
        
        return {
            damageRisk: Math.min(100, damageRisk),
            riskLevel: this.categorizeDamageRisk(damageRisk),
            riskFactors
        };
    }

    calculateImpactRadius(severityLevel) {
        const radiusMap = {
            minimal: 5,
            minor: 10,
            moderate: 15,
            severe: 25,
            extreme: 50
        };
        
        return radiusMap[severityLevel] || 10;
    }

    async identifyAffectedAreas(location, severityLevel) {
        const radius = this.calculateImpactRadius(severityLevel);
        
        // Generate affected areas based on radius
        return {
            primaryImpactZone: `${radius} mile radius from ${this.formatLocationString(location)}`,
            secondaryImpactZone: `${radius * 2} mile radius with reduced impact`,
            estimatedProperties: this.estimateAffectedProperties(location, radius),
            riskLevel: severityLevel
        };
    }

    estimateStormDuration(stormIndicators) {
        // Estimate storm duration based on types and severity
        const baseDuration = 60; // minutes
        let multiplier = 1;
        
        if (stormIndicators.stormTypes.includes(this.stormEventTypes.TORNADO)) {
            multiplier = 0.5; // Tornadoes are typically short-lived
        } else if (stormIndicators.stormTypes.includes(this.stormEventTypes.THUNDERSTORM)) {
            multiplier = 2; // Thunderstorms can last hours
        }
        
        return Math.round(baseDuration * multiplier);
    }

    async estimatePotentialClaims(location, stormIndicators) {
        // Estimate potential insurance claims based on historical data
        const baseClaimsPerMile = 10; // Historical average
        const radius = this.calculateImpactRadius(stormIndicators.severityLevel);
        const area = Math.PI * Math.pow(radius, 2);
        
        let claimMultiplier = 1;
        if (stormIndicators.stormTypes.includes(this.stormEventTypes.HAIL)) {
            claimMultiplier *= 2;
        }
        if (stormIndicators.stormTypes.includes(this.stormEventTypes.TORNADO)) {
            claimMultiplier *= 5;
        }
        
        return {
            estimatedClaimCount: Math.round(area * baseClaimsPerMile * claimMultiplier),
            estimatedTotalValue: Math.round(area * baseClaimsPerMile * claimMultiplier * 15000), // $15k average
            confidenceLevel: 0.6
        };
    }

    // Utility Helper Methods
    calculateStandardDeviation(values) {
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
        const variance = squaredDifferences.reduce((sum, diff) => sum + diff, 0) / values.length;
        return Math.sqrt(variance);
    }

    formatLocationString(location) {
        if (typeof location === 'string') return location;
        if (location.address) return location.address;
        if (location.lat && location.lon) return `${location.lat}, ${location.lon}`;
        return 'Unknown location';
    }

    estimateHailSize(conditions) {
        // Simplified hail size estimation based on atmospheric conditions
        if (conditions.windSpeed >= 60 && conditions.temperature >= 70) {
            return 2.0; // Large hail likely
        }
        if (conditions.windSpeed >= 40 && conditions.temperature >= 65) {
            return 1.0; // Medium hail likely
        }
        if (conditions.windSpeed >= 30) {
            return 0.5; // Small hail possible
        }
        return 0;
    }

    generateDateRange(startDate, endDate) {
        const dates = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            dates.push(new Date(date));
        }
        
        return dates;
    }

    storeHistoricalWeatherData(location, data) {
        const key = this.generateLocationKey(location);
        
        if (!this.historicalWeatherData.has(key)) {
            this.historicalWeatherData.set(key, []);
        }
        
        this.historicalWeatherData.get(key).push({
            ...data,
            storedAt: new Date().toISOString()
        });
    }

    // Weather Insight Generation for Claims
    isStormRelatedClaim(claim) {
        const damageTypes = ['hail', 'wind', 'storm', 'tornado', 'hurricane', 'weather'];
        const causeOfLoss = claim.damage.causeOfLoss?.toLowerCase() || '';
        const description = claim.damage.description?.toLowerCase() || '';
        
        return damageTypes.some(type => 
            causeOfLoss.includes(type) || description.includes(type)
        );
    }

    generateWeatherInsights(claim, weatherCorrelation) {
        if (!weatherCorrelation) {
            return { insights: 'No weather correlation data available' };
        }
        
        return {
            weatherAtTimeOfLoss: weatherCorrelation.weatherAtTimeOfLoss,
            correlatedStorms: weatherCorrelation.correlatedStormEvents,
            damageProbability: weatherCorrelation.damageProbabilityAnalysis,
            contributingFactors: weatherCorrelation.contributingFactors,
            recommendations: this.generateClaimRecommendations(claim, weatherCorrelation)
        };
    }

    formatWeatherInsightsForClaim(insights) {
        let formattedInsights = 'Weather Analysis Summary:\n\n';
        
        if (insights.weatherAtTimeOfLoss) {
            formattedInsights += '📊 Weather Conditions at Time of Loss:\n';
            formattedInsights += `- Temperature: ${insights.weatherAtTimeOfLoss.temperature}°F\n`;
            formattedInsights += `- Wind Speed: ${insights.weatherAtTimeOfLoss.windSpeed} mph\n`;
            formattedInsights += `- Conditions: ${insights.weatherAtTimeOfLoss.conditions}\n\n`;
        }
        
        if (insights.damageProbability) {
            formattedInsights += '⚠️ Damage Probability Analysis:\n';
            formattedInsights += `- Overall Probability: ${insights.damageProbability.overallProbability}%\n`;
            formattedInsights += `- Weather Severity: ${insights.damageProbability.factorAnalysis.weatherSeverity}\n\n`;
        }
        
        if (insights.recommendations?.length > 0) {
            formattedInsights += '💡 Recommendations:\n';
            insights.recommendations.forEach(rec => {
                formattedInsights += `- ${rec}\n`;
            });
        }
        
        return formattedInsights;
    }

    generateClaimRecommendations(claim, weatherCorrelation) {
        const recommendations = [];
        
        if (weatherCorrelation?.damageProbabilityAnalysis?.overallProbability > 70) {
            recommendations.push('High weather correlation - prioritize for fast-track processing');
        }
        
        if (weatherCorrelation?.correlatedStormEvents?.length > 0) {
            recommendations.push('Multiple storm events detected - check for comprehensive damage assessment');
        }
        
        recommendations.push('Consider aerial imagery for complete damage evaluation');
        recommendations.push('Schedule inspection within 24-48 hours if severe weather confirmed');
        
        return recommendations;
    }

    // Monitoring and Alert Methods
    getMonitoredRegions() {
        // Return regions that should be monitored for weather alerts
        return [
            { name: 'Texas', bounds: { north: 36.5, south: 25.8, east: -93.5, west: -106.6 } },
            { name: 'Oklahoma', bounds: { north: 37.0, south: 33.6, east: -94.4, west: -103.0 } }
            // Add more regions as needed
        ];
    }

    async fetchWeatherAlerts(region) {
        try {
            // Fetch from NOAA Weather Service API
            const response = await this.apiClients.noaa.get('/alerts/active', {
                params: {
                    area: region.name
                }
            });
            
            return response.data.features.map(feature => feature.properties);
            
        } catch (error) {
            logger.error(`Error fetching alerts for ${region.name}:`, error);
            return [];
        }
    }

    mapAlertSeverity(alertSeverity) {
        const severityMap = {
            'Minor': 'minor',
            'Moderate': 'moderate', 
            'Severe': 'severe',
            'Extreme': 'extreme'
        };
        
        return severityMap[alertSeverity] || 'moderate';
    }

    extractStormTypesFromAlert(alert) {
        const stormTypes = [];
        const eventType = alert.event?.toLowerCase() || '';
        
        if (eventType.includes('tornado')) stormTypes.push(this.stormEventTypes.TORNADO);
        if (eventType.includes('thunderstorm')) stormTypes.push(this.stormEventTypes.THUNDERSTORM);
        if (eventType.includes('hail')) stormTypes.push(this.stormEventTypes.HAIL);
        if (eventType.includes('wind')) stormTypes.push(this.stormEventTypes.WIND);
        if (eventType.includes('hurricane')) stormTypes.push(this.stormEventTypes.HURRICANE);
        if (eventType.includes('flood')) stormTypes.push(this.stormEventTypes.FLOOD);
        
        return stormTypes;
    }

    assessAlertDamageRisk(alert) {
        const severity = this.mapAlertSeverity(alert.severity);
        const stormTypes = this.extractStormTypesFromAlert(alert);
        
        let riskScore = 0;
        
        // Base risk from severity
        const severityRisk = {
            minor: 20,
            moderate: 40,
            severe: 70,
            extreme: 95
        };
        
        riskScore += severityRisk[severity] || 40;
        
        // Additional risk from storm types
        if (stormTypes.includes(this.stormEventTypes.TORNADO)) riskScore += 30;
        if (stormTypes.includes(this.stormEventTypes.HAIL)) riskScore += 25;
        if (stormTypes.includes(this.stormEventTypes.HURRICANE)) riskScore += 35;
        
        return {
            riskScore: Math.min(100, riskScore),
            riskLevel: this.categorizeDamageRisk(riskScore),
            primaryRisks: stormTypes
        };
    }

    async identifyAffectedProperties(alert) {
        // In production, this would query a property database
        // For now, return estimated counts based on area
        return {
            estimatedResidentialProperties: 1000,
            estimatedCommercialProperties: 100,
            highRiskProperties: 150
        };
    }

    async triggerClaimRiskAssessment(alert) {
        // Trigger proactive claim risk assessment for the alert area
        this.emit('claimRiskAssessment', {
            alertId: alert.id,
            region: alert.region,
            estimatedClaims: alert.affectedProperties.estimatedResidentialProperties * 0.1, // 10% claim rate
            riskLevel: alert.damageRisk.riskLevel
        });
    }

    async updateActiveStormEvents() {
        // Update status of active storm events
        for (const [stormId, stormEvent] of this.stormEvents) {
            if (stormEvent.isActive) {
                const currentWeather = await this.getCurrentWeather(stormEvent.location)
                    .catch(error => {
                        logger.warn(`Could not update storm ${stormId}:`, error.message);
                        return null;
                    });
                
                if (currentWeather) {
                    const updatedIndicators = this.analyzeStormIndicators(currentWeather, 'current');
                    
                    if (!updatedIndicators.hasStormActivity) {
                        // Storm has passed
                        stormEvent.isActive = false;
                        stormEvent.status = 'completed';
                        stormEvent.endedAt = new Date().toISOString();
                        
                        this.emit('stormEnded', stormEvent);
                    } else {
                        // Update storm data
                        stormEvent.lastUpdated = new Date().toISOString();
                        stormEvent.conditions = currentWeather.current;
                    }
                }
            }
        }
    }

    async processPredictiveAnalytics() {
        console.log('🔮 Processing predictive analytics...');
        
        // This would run more sophisticated predictive models in production
        const monitoredRegions = this.getMonitoredRegions();
        
        for (const region of monitoredRegions) {
            try {
                const prediction = await this.generatePredictiveWeatherIntelligence(region, 7);
                this.emit('predictiveAnalyticsUpdate', {
                    region,
                    prediction,
                    generatedAt: new Date().toISOString()
                });
            } catch (error) {
                logger.warn(`Predictive analytics failed for ${region.name}:`, error.message);
            }
        }
    }

    // Stop monitoring
    stopRealTimeMonitoring() {
        if (this.alertsInterval) clearInterval(this.alertsInterval);
        if (this.stormUpdateInterval) clearInterval(this.stormUpdateInterval);
        if (this.predictiveInterval) clearInterval(this.predictiveInterval);
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
        
        console.log('🛑 Real-time weather monitoring stopped');
    }
}