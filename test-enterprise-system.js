#!/usr/bin/env node

/**
 * Basic validation test for Enterprise Multi-User Dashboard and RBAC systems
 */

import { EnterpriseUserManagementService } from './src/api/services/EnterpriseUserManagementService.js';
import { RoleBasedAccessControlService } from './src/api/services/RoleBasedAccessControlService.js';

async function testEnterpriseSystem() {
  console.log('🚀 Testing Susan AI Enterprise Multi-User Dashboard & RBAC System');
  console.log('=' .repeat(70));

  let enterpriseService, rbacService;
  let testResults = {
    enterpriseService: false,
    rbacService: false,
    organizationCreation: false,
    userCreation: false,
    permissionCheck: false,
    featureAccess: false,
    dataPolicy: false,
    auditLogging: false
  };

  try {
    // Test 1: Initialize Enterprise Service
    console.log('\n📋 Test 1: Enterprise User Management Service');
    enterpriseService = new EnterpriseUserManagementService();
    
    console.log('✅ Service initialized successfully');
    console.log(`   - User Roles: ${enterpriseService.userRoles.size}`);
    console.log(`   - Organization Types: ${enterpriseService.organizationTypes.size}`);
    console.log(`   - Initial Organizations: ${enterpriseService.organizations.size}`);
    console.log(`   - Initial Users: ${enterpriseService.users.size}`);
    console.log(`   - Initial Teams: ${enterpriseService.teams.size}`);
    
    testResults.enterpriseService = true;

  } catch (error) {
    console.log('❌ Enterprise Service initialization failed:', error.message);
  }

  try {
    // Test 2: Initialize RBAC Service
    console.log('\n🔐 Test 2: Role-Based Access Control Service');
    rbacService = new RoleBasedAccessControlService(enterpriseService);
    
    console.log('✅ RBAC Service initialized successfully');
    console.log(`   - Permission Categories: ${rbacService.permissionCategories.size}`);
    console.log(`   - Data Access Policies: ${rbacService.dataAccessPolicies.size}`);
    console.log(`   - Feature Controls: ${rbacService.featureControls.size}`);
    console.log(`   - Initial Roles: ${rbacService.roles.size}`);
    console.log(`   - Initial Permissions: ${rbacService.permissions.size}`);
    
    testResults.rbacService = true;

  } catch (error) {
    console.log('❌ RBAC Service initialization failed:', error.message);
  }

  if (enterpriseService && rbacService) {
    try {
      // Test 3: Create Organization
      console.log('\n🏢 Test 3: Organization Creation');
      
      const timestamp = Date.now();
      const organizationData = {
        name: `Test Insurance Company ${timestamp}`,
        type: 'insurance_company',
        domain: `test-insurance-${timestamp}.com`,
        adminUser: {
          email: `admin-${timestamp}@test-insurance.com`,
          firstName: 'Test',
          lastName: 'Admin'
        },
        settings: {
          timezone: 'UTC',
          theme: 'corporate'
        }
      };

      const orgResult = await enterpriseService.createOrganization(organizationData, {
        autoSetupTeams: false,
        sendInvitations: false
      });

      console.log('✅ Organization created successfully');
      console.log(`   - Organization ID: ${orgResult.organizationId}`);
      console.log(`   - Name: ${orgResult.organization.name}`);
      console.log(`   - Type: ${orgResult.organization.type}`);
      console.log(`   - Status: ${orgResult.organization.status}`);
      
      testResults.organizationCreation = true;

      // Test 4: Create User
      console.log('\n👤 Test 4: User Creation');
      
      const userData = {
        email: `adjuster-${timestamp}@test-insurance.com`,
        firstName: 'Jane',
        lastName: 'Adjuster',
        role: 'adjuster',
        organizationId: orgResult.organizationId,
        permissions: ['claims:view_all', 'documents:edit'],
        settings: {
          theme: 'light',
          notifications: { email: true }
        }
      };

      const userResult = await enterpriseService.createUser(userData, {
        sendWelcomeEmail: false,
        requirePasswordReset: false,
        autoActivate: true
      });

      console.log('✅ User created successfully');
      console.log(`   - User ID: ${userResult.userId}`);
      console.log(`   - Email: ${userResult.user.email}`);
      console.log(`   - Role: ${userResult.user.role}`);
      console.log(`   - Status: ${userResult.user.status}`);
      console.log(`   - Organization: ${userResult.user.organizationId}`);
      
      testResults.userCreation = true;

      // Test 5: Permission Check
      console.log('\n🔑 Test 5: Permission Checking');
      
      const hasClaimsPermission = await rbacService.hasPermission(
        userResult.userId, 
        'claims:view_all',
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      const hasAdminPermission = await rbacService.hasPermission(
        userResult.userId,
        'users:delete',
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      console.log('✅ Permission checks completed');
      console.log(`   - Has Claims Permission: ${hasClaimsPermission}`);
      console.log(`   - Has Admin Permission: ${hasAdminPermission}`);
      
      if (hasClaimsPermission && !hasAdminPermission) {
        testResults.permissionCheck = true;
      }

      // Test 6: Feature Access
      console.log('\n🎛️ Test 6: Feature Access Control');
      
      const canAccessBasicClaims = await rbacService.canAccessFeature(
        userResult.userId,
        'basic_claims',
        { tenantId: 'test-tenant' }
      );

      const canAccessSystemAdmin = await rbacService.canAccessFeature(
        userResult.userId,
        'system_administration',
        { tenantId: 'test-tenant' }
      );

      console.log('✅ Feature access checks completed');
      console.log(`   - Can Access Basic Claims: ${canAccessBasicClaims}`);
      console.log(`   - Can Access System Admin: ${canAccessSystemAdmin}`);
      
      if (canAccessBasicClaims && !canAccessSystemAdmin) {
        testResults.featureAccess = true;
      }

      // Test 7: Data Access Policy
      console.log('\n📊 Test 7: Data Access Policy');
      
      const query = { claimId: '12345', status: 'open' };
      const filteredQuery = await rbacService.applyDataPolicy(
        userResult.userId,
        'team_data',
        query,
        { organizationId: orgResult.organizationId }
      );

      console.log('✅ Data policy applied successfully');
      console.log(`   - Original Query: ${JSON.stringify(query)}`);
      console.log(`   - Filtered Query: ${JSON.stringify(filteredQuery)}`);
      
      testResults.dataPolicy = true;

      // Test 8: Audit Logging
      console.log('\n📝 Test 8: Audit Logging');
      
      await rbacService.logAuditEvent({
        eventType: 'test_event',
        userId: userResult.userId,
        result: 'success',
        details: {
          testDescription: 'Enterprise system validation test',
          timestamp: new Date()
        }
      });

      const auditLog = await rbacService.getAuditLog({
        userId: userResult.userId,
        limit: 5
      });

      console.log('✅ Audit logging completed');
      console.log(`   - Total Audit Entries: ${auditLog.totalCount}`);
      console.log(`   - Recent Entries: ${auditLog.entries.length}`);
      
      testResults.auditLogging = true;

    } catch (error) {
      console.log('❌ Integration test failed:', error.message);
      console.log('   Stack trace:', error.stack);
    }
  }

  // Test Results Summary
  console.log('\n📊 Test Results Summary');
  console.log('=' .repeat(70));
  
  const passedTests = Object.values(testResults).filter(result => result).length;
  const totalTests = Object.keys(testResults).length;
  
  for (const [testName, passed] of Object.entries(testResults)) {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const displayName = testName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    console.log(`   ${status} - ${displayName}`);
  }
  
  console.log('\n🎯 Overall Results:');
  console.log(`   Tests Passed: ${passedTests}/${totalTests}`);
  console.log(`   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Enterprise system is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the implementation.');
  }

  // System Statistics
  if (enterpriseService && rbacService) {
    console.log('\n📈 System Statistics:');
    console.log('   Enterprise Service:');
    console.log(`     - Organizations: ${enterpriseService.organizations.size}`);
    console.log(`     - Teams: ${enterpriseService.teams.size}`);
    console.log(`     - Users: ${enterpriseService.users.size}`);
    console.log(`     - User Roles: ${enterpriseService.userRoles.size}`);
    
    console.log('   RBAC Service:');
    console.log(`     - Permission Categories: ${rbacService.permissionCategories.size}`);
    console.log(`     - Data Policies: ${rbacService.dataAccessPolicies.size}`);
    console.log(`     - Feature Controls: ${rbacService.featureControls.size}`);
    console.log(`     - Active Sessions: ${rbacService.sessionPermissions.size}`);
  }

  console.log('\n🏁 Enterprise system validation complete!');
  return passedTests === totalTests;
}

// Run the test
testEnterpriseSystem()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  });