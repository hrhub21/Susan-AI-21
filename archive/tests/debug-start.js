console.log('🔍 Debug: Starting Susan server...');

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

try {
    console.log('🔍 Debug: Loading modules...');
    
    import('./src/server.js')
        .then(() => {
            console.log('✅ Server module loaded successfully');
        })
        .catch((error) => {
            console.error('❌ Failed to load server:', error);
            console.error('Stack:', error.stack);
        });
    
} catch (error) {
    console.error('❌ Immediate error:', error);
    console.error('Stack:', error.stack);
}