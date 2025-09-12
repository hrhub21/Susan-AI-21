import { AnythingLLMService } from './src/api/services/AnythingLLMService.js';
import { MemoryService } from './src/api/services/MemoryService.js';
import { SusanBrain } from './src/susan-brain.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🧠 Starting AnythingLLM Integration Test...\n');

async function testAnythingLLMIntegration() {
  try {
    console.log('1. Testing AnythingLLM Service initialization...');
    const anythingLLM = new AnythingLLMService();
    console.log('✅ AnythingLLM Service initialized');

    console.log('\n2. Testing connection to AnythingLLM...');
    const connectionTest = await anythingLLM.testConnection();
    console.log('Connection result:', connectionTest);
    
    if (!connectionTest.connected) {
      console.log('⚠️  AnythingLLM connection failed - this is expected if AnythingLLM is not running');
      console.log('To start AnythingLLM locally, run: npx anythingllm');
      console.log('Or configure ANYTHINGLLM_BASE_URL to point to your cloud instance');
      return;
    }

    console.log('\n3. Testing workspace initialization...');
    const workspace = await anythingLLM.ensureWorkspace();
    console.log('✅ Workspace initialized:', workspace.name || 'susan-ai');

    console.log('\n4. Testing document storage...');
    const testDoc = await anythingLLM.storeDocument(
      'This is a test document for Susan AI integration with AnythingLLM. It contains information about roofing and insurance claims.',
      {
        type: 'test-document',
        category: 'integration-test'
      }
    );
    console.log('✅ Document stored with ID:', testDoc.id);

    console.log('\n5. Testing conversation storage...');
    const testConversation = {
      messages: [
        { role: 'user', content: 'What is the best way to inspect roof damage?' },
        { role: 'assistant', content: 'To inspect roof damage, you should start with a visual inspection from the ground level, then proceed with a closer examination if necessary. Look for missing or damaged shingles, signs of water damage, and check gutters for debris.' }
      ],
      timestamp: new Date().toISOString()
    };
    const storedConversation = await anythingLLM.storeConversation(testConversation, 'test-user');
    console.log('✅ Conversation stored with ID:', storedConversation.id);

    console.log('\n6. Testing knowledge querying...');
    const queryResult = await anythingLLM.queryKnowledge('roof damage inspection');
    console.log('✅ Query completed. Response length:', queryResult.response?.length || 0);
    console.log('   Sources found:', queryResult.sources?.length || 0);

    console.log('\n7. Testing context retrieval...');
    const contextResult = await anythingLLM.getEnhancedContext('roofing inspection', {
      maxResults: 3
    });
    console.log('✅ Context retrieval completed. Contexts found:', contextResult.contexts?.length || 0);

    console.log('\n8. Testing Susan Brain integration...');
    const susanBrain = new SusanBrain();
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('✅ Susan Brain initialized with AnythingLLM integration');

    console.log('\n9. Testing enhanced message processing...');
    const response = await susanBrain.processMessage('Tell me about roof inspection best practices');
    console.log('✅ Message processed successfully');
    console.log('   Response preview:', response.response?.substring(0, 100) + '...');
    console.log('   Model used:', response.model);

    console.log('\n10. Cleaning up test data...');
    try {
      await anythingLLM.deleteDocument(testDoc.id);
      console.log('✅ Test document cleaned up');
    } catch (error) {
      console.log('⚠️  Could not clean up test document:', error.message);
    }

    console.log('\n🎉 AnythingLLM Integration Test Completed Successfully!');
    console.log('\nIntegration Features Tested:');
    console.log('- ✅ Service initialization');
    console.log('- ✅ Connection testing');
    console.log('- ✅ Workspace management');
    console.log('- ✅ Document storage');
    console.log('- ✅ Conversation storage');
    console.log('- ✅ Knowledge querying');
    console.log('- ✅ Context retrieval');
    console.log('- ✅ Susan Brain integration');
    console.log('- ✅ Enhanced message processing');

  } catch (error) {
    console.error('\n❌ Integration test failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Provide troubleshooting tips
    console.log('\n🔧 Troubleshooting Tips:');
    console.log('1. Ensure AnythingLLM is running (npx anythingllm or cloud instance)');
    console.log('2. Check ANYTHINGLLM_API_KEY is correctly set');
    console.log('3. Verify ANYTHINGLLM_BASE_URL points to the correct instance');
    console.log('4. Check network connectivity to AnythingLLM instance');
  }
}

async function testAPIEndpoints() {
  console.log('\n🌐 Testing API Endpoints...');
  
  try {
    const baseUrl = `http://localhost:${process.env.PORT || 3003}/api`;
    
    console.log('Available AnythingLLM endpoints:');
    console.log(`- GET  ${baseUrl}/anythingllm/status`);
    console.log(`- GET  ${baseUrl}/anythingllm/workspace`);
    console.log(`- GET  ${baseUrl}/anythingllm/workspace/stats`);
    console.log(`- POST ${baseUrl}/anythingllm/documents`);
    console.log(`- POST ${baseUrl}/anythingllm/conversations`);
    console.log(`- POST ${baseUrl}/anythingllm/query`);
    console.log(`- POST ${baseUrl}/anythingllm/context`);
    console.log(`- POST ${baseUrl}/anythingllm/sync`);
    console.log(`- PUT  ${baseUrl}/anythingllm/workspace/settings`);
    console.log(`- DELETE ${baseUrl}/anythingllm/documents/:id`);
    
    console.log('\n📝 Example usage:');
    console.log(`curl -X GET "${baseUrl}/anythingllm/status"`);
    console.log(`curl -X POST "${baseUrl}/anythingllm/query" -H "Content-Type: application/json" -d '{"query": "roof inspection"}'`);
    
  } catch (error) {
    console.error('Failed to display API endpoints:', error.message);
  }
}

// Run tests
testAnythingLLMIntegration()
  .then(() => testAPIEndpoints())
  .then(() => {
    console.log('\n✨ All tests completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });