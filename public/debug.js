// Debug script to check JavaScript execution
console.log('=== SUSAN AI DEBUG SCRIPT ===');

// Check if basic DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM Content Loaded');
    
    // Check if elements exist
    const elements = {
        susanOrb: document.getElementById('susanOrb'),
        voiceBtn: document.getElementById('voiceBtn'),
        textInput: document.getElementById('textInput'),
        sendBtn: document.getElementById('sendBtn'),
        statusText: document.getElementById('statusText')
    };
    
    console.log('=== ELEMENT CHECK ===');
    Object.entries(elements).forEach(([name, element]) => {
        if (element) {
            console.log(`✅ ${name}: Found`);
        } else {
            console.log(`❌ ${name}: Missing`);
        }
    });
    
    // Check if SusanAI class exists
    if (typeof SusanAI !== 'undefined') {
        console.log('✅ SusanAI class: Available');
        
        // Check if susan instance exists
        setTimeout(() => {
            if (window.susan) {
                console.log('✅ Susan instance: Created');
                console.log('Susan object:', window.susan);
                
                // Test event listener binding
                if (elements.susanOrb) {
                    console.log('Testing orb click...');
                    const clickEvent = new Event('click');
                    elements.susanOrb.dispatchEvent(clickEvent);
                    console.log('Orb click event dispatched');
                }
            } else {
                console.log('❌ Susan instance: Not created');
            }
        }, 1000);
    } else {
        console.log('❌ SusanAI class: Not available');
    }
    
    // Check for JavaScript errors
    window.addEventListener('error', (event) => {
        console.error('❌ JavaScript Error:', event.error);
        console.error('Error details:', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    });
    
    // Check for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        console.error('❌ Unhandled Promise Rejection:', event.reason);
    });
    
    // Test WebSocket connectivity
    setTimeout(() => {
        console.log('=== WEBSOCKET TEST ===');
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            console.log('Connecting to:', wsUrl);
            
            const testWs = new WebSocket(wsUrl);
            testWs.onopen = () => {
                console.log('✅ WebSocket: Connected successfully');
                testWs.close();
            };
            testWs.onerror = (error) => {
                console.log('❌ WebSocket: Connection failed', error);
            };
        } catch (error) {
            console.log('❌ WebSocket: Test failed', error);
        }
    }, 2000);
});

console.log('=== DEBUG SCRIPT LOADED ===');