/**
 * Susan AI Roofing Analysis - End-to-End UI Tests
 * Tests the complete image upload and analysis workflow
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';

// Test data paths
const TEST_IMAGES_DIR = path.join(process.cwd(), 'tests/test-data/images');
const TEST_HAIL_DAMAGE = path.join(TEST_IMAGES_DIR, 'hail-damage-sample.jpg');
const TEST_WIND_DAMAGE = path.join(TEST_IMAGES_DIR, 'wind-damage-sample.jpg');
const TEST_NORMAL_ROOF = path.join(TEST_IMAGES_DIR, 'normal-roof-sample.jpg');
const TEST_NON_ROOF = path.join(TEST_IMAGES_DIR, 'non-roof-sample.jpg');

// Create test images if they don't exist
test.beforeAll(async () => {
    await ensureTestImages();
});

test.describe('Susan AI Roofing Analysis UI Tests', () => {
    
    test.beforeEach(async ({ page }) => {
        // Set up console monitoring
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error(`Browser console error: ${msg.text()}`);
            }
        });
        
        // Navigate to roofing analysis page
        await page.goto(`${BASE_URL}/roofing-analysis.html`, { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });
        
        // Wait for app initialization
        await page.waitForSelector('.roofing-dashboard', { timeout: 10000 });
        await page.waitForFunction(() => window.roofingApp !== undefined, { timeout: 5000 });
    });

    test('should load the roofing analysis interface correctly', async ({ page }) => {
        // Verify page title
        await expect(page).toHaveTitle(/Susan AI.*Roofing.*Analysis/);
        
        // Verify main navigation
        await expect(page.locator('.logo-text')).toContainText('ROOF-ER AI');
        await expect(page.locator('.status-text')).toContainText('Ready for Analysis');
        
        // Verify main sections are present
        await expect(page.locator('.left-panel')).toBeVisible();
        await expect(page.locator('.central-panel')).toBeVisible();
        await expect(page.locator('.right-panel')).toBeVisible();
        
        // Verify upload section
        await expect(page.locator('.photo-drop-zone')).toBeVisible();
        await expect(page.locator('.drop-content h3')).toContainText('Drop roof photos here');
        
        // Verify property form
        await expect(page.locator('#propertyAddress')).toBeVisible();
        await expect(page.locator('#inspector')).toBeVisible();
        await expect(page.locator('#weatherEvent')).toBeVisible();
        
        // Verify initial statistics
        await expect(page.locator('#totalPhotos')).toContainText('0');
        await expect(page.locator('#damageCount')).toContainText('0');
        await expect(page.locator('#confidenceAvg')).toContainText('0%');
    });

    test('should handle single image upload via file input', async ({ page }) => {
        // Click on drop zone to trigger file input
        await page.locator('.photo-drop-zone').click();
        
        // Upload test image
        await page.setInputFiles('#fileInput', TEST_HAIL_DAMAGE);
        
        // Wait for image to be processed
        await page.waitForSelector('.photo-grid', { state: 'visible', timeout: 5000 });
        
        // Verify photo appears in grid
        const thumbnails = page.locator('.photo-thumbnail');
        await expect(thumbnails).toHaveCount(1);
        
        // Verify photo details
        await expect(page.locator('.thumbnail-name')).toContainText('hail-damage-sample.jpg');
        await expect(page.locator('.thumbnail-status')).toContainText('Ready');
        
        // Verify analyze button is enabled
        const analyzeBtn = page.locator('#analyzeBtn');
        await expect(analyzeBtn).toBeEnabled();
        await expect(analyzeBtn).toContainText('Analyze 1 Photos');
        
        // Verify statistics updated
        await expect(page.locator('#totalPhotos')).toContainText('1');
    });

    test('should handle multiple image uploads via drag and drop', async ({ page }) => {
        const dropZone = page.locator('.photo-drop-zone');
        
        // Test drag over styling
        await dropZone.dispatchEvent('dragenter');
        await expect(dropZone).toHaveClass(/drag-over/);
        
        // Upload multiple files via drag and drop simulation
        await dropZone.setInputFiles([TEST_HAIL_DAMAGE, TEST_WIND_DAMAGE, TEST_NORMAL_ROOF]);
        
        // Wait for all images to be processed
        await page.waitForFunction(() => {
            return document.querySelectorAll('.photo-thumbnail').length === 3;
        }, { timeout: 10000 });
        
        // Verify all photos appear
        const thumbnails = page.locator('.photo-thumbnail');
        await expect(thumbnails).toHaveCount(3);
        
        // Verify analyze button shows correct count
        await expect(page.locator('#analyzeBtn')).toContainText('Analyze 3 Photos');
        
        // Verify statistics
        await expect(page.locator('#totalPhotos')).toContainText('3');
    });

    test('should perform complete image analysis workflow', async ({ page }, testInfo) => {
        testInfo.setTimeout(120000); // 2 minute timeout for full analysis
        
        // Upload test image
        await page.locator('.photo-drop-zone').click();
        await page.setInputFiles('#fileInput', TEST_HAIL_DAMAGE);
        
        // Wait for upload to complete
        await page.waitForSelector('.photo-grid', { state: 'visible' });
        
        // Start analysis
        const analyzeBtn = page.locator('#analyzeBtn');
        await expect(analyzeBtn).toBeEnabled();
        await analyzeBtn.click();
        
        // Verify analysis starts
        await expect(page.locator('.analysis-progress')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#progressText')).toContainText(/Starting|Initializing/);
        
        // Monitor analysis progress
        const progressBar = page.locator('.progress-fill');
        
        // Wait for progress to begin (should show more than 0% quickly)
        await page.waitForFunction(() => {
            const fill = document.querySelector('.progress-fill');
            return fill && parseFloat(fill.style.width) > 0;
        }, { timeout: 30000 });
        
        // Verify thumbnail shows analyzing state
        const thumbnail = page.locator('.photo-thumbnail').first();
        await expect(thumbnail).toHaveClass(/analyzing/);
        await expect(thumbnail.locator('.analysis-overlay')).toBeVisible();
        
        // Wait for analysis to complete (this is the critical test for the "spinning" issue)
        await page.waitForFunction(() => {
            const app = window.roofingApp;
            return app && !app.isAnalyzing();
        }, { timeout: 90000 }); // 90 second timeout
        
        // Verify analysis completes successfully
        await expect(page.locator('.analysis-progress')).toBeHidden({ timeout: 10000 });
        await expect(page.locator('.results-section')).toBeVisible({ timeout: 5000 });
        
        // Verify results are displayed
        await expect(page.locator('.overall-assessment')).toBeVisible();
        await expect(page.locator('.assessment-header h3')).toContainText('Overall Assessment');
        
        // Verify thumbnail shows completion
        await expect(thumbnail).not.toHaveClass(/analyzing/);
        await expect(thumbnail.locator('.analysis-overlay')).toBeHidden();
        
        // Verify statistics updated
        await expect(page.locator('#totalPhotos')).toContainText('1');
        const damageCountText = await page.locator('#damageCount').textContent();
        expect(parseInt(damageCountText)).toBeGreaterThanOrEqual(0);
        
        // Verify confidence is reasonable
        const confidenceText = await page.locator('#confidenceAvg').textContent();
        const confidence = parseInt(confidenceText.replace('%', ''));
        expect(confidence).toBeGreaterThanOrEqual(50);
        
        // Verify analysis results contain expected data
        const damageCategories = page.locator('.damage-category');
        await expect(damageCategories).toHaveCount(4); // hail, wind, granule, collateral
        
        console.log('✅ Complete analysis workflow test passed - no infinite spinning detected!');
    });

    test('should handle API errors gracefully', async ({ page }) => {
        // Intercept API requests to simulate failure
        await page.route(`${API_BASE_URL}/photo-analysis/analyze-photo`, route => {
            route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Simulated API failure' })
            });
        });
        
        // Upload and try to analyze
        await page.locator('.photo-drop-zone').click();
        await page.setInputFiles('#fileInput', TEST_HAIL_DAMAGE);
        await page.waitForSelector('.photo-grid', { state: 'visible' });
        
        // Start analysis
        await page.locator('#analyzeBtn').click();
        
        // Wait for error handling
        await page.waitForFunction(() => {
            const app = window.roofingApp;
            return app && !app.isAnalyzing();
        }, { timeout: 30000 });
        
        // Verify error is displayed
        const thumbnail = page.locator('.photo-thumbnail').first();
        await expect(thumbnail).toHaveClass(/error/);
        await expect(thumbnail.locator('.thumbnail-status')).toContainText('Failed');
        
        // Verify notification shown
        await expect(page.locator('.notification.error')).toBeVisible({ timeout: 5000 });
    });

    test('should handle network timeouts', async ({ page }) => {
        // Intercept API requests with delay to simulate timeout
        await page.route(`${API_BASE_URL}/photo-analysis/analyze-photo`, async route => {
            // Delay response by 65 seconds to trigger timeout
            await new Promise(resolve => setTimeout(resolve, 65000));
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ damageType: 'Test', confidence: 75 })
            });
        });
        
        // Set shorter timeout for this test
        page.setDefaultTimeout(70000);
        
        // Upload and analyze
        await page.locator('.photo-drop-zone').click();
        await page.setInputFiles('#fileInput', TEST_HAIL_DAMAGE);
        await page.waitForSelector('.photo-grid', { state: 'visible' });
        await page.locator('#analyzeBtn').click();
        
        // Should handle timeout gracefully
        await page.waitForFunction(() => {
            const app = window.roofingApp;
            return app && !app.isAnalyzing();
        }, { timeout: 70000 });
        
        const thumbnail = page.locator('.photo-thumbnail').first();
        await expect(thumbnail).toHaveClass(/error/);
    });

    test('should handle large file uploads', async ({ page }) => {
        // Create a large test image (simulate by using multiple files)
        const files = [TEST_HAIL_DAMAGE, TEST_WIND_DAMAGE, TEST_NORMAL_ROOF];
        
        // Upload multiple files
        await page.locator('.photo-drop-zone').click();
        await page.setInputFiles('#fileInput', files);
        
        // Verify all files uploaded
        await page.waitForFunction(() => {
            return document.querySelectorAll('.photo-thumbnail').length === files.length;
        }, { timeout: 10000 });
        
        // Start batch analysis
        await page.locator('#analyzeBtn').click();
        
        // Monitor that analysis completes for all files
        await page.waitForFunction(() => {
            const app = window.roofingApp;
            return app && !app.isAnalyzing() && app.getAnalysisResultsCount() === files.length;
        }, { timeout: 180000 }); // 3 minutes for multiple file analysis
        
        // Verify all thumbnails show completion
        const thumbnails = page.locator('.photo-thumbnail');
        for (let i = 0; i < files.length; i++) {
            const thumbnail = thumbnails.nth(i);
            await expect(thumbnail).not.toHaveClass(/analyzing/);
        }
        
        console.log(`✅ Batch analysis of ${files.length} files completed successfully`);
    });

    test('should maintain WebSocket connection during analysis', async ({ page }) => {
        // Check WebSocket connection
        await page.waitForFunction(() => {
            const app = window.roofingApp;
            return app && app.getWebSocketState() === WebSocket.OPEN;
        }, { timeout: 10000 });
        
        // Upload and start analysis
        await page.locator('.photo-drop-zone').click();
        await page.setInputFiles('#fileInput', TEST_HAIL_DAMAGE);
        await page.waitForSelector('.photo-grid', { state: 'visible' });
        await page.locator('#analyzeBtn').click();
        
        // Monitor WebSocket during analysis
        await page.waitForFunction(() => {
            const app = window.roofingApp;
            return app && !app.isAnalyzing();
        }, { timeout: 90000 });
        
        // Verify WebSocket is still connected
        await page.waitForFunction(() => {
            const app = window.roofingApp;
            return app && app.getWebSocketState() === WebSocket.OPEN;
        }, { timeout: 5000 });
        
        // Verify live feed shows analysis events
        const feedItems = page.locator('.feed-item');
        await expect(feedItems).toHaveCountGreaterThan(1); // Should have initial + analysis events
    });

    test('should be responsive on different screen sizes', async ({ page }) => {
        // Test mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        await page.reload();
        await page.waitForSelector('.roofing-dashboard', { state: 'visible' });
        
        // Verify layout adapts
        await expect(page.locator('.roofing-dashboard')).toBeVisible();
        await expect(page.locator('.photo-drop-zone')).toBeVisible();
        
        // Test tablet viewport
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.reload();
        await page.waitForSelector('.roofing-dashboard', { state: 'visible' });
        
        // Test desktop viewport
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.reload();
        await page.waitForSelector('.roofing-dashboard', { state: 'visible' });
        
        // All panels should be visible on desktop
        await expect(page.locator('.left-panel')).toBeVisible();
        await expect(page.locator('.central-panel')).toBeVisible();
        await expect(page.locator('.right-panel')).toBeVisible();
    });

    test('should validate file types correctly', async ({ page }) => {
        // Try to upload non-image file
        const textFile = path.join(process.cwd(), 'package.json');
        
        await page.locator('.photo-drop-zone').click();
        await page.setInputFiles('#fileInput', textFile);
        
        // Should show error notification
        await expect(page.locator('.notification.error')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.notification.error .notification-message'))
            .toContainText(/only image files/i);
        
        // No photos should be added
        await expect(page.locator('.photo-thumbnail')).toHaveCount(0);
    });

    test('should handle photo removal correctly', async ({ page }) => {
        // Upload multiple photos
        await page.locator('.photo-drop-zone').click();
        await page.setInputFiles('#fileInput', [TEST_HAIL_DAMAGE, TEST_WIND_DAMAGE]);
        
        await page.waitForFunction(() => {
            return document.querySelectorAll('.photo-thumbnail').length === 2;
        }, { timeout: 10000 });
        
        // Remove first photo
        const removeBtn = page.locator('.remove-photo').first();
        await removeBtn.click();
        
        // Verify photo removed
        await expect(page.locator('.photo-thumbnail')).toHaveCount(1);
        await expect(page.locator('#analyzeBtn')).toContainText('Analyze 1 Photos');
        
        // Clear all photos
        await page.locator('#clearPhotos').click();
        await expect(page.locator('.photo-thumbnail')).toHaveCount(0);
        await expect(page.locator('.photo-grid')).toBeHidden();
    });

    test('should show accessibility features', async ({ page }) => {
        // Test keyboard navigation
        await page.keyboard.press('Tab'); // Should focus first interactive element
        
        // Test ARIA labels and roles
        const dropZone = page.locator('.photo-drop-zone');
        const ariaLabel = await dropZone.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
        
        // Test screen reader content
        const skipLink = page.locator('.sr-only, .visually-hidden');
        if (await skipLink.count() > 0) {
            await expect(skipLink.first()).toBeInViewport();
        }
        
        // Test focus management
        await page.locator('.photo-drop-zone').focus();
        await expect(page.locator('.photo-drop-zone')).toBeFocused();
    });

});

test.describe('Performance Tests', () => {
    
    test('should complete analysis within acceptable time limits', async ({ page }) => {
        const startTime = Date.now();
        
        // Upload single image
        await page.locator('.photo-drop-zone').click();
        await page.setInputFiles('#fileInput', TEST_HAIL_DAMAGE);
        await page.waitForSelector('.photo-grid', { state: 'visible' });
        
        // Start analysis and measure time
        await page.locator('#analyzeBtn').click();
        
        await page.waitForFunction(() => {
            const app = window.roofingApp;
            return app && !app.isAnalyzing();
        }, { timeout: 60000 });
        
        const totalTime = Date.now() - startTime;
        
        // Should complete within 60 seconds for single image
        expect(totalTime).toBeLessThan(60000);
        
        console.log(`✅ Single image analysis completed in ${totalTime}ms`);
    });

    test('should handle concurrent uploads efficiently', async ({ page }) => {
        // Upload 5 images simultaneously
        const files = Array(5).fill(TEST_HAIL_DAMAGE);
        
        await page.locator('.photo-drop-zone').click();
        await page.setInputFiles('#fileInput', files);
        
        const uploadTime = Date.now();
        
        await page.waitForFunction(() => {
            return document.querySelectorAll('.photo-thumbnail').length === files.length;
        }, { timeout: 15000 });
        
        const totalUploadTime = Date.now() - uploadTime;
        
        // Upload processing should be fast (< 5 seconds for UI updates)
        expect(totalUploadTime).toBeLessThan(5000);
        
        console.log(`✅ ${files.length} images uploaded and processed in ${totalUploadTime}ms`);
    });

});

// Utility functions
async function ensureTestImages() {
    // Create test images directory
    if (!fs.existsSync(TEST_IMAGES_DIR)) {
        fs.mkdirSync(TEST_IMAGES_DIR, { recursive: true });
    }
    
    // Create minimal test images if they don't exist
    const testImages = [
        { path: TEST_HAIL_DAMAGE, name: 'hail-damage-sample.jpg' },
        { path: TEST_WIND_DAMAGE, name: 'wind-damage-sample.jpg' },
        { path: TEST_NORMAL_ROOF, name: 'normal-roof-sample.jpg' },
        { path: TEST_NON_ROOF, name: 'non-roof-sample.jpg' }
    ];
    
    for (const img of testImages) {
        if (!fs.existsSync(img.path)) {
            // Create a minimal test image (1x1 pixel PNG in base64)
            const minimalImage = Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                'base64'
            );
            fs.writeFileSync(img.path, minimalImage);
        }
    }
}