import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EnhancedCommandHandler } from './enhanced-command-handler.js';

const execAsync = promisify(exec);

export class CommandHandler extends EnhancedCommandHandler {
    constructor(susanBrain) {
        super(susanBrain); // Call enhanced parent constructor
        // Additional setup for backwards compatibility
        this.setupLegacyCommands();
        
        console.log('🎯 Enhanced Command Handler active with', this.commands.size, 'total commands');
    }
    
    setupLegacyCommands() {
        // System commands
        this.registerCommand('time', 'Get current time', () => this.getTime());
        this.registerCommand('date', 'Get current date', () => this.getDate());
        this.registerCommand('weather', 'Get weather information', (args) => this.getWeather(args));
        
        // File system commands
        this.registerCommand('list files', 'List files in current directory', () => this.listFiles());
        this.registerCommand('current directory', 'Show current directory', () => this.getCurrentDirectory());
        
        // System information
        this.registerCommand('system info', 'Get system information', () => this.getSystemInfo());
        
        // Web search (placeholder for future implementation)
        this.registerCommand('search', 'Search the web', (query) => this.webSearch(query));
        
        // Calculator
        this.registerCommand('calculate', 'Perform calculations', (expression) => this.calculate(expression));
        
        // Reminders (basic implementation)
        this.registerCommand('remind me', 'Set a reminder', (reminder) => this.setReminder(reminder));
        this.registerCommand('show reminders', 'Show all reminders', () => this.showReminders());
        
        // Susan-specific commands
        this.registerCommand('who are you', 'About Susan', () => this.aboutSusan());
        this.registerCommand('your capabilities', 'List Susan\'s capabilities', () => this.listCapabilities());
    }
    
    registerCommand(trigger, description, handler) {
        this.commands.set(trigger.toLowerCase(), {
            trigger,
            description,
            handler
        });
    }
    
    async processInput(input) {
        const inputLower = input.toLowerCase().trim();
        
        // Check for exact command matches first
        for (const [trigger, command] of this.commands.entries()) {
            if (inputLower === trigger || inputLower.startsWith(trigger + ' ')) {
                try {
                    const args = inputLower.replace(trigger, '').trim();
                    const result = await command.handler(args);
                    return {
                        isCommand: true,
                        result: result || `Executed: ${command.trigger}`
                    };
                } catch (error) {
                    return {
                        isCommand: true,
                        result: `Error executing command: ${error.message}`
                    };
                }
            }
        }
        
        // Check for partial matches or intent recognition
        return this.detectIntent(input);
    }
    
    async detectIntent(input) {
        const inputLower = input.toLowerCase();
        
        // Time-related intents
        if (inputLower.includes('what time') || inputLower.includes('current time')) {
            return { isCommand: true, result: await this.getTime() };
        }
        
        if (inputLower.includes('what date') || inputLower.includes('today\'s date')) {
            return { isCommand: true, result: await this.getDate() };
        }
        
        // Weather intents
        if (inputLower.includes('weather') || inputLower.includes('temperature')) {
            return { isCommand: true, result: await this.getWeather() };
        }
        
        // Math/calculation intents
        if (inputLower.includes('calculate') || inputLower.includes('what is') && /\d/.test(input)) {
            const mathExpression = input.replace(/calculate|what is/gi, '').trim();
            return { isCommand: true, result: await this.calculate(mathExpression) };
        }
        
        // File system intents
        if (inputLower.includes('list files') || inputLower.includes('show files')) {
            return { isCommand: true, result: await this.listFiles() };
        }
        
        return { isCommand: false }; // Not a command, let AI handle it
    }
    
    // Command implementations
    async getTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        return `The current time is ${timeString}.`;
    }
    
    async getDate() {
        const now = new Date();
        const dateString = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        return `Today is ${dateString}.`;
    }
    
    async getWeather(location = '') {
        // Placeholder implementation - in a real app, you'd integrate with a weather API
        return `I don't have access to real-time weather data yet, but I can help you find weather information online or suggest weather apps you can use.`;
    }
    
    async listFiles() {
        try {
            const { stdout } = await execAsync('dir', { shell: true });
            return `Here are the files in the current directory:\n\n${stdout.substring(0, 500)}${stdout.length > 500 ? '...\n(output truncated)' : ''}`;
        } catch (error) {
            return `Unable to list files: ${error.message}`;
        }
    }
    
    async getCurrentDirectory() {
        try {
            const { stdout } = await execAsync('cd', { shell: true });
            return `Current directory: ${stdout.trim()}`;
        } catch (error) {
            return `Unable to get current directory: ${error.message}`;
        }
    }
    
    async getSystemInfo() {
        try {
            const { stdout } = await execAsync('systeminfo | findstr /C:"OS Name" /C:"Total Physical Memory"', { shell: true });
            return `System Information:\n${stdout}`;
        } catch (error) {
            return `Unable to get system information: ${error.message}`;
        }
    }
    
    async webSearch(query) {
        // Placeholder - would integrate with search APIs in production
        return `I'd love to search for "${query}" but I don't have web search capabilities yet. You can search for this on your preferred search engine.`;
    }
    
    async calculate(expression) {
        try {
            // Basic math evaluation (be very careful with eval in production!)
            const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
            if (!sanitized) {
                return "I need a math expression to calculate. Try something like '2 + 2' or '10 * 5'.";
            }
            
            // Safe evaluation for basic math
            const result = Function(`"use strict"; return (${sanitized})`)();
            return `${expression} = ${result}`;
        } catch (error) {
            return `I couldn't calculate that. Please use basic math operations (+, -, *, /, parentheses).`;
        }
    }
    
    async setReminder(reminder) {
        // Basic reminder system - in production, you'd use a proper database
        const remindersFile = path.join(process.cwd(), 'data', 'reminders.json');
        
        try {
            await fs.ensureDir(path.dirname(remindersFile));
            
            let reminders = [];
            if (await fs.pathExists(remindersFile)) {
                reminders = await fs.readJson(remindersFile);
            }
            
            const newReminder = {
                id: Date.now(),
                text: reminder,
                created: new Date().toISOString(),
                completed: false
            };
            
            reminders.push(newReminder);
            await fs.writeJson(remindersFile, reminders, { spaces: 2 });
            
            return `Reminder set: "${reminder}"`;
        } catch (error) {
            return `Couldn't set reminder: ${error.message}`;
        }
    }
    
    async showReminders() {
        const remindersFile = path.join(process.cwd(), 'data', 'reminders.json');
        
        try {
            if (!(await fs.pathExists(remindersFile))) {
                return "You don't have any reminders yet.";
            }
            
            const reminders = await fs.readJson(remindersFile);
            const activeReminders = reminders.filter(r => !r.completed);
            
            if (activeReminders.length === 0) {
                return "You don't have any active reminders.";
            }
            
            const remindersList = activeReminders
                .map((r, i) => `${i + 1}. ${r.text} (created ${new Date(r.created).toLocaleDateString()})`)
                .join('\n');
                
            return `Your reminders:\n${remindersList}`;
        } catch (error) {
            return `Couldn't retrieve reminders: ${error.message}`;
        }
    }
    
    async aboutSusan() {
        return `I'm ${this.brain.personality.name}, your AI assistant! I'm designed to be helpful, knowledgeable, and friendly. I can assist with various tasks including answering questions, helping with code, managing information, and having conversations. Think of me as your digital assistant, similar to JARVIS but with my own personality!`;
    }
    
    async listCapabilities() {
        const capabilities = [
            '🗣️ Voice conversation (speech-to-text and text-to-speech)',
            '💬 Natural language understanding and responses',
            '🕐 Time and date information',
            '📁 Basic file system operations',
            '🧮 Simple calculations',
            '📝 Setting and managing reminders',
            '💻 System information queries',
            '❓ Answering questions and providing information',
            '💡 Helping with coding and technical problems',
            '✍️ Writing and creative assistance',
            '🎯 Task breakdown and planning'
        ];
        
        return `My current capabilities include:\n\n${capabilities.join('\n')}\n\nI'm constantly learning and improving, so feel free to ask me about anything!`;
    }
    
    getCommandList() {
        const commandList = Array.from(this.commands.values())
            .map(cmd => `• ${cmd.trigger} - ${cmd.description}`)
            .join('\n');
            
        return `Available commands:\n${commandList}`;
    }
}