/**
 * Global Teardown for Susan AI UI Tests
 * Cleanup after all tests complete
 */

async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');
  
  // Cleanup any test artifacts
  try {
    // Clean up any temporary files or resources created during tests
    console.log('✅ Test cleanup complete');
  } catch (error) {
    console.warn('⚠️ Cleanup warning:', error.message);
  }
}

export default globalTeardown;