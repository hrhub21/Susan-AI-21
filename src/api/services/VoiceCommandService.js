import { EventEmitter } from 'events';

/**
 * Voice Command Service for Susan AI
 * Advanced voice recognition and command processing for hands-free operation
 */
export class VoiceCommandService extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.isListening = false;
        this.recognition = null;
        this.synthesis = null;
        
        // Command registry
        this.commands = new Map();
        this.commandHistory = [];
        this.contextStack = [];
        
        // Voice settings
        this.settings = {
            language: 'en-US',
            continuous: true,
            interimResults: true,
            maxAlternatives: 3,
            confidenceThreshold: 0.7,
            voiceSpeed: 1.0,
            voicePitch: 1.0,
            volume: 0.8,
            autoStart: false,
            hotword: 'hey susan',
            confirmCommands: true,
            feedbackEnabled: true
        };
        
        // Command categories
        this.commandCategories = {
            navigation: {
                name: 'Navigation',
                icon: 'navigation',
                commands: ['go to', 'open', 'navigate', 'show me', 'switch to']
            },
            photo: {
                name: 'Photo Commands',
                icon: 'camera',
                commands: ['take photo', 'capture', 'analyze image', 'save photo', 'delete photo']
            },
            claim: {
                name: 'Claim Management',
                icon: 'assignment',
                commands: ['create claim', 'update claim', 'save claim', 'submit claim', 'view claim']
            },
            analysis: {
                name: 'AI Analysis',
                icon: 'psychology',
                commands: ['analyze damage', 'count impacts', 'measure', 'calculate', 'assess']
            },
            dictation: {
                name: 'Dictation',
                icon: 'record_voice_over',
                commands: ['note', 'dictate', 'add comment', 'record', 'write down']
            },
            system: {
                name: 'System Control',
                icon: 'settings_voice',
                commands: ['help', 'repeat', 'cancel', 'stop', 'settings', 'volume']
            }
        };
        
        // Natural language patterns
        this.patterns = {
            // Navigation patterns
            'go_to': /(?:go to|open|navigate to|show me|switch to)\s+(.+)/i,
            'back': /(?:go back|back|previous|return)/i,
            
            // Photo patterns
            'take_photo': /(?:take (?:a )?photo|capture (?:image|photo)|snap (?:a )?picture)/i,
            'analyze_photo': /(?:analyze|assess|examine|inspect)\s+(?:this )?(?:photo|image|picture|damage)/i,
            'save_photo': /(?:save|keep|store)\s+(?:this )?(?:photo|image|picture)/i,
            'delete_photo': /(?:delete|remove|discard)\s+(?:this )?(?:photo|image|picture)/i,
            
            // Claim patterns
            'create_claim': /(?:create|new|start|begin)\s+(?:a )?claim/i,
            'save_claim': /(?:save|store|keep)\s+(?:this )?claim/i,
            'submit_claim': /(?:submit|send|file)\s+(?:this )?claim/i,
            
            // Analysis patterns
            'count_impacts': /(?:count|how many)\s+(?:impacts|hits|damage|marks)/i,
            'measure_damage': /(?:measure|calculate|assess)\s+(?:damage|area|size)/i,
            'analyze_damage': /(?:analyze|assess|examine|inspect)\s+(?:damage|roof|surface)/i,
            
            // Dictation patterns
            'add_note': /(?:add note|note|write down|record)\s+(.+)/i,
            'add_comment': /(?:add comment|comment)\s+(.+)/i,
            
            // System patterns
            'help': /(?:help|what can you do|commands|assistance)/i,
            'repeat': /(?:repeat|say again|what did you say)/i,
            'cancel': /(?:cancel|stop|nevermind|abort)/i,
            'volume_up': /(?:volume up|louder|increase volume)/i,
            'volume_down': /(?:volume down|quieter|decrease volume)/i,
            
            // Numbers and measurements
            'number': /(\d+(?:\.\d+)?)/g,
            'measurement': /(\d+(?:\.\d+)?)\s*(?:feet|foot|ft|inches|inch|in|meters|meter|m|centimeters|cm)/gi,
            'percentage': /(\d+(?:\.\d+)?)\s*(?:percent|%)/gi
        };
        
        // Context-aware responses
        this.contextResponses = {
            photo_capture: {
                success: ["Photo captured successfully", "Image saved", "Picture taken"],
                error: ["Could not take photo", "Camera error", "Photo capture failed"]
            },
            claim_creation: {
                success: ["Claim created", "New claim started", "Claim initialized"],
                error: ["Could not create claim", "Claim creation failed", "Error starting claim"]
            },
            analysis: {
                success: ["Analysis complete", "Assessment finished", "Inspection done"],
                error: ["Analysis failed", "Could not analyze", "Assessment error"]
            }
        };
        
        // Voice feedback phrases
        this.feedbackPhrases = {
            listening: ["I'm listening", "Go ahead", "What can I help you with?"],
            processing: ["Processing", "Working on it", "Just a moment"],
            confirmation: ["Okay", "Got it", "Done", "Completed"],
            error: ["Sorry, I didn't understand", "Could you repeat that?", "I'm not sure what you mean"],
            help: ["You can say things like 'take a photo', 'create a claim', or 'analyze damage'"]
        };
        
        this.initialize();
    }

    async initialize() {
        try {
            console.log('🎤 Initializing Voice Command Service...');
            
            // Check browser support
            this.checkBrowserSupport();
            
            // Initialize speech recognition
            this.initializeSpeechRecognition();
            
            // Initialize speech synthesis
            this.initializeSpeechSynthesis();
            
            // Register default commands
            this.registerDefaultCommands();
            
            // Setup hotword detection
            this.setupHotwordDetection();
            
            this.isInitialized = true;
            console.log('✅ Voice Command Service initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize voice command service:', error);
            throw error;
        }
    }

    checkBrowserSupport() {
        // Check for Speech Recognition API
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            throw new Error('Speech Recognition API not supported in this browser');
        }
        
        // Check for Speech Synthesis API
        if (!('speechSynthesis' in window)) {
            console.warn('⚠️ Speech Synthesis API not supported - voice feedback disabled');
        }
        
        console.log('✅ Browser voice APIs supported');
    }

    initializeSpeechRecognition() {
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            // Configure recognition
            this.recognition.continuous = this.settings.continuous;
            this.recognition.interimResults = this.settings.interimResults;
            this.recognition.lang = this.settings.language;
            this.recognition.maxAlternatives = this.settings.maxAlternatives;
            
            // Setup event handlers
            this.recognition.onstart = () => {
                this.isListening = true;
                this.emit('listeningStarted');
                console.log('🎤 Voice recognition started');
                
                if (this.settings.feedbackEnabled) {
                    this.speak(this.getRandomPhrase('listening'));
                }
            };
            
            this.recognition.onend = () => {
                this.isListening = false;
                this.emit('listeningEnded');
                console.log('🎤 Voice recognition ended');
            };
            
            this.recognition.onresult = (event) => {
                this.handleSpeechResult(event);
            };
            
            this.recognition.onerror = (event) => {
                this.handleSpeechError(event);
            };
            
            console.log('✅ Speech recognition initialized');
            
        } catch (error) {
            console.error('❌ Error initializing speech recognition:', error);
            throw error;
        }
    }

    initializeSpeechSynthesis() {
        try {
            if ('speechSynthesis' in window) {
                this.synthesis = window.speechSynthesis;
                
                // Wait for voices to load
                if (this.synthesis.getVoices().length === 0) {
                    this.synthesis.onvoiceschanged = () => {
                        console.log('🔊 Speech synthesis voices loaded');
                    };
                }
                
                console.log('✅ Speech synthesis initialized');
            }
        } catch (error) {
            console.error('❌ Error initializing speech synthesis:', error);
        }
    }

    registerDefaultCommands() {
        // Navigation commands
        this.registerCommand('go_to_dashboard', {
            patterns: ['go to dashboard', 'show dashboard', 'open dashboard'],
            handler: () => this.executeNavigation('/dashboard'),
            description: 'Navigate to the main dashboard'
        });
        
        this.registerCommand('go_to_claims', {
            patterns: ['go to claims', 'show claims', 'open claims'],
            handler: () => this.executeNavigation('/claims'),
            description: 'Navigate to claims management'
        });
        
        // Photo commands
        this.registerCommand('take_photo', {
            patterns: ['take photo', 'capture image', 'snap picture'],
            handler: (context) => this.executeTakePhoto(context),
            description: 'Take a photo with the camera'
        });
        
        this.registerCommand('analyze_current_photo', {
            patterns: ['analyze photo', 'analyze image', 'inspect damage'],
            handler: (context) => this.executeAnalyzePhoto(context),
            description: 'Analyze the current photo for damage'
        });
        
        // Claim commands
        this.registerCommand('create_new_claim', {
            patterns: ['create claim', 'new claim', 'start claim'],
            handler: (context) => this.executeCreateClaim(context),
            description: 'Create a new insurance claim'
        });
        
        this.registerCommand('save_current_claim', {
            patterns: ['save claim', 'store claim'],
            handler: (context) => this.executeSaveClaim(context),
            description: 'Save the current claim'
        });
        
        // Analysis commands
        this.registerCommand('count_damage_impacts', {
            patterns: ['count impacts', 'how many impacts', 'count damage'],
            handler: (context) => this.executeCountImpacts(context),
            description: 'Count damage impacts in the current photo'
        });
        
        this.registerCommand('measure_damage_area', {
            patterns: ['measure damage', 'calculate area', 'assess size'],
            handler: (context) => this.executeMeasureDamage(context),
            description: 'Measure the damage area'
        });
        
        // Dictation commands
        this.registerCommand('add_voice_note', {
            patterns: ['add note', 'voice note', 'dictate note'],
            handler: (context, text) => this.executeAddNote(context, text),
            description: 'Add a voice note to the current item',
            expectsText: true
        });
        
        // System commands
        this.registerCommand('show_help', {
            patterns: ['help', 'what can you do', 'commands'],
            handler: () => this.executeShowHelp(),
            description: 'Show available voice commands'
        });
        
        this.registerCommand('repeat_last', {
            patterns: ['repeat', 'say again', 'what'],
            handler: () => this.executeRepeatLast(),
            description: 'Repeat the last response'
        });
        
        console.log(`✅ Registered ${this.commands.size} default commands`);
    }

    registerCommand(id, config) {
        const command = {
            id,
            patterns: config.patterns || [],
            handler: config.handler,
            description: config.description || '',
            category: config.category || 'general',
            expectsText: config.expectsText || false,
            requiresConfirmation: config.requiresConfirmation || false,
            contextRequired: config.contextRequired || null,
            enabled: config.enabled !== false
        };
        
        this.commands.set(id, command);
        console.log(`📝 Registered voice command: ${id}`);
    }

    setupHotwordDetection() {
        if (this.settings.hotword && this.settings.autoStart) {
            // In a production environment, this would use a hotword detection library
            // For now, we'll simulate it with a simple pattern match
            console.log(`🔥 Hotword detection setup for: "${this.settings.hotword}"`);
        }
    }

    // Speech Recognition Handlers
    handleSpeechResult(event) {
        const results = Array.from(event.results);
        const latestResult = results[results.length - 1];
        
        if (latestResult.isFinal) {
            const transcript = latestResult[0].transcript.trim();
            const confidence = latestResult[0].confidence;
            
            console.log(`🎤 Speech recognized: "${transcript}" (confidence: ${confidence.toFixed(2)})`);
            
            if (confidence >= this.settings.confidenceThreshold) {
                this.processVoiceCommand(transcript, confidence);
            } else {
                this.handleLowConfidence(transcript, confidence);
            }
        } else {
            // Handle interim results for real-time feedback
            const interimTranscript = latestResult[0].transcript;
            this.emit('interimResult', interimTranscript);
        }
    }

    handleSpeechError(event) {
        console.error('❌ Speech recognition error:', event.error);
        
        const errorMessages = {
            'no-speech': 'No speech detected. Please try again.',
            'audio-capture': 'Audio capture failed. Check your microphone.',
            'not-allowed': 'Microphone access denied. Please enable microphone permissions.',
            'network': 'Network error during speech recognition.',
            'service-not-allowed': 'Speech recognition service not allowed.',
            'bad-grammar': 'Speech recognition grammar error.',
            'language-not-supported': 'Language not supported for speech recognition.'
        };
        
        const errorMessage = errorMessages[event.error] || 'Unknown speech recognition error';
        
        this.emit('speechError', {
            error: event.error,
            message: errorMessage
        });
        
        if (this.settings.feedbackEnabled) {
            this.speak(errorMessage);
        }
    }

    handleLowConfidence(transcript, confidence) {
        console.warn(`⚠️ Low confidence speech: "${transcript}" (${confidence.toFixed(2)})`);
        
        if (this.settings.feedbackEnabled) {
            this.speak("I'm not sure I understood that. Could you repeat it?");
        }
        
        this.emit('lowConfidence', { transcript, confidence });
    }

    // Command Processing
    async processVoiceCommand(transcript, confidence) {
        try {
            // Add to history
            this.addToHistory(transcript, confidence);
            
            // Find matching command
            const matchedCommand = this.findMatchingCommand(transcript);
            
            if (matchedCommand) {
                await this.executeCommand(matchedCommand, transcript);
            } else {
                await this.handleUnknownCommand(transcript);
            }
            
        } catch (error) {
            console.error('❌ Error processing voice command:', error);
            this.speak('Sorry, there was an error processing your command.');
        }
    }

    findMatchingCommand(transcript) {
        const lowerTranscript = transcript.toLowerCase();
        
        for (const [id, command] of this.commands.entries()) {
            if (!command.enabled) continue;
            
            // Check pattern matches
            for (const pattern of command.patterns) {
                if (typeof pattern === 'string') {
                    if (lowerTranscript.includes(pattern.toLowerCase())) {
                        return { id, command, match: pattern, transcript };
                    }
                } else if (pattern instanceof RegExp) {
                    const match = lowerTranscript.match(pattern);
                    if (match) {
                        return { id, command, match: match[0], transcript, groups: match };
                    }
                }
            }
            
            // Check natural language patterns
            for (const [patternName, regex] of Object.entries(this.patterns)) {
                const match = lowerTranscript.match(regex);
                if (match && this.isCommandRelated(id, patternName)) {
                    return { id, command, match: match[0], transcript, groups: match };
                }
            }
        }
        
        return null;
    }

    isCommandRelated(commandId, patternName) {
        // Map patterns to command IDs
        const patternCommandMap = {
            'go_to': ['go_to_dashboard', 'go_to_claims'],
            'take_photo': ['take_photo'],
            'analyze_photo': ['analyze_current_photo'],
            'create_claim': ['create_new_claim'],
            'save_claim': ['save_current_claim'],
            'count_impacts': ['count_damage_impacts'],
            'measure_damage': ['measure_damage_area'],
            'add_note': ['add_voice_note'],
            'help': ['show_help'],
            'repeat': ['repeat_last']
        };
        
        return patternCommandMap[patternName]?.includes(commandId) || false;
    }

    async executeCommand(matchedCommand, originalTranscript) {
        const { id, command, match, groups } = matchedCommand;
        
        console.log(`🎯 Executing command: ${id}`);
        
        // Check context requirements
        if (command.contextRequired && !this.hasRequiredContext(command.contextRequired)) {
            this.speak(`This command requires ${command.contextRequired} context.`);
            return;
        }
        
        // Request confirmation if needed
        if (command.requiresConfirmation && this.settings.confirmCommands) {
            const confirmed = await this.requestConfirmation(command.description);
            if (!confirmed) {
                this.speak('Command cancelled.');
                return;
            }
        }
        
        // Provide processing feedback
        if (this.settings.feedbackEnabled) {
            this.speak(this.getRandomPhrase('processing'));
        }
        
        try {
            // Get current context
            const context = this.getCurrentContext();
            
            // Extract text for commands that expect it
            let extractedText = null;
            if (command.expectsText && groups && groups.length > 1) {
                extractedText = groups[1].trim();
            }
            
            // Execute the command
            const result = await command.handler(context, extractedText, originalTranscript);
            
            // Handle result
            this.handleCommandResult(result, command);
            
        } catch (error) {
            console.error(`❌ Command execution failed: ${id}`, error);
            this.speak('Sorry, the command failed to execute.');
            
            this.emit('commandError', {
                commandId: id,
                error: error.message
            });
        }
    }

    async handleUnknownCommand(transcript) {
        console.log(`❓ Unknown command: "${transcript}"`);
        
        // Try to find similar commands
        const suggestions = this.findSimilarCommands(transcript);
        
        let response = this.getRandomPhrase('error');
        
        if (suggestions.length > 0) {
            response += ` Did you mean "${suggestions[0]}"?`;
        } else {
            response += ' ' + this.getRandomPhrase('help');
        }
        
        this.speak(response);
        
        this.emit('unknownCommand', {
            transcript,
            suggestions
        });
    }

    findSimilarCommands(transcript) {
        // Simple similarity matching - in production would use better algorithms
        const similarities = [];
        
        for (const [id, command] of this.commands.entries()) {
            for (const pattern of command.patterns) {
                if (typeof pattern === 'string') {
                    const similarity = this.calculateSimilarity(transcript.toLowerCase(), pattern.toLowerCase());
                    if (similarity > 0.6) {
                        similarities.push({ pattern, similarity });
                    }
                }
            }
        }
        
        return similarities
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 3)
            .map(s => s.pattern);
    }

    calculateSimilarity(str1, str2) {
        // Simple Levenshtein distance based similarity
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    // Command Implementations
    async executeNavigation(path) {
        // Emit navigation event for the UI to handle
        this.emit('navigate', { path });
        this.speak(`Navigating to ${path.replace('/', '')}`);
        return { success: true, action: 'navigation', path };
    }

    async executeTakePhoto(context) {
        // Emit photo capture event
        this.emit('takePhoto', context);
        this.speak('Taking photo');
        return { success: true, action: 'photo_capture' };
    }

    async executeAnalyzePhoto(context) {
        // Emit photo analysis event
        this.emit('analyzePhoto', context);
        this.speak('Analyzing photo for damage');
        return { success: true, action: 'photo_analysis' };
    }

    async executeCreateClaim(context) {
        // Emit claim creation event
        this.emit('createClaim', context);
        this.speak('Creating new claim');
        return { success: true, action: 'claim_creation' };
    }

    async executeSaveClaim(context) {
        // Emit claim save event
        this.emit('saveClaim', context);
        this.speak('Saving claim');
        return { success: true, action: 'claim_save' };
    }

    async executeCountImpacts(context) {
        // Emit impact counting event
        this.emit('countImpacts', context);
        this.speak('Counting damage impacts');
        return { success: true, action: 'count_impacts' };
    }

    async executeMeasureDamage(context) {
        // Emit damage measurement event
        this.emit('measureDamage', context);
        this.speak('Measuring damage area');
        return { success: true, action: 'measure_damage' };
    }

    async executeAddNote(context, text) {
        if (!text) {
            this.speak('What would you like to note?');
            return { success: false, action: 'add_note', error: 'No text provided' };
        }
        
        // Emit note addition event
        this.emit('addNote', { context, text });
        this.speak('Note added');
        return { success: true, action: 'add_note', text };
    }

    async executeShowHelp() {
        const helpText = 'You can say commands like: take photo, create claim, analyze damage, count impacts, or navigate to dashboard.';
        this.speak(helpText);
        this.emit('showHelp');
        return { success: true, action: 'show_help' };
    }

    async executeRepeatLast() {
        if (this.lastResponse) {
            this.speak(this.lastResponse);
            return { success: true, action: 'repeat_last' };
        } else {
            this.speak('Nothing to repeat');
            return { success: false, action: 'repeat_last', error: 'No previous response' };
        }
    }

    // Speech Synthesis
    speak(text, options = {}) {
        if (!this.synthesis || !this.settings.feedbackEnabled) {
            return;
        }
        
        try {
            // Cancel any ongoing speech
            this.synthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Configure voice
            utterance.rate = options.speed || this.settings.voiceSpeed;
            utterance.pitch = options.pitch || this.settings.voicePitch;
            utterance.volume = options.volume || this.settings.volume;
            utterance.lang = options.language || this.settings.language;
            
            // Select voice
            const voices = this.synthesis.getVoices();
            const selectedVoice = voices.find(voice => 
                voice.lang === utterance.lang && 
                (voice.name.includes('Google') || voice.name.includes('Natural'))
            ) || voices[0];
            
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }
            
            // Setup events
            utterance.onstart = () => {
                this.emit('speechStart', text);
            };
            
            utterance.onend = () => {
                this.emit('speechEnd', text);
            };
            
            utterance.onerror = (event) => {
                console.error('❌ Speech synthesis error:', event.error);
                this.emit('speechError', event);
            };
            
            // Speak
            this.synthesis.speak(utterance);
            this.lastResponse = text;
            
            console.log(`🔊 Speaking: "${text}"`);
            
        } catch (error) {
            console.error('❌ Error in speech synthesis:', error);
        }
    }

    // Utility Methods
    getRandomPhrase(category) {
        const phrases = this.feedbackPhrases[category];
        if (!phrases || phrases.length === 0) return '';
        return phrases[Math.floor(Math.random() * phrases.length)];
    }

    getCurrentContext() {
        return {
            currentPage: window.location.pathname,
            timestamp: new Date().toISOString(),
            contextStack: [...this.contextStack]
        };
    }

    hasRequiredContext(contextType) {
        return this.contextStack.some(ctx => ctx.type === contextType);
    }

    addToHistory(transcript, confidence) {
        this.commandHistory.push({
            transcript,
            confidence,
            timestamp: new Date().toISOString()
        });
        
        // Keep only recent history
        if (this.commandHistory.length > 100) {
            this.commandHistory.shift();
        }
    }

    handleCommandResult(result, command) {
        if (result && result.success) {
            const responses = this.contextResponses[result.action];
            if (responses && responses.success) {
                this.speak(this.getRandomFromArray(responses.success));
            } else {
                this.speak(this.getRandomPhrase('confirmation'));
            }
        } else {
            const responses = this.contextResponses[result?.action];
            if (responses && responses.error) {
                this.speak(this.getRandomFromArray(responses.error));
            } else {
                this.speak(this.getRandomPhrase('error'));
            }
        }
        
        this.emit('commandResult', { result, command });
    }

    getRandomFromArray(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    async requestConfirmation(description) {
        return new Promise((resolve) => {
            this.speak(`Are you sure you want to ${description}? Say yes or no.`);
            
            // Set up temporary confirmation listener
            const confirmationTimeout = setTimeout(() => {
                this.speak('Confirmation timeout. Command cancelled.');
                resolve(false);
            }, 10000);
            
            const handleConfirmation = (transcript) => {
                const response = transcript.toLowerCase();
                if (response.includes('yes') || response.includes('confirm') || response.includes('okay')) {
                    clearTimeout(confirmationTimeout);
                    resolve(true);
                } else if (response.includes('no') || response.includes('cancel') || response.includes('abort')) {
                    clearTimeout(confirmationTimeout);
                    resolve(false);
                }
            };
            
            this.once('speechResult', handleConfirmation);
        });
    }

    // Public Control Methods
    startListening() {
        if (!this.isInitialized) {
            throw new Error('Voice command service not initialized');
        }
        
        if (this.isListening) {
            console.log('⚠️ Already listening');
            return;
        }
        
        try {
            this.recognition.start();
        } catch (error) {
            console.error('❌ Error starting voice recognition:', error);
            throw error;
        }
    }

    stopListening() {
        if (this.isListening && this.recognition) {
            this.recognition.stop();
        }
    }

    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    setVolume(level) {
        this.settings.volume = Math.max(0, Math.min(1, level));
        this.speak(`Volume set to ${Math.round(this.settings.volume * 100)} percent`);
    }

    setLanguage(language) {
        this.settings.language = language;
        if (this.recognition) {
            this.recognition.lang = language;
        }
        this.speak(`Language changed to ${language}`);
    }

    enableFeedback() {
        this.settings.feedbackEnabled = true;
        this.speak('Voice feedback enabled');
    }

    disableFeedback() {
        this.settings.feedbackEnabled = false;
    }

    // Command Management
    enableCommand(commandId) {
        const command = this.commands.get(commandId);
        if (command) {
            command.enabled = true;
            console.log(`✅ Enabled command: ${commandId}`);
        }
    }

    disableCommand(commandId) {
        const command = this.commands.get(commandId);
        if (command) {
            command.enabled = false;
            console.log(`❌ Disabled command: ${commandId}`);
        }
    }

    getAvailableCommands() {
        return Array.from(this.commands.entries())
            .filter(([id, command]) => command.enabled)
            .map(([id, command]) => ({
                id,
                patterns: command.patterns,
                description: command.description,
                category: command.category
            }));
    }

    getCommandHistory(limit = 20) {
        return this.commandHistory.slice(-limit);
    }

    clearCommandHistory() {
        this.commandHistory = [];
        console.log('🧹 Command history cleared');
    }

    // Settings Management
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        
        // Apply settings to recognition if initialized
        if (this.recognition) {
            this.recognition.continuous = this.settings.continuous;
            this.recognition.interimResults = this.settings.interimResults;
            this.recognition.lang = this.settings.language;
            this.recognition.maxAlternatives = this.settings.maxAlternatives;
        }
        
        console.log('⚙️ Voice settings updated');
    }

    getSettings() {
        return { ...this.settings };
    }

    // Status and Diagnostics
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isListening: this.isListening,
            supportsSpeechRecognition: !!this.recognition,
            supportsSpeechSynthesis: !!this.synthesis,
            commandCount: this.commands.size,
            historyCount: this.commandHistory.length,
            settings: this.settings
        };
    }
}

export default VoiceCommandService;