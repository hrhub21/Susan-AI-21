#!/usr/bin/env node

/**
 * Direct Susan AI Chat Test
 * Tests the chat functionality directly without browser interface
 */

import WebSocket from 'ws';

console.log('🤖 Testing Susan AI Chat Functionality');
console.log('Connecting to ws://localhost:3004...\n');

const ws = new WebSocket('ws://localhost:3004');

ws.on('open', function open() {
    console.log('✅ Connected to Susan AI WebSocket');
    
    // Send a test message
    const testMessage = {
        type: 'message',
        content: 'Hello Susan! Are you online and working? Please respond with your capabilities.',
        conversationId: 'test-' + Date.now()
    };
    
    console.log('📤 Sending test message...');
    ws.send(JSON.stringify(testMessage));
});

ws.on('message', function incoming(data) {
    try {
        const response = JSON.parse(data);
        console.log('📥 Susan AI Response:');
        console.log('   Type:', response.type);
        console.log('   Content:', response.content);
        console.log('   Timestamp:', new Date(response.timestamp).toLocaleTimeString());
        
        // Test a follow-up question about vision capabilities
        if (response.type === 'response') {
            console.log('\n📤 Testing vision capabilities...');
            const visionTest = {
                type: 'message', 
                content: 'Can you analyze images using Qwen 2.5 VL? List your AI agent capabilities.',
                conversationId: 'test-' + Date.now()
            };
            ws.send(JSON.stringify(visionTest));
        }
    } catch (error) {
        console.log('📥 Raw response:', data.toString());
    }
});

ws.on('error', function error(err) {
    console.log('❌ WebSocket error:', err.message);
    process.exit(1);
});

ws.on('close', function close() {
    console.log('\n🔌 Connection closed');
    process.exit(0);
});

// Close after 10 seconds
setTimeout(() => {
    console.log('\n⏰ Test timeout - closing connection');
    ws.close();
}, 10000);