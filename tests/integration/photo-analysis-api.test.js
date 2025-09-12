/**
 * Susan AI Photo Analysis API Integration Tests
 * Tests the backend API endpoints for image analysis
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock the API server
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_TIMEOUT = 120000; // 2 minutes for analysis tests

// Test image data
let testImageBase64;
let largeImageBase64;
let invalidImageData;

beforeAll(async () => {
    // Create test image data
    await setupTestImageData();
    
    // Wait for API server to be ready
    await waitForAPI();
});

describe('Photo Analysis API Integration Tests', () => {

    describe('Health Check Endpoint', () => {
        test('should return health status', async () => {
            const response = await request(API_BASE_URL)
                .get('/api/v1/photo-analysis/analyze-photo/health')
                .expect(200);

            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('service');
            expect(response.body).toHaveProperty('primary');
            expect(response.body).toHaveProperty('fallback');
            expect(response.body).toHaveProperty('capabilities');
            
            // Verify service information
            expect(response.body.service).toContain('Enhanced Photo Analysis');
            expect(response.body.capabilities).toBeInstanceOf(Array);
            expect(response.body.capabilities.length).toBeGreaterThan(0);
            
            console.log('✅ Health check endpoint working');
        });

        test('should show available AI models', async () => {
            const response = await request(API_BASE_URL)
                .get('/api/v1/photo-analysis/analyze-photo/health')
                .expect(200);

            const { primary, fallback } = response.body;
            
            // Should have primary engine (Qwen2.5-VL)
            expect(primary).toHaveProperty('engine', 'Qwen2.5-VL');
            expect(primary).toHaveProperty('status');
            
            // Should have fallback engine (Claude)
            expect(fallback).toHaveProperty('engine', 'Claude Vision');
            expect(fallback).toHaveProperty('model', 'claude-3.5-sonnet-20241022');
            expect(fallback).toHaveProperty('status', 'available');
            
            console.log(`✅ Primary: ${primary.engine} (${primary.status}), Fallback: ${fallback.engine}`);
        });
    });

    describe('Chat Endpoint', () => {
        test('should respond to basic chat messages', async () => {
            const response = await request(API_BASE_URL)
                .post('/api/v1/photo-analysis/chat')
                .send({
                    message: 'Hello, are you ready to analyze photos?',
                    conversationId: 'test-conversation'
                })
                .expect(200);

            expect(response.body).toHaveProperty('response');
            expect(response.body).toHaveProperty('model');
            expect(response.body).toHaveProperty('conversationId', 'test-conversation');
            expect(response.body).toHaveProperty('timestamp');
            
            expect(response.body.response).toBeTruthy();
            expect(typeof response.body.response).toBe('string');
            
            console.log('✅ Chat endpoint responsive');
        });

        test('should handle empty messages gracefully', async () => {
            const response = await request(API_BASE_URL)
                .post('/api/v1/photo-analysis/chat')
                .send({})
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('response');
            expect(response.body.response).toContain('Please provide a message');
        });
    });

    describe('Photo Analysis Endpoint', () => {
        test('should analyze a valid roof damage image', async () => {
            const response = await request(API_BASE_URL)
                .post('/api/v1/photo-analysis/analyze-photo')
                .send({
                    image: testImageBase64,
                    filename: 'test-roof-damage.jpg'
                })
                .timeout(TEST_TIMEOUT)
                .expect(200);

            // Verify response structure
            expect(response.body).toHaveProperty('damageType');
            expect(response.body).toHaveProperty('severity');
            expect(response.body).toHaveProperty('confidence');
            expect(response.body).toHaveProperty('description');
            expect(response.body).toHaveProperty('findings');
            expect(response.body).toHaveProperty('recommendation');
            expect(response.body).toHaveProperty('analysisMethod');
            expect(response.body).toHaveProperty('totalProcessingTime');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('filename', 'test-roof-damage.jpg');

            // Verify data types and ranges
            expect(typeof response.body.damageType).toBe('string');
            expect(typeof response.body.severity).toBe('string');
            expect(typeof response.body.confidence).toBe('number');
            expect(response.body.confidence).toBeGreaterThanOrEqual(0);
            expect(response.body.confidence).toBeLessThanOrEqual(100);
            expect(response.body.totalProcessingTime).toBeGreaterThan(0);
            
            // Verify analysis method is one of the expected values
            expect(['Qwen2.5-VL', 'Claude-3.5-Sonnet (fallback)']).toContain(response.body.analysisMethod);
            
            console.log(`✅ Image analysis completed using ${response.body.analysisMethod}`);
            console.log(`   Damage: ${response.body.damageType} (${response.body.severity})`);
            console.log(`   Confidence: ${response.body.confidence}%`);
            console.log(`   Processing Time: ${response.body.totalProcessingTime}s`);
        }, TEST_TIMEOUT);

        test('should handle missing image data', async () => {
            const response = await request(API_BASE_URL)
                .post('/api/v1/photo-analysis/analyze-photo')
                .send({
                    filename: 'test.jpg'
                })
                .expect(400);

            expect(response.body).toHaveProperty('error', 'No image data provided');
            expect(response.body).toHaveProperty('damageType', 'Error: No image');
            expect(response.body).toHaveProperty('confidence', 0);
        });

        test('should handle invalid image data format', async () => {
            const response = await request(API_BASE_URL)
                .post('/api/v1/photo-analysis/analyze-photo')
                .send({
                    image: invalidImageData,
                    filename: 'invalid.jpg'
                })
                .timeout(TEST_TIMEOUT)
                .expect(500);

            expect(response.body).toHaveProperty('error');
            expect(response.body).toHaveProperty('damageType');
            expect(response.body.confidence).toBe(0);
        });

        test('should process large images within reasonable time', async () => {
            const startTime = Date.now();
            
            const response = await request(API_BASE_URL)
                .post('/api/v1/photo-analysis/analyze-photo')
                .send({
                    image: largeImageBase64,
                    filename: 'large-test-image.jpg'
                })
                .timeout(TEST_TIMEOUT)
                .expect(200);

            const totalTime = Date.now() - startTime;
            
            expect(response.body).toHaveProperty('totalProcessingTime');
            expect(response.body.totalProcessingTime).toBeLessThan(60); // Should complete within 60 seconds
            expect(totalTime).toBeLessThan(90000); // Total request should be under 90 seconds
            
            console.log(`✅ Large image processed in ${totalTime}ms (API reported: ${response.body.totalProcessingTime}s)`);
        }, TEST_TIMEOUT);

        test('should provide consistent results for same image', async () => {
            const responses = [];
            
            // Analyze same image multiple times
            for (let i = 0; i < 3; i++) {
                const response = await request(API_BASE_URL)
                    .post('/api/v1/photo-analysis/analyze-photo')
                    .send({
                        image: testImageBase64,
                        filename: `consistency-test-${i}.jpg`
                    })
                    .timeout(TEST_TIMEOUT)
                    .expect(200);
                
                responses.push(response.body);
            }
            
            // Verify consistency in key fields
            const damageTypes = responses.map(r => r.damageType);
            const severities = responses.map(r => r.severity);
            const confidences = responses.map(r => r.confidence);
            
            // Damage type should be consistent
            expect(new Set(damageTypes).size).toBeLessThanOrEqual(2); // Allow some variation
            
            // Confidence should be within reasonable range
            const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
            confidences.forEach(confidence => {
                expect(Math.abs(confidence - avgConfidence)).toBeLessThan(20); // Within 20% of average
            });
            
            console.log(`✅ Consistency test: ${damageTypes[0]} with ${avgConfidence.toFixed(1)}% avg confidence`);
        }, TEST_TIMEOUT * 3);

        test('should detect non-roof images correctly', async () => {
            // Create a clearly non-roof image (solid color)
            const nonRoofImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            
            const response = await request(API_BASE_URL)
                .post('/api/v1/photo-analysis/analyze-photo')
                .send({
                    image: nonRoofImage,
                    filename: 'non-roof-test.png'
                })
                .timeout(TEST_TIMEOUT)
                .expect(200);

            // Should detect that this is not a roof
            expect(response.body.confidence).toBeGreaterThan(50); // Should be confident about what it sees
            
            // Check if it correctly identifies non-roof content
            const damageType = response.body.damageType.toLowerCase();
            const description = response.body.description.toLowerCase();
            
            const nonRoofIndicators = ['no roofing damage', 'not a roof', 'no damage', 'no roof'];
            const hasNonRoofIndicator = nonRoofIndicators.some(indicator => 
                damageType.includes(indicator) || description.includes(indicator)
            );
            
            expect(hasNonRoofIndicator).toBe(true);
            
            console.log(`✅ Non-roof image correctly identified: ${response.body.damageType}`);
        }, TEST_TIMEOUT);
    });

    describe('Load and Stress Tests', () => {
        test('should handle concurrent requests', async () => {
            const concurrentRequests = 5;
            const promises = [];
            
            for (let i = 0; i < concurrentRequests; i++) {
                const promise = request(API_BASE_URL)
                    .post('/api/v1/photo-analysis/analyze-photo')
                    .send({
                        image: testImageBase64,
                        filename: `concurrent-test-${i}.jpg`
                    })
                    .timeout(TEST_TIMEOUT);
                
                promises.push(promise);
            }
            
            const responses = await Promise.allSettled(promises);
            
            // All requests should complete (either fulfilled or rejected, but not timeout)
            const completedRequests = responses.filter(r => r.status === 'fulfilled');
            expect(completedRequests.length).toBeGreaterThan(0);
            
            // At least 80% should succeed
            expect(completedRequests.length / concurrentRequests).toBeGreaterThan(0.8);
            
            console.log(`✅ ${completedRequests.length}/${concurrentRequests} concurrent requests completed`);
        }, TEST_TIMEOUT * 2);

        test('should maintain performance under load', async () => {
            const batchSize = 3;
            const batches = [];
            
            for (let batch = 0; batch < 2; batch++) {
                const promises = [];
                
                for (let i = 0; i < batchSize; i++) {
                    const startTime = Date.now();
                    
                    const promise = request(API_BASE_URL)
                        .post('/api/v1/photo-analysis/analyze-photo')
                        .send({
                            image: testImageBase64,
                            filename: `load-test-batch${batch}-${i}.jpg`
                        })
                        .timeout(TEST_TIMEOUT)
                        .then(response => ({
                            response: response.body,
                            requestTime: Date.now() - startTime
                        }));
                    
                    promises.push(promise);
                }
                
                batches.push(Promise.allSettled(promises));
            }
            
            const allResults = await Promise.all(batches);
            const successfulRequests = [];
            
            allResults.forEach(batchResults => {
                batchResults.forEach(result => {
                    if (result.status === 'fulfilled') {
                        successfulRequests.push(result.value);
                    }
                });
            });
            
            expect(successfulRequests.length).toBeGreaterThan(0);
            
            // Calculate performance metrics
            const requestTimes = successfulRequests.map(r => r.requestTime);
            const avgTime = requestTimes.reduce((sum, time) => sum + time, 0) / requestTimes.length;
            const maxTime = Math.max(...requestTimes);
            
            // Performance should be reasonable
            expect(avgTime).toBeLessThan(60000); // Average under 60 seconds
            expect(maxTime).toBeLessThan(120000); // Max under 2 minutes
            
            console.log(`✅ Load test: ${successfulRequests.length} requests completed`);
            console.log(`   Average time: ${avgTime}ms, Max time: ${maxTime}ms`);
        }, TEST_TIMEOUT * 3);
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle malformed request payloads', async () => {
            // Test various malformed payloads
            const malformedPayloads = [
                null,
                undefined,
                '',
                '{}',
                { image: null },
                { image: '' },
                { image: 'not-base64-data' },
                { image: 'data:text/plain;base64,SGVsbG8=' }
            ];
            
            for (const payload of malformedPayloads) {
                const response = await request(API_BASE_URL)
                    .post('/api/v1/photo-analysis/analyze-photo')
                    .send(payload);
                
                // Should not return 200 for invalid data
                expect([400, 500]).toContain(response.status);
                expect(response.body).toHaveProperty('error');
            }
            
            console.log('✅ Malformed payload handling verified');
        });

        test('should handle extremely large payloads gracefully', async () => {
            // Create an extremely large base64 string (simulating very large image)
            const largeData = 'data:image/jpeg;base64,' + 'A'.repeat(50 * 1024 * 1024); // ~50MB
            
            const response = await request(API_BASE_URL)
                .post('/api/v1/photo-analysis/analyze-photo')
                .send({
                    image: largeData,
                    filename: 'extremely-large.jpg'
                })
                .timeout(30000); // Shorter timeout for this test
            
            // Should either process it or reject with appropriate error
            if (response.status === 200) {
                expect(response.body).toHaveProperty('damageType');
            } else {
                expect([400, 413, 500]).toContain(response.status); // Bad request, payload too large, or server error
                expect(response.body).toHaveProperty('error');
            }
            
            console.log(`✅ Large payload handled: ${response.status}`);
        });

        test('should validate CORS headers correctly', async () => {
            const response = await request(API_BASE_URL)
                .options('/api/v1/photo-analysis/analyze-photo')
                .set('Origin', 'http://localhost:3000')
                .set('Access-Control-Request-Method', 'POST')
                .set('Access-Control-Request-Headers', 'Content-Type');
            
            expect(response.status).toBe(204);
            expect(response.headers).toHaveProperty('access-control-allow-origin');
            expect(response.headers).toHaveProperty('access-control-allow-methods');
            expect(response.headers).toHaveProperty('access-control-allow-headers');
            
            console.log('✅ CORS configuration verified');
        });
    });
});

// Utility functions
async function setupTestImageData() {
    // Create a simple test image (1x1 pixel PNG)
    const minimalPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    testImageBase64 = `data:image/png;base64,${minimalPng}`;
    
    // Create a larger test image (100x100 pixel PNG with some content)
    const largerPng = Buffer.alloc(10000).toString('base64'); // Simulate larger image
    largeImageBase64 = `data:image/png;base64,${largerPng}`;
    
    // Create invalid image data
    invalidImageData = 'data:image/jpeg;base64,invalid-base64-data!!!';
}

async function waitForAPI() {
    const maxRetries = 30;
    const retryDelay = 1000;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            await request(API_BASE_URL)
                .get('/api/v1/photo-analysis/analyze-photo/health')
                .timeout(5000);
            
            console.log('✅ API server is ready');
            return;
        } catch (error) {
            if (i === maxRetries - 1) {
                throw new Error(`API server not ready after ${maxRetries} attempts: ${error.message}`);
            }
            
            console.log(`⏳ Waiting for API server... (attempt ${i + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
}