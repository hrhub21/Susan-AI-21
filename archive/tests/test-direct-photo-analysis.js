#!/usr/bin/env node

/**
 * Direct test of photo analysis pipeline
 * This bypasses the complex health check system to test core functionality
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testDirectPhotoAnalysis() {
    console.log('🧪 Testing Direct Photo Analysis Pipeline\n');

    // Test 1: Direct Qwen VL Backend
    console.log('1. Testing Qwen VL Backend directly...');
    try {
        // Create a simple test image buffer
        const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        const imageBuffer = Buffer.from(testImageBase64, 'base64');

        const formData = new FormData();
        formData.append('image', imageBuffer, {
            filename: 'test.png',
            contentType: 'image/png'
        });
        formData.append('question', 'What do you see in this image? Is this related to roofing?');

        const response = await fetch('http://localhost:3031/analyze', {
            method: 'POST',
            body: formData,
            timeout: 30000
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Qwen VL Backend working:', result.success ? 'SUCCESS' : 'FAILED');
            console.log('   Response length:', result.response?.length || 0, 'characters');
        } else {
            console.log('❌ Qwen VL Backend failed:', response.status);
        }
    } catch (error) {
        console.log('❌ Qwen VL Backend error:', error.message);
    }

    console.log();

    // Test 2: Susan AI Frontend API Health
    console.log('2. Testing Susan AI Frontend API health...');
    try {
        const response = await fetch('http://localhost:3004/api/v1/health', {
            timeout: 5000
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Frontend API Health:', result.status);
        } else {
            console.log('❌ Frontend API Health failed:', response.status);
        }
    } catch (error) {
        console.log('❌ Frontend API Health error:', error.message);
    }

    console.log();

    // Test 3: Simple Photo Analysis Call
    console.log('3. Testing simple photo analysis call...');
    try {
        const testData = {
            image: `data:image/png;base64,${testImageBase64}`,
            filename: 'test.png'
        };

        console.log('   Sending request to /api/v1/analyze-photo...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch('http://localhost:3004/api/v1/analyze-photo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Photo Analysis working!');
            console.log('   Damage Type:', result.damageType);
            console.log('   Analysis Method:', result.analysisMethod);
            console.log('   Success:', result.success || false);
        } else {
            const errorText = await response.text();
            console.log('❌ Photo Analysis failed:', response.status);
            console.log('   Error:', errorText.substring(0, 200));
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('❌ Photo Analysis timeout after 10 seconds');
        } else {
            console.log('❌ Photo Analysis error:', error.message);
        }
    }

    console.log('\n🏁 Direct test complete');
}

// Run the test
testDirectPhotoAnalysis().catch(console.error);