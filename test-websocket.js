import WebSocket from 'ws';

console.log('🧪 Testing WebSocket Communication...');

const ws = new WebSocket('ws://localhost:3003');

ws.on('open', function open() {
    console.log('✅ WebSocket connection established');
    
    // Send a test message
    console.log('📤 Sending test message...');
    ws.send(JSON.stringify({
        type: 'message',
        content: 'Hello Susan, this is a test message',
        timestamp: new Date().toISOString()
    }));
});

ws.on('message', function message(data) {
    const response = JSON.parse(data.toString());
    console.log('📥 Received response:', response);
    
    if (response.type === 'response') {
        console.log('✅ SUCCESS: Received proper response');
        console.log('📝 Content:', response.content);
        console.log('🤖 Model:', response.model);
    } else if (response.type === 'connection') {
        console.log('✅ Connection message received:', response.message);
    } else {
        console.log('⚠️  Unexpected message type:', response.type);
    }
});

ws.on('error', function error(err) {
    console.error('❌ WebSocket error:', err);
});

ws.on('close', function close() {
    console.log('🔌 WebSocket connection closed');
    process.exit(0);
});

// Close after 15 seconds
setTimeout(() => {
    console.log('⏰ Test timeout - closing connection');
    ws.close();
}, 15000);