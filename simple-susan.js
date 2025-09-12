import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const port = process.env.PORT || 3001;

// Serve static files
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve the main page
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Basic WebSocket handling
wss.on('connection', (ws) => {
    console.log('Client connected');
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'response',
        content: 'Hello! I\'m Susan, your AI assistant. I\'m starting up...',
        timestamp: new Date().toISOString()
    }));
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log('Received:', message.content);
            
            // Simple echo response for now
            ws.send(JSON.stringify({
                type: 'response',
                content: `I heard you say: "${message.content}". I'm still initializing my full capabilities!`,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error('Message error:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

server.listen(port, 'localhost', () => {
    console.log('🤖 Simple Susan Server started!');
    console.log(`📍 Server running at: http://localhost:${port}`);
    console.log('💡 Open the URL in your browser to test!');
});