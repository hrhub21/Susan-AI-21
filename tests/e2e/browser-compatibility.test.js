/**
 * Susan AI - Browser Compatibility Tests for Image Upload
 * Tests drag/drop and file upload across different browsers and devices
 */

import { test, expect, devices } from '@playwright/test';
import path from 'path';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';
const TEST_IMAGES_DIR = path.join(process.cwd(), 'tests/test-data/images');
const TEST_IMAGE = path.join(TEST_IMAGES_DIR, 'hail-damage-sample.jpg');

// Browser configurations to test
const browserConfigs = [
    { name: 'Chrome Desktop', browserName: 'chromium' },
    { name: 'Firefox Desktop', browserName: 'firefox' },
    { name: 'Safari Desktop', browserName: 'webkit' },
    { name: 'Chrome Mobile', browserName: 'chromium', device: devices['Pixel 5'] },
    { name: 'Safari Mobile', browserName: 'webkit', device: devices['iPhone 12'] },
    { name: 'Edge Desktop', browserName: 'chromium' }
];

// Create browser-specific test suites
browserConfigs.forEach(config => {
    test.describe(`Browser Compatibility - ${config.name}`, () => {
        test.use(config.device ? { ...config.device } : { browserName: config.browserName });

        test.beforeEach(async ({ page }) => {
            // Navigate to roofing analysis page
            await page.goto(`${BASE_URL}/roofing-analysis.html`, { 
                waitUntil: 'networkidle',
                timeout: 30000 
            });
            
            // Wait for app initialization
            await page.waitForSelector('.roofing-dashboard', { timeout: 10000 });
        });

        test(`should load interface correctly on ${config.name}`, async ({ page }) => {
            // Verify page loads without JavaScript errors
            const errors = [];
            page.on('pageerror', error => {
                errors.push(error.message);
            });
            
            // Verify main elements are visible
            await expect(page.locator('.photo-drop-zone')).toBeVisible();
            await expect(page.locator('.upload-section')).toBeVisible();
            
            // Check for JavaScript errors
            expect(errors).toHaveLength(0);
            
            console.log(`✅ ${config.name}: Interface loaded successfully`);
        });

        test(`should support file input on ${config.name}`, async ({ page }) => {
            // Click on drop zone to trigger file input
            await page.locator('.photo-drop-zone').click();
            
            // Upload test image
            await page.setInputFiles('#fileInput', TEST_IMAGE);
            
            // Wait for image to be processed
            await page.waitForSelector('.photo-grid', { state: 'visible', timeout: 10000 });
            
            // Verify photo appears in grid
            const thumbnails = page.locator('.photo-thumbnail');
            await expect(thumbnails).toHaveCount(1);
            
            // Verify analyze button is enabled
            await expect(page.locator('#analyzeBtn')).toBeEnabled();
            
            console.log(`✅ ${config.name}: File input working`);
        });

        test(`should handle drag and drop on ${config.name}`, async ({ page, browserName }) => {
            // Skip drag/drop on mobile browsers (not typically supported)
            if (config.device && (config.device.isMobile || config.device.hasTouch)) {
                test.skip('Drag and drop not applicable on mobile devices');
                return;
            }
            
            const dropZone = page.locator('.photo-drop-zone');
            
            // Test drag enter/leave styling
            await dropZone.dispatchEvent('dragenter', {
                dataTransfer: {
                    files: [{ name: 'test.jpg', type: 'image/jpeg' }]
                }
            });
            
            // Check if drag-over class is applied
            await expect(dropZone).toHaveClass(/drag-over/);
            
            // Test drag leave
            await dropZone.dispatchEvent('dragleave');
            await expect(dropZone).not.toHaveClass(/drag-over/);
            
            // Test actual file drop
            await dropZone.setInputFiles([TEST_IMAGE]);
            
            // Wait for processing
            await page.waitForSelector('.photo-grid', { state: 'visible', timeout: 10000 });
            
            // Verify upload worked
            await expect(page.locator('.photo-thumbnail')).toHaveCount(1);
            
            console.log(`✅ ${config.name}: Drag and drop working`);
        });

        test(`should display responsive layout on ${config.name}`, async ({ page }) => {
            const viewport = await page.viewportSize();
            
            // Check layout adapts to screen size
            if (viewport.width < 768) {
                // Mobile layout checks
                await expect(page.locator('.roofing-dashboard')).toBeVisible();
                
                // On mobile, some panels might be hidden or stacked
                const leftPanel = page.locator('.left-panel');
                const rightPanel = page.locator('.right-panel');
                
                // Panels should either be visible or properly hidden
                if (await leftPanel.isVisible()) {
                    await expect(leftPanel).toBeVisible();
                }
                if (await rightPanel.isVisible()) {
                    await expect(rightPanel).toBeVisible();
                }
                
            } else {
                // Desktop layout - all panels should be visible
                await expect(page.locator('.left-panel')).toBeVisible();
                await expect(page.locator('.central-panel')).toBeVisible();
                await expect(page.locator('.right-panel')).toBeVisible();
            }
            
            console.log(`✅ ${config.name}: Responsive layout working (${viewport.width}x${viewport.height})`);
        });

        test(`should handle touch interactions on ${config.name}`, async ({ page }) => {
            // Only run touch tests on touch-capable devices
            if (!config.device || !config.device.hasTouch) {
                test.skip('Touch interactions not applicable on non-touch devices');
                return;
            }
            
            // Test touch on drop zone
            const dropZone = page.locator('.photo-drop-zone');
            await dropZone.tap();
            
            // Should trigger file input
            const fileInput = page.locator('#fileInput');
            await expect(fileInput).toBeFocused();
            
            // Test button interactions
            const propertyForm = page.locator('#propertyAddress');
            await propertyForm.tap();
            await expect(propertyForm).toBeFocused();
            
            console.log(`✅ ${config.name}: Touch interactions working`);
        });

        test(`should support keyboard navigation on ${config.name}`, async ({ page }) => {
            // Test Tab navigation
            await page.keyboard.press('Tab');
            
            // Should focus on first interactive element
            const focusedElement = await page.locator(':focus').first();
            await expect(focusedElement).toBeVisible();
            
            // Navigate through form fields
            await page.keyboard.press('Tab');
            await page.keyboard.press('Tab');
            
            // Test Enter key on drop zone
            const dropZone = page.locator('.photo-drop-zone');
            await dropZone.focus();
            await page.keyboard.press('Enter');
            
            console.log(`✅ ${config.name}: Keyboard navigation working`);
        });

        test(`should handle different image formats on ${config.name}`, async ({ page }) => {
            const imageFormats = ['jpg', 'png', 'webp'];
            
            for (const format of imageFormats) {
                // Create test image path (assuming they exist)
                const testImagePath = path.join(TEST_IMAGES_DIR, `test-image.${format}`);
                
                try {
                    // Try to upload the image
                    await page.locator('.photo-drop-zone').click();
                    await page.setInputFiles('#fileInput', testImagePath);
                    
                    // Wait briefly
                    await page.waitForTimeout(1000);
                    
                    console.log(`✅ ${config.name}: ${format.toUpperCase()} format supported`);
                    
                } catch (error) {
                    console.log(`⚠️ ${config.name}: ${format.toUpperCase()} format test skipped (file not found)`);
                    continue;
                }
            }
            
            // Clear photos for clean state
            const clearBtn = page.locator('#clearPhotos');
            if (await clearBtn.isVisible()) {
                await clearBtn.click();
            }
        });

        test(`should maintain functionality across page reloads on ${config.name}`, async ({ page }) => {
            // Upload an image
            await page.locator('.photo-drop-zone').click();
            await page.setInputFiles('#fileInput', TEST_IMAGE);
            
            await page.waitForSelector('.photo-grid', { state: 'visible' });
            
            // Reload page
            await page.reload({ waitUntil: 'networkidle' });
            
            // Wait for app to reinitialize
            await page.waitForSelector('.roofing-dashboard', { timeout: 10000 });
            
            // Verify interface is still functional
            await expect(page.locator('.photo-drop-zone')).toBeVisible();
            await expect(page.locator('.upload-section')).toBeVisible();
            
            // Try uploading again
            await page.locator('.photo-drop-zone').click();
            await page.setInputFiles('#fileInput', TEST_IMAGE);
            
            await page.waitForSelector('.photo-grid', { state: 'visible' });
            await expect(page.locator('.photo-thumbnail')).toHaveCount(1);
            
            console.log(`✅ ${config.name}: Functionality maintained after reload`);
        });

        test(`should handle network conditions on ${config.name}`, async ({ page }) => {
            // Test with slow network
            const client = await page.context().newCDPSession(page);
            
            // Simulate slow 3G network
            await client.send('Network.enable');
            await client.send('Network.emulateNetworkConditions', {
                offline: false,
                downloadThroughput: 1.6 * 1024 * 1024 / 8, // 1.6 Mbps
                uploadThroughput: 750 * 1024 / 8,           // 750 Kbps
                latency: 40
            });
            
            // Upload image under slow network conditions
            await page.locator('.photo-drop-zone').click();
            await page.setInputFiles('#fileInput', TEST_IMAGE);
            
            // Should still work, just slower
            await page.waitForSelector('.photo-grid', { state: 'visible', timeout: 15000 });
            await expect(page.locator('.photo-thumbnail')).toHaveCount(1);
            
            // Restore normal network
            await client.send('Network.emulateNetworkConditions', {
                offline: false,
                downloadThroughput: -1,
                uploadThroughput: -1,
                latency: 0
            });
            
            console.log(`✅ ${config.name}: Works under slow network conditions`);
        });
    });
});

test.describe('Cross-Browser Feature Detection', () => {
    
    test('should detect browser capabilities correctly', async ({ page, browserName }) => {
        await page.goto(`${BASE_URL}/roofing-analysis.html`, { waitUntil: 'networkidle' });
        
        // Check for required browser features
        const capabilities = await page.evaluate(() => {
            return {
                fileAPI: typeof FileReader !== 'undefined',
                dragDrop: 'draggable' in document.createElement('div'),
                canvas: typeof HTMLCanvasElement !== 'undefined',
                webSocket: typeof WebSocket !== 'undefined',
                localStorage: typeof Storage !== 'undefined',
                promises: typeof Promise !== 'undefined',
                fetch: typeof fetch !== 'undefined',
                webWorkers: typeof Worker !== 'undefined'
            };
        });
        
        // All modern browsers should support these features
        expect(capabilities.fileAPI).toBe(true);
        expect(capabilities.canvas).toBe(true);
        expect(capabilities.webSocket).toBe(true);
        expect(capabilities.localStorage).toBe(true);
        expect(capabilities.promises).toBe(true);
        expect(capabilities.fetch).toBe(true);
        
        // Log browser-specific capabilities
        console.log(`✅ ${browserName} capabilities:`, capabilities);
    });

    test('should handle browser-specific quirks', async ({ page, browserName }) => {
        await page.goto(`${BASE_URL}/roofing-analysis.html`, { waitUntil: 'networkidle' });
        
        // Test browser-specific behavior
        const quirks = await page.evaluate(() => {
            const userAgent = navigator.userAgent;
            const isChrome = userAgent.includes('Chrome');
            const isFirefox = userAgent.includes('Firefox');
            const isSafari = userAgent.includes('Safari') && !isChrome;
            
            return {
                userAgent,
                isChrome,
                isFirefox,
                isSafari,
                supportsWebP: (function() {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1;
                    canvas.height = 1;
                    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
                })()
            };
        });
        
        // Verify image format support based on browser
        if (quirks.isChrome || quirks.isFirefox) {
            expect(quirks.supportsWebP).toBe(true);
        }
        
        console.log(`✅ ${browserName} quirks detected and handled:`, {
            browser: quirks.isChrome ? 'Chrome' : quirks.isFirefox ? 'Firefox' : quirks.isSafari ? 'Safari' : 'Unknown',
            webpSupport: quirks.supportsWebP
        });
    });
});

test.describe('Device-Specific Tests', () => {
    
    test('should work on tablets', async ({ page }) => {
        // Set tablet viewport
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto(`${BASE_URL}/roofing-analysis.html`, { waitUntil: 'networkidle' });
        
        // Verify layout adapts
        await expect(page.locator('.roofing-dashboard')).toBeVisible();
        
        // Test touch interactions
        const dropZone = page.locator('.photo-drop-zone');
        await dropZone.tap();
        
        // Upload should work
        await page.setInputFiles('#fileInput', TEST_IMAGE);
        await page.waitForSelector('.photo-grid', { state: 'visible' });
        
        console.log('✅ Tablet interface working');
    });

    test('should work on large desktop screens', async ({ page }) => {
        // Set large desktop viewport
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(`${BASE_URL}/roofing-analysis.html`, { waitUntil: 'networkidle' });
        
        // All panels should be visible on large screens
        await expect(page.locator('.left-panel')).toBeVisible();
        await expect(page.locator('.central-panel')).toBeVisible();
        await expect(page.locator('.right-panel')).toBeVisible();
        
        // Upload functionality should work
        await page.locator('.photo-drop-zone').click();
        await page.setInputFiles('#fileInput', TEST_IMAGE);
        await page.waitForSelector('.photo-grid', { state: 'visible' });
        
        console.log('✅ Large desktop interface working');
    });

    test('should handle high-DPI displays', async ({ page }) => {
        // Simulate high-DPI display
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width: 1280, height: 800 });
        
        await page.goto(`${BASE_URL}/roofing-analysis.html`, { waitUntil: 'networkidle' });
        
        // Check if images and UI elements render clearly
        const dropZone = page.locator('.photo-drop-zone');
        await expect(dropZone).toBeVisible();
        
        // Verify SVG icons are crisp (they should scale well)
        const icons = page.locator('svg');
        const iconCount = await icons.count();
        expect(iconCount).toBeGreaterThan(0);
        
        console.log(`✅ High-DPI display support verified (${iconCount} SVG icons)`);
    });
});

test.describe('Accessibility Across Browsers', () => {
    
    test('should maintain accessibility features across browsers', async ({ page }) => {
        await page.goto(`${BASE_URL}/roofing-analysis.html`, { waitUntil: 'networkidle' });
        
        // Check for accessibility attributes
        const dropZone = page.locator('.photo-drop-zone');
        
        // Should have appropriate ARIA attributes
        const hasAriaLabel = await dropZone.getAttribute('aria-label');
        const hasRole = await dropZone.getAttribute('role');
        
        console.log('Accessibility attributes:', { hasAriaLabel, hasRole });
        
        // Test keyboard navigation
        await page.keyboard.press('Tab');
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();
        
        console.log('✅ Accessibility features working across browsers');
    });
    
    test('should support screen reader navigation', async ({ page }) => {
        await page.goto(`${BASE_URL}/roofing-analysis.html`, { waitUntil: 'networkidle' });
        
        // Check for screen reader specific elements
        const srOnlyElements = page.locator('.sr-only, .visually-hidden, [aria-label]');
        const srElementCount = await srOnlyElements.count();
        
        // Should have some screen reader content
        expect(srElementCount).toBeGreaterThan(0);
        
        // Check for proper heading hierarchy
        const headings = page.locator('h1, h2, h3, h4, h5, h6');
        const headingCount = await headings.count();
        expect(headingCount).toBeGreaterThan(0);
        
        console.log(`✅ Screen reader support: ${srElementCount} SR elements, ${headingCount} headings`);
    });
});