#!/usr/bin/env node

/**
 * Building Code Service Demonstration
 * Shows how the Multi-State Building Code Engine works
 */

import { BuildingCodeService } from './src/api/services/BuildingCodeService.js';

console.log('🏗️ Susan AI - Multi-State Building Code Engine Demonstration\n');

async function demonstrateBuildingCodeEngine() {
    const buildingCodeService = new BuildingCodeService();
    
    console.log('⏳ Initializing Building Code Service...');
    
    try {
        // Wait for initialization
        await new Promise(resolve => {
            if (buildingCodeService.initialized) {
                resolve();
            } else {
                buildingCodeService.once('serviceReady', resolve);
            }
        });
        
        console.log('✅ Building Code Service initialized successfully\n');
        
        // Demo 1: Get building code requirements for Florida (hurricane zone)
        console.log('📋 Demo 1: Building Code Requirements for Miami, FL');
        console.log('=' .repeat(60));
        
        const floridaRequirements = await buildingCodeService.getBuildingCodeRequirements({
            state: 'FL',
            city: 'Miami',
            county: 'Miami-Dade'
        });
        
        console.log(`Location: ${floridaRequirements.location.city}, ${floridaRequirements.location.state}`);
        console.log(`Adopted Code: ${floridaRequirements.requirements.adoptedCode}`);
        console.log(`Wind Zone: ${floridaRequirements.requirements.windZone}`);
        console.log(`Hurricane Provisions: ${floridaRequirements.requirements.roofingRequirements.windResistance.designWindSpeed}`);
        console.log(`Special Zone: ${floridaRequirements.requirements.roofingRequirements.specialZones?.HVHZ || 'Not in HVHZ'}\n`);
        
        // Demo 2: Check compliance for a roofing job
        console.log('🔍 Demo 2: Compliance Check for Roof Replacement');
        console.log('=' .repeat(60));
        
        const workDescription = {
            scope: 'replacement',
            materials: {
                type: 'asphalt_shingles',
                weight: 240,
                windRating: 'Class F',
                fireRating: 'Class A'
            },
            installation: {
                nailsPerShingle: 4,
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
        
        const complianceResult = await buildingCodeService.checkCompliance(
            workDescription, 
            { state: 'FL', city: 'Miami' }
        );
        
        console.log(`Overall Compliance: ${complianceResult.overallCompliance.rating} (${complianceResult.overallCompliance.score}%)`);
        console.log(`Critical Violations: ${complianceResult.overallCompliance.criticalViolations}`);
        console.log(`Total Checks: ${complianceResult.overallCompliance.total}`);
        console.log(`Passed: ${complianceResult.overallCompliance.passed}`);
        console.log(`Failed: ${complianceResult.overallCompliance.failed}\n`);
        
        if (complianceResult.results.some(r => !r.compliant)) {
            console.log('❌ Violations Found:');
            complianceResult.results
                .filter(r => !r.compliant)
                .forEach(violation => {
                    console.log(`  - ${violation.description} (${violation.severity})`);
                });
            console.log();
        }
        
        // Demo 3: Search building codes
        console.log('🔍 Demo 3: Search Building Codes for "wind resistance"');
        console.log('=' .repeat(60));
        
        const searchResults = await buildingCodeService.searchCodes('wind resistance', { state: 'FL' });
        
        console.log(`Query: "${searchResults.query}"`);
        console.log(`Results Found: ${searchResults.totalFound}`);
        console.log('Top Results:');
        searchResults.results.slice(0, 3).forEach((result, index) => {
            console.log(`  ${index + 1}. ${result.category || result.type} (relevance: ${(result.relevance * 100).toFixed(1)}%)`);
        });
        console.log();
        
        // Demo 4: Get material requirements
        console.log('🧱 Demo 4: Material Requirements for Asphalt Shingles in Texas');
        console.log('=' .repeat(60));
        
        const materialRequirements = await buildingCodeService.getMaterialRequirements(
            'asphalt_shingles',
            { state: 'TX', city: 'Houston' }
        );
        
        console.log(`Material Type: ${materialRequirements.materialType}`);
        console.log(`Location: ${materialRequirements.location.city}, ${materialRequirements.location.state}`);
        console.log('Architectural Shingles:');
        const architectural = materialRequirements.requirements.categories?.architectural;
        if (architectural) {
            console.log(`  - Weight: ${architectural.minWeight}`);
            console.log(`  - Wind Rating: ${architectural.windRating}`);
            console.log(`  - Fire Rating: ${architectural.fireRating}`);
            console.log(`  - Nails Per Shingle: ${architectural.installation.nailsPerShingle}`);
        }
        console.log();
        
        // Demo 5: Calculate wind load requirements
        console.log('💨 Demo 5: Wind Load Calculation for Colorado Building');
        console.log('=' .repeat(60));
        
        const windLoadRequirements = await buildingCodeService.calculateWindLoadRequirements(
            { state: 'CO', city: 'Denver' },
            35, // building height in feet
            'B'  // exposure category
        );
        
        console.log(`Location: ${windLoadRequirements.location.city || 'Denver'}, ${windLoadRequirements.location.state}`);
        console.log(`Wind Zone: ${windLoadRequirements.windZone}`);
        console.log(`Basic Wind Speed: ${windLoadRequirements.basicWindSpeed}`);
        console.log(`Design Wind Pressure: ${windLoadRequirements.designWindPressure}`);
        console.log(`Roof Attachment: ${windLoadRequirements.requirements.roofAttachment}`);
        console.log(`Uplift Resistance: ${windLoadRequirements.requirements.upliftResistance}\n`);
        
        // Demo 6: Service status and statistics
        console.log('📊 Demo 6: Service Status and Statistics');
        console.log('=' .repeat(60));
        
        const status = buildingCodeService.getServiceStatus();
        
        console.log(`Version: ${status.version}`);
        console.log(`Initialized: ${status.initialized}`);
        console.log(`Last Update: ${status.lastUpdate}`);
        console.log('\nStatistics:');
        console.log(`  - States Loaded: ${status.statistics.statesLoaded}`);
        console.log(`  - Federal Codes: ${status.statistics.federalCodes}`);
        console.log(`  - Material Types: ${status.statistics.materialTypes}`);
        console.log(`  - Compliance Rules: ${status.statistics.complianceRules}`);
        console.log('\nFeatures:');
        status.features.forEach(feature => {
            console.log(`  ✓ ${feature}`);
        });
        
        console.log('\n🎉 Building Code Engine demonstration completed successfully!');
        console.log('\nThe Multi-State Building Code Engine provides:');
        console.log('• Comprehensive building codes for all 50 US states');
        console.log('• Real-time compliance checking for roofing work');
        console.log('• Material requirements and installation standards');
        console.log('• Wind load calculations and environmental factors');
        console.log('• Code citations and legal references');
        console.log('• Integration with roofing damage analysis');
        console.log('• Change tracking and notification system');
        
    } catch (error) {
        console.error('❌ Demonstration failed:', error);
    }
}

// Run the demonstration
demonstrateBuildingCodeEngine().catch(console.error);