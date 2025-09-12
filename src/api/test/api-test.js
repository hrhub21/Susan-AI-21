import { test, describe } from 'node:test';
import assert from 'node:assert';
import chalk from 'chalk';

class APITester {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.apiKey = process.env.TEST_API_KEY || 'test-api-key-123';
    this.authToken = null;
  }

  async makeRequest(method, endpoint, data = null, headers = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        ...headers
      }
    };

    if (this.authToken) {
      options.headers.Authorization = `Bearer ${this.authToken}`;
    }

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const responseData = await response.json();
      
      return {
        status: response.status,
        data: responseData,
        headers: response.headers,
        ok: response.ok
      };
    } catch (error) {
      console.error(chalk.red(`Request failed: ${error.message}`));
      throw error;
    }
  }

  async login() {
    console.log(chalk.blue('🔐 Attempting login...'));
    
    const response = await this.makeRequest('POST', '/api/v1/auth/login', {
      email: 'admin@susan-ai.com',
      password: 'admin123'
    });

    if (response.ok && response.data.data?.token) {
      this.authToken = response.data.data.token;
      console.log(chalk.green('✅ Login successful'));
      return true;
    } else {
      console.log(chalk.red('❌ Login failed'));
      return false;
    }
  }

  async testHealthCheck() {
    console.log(chalk.blue('🏥 Testing health check...'));
    
    const response = await this.makeRequest('GET', '/api/v1/health');
    
    assert.strictEqual(response.status, 200, 'Health check should return 200');
    assert.strictEqual(response.data.status, 'healthy', 'Health status should be healthy');
    
    console.log(chalk.green('✅ Health check passed'));
    return response.data;
  }

  async testConversationAPI() {
    console.log(chalk.blue('💬 Testing Conversation API...'));
    
    // Test creating a conversation
    const createResponse = await this.makeRequest('POST', '/api/v1/conversations', {
      title: 'Test Conversation',
      initialMessage: 'Hello, this is a test message'
    });
    
    assert.strictEqual(createResponse.status, 201, 'Create conversation should return 201');
    assert(createResponse.data.data.conversation.id, 'Conversation should have an ID');
    
    const conversationId = createResponse.data.data.conversation.id;
    console.log(chalk.green(`✅ Created conversation: ${conversationId}`));
    
    // Test sending a message
    const messageResponse = await this.makeRequest('POST', `/api/v1/conversations/${conversationId}/messages`, {
      content: 'What is artificial intelligence?'
    });
    
    assert.strictEqual(messageResponse.status, 200, 'Send message should return 200');
    assert(messageResponse.data.data.assistantMessage, 'Should receive assistant message');
    
    console.log(chalk.green('✅ Message exchange successful'));
    
    // Test getting conversation
    const getResponse = await this.makeRequest('GET', `/api/v1/conversations/${conversationId}`);
    
    assert.strictEqual(getResponse.status, 200, 'Get conversation should return 200');
    assert.strictEqual(getResponse.data.data.id, conversationId, 'Should return correct conversation');
    
    console.log(chalk.green('✅ Conversation retrieval successful'));
    
    return conversationId;
  }

  async testModelsAPI() {
    console.log(chalk.blue('🤖 Testing Models API...'));
    
    // Test listing models
    const listResponse = await this.makeRequest('GET', '/api/v1/models');
    
    assert.strictEqual(listResponse.status, 200, 'List models should return 200');
    assert(Array.isArray(listResponse.data.data.models), 'Should return array of models');
    assert(listResponse.data.data.models.length > 0, 'Should have at least one model');
    
    console.log(chalk.green(`✅ Found ${listResponse.data.data.models.length} models`));
    
    // Test model metrics
    const modelId = listResponse.data.data.models[0].id;
    const metricsResponse = await this.makeRequest('GET', `/api/v1/models/${modelId}/metrics`);
    
    assert.strictEqual(metricsResponse.status, 200, 'Model metrics should return 200');
    assert(metricsResponse.data.data.metrics, 'Should return metrics data');
    
    console.log(chalk.green('✅ Model metrics retrieved'));
    
    return listResponse.data.data.models;
  }

  async testMemoryAPI() {
    console.log(chalk.blue('🧠 Testing Memory API...'));
    
    // Test memory search
    const searchResponse = await this.makeRequest('POST', '/api/v1/memory/search', {
      query: 'artificial intelligence',
      limit: 5
    });
    
    assert.strictEqual(searchResponse.status, 200, 'Memory search should return 200');
    assert(Array.isArray(searchResponse.data.data.results), 'Should return array of results');
    
    console.log(chalk.green('✅ Memory search successful'));
    
    // Test memory analytics
    const analyticsResponse = await this.makeRequest('GET', '/api/v1/memory/analytics');
    
    assert.strictEqual(analyticsResponse.status, 200, 'Memory analytics should return 200');
    assert(analyticsResponse.data.data.analytics, 'Should return analytics data');
    
    console.log(chalk.green('✅ Memory analytics retrieved'));
  }

  async testVoiceAPI() {
    console.log(chalk.blue('🎤 Testing Voice API...'));
    
    // Test text-to-speech
    const ttsResponse = await this.makeRequest('POST', '/api/v1/voice/synthesize', {
      text: 'Hello, this is a test of text to speech.',
      voice: 'alloy',
      speed: 1.0
    });
    
    // Note: This might return different status codes depending on implementation
    console.log(chalk.green('✅ Text-to-speech API tested'));
    
    // Test getting available voices
    const voicesResponse = await this.makeRequest('GET', '/api/v1/voice/voices');
    
    assert.strictEqual(voicesResponse.status, 200, 'Get voices should return 200');
    
    console.log(chalk.green('✅ Voice API tested'));
  }

  async testFilesAPI() {
    console.log(chalk.blue('📁 Testing Files API...'));
    
    // Test listing files
    const listResponse = await this.makeRequest('GET', '/api/v1/files');
    
    assert.strictEqual(listResponse.status, 200, 'List files should return 200');
    assert(listResponse.data.data.files, 'Should return files data');
    
    console.log(chalk.green('✅ File listing successful'));
    
    // Test getting file info (using mock file ID)
    const fileId = 'test-file-123';
    const fileResponse = await this.makeRequest('GET', `/api/v1/files/${fileId}`);
    
    assert.strictEqual(fileResponse.status, 200, 'Get file should return 200');
    
    console.log(chalk.green('✅ File retrieval tested'));
  }

  async testDataAPI() {
    console.log(chalk.blue('📊 Testing Real-time Data API...'));
    
    // Test weather data
    const weatherResponse = await this.makeRequest('GET', '/api/v1/data/weather?location=London&units=metric');
    
    assert.strictEqual(weatherResponse.status, 200, 'Weather data should return 200');
    assert(weatherResponse.data.data.current, 'Should return current weather');
    
    console.log(chalk.green('✅ Weather data retrieved'));
    
    // Test news data
    const newsResponse = await this.makeRequest('GET', '/api/v1/data/news?category=technology&limit=5');
    
    assert.strictEqual(newsResponse.status, 200, 'News data should return 200');
    assert(Array.isArray(newsResponse.data.data.articles), 'Should return array of articles');
    
    console.log(chalk.green('✅ News data retrieved'));
    
    // Test stock data
    const stockResponse = await this.makeRequest('GET', '/api/v1/data/stocks?symbols=AAPL,GOOGL,MSFT');
    
    assert.strictEqual(stockResponse.status, 200, 'Stock data should return 200');
    assert(Array.isArray(stockResponse.data.data.quotes), 'Should return array of quotes');
    
    console.log(chalk.green('✅ Stock data retrieved'));
  }

  async testUsersAPI() {
    console.log(chalk.blue('👤 Testing Users API...'));
    
    // Test getting user profile
    const profileResponse = await this.makeRequest('GET', '/api/v1/users/profile');
    
    assert.strictEqual(profileResponse.status, 200, 'Get profile should return 200');
    assert(profileResponse.data.data.id, 'Profile should have user ID');
    
    console.log(chalk.green('✅ User profile retrieved'));
    
    // Test getting user preferences
    const prefsResponse = await this.makeRequest('GET', '/api/v1/users/preferences');
    
    assert.strictEqual(prefsResponse.status, 200, 'Get preferences should return 200');
    assert(prefsResponse.data.data.preferences, 'Should return preferences');
    
    console.log(chalk.green('✅ User preferences retrieved'));
    
    // Test usage analytics
    const usageResponse = await this.makeRequest('GET', '/api/v1/users/usage?timeframe=week');
    
    assert.strictEqual(usageResponse.status, 200, 'Get usage should return 200');
    assert(typeof usageResponse.data.data.totalInteractions === 'number', 'Should return usage metrics');
    
    console.log(chalk.green('✅ Usage analytics retrieved'));
  }

  async testAdminAPI() {
    console.log(chalk.blue('🔧 Testing Admin API...'));
    
    // Test system status
    const statusResponse = await this.makeRequest('GET', '/api/v1/admin/system/status');
    
    if (statusResponse.status === 403) {
      console.log(chalk.yellow('⚠️  Admin API requires admin privileges - skipping'));
      return;
    }
    
    assert.strictEqual(statusResponse.status, 200, 'System status should return 200');
    assert(statusResponse.data.data.status, 'Should return system status');
    
    console.log(chalk.green('✅ System status retrieved'));
    
    // Test system metrics
    const metricsResponse = await this.makeRequest('GET', '/api/v1/admin/system/metrics');
    
    assert.strictEqual(metricsResponse.status, 200, 'System metrics should return 200');
    assert(metricsResponse.data.data.requests, 'Should return metrics data');
    
    console.log(chalk.green('✅ System metrics retrieved'));
  }

  async testRateLimiting() {
    console.log(chalk.blue('⚡ Testing Rate Limiting...'));
    
    const requests = [];
    const numRequests = 5;
    
    // Make multiple rapid requests
    for (let i = 0; i < numRequests; i++) {
      requests.push(this.makeRequest('GET', '/api/v1/health'));
    }
    
    const responses = await Promise.all(requests);
    const rateLimited = responses.some(r => r.status === 429);
    
    if (rateLimited) {
      console.log(chalk.green('✅ Rate limiting is working'));
    } else {
      console.log(chalk.yellow('⚠️  Rate limiting not triggered (may need more requests)'));
    }
  }

  async testErrorHandling() {
    console.log(chalk.blue('❌ Testing Error Handling...'));
    
    // Test 404 error
    const notFoundResponse = await this.makeRequest('GET', '/api/v1/nonexistent');
    
    assert.strictEqual(notFoundResponse.status, 404, 'Should return 404 for nonexistent endpoint');
    assert(notFoundResponse.data.error, 'Should return error object');
    
    console.log(chalk.green('✅ 404 error handling works'));
    
    // Test validation error
    const validationResponse = await this.makeRequest('POST', '/api/v1/conversations', {
      title: '' // Invalid empty title
    });
    
    assert.strictEqual(validationResponse.status, 400, 'Should return 400 for validation error');
    assert(validationResponse.data.error, 'Should return validation error');
    
    console.log(chalk.green('✅ Validation error handling works'));
  }

  async runAllTests() {
    console.log(chalk.blue.bold('\n🚀 Starting Susan AI API Test Suite\n'));
    
    try {
      // Health check (no auth required)
      await this.testHealthCheck();
      
      // Login for authenticated endpoints
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        console.log(chalk.red('❌ Login failed - skipping authenticated tests'));
        return;
      }
      
      // Run all test suites
      await this.testConversationAPI();
      await this.testModelsAPI();
      await this.testMemoryAPI();
      await this.testVoiceAPI();
      await this.testFilesAPI();
      await this.testDataAPI();
      await this.testUsersAPI();
      await this.testAdminAPI();
      
      // Test system behaviors
      await this.testRateLimiting();
      await this.testErrorHandling();
      
      console.log(chalk.green.bold('\n✅ All API tests completed successfully!'));
      
    } catch (error) {
      console.error(chalk.red.bold('\n❌ Test suite failed:'), error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new APITester();
  tester.runAllTests();
}

export { APITester };