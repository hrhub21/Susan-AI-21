// Test interface functionality
import puppeteer from 'puppeteer';

async function testSusanInterface() {
    console.log('🧪 Testing Susan AI Interface...');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Listen for console errors
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('❌ Browser console error:', msg.text());
        } else if (msg.type() === 'log') {
            console.log('📝 Browser log:', msg.text());
        }
    });
    
    try {
        console.log('📂 Loading http://localhost:3003...');
        await page.goto('http://localhost:3003', { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
        });
        
        // Wait a few seconds for initialization
        await page.waitForTimeout(5000);
        
        // Check if loading screen is still visible
        const loadingIndicator = await page.$('#loading-indicator');
        const isLoadingHidden = await page.evaluate((element) => {
            return element && element.classList.contains('hidden');
        }, loadingIndicator);
        
        console.log(`Loading indicator hidden: ${isLoadingHidden}`);
        
        // Check if orb is clickable
        const orb = await page.$('.voice-orb');
        if (orb) {
            console.log('✅ Voice orb found');
            await orb.click();
            console.log('🖱️ Orb clicked');
        } else {
            console.log('❌ Voice orb not found');
        }
        
        // Check WebSocket connection
        const wsStatus = await page.evaluate(() => {
            return window.susanAI && window.susanAI.ws ? window.susanAI.ws.readyState : 'No WebSocket';
        });
        
        console.log(`WebSocket status: ${wsStatus}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
    }
}

// Only run if puppeteer is available
try {
    await testSusanInterface();
} catch (error) {
    console.log('⚠️  Puppeteer not available, manual testing required');
    console.log('👉 Please open http://localhost:3003 manually and check:');
    console.log('   1. Does the loading screen disappear?');
    console.log('   2. Can you click the orb?');
    console.log('   3. Are there console errors (F12)?');
}