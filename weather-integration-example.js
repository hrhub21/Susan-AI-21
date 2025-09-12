/**
 * Weather Data Integration Service - Usage Examples
 * Comprehensive examples showing how to integrate and use the Weather Service
 */

import { WeatherDataService } from './src/api/services/WeatherDataService.js';
import { ClaimTrackingDashboardService } from './src/api/services/ClaimTrackingDashboardService.js';

// Example 1: Basic Service Initialization
async function initializeWeatherService() {
    console.log('🌦️ Initializing Weather Data Service...');
    
    const weatherService = new WeatherDataService({
        openWeatherMap: process.env.OPENWEATHERMAP_API_KEY,
        weatherAPI: process.env.WEATHERAPI_KEY,
        noaa: process.env.NOAA_API_KEY
    });
    
    // Wait for service to initialize
    await new Promise((resolve) => {
        weatherService.on('serviceReady', resolve);
    });
    
    console.log('✅ Weather Service ready');
    return weatherService;
}

// Example 2: Get Current Weather and Assess Risk
async function getCurrentWeatherExample(weatherService) {
    console.log('\n📊 Getting current weather data...');
    
    try {
        const location = 'Dallas, TX';
        const weather = await weatherService.getCurrentWeather(location);
        
        console.log(`Weather in ${location}:`);
        console.log(`- Temperature: ${weather.current.temperature}°F`);
        console.log(`- Wind Speed: ${weather.current.windSpeed} mph`);
        console.log(`- Condition: ${weather.current.condition}`);
        console.log(`- Damage Risk: ${weather.damageRisk.riskLevel} (${weather.damageRisk.overallRisk}%)`);
        
        if (weather.stormIndicators.hasStormActivity) {
            console.log('⚠️ Storm Activity Detected:');
            console.log(`- Storm Types: ${weather.stormIndicators.stormTypes.join(', ')}`);
            console.log(`- Severity: ${weather.stormIndicators.severityLevel}`);
        }
        
        return weather;
        
    } catch (error) {
        console.error('❌ Error getting current weather:', error.message);
    }
}

// Example 3: Historical Weather Analysis
async function historicalWeatherExample(weatherService) {
    console.log('\n📈 Analyzing historical weather data...');
    
    try {
        const location = 'Oklahoma City, OK';
        const startDate = '2024-04-01';
        const endDate = '2024-04-07';
        
        const historical = await weatherService.getHistoricalWeather(location, startDate, endDate);
        
        console.log(`Historical Weather for ${location} (${startDate} to ${endDate}):`);
        console.log(`- Days analyzed: ${historical.dailyData.length}`);
        console.log(`- Storm days: ${historical.summary.stormDays}`);
        console.log(`- Average temperature: ${historical.summary.temperatureStats.average}°F`);
        console.log(`- Total precipitation: ${historical.summary.precipitationStats.total}"`);
        
        if (historical.stormEvents.length > 0) {
            console.log('\n⛈️ Storm Events Detected:');
            historical.stormEvents.forEach((storm, index) => {
                console.log(`  ${index + 1}. ${storm.date}: ${storm.types.join(', ')} (${storm.severity})`);
            });
        }
        
        return historical;
        
    } catch (error) {
        console.error('❌ Error getting historical weather:', error.message);
    }
}

// Example 4: Storm Detection and Classification
async function stormDetectionExample(weatherService) {
    console.log('\n⛈️ Detecting and classifying storm events...');
    
    try {
        const location = 'Moore, OK'; // Tornado Alley location
        const weather = await weatherService.getCurrentWeather(location);
        const storms = await weatherService.detectStormEvents(weather, location);
        
        console.log(`Storm Detection for ${location}:`);
        console.log(`- Storms detected: ${storms.length}`);
        
        storms.forEach((storm, index) => {
            console.log(`\n Storm ${index + 1}:`);
            console.log(`  - ID: ${storm.id}`);
            console.log(`  - Types: ${storm.eventTypes.join(', ')}`);
            console.log(`  - Severity: ${storm.severityLevel}`);
            console.log(`  - Risk Score: ${storm.severityScore}`);
            console.log(`  - Impact Radius: ${storm.impactRadius} miles`);
            console.log(`  - Estimated Claims: ${storm.potentialClaims.estimatedClaimCount}`);
            console.log(`  - Estimated Value: $${storm.potentialClaims.estimatedTotalValue.toLocaleString()}`);
        });
        
        return storms;
        
    } catch (error) {
        console.error('❌ Error detecting storms:', error.message);
    }
}

// Example 5: Damage Correlation Analysis
async function damageCorrelationExample(weatherService) {
    console.log('\n🔗 Performing damage correlation analysis...');
    
    try {
        // Sample claim data
        const claimData = {
            id: 'CLM-2024-001234',
            property: {
                address: '1234 Oak Street, Plano, TX 75024',
                owner: 'John Smith',
                propertyType: 'residential',
                squareFootage: 2500,
                yearBuilt: 2010,
                roofType: 'asphalt_shingle'
            },
            damage: {
                type: 'roof_damage',
                severity: 'moderate',
                dateOfLoss: '2024-04-15',
                causeOfLoss: 'hail',
                description: 'Hail damage to roof shingles and gutters'
            },
            insurance: {
                company: 'State Farm',
                policyNumber: 'SF-789456123',
                deductible: 2500
            }
        };
        
        const correlation = await weatherService.correlateDamageWithWeather(claimData);
        
        console.log(`Damage Correlation Analysis for Claim ${claimData.id}:`);
        console.log(`- Correlation ID: ${correlation.correlationId}`);
        console.log(`- Overall Damage Probability: ${correlation.damageProbabilityAnalysis.overallProbability}%`);
        
        if (correlation.weatherAtTimeOfLoss) {
            console.log('\n🌤️ Weather at Time of Loss:');
            console.log(`  - Temperature: ${correlation.weatherAtTimeOfLoss.temperature?.average}°F`);
            console.log(`  - Wind Speed: ${correlation.weatherAtTimeOfLoss.conditions?.windSpeed} mph`);
            console.log(`  - Condition: ${correlation.weatherAtTimeOfLoss.conditions?.main}`);
        }
        
        if (correlation.correlatedStormEvents?.length > 0) {
            console.log('\n⛈️ Correlated Storm Events:');
            correlation.correlatedStormEvents.forEach(event => {
                console.log(`  - ${event.date}: ${event.types.join(', ')} (${event.severity})`);
            });
        }
        
        console.log('\n💡 Insights:');
        correlation.predictiveInsights.recommendations?.forEach(rec => {
            console.log(`  - ${rec}`);
        });
        
        return correlation;
        
    } catch (error) {
        console.error('❌ Error correlating damage:', error.message);
    }
}

// Example 6: Geographic Weather Pattern Analysis
async function geographicAnalysisExample(weatherService) {
    console.log('\n🗺️ Analyzing geographic weather patterns...');
    
    try {
        const centerLocation = 'Dallas, TX';
        const radiusMiles = 50;
        
        const analysis = await weatherService.analyzeGeographicWeatherPatterns(centerLocation, radiusMiles);
        
        console.log(`Geographic Analysis for ${radiusMiles}-mile radius around ${centerLocation}:`);
        console.log(`- Grid points analyzed: ${analysis.regionalPatterns.gridPoints}`);
        console.log(`- Valid data points: ${analysis.regionalPatterns.validDataPoints}`);
        console.log(`- Weather variability: ${JSON.stringify(analysis.regionalPatterns.variability, null, 2)}`);
        
        if (analysis.stormCorridors?.length > 0) {
            console.log('\n🌪️ Storm Corridors:');
            analysis.stormCorridors.forEach(corridor => {
                console.log(`  - ${corridor.name}: ${corridor.frequency} storms/year`);
            });
        }
        
        return analysis;
        
    } catch (error) {
        console.error('❌ Error analyzing geographic patterns:', error.message);
    }
}

// Example 7: Predictive Weather Intelligence
async function predictiveIntelligenceExample(weatherService) {
    console.log('\n🔮 Generating predictive weather intelligence...');
    
    try {
        const location = 'Houston, TX';
        const daysAhead = 7;
        
        const intelligence = await weatherService.generatePredictiveWeatherIntelligence(location, daysAhead);
        
        console.log(`Predictive Intelligence for ${location} (${daysAhead} days):`);
        
        if (intelligence.stormProbabilities) {
            console.log('\n⛈️ Storm Probabilities:');
            Object.entries(intelligence.stormProbabilities).forEach(([type, probability]) => {
                console.log(`  - ${type}: ${probability}%`);
            });
        }
        
        if (intelligence.claimRiskForecast) {
            console.log('\n📊 Claim Risk Forecast:');
            intelligence.claimRiskForecast.dailyForecasts?.slice(0, 3).forEach(day => {
                console.log(`  - ${day.date}: ${day.overallRisk}% risk, ${day.claimVolumeEstimate} estimated claims`);
            });
        }
        
        if (intelligence.preparationRecommendations?.length > 0) {
            console.log('\n💡 Preparation Recommendations:');
            intelligence.preparationRecommendations.forEach(rec => {
                console.log(`  - ${rec}`);
            });
        }
        
        return intelligence;
        
    } catch (error) {
        console.error('❌ Error generating predictive intelligence:', error.message);
    }
}

// Example 8: Real-Time Monitoring Setup
function setupRealTimeMonitoring(weatherService) {
    console.log('\n🔄 Setting up real-time weather monitoring...');
    
    // Severe weather alert handler
    weatherService.on('severeWeatherAlert', (alert) => {
        console.log(`\n🚨 SEVERE WEATHER ALERT:`);
        console.log(`- Type: ${alert.type}`);
        console.log(`- Severity: ${alert.severity}`);
        console.log(`- Region: ${alert.region}`);
        console.log(`- Areas: ${alert.areas}`);
        console.log(`- Start: ${alert.startTime}`);
        console.log(`- End: ${alert.endTime}`);
        
        // In production, this would trigger notifications to the claims team
        notifyClaimsTeam(alert);
    });
    
    // Storm detection handler
    weatherService.on('stormDetected', (storm) => {
        console.log(`\n⛈️ STORM DETECTED:`);
        console.log(`- ID: ${storm.id}`);
        console.log(`- Types: ${storm.eventTypes.join(', ')}`);
        console.log(`- Location: ${JSON.stringify(storm.location)}`);
        console.log(`- Severity: ${storm.severityLevel}`);
        console.log(`- Estimated Claims: ${storm.potentialClaims?.estimatedClaimCount}`);
        
        // Prepare for increased claims volume
        prepareForIncreasedClaims(storm);
    });
    
    // Storm ended handler
    weatherService.on('stormEnded', (storm) => {
        console.log(`\n✅ STORM ENDED:`);
        console.log(`- ID: ${storm.id}`);
        console.log(`- Duration: ${storm.endedAt - storm.detectedAt} minutes`);
        
        // Begin post-storm claim processing
        beginPostStormProcessing(storm);
    });
    
    // Claim risk assessment handler
    weatherService.on('claimRiskAssessment', (assessment) => {
        console.log(`\n⚠️ HIGH CLAIM RISK AREA:`);
        console.log(`- Region: ${assessment.region}`);
        console.log(`- Estimated Claims: ${assessment.estimatedClaims}`);
        console.log(`- Risk Level: ${assessment.riskLevel}`);
        
        // Alert adjusters in the area
        alertLocalAdjusters(assessment);
    });
    
    // Predictive analytics update
    weatherService.on('predictiveAnalyticsUpdate', (update) => {
        console.log(`\n🔮 PREDICTIVE ANALYTICS UPDATE:`);
        console.log(`- Region: ${update.region.name}`);
        console.log(`- Generated: ${update.generatedAt}`);
        
        // Update dashboards and reports
        updatePredictiveDashboards(update);
    });
}

// Example 9: Integration with Claim Tracking System
async function integrateWithClaimTracking(weatherService) {
    console.log('\n🔗 Integrating with Claim Tracking System...');
    
    try {
        const claimService = new ClaimTrackingDashboardService();
        await weatherService.integrateWithClaimTrackingSystem(claimService);
        
        console.log('✅ Weather service integrated with claim tracking');
        
        // Create a sample claim to demonstrate integration
        const sampleClaim = {
            property: {
                address: '5678 Elm Street, Frisco, TX 75034',
                owner: 'Jane Doe',
                propertyType: 'residential',
                roofType: 'asphalt_shingle'
            },
            insurance: {
                company: 'Allstate',
                policyNumber: 'AL-456789012',
                deductible: 1000
            },
            damage: {
                type: 'wind_damage',
                severity: 'moderate',
                dateOfLoss: '2024-04-20',
                causeOfLoss: 'wind',
                description: 'Wind damage to roof and siding'
            },
            team: {
                primaryAdjuster: 'adjuster_001'
            },
            financial: {
                estimatedValue: 12500
            }
        };
        
        // Create claim - this will automatically trigger weather correlation
        const claimResult = await claimService.createClaim(sampleClaim);
        console.log(`Created claim: ${claimResult.claimId}`);
        
        // Weather correlation will be automatically added to the claim
        // Check for weather-related communications
        setTimeout(async () => {
            const claim = claimService.getClaim(claimResult.claimId);
            const weatherComms = claim.communications.filter(comm => 
                comm.tags && comm.tags.includes('weather')
            );
            
            if (weatherComms.length > 0) {
                console.log('\n🌦️ Weather analysis added to claim:');
                weatherComms.forEach(comm => {
                    console.log(`- ${comm.subject}`);
                    console.log(`  ${comm.content.substring(0, 100)}...`);
                });
            }
        }, 2000);
        
        return { claimService, claimResult };
        
    } catch (error) {
        console.error('❌ Error integrating with claim tracking:', error.message);
    }
}

// Example 10: Weather Summary Dashboard
async function weatherSummaryExample(weatherService) {
    console.log('\n📊 Generating weather summary dashboard...');
    
    try {
        const locations = ['Dallas, TX', 'Houston, TX', 'Austin, TX', 'San Antonio, TX'];
        const summaries = [];
        
        for (const location of locations) {
            const summary = await weatherService.getWeatherSummary(location);
            summaries.push({ location, ...summary });
        }
        
        console.log('\n🌦️ Texas Weather Summary:');
        console.log('=' .repeat(60));
        
        summaries.forEach(summary => {
            console.log(`\n${summary.location}:`);
            console.log(`  Current: ${summary.current.temperature}°F, ${summary.current.condition}`);
            console.log(`  Wind: ${summary.current.windSpeed} mph`);
            console.log(`  Storm Risk: ${summary.stormRisk.riskLevel}`);
            console.log(`  Active Alerts: ${summary.alerts.length}`);
            
            if (summary.alerts.length > 0) {
                summary.alerts.forEach(alert => {
                    console.log(`    ⚠️ ${alert.type} (${alert.severity})`);
                });
            }
        });
        
        return summaries;
        
    } catch (error) {
        console.error('❌ Error generating weather summary:', error.message);
    }
}

// Helper functions for real-time monitoring
function notifyClaimsTeam(alert) {
    // In production, send notifications via email, SMS, Slack, etc.
    console.log(`  📧 Notifying claims team about ${alert.type} alert`);
}

function prepareForIncreasedClaims(storm) {
    // In production, alert adjusters, prepare resources, etc.
    console.log(`  📋 Preparing for estimated ${storm.potentialClaims?.estimatedClaimCount} claims`);
}

function beginPostStormProcessing(storm) {
    // In production, initiate post-storm claim processing workflows
    console.log(`  🔄 Beginning post-storm processing for storm ${storm.id}`);
}

function alertLocalAdjusters(assessment) {
    // In production, alert adjusters in the affected area
    console.log(`  👥 Alerting adjusters in ${assessment.region}`);
}

function updatePredictiveDashboards(update) {
    // In production, update dashboards and reports
    console.log(`  📊 Updating dashboards for ${update.region.name}`);
}

// Main execution function
async function runWeatherServiceExamples() {
    try {
        console.log('🚀 Weather Data Integration Service - Examples');
        console.log('=' .repeat(60));
        
        // Initialize service
        const weatherService = await initializeWeatherService();
        
        // Setup real-time monitoring
        setupRealTimeMonitoring(weatherService);
        
        // Run examples
        await getCurrentWeatherExample(weatherService);
        await historicalWeatherExample(weatherService);
        await stormDetectionExample(weatherService);
        await damageCorrelationExample(weatherService);
        await geographicAnalysisExample(weatherService);
        await predictiveIntelligenceExample(weatherService);
        await integrateWithClaimTracking(weatherService);
        await weatherSummaryExample(weatherService);
        
        console.log('\n✅ All weather service examples completed successfully!');
        console.log('\n📚 For more information, see WEATHER-SERVICE-README.md');
        
    } catch (error) {
        console.error('❌ Error running weather service examples:', error);
    }
}

// Export for use in other modules
export {
    initializeWeatherService,
    getCurrentWeatherExample,
    historicalWeatherExample,
    stormDetectionExample,
    damageCorrelationExample,
    geographicAnalysisExample,
    predictiveIntelligenceExample,
    setupRealTimeMonitoring,
    integrateWithClaimTracking,
    weatherSummaryExample,
    runWeatherServiceExamples
};

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runWeatherServiceExamples();
}