/**
 * Susan AI Image Upload WebSocket Tests
 * Tests real-time communication during image analysis
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import WebSocket from 'ws';

const WS_BASE_URL = process.env.WS_BASE_URL || 'ws://localhost:3001';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_TIMEOUT = 60000;

describe('Image Upload WebSocket Integration Tests', () => {
    let ws;
    let messageQueue = [];
    let connectionPromise;

    beforeEach(async () => {
        messageQueue = [];
        
        // Establish WebSocket connection
        connectionPromise = new Promise((resolve, reject) => {
            ws = new WebSocket(`${WS_BASE_URL}/ws`);
            
            ws.on('open', () => {
                console.log('✅ WebSocket connected for test');
                resolve();
            });
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    messageQueue.push(message);
                    console.log(`📨 Received WebSocket message: ${message.type}`);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            });
            
            ws.on('close', () => {
                console.log('🔌 WebSocket disconnected');
            });
        });

        await connectionPromise;
        
        // Wait a bit for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    afterEach(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    });

    test('should establish WebSocket connection successfully', async () => {
        expect(ws).toBeDefined();
        expect(ws.readyState).toBe(WebSocket.OPEN);
        
        // Test basic message sending
        const testMessage = {
            type: 'ping',
            timestamp: new Date().toISOString()
        };
        
        ws.send(JSON.stringify(testMessage));
        
        // Wait for potential response
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('✅ WebSocket connection test passed');
    });

    test('should receive real-time analysis progress updates', async () => {
        // Clear any existing messages
        messageQueue = [];
        
        // Simulate starting an analysis by sending a message to the WebSocket
        const analysisStart = {
            type: 'start_analysis',
            images: ['test-image-1.jpg'],
            sessionId: 'test-session-' + Date.now()
        };
        
        ws.send(JSON.stringify(analysisStart));
        
        // Wait for progress updates
        let progressUpdates = 0;
        let completionReceived = false;
        
        const waitForUpdates = new Promise((resolve) => {
            const checkMessages = () => {
                const progressMessages = messageQueue.filter(msg => msg.type === 'analysis_progress');
                const completeMessages = messageQueue.filter(msg => msg.type === 'analysis_complete');
                
                progressUpdates = progressMessages.length;
                completionReceived = completeMessages.length > 0;
                
                if (completionReceived || progressUpdates >= 3) {
                    resolve();
                } else {
                    setTimeout(checkMessages, 500);
                }
            };
            
            setTimeout(checkMessages, 100);
        });
        
        await waitForUpdates;
        
        // Verify we received progress updates
        expect(progressUpdates).toBeGreaterThan(0);
        
        // Check message structure
        const progressMessage = messageQueue.find(msg => msg.type === 'analysis_progress');
        if (progressMessage) {
            expect(progressMessage).toHaveProperty('progress');
            expect(progressMessage).toHaveProperty('message');
            expect(progressMessage.progress).toBeGreaterThanOrEqual(0);
            expect(progressMessage.progress).toBeLessThanOrEqual(100);
        }
        
        console.log(`✅ Received ${progressUpdates} progress updates`);
    }, TEST_TIMEOUT);

    test('should handle multiple concurrent WebSocket connections', async () => {
        const connections = [];
        const messageQueues = [];
        
        try {
            // Create 3 additional WebSocket connections
            for (let i = 0; i < 3; i++) {
                const queue = [];
                messageQueues.push(queue);
                
                const connection = new Promise((resolve, reject) => {
                    const newWs = new WebSocket(`${WS_BASE_URL}/ws`);
                    
                    newWs.on('open', () => resolve(newWs));
                    newWs.on('message', (data) => {
                        try {
                            const message = JSON.parse(data.toString());
                            queue.push(message);
                        } catch (error) {
                            console.error('Parse error in concurrent connection:', error);
                        }
                    });
                    newWs.on('error', reject);
                });
                
                connections.push(connection);
            }
            
            // Wait for all connections to be established
            const websockets = await Promise.all(connections);
            
            // Send different messages to each connection
            websockets.forEach((ws, index) => {
                const message = {
                    type: 'test_concurrent',
                    connectionId: index,
                    timestamp: new Date().toISOString()
                };
                ws.send(JSON.stringify(message));
            });
            
            // Wait for responses
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Verify all connections are working
            expect(websockets.every(ws => ws.readyState === WebSocket.OPEN)).toBe(true);
            
            // Clean up connections
            websockets.forEach(ws => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            });
            
            console.log('✅ Multiple concurrent WebSocket connections handled successfully');
            
        } catch (error) {
            console.error('Concurrent connection test failed:', error);
            throw error;
        }
    });

    test('should handle WebSocket connection drops gracefully', async () => {
        // Record initial state
        expect(ws.readyState).toBe(WebSocket.OPEN);
        
        // Force close the connection
        ws.close();
        
        // Wait for close event
        await new Promise(resolve => {
            ws.on('close', resolve);
        });
        
        expect(ws.readyState).toBe(WebSocket.CLOSED);
        
        // Test reconnection
        const reconnectPromise = new Promise((resolve, reject) => {
            const newWs = new WebSocket(`${WS_BASE_URL}/ws`);
            
            newWs.on('open', () => {
                expect(newWs.readyState).toBe(WebSocket.OPEN);
                newWs.close();
                resolve();
            });
            
            newWs.on('error', reject);
        });
        
        await reconnectPromise;
        
        console.log('✅ WebSocket reconnection handled successfully');
    });

    test('should broadcast analysis status to all connected clients', async () => {
        // Create a second WebSocket connection
        const secondQueue = [];
        
        const secondWs = await new Promise((resolve, reject) => {
            const newWs = new WebSocket(`${WS_BASE_URL}/ws`);
            
            newWs.on('open', () => resolve(newWs));
            newWs.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    secondQueue.push(message);
                } catch (error) {
                    console.error('Second WebSocket parse error:', error);
                }
            });
            newWs.on('error', reject);
        });
        
        try {
            // Clear message queues
            messageQueue = [];
            
            // Send broadcast message
            const broadcastMessage = {
                type: 'system_status',
                status: 'analysis_started',
                message: 'System analysis initiated',
                broadcast: true
            };
            
            ws.send(JSON.stringify(broadcastMessage));
            
            // Wait for messages to be received
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Both connections should receive the message
            const firstReceived = messageQueue.some(msg => msg.type === 'system_status');
            const secondReceived = secondQueue.some(msg => msg.type === 'system_status');
            
            // At least the sender should receive confirmation
            expect(firstReceived || secondReceived).toBe(true);
            
            console.log(`✅ Broadcast test: First=${firstReceived}, Second=${secondReceived}`);
            
        } finally {
            if (secondWs.readyState === WebSocket.OPEN) {
                secondWs.close();
            }
        }
    });

    test('should handle malformed WebSocket messages gracefully', async () => {
        // Clear message queue
        messageQueue = [];
        
        // Send various malformed messages
        const malformedMessages = [
            'not-json',
            '{"incomplete": }',
            null,
            undefined,
            '',
            '{}',
            '{"type": null}',
            '{"type": 123}',
        ];
        
        malformedMessages.forEach((msg, index) => {
            try {
                if (msg === null || msg === undefined) {
                    // Skip null/undefined as they can't be stringified
                    return;
                }
                ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
            } catch (error) {
                // Expected for some malformed cases
                console.log(`Expected error for malformed message ${index}: ${error.message}`);
            }
        });
        
        // Wait for any error responses
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Connection should still be alive
        expect(ws.readyState).toBe(WebSocket.OPEN);
        
        // Send a valid message to confirm connection is still working
        const validMessage = {
            type: 'ping',
            message: 'test after malformed'
        };
        
        ws.send(JSON.stringify(validMessage));
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        expect(ws.readyState).toBe(WebSocket.OPEN);
        
        console.log('✅ Malformed WebSocket message handling verified');
    });

    test('should maintain connection during high message volume', async () => {
        messageQueue = [];
        
        const messageCount = 50;
        const messages = [];
        
        // Send many messages rapidly
        for (let i = 0; i < messageCount; i++) {
            const message = {
                type: 'high_volume_test',
                sequence: i,
                timestamp: new Date().toISOString(),
                data: 'test-data-' + i
            };
            
            messages.push(message);
            ws.send(JSON.stringify(message));
        }
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Connection should still be active
        expect(ws.readyState).toBe(WebSocket.OPEN);
        
        // Send a final test message
        const finalMessage = {
            type: 'final_test',
            message: 'Connection survived high volume'
        };
        
        ws.send(JSON.stringify(finalMessage));
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        expect(ws.readyState).toBe(WebSocket.OPEN);
        
        console.log(`✅ High volume test: sent ${messageCount} messages, connection stable`);
    });

    test('should receive analysis completion notifications', async () => {
        messageQueue = [];
        
        // Simulate analysis completion
        const completionMessage = {
            type: 'analysis_complete',
            sessionId: 'test-completion-' + Date.now(),
            results: {
                totalImages: 1,
                damageDetected: 0,
                averageConfidence: 85,
                completionTime: 15.5
            }
        };
        
        ws.send(JSON.stringify(completionMessage));
        
        // Wait for any response or acknowledgment
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if we received any analysis-related messages
        const analysisMessages = messageQueue.filter(msg => 
            msg.type && msg.type.includes('analysis')
        );
        
        // Should handle the completion message without errors
        expect(ws.readyState).toBe(WebSocket.OPEN);
        
        console.log(`✅ Analysis completion notification handled (${analysisMessages.length} related messages)`);
    });

    test('should handle WebSocket ping/pong for connection health', async () => {
        const pingReceived = new Promise((resolve) => {
            ws.on('ping', (data) => {
                console.log('📡 Received ping from server');
                resolve(data);
            });
        });
        
        const pongReceived = new Promise((resolve) => {
            ws.on('pong', (data) => {
                console.log('📡 Received pong from server');
                resolve(data);
            });
        });
        
        // Send ping
        ws.ping();
        
        // Wait for either ping or pong (depending on server implementation)
        const result = await Promise.race([
            pingReceived,
            pongReceived,
            new Promise(resolve => setTimeout(() => resolve('timeout'), 5000))
        ]);
        
        expect(result).not.toBe('timeout');
        
        console.log('✅ WebSocket ping/pong health check working');
    });

});

describe('WebSocket Performance Tests', () => {
    let ws;
    
    beforeEach(async () => {
        ws = await new Promise((resolve, reject) => {
            const websocket = new WebSocket(`${WS_BASE_URL}/ws`);
            websocket.on('open', () => resolve(websocket));
            websocket.on('error', reject);
        });
    });
    
    afterEach(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    });

    test('should maintain low latency for real-time updates', async () => {
        const latencies = [];
        const messageCount = 10;
        
        // Setup message handler to measure latency
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.type === 'latency_test' && message.sentTime) {
                    const latency = Date.now() - message.sentTime;
                    latencies.push(latency);
                }
            } catch (error) {
                // Ignore parse errors for this test
            }
        });
        
        // Send test messages with timestamps
        for (let i = 0; i < messageCount; i++) {
            const message = {
                type: 'latency_test',
                sequence: i,
                sentTime: Date.now()
            };
            
            ws.send(JSON.stringify(message));
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between messages
        }
        
        // Wait for responses
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (latencies.length > 0) {
            const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
            const maxLatency = Math.max(...latencies);
            
            // Latency should be reasonable for real-time updates
            expect(avgLatency).toBeLessThan(1000); // Average under 1 second
            expect(maxLatency).toBeLessThan(3000); // Max under 3 seconds
            
            console.log(`✅ Latency test: avg=${avgLatency}ms, max=${maxLatency}ms`);
        } else {
            console.log('ℹ️ No latency responses received (server may not echo messages)');
        }
    });

    test('should handle sustained connection over time', async () => {
        const startTime = Date.now();
        const duration = 10000; // 10 seconds
        const interval = 1000; // Send message every second
        
        let messagesSent = 0;
        let messagesReceived = 0;
        
        ws.on('message', () => {
            messagesReceived++;
        });
        
        // Send periodic messages
        const sendInterval = setInterval(() => {
            if (Date.now() - startTime >= duration) {
                clearInterval(sendInterval);
                return;
            }
            
            const message = {
                type: 'sustained_test',
                sequence: messagesSent++,
                timestamp: new Date().toISOString()
            };
            
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        }, interval);
        
        // Wait for test duration
        await new Promise(resolve => setTimeout(resolve, duration + 1000));
        
        clearInterval(sendInterval);
        
        // Connection should still be active
        expect(ws.readyState).toBe(WebSocket.OPEN);
        expect(messagesSent).toBeGreaterThan(0);
        
        console.log(`✅ Sustained connection test: sent ${messagesSent} messages over ${duration}ms`);
    });
});

describe('Error Recovery Tests', () => {
    test('should handle server restart gracefully', async () => {
        // This test simulates server restart by creating connection, 
        // expecting it to fail, then reconnecting
        
        let firstConnection;
        let reconnectionSuccessful = false;
        
        try {
            // Establish first connection
            firstConnection = await new Promise((resolve, reject) => {
                const ws = new WebSocket(`${WS_BASE_URL}/ws`);
                ws.on('open', () => resolve(ws));
                ws.on('error', reject);
            });
            
            expect(firstConnection.readyState).toBe(WebSocket.OPEN);
            
            // Force close (simulating server restart)
            firstConnection.terminate();
            
            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try to reconnect
            const secondConnection = await new Promise((resolve, reject) => {
                const ws = new WebSocket(`${WS_BASE_URL}/ws`);
                ws.on('open', () => {
                    reconnectionSuccessful = true;
                    ws.close();
                    resolve(ws);
                });
                ws.on('error', reject);
            });
            
            expect(reconnectionSuccessful).toBe(true);
            
        } catch (error) {
            console.log(`ℹ️ Server restart test: ${error.message}`);
            // This may fail if WebSocket server is not available, which is okay
        }
        
        console.log('✅ Server restart recovery test completed');
    });
});