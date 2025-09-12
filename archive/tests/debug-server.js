console.log('Starting debug server...');

try {
    console.log('Loading environment variables...');
    import('dotenv').then(dotenv => {
        dotenv.config();
        console.log('Environment loaded');
        console.log('PORT:', process.env.PORT);
        console.log('HOST:', process.env.HOST);
        
        console.log('Loading Susan modules...');
        Promise.all([
            import('./src/susan-brain.js'),
            import('./src/command-handler.js')
        ]).then(([brainModule, commandModule]) => {
            console.log('Modules loaded successfully');
            
            // Test basic Express server
            import('express').then(express => {
                const app = express.default();
                const port = process.env.PORT || 3001;
                
                app.get('/', (req, res) => {
                    res.send('<h1>Susan Debug Server</h1><p>Basic functionality working!</p>');
                });
                
                app.listen(port, 'localhost', () => {
                    console.log(`Debug server running at http://localhost:${port}`);
                });
            });
        }).catch(error => {
            console.error('Error loading Susan modules:', error);
        });
    });
} catch (error) {
    console.error('Startup error:', error);
}