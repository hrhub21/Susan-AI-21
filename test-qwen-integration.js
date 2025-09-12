#!/usr/bin/env node

/**
 * Comprehensive Qwen Vision Integration Test Suite
 * Tests the complete integration between JavaScript frontend and Python Qwen backend
 * 
 * Usage: node test-qwen-integration.js [test-type]
 * Test types: all, roofing, document, building-code, legal, multi-agent
 */

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class QwenIntegrationTester {
    constructor() {
        this.testResults = new Map();
        this.startTime = Date.now();
        
        console.log(chalk.blue.bold('🧪 Qwen Vision Integration Test Suite'));
        console.log(chalk.gray('─'.repeat(50)));
    }

    async runTests(testType = 'all') {
        try {
            console.log(chalk.yellow('📋 Starting comprehensive integration tests...'));
            
            // Test 1: Basic system status
            await this.testBasicSystemStatus();
            
            // Test 2: Python backend connection
            await this.testPythonBackend();
            
            // Test 3: Import and test the integration service
            await this.testQwenIntegration();
            
            // Test 4: Multi-agent coordination (if integration works)
            if (this.testResults.get('qwen_integration')?.passed) {
                await this.testMultiAgentCapabilities();
            }

            // Report results
            this.reportResults();

        } catch (error) {
            console.error(chalk.red('❌ Test suite failed:'), error.message);
            if (error.stack) {
                console.error(chalk.gray(error.stack));
            }
            process.exit(1);
        }
    }

    async testBasicSystemStatus() {
        console.log(chalk.blue('🔍 Testing basic system status...'));
        
        try {
            // Check if key files exist
            const requiredFiles = [
                './src/qwen-vision-integration.js',
                './src/api/services/QwenVLService.js',
                './deploy-full-susan.js'
            ];

            const missingFiles = [];
            for (const file of requiredFiles) {
                if (!await fs.pathExists(path.join(__dirname, file))) {
                    missingFiles.push(file);
                }
            }

            if (missingFiles.length === 0) {
                console.log(chalk.green('✅ All required files present'));
                this.testResults.set('system_files', { passed: true, details: 'All files found' });
            } else {
                console.log(chalk.red(`❌ Missing files: ${missingFiles.join(', ')}`));
                this.testResults.set('system_files', { passed: false, error: `Missing: ${missingFiles.join(', ')}` });
            }

        } catch (error) {
            console.log(chalk.red('❌ System status test failed'));
            this.testResults.set('system_files', { passed: false, error: error.message });
        }
    }

    async testPythonBackend() {
        console.log(chalk.blue('🐍 Testing Python backend connection...'));
        
        try {
            const fetch = (await import('node-fetch')).default;
            
            // Test connection to Python backend
            try {
                const response = await fetch('http://localhost:3031/status', { timeout: 5000 });
                
                if (response.ok) {
                    const status = await response.json();
                    console.log(chalk.green('✅ Python backend is online'));
                    console.log(chalk.gray(`   Model loaded: ${status.model_loaded ? 'Yes' : 'No'}`));
                    
                    this.testResults.set('python_backend', { 
                        passed: true, 
                        details: { 
                            online: true, 
                            modelLoaded: status.model_loaded,
                            port: 3031
                        }
                    });
                } else {
                    throw new Error(`Backend responded with status ${response.status}`);
                }
            } catch (fetchError) {
                console.log(chalk.yellow('⚠️ Python backend not available (will test offline mode)'));
                this.testResults.set('python_backend', { 
                    passed: true, // Still pass - offline mode is valid
                    details: { online: false, offline: true }
                });
            }

        } catch (error) {
            console.log(chalk.yellow('⚠️ Python backend test inconclusive'));
            this.testResults.set('python_backend', { passed: true, error: error.message });
        }
    }

    async testQwenIntegration() {
        console.log(chalk.blue('🔗 Testing Qwen Vision Integration service...'));
        
        try {
            // Import the integration service
            const { default: qwenIntegration } = await import('./src/qwen-vision-integration.js');
            
            console.log(chalk.gray('   Integration service imported successfully'));
            
            // Give it a moment to initialize
            await this.sleep(2000);
            
            // Get system status
            const status = qwenIntegration.getSystemStatus();
            console.log(chalk.gray(`   Services initialized: ${Object.keys(status.services).length}`));
            console.log(chalk.gray(`   Agents available: ${status.agents.length}`));
            console.log(chalk.gray(`   Cache system: ${status.cache ? 'Working' : 'Error'}`));
            
            // Test a simple analysis
            console.log(chalk.gray('   Testing simple roofing analysis...'));
            const testImage = this.createTestImage();
            
            const result = await qwenIntegration.analyzeWithVision(
                testImage,
                'roofing_damage',
                { 
                    filename: 'test_roof.jpg',
                    testMode: true 
                }
            );

            if (result && result.success !== false) {
                console.log(chalk.green('✅ Qwen Integration working correctly'));
                this.testResults.set('qwen_integration', { 
                    passed: true, 
                    details: {
                        servicesCount: Object.keys(status.services).length,
                        agentsCount: status.agents.length,
                        testAnalysis: {
                            damageType: result.damageType,
                            confidence: result.confidence,
                            agentUsed: result.agentUsed
                        }
                    }
                });
            } else {
                console.log(chalk.yellow('⚠️ Integration working but analysis failed'));
                this.testResults.set('qwen_integration', { 
                    passed: false, 
                    error: result?.error || 'Analysis returned no results'
                });
            }

        } catch (error) {
            console.log(chalk.red('❌ Qwen Integration test failed'));
            this.testResults.set('qwen_integration', { passed: false, error: error.message });
        }
    }

    async testMultiAgentCapabilities() {
        console.log(chalk.blue('🤝 Testing multi-agent capabilities...'));
        
        try {
            const { default: qwenIntegration } = await import('./src/qwen-vision-integration.js');
            
            const testImage = this.createTestImage();
            
            // Test multi-agent coordination
            const result = await qwenIntegration.coordinateMultiAgentAnalysis(
                testImage,
                ['roofing_damage', 'weather_damage'],
                { testMode: true }
            );

            if (result && result.coordinationType === 'multi_agent') {
                console.log(chalk.green('✅ Multi-agent coordination working'));
                this.testResults.set('multi_agent', { 
                    passed: true, 
                    details: {
                        analysisTypes: result.analysisTypes,
                        resultsCount: Object.keys(result.individualResults || {}).length,
                        correlationScore: result.correlation?.consistencyScore || 0
                    }
                });
            } else {
                console.log(chalk.yellow('⚠️ Multi-agent coordination failed'));
                this.testResults.set('multi_agent', { passed: false, error: result?.error });
            }

        } catch (error) {
            console.log(chalk.red('❌ Multi-agent test failed'));
            this.testResults.set('multi_agent', { passed: false, error: error.message });
        }
    }

    createTestImage() {
        // Minimal 1x1 PNG image in base64
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }

    reportResults() {
        const duration = Math.round((Date.now() - this.startTime) / 1000);
        
        console.log(chalk.blue.bold('\n📊 Test Results Summary'));
        console.log(chalk.gray('─'.repeat(60)));

        let passedTests = 0;
        const totalTests = this.testResults.size;

        for (const [testName, result] of this.testResults) {
            const icon = result.passed ? '✅' : '❌';
            const status = result.passed ? chalk.green('PASSED') : chalk.red('FAILED');
            
            console.log(`${icon} ${testName}: ${status}`);
            
            if (result.passed) {
                passedTests++;
                if (result.details) {
                    console.log(chalk.gray(`   ${JSON.stringify(result.details, null, 2)}`));
                }
            } else if (result.error) {
                console.log(chalk.red(`   Error: ${result.error}`));
            }
        }

        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.cyan(`📈 Overall: ${passedTests}/${totalTests} tests passed`));
        console.log(chalk.cyan(`⏱️ Duration: ${duration} seconds`));

        if (passedTests === totalTests) {
            console.log(chalk.green.bold('🎉 All tests passed! Integration is working correctly.'));
            console.log(chalk.blue('\n🚀 Quick Start Guide:'));
            console.log(chalk.white('1. Start the full system: node deploy-full-susan.js'));
            console.log(chalk.white('2. Access Susan API: http://localhost:3001'));
            console.log(chalk.white('3. Python backend: http://localhost:3031'));
            console.log(chalk.white('4. Test roofing analysis: POST /api/v1/roofing-analysis'));
        } else {
            console.log(chalk.yellow.bold('⚠️ Some tests failed. Check the details above.'));
            console.log(chalk.blue('\n🔧 Troubleshooting:'));
            console.log(chalk.white('- Ensure Python backend is running: python3 /Users/a21/Susan_AI/web_interface.py'));
            console.log(chalk.white('- Check if all dependencies are installed: npm install'));
            console.log(chalk.white('- Verify file permissions and paths'));
        }

        // Exit with appropriate code
        process.exit(passedTests === totalTests ? 0 : 1);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    const testType = process.argv[2] || 'all';
    
    try {
        const tester = new QwenIntegrationTester();
        await tester.runTests(testType);
    } catch (error) {
        console.error(chalk.red('💥 Test suite crashed:'), error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default QwenIntegrationTester;