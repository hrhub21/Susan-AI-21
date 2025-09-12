import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Comprehensive Test Reporter
 * Generates detailed test reports across all testing categories
 */
export class ComprehensiveTestReporter {
  constructor(options = {}) {
    this.outputDir = options.outputDir || path.join(process.cwd(), 'reports', 'comprehensive');
    this.includeArtifacts = options.includeArtifacts !== false;
    this.generateCharts = options.generateCharts !== false;
    this.timestamp = new Date().toISOString();
    this.testResults = {
      summary: {},
      categories: {},
      performance: {},
      coverage: {},
      security: {},
      artifacts: []
    };
    
    this.initializeOutputDirectory();
  }

  async initializeOutputDirectory() {
    await fs.ensureDir(this.outputDir);
    await fs.ensureDir(path.join(this.outputDir, 'artifacts'));
    await fs.ensureDir(path.join(this.outputDir, 'charts'));
    await fs.ensureDir(path.join(this.outputDir, 'raw-data'));
  }

  /**
   * Process Jest test results
   */
  async processJestResults(jestResultsPath) {
    try {
      if (await fs.pathExists(jestResultsPath)) {
        const jestResults = await fs.readJson(jestResultsPath);
        
        this.testResults.summary = {
          totalTests: jestResults.numTotalTests,
          passedTests: jestResults.numPassedTests,
          failedTests: jestResults.numFailedTests,
          skippedTests: jestResults.numPendingTests,
          totalTime: jestResults.runTime,
          success: jestResults.success,
          timestamp: this.timestamp
        };
        
        // Process test suites by category
        this.categorizeTestResults(jestResults.testResults);
        
        return true;
      }
    } catch (error) {
      console.warn('Failed to process Jest results:', error.message);
    }
    return false;
  }

  /**
   * Categorize test results by type
   */
  categorizeTestResults(testResults) {
    const categories = {
      unit: { tests: [], passed: 0, failed: 0, time: 0 },
      integration: { tests: [], passed: 0, failed: 0, time: 0 },
      e2e: { tests: [], passed: 0, failed: 0, time: 0 },
      api: { tests: [], passed: 0, failed: 0, time: 0 },
      performance: { tests: [], passed: 0, failed: 0, time: 0 },
      security: { tests: [], passed: 0, failed: 0, time: 0 },
      voice: { tests: [], passed: 0, failed: 0, time: 0 },
      websocket: { tests: [], passed: 0, failed: 0, time: 0 }
    };
    
    testResults.forEach(suite => {
      const category = this.determineTestCategory(suite.testFilePath);
      
      if (categories[category]) {
        categories[category].tests.push({
          file: path.basename(suite.testFilePath),
          path: suite.testFilePath,
          status: suite.status,
          time: suite.perfStats.runtime,
          tests: suite.assertionResults.length,
          passed: suite.assertionResults.filter(t => t.status === 'passed').length,
          failed: suite.assertionResults.filter(t => t.status === 'failed').length,
          errors: suite.assertionResults.filter(t => t.status === 'failed').map(t => ({
            title: t.title,
            message: t.failureMessages.join('\n')
          }))
        });
        
        categories[category].passed += suite.assertionResults.filter(t => t.status === 'passed').length;
        categories[category].failed += suite.assertionResults.filter(t => t.status === 'failed').length;
        categories[category].time += suite.perfStats.runtime;
      }
    });
    
    this.testResults.categories = categories;
  }

  /**
   * Determine test category from file path
   */
  determineTestCategory(filePath) {
    const pathLower = filePath.toLowerCase();
    
    if (pathLower.includes('/unit/')) return 'unit';
    if (pathLower.includes('/integration/')) return 'integration';
    if (pathLower.includes('/e2e/')) return 'e2e';
    if (pathLower.includes('/api/')) return 'api';
    if (pathLower.includes('/performance/')) return 'performance';
    if (pathLower.includes('/security/')) return 'security';
    if (pathLower.includes('/voice/')) return 'voice';
    if (pathLower.includes('/websocket/')) return 'websocket';
    
    return 'unit'; // Default
  }

  /**
   * Process coverage results
   */
  async processCoverageResults(coverageDir) {
    try {
      const coverageSummaryPath = path.join(coverageDir, 'coverage-summary.json');
      
      if (await fs.pathExists(coverageSummaryPath)) {
        const coverageSummary = await fs.readJson(coverageSummaryPath);
        
        this.testResults.coverage = {
          total: coverageSummary.total,
          files: Object.keys(coverageSummary).filter(key => key !== 'total').length,
          threshold: {
            statements: 80,
            branches: 80,
            functions: 80,
            lines: 80
          },
          passed: {
            statements: coverageSummary.total.statements.pct >= 80,
            branches: coverageSummary.total.branches.pct >= 80,
            functions: coverageSummary.total.functions.pct >= 80,
            lines: coverageSummary.total.lines.pct >= 80
          }
        };
        
        // Copy coverage artifacts
        if (this.includeArtifacts) {
          await fs.copy(coverageDir, path.join(this.outputDir, 'artifacts', 'coverage'));
        }
        
        return true;
      }
    } catch (error) {
      console.warn('Failed to process coverage results:', error.message);
    }
    return false;
  }

  /**
   * Process performance test results
   */
  async processPerformanceResults(performanceDir) {
    try {
      const performanceFiles = await fs.readdir(performanceDir).catch(() => []);
      const performanceData = {
        reports: [],
        metrics: {
          averageResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          throughput: 0,
          errorRate: 0
        },
        benchmarks: []
      };
      
      for (const file of performanceFiles) {
        if (file.endsWith('.json')) {
          const filePath = path.join(performanceDir, file);
          const data = await fs.readJson(filePath);
          
          if (data.summary) {
            performanceData.reports.push({
              file,
              ...data.summary
            });
          }
          
          if (data.performanceMetrics) {
            Object.assign(performanceData.metrics, data.performanceMetrics);
          }
          
          if (data.results) {
            performanceData.benchmarks.push(...data.results);
          }
        }
      }
      
      this.testResults.performance = performanceData;
      
      // Copy performance artifacts
      if (this.includeArtifacts && performanceFiles.length > 0) {
        await fs.copy(performanceDir, path.join(this.outputDir, 'artifacts', 'performance'));
      }
      
      return true;
    } catch (error) {
      console.warn('Failed to process performance results:', error.message);
    }
    return false;
  }

  /**
   * Process security test results
   */
  async processSecurityResults(securityDir) {
    try {
      const securityFiles = await fs.readdir(securityDir).catch(() => []);
      const securityData = {
        vulnerabilities: {
          high: 0,
          medium: 0,
          low: 0,
          info: 0
        },
        scans: [],
        issues: []
      };
      
      for (const file of securityFiles) {
        if (file.endsWith('.json')) {
          const filePath = path.join(securityDir, file);
          const data = await fs.readJson(filePath);
          
          if (data.vulnerabilities) {
            securityData.scans.push({
              file,
              timestamp: data.timestamp || this.timestamp,
              vulnerabilities: data.vulnerabilities
            });
            
            // Aggregate vulnerability counts
            Object.keys(data.vulnerabilities).forEach(severity => {
              if (securityData.vulnerabilities[severity] !== undefined) {
                securityData.vulnerabilities[severity] += data.vulnerabilities[severity];
              }
            });
          }
          
          if (data.issues) {
            securityData.issues.push(...data.issues);
          }
        }
      }
      
      this.testResults.security = securityData;
      
      // Copy security artifacts
      if (this.includeArtifacts && securityFiles.length > 0) {
        await fs.copy(securityDir, path.join(this.outputDir, 'artifacts', 'security'));
      }
      
      return true;
    } catch (error) {
      console.warn('Failed to process security results:', error.message);
    }
    return false;
  }

  /**
   * Generate comprehensive HTML report
   */
  async generateHtmlReport() {
    const htmlTemplate = this.createHtmlTemplate();
    const htmlPath = path.join(this.outputDir, 'index.html');
    
    await fs.writeFile(htmlPath, htmlTemplate);
    
    return htmlPath;
  }

  /**
   * Create HTML template for the report
   */
  createHtmlTemplate() {
    const { summary, categories, coverage, performance, security } = this.testResults;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Susan AI - Comprehensive Test Report</title>
    <style>
        ${this.getCssStyles()}
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <header>
            <h1>🤖 Susan AI - Comprehensive Test Report</h1>
            <p class="timestamp">Generated: ${new Date(this.timestamp).toLocaleString()}</p>
            <div class="status-badge ${summary.success ? 'success' : 'failure'}">
                ${summary.success ? '✅ ALL TESTS PASSED' : '❌ TESTS FAILED'}
            </div>
        </header>

        <section class="summary">
            <h2>Executive Summary</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>Tests</h3>
                    <div class="metric-value">${summary.totalTests || 0}</div>
                    <div class="metric-label">Total Tests</div>
                </div>
                <div class="metric-card ${summary.passedTests === summary.totalTests ? 'success' : ''}">
                    <h3>Passed</h3>
                    <div class="metric-value">${summary.passedTests || 0}</div>
                    <div class="metric-label">Passed Tests</div>
                </div>
                <div class="metric-card ${summary.failedTests > 0 ? 'failure' : ''}">
                    <h3>Failed</h3>
                    <div class="metric-value">${summary.failedTests || 0}</div>
                    <div class="metric-label">Failed Tests</div>
                </div>
                <div class="metric-card">
                    <h3>Time</h3>
                    <div class="metric-value">${Math.round((summary.totalTime || 0) / 1000)}s</div>
                    <div class="metric-label">Total Runtime</div>
                </div>
            </div>
        </section>

        <section class="categories">
            <h2>Test Categories</h2>
            <div class="category-grid">
                ${Object.entries(categories).map(([name, data]) => `
                    <div class="category-card">
                        <h3>${name.toUpperCase()}</h3>
                        <div class="category-stats">
                            <span class="stat">✅ ${data.passed}</span>
                            <span class="stat ${data.failed > 0 ? 'failure' : ''}">❌ ${data.failed}</span>
                            <span class="stat">⏱️ ${Math.round(data.time)}ms</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${data.passed + data.failed > 0 ? (data.passed / (data.passed + data.failed)) * 100 : 0}%"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>

        <section class="coverage">
            <h2>Code Coverage</h2>
            <div class="coverage-grid">
                <div class="coverage-item">
                    <h4>Statements</h4>
                    <div class="coverage-bar">
                        <div class="coverage-fill ${coverage.total?.statements.pct >= 80 ? 'success' : 'warning'}" 
                             style="width: ${coverage.total?.statements.pct || 0}%"></div>
                    </div>
                    <span>${coverage.total?.statements.pct || 0}%</span>
                </div>
                <div class="coverage-item">
                    <h4>Branches</h4>
                    <div class="coverage-bar">
                        <div class="coverage-fill ${coverage.total?.branches.pct >= 80 ? 'success' : 'warning'}" 
                             style="width: ${coverage.total?.branches.pct || 0}%"></div>
                    </div>
                    <span>${coverage.total?.branches.pct || 0}%</span>
                </div>
                <div class="coverage-item">
                    <h4>Functions</h4>
                    <div class="coverage-bar">
                        <div class="coverage-fill ${coverage.total?.functions.pct >= 80 ? 'success' : 'warning'}" 
                             style="width: ${coverage.total?.functions.pct || 0}%"></div>
                    </div>
                    <span>${coverage.total?.functions.pct || 0}%</span>
                </div>
                <div class="coverage-item">
                    <h4>Lines</h4>
                    <div class="coverage-bar">
                        <div class="coverage-fill ${coverage.total?.lines.pct >= 80 ? 'success' : 'warning'}" 
                             style="width: ${coverage.total?.lines.pct || 0}%"></div>
                    </div>
                    <span>${coverage.total?.lines.pct || 0}%</span>
                </div>
            </div>
        </section>

        <section class="performance">
            <h2>Performance Metrics</h2>
            <div class="performance-grid">
                <div class="performance-card">
                    <h4>Response Time</h4>
                    <div class="performance-value">${Math.round(performance.metrics?.averageResponseTime || 0)}ms</div>
                    <div class="performance-label">Average</div>
                </div>
                <div class="performance-card">
                    <h4>P95 Response</h4>
                    <div class="performance-value">${Math.round(performance.metrics?.p95ResponseTime || 0)}ms</div>
                    <div class="performance-label">95th Percentile</div>
                </div>
                <div class="performance-card">
                    <h4>Throughput</h4>
                    <div class="performance-value">${Math.round(performance.metrics?.throughput || 0)}</div>
                    <div class="performance-label">Requests/sec</div>
                </div>
                <div class="performance-card">
                    <h4>Error Rate</h4>
                    <div class="performance-value">${(performance.metrics?.errorRate || 0).toFixed(2)}%</div>
                    <div class="performance-label">Errors</div>
                </div>
            </div>
        </section>

        <section class="security">
            <h2>Security Analysis</h2>
            <div class="security-grid">
                <div class="security-card ${security.vulnerabilities?.high > 0 ? 'critical' : 'success'}">
                    <h4>High Risk</h4>
                    <div class="security-value">${security.vulnerabilities?.high || 0}</div>
                </div>
                <div class="security-card ${security.vulnerabilities?.medium > 0 ? 'warning' : 'success'}">
                    <h4>Medium Risk</h4>
                    <div class="security-value">${security.vulnerabilities?.medium || 0}</div>
                </div>
                <div class="security-card">
                    <h4>Low Risk</h4>
                    <div class="security-value">${security.vulnerabilities?.low || 0}</div>
                </div>
                <div class="security-card">
                    <h4>Info</h4>
                    <div class="security-value">${security.vulnerabilities?.info || 0}</div>
                </div>
            </div>
        </section>

        <section class="recommendations">
            <h2>Recommendations</h2>
            <div class="recommendations-list">
                ${this.generateRecommendations().map(rec => `
                    <div class="recommendation ${rec.priority}">
                        <strong>${rec.title}</strong>
                        <p>${rec.description}</p>
                    </div>
                `).join('')}
            </div>
        </section>

        <footer>
            <p>Report generated by Susan AI Test Suite | ${new Date(this.timestamp).toLocaleString()}</p>
        </footer>
    </div>

    <script>
        // Add interactive charts here if needed
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Susan AI Test Report loaded successfully');
        });
    </script>
</body>
</html>
    `;
  }

  /**
   * Generate CSS styles for the report
   */
  getCssStyles() {
    return `
        :root {
            --primary-color: #2563eb;
            --success-color: #10b981;
            --warning-color: #f59e0b;
            --error-color: #ef4444;
            --critical-color: #dc2626;
            --background-color: #f8fafc;
            --card-background: #ffffff;
            --text-primary: #1f2937;
            --text-secondary: #6b7280;
            --border-color: #e5e7eb;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--background-color);
            color: var(--text-primary);
            line-height: 1.6;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        header {
            text-align: center;
            margin-bottom: 3rem;
        }
        
        h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            color: var(--primary-color);
        }
        
        .timestamp {
            color: var(--text-secondary);
            margin-bottom: 1rem;
        }
        
        .status-badge {
            display: inline-block;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            font-weight: 600;
            font-size: 1.1rem;
        }
        
        .status-badge.success {
            background-color: var(--success-color);
            color: white;
        }
        
        .status-badge.failure {
            background-color: var(--error-color);
            color: white;
        }
        
        section {
            background: var(--card-background);
            border-radius: 0.75rem;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        h2 {
            font-size: 1.75rem;
            margin-bottom: 1.5rem;
            color: var(--primary-color);
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
        }
        
        .metric-card {
            text-align: center;
            padding: 1.5rem;
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
            transition: transform 0.2s;
        }
        
        .metric-card:hover {
            transform: translateY(-2px);
        }
        
        .metric-card.success {
            border-color: var(--success-color);
            background-color: rgba(16, 185, 129, 0.05);
        }
        
        .metric-card.failure {
            border-color: var(--error-color);
            background-color: rgba(239, 68, 68, 0.05);
        }
        
        .metric-value {
            font-size: 2rem;
            font-weight: 700;
            margin: 0.5rem 0;
        }
        
        .metric-label {
            color: var(--text-secondary);
            font-size: 0.875rem;
        }
        
        .category-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
        }
        
        .category-card {
            padding: 1rem;
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
        }
        
        .category-stats {
            display: flex;
            gap: 1rem;
            margin: 0.5rem 0;
        }
        
        .stat.failure {
            color: var(--error-color);
        }
        
        .progress-bar {
            height: 8px;
            background-color: #f3f4f6;
            border-radius: 4px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background-color: var(--success-color);
            transition: width 0.3s ease;
        }
        
        .coverage-grid {
            display: grid;
            gap: 1rem;
        }
        
        .coverage-item {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        
        .coverage-item h4 {
            min-width: 100px;
        }
        
        .coverage-bar {
            flex: 1;
            height: 20px;
            background-color: #f3f4f6;
            border-radius: 10px;
            overflow: hidden;
        }
        
        .coverage-fill {
            height: 100%;
            transition: width 0.3s ease;
        }
        
        .coverage-fill.success {
            background-color: var(--success-color);
        }
        
        .coverage-fill.warning {
            background-color: var(--warning-color);
        }
        
        .performance-grid, .security-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }
        
        .performance-card, .security-card {
            text-align: center;
            padding: 1.5rem;
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
        }
        
        .security-card.critical {
            border-color: var(--critical-color);
            background-color: rgba(220, 38, 38, 0.05);
        }
        
        .security-card.warning {
            border-color: var(--warning-color);
            background-color: rgba(245, 158, 11, 0.05);
        }
        
        .security-card.success {
            border-color: var(--success-color);
            background-color: rgba(16, 185, 129, 0.05);
        }
        
        .performance-value, .security-value {
            font-size: 1.5rem;
            font-weight: 600;
            margin: 0.5rem 0;
        }
        
        .recommendations-list {
            display: grid;
            gap: 1rem;
        }
        
        .recommendation {
            padding: 1rem;
            border-left: 4px solid;
            background-color: #f9fafb;
        }
        
        .recommendation.high {
            border-color: var(--error-color);
        }
        
        .recommendation.medium {
            border-color: var(--warning-color);
        }
        
        .recommendation.low {
            border-color: var(--success-color);
        }
        
        footer {
            text-align: center;
            color: var(--text-secondary);
            margin-top: 3rem;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            h1 {
                font-size: 2rem;
            }
            
            .metrics-grid, .category-grid, .performance-grid, .security-grid {
                grid-template-columns: 1fr;
            }
        }
    `;
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations() {
    const recommendations = [];
    const { summary, coverage, performance, security } = this.testResults;
    
    // Test failures
    if (summary.failedTests > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Fix Failed Tests',
        description: `${summary.failedTests} test(s) are currently failing. Review and fix these tests before deployment.`
      });
    }
    
    // Coverage issues
    if (coverage.total) {
      ['statements', 'branches', 'functions', 'lines'].forEach(metric => {
        if (coverage.total[metric].pct < 80) {
          recommendations.push({
            priority: 'medium',
            title: `Improve ${metric} Coverage`,
            description: `${metric} coverage is ${coverage.total[metric].pct}%, below the 80% threshold. Add more tests to improve coverage.`
          });
        }
      });
    }
    
    // Performance issues
    if (performance.metrics) {
      if (performance.metrics.p95ResponseTime > 2000) {
        recommendations.push({
          priority: 'high',
          title: 'Optimize Response Times',
          description: `95th percentile response time is ${Math.round(performance.metrics.p95ResponseTime)}ms, above the 2000ms threshold.`
        });
      }
      
      if (performance.metrics.errorRate > 1) {
        recommendations.push({
          priority: 'high',
          title: 'Reduce Error Rate',
          description: `Error rate is ${performance.metrics.errorRate.toFixed(2)}%, which is above acceptable levels.`
        });
      }
    }
    
    // Security issues
    if (security.vulnerabilities) {
      if (security.vulnerabilities.high > 0) {
        recommendations.push({
          priority: 'high',
          title: 'Fix High-Risk Vulnerabilities',
          description: `${security.vulnerabilities.high} high-risk security vulnerabilities found. Address these immediately.`
        });
      }
      
      if (security.vulnerabilities.medium > 0) {
        recommendations.push({
          priority: 'medium',
          title: 'Address Medium-Risk Vulnerabilities',
          description: `${security.vulnerabilities.medium} medium-risk security vulnerabilities found. Plan to address these soon.`
        });
      }
    }
    
    // Default recommendations
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'low',
        title: 'All Tests Passing',
        description: 'Great job! All tests are passing and metrics are within acceptable ranges. Consider adding more comprehensive tests for edge cases.'
      });
    }
    
    return recommendations;
  }

  /**
   * Generate JSON summary report
   */
  async generateJsonReport() {
    const reportData = {
      ...this.testResults,
      metadata: {
        timestamp: this.timestamp,
        version: '1.0.0',
        generator: 'ComprehensiveTestReporter'
      },
      recommendations: this.generateRecommendations()
    };
    
    const jsonPath = path.join(this.outputDir, 'report.json');
    await fs.writeJson(jsonPath, reportData, { spaces: 2 });
    
    return jsonPath;
  }

  /**
   * Generate JUnit XML report for CI integration
   */
  async generateJUnitReport() {
    const { summary, categories } = this.testResults;
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuites name="Susan AI Test Suite" tests="${summary.totalTests}" failures="${summary.failedTests}" time="${(summary.totalTime / 1000).toFixed(3)}">\n`;
    
    Object.entries(categories).forEach(([categoryName, categoryData]) => {
      xml += `  <testsuite name="${categoryName}" tests="${categoryData.passed + categoryData.failed}" failures="${categoryData.failed}" time="${(categoryData.time / 1000).toFixed(3)}">\n`;
      
      categoryData.tests.forEach(test => {
        xml += `    <testcase name="${test.file}" classname="${categoryName}" time="${(test.time / 1000).toFixed(3)}">\n`;
        
        if (test.failed > 0) {
          test.errors.forEach(error => {
            xml += `      <failure message="${this.escapeXml(error.title)}">${this.escapeXml(error.message)}</failure>\n`;
          });
        }
        
        xml += `    </testcase>\n`;
      });
      
      xml += `  </testsuite>\n`;
    });
    
    xml += `</testsuites>\n`;
    
    const junitPath = path.join(this.outputDir, 'junit-results.xml');
    await fs.writeFile(junitPath, xml);
    
    return junitPath;
  }

  /**
   * Generate Markdown summary for GitHub comments
   */
  async generateMarkdownSummary() {
    const { summary, coverage, performance, security } = this.testResults;
    const recommendations = this.generateRecommendations();
    
    let markdown = `# 🤖 Susan AI Test Results\n\n`;
    
    // Status badge
    const statusEmoji = summary.success ? '✅' : '❌';
    const statusText = summary.success ? 'PASSED' : 'FAILED';
    markdown += `## ${statusEmoji} Status: ${statusText}\n\n`;
    
    // Summary table
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Total Tests | ${summary.totalTests || 0} |\n`;
    markdown += `| Passed | ${summary.passedTests || 0} |\n`;
    markdown += `| Failed | ${summary.failedTests || 0} |\n`;
    markdown += `| Duration | ${Math.round((summary.totalTime || 0) / 1000)}s |\n\n`;
    
    // Coverage
    if (coverage.total) {
      markdown += `## 📊 Code Coverage\n\n`;
      markdown += `| Type | Percentage | Status |\n`;
      markdown += `|------|------------|--------|\n`;
      
      ['statements', 'branches', 'functions', 'lines'].forEach(metric => {
        const pct = coverage.total[metric].pct;
        const status = pct >= 80 ? '✅' : '⚠️';
        markdown += `| ${metric.charAt(0).toUpperCase() + metric.slice(1)} | ${pct}% | ${status} |\n`;
      });
      markdown += `\n`;
    }
    
    // Performance
    if (performance.metrics && Object.keys(performance.metrics).length > 0) {
      markdown += `## ⚡ Performance Metrics\n\n`;
      markdown += `| Metric | Value |\n`;
      markdown += `|--------|-------|\n`;
      markdown += `| Avg Response Time | ${Math.round(performance.metrics.averageResponseTime || 0)}ms |\n`;
      markdown += `| P95 Response Time | ${Math.round(performance.metrics.p95ResponseTime || 0)}ms |\n`;
      markdown += `| Throughput | ${Math.round(performance.metrics.throughput || 0)} req/s |\n`;
      markdown += `| Error Rate | ${(performance.metrics.errorRate || 0).toFixed(2)}% |\n\n`;
    }
    
    // Security
    if (security.vulnerabilities) {
      markdown += `## 🔒 Security Analysis\n\n`;
      const totalVulns = Object.values(security.vulnerabilities).reduce((sum, count) => sum + count, 0);
      
      if (totalVulns === 0) {
        markdown += `✅ No security vulnerabilities detected\n\n`;
      } else {
        markdown += `| Risk Level | Count |\n`;
        markdown += `|------------|-------|\n`;
        markdown += `| High | ${security.vulnerabilities.high || 0} |\n`;
        markdown += `| Medium | ${security.vulnerabilities.medium || 0} |\n`;
        markdown += `| Low | ${security.vulnerabilities.low || 0} |\n`;
        markdown += `| Info | ${security.vulnerabilities.info || 0} |\n\n`;
      }
    }
    
    // Recommendations
    if (recommendations.length > 0) {
      markdown += `## 📝 Recommendations\n\n`;
      recommendations.forEach(rec => {
        const emoji = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        markdown += `${emoji} **${rec.title}**: ${rec.description}\n\n`;
      });
    }
    
    markdown += `---\n*Report generated at ${new Date(this.timestamp).toLocaleString()}*\n`;
    
    const markdownPath = path.join(this.outputDir, 'summary.md');
    await fs.writeFile(markdownPath, markdown);
    
    return markdownPath;
  }

  /**
   * Generate all reports
   */
  async generateAllReports() {
    const reports = {};
    
    try {
      reports.html = await this.generateHtmlReport();
      reports.json = await this.generateJsonReport();
      reports.junit = await this.generateJUnitReport();
      reports.markdown = await this.generateMarkdownSummary();
      
      console.log('✅ Comprehensive test reports generated successfully:');
      console.log(`  HTML Report: ${reports.html}`);
      console.log(`  JSON Report: ${reports.json}`);
      console.log(`  JUnit Report: ${reports.junit}`);
      console.log(`  Markdown Summary: ${reports.markdown}`);
      
      return reports;
    } catch (error) {
      console.error('❌ Failed to generate reports:', error);
      throw error;
    }
  }

  /**
   * Escape XML special characters
   */
  escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }
}

// Export factory function
export function createTestReporter(options) {
  return new ComprehensiveTestReporter(options);
}
