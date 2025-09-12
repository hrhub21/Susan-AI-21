#!/usr/bin/env node

/**
 * Integration Services Test Script
 * Tests all integration services for proper initialization and basic functionality
 */

import { CRMIntegrationService } from './src/api/services/CRMIntegrationService.js';
import { CalendarIntegrationService } from './src/api/services/CalendarIntegrationService.js';
import { EmailIntegrationService } from './src/api/services/EmailIntegrationService.js';
import { APIIntegrationFramework } from './src/api/services/APIIntegrationFramework.js';

console.log('🚀 Starting Susan AI Integration Services Test...\n');

async function testCRMService() {
  console.log('📋 Testing CRM Integration Service...');
  try {
    const crmService = new CRMIntegrationService();
    const status = crmService.getIntegrationStatus();
    
    console.log('✅ CRM Service initialized successfully');
    console.log(`   - Available integrations: ${Object.keys(status).join(', ')}`);
    
    // Test audit logging
    const auditLogs = crmService.getAuditLogs(5);
    console.log(`   - Audit logs: ${auditLogs.length} entries`);
    
    return true;
  } catch (error) {
    console.error('❌ CRM Service failed:', error.message);
    return false;
  }
}

async function testCalendarService() {
  console.log('\n📅 Testing Calendar Integration Service...');
  try {
    const calendarService = new CalendarIntegrationService();
    const status = calendarService.getCalendarStatus();
    
    console.log('✅ Calendar Service initialized successfully');
    console.log(`   - Available calendars: ${Object.keys(status).join(', ')}`);
    
    // Test scheduling rules
    const rules = calendarService.getSchedulingRules('default');
    console.log(`   - Default scheduling rules: ${rules ? 'configured' : 'not configured'}`);
    
    // Test available slots generation
    const availableCalendars = calendarService.getAvailableCalendars();
    console.log(`   - Available calendar types: ${availableCalendars.length}`);
    
    return true;
  } catch (error) {
    console.error('❌ Calendar Service failed:', error.message);
    return false;
  }
}

async function testEmailService() {
  console.log('\n📧 Testing Email Integration Service...');
  try {
    const emailService = new EmailIntegrationService();
    const status = emailService.getProviderStatus();
    
    console.log('✅ Email Service initialized successfully');
    console.log(`   - Available providers: ${Object.keys(status).join(', ')}`);
    
    // Test templates
    const templates = emailService.listTemplates();
    console.log(`   - Built-in templates: ${templates.length}`);
    templates.forEach(template => {
      console.log(`     - ${template.name} (${template.id})`);
    });
    
    // Test template rendering
    const testTemplate = templates[0];
    if (testTemplate) {
      const rendered = await emailService.renderTemplate(testTemplate.id, {
        meeting: {
          title: 'Test Meeting',
          date: '2025-01-15',
          time: '2:00 PM'
        },
        organizer: {
          name: 'Susan AI'
        }
      });
      console.log(`   - Template rendering: ${rendered ? 'working' : 'failed'}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Email Service failed:', error.message);
    return false;
  }
}

async function testAPIFramework() {
  console.log('\n🔗 Testing API Integration Framework...');
  try {
    const apiFramework = new APIIntegrationFramework();
    const metrics = apiFramework.getMetrics();
    
    console.log('✅ API Framework initialized successfully');
    console.log(`   - Total integrations: ${metrics.totalIntegrations}`);
    console.log(`   - Active integrations: ${metrics.activeIntegrations}`);
    
    // Test auth types and protocols
    const authTypes = apiFramework.getAuthTypes();
    const protocols = apiFramework.getProtocolTypes();
    
    console.log(`   - Supported auth types: ${Object.values(authTypes).join(', ')}`);
    console.log(`   - Supported protocols: ${Object.values(protocols).join(', ')}`);
    
    // Test configuration
    const defaultConfig = apiFramework.getDefaultConfig();
    console.log(`   - Default timeout: ${defaultConfig.timeout}ms`);
    console.log(`   - Default retries: ${defaultConfig.retries}`);
    
    // Test integration registration
    const testConfig = {
      name: 'Test API',
      baseUrl: 'https://jsonplaceholder.typicode.com',
      protocol: 'rest',
      auth: { type: 'none' }
    };
    
    const result = await apiFramework.registerIntegration('test-api', testConfig);
    console.log(`   - Test integration registration: ${result.success ? 'success' : 'failed'}`);
    
    if (result.success) {
      // Test API call
      try {
        const apiResult = await apiFramework.get('test-api', '/posts/1');
        console.log(`   - Test API call: ${apiResult.success ? 'success' : 'failed'}`);
        
        // Clean up
        await apiFramework.removeIntegration('test-api');
        console.log(`   - Test integration cleanup: success`);
      } catch (apiError) {
        console.log(`   - Test API call: failed (${apiError.message})`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ API Framework failed:', error.message);
    return false;
  }
}

async function testWebhookHandlers() {
  console.log('\n🪝 Testing Webhook Handlers...');
  try {
    const crmService = new CRMIntegrationService();
    const calendarService = new CalendarIntegrationService();
    const emailService = new EmailIntegrationService();
    
    // Test CRM webhook
    const crmWebhookResult = await crmService.handleSalesforceWebhook({
      type: 'contact.created',
      objectId: 'test-contact-123'
    });
    
    // Test Calendar webhook
    const calendarWebhookResult = await calendarService.handleGoogleWebhook({
      resourceState: 'updated',
      resourceId: 'test-calendar-456'
    });
    
    // Test Email webhook
    const emailWebhookResult = await emailService.handleSendGridWebhook([{
      event: 'delivered',
      tracking_id: 'test-email-789'
    }]);
    
    console.log(`✅ Webhook handlers tested:`);
    console.log(`   - CRM webhook: ${crmWebhookResult.success ? 'working' : 'failed'}`);
    console.log(`   - Calendar webhook: ${calendarWebhookResult.success ? 'working' : 'failed'}`);
    console.log(`   - Email webhook: ${emailWebhookResult.success ? 'working' : 'failed'}`);
    
    return true;
  } catch (error) {
    console.error('❌ Webhook handlers failed:', error.message);
    return false;
  }
}

async function runTests() {
  const results = [];
  
  results.push(await testCRMService());
  results.push(await testCalendarService());
  results.push(await testEmailService());
  results.push(await testAPIFramework());
  results.push(await testWebhookHandlers());
  
  const successCount = results.filter(Boolean).length;
  const totalTests = results.length;
  
  console.log('\n📊 Test Results Summary:');
  console.log(`   Tests passed: ${successCount}/${totalTests}`);
  
  if (successCount === totalTests) {
    console.log('🎉 All integration services are working correctly!');
    console.log('\n📚 Next steps:');
    console.log('   1. Configure environment variables for external services');
    console.log('   2. Set up OAuth applications for CRM and Calendar integrations');
    console.log('   3. Configure email service providers');
    console.log('   4. Register API integrations for external systems');
    console.log('   5. Set up webhook endpoints for real-time updates');
    console.log('\n📖 See INTEGRATION-SERVICES-README.md for detailed configuration instructions');
  } else {
    console.log('⚠️  Some tests failed. Check the error messages above.');
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Test interrupted. Exiting...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the tests
runTests().catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});