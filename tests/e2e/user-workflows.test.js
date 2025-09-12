import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { testDataGenerators } from '../utils/mocks.js';

describe('End-to-End User Workflows', () => {
  let browser;
  let page;
  let server;
  let serverPort;
  
  beforeAll(async () => {
    // Start the Susan AI server for E2E testing
    serverPort = 3001;
    process.env.NODE_ENV = 'test';
    process.env.PORT = serverPort;
    
    server = spawn('node', ['src/server.js'], {
      stdio: 'pipe',
      env: { ...process.env }
    });
    
    // Wait for server to start
    await new Promise((resolve) => {
      server.stdout.on('data', (data) => {
        if (data.toString().includes('Server running')) {
          resolve();
        }
      });
      
      // Fallback timeout
      setTimeout(resolve, 5000);
    });
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: process.env.CI === 'true', // Run headless in CI, visible locally
      slowMo: 50, // Slow down actions for better debugging
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
  });
  
  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    
    if (server) {
      server.kill('SIGTERM');
      await new Promise((resolve) => {
        server.on('close', resolve);
        setTimeout(() => {
          server.kill('SIGKILL');
          resolve();
        }, 5000);
      });
    }
  });
  
  beforeEach(async () => {
    page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({ width: 1280, height: 800 });
    
    // Enable request/response logging for debugging
    if (process.env.DEBUG_E2E) {
      page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
      page.on('request', (req) => console.log('REQUEST:', req.url()));
      page.on('response', (res) => console.log('RESPONSE:', res.url(), res.status()));
    }
    
    // Navigate to the application
    await page.goto(`http://localhost:${serverPort}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
  });
  
  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('Initial App Loading', () => {
    test('should load the main interface', async () => {
      // Check if main elements are present
      await page.waitForSelector('#susan-container', { timeout: 10000 });
      
      const title = await page.title();
      expect(title).toContain('Susan AI');
      
      // Check if essential UI elements are present
      const chatContainer = await page.$('#chat-container');
      const inputArea = await page.$('#message-input');
      const sendButton = await page.$('#send-button');
      
      expect(chatContainer).toBeTruthy();
      expect(inputArea).toBeTruthy();
      expect(sendButton).toBeTruthy();
    });

    test('should display welcome message', async () => {
      await page.waitForSelector('.welcome-message', { timeout: 5000 });
      
      const welcomeText = await page.$eval('.welcome-message', el => el.textContent);
      expect(welcomeText).toContain('Hello! I\'m Susan');
    });

    test('should initialize voice controls', async () => {
      await page.waitForSelector('#voice-controls', { timeout: 5000 });
      
      const micButton = await page.$('#mic-button');
      const voiceSettings = await page.$('#voice-settings');
      
      expect(micButton).toBeTruthy();
      expect(voiceSettings).toBeTruthy();
    });
  });

  describe('Text-based Conversation Flow', () => {
    test('should handle basic text conversation', async () => {
      // Type a message
      await page.type('#message-input', 'Hello Susan, how are you today?');
      
      // Send the message
      await page.click('#send-button');
      
      // Wait for user message to appear
      await page.waitForSelector('.message.user', { timeout: 5000 });
      
      // Verify user message
      const userMessage = await page.$eval('.message.user:last-child .message-text', el => el.textContent);
      expect(userMessage).toBe('Hello Susan, how are you today?');
      
      // Wait for AI response
      await page.waitForSelector('.message.assistant', { timeout: 15000 });
      
      // Verify AI response exists and has content
      const aiMessage = await page.$eval('.message.assistant:last-child .message-text', el => el.textContent);
      expect(aiMessage.length).toBeGreaterThan(0);
      expect(aiMessage).toMatch(/hello|hi|good|fine|well/i);
    });

    test('should handle follow-up questions', async () => {
      // First message
      await page.type('#message-input', 'What is artificial intelligence?');
      await page.click('#send-button');
      
      await page.waitForSelector('.message.assistant', { timeout: 15000 });
      
      // Follow-up question
      await page.type('#message-input', 'Can you give me an example?');
      await page.click('#send-button');
      
      await page.waitForSelector('.message.assistant:nth-of-type(2)', { timeout: 15000 });
      
      // Check that we have multiple exchanges
      const messages = await page.$$('.message');
      expect(messages.length).toBeGreaterThanOrEqual(4); // 2 user + 2 assistant
    });

    test('should maintain conversation context', async () => {
      // Ask about a specific topic
      await page.type('#message-input', 'My name is John and I love programming');
      await page.click('#send-button');
      
      await page.waitForSelector('.message.assistant', { timeout: 15000 });
      
      // Reference previous context
      await page.type('#message-input', 'What do you remember about me?');
      await page.click('#send-button');
      
      await page.waitForSelector('.message.assistant:nth-of-type(2)', { timeout: 15000 });
      
      const contextResponse = await page.$eval('.message.assistant:nth-of-type(2) .message-text', el => el.textContent);
      expect(contextResponse.toLowerCase()).toMatch(/john|programming/i);
    });
  });

  describe('Voice Interaction Workflow', () => {
    test('should enable voice recording', async () => {
      // Mock permissions for microphone access
      const context = browser.defaultBrowserContext();
      await context.overridePermissions(`http://localhost:${serverPort}`, ['microphone']);
      
      // Click microphone button
      await page.click('#mic-button');
      
      // Wait for recording state
      await page.waitForSelector('#mic-button.recording', { timeout: 5000 });
      
      // Verify recording state
      const isRecording = await page.$eval('#mic-button', el => el.classList.contains('recording'));
      expect(isRecording).toBe(true);
      
      // Stop recording
      await page.click('#mic-button');
      
      // Wait for processing state
      await page.waitForSelector('#mic-button.processing', { timeout: 2000 });
    });

    test('should handle voice settings', async () => {
      // Open voice settings
      await page.click('#voice-settings');
      
      // Wait for settings panel
      await page.waitForSelector('.voice-settings-panel', { timeout: 5000 });
      
      // Check voice selection
      const voiceSelect = await page.$('#voice-select');
      expect(voiceSelect).toBeTruthy();
      
      // Change voice
      await page.select('#voice-select', 'nova');
      
      // Check speed control
      const speedControl = await page.$('#speech-speed');
      expect(speedControl).toBeTruthy();
      
      // Adjust speed
      await page.$eval('#speech-speed', el => el.value = '1.2');
      await page.$eval('#speech-speed', el => el.dispatchEvent(new Event('change')));
      
      // Save settings
      await page.click('#save-voice-settings');
      
      // Verify settings are saved
      await page.waitForFunction(
        () => !document.querySelector('.voice-settings-panel'),
        { timeout: 5000 }
      );
    });
  });

  describe('Conversation Management', () => {
    test('should create new conversation', async () => {
      // Click new conversation button
      await page.click('#new-conversation');
      
      // Wait for conversation to be created
      await page.waitForSelector('.conversation-header', { timeout: 5000 });
      
      // Verify new conversation
      const conversationTitle = await page.$eval('.conversation-title', el => el.textContent);
      expect(conversationTitle).toContain('New Conversation');
      
      // Verify chat is cleared
      const messages = await page.$$('.message');
      expect(messages.length).toBe(0);
    });

    test('should save and load conversations', async () => {
      // Send a message to create conversation content
      await page.type('#message-input', 'This is a test conversation');
      await page.click('#send-button');
      
      await page.waitForSelector('.message.assistant', { timeout: 15000 });
      
      // Open conversation sidebar
      await page.click('#conversations-toggle');
      
      // Wait for sidebar
      await page.waitForSelector('.conversations-sidebar', { timeout: 5000 });
      
      // Verify conversation appears in list
      const conversationItems = await page.$$('.conversation-item');
      expect(conversationItems.length).toBeGreaterThan(0);
      
      // Click on a conversation to load it
      await page.click('.conversation-item:first-child');
      
      // Verify conversation loads
      await page.waitForSelector('.message', { timeout: 5000 });
      const loadedMessage = await page.$eval('.message.user .message-text', el => el.textContent);
      expect(loadedMessage).toBe('This is a test conversation');
    });

    test('should rename conversation', async () => {
      // Send a message to create a conversation
      await page.type('#message-input', 'Test message for renaming');
      await page.click('#send-button');
      
      await page.waitForSelector('.message.assistant', { timeout: 15000 });
      
      // Right-click on conversation title to open context menu
      await page.click('.conversation-title', { button: 'right' });
      
      // Wait for context menu
      await page.waitForSelector('.context-menu', { timeout: 5000 });
      
      // Click rename option
      await page.click('.context-menu .rename-option');
      
      // Wait for edit input
      await page.waitForSelector('.conversation-title-edit', { timeout: 5000 });
      
      // Clear and type new name
      await page.$eval('.conversation-title-edit', el => el.value = '');
      await page.type('.conversation-title-edit', 'Renamed Test Conversation');
      
      // Press Enter to save
      await page.keyboard.press('Enter');
      
      // Verify new title
      await page.waitForFunction(
        () => document.querySelector('.conversation-title').textContent === 'Renamed Test Conversation',
        { timeout: 5000 }
      );
    });
  });

  describe('Real-time Features', () => {
    test('should show typing indicator during AI response', async () => {
      // Send a message
      await page.type('#message-input', 'Tell me a long story about space exploration');
      await page.click('#send-button');
      
      // Wait for typing indicator
      await page.waitForSelector('.typing-indicator', { timeout: 5000 });
      
      // Verify typing indicator is visible
      const typingIndicator = await page.$('.typing-indicator');
      expect(typingIndicator).toBeTruthy();
      
      // Wait for response to complete
      await page.waitForSelector('.message.assistant', { timeout: 20000 });
      
      // Verify typing indicator is gone
      const typingIndicatorAfter = await page.$('.typing-indicator');
      expect(typingIndicatorAfter).toBeFalsy();
    });

    test('should handle streaming responses', async () => {
      // Send a message that should trigger streaming
      await page.type('#message-input', 'Write a detailed explanation of quantum computing');
      await page.click('#send-button');
      
      // Wait for streaming to start
      await page.waitForSelector('.message.assistant .streaming', { timeout: 10000 });
      
      // Monitor streaming content
      let previousLength = 0;
      let contentGrew = false;
      
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(500);
        
        const currentContent = await page.$eval('.message.assistant:last-child .message-text', el => el.textContent);
        if (currentContent.length > previousLength) {
          contentGrew = true;
          previousLength = currentContent.length;
        }
      }
      
      expect(contentGrew).toBe(true);
      
      // Wait for streaming to complete
      await page.waitForFunction(
        () => !document.querySelector('.message.assistant .streaming'),
        { timeout: 30000 }
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // Simulate network failure by killing the server temporarily
      server.kill('SIGSTOP');
      
      // Try to send a message
      await page.type('#message-input', 'This should fail');
      await page.click('#send-button');
      
      // Wait for error message
      await page.waitForSelector('.error-message', { timeout: 10000 });
      
      const errorMessage = await page.$eval('.error-message', el => el.textContent);
      expect(errorMessage).toMatch(/network|connection|error/i);
      
      // Resume server
      server.kill('SIGCONT');
      
      // Wait for server to recover
      await page.waitForTimeout(2000);
      
      // Try again
      await page.type('#message-input', 'This should work now');
      await page.click('#send-button');
      
      // Should succeed
      await page.waitForSelector('.message.assistant', { timeout: 15000 });
    });

    test('should handle invalid voice input', async () => {
      const context = browser.defaultBrowserContext();
      await context.overridePermissions(`http://localhost:${serverPort}`, ['microphone']);
      
      // Mock a very short recording that would be invalid
      await page.evaluate(() => {
        // Mock navigator.mediaDevices to simulate invalid audio
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
        navigator.mediaDevices.getUserMedia = async () => {
          const stream = await originalGetUserMedia.call(navigator.mediaDevices, { audio: true });
          // Stop the stream immediately to simulate invalid input
          stream.getTracks().forEach(track => track.stop());
          return stream;
        };
      });
      
      // Try to record
      await page.click('#mic-button');
      await page.waitForTimeout(100); // Very short recording
      await page.click('#mic-button');
      
      // Wait for error handling
      await page.waitForSelector('.voice-error', { timeout: 5000 });
      
      const voiceError = await page.$eval('.voice-error', el => el.textContent);
      expect(voiceError).toMatch(/audio|recording|error/i);
    });
  });

  describe('Accessibility', () => {
    test('should be keyboard navigable', async () => {
      // Tab through the interface
      await page.keyboard.press('Tab'); // Should focus message input
      await page.keyboard.type('Testing keyboard navigation');
      
      await page.keyboard.press('Tab'); // Should focus send button
      await page.keyboard.press('Enter'); // Should send message
      
      await page.waitForSelector('.message.user', { timeout: 5000 });
      
      const userMessage = await page.$eval('.message.user:last-child .message-text', el => el.textContent);
      expect(userMessage).toBe('Testing keyboard navigation');
    });

    test('should have proper ARIA labels', async () => {
      const messageInput = await page.$('#message-input');
      const ariaLabel = await messageInput.evaluate(el => el.getAttribute('aria-label'));
      expect(ariaLabel).toBeTruthy();
      
      const sendButton = await page.$('#send-button');
      const buttonAriaLabel = await sendButton.evaluate(el => el.getAttribute('aria-label'));
      expect(buttonAriaLabel).toBeTruthy();
    });

    test('should support screen reader navigation', async () => {
      // Check for proper heading structure
      const headings = await page.$$('h1, h2, h3, h4, h5, h6');
      expect(headings.length).toBeGreaterThan(0);
      
      // Check for landmark regions
      const main = await page.$('main');
      const nav = await page.$('nav');
      expect(main).toBeTruthy();
    });
  });

  describe('Performance', () => {
    test('should load within acceptable time', async () => {
      const startTime = Date.now();
      
      await page.goto(`http://localhost:${serverPort}`, {
        waitUntil: 'networkidle2'
      });
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    });

    test('should handle multiple rapid messages', async () => {
      const messages = [
        'First message',
        'Second message',
        'Third message'
      ];
      
      // Send multiple messages rapidly
      for (const message of messages) {
        await page.type('#message-input', message);
        await page.click('#send-button');
        await page.waitForTimeout(100); // Small delay between sends
      }
      
      // Wait for all responses
      await page.waitForFunction(
        () => document.querySelectorAll('.message.assistant').length >= 3,
        { timeout: 30000 }
      );
      
      const assistantMessages = await page.$$('.message.assistant');
      expect(assistantMessages.length).toBe(3);
    });
  });

  describe('Mobile Responsiveness', () => {
    test('should work on mobile viewport', async () => {
      // Set mobile viewport
      await page.setViewport({ width: 375, height: 667 }); // iPhone SE
      
      await page.reload({ waitUntil: 'networkidle2' });
      
      // Check if mobile layout is applied
      const chatContainer = await page.$('#chat-container');
      const containerWidth = await chatContainer.evaluate(el => el.offsetWidth);
      expect(containerWidth).toBeLessThanOrEqual(375);
      
      // Test mobile interaction
      await page.type('#message-input', 'Mobile test message');
      await page.click('#send-button');
      
      await page.waitForSelector('.message.user', { timeout: 5000 });
      
      const userMessage = await page.$eval('.message.user:last-child .message-text', el => el.textContent);
      expect(userMessage).toBe('Mobile test message');
    });
  });
});
