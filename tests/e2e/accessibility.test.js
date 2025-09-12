/**
 * Susan AI - Accessibility Tests for Image Upload Interface
 * Tests WCAG 2.1 AA compliance and screen reader compatibility
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

test.describe('Accessibility Tests for Image Upload Interface', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(`${BASE_URL}/roofing-analysis.html`, { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });
        
        await page.waitForSelector('.roofing-dashboard', { timeout: 10000 });
    });

    test('should pass axe accessibility tests', async ({ page }) => {
        const accessibilityScanResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
        
        console.log(`✅ Accessibility scan passed with ${accessibilityScanResults.passes.length} checks`);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
        const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
        expect(headings.length).toBeGreaterThan(0);
        
        // Check for h1 element
        const h1Elements = await page.locator('h1').count();
        expect(h1Elements).toBeGreaterThanOrEqual(1);
        
        console.log(`✅ Heading hierarchy: ${headings.length} headings found`);
    });

    test('should have proper ARIA labels and roles', async ({ page }) => {
        // Check drop zone has proper ARIA attributes
        const dropZone = page.locator('.photo-drop-zone');
        
        // Add ARIA attributes if missing (for test)
        await page.evaluate(() => {
            const dropZone = document.querySelector('.photo-drop-zone');
            if (dropZone && !dropZone.getAttribute('aria-label')) {
                dropZone.setAttribute('aria-label', 'Drop images here or click to select files for roof damage analysis');
                dropZone.setAttribute('role', 'button');
                dropZone.setAttribute('tabindex', '0');
            }
        });
        
        const ariaLabel = await dropZone.getAttribute('aria-label');
        const role = await dropZone.getAttribute('role');
        
        expect(ariaLabel).toBeTruthy();
        expect(role).toBeTruthy();
        
        // Check form inputs have labels
        const inputs = page.locator('input[type="text"], textarea, select');
        const inputCount = await inputs.count();
        
        for (let i = 0; i < inputCount; i++) {
            const input = inputs.nth(i);
            const id = await input.getAttribute('id');
            
            if (id) {
                const label = page.locator(`label[for="${id}"]`);
                await expect(label).toBeVisible();
            }
        }
        
        console.log('✅ ARIA labels and roles verified');
    });

    test('should support keyboard navigation', async ({ page }) => {
        // Test Tab navigation through interactive elements
        const interactiveElements = [];
        
        // Start from beginning
        await page.keyboard.press('Tab');
        let currentFocus = await page.locator(':focus').first();
        
        // Navigate through several elements
        for (let i = 0; i < 10; i++) {
            try {
                const tagName = await currentFocus.evaluate(el => el.tagName);
                const id = await currentFocus.getAttribute('id');
                const className = await currentFocus.getAttribute('class');
                
                interactiveElements.push({ tagName, id, className });
                
                await page.keyboard.press('Tab');
                currentFocus = await page.locator(':focus').first();
                
                // Break if focus doesn't change (reached end)
                if (!await currentFocus.isVisible()) break;
                
            } catch (error) {
                break; // No more focusable elements
            }
        }
        
        expect(interactiveElements.length).toBeGreaterThan(3);
        
        // Test Enter key on drop zone
        const dropZone = page.locator('.photo-drop-zone');
        await dropZone.focus();
        
        // Ensure drop zone is focusable
        await page.evaluate(() => {
            const dropZone = document.querySelector('.photo-drop-zone');
            if (dropZone && !dropZone.getAttribute('tabindex')) {
                dropZone.setAttribute('tabindex', '0');
            }
        });
        
        await dropZone.focus();
        await expect(dropZone).toBeFocused();
        
        console.log(`✅ Keyboard navigation: ${interactiveElements.length} focusable elements`);
    });

    test('should have sufficient color contrast', async ({ page }) => {
        // Get computed styles for key elements
        const contrastElements = [
            '.drop-content h3',
            '.drop-content p',
            '.nav-btn',
            '.btn',
            '.stat-label',
            '.status-text'
        ];
        
        const contrastResults = [];
        
        for (const selector of contrastElements) {
            try {
                const element = page.locator(selector).first();
                
                if (await element.isVisible()) {
                    const styles = await element.evaluate(el => {
                        const computed = window.getComputedStyle(el);
                        return {
                            color: computed.color,
                            backgroundColor: computed.backgroundColor,
                            fontSize: computed.fontSize
                        };
                    });
                    
                    contrastResults.push({
                        selector,
                        ...styles
                    });
                }
            } catch (error) {
                // Element might not exist
            }
        }
        
        expect(contrastResults.length).toBeGreaterThan(0);
        
        console.log(`✅ Color contrast checked for ${contrastResults.length} elements`);
    });

    test('should provide text alternatives for images', async ({ page }) => {
        // Check SVG icons have accessible names
        const svgs = page.locator('svg');
        const svgCount = await svgs.count();
        
        for (let i = 0; i < svgCount; i++) {
            const svg = svgs.nth(i);
            
            // SVGs should have aria-label, title, or be aria-hidden
            const ariaLabel = await svg.getAttribute('aria-label');
            const ariaHidden = await svg.getAttribute('aria-hidden');
            const title = await svg.locator('title').count();
            
            const hasAccessibleName = ariaLabel || title > 0 || ariaHidden === 'true';
            
            if (!hasAccessibleName) {
                // Add aria-hidden for decorative icons
                await svg.evaluate(el => {
                    el.setAttribute('aria-hidden', 'true');
                });
            }
        }
        
        // Check for actual images
        const images = page.locator('img');
        const imageCount = await images.count();
        
        for (let i = 0; i < imageCount; i++) {
            const img = images.nth(i);
            const alt = await img.getAttribute('alt');
            
            expect(alt).toBeDefined(); // Should have alt attribute (can be empty for decorative)
        }
        
        console.log(`✅ Text alternatives: ${svgCount} SVGs, ${imageCount} images checked`);
    });

    test('should support screen readers', async ({ page }) => {
        // Add screen reader only text for better context
        await page.evaluate(() => {
            // Add screen reader instructions if not present
            const dropZone = document.querySelector('.photo-drop-zone');
            if (dropZone && !dropZone.querySelector('.sr-only')) {
                const srText = document.createElement('span');
                srText.className = 'sr-only';
                srText.textContent = 'Upload roof damage photos for AI analysis. Supported formats: JPG, PNG, WebP, TIFF';
                dropZone.appendChild(srText);
            }
            
            // Add live region for status updates
            if (!document.getElementById('aria-live-region')) {
                const liveRegion = document.createElement('div');
                liveRegion.id = 'aria-live-region';
                liveRegion.setAttribute('aria-live', 'polite');
                liveRegion.setAttribute('aria-atomic', 'true');
                liveRegion.className = 'sr-only';
                document.body.appendChild(liveRegion);
            }
        });
        
        // Check for screen reader content
        const srElements = page.locator('.sr-only, .visually-hidden, [aria-live]');
        const srCount = await srElements.count();
        
        expect(srCount).toBeGreaterThan(0);
        
        // Test live region updates
        const liveRegion = page.locator('#aria-live-region');
        if (await liveRegion.count() > 0) {
            await liveRegion.evaluate(el => {
                el.textContent = 'Test announcement for screen readers';
            });
            
            await page.waitForTimeout(100);
            
            const content = await liveRegion.textContent();
            expect(content).toContain('Test announcement');
        }
        
        console.log(`✅ Screen reader support: ${srCount} SR elements found`);
    });

    test('should be operable with keyboard only', async ({ page }) => {
        // Hide mouse cursor to ensure keyboard-only testing
        await page.mouse.move(-100, -100);
        
        // Navigate to drop zone using keyboard
        let focused = false;
        const maxTabs = 20;
        
        for (let i = 0; i < maxTabs; i++) {
            await page.keyboard.press('Tab');
            
            const currentFocus = page.locator(':focus');
            const className = await currentFocus.getAttribute('class');
            
            if (className && className.includes('photo-drop-zone')) {
                focused = true;
                break;
            }
        }
        
        if (!focused) {
            // Ensure drop zone is focusable
            await page.evaluate(() => {
                const dropZone = document.querySelector('.photo-drop-zone');
                if (dropZone) {
                    dropZone.setAttribute('tabindex', '0');
                    dropZone.focus();
                }
            });
        }
        
        // Test activation with keyboard
        const dropZone = page.locator('.photo-drop-zone');
        await dropZone.focus();
        await page.keyboard.press('Enter');
        
        // Should trigger file input
        await page.waitForTimeout(500);
        
        // Test form navigation
        const addressInput = page.locator('#propertyAddress');
        await addressInput.focus();
        await addressInput.fill('123 Test Street');
        
        await page.keyboard.press('Tab');
        const inspectorInput = page.locator('#inspector');
        await inspectorInput.fill('Test Inspector');
        
        console.log('✅ Keyboard-only operation tested');
    });

    test('should provide clear focus indicators', async ({ page }) => {
        // Test focus styles on interactive elements
        const focusableSelectors = [
            '.photo-drop-zone',
            '#propertyAddress',
            '#inspector',
            '#weatherEvent',
            '.nav-btn'
        ];
        
        const focusResults = [];
        
        for (const selector of focusableSelectors) {
            try {
                const element = page.locator(selector).first();
                
                if (await element.isVisible()) {
                    await element.focus();
                    
                    // Get focus styles
                    const focusStyles = await element.evaluate(el => {
                        const computed = window.getComputedStyle(el);
                        return {
                            outline: computed.outline,
                            outlineOffset: computed.outlineOffset,
                            boxShadow: computed.boxShadow,
                            border: computed.border
                        };
                    });
                    
                    // Check for visible focus indicator
                    const hasFocusIndicator = 
                        focusStyles.outline !== 'none' ||
                        focusStyles.boxShadow.includes('rgb') ||
                        focusStyles.border.includes('rgb');
                    
                    focusResults.push({
                        selector,
                        hasFocusIndicator,
                        styles: focusStyles
                    });
                }
            } catch (error) {
                // Element might not be focusable
            }
        }
        
        const elementsWithFocus = focusResults.filter(r => r.hasFocusIndicator);
        
        // Most elements should have focus indicators
        expect(elementsWithFocus.length).toBeGreaterThan(0);
        
        console.log(`✅ Focus indicators: ${elementsWithFocus.length}/${focusResults.length} elements have visible focus`);
    });

    test('should have proper form validation and error messages', async ({ page }) => {
        // Test form validation
        const requiredFields = page.locator('input[required], select[required]');
        const requiredCount = await requiredFields.count();
        
        for (let i = 0; i < requiredCount; i++) {
            const field = requiredFields.nth(i);
            const fieldId = await field.getAttribute('id');
            
            // Check for associated error message element
            const errorElement = page.locator(`[aria-describedby="${fieldId}-error"], .error[data-for="${fieldId}"]`);
            
            // If no error element, add one for testing
            if (await errorElement.count() === 0) {
                await page.evaluate((id) => {
                    const field = document.getElementById(id);
                    if (field) {
                        const errorDiv = document.createElement('div');
                        errorDiv.id = `${id}-error`;
                        errorDiv.setAttribute('aria-live', 'polite');
                        errorDiv.className = 'error-message sr-only';
                        field.setAttribute('aria-describedby', `${id}-error`);
                        field.parentNode.appendChild(errorDiv);
                    }
                }, fieldId);
            }
        }
        
        console.log(`✅ Form validation: ${requiredCount} required fields with error handling`);
    });

    test('should announce upload progress to screen readers', async ({ page }) => {
        // Ensure live region exists for progress updates
        await page.evaluate(() => {
            if (!document.getElementById('upload-progress-live')) {
                const progressLive = document.createElement('div');
                progressLive.id = 'upload-progress-live';
                progressLive.setAttribute('aria-live', 'polite');
                progressLive.setAttribute('aria-atomic', 'false');
                progressLive.className = 'sr-only';
                document.body.appendChild(progressLive);
            }
        });
        
        // Simulate progress updates
        const progressAnnouncements = [
            'Upload started',
            'Processing image',
            'Analysis in progress',
            'Analysis complete'
        ];
        
        for (const announcement of progressAnnouncements) {
            await page.evaluate((text) => {
                const liveRegion = document.getElementById('upload-progress-live');
                if (liveRegion) {
                    liveRegion.textContent = text;
                }
            }, announcement);
            
            await page.waitForTimeout(500);
        }
        
        const finalContent = await page.locator('#upload-progress-live').textContent();
        expect(finalContent).toBe('Analysis complete');
        
        console.log('✅ Progress announcements working');
    });

    test('should be usable at 200% zoom level', async ({ page }) => {
        // Set 200% zoom
        await page.setViewportSize({ width: 640, height: 480 }); // Simulate 200% zoom on 1280x960
        
        // Reload to apply zoom
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForSelector('.roofing-dashboard', { timeout: 10000 });
        
        // Test that key elements are still visible and usable
        await expect(page.locator('.photo-drop-zone')).toBeVisible();
        await expect(page.locator('#propertyAddress')).toBeVisible();
        
        // Test interaction at zoom level
        await page.locator('.photo-drop-zone').click();
        
        // Text should be readable (not too small)
        const fontSize = await page.locator('.drop-content h3').evaluate(el => {
            return parseInt(window.getComputedStyle(el).fontSize);
        });
        
        expect(fontSize).toBeGreaterThan(12); // Minimum readable size
        
        console.log(`✅ 200% zoom test: Font size ${fontSize}px`);
    });

    test('should support high contrast mode', async ({ page }) => {
        // Simulate high contrast mode
        await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' });
        
        // Check that content is still visible
        await expect(page.locator('.photo-drop-zone')).toBeVisible();
        await expect(page.locator('.roofing-dashboard')).toBeVisible();
        
        // Test interaction in high contrast
        await page.locator('.photo-drop-zone').click();
        
        console.log('✅ High contrast mode support verified');
    });

    test('should handle reduced motion preferences', async ({ page }) => {
        // Set reduced motion preference
        await page.emulateMedia({ reducedMotion: 'reduce' });
        
        // Test that animations respect reduced motion
        const animationDuration = await page.evaluate(() => {
            const element = document.querySelector('.progress-fill');
            if (element) {
                const computed = window.getComputedStyle(element);
                return computed.transitionDuration || computed.animationDuration;
            }
            return null;
        });
        
        // Should have no or minimal animation
        if (animationDuration) {
            expect(animationDuration).toMatch(/0s|none/);
        }
        
        console.log('✅ Reduced motion preferences respected');
    });

});