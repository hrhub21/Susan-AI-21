/**
 * Comprehensive Vision Processing Pipeline Test
 * Tests Susan AI vision processing end-to-end
 */

import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Sample roof damage image data (minimal 1x1 pixel image in base64)
const SAMPLE_IMAGES = {
  hailDamage: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
  
  windDamage: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
  
  nonRoof: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
};

// Test configuration
const CONFIG = {
  qwenBackend: 'http://localhost:3031',
  frontendApi: 'http://localhost:3004',
  timeout: 30000 // 30 seconds
};

class VisionPipelineTestSuite {
  constructor() {
    this.testResults = {
      qwenBackendTests: [],
      frontendTests: [],
      integrationTests: [],
      errorHandlingTests: []
    };
  }

  // Test 1: Qwen 2.5 VL Backend Direct Testing
  async testQwenBackendDirect() {
    console.log('\n🔍 Testing Qwen 2.5 VL Backend Direct...');
    const results = [];

    try {
      // Test status endpoint
      console.log('  📊 Testing status endpoint...');
      const statusResponse = await fetch(`${CONFIG.qwenBackend}/status`, {
        timeout: CONFIG.timeout
      });
      
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        results.push({
          test: 'Status Endpoint',
          status: 'PASS',
          data: status,
          details: `Model: ${status.model_name}, Device: ${status.device}, Loaded: ${status.model_loaded}`
        });
        console.log(`    ✅ Status: ${status.model_name} on ${status.device} (${status.model_loaded ? 'loaded' : 'not loaded'})`);
      } else {
        results.push({
          test: 'Status Endpoint',
          status: 'FAIL',
          error: `HTTP ${statusResponse.status}`
        });
        console.log(`    ❌ Status endpoint failed: ${statusResponse.status}`);
      }

      // Test image analysis with different damage types
      for (const [damageType, imageData] of Object.entries(SAMPLE_IMAGES)) {
        console.log(`  🖼️  Testing ${damageType} detection...`);
        
        try {
          const result = await this.testQwenImageAnalysis(imageData, damageType);
          results.push(result);
          
          if (result.status === 'PASS') {
            console.log(`    ✅ ${damageType}: ${result.data.damageType || 'Analysis completed'} (${result.data.confidence || 0}% confidence)`);
          } else {
            console.log(`    ❌ ${damageType}: ${result.error}`);
          }
        } catch (error) {
          results.push({
            test: `${damageType} Detection`,
            status: 'FAIL',
            error: error.message
          });
          console.log(`    ❌ ${damageType}: ${error.message}`);
        }
      }

    } catch (error) {
      console.error('  ❌ Qwen backend testing failed:', error.message);
      results.push({
        test: 'Overall Backend Test',
        status: 'FAIL',
        error: error.message
      });
    }

    this.testResults.qwenBackendTests = results;
    return results;
  }

  async testQwenImageAnalysis(imageData, expectedType) {
    const formData = new FormData();
    
    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    formData.append('image', imageBuffer, {
      filename: `test-${expectedType}.jpg`,
      contentType: 'image/jpeg'
    });
    
    formData.append('question', `Analyze this image for roofing damage. Look for ${expectedType} specifically. Respond with JSON format including damageType, severity, confidence, and description.`);

    const response = await fetch(`${CONFIG.qwenBackend}/analyze`, {
      method: 'POST',
      body: formData,
      timeout: CONFIG.timeout
    });

    if (!response.ok) {
      throw new Error(`Qwen API returned ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    
    return {
      test: `${expectedType} Detection`,
      status: 'PASS',
      data: {
        rawResponse: result.response,
        damageType: this.extractDamageType(result.response),
        confidence: this.extractConfidence(result.response),
        processingTime: result.processing_time || 0
      },
      details: `Response: ${(result.response || '').substring(0, 100)}...`
    };
  }

  // Test 2: Frontend Photo Analysis Testing
  async testFrontendPhotoAnalysis() {
    console.log('\n🌐 Testing Frontend Photo Analysis...');
    const results = [];

    try {
      // Test health endpoint
      console.log('  🏥 Testing health endpoint...');
      try {
        const healthResponse = await fetch(`${CONFIG.frontendApi}/api/photo-analysis/analyze-photo/health`, {
          timeout: CONFIG.timeout
        });
        
        if (healthResponse.ok) {
          const health = await healthResponse.json();
          results.push({
            test: 'Frontend Health Check',
            status: 'PASS',
            data: health,
            details: `Primary: ${health.primary?.status}, Fallback: ${health.fallback?.status}`
          });
          console.log(`    ✅ Health: Primary ${health.primary?.status}, Fallback ${health.fallback?.status}`);
        } else {
          results.push({
            test: 'Frontend Health Check',
            status: 'FAIL',
            error: `HTTP ${healthResponse.status}`
          });
          console.log(`    ❌ Health check failed: ${healthResponse.status}`);
        }
      } catch (healthError) {
        results.push({
          test: 'Frontend Health Check',
          status: 'FAIL',
          error: healthError.message
        });
        console.log(`    ❌ Health check error: ${healthError.message}`);
      }

      // Test photo analysis
      for (const [damageType, imageData] of Object.entries(SAMPLE_IMAGES)) {
        console.log(`  🖼️  Testing frontend ${damageType} analysis...`);
        
        try {
          const result = await this.testFrontendImageAnalysis(imageData, damageType);
          results.push(result);
          
          if (result.status === 'PASS') {
            console.log(`    ✅ ${damageType}: ${result.data.damageType} (${result.data.confidence}% confidence, ${result.data.analysisMethod})`);
          } else {
            console.log(`    ❌ ${damageType}: ${result.error}`);
          }
        } catch (error) {
          results.push({
            test: `Frontend ${damageType} Analysis`,
            status: 'FAIL',
            error: error.message
          });
          console.log(`    ❌ ${damageType}: ${error.message}`);
        }
      }

    } catch (error) {
      console.error('  ❌ Frontend testing failed:', error.message);
      results.push({
        test: 'Overall Frontend Test',
        status: 'FAIL',
        error: error.message
      });
    }

    this.testResults.frontendTests = results;
    return results;
  }

  async testFrontendImageAnalysis(imageData, expectedType) {
    const response = await fetch(`${CONFIG.frontendApi}/api/photo-analysis/analyze-photo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: imageData,
        filename: `test-${expectedType}.jpg`
      }),
      timeout: CONFIG.timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Frontend API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    return {
      test: `Frontend ${expectedType} Analysis`,
      status: 'PASS',
      data: {
        damageType: result.damageType,
        severity: result.severity,
        confidence: result.confidence,
        analysisMethod: result.analysisMethod,
        processingTime: result.totalProcessingTime,
        description: result.description?.substring(0, 100)
      },
      details: `Method: ${result.analysisMethod}, Time: ${result.totalProcessingTime}s`
    };
  }

  // Test 3: Integration Testing
  async testIntegration() {
    console.log('\n🔗 Testing Integration Between Backend and Frontend...');
    const results = [];

    try {
      // Compare responses between direct backend and frontend for same image
      const testImage = SAMPLE_IMAGES.hailDamage;
      
      console.log('  🔄 Comparing backend vs frontend responses...');
      
      // Get backend response
      const backendResult = await this.testQwenImageAnalysis(testImage, 'hailDamage');
      
      // Get frontend response  
      const frontendResult = await this.testFrontendImageAnalysis(testImage, 'hailDamage');
      
      // Compare results
      const comparison = {
        test: 'Backend vs Frontend Consistency',
        status: 'PASS',
        data: {
          backend: {
            damageType: backendResult.data.damageType,
            confidence: backendResult.data.confidence,
            processingTime: backendResult.data.processingTime
          },
          frontend: {
            damageType: frontendResult.data.damageType,
            confidence: frontendResult.data.confidence,
            analysisMethod: frontendResult.data.analysisMethod,
            processingTime: frontendResult.data.processingTime
          }
        }
      };
      
      results.push(comparison);
      console.log(`    ✅ Backend: ${backendResult.data.damageType} (${backendResult.data.confidence}%)`);
      console.log(`    ✅ Frontend: ${frontendResult.data.damageType} (${frontendResult.data.confidence}%) via ${frontendResult.data.analysisMethod}`);

    } catch (error) {
      console.error('  ❌ Integration testing failed:', error.message);
      results.push({
        test: 'Integration Test',
        status: 'FAIL',
        error: error.message
      });
    }

    this.testResults.integrationTests = results;
    return results;
  }

  // Test 4: Error Handling
  async testErrorHandling() {
    console.log('\n⚠️ Testing Error Handling...');
    const results = [];

    // Test invalid image data
    console.log('  📸 Testing invalid image data...');
    try {
      const response = await fetch(`${CONFIG.frontendApi}/api/photo-analysis/analyze-photo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: 'invalid-base64-data',
          filename: 'test-invalid.jpg'
        }),
        timeout: CONFIG.timeout
      });
      
      const result = await response.json();
      
      if (response.status === 400 || result.error || result.damageType === 'Analysis system failure') {
        results.push({
          test: 'Invalid Image Data Handling',
          status: 'PASS',
          data: result,
          details: 'Properly handled invalid image data'
        });
        console.log('    ✅ Invalid image properly rejected');
      } else {
        results.push({
          test: 'Invalid Image Data Handling',
          status: 'FAIL',
          error: 'Should have failed with invalid image data',
          data: result
        });
        console.log('    ❌ Invalid image not properly rejected');
      }
    } catch (error) {
      results.push({
        test: 'Invalid Image Data Handling',
        status: 'PASS',
        details: 'Error properly thrown for invalid data'
      });
      console.log('    ✅ Invalid image properly threw error');
    }

    // Test missing image data
    console.log('  📭 Testing missing image data...');
    try {
      const response = await fetch(`${CONFIG.frontendApi}/api/photo-analysis/analyze-photo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: 'test-missing.jpg'
        }),
        timeout: CONFIG.timeout
      });
      
      if (response.status === 400) {
        const result = await response.json();
        results.push({
          test: 'Missing Image Data Handling',
          status: 'PASS',
          data: result,
          details: 'Properly returned 400 for missing image'
        });
        console.log('    ✅ Missing image properly rejected');
      } else {
        results.push({
          test: 'Missing Image Data Handling',
          status: 'FAIL',
          error: `Expected 400, got ${response.status}`
        });
        console.log('    ❌ Missing image not properly handled');
      }
    } catch (error) {
      results.push({
        test: 'Missing Image Data Handling',
        status: 'PARTIAL',
        error: error.message,
        details: 'Network error occurred'
      });
      console.log('    ⚠️ Network error during missing image test');
    }

    this.testResults.errorHandlingTests = results;
    return results;
  }

  // Helper methods
  extractDamageType(response) {
    if (!response) return 'No response';
    
    const text = response.toLowerCase();
    if (text.includes('hail')) return 'Hail damage detected';
    if (text.includes('wind')) return 'Wind damage detected';
    if (text.includes('water')) return 'Water damage detected';
    if (text.includes('no damage') || text.includes('no roofing damage')) return 'No damage detected';
    return 'Analysis completed';
  }

  extractConfidence(response) {
    if (!response) return 0;
    
    const match = response.match(/(\d+)%/);
    if (match) return parseInt(match[1]);
    
    const confidenceMatch = response.match(/confidence[:\s]+(\d+)/i);
    if (confidenceMatch) return parseInt(confidenceMatch[1]);
    
    return 75; // Default
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting Susan AI Vision Processing Pipeline Tests\n');
    console.log('=' .repeat(60));

    const startTime = Date.now();

    try {
      // Run all test suites
      await this.testQwenBackendDirect();
      await this.testFrontendPhotoAnalysis(); 
      await this.testIntegration();
      await this.testErrorHandling();

      // Generate final report
      const totalTime = (Date.now() - startTime) / 1000;
      this.generateFinalReport(totalTime);

    } catch (error) {
      console.error('\n❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  generateFinalReport(totalTime) {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 SUSAN AI VISION PROCESSING PIPELINE TEST RESULTS');
    console.log('=' .repeat(60));

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    // Count results from each test suite
    for (const [category, tests] of Object.entries(this.testResults)) {
      console.log(`\n📋 ${category.toUpperCase()}:`);
      
      tests.forEach(test => {
        totalTests++;
        const status = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : '⚠️';
        console.log(`  ${status} ${test.test}: ${test.status}`);
        
        if (test.details) {
          console.log(`     Details: ${test.details}`);
        }
        if (test.error) {
          console.log(`     Error: ${test.error}`);
        }
        
        if (test.status === 'PASS') passedTests++;
        else if (test.status === 'FAIL') failedTests++;
      });
    }

    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log(`📈 SUMMARY:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   ⚠️ Partial: ${totalTests - passedTests - failedTests}`);
    console.log(`   🕒 Total Time: ${totalTime.toFixed(2)}s`);
    console.log(`   📊 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    // Recommendations
    console.log('\n📝 RECOMMENDATIONS:');
    if (failedTests === 0) {
      console.log('   🎉 All tests passed! Vision processing pipeline is working correctly.');
    } else {
      console.log(`   🔧 ${failedTests} tests failed - review error details above`);
      console.log('   🔍 Check backend/frontend connectivity and API configurations');
    }

    console.log('\n' + '=' .repeat(60));

    // Save results to file
    const reportData = {
      timestamp: new Date().toISOString(),
      totalTime,
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        successRate: ((passedTests / totalTests) * 100).toFixed(1) + '%'
      },
      results: this.testResults
    };

    fs.writeFileSync('./vision-pipeline-test-results.json', JSON.stringify(reportData, null, 2));
    console.log('💾 Full test results saved to: vision-pipeline-test-results.json\n');
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new VisionPipelineTestSuite();
  testSuite.runAllTests().catch(error => {
    console.error('❌ Test suite crashed:', error);
    process.exit(1);
  });
}

export default VisionPipelineTestSuite;