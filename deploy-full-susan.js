#!/usr/bin/env node

/**
 * Complete Susan AI Deployment Script
 * Orchestrates the startup of all Susan AI Enhanced services including:
 * - Python Qwen 2.5 VL backend (localhost:3031)
 * - JavaScript Enhanced Susan API (localhost:3001)
 * - Qwen Vision Integration Hub
 * - All specialized AI agents
 * - Health monitoring and status reporting
 * 
 * Usage: node deploy-full-susan.js [options]
 * Options:
 *   --dev: Development mode with verbose logging
 *   --production: Production mode with optimizations
 *   --offline: Start in offline mode (skip Python backend)
 *   --health-check: Only check service health
 */

import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SusanAIDeployment {
    constructor() {
        this.services = new Map();
        this.deploymentStatus = new Map();
        this.healthChecks = new Map();
        this.config = this.loadConfiguration();
        this.startTime = Date.now();
        
        // Parse command line arguments
        this.args = this.parseArguments();
        
        console.log(chalk.blue.bold('🚀 Susan AI Enhanced - Full System Deployment'));
        console.log(chalk.gray('─'.repeat(60)));
    }

    /**
     * Load deployment configuration
     */
    loadConfiguration() {
        return {
            pythonBackend: {
                name: 'Python Qwen VL Backend',
                script: '/Users/a21/Susan_AI/web_interface.py',
                port: 3031,
                host: 'localhost',
                healthEndpoint: '/status',
                startupTime: 30000, // 30 seconds for model loading
                required: !this.args?.offline
            },
            susanAPI: {
                name: 'Susan AI Enhanced API',
                script: './src/api/server.js',
                port: process.env.PORT || 3004,
                host: 'localhost',
                healthEndpoint: '/api/v1/health',
                startupTime: 10000,
                required: true
            },
            qwenIntegration: {
                name: 'Qwen Vision Integration',
                module: './src/qwen-vision-integration.js',
                healthCheck: 'internal',
                startupTime: 5000,
                required: true
            }
        };
    }

    /**
     * Parse command line arguments
     */
    parseArguments() {
        const args = process.argv.slice(2);
        return {
            dev: args.includes('--dev'),
            production: args.includes('--production'),
            offline: args.includes('--offline'),
            healthCheck: args.includes('--health-check'),
            verbose: args.includes('--verbose') || args.includes('--dev')
        };
    }

    /**
     * Main deployment orchestration
     */
    async deploy() {
        try {
            console.log(chalk.yellow('📋 Starting deployment sequence...'));
            
            // Health check mode
            if (this.args.healthCheck) {
                return await this.performHealthCheck();
            }

            // Pre-deployment checks
            await this.preDeploymentChecks();

            // Start services in order
            await this.startPythonBackend();
            await this.startSusanAPI();
            await this.initializeQwenIntegration();

            // Post-deployment validation
            await this.postDeploymentValidation();
            
            // Start monitoring
            this.startMonitoring();
            
            this.deploymentComplete();

        } catch (error) {
            console.error(chalk.red('❌ Deployment failed:'), error.message);
            await this.cleanup();
            process.exit(1);
        }
    }

    /**
     * Pre-deployment environment checks
     */
    async preDeploymentChecks() {
        const spinner = ora('🔍 Running pre-deployment checks...').start();
        
        try {
            // Check Node.js version
            const nodeVersion = process.version;
            if (!nodeVersion.startsWith('v18') && !nodeVersion.startsWith('v20')) {
                spinner.warn(`Node.js version ${nodeVersion} may not be optimal. Recommended: v18 or v20`);
            }

            // Check Python availability (if not offline)
            if (!this.args.offline) {
                try {
                    await this.execAsync('python3 --version');
                    spinner.succeed('✅ Python 3 available');
                } catch (error) {
                    throw new Error('Python 3 not found. Required for Qwen VL backend.');
                }
            }

            // Check required directories
            const requiredDirs = [
                './src',
                './src/api',
                './src/api/services',
                './data',
                './logs'
            ];

            for (const dir of requiredDirs) {
                await fs.ensureDir(path.join(__dirname, dir));
            }

            // Check environment variables
            const requiredEnvVars = ['NODE_ENV'];
            const missingVars = requiredEnvVars.filter(v => !process.env[v]);
            
            if (missingVars.length > 0) {
                spinner.warn(`Missing environment variables: ${missingVars.join(', ')}`);
            }

            // Check port availability
            await this.checkPortAvailability();

            spinner.succeed('✅ Pre-deployment checks passed');

        } catch (error) {
            spinner.fail(`❌ Pre-deployment check failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if required ports are available
     */
    async checkPortAvailability() {
        const portsToCheck = [
            { port: process.env.PORT || 3004, service: 'Susan API' },
            { port: 3031, service: 'Python Qwen Backend' }
        ];

        for (const { port, service } of portsToCheck) {
            const isAvailable = await this.isPortAvailable(port);
            if (!isAvailable) {
                throw new Error(`Port ${port} is already in use (required for ${service})`);
            }
        }
    }

    /**
     * Start Python Qwen VL Backend
     */
    async startPythonBackend() {
        if (this.args.offline) {
            console.log(chalk.yellow('⏭️ Skipping Python backend (offline mode)'));
            return;
        }

        const service = this.config.pythonBackend;
        const spinner = ora(`🐍 Starting ${service.name}...`).start();

        try {
            // Check if Python service directory exists
            const pythonDir = path.dirname(service.script);
            if (!await fs.pathExists(pythonDir)) {
                throw new Error(`Python service directory not found: ${pythonDir}`);
            }

            // Start Python process
            const pythonProcess = spawn('python3', [service.script], {
                cwd: path.dirname(service.script),
                stdio: this.args.verbose ? 'inherit' : 'pipe',
                env: {
                    ...process.env,
                    PYTHONUNBUFFERED: '1'
                }
            });

            // Handle process events
            pythonProcess.on('error', (error) => {
                spinner.fail(`❌ Failed to start Python backend: ${error.message}`);
                this.deploymentStatus.set('pythonBackend', 'failed');
            });

            pythonProcess.on('exit', (code) => {
                if (code !== 0) {
                    console.log(chalk.red(`🐍 Python backend exited with code ${code}`));
                    this.deploymentStatus.set('pythonBackend', 'stopped');
                }
            });

            // Store process reference
            this.services.set('pythonBackend', pythonProcess);
            this.deploymentStatus.set('pythonBackend', 'starting');

            // Wait for service to be ready
            spinner.text = '⏳ Waiting for Python backend to load Qwen model...';
            await this.waitForService(
                `http://${service.host}:${service.port}${service.healthEndpoint}`,
                service.startupTime,
                'model_loaded'
            );

            spinner.succeed(`✅ ${service.name} started successfully on port ${service.port}`);
            this.deploymentStatus.set('pythonBackend', 'running');

        } catch (error) {
            spinner.fail(`❌ Failed to start Python backend: ${error.message}`);
            this.deploymentStatus.set('pythonBackend', 'failed');
            throw error;
        }
    }

    /**
     * Start Susan AI Enhanced API
     */
    async startSusanAPI() {
        const service = this.config.susanAPI;
        const spinner = ora(`🤖 Starting ${service.name}...`).start();

        try {
            // Start Susan API process
            const susanProcess = spawn('node', [service.script], {
                cwd: __dirname,
                stdio: this.args.verbose ? 'inherit' : 'pipe',
                env: {
                    ...process.env,
                    NODE_ENV: this.args.production ? 'production' : 'development',
                    PORT: service.port.toString(),
                    HOST: service.host
                }
            });

            // Handle process events
            susanProcess.on('error', (error) => {
                spinner.fail(`❌ Failed to start Susan API: ${error.message}`);
                this.deploymentStatus.set('susanAPI', 'failed');
            });

            susanProcess.on('exit', (code) => {
                if (code !== 0) {
                    console.log(chalk.red(`🤖 Susan API exited with code ${code}`));
                    this.deploymentStatus.set('susanAPI', 'stopped');
                }
            });

            // Store process reference
            this.services.set('susanAPI', susanProcess);
            this.deploymentStatus.set('susanAPI', 'starting');

            // Wait for service to be ready
            spinner.text = '⏳ Waiting for Susan API to initialize...';
            await this.waitForService(
                `http://${service.host}:${service.port}${service.healthEndpoint}`,
                service.startupTime
            );

            spinner.succeed(`✅ ${service.name} started successfully on port ${service.port}`);
            this.deploymentStatus.set('susanAPI', 'running');

        } catch (error) {
            spinner.fail(`❌ Failed to start Susan API: ${error.message}`);
            this.deploymentStatus.set('susanAPI', 'failed');
            throw error;
        }
    }

    /**
     * Initialize Qwen Vision Integration
     */
    async initializeQwenIntegration() {
        const service = this.config.qwenIntegration;
        const spinner = ora(`🔗 Initializing ${service.name}...`).start();

        try {
            // Dynamic import of the integration module
            const { default: qwenIntegration } = await import(service.module);

            // Wait for initialization
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Qwen Integration initialization timeout'));
                }, service.startupTime);

                qwenIntegration.once('backend:online', () => {
                    clearTimeout(timeout);
                    resolve();
                });

                qwenIntegration.once('backend:offline', () => {
                    if (!this.args.offline) {
                        clearTimeout(timeout);
                        reject(new Error('Python backend not available'));
                    }
                });

                // Initialize if not already initialized
                if (typeof qwenIntegration.initialize === 'function') {
                    qwenIntegration.initialize().catch(reject);
                } else {
                    // Already initialized during import
                    setTimeout(resolve, 1000);
                }
            });

            // Store reference
            this.services.set('qwenIntegration', qwenIntegration);
            this.deploymentStatus.set('qwenIntegration', 'running');

            spinner.succeed(`✅ ${service.name} initialized successfully`);

        } catch (error) {
            spinner.fail(`❌ Failed to initialize Qwen Integration: ${error.message}`);
            this.deploymentStatus.set('qwenIntegration', 'failed');
            throw error;
        }
    }

    /**
     * Post-deployment validation
     */
    async postDeploymentValidation() {
        const spinner = ora('🔍 Running post-deployment validation...').start();

        try {
            const validationResults = {
                pythonBackend: false,
                susanAPI: false,
                qwenIntegration: false,
                endToEndTest: false
            };

            // Validate Python backend
            if (!this.args.offline) {
                try {
                    const response = await fetch('http://localhost:3031/status');
                    const status = await response.json();
                    validationResults.pythonBackend = status.model_loaded === true;
                } catch (error) {
                    console.warn(chalk.yellow('⚠️ Python backend validation failed'));
                }
            } else {
                validationResults.pythonBackend = true; // Skip in offline mode
            }

            // Validate Susan API
            try {
                const response = await fetch('http://localhost:3001/api/v1/health');
                validationResults.susanAPI = response.ok;
            } catch (error) {
                console.warn(chalk.yellow('⚠️ Susan API validation failed'));
            }

            // Validate Qwen Integration
            const qwenIntegration = this.services.get('qwenIntegration');
            if (qwenIntegration) {
                const status = qwenIntegration.getSystemStatus();
                validationResults.qwenIntegration = status.services && Object.keys(status.services).length > 0;
            }

            // End-to-end test (simple)
            try {
                const testEndpoint = 'http://localhost:3001/api/v1/conversation/test';
                const response = await fetch(testEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'Hello Susan' })
                });
                validationResults.endToEndTest = response.ok;
            } catch (error) {
                // End-to-end test is optional
                console.warn(chalk.yellow('⚠️ End-to-end test skipped'));
            }

            // Report validation results
            const passedTests = Object.values(validationResults).filter(Boolean).length;
            const totalTests = Object.keys(validationResults).length;

            if (passedTests === totalTests) {
                spinner.succeed(`✅ All validation tests passed (${passedTests}/${totalTests})`);
            } else {
                spinner.warn(`⚠️ Some validation tests failed (${passedTests}/${totalTests})`);
                this.logValidationResults(validationResults);
            }

        } catch (error) {
            spinner.fail(`❌ Post-deployment validation failed: ${error.message}`);
            // Don't throw - validation failure shouldn't stop deployment
        }
    }

    /**
     * Start monitoring services
     */
    startMonitoring() {
        console.log(chalk.blue('👁️ Starting health monitoring...'));

        // Monitor Python backend
        if (!this.args.offline) {
            this.healthChecks.set('pythonBackend', setInterval(async () => {
                try {
                    const response = await fetch('http://localhost:3031/status');
                    const status = await response.json();
                    
                    if (!status.model_loaded) {
                        console.log(chalk.yellow('⚠️ Python backend model not loaded'));
                    }
                } catch (error) {
                    console.log(chalk.red('❌ Python backend health check failed'));
                }
            }, 30000)); // Check every 30 seconds
        }

        // Monitor Susan API
        this.healthChecks.set('susanAPI', setInterval(async () => {
            try {
                const response = await fetch('http://localhost:3001/api/v1/health');
                if (!response.ok) {
                    console.log(chalk.yellow('⚠️ Susan API health check warning'));
                }
            } catch (error) {
                console.log(chalk.red('❌ Susan API health check failed'));
            }
        }, 30000));

        console.log(chalk.green('✅ Health monitoring started'));
    }

    /**
     * Deployment completion message
     */
    deploymentComplete() {
        const duration = Math.round((Date.now() - this.startTime) / 1000);
        
        console.log(chalk.green.bold('\n🎉 Susan AI Enhanced Deployment Complete!'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.cyan('📊 Deployment Summary:'));
        
        // Service status
        for (const [serviceName, status] of this.deploymentStatus) {
            const icon = status === 'running' ? '✅' : status === 'failed' ? '❌' : '⏸️';
            console.log(`  ${icon} ${serviceName}: ${status}`);
        }

        console.log(chalk.cyan('\n🔗 Service URLs:'));
        console.log(`  📡 Susan AI API: http://localhost:3001`);
        console.log(`  🤖 API Documentation: http://localhost:3001/api/docs`);
        if (!this.args.offline) {
            console.log(`  🐍 Python Backend: http://localhost:3031`);
        }

        console.log(chalk.cyan('\n📝 Available Endpoints:'));
        console.log(`  💬 Chat: POST http://localhost:3001/api/v1/chat`);
        console.log(`  🏠 Roofing Analysis: POST http://localhost:3001/api/v1/roofing-analysis`);
        console.log(`  📄 Document OCR: POST http://localhost:3001/api/v1/document-ocr`);
        console.log(`  🏗️ Building Codes: POST http://localhost:3001/api/v1/building-codes`);
        console.log(`  ⚖️ Legal Compliance: POST http://localhost:3001/api/v1/legal-compliance`);

        console.log(chalk.cyan('\n⚡ Quick Start:'));
        console.log(`  # Test the system`);
        console.log(`  curl -X POST http://localhost:3001/api/v1/chat \\`);
        console.log(`    -H "Content-Type: application/json" \\`);
        console.log(`    -d '{"message": "Hello Susan!"}'`);

        console.log(chalk.cyan(`\n⏱️ Total deployment time: ${duration} seconds`));
        console.log(chalk.yellow('\n💡 Press Ctrl+C to stop all services'));
        
        // Setup graceful shutdown
        this.setupGracefulShutdown();
    }

    /**
     * Perform health check only
     */
    async performHealthCheck() {
        console.log(chalk.blue('🏥 Performing health check...'));

        const checks = [
            { name: 'Python Backend', url: 'http://localhost:3031/status' },
            { name: 'Susan API', url: 'http://localhost:3001/api/v1/health' }
        ];

        for (const check of checks) {
            const spinner = ora(`Checking ${check.name}...`).start();
            
            try {
                const response = await fetch(check.url, { timeout: 5000 });
                if (response.ok) {
                    const data = await response.json();
                    spinner.succeed(`✅ ${check.name} is healthy`);
                    if (this.args.verbose) {
                        console.log(chalk.gray(`   Response: ${JSON.stringify(data, null, 2)}`));
                    }
                } else {
                    spinner.fail(`❌ ${check.name} returned status ${response.status}`);
                }
            } catch (error) {
                spinner.fail(`❌ ${check.name} is not responding: ${error.message}`);
            }
        }

        console.log(chalk.blue('\n🏥 Health check complete'));
    }

    /**
     * Utility methods
     */
    async waitForService(url, timeout = 30000, requiredField = null) {
        const startTime = Date.now();
        const pollInterval = 1000;

        while (Date.now() - startTime < timeout) {
            try {
                const response = await fetch(url, { timeout: 5000 });
                if (response.ok) {
                    if (requiredField) {
                        const data = await response.json();
                        if (data[requiredField]) {
                            return true;
                        }
                    } else {
                        return true;
                    }
                }
            } catch (error) {
                // Service not ready yet
            }
            
            await this.sleep(pollInterval);
        }
        
        throw new Error(`Service not ready within ${timeout}ms`);
    }

    async isPortAvailable(port) {
        try {
            const response = await fetch(`http://localhost:${port}`, { timeout: 1000 });
            return false; // Port is in use
        } catch (error) {
            return true; // Port is available
        }
    }

    async execAsync(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve(stdout);
            });
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    logValidationResults(results) {
        console.log(chalk.yellow('\n📋 Validation Results:'));
        for (const [test, passed] of Object.entries(results)) {
            const icon = passed ? '✅' : '❌';
            console.log(`  ${icon} ${test}`);
        }
    }

    /**
     * Setup graceful shutdown
     */
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            console.log(chalk.yellow(`\n🛑 Received ${signal}, shutting down gracefully...`));
            await this.cleanup();
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    }

    /**
     * Cleanup all services
     */
    async cleanup() {
        console.log(chalk.blue('🧹 Cleaning up services...'));

        // Stop health checks
        for (const [name, interval] of this.healthChecks) {
            clearInterval(interval);
        }

        // Stop services
        for (const [name, service] of this.services) {
            try {
                if (service && typeof service.kill === 'function') {
                    service.kill('SIGTERM');
                    console.log(chalk.gray(`  🛑 Stopped ${name}`));
                } else if (service && typeof service.cleanup === 'function') {
                    await service.cleanup();
                    console.log(chalk.gray(`  🧹 Cleaned up ${name}`));
                }
            } catch (error) {
                console.warn(chalk.yellow(`⚠️ Error stopping ${name}: ${error.message}`));
            }
        }

        console.log(chalk.green('✅ Cleanup complete'));
    }
}

// Main execution
async function main() {
    try {
        const deployment = new SusanAIDeployment();
        await deployment.deploy();
    } catch (error) {
        console.error(chalk.red('💥 Deployment failed:'), error);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
    process.exit(1);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default SusanAIDeployment;