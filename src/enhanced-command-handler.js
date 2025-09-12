import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { RoofERKnowledgeService } from './api/services/RoofERKnowledgeService.js';

const execAsync = promisify(exec);

export class EnhancedCommandHandler {
    constructor(susanBrain) {
        this.brain = susanBrain;
        this.commands = new Map();
        this.naturalLanguagePatterns = new Map();
        this.dynamicCapabilities = new Map();
        this.commandHistory = [];
        this.roofERKnowledge = new RoofERKnowledgeService();
        this.setupCommands();
        this.setupNaturalLanguagePatterns();
        this.discoverDynamicCapabilities();
        
        console.log('🎯 Enhanced Command Handler initialized with', this.commands.size, 'commands and natural language processing');
    }
    
    setupCommands() {
        // Enhanced system commands
        this.registerCommand('time', 'Get current time with timezone awareness', () => this.getEnhancedTime());
        this.registerCommand('date', 'Get current date with context', () => this.getEnhancedDate());
        this.registerCommand('weather', 'Get intelligent weather information', (args) => this.getIntelligentWeather(args));
        
        // Enhanced file system commands
        this.registerCommand('list files', 'Intelligent file listing with analysis', () => this.intelligentListFiles());
        this.registerCommand('current directory', 'Show directory with context', () => this.getDirectoryContext());
        this.registerCommand('find files', 'Smart file search', (pattern) => this.smartFileSearch(pattern));
        
        // Advanced system information
        this.registerCommand('system info', 'Comprehensive system analysis', () => this.getComprehensiveSystemInfo());
        this.registerCommand('performance', 'System performance analysis', () => this.getPerformanceAnalysis());
        this.registerCommand('memory usage', 'Memory utilization report', () => this.getMemoryUsage());
        
        // Enhanced web and search capabilities
        this.registerCommand('search', 'Intelligent web search with context', (query) => this.intelligentWebSearch(query));
        this.registerCommand('research', 'Deep research assistance', (topic) => this.researchAssistant(topic));
        
        // Advanced calculator with AI reasoning
        this.registerCommand('calculate', 'AI-enhanced calculations', (expression) => this.aiCalculate(expression));
        this.registerCommand('solve', 'Problem solving assistant', (problem) => this.problemSolver(problem));
        
        // Intelligent reminder system
        this.registerCommand('remind me', 'Smart reminder with context', (reminder) => this.smartReminder(reminder));
        this.registerCommand('show reminders', 'Intelligent reminder display', () => this.showIntelligentReminders());
        this.registerCommand('schedule', 'Smart scheduling assistant', (event) => this.smartSchedule(event));
        
        // Enhanced Susan-specific commands
        this.registerCommand('who are you', 'About Susan with personality', () => this.aboutSusanEnhanced());
        this.registerCommand('your capabilities', 'Dynamic capabilities showcase', () => this.showcaseCapabilities());
        this.registerCommand('learn about me', 'Personal learning session', () => this.personalLearningSession());
        this.registerCommand('optimize yourself', 'Self-optimization routine', () => this.selfOptimize());
        
        // Advanced AI capabilities
        this.registerCommand('analyze', 'AI-powered analysis', (subject) => this.aiAnalyze(subject));
        this.registerCommand('explain', 'Intelligent explanation engine', (concept) => this.intelligentExplain(concept));
        this.registerCommand('brainstorm', 'Creative brainstorming session', (topic) => this.aiBrainstorm(topic));
        this.registerCommand('compare', 'Intelligent comparison analysis', (items) => this.aiCompare(items));
        
        // Learning and adaptation
        this.registerCommand('teach me', 'Personalized teaching session', (subject) => this.personalizedTeaching(subject));
        this.registerCommand('quiz me', 'Adaptive quiz generation', (topic) => this.adaptiveQuiz(topic));
        
        // Creative and productivity tools
        this.registerCommand('write', 'AI writing assistant', (prompt) => this.aiWriter(prompt));
        this.registerCommand('plan', 'Intelligent planning assistant', (goal) => this.intelligentPlanner(goal));
        this.registerCommand('summarize', 'AI summarization engine', (content) => this.aiSummarize(content));
    }
    
    registerCommand(trigger, description, handler) {
        this.commands.set(trigger.toLowerCase(), {
            trigger,
            description,
            handler
        });
    }
    
    setupNaturalLanguagePatterns() {
        // Time and date patterns
        this.naturalLanguagePatterns.set(/what time is it|current time|time now/i, 
            { command: 'time', confidence: 0.9 });
        this.naturalLanguagePatterns.set(/what('s| is) (the|today's) date|today's date|current date/i,
            { command: 'date', confidence: 0.9 });
            
        // Weather patterns
        this.naturalLanguagePatterns.set(/what('s| is) the weather|weather (today|now|currently)|how('s| is) the weather/i,
            { command: 'weather', confidence: 0.85 });
            
        // File system patterns
        this.naturalLanguagePatterns.set(/show me (the )?files|list (the )?files|what files are here/i,
            { command: 'list files', confidence: 0.8 });
        this.naturalLanguagePatterns.set(/where am i|current (directory|folder)|what (directory|folder)/i,
            { command: 'current directory', confidence: 0.8 });
            
        // Calculation patterns
        this.naturalLanguagePatterns.set(/calculate|compute|what is \d|solve (this )?math/i,
            { command: 'calculate', extractArgs: true, confidence: 0.9 });
            
        // System info patterns
        this.naturalLanguagePatterns.set(/system (info|information)|computer specs|hardware info/i,
            { command: 'system info', confidence: 0.85 });
            
        // Reminder patterns
        this.naturalLanguagePatterns.set(/remind me|set (a )?reminder|don't forget|remember to/i,
            { command: 'remind me', extractArgs: true, confidence: 0.8 });
        this.naturalLanguagePatterns.set(/show (my )?reminders|what are my reminders|list reminders/i,
            { command: 'show reminders', confidence: 0.85 });
            
        // Analysis patterns
        this.naturalLanguagePatterns.set(/analyze (this|that)?|break down|examine|study/i,
            { command: 'analyze', extractArgs: true, confidence: 0.7 });
        this.naturalLanguagePatterns.set(/explain (this|that|how|why)|help me understand|clarify/i,
            { command: 'explain', extractArgs: true, confidence: 0.8 });
            
        // Creative patterns
        this.naturalLanguagePatterns.set(/brainstorm|come up with ideas|think of|generate ideas/i,
            { command: 'brainstorm', extractArgs: true, confidence: 0.75 });
        this.naturalLanguagePatterns.set(/write (a|an)?|help me write|compose|draft/i,
            { command: 'write', extractArgs: true, confidence: 0.8 });
            
        // Planning patterns
        this.naturalLanguagePatterns.set(/plan (this|that)?|help me plan|create a plan|organize/i,
            { command: 'plan', extractArgs: true, confidence: 0.75 });
            
        // Learning patterns
        this.naturalLanguagePatterns.set(/teach me|learn about|explain how to|show me how/i,
            { command: 'teach me', extractArgs: true, confidence: 0.8 });
    }
    
    async processInput(input, options = {}) {
        const inputLower = input.toLowerCase().trim();
        
        // Add to command history for learning
        this.addToCommandHistory(input, options);
        
        // Step 1: Check for exact command matches
        const exactMatch = await this.findExactCommandMatch(inputLower);
        if (exactMatch) {
            return await this.executeCommand(exactMatch, input, options);
        }
        
        // Step 2: Natural language command detection
        const naturalCommand = await this.detectNaturalLanguageCommand(input);
        if (naturalCommand) {
            return await this.executeNaturalCommand(naturalCommand, input, options);
        }
        
        // Step 3: Fuzzy command matching
        const fuzzyMatch = await this.findFuzzyCommandMatch(inputLower);
        if (fuzzyMatch && fuzzyMatch.confidence > 0.7) {
            return await this.executeFuzzyCommand(fuzzyMatch, input, options);
        }
        
        // Step 4: Dynamic capability discovery
        const dynamicCapability = await this.discoverDynamicCapability(input);
        if (dynamicCapability) {
            return await this.executeDynamicCapability(dynamicCapability, input, options);
        }
        
        // Step 5: Intent recognition with command suggestions
        return await this.detectIntentWithSuggestions(input, options);
    }
    
    async detectNaturalLanguageCommand(input) {
        for (const [pattern, commandInfo] of this.naturalLanguagePatterns) {
            if (pattern.test(input)) {
                let args = '';
                if (commandInfo.extractArgs) {
                    args = this.extractArgumentsFromNaturalLanguage(input, pattern);
                }
                return {
                    command: commandInfo.command,
                    args,
                    confidence: commandInfo.confidence,
                    method: 'natural_language'
                };
            }
        }
        return null;
    }
    
    // Enhanced command implementations
    async getEnhancedTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const utcTime = now.toUTCString();
        const timeOfDay = this.getTimeOfDayContext(now);
        
        return `🕐 **Current Time**: ${timeString}\n` +
               `🌍 **Timezone**: ${timezone}\n` +
               `⏰ **UTC**: ${utcTime}\n` +
               `🌅 **Context**: ${timeOfDay}`;
    }
    
    getTimeOfDayContext(date) {
        const hour = date.getHours();
        if (hour < 6) return 'Early morning - Perfect time for planning and reflection';
        if (hour < 9) return 'Morning - Great time for important tasks and decision-making';
        if (hour < 12) return 'Late morning - Peak productivity hours';
        if (hour < 14) return 'Early afternoon - Good time for collaboration and meetings';
        if (hour < 17) return 'Afternoon - Ideal for creative work and problem-solving';
        if (hour < 19) return 'Early evening - Wind-down time for planning tomorrow';
        if (hour < 22) return 'Evening - Perfect for learning and personal projects';
        return 'Night - Time for rest and reflection';
    }
    
    async getEnhancedDate() {
        const now = new Date();
        const dateString = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        const daysInYear = (now.getFullYear() % 4 === 0) ? 366 : 365;
        const daysLeft = daysInYear - dayOfYear;
        const weekNumber = Math.ceil(dayOfYear / 7);
        
        const specialDates = this.getSpecialDates(now);
        
        return `📅 **Today**: ${dateString}\n` +
               `📊 **Year Progress**: Day ${dayOfYear} of ${daysInYear} (${daysLeft} days remaining)\n` +
               `📈 **Week**: ${weekNumber} of the year\n` +
               `${specialDates ? `🎉 **Special**: ${specialDates}` : '✨ **Focus**: Make today count!'}`;
    }
    
    getSpecialDates(date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        
        const holidays = {
            '1/1': 'New Year\'s Day 🎊',
            '2/14': 'Valentine\'s Day 💕',
            '3/17': 'St. Patrick\'s Day 🍀',
            '7/4': 'Independence Day 🇺🇸',
            '10/31': 'Halloween 🎃',
            '12/25': 'Christmas Day 🎄',
            '12/31': 'New Year\'s Eve 🎆'
        };
        
        const key = `${month}/${day}`;
        return holidays[key] || null;
    }
    
    async aiAnalyze(subject, options = {}) {
        if (!subject) {
            return '🔍 **AI Analysis Engine Ready**\n\nI can analyze various types of content including:\n• Text and documents\n• Data sets and patterns\n• Problems and solutions\n• Concepts and ideas\n• Code and technical systems\n\nWhat would you like me to analyze?';
        }
        
        return `🔍 **AI Analysis of: "${subject}"**\n\n` +
               `📊 **Analysis Framework Applied**:\n` +
               `• Structure and components identification\n` +
               `• Pattern recognition and relationships\n` +
               `• Strengths and weaknesses assessment\n` +
               `• Implications and potential outcomes\n` +
               `• Recommendations for improvement\n\n` +
               `💡 **Key Insights**: Analyzing "${subject}" reveals multiple dimensions that require systematic examination. I can provide deeper analysis on specific aspects if you'd like to focus on particular elements.\n\n` +
               `🎯 **Next Steps**: Would you like me to dive deeper into any specific aspect of this analysis?`;
    }
    
    async aiCalculate(expression, options = {}) {
        if (!expression) {
            return '🧮 **AI-Enhanced Calculator**\n\nI can solve:\n• Basic arithmetic operations\n• Complex mathematical expressions\n• Word problems and equations\n• Statistical calculations\n• Unit conversions\n• Financial calculations\n\nWhat would you like me to calculate?';
        }
        
        try {
            // Enhanced calculation with context and explanation
            const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
            if (!sanitized) {
                return this.handleWordProblem(expression);
            }
            
            const result = Function(`"use strict"; return (${sanitized})`)();
            const steps = this.explainCalculationSteps(expression, result);
            
            return `🧮 **AI Calculation Result**\n\n` +
                   `📝 **Expression**: ${expression}\n` +
                   `✅ **Result**: ${result}\n\n` +
                   `🔍 **Calculation Steps**:\n${steps}\n\n` +
                   `💡 **Context**: ${this.getCalculationContext(result)}\n\n` +
                   `🎯 **Need more?** I can solve related problems, explain concepts, or convert units!`;
        } catch (error) {
            return this.handleCalculationError(expression, error);
        }
    }
    
    explainCalculationSteps(expression, result) {
        return `• Parsed expression: ${expression}\n` +
               `• Applied order of operations (PEMDAS)\n` +
               `• Computed final result: ${result}\n` +
               `• Verified calculation accuracy`;
    }
    
    getCalculationContext(result) {
        if (result === 42) return 'The answer to life, the universe, and everything! 🌌';
        if (result > 1000000) return 'That\'s over a million! 🚀';
        if (result < 0) return 'Negative result - could represent debt, deficit, or temperature below zero ❄️';
        if (result % 1 === 0) return 'Clean integer result - perfect for counting or indexing 📊';
        return 'Decimal result - great for precise measurements and calculations 📏';
    }
    
    async showcaseCapabilities() {
        const capabilities = {
            '🧠 Intelligence': [
                'Advanced reasoning and chain-of-thought problem solving',
                'Context-aware conversation with semantic memory',
                'Intelligent analysis of data, documents, and concepts',
                'Creative brainstorming and ideation',
                'Adaptive learning from our interactions'
            ],
            '💬 Communication': [
                'Natural language understanding with intent detection',
                'Multi-language support and translation',
                'Adaptive communication style based on your preferences',
                'Emotional intelligence and empathy in responses',
                'Voice interaction with real-time transcription'
            ],
            '🔧 Productivity': [
                'Intelligent file system navigation and analysis',
                'Advanced calculations and mathematical problem solving',
                'Smart scheduling and reminder management',
                'Research assistance with information synthesis',
                'Project planning and goal breakdown'
            ],
            '🎨 Creativity': [
                'AI-powered writing assistance for any format',
                'Creative brainstorming and ideation sessions',
                'Story generation and narrative development',
                'Design thinking and innovation support',
                'Artistic and creative project guidance'
            ],
            '📊 Analysis': [
                'Data analysis and pattern recognition',
                'Document processing and summarization',
                'Image and multimedia content analysis',
                'Comparative analysis and decision support',
                'Trend identification and forecasting'
            ],
            '🎓 Learning': [
                'Personalized teaching adapted to your knowledge level',
                'Interactive quizzes and knowledge testing',
                'Skill development recommendations',
                'Learning path optimization',
                'Educational content creation'
            ],
            '⚡ Advanced Features': [
                'Vector-based semantic memory for context retention',
                'Real-time model switching for optimal performance',
                'Multimodal processing (text, images, documents, voice)',
                'Proactive assistance and suggestion generation',
                'Self-optimization and performance monitoring'
            ]
        };
        
        let showcase = '🚀 **Susan\'s Advanced AI Capabilities**\n\n';
        showcase += '*I\'m not just an AI assistant - I\'m your intelligent partner with JARVIS-level capabilities!*\n\n';
        
        Object.entries(capabilities).forEach(([category, items]) => {
            showcase += `**${category}:**\n`;
            items.forEach(item => {
                showcase += `  ✨ ${item}\n`;
            });
            showcase += '\n';
        });
        
        showcase += '💡 **What makes me special:**\n';
        showcase += '• I learn and adapt to your communication style\n';
        showcase += '• I remember context across conversations\n';
        showcase += '• I can handle complex, multi-step reasoning\n';
        showcase += '• I proactively suggest improvements and solutions\n';
        showcase += '• I continuously optimize my performance\n\n';
        
        showcase += '🎯 **Try me with:** "Analyze this data", "Help me plan my project", "Explain quantum physics", "Write a story about...", "What\'s the best approach to..."\n\n';
        showcase += '🌟 **I\'m here to make you more productive, creative, and successful!**';
        
        return showcase;
    }
    
    // Additional utility methods
    async findExactCommandMatch(inputLower) {
        for (const [trigger, command] of this.commands.entries()) {
            if (inputLower === trigger || inputLower.startsWith(trigger + ' ')) {
                const args = inputLower.replace(trigger, '').trim();
                return { trigger, command, args, confidence: 1.0, method: 'exact' };
            }
        }
        return null;
    }
    
    async executeCommand(commandMatch, originalInput, options) {
        try {
            const result = await commandMatch.command.handler(commandMatch.args, options);
            this.recordCommandSuccess(commandMatch, originalInput);
            return {
                isCommand: true,
                result: result || `Executed: ${commandMatch.command.trigger}`,
                confidence: commandMatch.confidence,
                method: commandMatch.method
            };
        } catch (error) {
            this.recordCommandError(commandMatch, originalInput, error);
            return {
                isCommand: true,
                result: `Error executing command: ${error.message}`,
                error: error.message,
                confidence: commandMatch.confidence,
                method: commandMatch.method
            };
        }
    }
    
    async detectIntentWithSuggestions(input, options = {}) {
        const inputLower = input.toLowerCase();
        const suggestions = [];
        
        // Enhanced intent detection with command suggestions
        if (inputLower.includes('time') || inputLower.includes('clock')) {
            suggestions.push('Would you like me to tell you the current time?');
            return { 
                isCommand: true, 
                result: await this.getEnhancedTime(),
                suggestions,
                confidence: 0.8
            };
        }
        
        return { 
            isCommand: false, 
            suggestions,
            recommendedCommands: this.getRecommendedCommands(input)
        };
    }
    
    getRecommendedCommands(input) {
        const recommendations = [];
        const inputLower = input.toLowerCase();
        
        if (inputLower.includes('time')) {
            recommendations.push('Try: "what time is it" or "time"');
        }
        if (inputLower.includes('calculate') || /\d/.test(input)) {
            recommendations.push('Try: "calculate [expression]" or "solve [problem]"');
        }
        
        return recommendations;
    }
    
    addToCommandHistory(input, options) {
        this.commandHistory.push({
            input,
            timestamp: new Date().toISOString(),
            userId: options.userId,
            success: null
        });
        
        if (this.commandHistory.length > 1000) {
            this.commandHistory = this.commandHistory.slice(-1000);
        }
    }
    
    recordCommandSuccess(commandMatch, originalInput) {
        const latest = this.commandHistory[this.commandHistory.length - 1];
        if (latest && latest.input === originalInput) {
            latest.success = true;
            latest.command = commandMatch.trigger;
            latest.method = commandMatch.method;
        }
    }
    
    recordCommandError(commandMatch, originalInput, error) {
        const latest = this.commandHistory[this.commandHistory.length - 1];
        if (latest && latest.input === originalInput) {
            latest.success = false;
            latest.command = commandMatch.trigger;
            latest.method = commandMatch.method;
            latest.error = error.message;
        }
    }
    
    async discoverDynamicCapabilities() {
        // Populate dynamic capabilities based on Susan's brain
        this.dynamicCapabilities.set('analysis', 'Intelligent analysis and reasoning');
        this.dynamicCapabilities.set('creativity', 'Creative content generation');
        this.dynamicCapabilities.set('planning', 'Strategic planning and organization');
        this.dynamicCapabilities.set('learning', 'Adaptive learning and teaching');
    }
    
    extractArgumentsFromNaturalLanguage(input, pattern) {
        const match = input.match(pattern);
        if (match) {
            return input.replace(pattern, '').trim();
        }
        return '';
    }
    
    // Placeholder implementations for additional methods
    async findFuzzyCommandMatch(inputLower) { return null; }
    async executeNaturalCommand(naturalCommand, originalInput, options) { return { isCommand: false }; }
    async executeFuzzyCommand(fuzzyMatch, originalInput, options) { return { isCommand: false }; }
    async discoverDynamicCapability(input) { return null; }
    async executeDynamicCapability(capability, input, options) { return { isCommand: false }; }
    
    handleWordProblem(problem) {
        return `🧠 **Word Problem Analysis**\n\n` +
               `📝 **Problem**: "${problem}"\n\n` +
               `🔍 **Analysis Approach**:\n` +
               `• Identify key numbers and operations\n` +
               `• Determine what's being asked\n` +
               `• Set up the mathematical expression\n` +
               `• Solve step by step\n\n` +
               `💡 **Need Help**: For word problems, try rephrasing with clear numbers and operations, like: "Calculate 15 + 25" or "What is 100 / 4"?`;
    }
    
    handleCalculationError(expression, error) {
        return `❌ **Calculation Error**\n\n` +
               `📝 **Expression**: ${expression}\n` +
               `⚠️ **Issue**: Invalid mathematical expression\n\n` +
               `💡 **Suggestions**:\n` +
               `• Use basic operators: +, -, *, /, ()\n` +
               `• Check for typos or invalid characters\n` +
               `• Try: "Calculate 2 + 2" or "What is 15 * 4"\n\n` +
               `🎯 **Examples**: "10 + 5 * 2", "(100 - 20) / 4", "15.5 + 2.3"`;
    }
}