// Test script for real employee photo analysis
import fs from 'fs';
import path from 'path';

async function convertImageToBase64(imagePath) {
    try {
        const imageBuffer = fs.readFileSync(imagePath);
        const base64 = imageBuffer.toString('base64');
        const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
        return `data:${mimeType};base64,${base64}`;
    } catch (error) {
        console.error('Error reading image:', error);
        throw error;
    }
}

async function testEmployeePhotoAnalysis() {
    try {
        console.log('🧪 Testing real employee photo analysis...');
        console.log('📸 Using Andre M.png - the same image that previously gave fake "Wind damage 97%" result');
        
        // Convert the employee photo to base64
        const employeePhotoPath = '/Users/a21/Downloads/Andre M.png';
        const base64Image = await convertImageToBase64(employeePhotoPath);
        
        console.log('✅ Image converted to base64, sending to API...');
        
        const response = await fetch('http://localhost:3003/api/analyze-photo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: base64Image,
                filename: 'Andre M.png',
                fileType: 'image/png'
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('\n🎯 REAL ANALYSIS RESULT:');
            console.log('==========================================');
            console.log(`Damage Type: ${result.damageType}`);
            console.log(`Severity: ${result.severity}`);
            console.log(`Confidence: ${result.confidence}%`);
            console.log(`Description: ${result.description}`);
            console.log('==========================================\n');
            
            // Check if it correctly identifies this as NOT roofing damage
            if (result.damageType === 'No roofing damage detected' || 
                result.damageType.toLowerCase().includes('person') ||
                result.damageType.toLowerCase().includes('employee') ||
                result.damageType.toLowerCase().includes('human')) {
                console.log('✅ SUCCESS: System correctly identified employee photo as NOT roofing damage!');
                console.log('🎉 The fake "Wind damage 97%" result has been eliminated!');
            } else {
                console.log('❌ STILL BROKEN: System still showing fake roofing damage for employee photo');
                console.log('🐛 This indicates the fake analysis code is still active somewhere');
            }
        } else {
            const errorText = await response.text();
            console.error('❌ API Error:', response.status, errorText);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testEmployeePhotoAnalysis();