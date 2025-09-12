import fs from 'fs-extra';
import path from 'path';

export default function testResultsProcessor(results) {
  // Enhanced test results processing
  const summary = {
    timestamp: new Date().toISOString(),
    totalTests: results.numTotalTests,
    passedTests: results.numPassedTests,
    failedTests: results.numFailedTests,
    pendingTests: results.numPendingTests,
    runtime: results.testResults.reduce((acc, result) => acc + result.perfStats.runtime, 0),
    coverage: results.coverageMap ? {
      statements: results.coverageMap.getCoverageSummary().statements.pct,
      branches: results.coverageMap.getCoverageSummary().branches.pct,
      functions: results.coverageMap.getCoverageSummary().functions.pct,
      lines: results.coverageMap.getCoverageSummary().lines.pct
    } : null,
    failedTestDetails: results.testResults
      .filter(result => result.numFailingTests > 0)
      .map(result => ({
        testFilePath: result.testFilePath,
        failureMessages: result.failureMessage,
        numFailingTests: result.numFailingTests
      }))
  };

  // Write detailed results to file
  const resultsDir = path.join(process.cwd(), 'test-results');
  fs.ensureDirSync(resultsDir);
  
  const resultsFile = path.join(resultsDir, `test-results-${Date.now()}.json`);
  fs.writeJsonSync(resultsFile, summary, { spaces: 2 });
  
  // Write latest results
  const latestFile = path.join(resultsDir, 'latest-results.json');
  fs.writeJsonSync(latestFile, summary, { spaces: 2 });
  
  // Console output
  console.log('\n🧪 Test Results Summary');
  console.log('========================');
  console.log(`Total Tests: ${summary.totalTests}`);
  console.log(`Passed: ${summary.passedTests}`);
  console.log(`Failed: ${summary.failedTests}`);
  console.log(`Pending: ${summary.pendingTests}`);
  console.log(`Runtime: ${summary.runtime}ms`);
  
  if (summary.coverage) {
    console.log('\n📊 Coverage Summary');
    console.log('==================');
    console.log(`Statements: ${summary.coverage.statements}%`);
    console.log(`Branches: ${summary.coverage.branches}%`);
    console.log(`Functions: ${summary.coverage.functions}%`);
    console.log(`Lines: ${summary.coverage.lines}%`);
  }
  
  if (summary.failedTests > 0) {
    console.log('\n❌ Failed Tests');
    console.log('===============');
    summary.failedTestDetails.forEach(failure => {
      console.log(`File: ${failure.testFilePath}`);
      console.log(`Failures: ${failure.numFailingTests}`);
    });
  }
  
  return results;
}