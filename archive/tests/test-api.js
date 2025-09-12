// Test script for the photo analysis API
import fs from 'fs';
import path from 'path';

// Create a simple test image (1x1 red pixel in base64)
const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jW3JMwAAAABJRU5ErkJggg==';

async function testPhotoAnalysis() {
    try {
        console.log('🧪 Testing photo analysis API...');
        
        const response = await fetch('http://localhost:3003/api/analyze-photo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: testImage,
                filename: 'test-employee-photo.png',
                fileType: 'image/png'
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Analysis Result:', JSON.stringify(result, null, 2));
        } else {
            console.error('❌ API Error:', response.status, await response.text());
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testPhotoAnalysis();