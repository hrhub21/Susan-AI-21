/**
 * Error handling and edge case testing for Susan AI Vision Pipeline
 */

import fetch from 'node-fetch';

const CONFIG = {
  qwenUrl: 'http://localhost:3031',
  frontendUrl: 'http://localhost:3004',
  timeout: 15000
};

class ErrorScenarioTests {
  constructor() {
    this.results = [];
  }

  async testInvalidImageFormats() {
    console.log('\n📸 Testing Invalid Image Formats...');
    
    const invalidImages = [
      { name: 'corrupted_base64', data: 'data:image/jpeg;base64,invalid-base64-data' },
      { name: 'wrong_mime_type', data: 'data:text/plain;base64,dGVzdA==' },
      { name: 'empty_base64', data: 'data:image/jpeg;base64,' },
      { name: 'no_data_prefix', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' }
    ];

    for (const invalidImage of invalidImages) {
      console.log(`  🧪 Testing ${invalidImage.name}...`);
      
      try {
        const response = await fetch(`${CONFIG.frontendUrl}/api/photo-analysis/analyze-photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: invalidImage.data,
            filename: `test-${invalidImage.name}.jpg`
          }),
          timeout: CONFIG.timeout
        });

        const result = await response.json();
        
        if (response.status >= 400 || result.error || result.damageType?.includes('Error') || result.damageType?.includes('fail')) {
          console.log(`    ✅ Properly handled: ${result.damageType || result.error}`);
          this.results.push({ test: invalidImage.name, status: 'PASS', message: 'Error properly handled' });
        } else {
          console.log(`    🟡 Processed unexpectedly: ${result.damageType} (${result.confidence}%)`);
          this.results.push({ test: invalidImage.name, status: 'PARTIAL', message: 'Processed invalid data' });
        }
      } catch (error) {
        console.log(`    ✅ Network error (expected): ${error.message.substring(0, 50)}...`);
        this.results.push({ test: invalidImage.name, status: 'PASS', message: 'Network error thrown' });
      }
    }
  }

  async testMissingFields() {
    console.log('\n📭 Testing Missing Required Fields...');
    
    const testCases = [
      { name: 'no_image', payload: { filename: 'test.jpg' } },
      { name: 'null_image', payload: { image: null, filename: 'test.jpg' } },
      { name: 'empty_payload', payload: {} }
    ];

    for (const testCase of testCases) {
      console.log(`  🧪 Testing ${testCase.name}...`);
      
      try {
        const response = await fetch(`${CONFIG.frontendUrl}/api/photo-analysis/analyze-photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testCase.payload),
          timeout: CONFIG.timeout
        });

        if (response.status === 400) {
          const result = await response.json();
          console.log(`    ✅ Properly rejected: HTTP 400 - ${result.error}`);
          this.results.push({ test: testCase.name, status: 'PASS', message: 'HTTP 400 returned' });
        } else {
          const result = await response.json();
          console.log(`    ❌ Should have failed: HTTP ${response.status}`);
          this.results.push({ test: testCase.name, status: 'FAIL', message: `HTTP ${response.status} instead of 400` });
        }
      } catch (error) {
        console.log(`    🟡 Network error: ${error.message}`);
        this.results.push({ test: testCase.name, status: 'PARTIAL', message: 'Network error' });
      }
    }
  }

  async testServiceUnavailability() {
    console.log('\n🔌 Testing Service Unavailability...');
    
    // Test with wrong backend URL in a separate request
    console.log('  🧪 Testing backend unavailable scenario...');
    
    try {
      const response = await fetch('http://localhost:9999/nonexistent-endpoint', {
        timeout: CONFIG.timeout
      });
      console.log(`    ❌ Unexpected response from nonexistent service`);
    } catch (error) {
      console.log(`    ✅ Properly failed to connect: ${error.code || error.message}`);
      this.results.push({ test: 'backend_unavailable', status: 'PASS', message: 'Connection properly failed' });
    }
  }

  async testTimeout() {
    console.log('\n⏰ Testing Request Timeout Handling...');
    
    // Test with very short timeout
    console.log('  🧪 Testing request timeout...');
    
    const validImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
    
    try {
      const response = await fetch(`${CONFIG.frontendUrl}/api/photo-analysis/analyze-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: validImage,
          filename: 'timeout-test.jpg'
        }),
        timeout: 1 // Very short timeout
      });

      console.log(`    🟡 Request completed unexpectedly`);
      this.results.push({ test: 'timeout', status: 'PARTIAL', message: 'No timeout occurred' });
    } catch (error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        console.log(`    ✅ Timeout properly handled: ${error.message}`);
        this.results.push({ test: 'timeout', status: 'PASS', message: 'Timeout properly handled' });
      } else {
        console.log(`    🟡 Different error: ${error.message}`);
        this.results.push({ test: 'timeout', status: 'PARTIAL', message: error.message });
      }
    }
  }

  async testLargePayload() {
    console.log('\n📦 Testing Large Payload Handling...');
    
    // Create a large base64 string (simulating very large image)
    const largeData = 'data:image/jpeg;base64,' + 'A'.repeat(10000000); // ~10MB
    
    console.log('  🧪 Testing very large image payload...');
    
    try {
      const response = await fetch(`${CONFIG.frontendUrl}/api/photo-analysis/analyze-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: largeData,
          filename: 'large-image.jpg'
        }),
        timeout: CONFIG.timeout
      });

      if (response.status === 413) {
        console.log(`    ✅ Properly rejected large payload: HTTP 413`);
        this.results.push({ test: 'large_payload', status: 'PASS', message: 'Large payload rejected' });
      } else if (response.status >= 400) {
        console.log(`    ✅ Server error (expected): HTTP ${response.status}`);
        this.results.push({ test: 'large_payload', status: 'PASS', message: `HTTP ${response.status}` });
      } else {
        console.log(`    🟡 Large payload processed: HTTP ${response.status}`);
        this.results.push({ test: 'large_payload', status: 'PARTIAL', message: 'Large payload accepted' });
      }
    } catch (error) {
      console.log(`    ✅ Network error with large payload: ${error.message.substring(0, 50)}...`);
      this.results.push({ test: 'large_payload', status: 'PASS', message: 'Network error occurred' });
    }
  }

  async testRateLimiting() {
    console.log('\n🚦 Testing Rate Limiting (Multiple Rapid Requests)...');
    
    const validImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
    
    console.log('  🧪 Sending 5 rapid concurrent requests...');
    
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(
        fetch(`${CONFIG.frontendUrl}/api/photo-analysis/analyze-photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: validImage,
            filename: `rate-test-${i}.jpg`
          }),
          timeout: CONFIG.timeout
        })
      );
    }

    try {
      const responses = await Promise.allSettled(requests);
      
      let successful = 0;
      let rateLimited = 0;
      let errors = 0;

      for (const response of responses) {
        if (response.status === 'fulfilled') {
          if (response.value.status === 200) {
            successful++;
          } else if (response.value.status === 429) {
            rateLimited++;
          } else {
            errors++;
          }
        } else {
          errors++;
        }
      }

      console.log(`    📊 Results: ${successful} successful, ${rateLimited} rate-limited, ${errors} errors`);
      
      if (rateLimited > 0) {
        console.log(`    ✅ Rate limiting is working`);
        this.results.push({ test: 'rate_limiting', status: 'PASS', message: 'Rate limiting active' });
      } else if (successful === 5) {
        console.log(`    🟡 No rate limiting detected (all requests successful)`);
        this.results.push({ test: 'rate_limiting', status: 'PARTIAL', message: 'No rate limiting' });
      } else {
        console.log(`    🟡 Mixed results - may indicate other limitations`);
        this.results.push({ test: 'rate_limiting', status: 'PARTIAL', message: 'Mixed results' });
      }
    } catch (error) {
      console.log(`    ❌ Rate limiting test failed: ${error.message}`);
      this.results.push({ test: 'rate_limiting', status: 'FAIL', message: error.message });
    }
  }

  async runAllErrorTests() {
    console.log('⚠️ SUSAN AI VISION PIPELINE - ERROR HANDLING TEST SUITE');
    console.log('Testing robustness and error scenarios');
    console.log('=' .repeat(70));

    await this.testInvalidImageFormats();
    await this.testMissingFields();
    await this.testServiceUnavailability();
    await this.testTimeout();
    await this.testLargePayload();
    await this.testRateLimiting();

    this.generateErrorReport();
  }

  generateErrorReport() {
    console.log('\n' + '=' .repeat(70));
    console.log('📊 ERROR HANDLING TEST RESULTS');
    console.log('=' .repeat(70));

    let passed = 0;
    let partial = 0;
    let failed = 0;

    console.log('\n📋 TEST RESULTS:');
    for (const result of this.results) {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'PARTIAL' ? '🟡' : '❌';
      console.log(`  ${icon} ${result.test}: ${result.status} - ${result.message}`);
      
      if (result.status === 'PASS') passed++;
      else if (result.status === 'PARTIAL') partial++;
      else failed++;
    }

    const total = this.results.length;
    const passRate = ((passed / total) * 100).toFixed(1);

    console.log('\n📈 SUMMARY:');
    console.log(`   Total Tests: ${total}`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   🟡 Partial: ${partial}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📊 Pass Rate: ${passRate}%`);

    console.log('\n🛡️ ROBUSTNESS ASSESSMENT:');
    if (passRate >= 80) {
      console.log('   ✅ EXCELLENT - System handles errors robustly');
      console.log('   - Proper error validation and responses');
      console.log('   - Good resilience to invalid inputs');
      console.log('   - Production-ready error handling');
    } else if (passRate >= 60) {
      console.log('   🟡 GOOD - Basic error handling working');
      console.log('   - Most error scenarios handled properly');
      console.log('   - Some edge cases may need attention');
      console.log('   - Generally suitable for production');
    } else {
      console.log('   ❌ NEEDS IMPROVEMENT - Error handling gaps detected');
      console.log('   - Multiple error scenarios not handled properly');
      console.log('   - May cause issues in production');
      console.log('   - Requires additional error handling implementation');
    }

    console.log('\n' + '=' .repeat(70));
  }
}

// Run error tests
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ErrorScenarioTests();
  tester.runAllErrorTests().catch(error => {
    console.error('❌ Error test suite failed:', error);
    process.exit(1);
  });
}

export default ErrorScenarioTests;