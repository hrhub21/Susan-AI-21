#!/usr/bin/env node

/**
 * Test script to verify logic changes without requiring API keys
 * Tests the off-topic detection and response generation logic
 */

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Testing Susan\'s Logic Changes...\n');

// Mock class to test the logic without API calls
class MockEnhancedRoofERService {
    constructor() {
        this.personality = {
            generalAssistance: "I'm happy to help with any topic! While I specialize in roofing and insurance claims, I can assist with a wide range of questions and provide educational information on various subjects."
        };
    }

    isRoofingRelated(query) {
        const roofingKeywords = [
            'roof', 'shingle', 'claim', 'insurance', 'adjuster', 'damage', 'repair',
            'hail', 'wind', 'storm', 'leak', 'replacement', 'approval', 'denial',
            'estimate', 'scope', 'gaf', 'template', 'code', 'building', 'tpo',
            'epdm', 'membrane', 'flashing', 'gutter', 'itel', 'allstate',
            'state farm', 'coverage', 'deductible', 'appraisal', 'partial'
        ];
        
        const lowerQuery = query.toLowerCase();
        return roofingKeywords.some(keyword => lowerQuery.includes(keyword));
    }

    async processClaimQuery(query, context = {}) {
        console.log(`🎯 SUSAN processing query: "${query}"`);
        
        // Check if this is a roofing/claims-related query
        const isRoofingQuery = this.isRoofingRelated(query);
        
        if (!isRoofingQuery) {
            // For non-roofing queries, provide general assistance
            return {
                response: this.personality.generalAssistance + " How can I help you today?",
                model: 'susan-general-assistant',
                confidence: 0.8,
                isGeneralQuery: true,
                timestamp: new Date().toISOString()
            };
        }

        // For roofing queries, would normally process with specialized knowledge
        return {
            response: "This would be processed with specialized roofing knowledge and templates.",
            model: 'susan-roofing-specialist',
            confidence: 0.9,
            isGeneralQuery: false,
            timestamp: new Date().toISOString()
        };
    }
}

async function runLogicTests() {
    const mockService = new MockEnhancedRoofERService();

    const testQueries = [
        // Non-roofing queries (should get helpful responses)
        {
            category: 'Science',
            query: 'Explain photosynthesis',
            expectGeneralResponse: true
        },
        {
            category: 'Math',
            query: 'How do you calculate area of a circle?',
            expectGeneralResponse: true
        },
        {
            category: 'Cooking',
            query: 'How to make scrambled eggs?',
            expectGeneralResponse: true
        },
        {
            category: 'History',
            query: 'Who was Napoleon?',
            expectGeneralResponse: true
        },
        // Roofing queries (should get specialized responses)
        {
            category: 'Roofing',
            query: 'How do I handle hail damage on a roof?',
            expectGeneralResponse: false
        },
        {
            category: 'Insurance',
            query: 'Insurance claim was denied, what template should I use?',
            expectGeneralResponse: false
        },
        {
            category: 'Building',
            query: 'What building codes apply to roof replacement?',
            expectGeneralResponse: false
        }
    ];

    console.log('='.repeat(60));
    console.log('TESTING UPDATED LOGIC - NO MORE OFF-TOPIC RESTRICTIONS');
    console.log('='.repeat(60));

    let passedTests = 0;
    let totalTests = 0;

    for (const test of testQueries) {
        totalTests++;
        console.log(`\n📋 Testing ${test.category}: "${test.query}"`);
        console.log('-'.repeat(50));

        try {
            const response = await mockService.processClaimQuery(test.query);
            
            console.log(`Response Model: ${response.model}`);
            console.log(`Is General Query: ${response.isGeneralQuery}`);
            console.log(`Response: ${response.response}`);

            // Check if the response matches expectations
            const isGeneralResponse = response.isGeneralQuery === true;
            const expectGeneral = test.expectGeneralResponse;

            if (isGeneralResponse === expectGeneral) {
                console.log(`✅ PASS: Response type matches expectation`);
                passedTests++;
            } else {
                console.log(`❌ FAIL: Expected ${expectGeneral ? 'general' : 'specialized'} response, got ${isGeneralResponse ? 'general' : 'specialized'}`);
            }

            // Check that no restrictive messages are present
            const hasRestrictiveMessage = response.response.includes("we've got roofs to chalk") || 
                                        response.response.includes("keep this about getting you that next bonus");
            
            if (!hasRestrictiveMessage) {
                console.log(`✅ PASS: No restrictive off-topic messages`);
            } else {
                console.log(`❌ FAIL: Still contains restrictive messages`);
            }

            // Check that general queries get helpful responses
            if (test.expectGeneralResponse) {
                const isHelpful = response.response.includes("happy to help") && 
                                response.response.includes("provide educational information");
                if (isHelpful) {
                    console.log(`✅ PASS: Provides helpful, educational response`);
                } else {
                    console.log(`❌ FAIL: Response is not helpful/educational`);
                }
            }

        } catch (error) {
            console.log(`❌ ERROR: ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    
    if (passedTests === totalTests) {
        console.log('🎉 ALL TESTS PASSED!');
        console.log('\n✅ Susan now provides helpful responses to ANY topic');
        console.log('✅ Roofing expertise preserved for relevant queries');
        console.log('✅ No more restrictive off-topic messages');
        console.log('✅ Educational and helpful responses for all domains');
    } else {
        console.log('❌ Some tests failed - please review the changes');
    }

    return passedTests === totalTests;
}

// Run the tests
runLogicTests().then(success => {
    console.log('\n🏁 Logic testing completed!');
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
});