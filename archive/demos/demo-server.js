import express from 'express';
import path from 'path';
import { WebSocketServer } from 'ws';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3002;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('🔗 Client connected');

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log('📨 Received:', message);

            // Simulate AI response
            setTimeout(() => {
                const response = {
                    type: 'response',
                    content: generateResponse(message.content),
                    timestamp: new Date().toISOString()
                };
                ws.send(JSON.stringify(response));
            }, 1000 + Math.random() * 2000); // 1-3 second delay

        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                content: 'Failed to process your message'
            }));
        }
    });

    ws.on('close', () => {
        console.log('🔌 Client disconnected');
    });

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'status',
        content: 'Connected to Susan AI Premium'
    }));
});

// Simple response generator for demo
function generateResponse(input) {
    const responses = [
        `I understand you said: "${input}". That's interesting! As your premium AI assistant, I'm here to help with any questions or tasks you might have.`,
        `Thanks for your message about "${input}". I'm Susan AI Premium, and I'm equipped with advanced capabilities to assist you with complex tasks.`,
        `I received your input: "${input}". With my enhanced processing power and premium features, I can help you with analysis, creativity, and problem-solving.`,
        `Your message "${input}" has been processed. I'm ready to demonstrate my advanced conversational abilities and premium AI features.`,
        `I've analyzed your input: "${input}". As a premium AI assistant, I can provide detailed insights, creative solutions, and intelligent responses.`
    ];
    
    // Add some dynamic responses based on keywords
    const lowerInput = input.toLowerCase();
    if (lowerInput.includes('weather')) {
        return "I can see you're interested in weather! While I can display weather widgets in my interface, for real-time weather data, I'd need to connect to a weather API. The current demo shows simulated weather information.";
    }
    if (lowerInput.includes('file') || lowerInput.includes('upload')) {
        return "Great! I notice you're working with files. My premium interface supports drag-and-drop file uploads, multi-format file analysis, and intelligent document processing. Feel free to try uploading a file!";
    }
    if (lowerInput.includes('voice') || lowerInput.includes('speak')) {
        return "Excellent! My premium voice capabilities include real-time audio visualization, customizable speech settings, and advanced voice recognition. You can adjust my speaking speed and pitch in the settings panel.";
    }
    if (lowerInput.includes('theme') || lowerInput.includes('dark') || lowerInput.includes('light')) {
        return "I love that you're exploring my interface themes! You can toggle between dark and light modes using the theme button in the top navigation. Each theme is carefully designed for optimal visual experience.";
    }
    
    return responses[Math.floor(Math.random() * responses.length)];
}

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Susan AI Premium Demo Server running on http://localhost:${PORT}`);
    console.log(`💫 Advanced JARVIS-like interface ready!`);
    console.log(`🎯 Features available: Voice interaction, file upload, themes, real-time widgets`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Susan AI Premium Demo Server...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});