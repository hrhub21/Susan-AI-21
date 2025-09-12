/**
 * Quick function test using fetch to verify the page loads and functions exist
 */

import fetch from 'node-fetch';

async function testSusanPage() {
    console.log('🌐 Testing Susan AI page at http://localhost:3003...\n');
    
    try {
        // Test if server is responding
        const response = await fetch('http://localhost:3003');
        if (!response.ok) {
            console.log(`❌ Server not responding: ${response.status}`);
            return;
        }
        
        const html = await response.text();
        console.log('✅ Page loads successfully');
        
        // Also get the JS file directly
        const jsResponse = await fetch('http://localhost:3003/susan-working.js');
        const jsContent = await jsResponse.text();
        console.log('✅ Susan JS file loads successfully');
        
        // Check for required functions in the HTML
        const requiredFunctions = [
            'startSmartPhotoAnalysis',
            'startDamageQuantification',  
            'startPhotoReportGeneration',
            'startPhotoOrganization',
            'startRoofMeasurement',
            'startDamageAnnotation',
            'startComparisonTool',
            'startInsuranceForms',
            'startClaimTemplates',
            'startPolicyAnalysis',
            'startEstimateBuilder',
            'startClaimTracking',
            'startDamageValidation',
            'startDocumentationHub',
            'startMaterialCalculator',
            'startInventoryTracker',
            'startPriceLookup',
            'startOrderManagement',
            'startSupplierDatabase',
            'startStockAlerts',
            'startCustomerPortal',
            'startScheduleManager',
            'startSMSUpdates',
            'startReviewCollection',
            'startProjectDashboard',
            'startContractGenerator',
            'startSafetyProtocols',
            'startWeatherAlerts',
            'startPermitTracker',
            'startQualityChecks',
            'startAIAssistant',
            'startLeadScoring',
            'startPredictiveAnalytics',
            'startWorkflowAutomation'
        ];
        
        let found = 0;
        let missing = [];
        
        console.log('🔍 Checking function presence in source code...\n');
        
        requiredFunctions.forEach((func, index) => {
            if (jsContent.includes(func + '(')) {
                console.log(`✅ ${index + 1}. ${func}`);
                found++;
            } else {
                console.log(`❌ ${index + 1}. ${func} - NOT FOUND IN JS SOURCE`);
                missing.push(func);
            }
        });
        
        console.log('\n📊 ===== STATIC SOURCE ANALYSIS RESULTS =====');
        console.log(`Total Required Functions: ${requiredFunctions.length}`);
        console.log(`Functions Found in Source: ${found}`);
        console.log(`Functions Missing: ${missing.length}`);
        console.log(`Success Rate: ${((found / requiredFunctions.length) * 100).toFixed(1)}%`);
        
        if (missing.length > 0) {
            console.log('\n❌ Missing Functions:');
            missing.forEach((func, i) => console.log(`   ${i + 1}. ${func}`));
        } else {
            console.log('\n🎉 All 34 functions found in source code!');
        }
        
        // Check for key UI elements
        console.log('\n🔧 Checking UI Elements...');
        
        const uiElements = [
            { name: 'Susan Orb', selector: 'susanOrb' },
            { name: 'Features Button', selector: 'featuresBtn' },
            { name: 'Features Menu', selector: 'featuresMenu' },
            { name: 'Chat Messages', selector: 'chatMessages' }
        ];
        
        uiElements.forEach(element => {
            if (html.includes(element.selector)) {
                console.log(`✅ ${element.name} element found`);
            } else {
                console.log(`❌ ${element.name} element missing`);
            }
        });
        
        console.log('\n💡 Recommendations for Live Testing:');
        console.log('1. Open http://localhost:3003 in your browser');
        console.log('2. Open browser console (F12)');
        console.log('3. Run: testSusanFunctions()');
        console.log('4. Click features button and test individual functions');
        
        return {
            totalRequired: requiredFunctions.length,
            found: found,
            missing: missing,
            successRate: (found / requiredFunctions.length) * 100
        };
        
    } catch (error) {
        console.log(`❌ Error testing page: ${error.message}`);
        return null;
    }
}

// Run the test
testSusanPage().catch(console.error);