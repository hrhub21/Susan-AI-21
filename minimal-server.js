console.log('🚀 Starting minimal Susan server...');

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Basic route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Test route
app.get('/test', (req, res) => {
    res.json({ 
        status: 'working', 
        message: 'Susan minimal server is running!',
        timestamp: new Date().toISOString()
    });
});

app.listen(port, 'localhost', () => {
    console.log('✅ Minimal Susan server started!');
    console.log(`📍 Server running at: http://localhost:${port}`);
    console.log(`🧪 Test endpoint: http://localhost:${port}/test`);
    console.log('💡 Press Ctrl+C to stop');
});

console.log('🔍 Server setup complete, waiting for startup...');