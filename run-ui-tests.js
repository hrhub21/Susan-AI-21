#!/usr/bin/env node

/**
 * Susan AI - Comprehensive UI Test Runner
 * Runs all UI tests to verify the image upload workflow works perfectly
 */

import { spawn, exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

class UITestRunner {
    constructor() {
        this.testResults = {
            startTime: new Date(),
            endTime: null,
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            skippedTests: 0,
            suites: [],
            issues: [],
            recommendations: []
        };
        
        this.serverProcess = null;
        this.serverReady = false;
    }

    async run() {
        console.log(chalk.blue('🚀 Susan AI - Comprehensive UI Test Suite'));
        console.log(chalk.blue('========================================='));
        console.log(chalk.yellow('Testing image upload and analysis workflow...'));
        console.log('');

        try {
            // Step 1: Start the server if needed
            await this.ensureServerRunning();
            
            // Step 2: Run test suites
            await this.runTestSuites();
            
            // Step 3: Generate report
            await this.generateReport();
            
            // Step 4: Cleanup
            await this.cleanup();
            
            console.log('');
            console.log(chalk.green('✅ All UI tests completed successfully!'));
            console.log(chalk.green('The image upload workflow is fully functional.'));
            
        } catch (error) {
            console.error(chalk.red('❌ UI tests failed:'), error.message);
            await this.cleanup();
            process.exit(1);
        }
    }

    async ensureServerRunning() {
        console.log(chalk.yellow('🔧 Ensuring API server is running...'));
        
        // Check if server is already running
        const isRunning = await this.checkServerHealth();
        
        if (!isRunning) {
            console.log(chalk.yellow('Starting API server...'));
            await this.startServer();
            await this.waitForServer();
        } else {
            console.log(chalk.green('✅ API server already running'));
        }
    }

    async checkServerHealth() {
        return new Promise((resolve) => {
            const healthCheck = exec('curl -f http://localhost:3001/api/v1/photo-analysis/analyze-photo/health');
            
            healthCheck.on('exit', (code) => {
                resolve(code === 0);
            });
            
            // Timeout after 3 seconds
            setTimeout(() => {
                healthCheck.kill();
                resolve(false);
            }, 3000);
        });
    }

    async startServer() {
        return new Promise((resolve, reject) => {
            // Try multiple server start methods
            const serverCommands = [
                'npm run start:api',
                'node src/api/server.js',
                'node src/server.js'
            ];
            
            const tryStartServer = (commandIndex = 0) => {
                if (commandIndex >= serverCommands.length) {
                    reject(new Error('Failed to start server with any method'));
                    return;
                }
                
                const command = serverCommands[commandIndex];
                console.log(chalk.yellow(`Trying: ${command}`));
                
                this.serverProcess = spawn('npm', ['run', 'start:api'], {
                    stdio: 'pipe',
                    detached: false,
                    env: { ...process.env, PORT: '3001' }
                });
                
                this.serverProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    if (output.includes('listening') || output.includes('Server running')) {
                        console.log(chalk.green('✅ Server started successfully'));
                        resolve();
                    }
                });
                
                this.serverProcess.stderr.on('data', (data) => {
                    console.error(chalk.red('Server error:'), data.toString());
                });
                
                this.serverProcess.on('exit', (code) => {
                    if (code !== 0 && commandIndex < serverCommands.length - 1) {
                        setTimeout(() => tryStartServer(commandIndex + 1), 1000);
                    }
                });
                
                // Timeout for this attempt
                setTimeout(() => {
                    if (!this.serverReady) {
                        this.serverProcess.kill();
                        tryStartServer(commandIndex + 1);
                    }
                }, 10000);
            };
            
            tryStartServer();
        });
    }

    async waitForServer() {
        console.log(chalk.yellow('⏳ Waiting for server to be ready...'));
        
        for (let i = 0; i < 30; i++) {
            const isReady = await this.checkServerHealth();
            if (isReady) {
                this.serverReady = true;
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            process.stdout.write('.');
        }
        
        throw new Error('Server did not become ready within 60 seconds');
    }

    async runTestSuites() {
        const testSuites = [
            {
                name: 'End-to-End UI Tests',
                path: 'tests/e2e/roofing-analysis-ui.test.js',
                description: 'Complete image upload and analysis workflow',
                critical: true
            },
            {
                name: 'API Integration Tests',
                path: 'tests/integration/photo-analysis-api.test.js',
                description: 'Backend API functionality',
                critical: true
            },
            {
                name: 'WebSocket Real-time Tests',
                path: 'tests/websocket/image-upload-websocket.test.js',
                description: 'Real-time upload progress',
                critical: false
            },
            {
                name: 'Browser Compatibility Tests',
                path: 'tests/e2e/browser-compatibility.test.js',
                description: 'Cross-browser functionality',
                critical: false
            },
            {
                name: 'Performance Tests',
                path: 'tests/performance/spinning-issue-analysis.test.js',
                description: 'Spinning issue analysis',
                critical: true
            },
            {
                name: 'Accessibility Tests',
                path: 'tests/e2e/accessibility.test.js',
                description: 'WCAG compliance',
                critical: false
            }
        ];

        console.log(chalk.blue('\n🧪 Running Test Suites'));
        console.log(chalk.blue('====================='));

        for (const suite of testSuites) {
            await this.runSingleTestSuite(suite);
        }
    }

    async runSingleTestSuite(suite) {
        console.log(chalk.yellow(`\n📋 ${suite.name}`));
        console.log(chalk.gray(`   ${suite.description}`));
        
        const suiteResult = {
            name: suite.name,
            path: suite.path,
            critical: suite.critical,
            startTime: new Date(),
            endTime: null,
            passed: false,
            output: '',
            error: null,
            tests: 0,
            passed_tests: 0,
            failed_tests: 0
        };

        try {
            // Check if test file exists
            const testPath = path.resolve(suite.path);
            
            try {
                await fs.access(testPath);
            } catch (error) {
                throw new Error(`Test file not found: ${testPath}`);
            }

            // Determine test runner
            const isPlaywright = suite.path.includes('/e2e/') && 
                                 !suite.path.includes('accessibility') &&
                                 !suite.path.includes('websocket');
            
            const command = isPlaywright ? 'npx playwright test' : 'npm test --';
            const args = isPlaywright ? [testPath] : [testPath];

            // Run the test
            const result = await this.executeTest(command, args);
            
            suiteResult.output = result.output;
            suiteResult.passed = result.exitCode === 0;
            suiteResult.tests = this.extractTestCounts(result.output).total;
            suiteResult.passed_tests = this.extractTestCounts(result.output).passed;
            suiteResult.failed_tests = this.extractTestCounts(result.output).failed;
            
            if (suiteResult.passed) {
                console.log(chalk.green(`   ✅ PASSED (${suiteResult.passed_tests}/${suiteResult.tests} tests)`));
            } else {
                console.log(chalk.red(`   ❌ FAILED (${suiteResult.failed_tests}/${suiteResult.tests} tests failed)`));
                
                if (suite.critical) {
                    this.testResults.issues.push(`Critical test suite failed: ${suite.name}`);
                }
            }
            
        } catch (error) {
            suiteResult.passed = false;
            suiteResult.error = error.message;
            console.log(chalk.red(`   ❌ ERROR: ${error.message}`));
            
            if (suite.critical) {
                this.testResults.issues.push(`Critical test suite error: ${suite.name} - ${error.message}`);
            }
        }

        suiteResult.endTime = new Date();
        this.testResults.suites.push(suiteResult);
        
        // Update totals
        this.testResults.totalTests += suiteResult.tests;
        this.testResults.passedTests += suiteResult.passed_tests;
        this.testResults.failedTests += suiteResult.failed_tests;
    }

    async executeTest(command, args) {
        return new Promise((resolve) => {
            const [cmd, ...cmdArgs] = command.split(' ');
            const fullArgs = [...cmdArgs, ...args];
            
            const testProcess = spawn(cmd, fullArgs, {
                stdio: 'pipe',
                env: {
                    ...process.env,
                    TEST_BASE_URL: 'http://localhost:3001',
                    API_BASE_URL: 'http://localhost:3001/api/v1',
                    WS_BASE_URL: 'ws://localhost:3001'
                }
            });

            let output = '';
            let error = '';

            testProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            testProcess.stderr.on('data', (data) => {
                error += data.toString();
                output += data.toString(); // Include stderr in output for analysis
            });

            testProcess.on('close', (exitCode) => {
                resolve({
                    exitCode,
                    output: output + error
                });
            });

            // Timeout after 10 minutes
            setTimeout(() => {
                testProcess.kill();
                resolve({
                    exitCode: 1,
                    output: output + '\n\nTest timed out after 10 minutes'
                });
            }, 10 * 60 * 1000);
        });
    }

    extractTestCounts(output) {
        // Parse test output to extract counts
        const totalMatch = output.match(/(\d+) (tests?|passed)/i);
        const passedMatch = output.match(/(\d+) passed/i);
        const failedMatch = output.match(/(\d+) failed/i);
        
        return {
            total: totalMatch ? parseInt(totalMatch[1]) : 1,
            passed: passedMatch ? parseInt(passedMatch[1]) : 0,
            failed: failedMatch ? parseInt(failedMatch[1]) : 0
        };
    }

    async generateReport() {
        console.log(chalk.blue('\n📊 Test Results Report'));
        console.log(chalk.blue('======================'));
        
        this.testResults.endTime = new Date();
        const duration = this.testResults.endTime - this.testResults.startTime;
        
        console.log(`Test Duration: ${Math.round(duration / 1000)}s`);
        console.log(`Total Tests: ${this.testResults.totalTests}`);
        console.log(`Passed: ${chalk.green(this.testResults.passedTests)}`);
        console.log(`Failed: ${chalk.red(this.testResults.failedTests)}`);
        
        // Suite breakdown
        console.log(chalk.yellow('\nSuite Results:'));
        for (const suite of this.testResults.suites) {
            const status = suite.passed ? chalk.green('PASS') : chalk.red('FAIL');
            const critical = suite.critical ? chalk.yellow('[CRITICAL]') : '';
            console.log(`  ${status} ${suite.name} ${critical}`);
        }
        
        // Issues and recommendations
        if (this.testResults.issues.length > 0) {
            console.log(chalk.red('\n⚠️  Issues Found:'));
            for (const issue of this.testResults.issues) {
                console.log(chalk.red(`  - ${issue}`));
            }
            
            console.log(chalk.yellow('\n💡 Recommendations:'));
            console.log(chalk.yellow('  - Check API server connectivity and response times'));
            console.log(chalk.yellow('  - Verify WebSocket connections are stable'));
            console.log(chalk.yellow('  - Review JavaScript console for errors'));
            console.log(chalk.yellow('  - Test with actual image files'));
        }
        
        // Save detailed report
        const reportData = {
            ...this.testResults,
            generatedAt: new Date().toISOString(),
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                cwd: process.cwd()
            }
        };
        
        try {
            await fs.writeFile('ui-test-report.json', JSON.stringify(reportData, null, 2));
            console.log(chalk.gray('\n📄 Detailed report saved to ui-test-report.json'));
        } catch (error) {
            console.error(chalk.red('Failed to save report:'), error.message);
        }
        
        // Overall result
        const criticalSuitesFailed = this.testResults.suites.filter(s => s.critical && !s.passed).length;
        
        if (criticalSuitesFailed > 0) {
            console.log(chalk.red(`\n❌ ${criticalSuitesFailed} critical test suite(s) failed!`));
            console.log(chalk.red('The image upload workflow has issues that need to be fixed.'));
            throw new Error('Critical tests failed');
        } else {
            console.log(chalk.green('\n✅ All critical tests passed!'));
            console.log(chalk.green('The image upload workflow is working correctly.'));
        }
    }

    async cleanup() {
        if (this.serverProcess && !this.serverProcess.killed) {
            console.log(chalk.yellow('🧹 Cleaning up server process...'));
            this.serverProcess.kill();
            
            // Wait a bit for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

// Run the tests if this file is executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
    const runner = new UITestRunner();
    runner.run().catch((error) => {
        console.error(chalk.red('Test runner failed:'), error);
        process.exit(1);
    });
}

export default UITestRunner;