/**
 * Susan AI - Performance Tests to Identify "Spinning" Issue
 * Comprehensive analysis of upload and analysis workflow bottlenecks
 */

import { test, expect } from '@playwright/test';
import { performance } from 'perf_hooks';
import path from 'path';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';
const TEST_IMAGES_DIR = path.join(process.cwd(), 'tests/test-data/images');
const TEST_IMAGE = path.join(TEST_IMAGES_DIR, 'hail-damage-sample.jpg');

test.describe('Spinning Issue Root Cause Analysis', () => {

    test.beforeEach(async ({ page }) => {
        // Set up detailed performance monitoring
        await page.goto(`${BASE_URL}/roofing-analysis.html`, { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });
        
        // Wait for app initialization
        await page.waitForSelector('.roofing-dashboard', { timeout: 10000 });
        
        // Enable detailed performance monitoring
        await page.addInitScript(() => {
            window.performanceData = {
                navigationStart: performance.now(),
                events: [],
                networkRequests: [],
                jsErrors: []
            };
            
            // Monitor performance entries
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    window.performanceData.events.push({
                        name: entry.name,
                        type: entry.entryType,
                        startTime: entry.startTime,
                        duration: entry.duration,
                        timestamp: Date.now()
                    });
                }
            });
            observer.observe({ entryTypes: ['measure', 'mark', 'navigation', 'resource'] });
            
            // Monitor JavaScript errors
            window.addEventListener('error', (event) => {
                window.performanceData.jsErrors.push({
                    message: event.message,
                    filename: event.filename,
                    line: event.lineno,
                    column: event.colno,
                    timestamp: Date.now()
                });
            });
            
            // Monitor unhandled promise rejections
            window.addEventListener('unhandledrejection', (event) => {
                window.performanceData.jsErrors.push({
                    message: `Unhandled Promise Rejection: ${event.reason}`,
                    timestamp: Date.now()
                });
            });
        });
    });

    test('should identify bottlenecks in image upload process', async ({ page }) => {
        const testStartTime = performance.now();
        
        // Monitor network requests
        const networkRequests = [];
        page.on('request', request => {
            networkRequests.push({
                url: request.url(),
                method: request.method(),
                timestamp: Date.now(),
                type: 'request'
            });
        });
        
        page.on('response', response => {
            networkRequests.push({
                url: response.url(),
                status: response.status(),
                timestamp: Date.now(),
                type: 'response'
            });
        });
        
        // Step 1: Upload image and measure timing
        console.log('🔍 Step 1: Measuring image upload timing...');
        const uploadStartTime = Date.now();
        
        await page.locator('.photo-drop-zone').click();
        await page.setInputFiles('#fileInput', TEST_IMAGE);
        
        // Wait for upload processing
        await page.waitForSelector('.photo-grid', { state: 'visible', timeout: 15000 });
        
        const uploadEndTime = Date.now();
        const uploadDuration = uploadEndTime - uploadStartTime;
        
        console.log(`✅ Upload processing took: ${uploadDuration}ms`);
        
        // Step 2: Start analysis and monitor for spinning
        console.log('🔍 Step 2: Monitoring analysis process for spinning...');
        
        const analysisStartTime = Date.now();
        const analyzeBtn = page.locator('#analyzeBtn');
        await expect(analyzeBtn).toBeEnabled();
        
        // Click analyze and immediately start monitoring
        await analyzeBtn.click();
        
        // Monitor analysis progress indicators
        const progressMonitor = setInterval(async () => {
            try {
                const progressElement = await page.locator('.progress-fill').getAttribute('style');
                const progressText = await page.locator('#progressText').textContent();
                const currentTime = Date.now();
                
                console.log(`Progress at ${currentTime - analysisStartTime}ms: ${progressElement} - ${progressText}`);
            } catch (error) {
                // Element might not exist yet
            }
        }, 1000);
        
        // Wait for analysis to complete or timeout detecting spinning
        let analysisCompleted = false;
        let spinningDetected = false;
        let lastProgressUpdate = Date.now();
        
        try {
            await page.waitForFunction(() => {
                const app = window.roofingApp;
                return app && !app.isAnalyzing();
            }, { 
                timeout: 120000, // 2 minute timeout
                polling: 1000
            });
            
            analysisCompleted = true;
            
        } catch (timeoutError) {
            console.error('❌ Analysis timed out - spinning issue detected!');
            spinningDetected = true;
            
            // Take screenshot of spinning state
            await page.screenshot({ path: 'spinning-issue-screenshot.png' });
            
        } finally {
            clearInterval(progressMonitor);
        }
        
        const analysisEndTime = Date.now();
        const totalAnalysisTime = analysisEndTime - analysisStartTime;
        
        // Step 3: Analyze performance data
        console.log('🔍 Step 3: Analyzing performance data...');
        
        const performanceData = await page.evaluate(() => window.performanceData);
        
        // Check for JavaScript errors
        if (performanceData.jsErrors.length > 0) {
            console.error('❌ JavaScript errors detected:', performanceData.jsErrors);
        }
        
        // Analyze network requests
        const analysisRequests = networkRequests.filter(req => 
            req.url.includes('analyze-photo') || req.url.includes('photo-analysis')
        );
        
        console.log('📊 Performance Analysis Results:');
        console.log(`- Upload Duration: ${uploadDuration}ms`);
        console.log(`- Analysis Duration: ${totalAnalysisTime}ms`);
        console.log(`- Analysis Completed: ${analysisCompleted}`);
        console.log(`- Spinning Detected: ${spinningDetected}`);
        console.log(`- Analysis API Requests: ${analysisRequests.length}`);
        console.log(`- JavaScript Errors: ${performanceData.jsErrors.length}`);
        
        // Identify potential issues
        const issues = [];
        
        if (uploadDuration > 5000) {
            issues.push(`Slow upload processing: ${uploadDuration}ms`);
        }
        
        if (totalAnalysisTime > 60000 && !analysisCompleted) {
            issues.push(`Analysis timeout: ${totalAnalysisTime}ms without completion`);
        }
        
        if (performanceData.jsErrors.length > 0) {
            issues.push(`JavaScript errors: ${performanceData.jsErrors.length} errors`);
        }
        
        if (analysisRequests.filter(req => req.type === 'request').length === 0) {
            issues.push('No analysis API requests detected - possible frontend issue');
        }
        
        if (analysisRequests.filter(req => req.type === 'response').length === 0) {
            issues.push('No analysis API responses detected - possible backend issue');
        }
        
        // Report findings
        if (issues.length > 0) {
            console.error('❌ Issues identified:');
            issues.forEach(issue => console.error(`  - ${issue}`));
        } else {
            console.log('✅ No major issues detected in this test run');
        }
        
        // Assert test results
        expect(performanceData.jsErrors.length).toBe(0); // No JS errors
        expect(uploadDuration).toBeLessThan(10000); // Upload should be under 10s
        
        if (spinningDetected) {
            throw new Error(`Spinning issue detected! Analysis did not complete in ${totalAnalysisTime}ms`);
        }
    });

    test('should measure WebSocket connection reliability during analysis', async ({ page }) => {
        console.log('🔍 Testing WebSocket reliability during analysis...');
        
        const wsMessages = [];
        let wsConnectionLost = false;
        
        // Monitor WebSocket messages
        await page.evaluateOnNewDocument(() => {
            const originalWebSocket = window.WebSocket;
            window.WebSocket = class extends originalWebSocket {
                constructor(...args) {
                    super(...args);
                    
                    this.addEventListener('open', () => {
                        window.wsConnectionEvents = window.wsConnectionEvents || [];
                        window.wsConnectionEvents.push({ type: 'open', timestamp: Date.now() });
                    });
                    
                    this.addEventListener('close', () => {
                        window.wsConnectionEvents = window.wsConnectionEvents || [];
                        window.wsConnectionEvents.push({ type: 'close', timestamp: Date.now() });
                    });
                    
                    this.addEventListener('error', (error) => {
                        window.wsConnectionEvents = window.wsConnectionEvents || [];
                        window.wsConnectionEvents.push({ type: 'error', timestamp: Date.now(), error: error.toString() });
                    });
                    
                    this.addEventListener('message', (event) => {
                        window.wsMessages = window.wsMessages || [];
                        window.wsMessages.push({ 
                            data: event.data, 
                            timestamp: Date.now(),
                            type: 'message' 
                        });
                    });
                }
            };
        });
        
        // Upload and analyze
        await page.locator('.photo-drop-zone').click();
        await page.setInputFiles('#fileInput', TEST_IMAGE);
        await page.waitForSelector('.photo-grid', { state: 'visible' });
        
        const analysisStartTime = Date.now();
        await page.locator('#analyzeBtn').click();
        
        // Monitor WebSocket during analysis
        let analysisCompleted = false;
        
        try {
            await page.waitForFunction(() => {
                const app = window.roofingApp;
                return app && !app.isAnalyzing();
            }, { timeout: 90000 });
            
            analysisCompleted = true;
            
        } catch (error) {
            console.error('Analysis did not complete within timeout');
        }
        
        // Get WebSocket data
        const wsConnectionEvents = await page.evaluate(() => window.wsConnectionEvents || []);
        const wsMessageEvents = await page.evaluate(() => window.wsMessages || []);
        
        console.log('📊 WebSocket Analysis:');
        console.log(`- Connection Events: ${wsConnectionEvents.length}`);
        console.log(`- Messages Received: ${wsMessageEvents.length}`);
        console.log(`- Analysis Completed: ${analysisCompleted}`);
        
        // Check for WebSocket issues
        const connectionLosses = wsConnectionEvents.filter(e => e.type === 'close' || e.type === 'error');
        const openConnections = wsConnectionEvents.filter(e => e.type === 'open');
        
        if (connectionLosses.length > 0) {
            console.error('❌ WebSocket connection issues detected:', connectionLosses);
        }
        
        if (openConnections.length === 0) {
            console.error('❌ No WebSocket connections established');
        }
        
        // Analysis: if analysis didn't complete and WebSocket had issues, that's likely the cause
        if (!analysisCompleted && connectionLosses.length > 0) {
            throw new Error('Analysis failure likely caused by WebSocket connection issues');
        }
        
        console.log('✅ WebSocket reliability analysis complete');
    });

    test('should measure API response times and identify slow endpoints', async ({ page }) => {
        console.log('🔍 Measuring API response times...');
        
        const apiRequests = [];
        
        // Monitor all network requests
        page.on('request', request => {
            if (request.url().includes('/api/')) {
                apiRequests.push({
                    url: request.url(),
                    method: request.method(),
                    startTime: Date.now(),
                    type: 'request'
                });
            }
        });
        
        page.on('response', async response => {
            if (response.url().includes('/api/')) {
                const matchingRequest = apiRequests.find(req => 
                    req.url === response.url() && req.type === 'request'
                );
                
                if (matchingRequest) {
                    const responseTime = Date.now() - matchingRequest.startTime;
                    apiRequests.push({
                        url: response.url(),
                        status: response.status(),
                        responseTime: responseTime,
                        type: 'response'
                    });
                    
                    console.log(`API Response: ${response.url()} - ${response.status()} - ${responseTime}ms`);
                }
            }
        });
        
        // Test health check endpoint first
        console.log('Testing health check endpoint...');
        const healthCheckStart = Date.now();
        
        const healthResponse = await page.evaluate(async () => {
            try {
                const response = await fetch('/api/v1/photo-analysis/analyze-photo/health');
                return {
                    status: response.status,
                    ok: response.ok,
                    responseTime: Date.now()
                };
            } catch (error) {
                return { error: error.message };
            }
        });
        
        const healthCheckTime = healthResponse.responseTime - healthCheckStart;
        console.log(`Health check: ${healthCheckTime}ms`);
        
        // Upload and analyze to test main endpoints
        await page.locator('.photo-drop-zone').click();
        await page.setInputFiles('#fileInput', TEST_IMAGE);
        await page.waitForSelector('.photo-grid', { state: 'visible' });
        
        const analysisAPIStart = Date.now();
        await page.locator('#analyzeBtn').click();
        
        // Wait for analysis API call to complete
        try {
            await page.waitForFunction(() => {
                const app = window.roofingApp;
                return app && !app.isAnalyzing();
            }, { timeout: 120000 });
            
        } catch (error) {
            console.error('Analysis API did not respond within timeout');
        }
        
        const analysisAPIEnd = Date.now();
        const totalAnalysisAPITime = analysisAPIEnd - analysisAPIStart;
        
        // Analyze API performance
        const analysisAPIResponses = apiRequests.filter(req => 
            req.url.includes('analyze-photo') && req.type === 'response'
        );
        
        console.log('📊 API Performance Analysis:');
        console.log(`- Health Check Time: ${healthCheckTime}ms`);
        console.log(`- Total Analysis API Time: ${totalAnalysisAPITime}ms`);
        console.log(`- Analysis API Responses: ${analysisAPIResponses.length}`);
        
        if (analysisAPIResponses.length > 0) {
            analysisAPIResponses.forEach(response => {
                console.log(`  - ${response.url}: ${response.status} in ${response.responseTime}ms`);
                
                // Flag slow responses
                if (response.responseTime > 30000) { // 30 seconds
                    console.error(`❌ Slow API response detected: ${response.responseTime}ms`);
                }
            });
        } else {
            console.error('❌ No analysis API responses recorded - this indicates the spinning issue!');
        }
        
        // Identify issues
        if (healthCheckTime > 5000) {
            console.error('❌ Health check endpoint is slow');
        }
        
        if (totalAnalysisAPITime > 60000 && analysisAPIResponses.length === 0) {
            throw new Error('API did not respond - this is likely the root cause of spinning!');
        }
        
        console.log('✅ API response time analysis complete');
    });

    test('should identify memory leaks during repeated uploads', async ({ page }) => {
        console.log('🔍 Testing for memory leaks during repeated uploads...');
        
        // Get initial memory usage
        const getMemoryUsage = async () => {
            return await page.evaluate(() => {
                if (performance.memory) {
                    return {
                        used: performance.memory.usedJSHeapSize,
                        total: performance.memory.totalJSHeapSize,
                        limit: performance.memory.jsHeapSizeLimit
                    };
                }
                return null;
            });
        };
        
        const initialMemory = await getMemoryUsage();
        console.log('Initial memory:', initialMemory);
        
        // Perform multiple upload cycles
        const uploadCycles = 5;
        const memorySnapshots = [];
        
        for (let cycle = 0; cycle < uploadCycles; cycle++) {
            console.log(`Memory test cycle ${cycle + 1}/${uploadCycles}`);
            
            // Upload image
            await page.locator('.photo-drop-zone').click();
            await page.setInputFiles('#fileInput', TEST_IMAGE);
            await page.waitForSelector('.photo-grid', { state: 'visible' });
            
            // Clear photos (should free memory)
            await page.locator('#clearPhotos').click();
            
            // Force garbage collection (if available in test environment)
            await page.evaluate(() => {
                if (window.gc) {
                    window.gc();
                }
            });
            
            // Take memory snapshot
            const memoryAfterCycle = await getMemoryUsage();
            memorySnapshots.push({
                cycle: cycle + 1,
                memory: memoryAfterCycle
            });
            
            console.log(`Cycle ${cycle + 1} memory:`, memoryAfterCycle);
            
            // Small delay between cycles
            await page.waitForTimeout(1000);
        }
        
        // Analyze memory usage trends
        if (initialMemory && memorySnapshots.length > 0) {
            const finalMemory = memorySnapshots[memorySnapshots.length - 1].memory;
            const memoryIncrease = finalMemory.used - initialMemory.used;
            const memoryIncreasePercent = (memoryIncrease / initialMemory.used) * 100;
            
            console.log('📊 Memory Leak Analysis:');
            console.log(`- Initial Memory: ${(initialMemory.used / 1024 / 1024).toFixed(2)} MB`);
            console.log(`- Final Memory: ${(finalMemory.used / 1024 / 1024).toFixed(2)} MB`);
            console.log(`- Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(1)}%)`);
            
            // Flag significant memory increases
            if (memoryIncreasePercent > 50) {
                console.error('❌ Significant memory increase detected - possible memory leak');
            } else {
                console.log('✅ Memory usage appears stable');
            }
        }
        
        console.log('✅ Memory leak analysis complete');
    });

    test('should measure DOM update performance during analysis', async ({ page }) => {
        console.log('🔍 Measuring DOM update performance...');
        
        // Set up DOM mutation observer
        await page.evaluate(() => {
            window.domUpdates = [];
            
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    window.domUpdates.push({
                        type: mutation.type,
                        target: mutation.target.tagName || mutation.target.nodeName,
                        timestamp: Date.now()
                    });
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true
            });
        });
        
        // Upload and start analysis
        await page.locator('.photo-drop-zone').click();
        await page.setInputFiles('#fileInput', TEST_IMAGE);
        await page.waitForSelector('.photo-grid', { state: 'visible' });
        
        const domTestStart = Date.now();
        await page.locator('#analyzeBtn').click();
        
        // Monitor DOM updates during analysis
        let analysisCompleted = false;
        
        try {
            await page.waitForFunction(() => {
                const app = window.roofingApp;
                return app && !app.isAnalyzing();
            }, { timeout: 90000 });
            
            analysisCompleted = true;
            
        } catch (error) {
            console.log('Analysis timed out during DOM performance test');
        }
        
        // Get DOM update data
        const domUpdates = await page.evaluate(() => window.domUpdates || []);
        const testDuration = Date.now() - domTestStart;
        
        console.log('📊 DOM Performance Analysis:');
        console.log(`- Total DOM Updates: ${domUpdates.length}`);
        console.log(`- Test Duration: ${testDuration}ms`);
        console.log(`- Updates per Second: ${(domUpdates.length / (testDuration / 1000)).toFixed(2)}`);
        console.log(`- Analysis Completed: ${analysisCompleted}`);
        
        // Analyze update patterns
        const updateTypes = domUpdates.reduce((acc, update) => {
            acc[update.type] = (acc[update.type] || 0) + 1;
            return acc;
        }, {});
        
        console.log('- Update Types:', updateTypes);
        
        // Flag excessive DOM updates
        if (domUpdates.length > 1000 && !analysisCompleted) {
            console.error('❌ Excessive DOM updates detected - possible cause of spinning');
        }
        
        console.log('✅ DOM performance analysis complete');
    });

    test('should generate comprehensive spinning issue report', async ({ page }) => {
        console.log('🔍 Generating comprehensive spinning issue report...');
        
        const report = {
            testTimestamp: new Date().toISOString(),
            userAgent: await page.evaluate(() => navigator.userAgent),
            viewport: await page.viewportSize(),
            issues: [],
            recommendations: [],
            performanceMetrics: {}
        };
        
        try {
            // Test 1: Basic functionality
            const basicTestStart = Date.now();
            await page.locator('.photo-drop-zone').click();
            await page.setInputFiles('#fileInput', TEST_IMAGE);
            await page.waitForSelector('.photo-grid', { state: 'visible' });
            
            const uploadTime = Date.now() - basicTestStart;
            report.performanceMetrics.uploadTime = uploadTime;
            
            // Test 2: Analysis process
            const analysisTestStart = Date.now();
            let analysisTimeout = false;
            let analysisError = null;
            
            try {
                await page.locator('#analyzeBtn').click();
                await page.waitForFunction(() => {
                    const app = window.roofingApp;
                    return app && !app.isAnalyzing();
                }, { timeout: 60000 }); // 1 minute timeout for report
                
            } catch (error) {
                analysisTimeout = true;
                analysisError = error.message;
            }
            
            const analysisTime = Date.now() - analysisTestStart;
            report.performanceMetrics.analysisTime = analysisTime;
            report.performanceMetrics.analysisTimeout = analysisTimeout;
            
            // Collect JavaScript errors
            const jsErrors = await page.evaluate(() => {
                const errors = [];
                
                // Check for console errors
                if (window.console && window.console.errors) {
                    errors.push(...window.console.errors);
                }
                
                return errors;
            });
            
            report.performanceMetrics.jsErrors = jsErrors.length;
            
            // Analyze issues
            if (uploadTime > 5000) {
                report.issues.push(`Slow upload processing: ${uploadTime}ms`);
                report.recommendations.push('Optimize image processing pipeline');
            }
            
            if (analysisTimeout) {
                report.issues.push(`Analysis timeout after ${analysisTime}ms`);
                report.recommendations.push('Check API connectivity and response times');
            }
            
            if (jsErrors.length > 0) {
                report.issues.push(`JavaScript errors detected: ${jsErrors.length}`);
                report.recommendations.push('Fix JavaScript errors in console');
            }
            
            // Check WebSocket connectivity
            const wsState = await page.evaluate(() => {
                const app = window.roofingApp;
                return app ? app.getWebSocketState() : 'unknown';
            });
            
            if (wsState !== 1) { // 1 = OPEN
                report.issues.push(`WebSocket connection not open: state ${wsState}`);
                report.recommendations.push('Check WebSocket server connectivity');
            }
            
            // Summary
            if (report.issues.length === 0) {
                report.summary = 'No issues detected in this test run';
            } else {
                report.summary = `${report.issues.length} issues identified that could cause spinning`;
            }
            
            console.log('📋 SPINNING ISSUE ANALYSIS REPORT');
            console.log('=====================================');
            console.log(`Test Date: ${report.testTimestamp}`);
            console.log(`Browser: ${report.userAgent}`);
            console.log(`Viewport: ${report.viewport.width}x${report.viewport.height}`);
            console.log('');
            console.log('PERFORMANCE METRICS:');
            console.log(`- Upload Time: ${report.performanceMetrics.uploadTime}ms`);
            console.log(`- Analysis Time: ${report.performanceMetrics.analysisTime}ms`);
            console.log(`- Analysis Timeout: ${report.performanceMetrics.analysisTimeout}`);
            console.log(`- JavaScript Errors: ${report.performanceMetrics.jsErrors}`);
            console.log(`- WebSocket State: ${wsState}`);
            console.log('');
            
            if (report.issues.length > 0) {
                console.log('ISSUES IDENTIFIED:');
                report.issues.forEach((issue, index) => {
                    console.log(`${index + 1}. ${issue}`);
                });
                console.log('');
                
                console.log('RECOMMENDATIONS:');
                report.recommendations.forEach((rec, index) => {
                    console.log(`${index + 1}. ${rec}`);
                });
            } else {
                console.log('✅ NO ISSUES DETECTED');
            }
            
            console.log('');
            console.log(`SUMMARY: ${report.summary}`);
            console.log('=====================================');
            
            // Assert based on findings
            if (analysisTimeout) {
                throw new Error(`SPINNING ISSUE CONFIRMED: Analysis timed out after ${analysisTime}ms`);
            }
            
        } catch (error) {
            report.testError = error.message;
            throw error;
        }
        
        // Save report (in real environment, this would be saved to file)
        console.log('✅ Comprehensive spinning issue analysis complete');
    });
});