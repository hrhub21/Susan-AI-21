#!/usr/bin/env node

/**
 * Test script to verify Susan's enhanced capabilities
 * Tests both roofing-specific and general topic responses
 */

import { SusanBrain } from './src/susan-brain.js';
import { EnhancedRoofERService } from './src/api/services/EnhancedRoofERService.js';

console.log('🧠 Testing Susan\'s Enhanced Capabilities...\n');

// Initialize Susan's brain
const susan = new SusanBrain();

// Initialize Enhanced RoofER Service
const roofERService = new EnhancedRoofERService();

async function runTests() {
    const testQueries = [
        // General knowledge tests
        {
            category: 'Science',
            query: 'Explain photosynthesis in simple terms',
            expectHelpful: true
        },
        {
            category: 'Math',
            query: 'How do you calculate the area of a circle?',
            expectHelpful: true
        },
        {
            category: 'History',
            query: 'Who was the first person to walk on the moon?',
            expectHelpful: true
        },
        {
            category: 'Technology',
            query: 'What is machine learning?',
            expectHelpful: true
        },
        {
            category: 'Cooking',
            query: 'How do you make scrambled eggs?',
            expectHelpful: true
        },
        // Roofing/Insurance tests (should still work with specialized knowledge)
        {
            category: 'Roofing',
            query: 'How do I handle a partial insurance claim denial?',
            expectSpecialized: true
        },
        {
            category: 'Insurance',
            query: 'What template should I use for iTel matching issues?',
            expectSpecialized: true
        },
        {
            category: 'Building Codes',
            query: 'What are the Virginia building codes for roof replacement?',
            expectSpecialized: true
        }
    ];

    console.log('='.repeat(60));
    console.log('TESTING SUSAN\'S GENERAL AI CAPABILITIES');
    console.log('='.repeat(60));

    for (const test of testQueries) {
        console.log(`\n📋 Testing ${test.category}: "${test.query}"`);
        console.log('-'.repeat(50));

        try {
            // Test with main Susan Brain
            const susanResponse = await susan.processMessage(test.query);
            console.log(`🧠 Susan Brain Response:`);
            console.log(`Model: ${susanResponse.model}`);
            console.log(`Response: ${susanResponse.response.substring(0, 200)}${susanResponse.response.length > 200 ? '...' : ''}`);

            // Test with RoofER Service for comparison
            if (test.expectSpecialized) {
                const roofERResponse = await roofERService.processClaimQuery(test.query);
                console.log(`\n🏠 RoofER Service Response:`);
                console.log(`Model: ${roofERResponse.model}`);
                console.log(`IsGeneralQuery: ${roofERResponse.isGeneralQuery || false}`);
                console.log(`Response: ${roofERResponse.response.substring(0, 200)}${roofERResponse.response.length > 200 ? '...' : ''}`);
            } else {
                const roofERResponse = await roofERService.processClaimQuery(test.query);
                console.log(`\n🏠 RoofER Service Response:`);
                console.log(`Model: ${roofERResponse.model}`);
                console.log(`IsGeneralQuery: ${roofERResponse.isGeneralQuery || false}`);
                console.log(`Response: ${roofERResponse.response.substring(0, 200)}${roofERResponse.response.length > 200 ? '...' : ''}`);
            }

            // Analyze response quality
            if (test.expectHelpful) {
                const isHelpful = !roofERResponse.response.includes("we've got roofs to chalk") && 
                                 !roofERResponse.response.includes("keep this about getting you that next bonus");
                console.log(`✅ Response is ${isHelpful ? 'helpful and educational' : '❌ still restricting topics'}`);
            }

        } catch (error) {
            console.log(`❌ Error testing "${test.query}": ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('TESTING ENHANCED ROOFING SERVICE STATS');
    console.log('='.repeat(60));

    try {
        const stats = await roofERService.getKnowledgeStats();
        console.log('📊 Enhanced RoofER Service Statistics:');
        console.log(JSON.stringify(stats, null, 2));
    } catch (error) {
        console.log(`❌ Error getting stats: ${error.message}`);
    }
}

// Run the tests
runTests().then(() => {
    console.log('\n🎉 Testing completed!');
    console.log('\n📝 Summary:');
    console.log('- Susan should now provide helpful responses to ANY topic');
    console.log('- Roofing expertise is preserved for relevant queries');
    console.log('- No more "off-topic" rejections');
    console.log('- Educational and knowledgeable responses across all domains');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
});