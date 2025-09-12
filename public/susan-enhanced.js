/**
 * Enhanced Susan AI v2.0 - Premium Voice Assistant Interface
 * Advanced modular architecture with state management, performance optimization, and modern UX
 */

// Enhanced State Manager with Event System
class StateManager {
    constructor() {
        this.state = new Map();
        this.listeners = new Map();
        this.history = [];
        this.maxHistorySize = 100;
    }

    set(key, value) {
        const oldValue = this.state.get(key);
        this.state.set(key, value);
        
        // Add to history
        this.history.push({
            key,
            oldValue,
            newValue: value,
            timestamp: Date.now()
        });
        
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
        
        // Emit change event
        this.emit(`${key}:changed`, { oldValue, newValue: value });
        this.emit('state:changed', { key, oldValue, newValue: value });
    }

    get(key, defaultValue = undefined) {
        return this.state.has(key) ? this.state.get(key) : defaultValue;
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    getHistory() {
        return [...this.history];
    }

    clear() {
        this.state.clear();
        this.history.length = 0;
        this.emit('state:cleared');
    }
}

// Enhanced Performance Monitor
class PerformanceMonitor {
    constructor(susan) {
        this.susan = susan;
        this.metrics = new Map();
        this.observers = new Map();
        this.isEnabled = true;
    }

    async init() {
        if (!this.isEnabled) return;

        // Initialize Performance Observer
        if ('PerformanceObserver' in window) {
            this.initPerformanceObserver();
        }

        // Monitor core web vitals
        this.initWebVitals();
        
        // Monitor memory usage
        this.initMemoryMonitor();
        
        // Monitor frame rate
        this.initFrameRateMonitor();

        console.log('Performance monitoring initialized');
    }

    initPerformanceObserver() {
        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.recordMetric(entry.name, entry.duration, entry.entryType);
                }
            });

            observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
            this.observers.set('performance', observer);
        } catch (error) {
            console.warn('PerformanceObserver not supported:', error);
        }
    }

    initWebVitals() {
        // Monitor Largest Contentful Paint (LCP)
        if ('PerformanceObserver' in window) {
            const lcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                this.recordMetric('LCP', lastEntry.startTime, 'web-vital');
            });

            try {
                lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
                this.observers.set('lcp', lcpObserver);
            } catch (error) {
                console.warn('LCP monitoring not supported:', error);
            }
        }
    }

    initMemoryMonitor() {
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                this.recordMetric('memory-used', memory.usedJSHeapSize, 'memory');
                this.recordMetric('memory-total', memory.totalJSHeapSize, 'memory');
                this.recordMetric('memory-limit', memory.jsHeapSizeLimit, 'memory');
            }, 10000); // Every 10 seconds
        }
    }

    initFrameRateMonitor() {
        let frames = 0;
        let lastTime = performance.now();

        const measureFrameRate = () => {
            frames++;
            const currentTime = performance.now();
            
            if (currentTime - lastTime >= 1000) {
                const fps = Math.round((frames * 1000) / (currentTime - lastTime));
                this.recordMetric('fps', fps, 'performance');
                frames = 0;
                lastTime = currentTime;
            }

            requestAnimationFrame(measureFrameRate);
        };

        requestAnimationFrame(measureFrameRate);
    }

    recordMetric(name, value, type = 'performance') {
        const timestamp = Date.now();
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }

        const metricHistory = this.metrics.get(name);
        metricHistory.push({ value, timestamp, type });

        // Keep only last 100 measurements
        if (metricHistory.length > 100) {
            metricHistory.shift();
        }

        // Emit performance event
        this.susan.state.emit('performance:metric', { name, value, type, timestamp });
    }

    getMetric(name) {
        return this.metrics.get(name) || [];
    }

    getAverageMetric(name, timeWindow = 60000) {
        const metric = this.getMetric(name);
        const cutoff = Date.now() - timeWindow;
        const recentValues = metric
            .filter(m => m.timestamp > cutoff)
            .map(m => m.value);

        if (recentValues.length === 0) return null;
        return recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    }

    getPerformanceReport() {
        const report = {
            timestamp: Date.now(),
            metrics: {},
            webVitals: {},
            memory: {},
            system: {}
        };

        // Collect all metrics
        for (const [name, values] of this.metrics) {
            const latest = values[values.length - 1];
            const average = this.getAverageMetric(name);
            
            report.metrics[name] = {
                current: latest?.value,
                average,
                history: values.slice(-10) // Last 10 measurements
            };
        }

        return report;
    }

    startMeasure(name) {
        if ('performance' in window && 'mark' in performance) {
            performance.mark(`${name}-start`);
        }
    }

    endMeasure(name) {
        if ('performance' in window && 'mark' in performance && 'measure' in performance) {
            try {
                performance.mark(`${name}-end`);
                performance.measure(name, `${name}-start`, `${name}-end`);
            } catch (error) {
                console.warn(`Failed to measure ${name}:`, error);
            }
        }
    }
}

// Enhanced Base Component Class
class BaseComponent {
    constructor(susan, name) {
        this.susan = susan;
        this.name = name;
        this.isInitialized = false;
        this.elements = new Map();
        this.eventListeners = new Map();
        this.config = new Map();
    }

    async init() {
        if (this.isInitialized) return;
        
        this.susan.performance?.startMeasure(`${this.name}-init`);
        
        try {
            await this.initElements();
            await this.bindEvents();
            await this.loadConfig();
            
            this.isInitialized = true;
            this.susan.state.emit(`${this.name}:initialized`);
            
            console.log(`${this.name} component initialized`);
        } catch (error) {
            console.error(`Failed to initialize ${this.name} component:`, error);
            throw error;
        } finally {
            this.susan.performance?.endMeasure(`${this.name}-init`);
        }
    }

    async initElements() {
        // Override in subclasses
    }

    async bindEvents() {
        // Override in subclasses
    }

    async loadConfig() {
        // Load component-specific configuration
        const savedConfig = localStorage.getItem(`susan-${this.name}-config`);
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                for (const [key, value] of Object.entries(config)) {
                    this.config.set(key, value);
                }
            } catch (error) {
                console.warn(`Failed to load ${this.name} config:`, error);
            }
        }
    }

    saveConfig() {
        const configObj = {};
        for (const [key, value] of this.config) {
            configObj[key] = value;
        }
        localStorage.setItem(`susan-${this.name}-config`, JSON.stringify(configObj));
    }

    getElement(id) {
        if (!this.elements.has(id)) {
            const element = document.getElementById(id);
            if (element) {
                this.elements.set(id, element);
            }
        }
        return this.elements.get(id);
    }

    addEventListener(element, event, handler) {
        if (typeof element === 'string') {
            element = this.getElement(element);
        }
        
        if (element) {
            element.addEventListener(event, handler);
            
            // Store for cleanup
            const key = `${element.id || 'element'}-${event}`;
            if (!this.eventListeners.has(key)) {
                this.eventListeners.set(key, []);
            }
            this.eventListeners.get(key).push({ element, event, handler });
        }
    }

    destroy() {
        // Clean up event listeners
        for (const [key, listeners] of this.eventListeners) {
            listeners.forEach(({ element, event, handler }) => {
                element.removeEventListener(event, handler);
            });
        }
        
        this.eventListeners.clear();
        this.elements.clear();
        this.isInitialized = false;
        
        this.susan.state.emit(`${this.name}:destroyed`);
    }
}

// Enhanced Susan AI Main Class
class SusanAI {
    constructor() {
        // Initialize enhanced state management
        this.state = new StateManager();
        
        // Initialize performance monitoring
        this.performance = new PerformanceMonitor(this);
        
        // Initialize enhanced component system
        this.components = new Map();
        
        // Legacy compatibility properties
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.ws = null;
        this.audioCanvas = null;
        this.canvasCtx = null;
        this.animationId = null;
        
        // Enhanced application state
        this.appState = {
            isInitialized: false,
            currentTheme: localStorage.getItem('susan-theme') || 'dark',
            isListening: false,
            isSpeaking: false,
            isThinking: false,
            isConnected: false,
            lastActivity: Date.now(),
            sessionId: this.generateSessionId(),
            version: '2.0.0'
        };
        
        // Initialize settings with enhanced defaults
        this.settings = {
            voiceSpeed: parseFloat(localStorage.getItem('susan-voice-speed')) || 1.0,
            voicePitch: parseFloat(localStorage.getItem('susan-voice-pitch')) || 1.0,
            voiceVolume: parseFloat(localStorage.getItem('susan-voice-volume')) || 0.8,
            animationsEnabled: localStorage.getItem('susan-animations') !== 'false',
            particlesEnabled: localStorage.getItem('susan-particles') !== 'false',
            autoSpeak: localStorage.getItem('susan-auto-speak') !== 'false',
            recognitionEngine: localStorage.getItem('susan-recognition-engine') || 'whisper',
            noiseSuppression: localStorage.getItem('susan-noise-suppression') !== 'false',
            smartSuggestions: localStorage.getItem('susan-smart-suggestions') !== 'false',
            contextMemory: localStorage.getItem('susan-context-memory') !== 'false',
            saveConversations: localStorage.getItem('susan-save-conversations') !== 'false'
        };
        
        // Enhanced activity tracking
        this.activityLog = [];
        this.maxActivityItems = 150;
        
        // Initialize the application
        this.init();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    async init() {
        try {
            // Show enhanced loading indicator
            this.showLoadingIndicator();
            
            // Update loading progress
            this.updateLoadingProgress(10, 'Initializing core systems...');
            
            // Initialize performance monitoring
            await this.performance.init();
            this.updateLoadingProgress(20, 'Performance monitoring active');
            
            // Initialize components in optimized order
            await this.initializeComponent('ui', 30, 'Setting up user interface...');
            await this.initializeComponent('orb', 40, 'Activating Susan Orb...');
            await this.initializeComponent('voice', 50, 'Initializing voice systems...');
            await this.initializeComponent('audio', 60, 'Setting up audio visualization...');
            await this.initializeComponent('chat', 70, 'Preparing conversation interface...');
            await this.initializeComponent('websocket', 80, 'Establishing AI connection...');
            await this.initializeComponent('notifications', 85, 'Setting up notifications...');
            await this.initializeComponent('settings', 90, 'Loading user preferences...');
            
            // Initialize enhanced features
            this.initializeEnhancedFeatures();
            this.updateLoadingProgress(95, 'Finalizing initialization...');
            
            // Initialize legacy compatibility
            this.initializeLegacySupport();
            
            // Set up global event listeners
            this.bindGlobalEvents();
            
            // Mark as initialized
            this.appState.isInitialized = true;
            this.state.set('app:initialized', true);
            
            // Complete loading
            this.updateLoadingProgress(100, 'Ready!');
            await this.delay(500); // Brief pause to show completion
            
            // Hide loading indicator with animation
            await this.hideLoadingIndicator();
            
            // Welcome animation and announcement
            this.playWelcomeSequence();
            
            // Log successful initialization
            console.log('🚀 Susan AI Enhanced v2.0 initialized successfully!');
            this.logActivity('system', 'Susan AI Enhanced initialized', { 
                version: this.appState.version,
                sessionId: this.appState.sessionId,
                components: Array.from(this.components.keys())
            });
            
        } catch (error) {
            console.error('Failed to initialize Susan AI:', error);
            this.handleInitializationError(error);
        }
    }

    async initializeComponent(name, progressPercent, statusText) {
        this.updateLoadingProgress(progressPercent, statusText);
        
        const ComponentClass = this.getComponentClass(name);
        if (ComponentClass) {
            const component = new ComponentClass(this);
            await component.init();
            this.components.set(name, component);
        } else {
            console.warn(`Component class not found: ${name}`);
        }
    }

    getComponentClass(name) {
        const componentMap = {
            'ui': UIComponent,
            'orb': OrbComponent,
            'voice': VoiceComponent,
            'audio': AudioVisualizerComponent,
            'chat': ChatComponent,
            'websocket': WebSocketComponent,
            'notifications': NotificationComponent,
            'settings': SettingsComponent
        };
        
        return componentMap[name];
    }

    initializeEnhancedFeatures() {
        // Initialize gesture recognition
        this.initializeGestureRecognition();
        
        // Initialize keyboard shortcuts
        this.initializeKeyboardShortcuts();
        
        // Initialize accessibility features
        this.initializeAccessibilityFeatures();
        
        // Initialize PWA features
        this.initializePWAFeatures();
        
        // Initialize analytics (if enabled)
        if (this.settings.analyticsEnabled) {
            this.initializeAnalytics();
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showLoadingIndicator() {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'flex';
            loadingIndicator.setAttribute('aria-hidden', 'false');
        }
    }

    updateLoadingProgress(percent, text) {
        const progressFill = document.getElementById('loadingProgress');
        const loadingText = document.getElementById('loadingText');
        const steps = document.querySelectorAll('#loadingSteps .step');
        
        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }
        
        if (loadingText) {
            loadingText.textContent = text;
        }
        
        // Update step indicators
        const activeStepIndex = Math.floor((percent / 100) * steps.length);
        steps.forEach((step, index) => {
            step.classList.remove('active', 'completed');
            if (index < activeStepIndex) {
                step.classList.add('completed');
            } else if (index === activeStepIndex) {
                step.classList.add('active');
            }
        });
    }

    async hideLoadingIndicator() {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.opacity = '0';
            await this.delay(300);
            loadingIndicator.style.display = 'none';
            loadingIndicator.setAttribute('aria-hidden', 'true');
        }
    }

    playWelcomeSequence() {
        // Animate orb entrance
        const orbComponent = this.components.get('orb');
        if (orbComponent) {
            orbComponent.playWelcomeAnimation();
        }
        
        // Announce readiness
        setTimeout(() => {
            this.announceA11y('Susan AI Enhanced is ready for interaction');
        }, 500);
    }

    announceA11y(message) {
        const announcer = document.getElementById('a11y-announcer');
        if (announcer) {
            announcer.textContent = message;
        }
    }

    logActivity(type, message, data = {}) {
        const activity = {
            id: Date.now() + Math.random(),
            type,
            message,
            data,
            timestamp: Date.now()
        };
        
        this.activityLog.unshift(activity);
        
        // Keep activity log at max size
        if (this.activityLog.length > this.maxActivityItems) {
            this.activityLog.splice(this.maxActivityItems);
        }
        
        // Emit activity event
        this.state.emit('activity:logged', activity);
        
        // Update activity display
        this.updateActivityDisplay();
    }

    updateActivityDisplay() {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;
        
        // Keep existing system activity and add new ones
        const recentActivities = this.activityLog.slice(0, 10);
        
        recentActivities.forEach(activity => {
            if (!document.querySelector(`[data-activity-id="${activity.id}"]`)) {
                const activityElement = this.createActivityElement(activity);
                activityList.appendChild(activityElement);
            }
        });
        
        // Remove old activities beyond limit
        const existingActivities = activityList.querySelectorAll('.activity-item:not(.system)');
        if (existingActivities.length > 10) {
            for (let i = 10; i < existingActivities.length; i++) {
                existingActivities[i].remove();
            }
        }
    }

    createActivityElement(activity) {
        const item = document.createElement('div');
        item.className = `activity-item ${activity.type}`;
        item.setAttribute('data-activity-id', activity.id);
        item.setAttribute('data-activity-type', activity.type);
        
        const iconMap = {
            'voice': '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>',
            'chat': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
            'system': '<circle cx="12" cy="12" r="3"/><path d="M12 1v6M12 17v6M5.64 7.05l4.95 4.95M13.41 13.41l4.95 4.95M7.05 18.36l4.95-4.95M13.41 10.59l4.95-4.95"/>',
            'file': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/>',
            'error': '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
        };
        
        item.innerHTML = `
            <div class="activity-icon ${activity.type}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    ${iconMap[activity.type] || iconMap.system}
                </svg>
            </div>
            <div class="activity-content enhanced">
                <div class="activity-main">
                    <div class="activity-text">${activity.message}</div>
                    ${activity.data.details ? `<div class="activity-details">${activity.data.details}</div>` : ''}
                </div>
                <div class="activity-metadata">
                    <time class="activity-time">${this.formatTimeAgo(activity.timestamp)}</time>
                    ${activity.type === 'system' ? '<span class="activity-priority high" title="High priority event"></span>' : ''}
                </div>
            </div>
        `;
        
        return item;
    }

    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    }

    handleInitializationError(error) {
        console.error('Initialization failed:', error);
        
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            const loadingText = document.getElementById('loadingText');
            if (loadingText) {
                loadingText.textContent = 'Initialization failed. Attempting recovery...';
                loadingText.style.color = 'var(--error-text)';
            }
        }
        
        // Attempt graceful degradation
        this.attemptGracefulDegradation();
    }

    attemptGracefulDegradation() {
        // Initialize basic functionality without advanced features
        console.log('Attempting graceful degradation...');
        
        setTimeout(() => {
            this.hideLoadingIndicator();
            this.announceA11y('Susan AI started with limited functionality. Some features may not be available.');
        }, 2000);
    }
            this.showLoadingIndicator();
            
            // Initialize components in order
            await this.initElements();
            await this.components.settings.init();
            await this.components.ui.init();
            await this.components.orb.init();
            await this.components.voice.init();
            await this.components.audio.init();
            await this.components.chat.init();
            await this.components.websocket.init();
            await this.components.notifications.init();
            await this.components.performance.init();
            
            // Bind global events
            this.bindGlobalEvents();
            
            // Hide loading indicator
            this.hideLoadingIndicator();
            
            console.log('Susan AI Enhanced initialized successfully');
            this.addActivity('System initialized', 'system');
            this.showNotification('Welcome to Susan AI Premium', 'Enhanced system ready for advanced interactions', 'success');
            
            // Emit ready event
            this.state.emit('app:ready');
            
        } catch (error) {
            console.error('Failed to initialize Susan AI:', error);
            this.showNotification('Initialization Error', 'Failed to start Susan AI. Please refresh the page.', 'error');
        }
    }
    
    initElements() {
        // Core elements
        this.susanOrb = document.getElementById('susanOrb');
        this.statusText = document.getElementById('statusText');
        this.statusIndicator = document.getElementById('statusIndicator');
        
        // Controls
        this.voiceBtn = document.getElementById('voiceBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.sendBtn = document.getElementById('sendBtn');
        this.attachBtn = document.getElementById('attachBtn');
        this.fileInput = document.getElementById('fileInput');
        
        // Chat and communication
        this.chatContainer = document.getElementById('chatContainer');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.textInput = document.getElementById('textInput');
        
        // Navigation and settings
        this.themeToggle = document.getElementById('themeToggle');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.settingsPanel = document.getElementById('settingsPanel');
        this.closeSettings = document.getElementById('closeSettings');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.clearChat = document.getElementById('clearChat');
        
        // Audio visualization
        this.audioCanvas = document.getElementById('audioCanvas');
        this.voiceVisualizer = document.getElementById('voiceVisualizer');
        this.canvasCtx = this.audioCanvas?.getContext('2d');
        
        // Widgets and activity
        this.weatherWidget = document.getElementById('weatherWidget');
        this.systemWidget = document.getElementById('systemWidget');
        this.aiStatusWidget = document.getElementById('aiStatusWidget');
        this.activityList = document.getElementById('activityList');
        this.notificationContainer = document.getElementById('notificationContainer');
        
        // Drop zone
        this.dropZone = document.getElementById('dropZone');
        
        // Settings controls
        this.voiceSpeedSlider = document.getElementById('voiceSpeed');
        this.voicePitchSlider = document.getElementById('voicePitch');
        this.animationsToggle = document.getElementById('animationsToggle');
        this.particlesToggle = document.getElementById('particlesToggle');
    }
    
    initSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.updateStatus('Speech recognition not supported in this browser');
            this.voiceBtn.disabled = true;
            this.showNotification('Speech Recognition', 'Not supported in this browser', 'warning');
            return;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        
        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateStatus('Listening');
            this.susanOrb.classList.add('listening');
            this.voiceBtn.textContent = 'Listening...';
            this.voiceBtn.disabled = true;
            this.addActivity('Voice interaction started', 'voice');
            this.startAudioVisualization();
        };
        
        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            if (finalTranscript) {
                this.processUserInput(finalTranscript.trim());
                this.addActivity(`Voice command: "${finalTranscript.substring(0, 30)}..."`, 'voice');
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.updateStatus(`Error: ${event.error}`);
            this.stopListening();
            this.showNotification('Speech Recognition Error', `Failed: ${event.error}`, 'error');
        };
        
        this.recognition.onend = () => {
            this.stopListening();
        };
    }
    
    initWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.updateStatus('Connected to Susan');
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.updateStatus('Disconnected from Susan');
            
            // Attempt to reconnect after 3 seconds
            setTimeout(() => this.initWebSocket(), 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateStatus('Connection error');
        };
    }
    
    bindEvents() {
        // Orb interactions
        this.susanOrb?.addEventListener('click', () => {
            if (this.isListening) {
                this.stopListening();
            } else {
                this.startListening();
            }
            if (this.isSpeaking) {
                this.synthesis.cancel();
            }
        });
        
        // Voice controls - with option for Whisper
        this.voiceBtn?.addEventListener('click', () => {
            // Use Whisper for better accuracy (hold Shift for browser recognition)
            if (event.shiftKey) {
                this.startListening(); // Browser speech recognition
            } else {
                this.startAdvancedVoiceRecording(); // Whisper transcription
            }
        });
        this.stopBtn?.addEventListener('click', () => {
            this.stopListening();
            this.stopAdvancedVoiceRecording();
        });
        
        // Text input
        this.sendBtn?.addEventListener('click', () => this.sendTextMessage());
        this.textInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendTextMessage();
            }
        });
        
        // File handling
        this.attachBtn?.addEventListener('click', () => this.fileInput?.click());
        this.fileInput?.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop
        this.setupDragAndDrop();
        
        // Navigation
        this.themeToggle?.addEventListener('click', () => this.toggleTheme());
        this.settingsBtn?.addEventListener('click', () => this.openSettings());
        this.closeSettings?.addEventListener('click', () => this.closeSettingsPanel());
        this.fullscreenBtn?.addEventListener('click', () => this.toggleFullscreen());
        this.clearChat?.addEventListener('click', () => this.clearChatHistory());
        
        // Settings controls
        this.voiceSpeedSlider?.addEventListener('input', (e) => this.updateVoiceSpeed(e.target.value));
        this.voicePitchSlider?.addEventListener('input', (e) => this.updateVoicePitch(e.target.value));
        this.animationsToggle?.addEventListener('change', (e) => this.toggleAnimations(e.target.checked));
        this.particlesToggle?.addEventListener('change', (e) => this.toggleParticles(e.target.checked));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // Close settings panel when clicking outside
        document.addEventListener('click', (e) => {
            if (this.settingsPanel?.classList.contains('open') && 
                !this.settingsPanel.contains(e.target) && 
                !this.settingsBtn.contains(e.target)) {
                this.closeSettingsPanel();
            }
        });
        
        // Window events
        window.addEventListener('beforeunload', () => this.saveSettings());
    }
    
    startListening() {
        if (!this.recognition) {
            this.updateStatus('Speech recognition not available');
            this.showNotification('Voice Recognition', 'Not available in this browser', 'warning');
            return;
        }
        
        if (this.isSpeaking) {
            this.synthesis.cancel();
        }
        
        try {
            this.recognition.start();
        } catch (error) {
            console.error('Failed to start recognition:', error);
            this.updateStatus('Failed to start listening');
            this.showNotification('Voice Error', 'Failed to start voice recognition', 'error');
        }
    }
    
    stopListening() {
        this.isListening = false;
        this.susanOrb?.classList.remove('listening');
        if (this.voiceBtn) {
            this.voiceBtn.innerHTML = `
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                <span class="btn-text">Talk to Susan</span>
            `;
            this.voiceBtn.disabled = false;
        }
        this.updateStatus('Ready');
        this.stopAudioVisualization();
        
        if (this.recognition) {
            this.recognition.stop();
        }
    }
    
    sendTextMessage() {
        const message = this.textInput.value.trim();
        if (message) {
            this.processUserInput(message);
            this.textInput.value = '';
        }
    }
    
    processUserInput(input) {
        if (!input) return;
        
        this.addMessage(input, 'user');
        this.showTypingIndicator();
        this.setThinkingState(true);
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'message',
                content: input,
                timestamp: new Date().toISOString()
            }));
        } else {
            this.hideTypingIndicator();
            this.setThinkingState(false);
            this.addMessage('Sorry, I\'m not connected right now. Please try again.', 'susan');
        }
        
        this.stopListening();
    }
    
    // Advanced voice recording with Whisper support
    async startAdvancedVoiceRecording() {
        try {
            this.updateStatus('Requesting microphone access...');
            
            // Check if getUserMedia is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('MediaDevices API not supported');
            }
            
            // Request microphone with fallback constraints
            let stream;
            try {
                // Try with preferred settings first
                stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        channelCount: 1,
                        sampleRate: 16000,
                        echoCancellation: true,
                        noiseSuppression: true
                    }
                });
            } catch (error) {
                console.log('Trying fallback audio constraints...');
                // Fallback to basic audio constraints
                stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: true
                });
            }
            
            this.updateStatus('Setting up recorder...');
            
            // Check MediaRecorder support and find compatible mime type
            let mimeType = 'audio/webm;codecs=opus';
            const supportedTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/mp4',
                'audio/wav'
            ];
            
            for (const type of supportedTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    mimeType = type;
                    break;
                }
            }
            
            console.log('Using mime type:', mimeType);
            
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: mimeType
            });
            
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    console.log('Audio chunk received:', event.data.size, 'bytes');
                }
            };
            
            this.mediaRecorder.onstop = async () => {
                console.log('Recording stopped, processing audio...');
                const audioBlob = new Blob(this.audioChunks, { type: mimeType });
                console.log('Audio blob size:', audioBlob.size, 'bytes');
                
                if (audioBlob.size > 0) {
                    await this.sendAudioToWhisper(audioBlob);
                } else {
                    console.error('Audio blob is empty');
                    this.updateStatus('No audio recorded');
                    this.showNotification('Recording Error', 'No audio was captured', 'error');
                }
                
                // Clean up
                stream.getTracks().forEach(track => track.stop());
                this.audioChunks = [];
                this.resetVoiceButton();
            };
            
            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event);
                this.updateStatus('Recording error');
                this.showNotification('Recording Error', 'Failed to record audio', 'error');
                stream.getTracks().forEach(track => track.stop());
                this.resetVoiceButton();
            };
            
            this.mediaRecorder.start(1000); // Collect data every second
            this.isListening = true;
            this.susanOrb?.classList.add('listening');
            this.updateStatus('Listening with Whisper...');
            
            // Update button text
            if (this.voiceBtn) {
                this.voiceBtn.innerHTML = `
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                    <span class="btn-text">Recording...</span>
                `;
                this.voiceBtn.disabled = true;
            }
            
            // Auto-stop after 10 seconds (adjust as needed)
            setTimeout(() => {
                if (this.isListening && this.mediaRecorder?.state === 'recording') {
                    this.stopAdvancedVoiceRecording();
                }
            }, 10000);
            
        } catch (error) {
            console.error('Advanced voice recording failed:', error);
            this.isListening = false;
            this.susanOrb?.classList.remove('listening');
            
            // Provide specific error messages
            let errorMessage = 'Failed to start recording';
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Microphone access denied. Please allow microphone permissions.';
                this.updateStatus('Microphone access denied');
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'No microphone found. Please connect a microphone.';
                this.updateStatus('No microphone found');
            } else if (error.name === 'NotSupportedError') {
                errorMessage = 'Recording not supported in this browser.';
                this.updateStatus('Recording not supported');
            } else {
                this.updateStatus('Recording failed');
            }
            
            this.showNotification('Voice Error', errorMessage, 'error');
            this.resetVoiceButton();
            
            // Fallback to browser speech recognition
            console.log('Falling back to browser speech recognition...');
            setTimeout(() => {
                this.startListening();
            }, 1000);
        }
    }
    
    resetVoiceButton() {
        if (this.voiceBtn) {
            this.voiceBtn.innerHTML = `
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                <span class="btn-text">Talk to Susan</span>
            `;
            this.voiceBtn.disabled = false;
        }
    }
    
    stopAdvancedVoiceRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            this.isListening = false;
            this.susanOrb?.classList.remove('listening');
            this.updateStatus('Processing audio...');
            // Note: resetVoiceButton will be called in the onstop handler
        }
    }
    
    async sendAudioToWhisper(audioBlob) {
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');
            
            this.updateStatus('Transcribing with Whisper...');
            console.log('Sending audio to Whisper API...', audioBlob.size, 'bytes');
            
            const response = await fetch('/api/v1/voice/transcribe', {
                method: 'POST',
                body: formData,
                headers: {
                    // Don't set Content-Type - let browser set it with boundary for FormData
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Whisper API error:', errorText);
                throw new Error(`Transcription failed: ${response.status} - ${errorText}`);
            }
            
            const result = await response.json();
            console.log('Whisper response:', result);
            
            if (result.success && result.text && result.text.trim()) {
                console.log('Whisper transcription successful:', result.text);
                this.updateStatus('Processing your request...');
                this.processUserInput(result.text.trim());
                this.addActivity(`Whisper: "${result.text.substring(0, 30)}..."`, 'voice');
                this.showNotification('Voice Recognition', 'Message transcribed successfully', 'success');
            } else {
                console.warn('No text transcribed from audio');
                this.updateStatus('No speech detected');
                this.showNotification('Voice Recognition', 'No speech detected in audio', 'warning');
            }
            
        } catch (error) {
            console.error('Whisper transcription error:', error);
            this.updateStatus('Transcription failed');
            
            // Provide more specific error messages
            let errorMessage = 'Failed to process audio';
            if (error.message.includes('404')) {
                errorMessage = 'Voice API not available. Using fallback recognition.';
                // Try browser speech recognition as fallback
                setTimeout(() => this.startListening(), 500);
            } else if (error.message.includes('500')) {
                errorMessage = 'Server error during transcription.';
            }
            
            this.showNotification('Transcription Error', errorMessage, 'error');
        } finally {
            this.resetVoiceButton();
        }
    }
    
    handleServerMessage(data) {
        this.hideTypingIndicator();
        this.setThinkingState(false);
        
        switch (data.type) {
            case 'response':
                this.addMessage(data.content, 'susan');
                this.speakResponse(data.content);
                break;
            case 'status':
                this.updateStatus(data.content);
                break;
            case 'error':
                this.addMessage(`Error: ${data.content}`, 'susan');
                this.showNotification('Error', data.content, 'error');
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }
    
    addMessage(content, sender) {
        if (!this.chatContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        
        const timestamp = new Date();
        const timeString = this.formatTimestamp(timestamp);
        
        if (sender === 'user') {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <div class="avatar-icon user-icon"></div>
                </div>
                <div class="message-content">
                    <div class="message-text">${content}</div>
                    <div class="message-time">${timeString}</div>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <div class="avatar-icon"></div>
                </div>
                <div class="message-content">
                    <div class="message-text">${content}</div>
                    <div class="message-time">${timeString}</div>
                </div>
            `;
        }
        
        // Insert before typing indicator
        this.chatContainer.insertBefore(messageDiv, this.typingIndicator);
        
        // Scroll to bottom with smooth animation
        setTimeout(() => {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }, 100);
        
        // Add to activity log
        this.addActivity(`${sender === 'user' ? 'User' : 'Susan'}: ${content.substring(0, 30)}...`, 'chat');
    }
    
    showTypingIndicator() {
        this.typingIndicator.classList.add('show');
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }
    
    hideTypingIndicator() {
        this.typingIndicator.classList.remove('show');
    }
    
    speakResponse(text) {
        if (!this.synthesis) {
            console.log('Speech synthesis not supported');
            return;
        }
        
        console.log('Speaking:', text); // Debug log
        
        // Cancel any ongoing speech
        this.synthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Configure voice settings
        utterance.rate = this.settings.voiceSpeed;
        utterance.pitch = this.settings.voicePitch;
        utterance.volume = 0.8;
        
        // Wait for voices to be loaded if they aren't already
        const setVoice = () => {
            const voices = this.synthesis.getVoices();
            console.log('Available voices:', voices.length); // Debug log
            
            // Try to use a female voice if available
            const femaleVoice = voices.find(voice => 
                voice.name.toLowerCase().includes('female') || 
                voice.name.toLowerCase().includes('woman') ||
                voice.name.toLowerCase().includes('zira') ||
                voice.name.toLowerCase().includes('hazel') ||
                voice.name.toLowerCase().includes('susan') ||
                voice.gender === 'female'
            );
            
            if (femaleVoice) {
                utterance.voice = femaleVoice;
                console.log('Using voice:', femaleVoice.name); // Debug log
            } else if (voices.length > 0) {
                // Use first available voice as fallback
                utterance.voice = voices[0];
                console.log('Using fallback voice:', voices[0].name); // Debug log
            }
        };
        
        utterance.onstart = () => {
            this.isSpeaking = true;
            this.susanOrb?.classList.add('speaking');
            this.updateStatus('Speaking');
        };
        
        utterance.onend = () => {
            this.isSpeaking = false;
            this.susanOrb?.classList.remove('speaking');
            this.updateStatus('Ready');
        };
        
        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event.error);
            this.isSpeaking = false;
            this.susanOrb?.classList.remove('speaking');
            this.updateStatus('Speech error');
        };
        
        // Speak after setting up voice
        const speak = () => {
            console.log('Actually speaking now...'); // Debug log
            // Small delay to ensure voice is set
            setTimeout(() => {
                this.synthesis.speak(utterance);
            }, 100);
        };
        
        // If voices are already loaded, speak immediately
        if (this.synthesis.getVoices().length > 0) {
            setVoice();
            speak();
        } else {
            // Wait for voices to load, then speak
            this.synthesis.addEventListener('voiceschanged', () => {
                setVoice();
                speak();
            }, { once: true });
            
            // Fallback: try to speak after 1 second anyway
            setTimeout(() => {
                if (this.synthesis.getVoices().length === 0) {
                    console.log('No voices loaded, speaking without voice selection');
                    this.synthesis.speak(utterance);
                }
            }, 1000);
        }
    }
    
    updateStatus(message) {
        if (this.statusText) {
            this.statusText.textContent = message;
        }
        console.log('Status:', message);
    }

    setThinkingState(thinking) {
        this.isThinking = thinking;
        if (thinking) {
            this.susanOrb?.classList.add('thinking');
            this.updateStatus('Thinking');
        } else {
            this.susanOrb?.classList.remove('thinking');
            if (!this.isListening && !this.isSpeaking) {
                this.updateStatus('Ready');
            }
        }
    }

    // ============================================
    // THEME AND SETTINGS MANAGEMENT
    // ============================================

    initTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        this.updateThemeIcon();
        this.loadSettings();
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        localStorage.setItem('susan-theme', this.currentTheme);
        this.updateThemeIcon();
        this.addActivity(`Switched to ${this.currentTheme} theme`, 'system');
    }

    updateThemeIcon() {
        if (!this.themeToggle) return;
        
        const isDark = this.currentTheme === 'dark';
        this.themeToggle.innerHTML = isDark ? 
            `<svg class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>` :
            `<svg class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>`;
    }

    loadSettings() {
        if (this.voiceSpeedSlider) {
            this.voiceSpeedSlider.value = this.settings.voiceSpeed;
            this.voiceSpeedSlider.nextElementSibling.textContent = this.settings.voiceSpeed + 'x';
        }
        if (this.voicePitchSlider) {
            this.voicePitchSlider.value = this.settings.voicePitch;
            this.voicePitchSlider.nextElementSibling.textContent = this.settings.voicePitch;
        }
        if (this.animationsToggle) {
            this.animationsToggle.checked = this.settings.animationsEnabled;
        }
        if (this.particlesToggle) {
            this.particlesToggle.checked = this.settings.particlesEnabled;
        }
    }

    saveSettings() {
        localStorage.setItem('susan-voice-speed', this.settings.voiceSpeed);
        localStorage.setItem('susan-voice-pitch', this.settings.voicePitch);
        localStorage.setItem('susan-animations', this.settings.animationsEnabled);
        localStorage.setItem('susan-particles', this.settings.particlesEnabled);
    }

    updateVoiceSpeed(value) {
        this.settings.voiceSpeed = parseFloat(value);
        this.voiceSpeedSlider.nextElementSibling.textContent = value + 'x';
        this.saveSettings();
    }

    updateVoicePitch(value) {
        this.settings.voicePitch = parseFloat(value);
        this.voicePitchSlider.nextElementSibling.textContent = value;
        this.saveSettings();
    }

    toggleAnimations(enabled) {
        this.settings.animationsEnabled = enabled;
        document.body.style.animationPlayState = enabled ? 'running' : 'paused';
        this.saveSettings();
        this.addActivity(`Animations ${enabled ? 'enabled' : 'disabled'}`, 'system');
    }

    toggleParticles(enabled) {
        this.settings.particlesEnabled = enabled;
        const particles = document.querySelector('.particles');
        if (particles) {
            particles.style.display = enabled ? 'block' : 'none';
        }
        this.saveSettings();
        this.addActivity(`Particle effects ${enabled ? 'enabled' : 'disabled'}`, 'system');
    }

    openSettings() {
        this.settingsPanel?.classList.add('open');
        this.addActivity('Opened settings panel', 'system');
    }

    closeSettingsPanel() {
        this.settingsPanel?.classList.remove('open');
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                this.showNotification('Fullscreen Error', 'Could not enter fullscreen mode', 'error');
            });
        } else {
            document.exitFullscreen();
        }
        this.addActivity('Toggled fullscreen mode', 'system');
    }

    clearChatHistory() {
        if (this.chatContainer) {
            // Keep the welcome message and typing indicator
            const welcomeMessage = this.chatContainer.querySelector('.welcome-message');
            const typingIndicator = this.chatContainer.querySelector('.typing-indicator');
            this.chatContainer.innerHTML = '';
            if (welcomeMessage) this.chatContainer.appendChild(welcomeMessage);
            if (typingIndicator) this.chatContainer.appendChild(typingIndicator);
        }
        this.addActivity('Cleared chat history', 'system');
        this.showNotification('Chat Cleared', 'Conversation history has been cleared', 'info');
    }

    // ============================================
    // AUDIO VISUALIZATION
    // ============================================

    async initAudioVisualization() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
        } catch (error) {
            console.warn('Audio visualization not available:', error);
        }
    }

    async startAudioVisualization() {
        if (!this.audioContext || !this.canvasCtx) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            
            this.voiceVisualizer?.classList.add('active');
            this.drawAudioVisualization();
        } catch (error) {
            console.warn('Could not access microphone for visualization:', error);
        }
    }

    drawAudioVisualization() {
        if (!this.analyser || !this.canvasCtx) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!this.isListening) return;

            this.animationId = requestAnimationFrame(draw);
            this.analyser.getByteFrequencyData(dataArray);

            this.canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            this.canvasCtx.fillRect(0, 0, this.audioCanvas.width, this.audioCanvas.height);

            const barWidth = (this.audioCanvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * this.audioCanvas.height * 0.8;

                const hue = (i / bufferLength) * 360;
                this.canvasCtx.fillStyle = `hsla(${hue}, 70%, 60%, 0.8)`;
                
                this.canvasCtx.fillRect(x, this.audioCanvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };

        draw();
    }

    stopAudioVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        
        this.voiceVisualizer?.classList.remove('active');
        
        if (this.canvasCtx) {
            this.canvasCtx.clearRect(0, 0, this.audioCanvas.width, this.audioCanvas.height);
        }
    }

    // ============================================
    // FILE HANDLING
    // ============================================

    setupDragAndDrop() {
        if (!this.dropZone) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, () => {
                this.dropZone.classList.add('active');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, () => {
                this.dropZone.classList.remove('active');
            });
        });

        this.dropZone.addEventListener('drop', (e) => this.handleDrop(e));
        this.dropZone.addEventListener('click', () => this.fileInput?.click());
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    handleDrop(e) {
        const files = e.dataTransfer.files;
        this.handleFiles(files);
    }

    handleFileSelect(e) {
        const files = e.target.files;
        this.handleFiles(files);
    }

    handleFiles(files) {
        Array.from(files).forEach(file => {
            this.processFile(file);
        });
    }

    processFile(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            this.showNotification('File Too Large', `${file.name} exceeds 10MB limit`, 'error');
            return;
        }

        this.addActivity(`File uploaded: ${file.name}`, 'file');
        this.showNotification('File Uploaded', `${file.name} ready for processing`, 'success');

        // Add file message to chat
        this.addMessage(`📎 Uploaded file: ${file.name} (${this.formatFileSize(file.size)})`, 'user');
        
        // Here you would typically process the file or send it to the backend
        this.processUserInput(`I've uploaded a file: ${file.name}. Please analyze it.`);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // ============================================
    // ACTIVITY TRACKING
    // ============================================

    addActivity(description, type = 'general') {
        const activity = {
            id: Date.now(),
            description,
            type,
            timestamp: new Date()
        };

        this.activityLog.unshift(activity);
        if (this.activityLog.length > this.maxActivityItems) {
            this.activityLog.pop();
        }

        this.updateActivityDisplay();
    }

    updateActivityDisplay() {
        if (!this.activityList) return;

        const activityHTML = this.activityLog.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}"></div>
                <div class="activity-content">
                    <div class="activity-text">${activity.description}</div>
                    <div class="activity-time">${this.formatTimestamp(activity.timestamp)}</div>
                </div>
            </div>
        `).join('');

        this.activityList.innerHTML = activityHTML;
    }

    formatTimestamp(timestamp) {
        const now = new Date();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        
        return timestamp.toLocaleDateString();
    }

    // ============================================
    // NOTIFICATION SYSTEM
    // ============================================

    showNotification(title, message, type = 'info', duration = 5000) {
        if (!this.notificationContainer) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-header">
                <div class="notification-title">${title}</div>
                <button class="notification-close">×</button>
            </div>
            <div class="notification-message">${message}</div>
        `;

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this.removeNotification(notification));

        this.notificationContainer.appendChild(notification);

        // Auto-remove after duration
        setTimeout(() => {
            this.removeNotification(notification);
        }, duration);

        // Slide out animation after a delay
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            notification.style.opacity = '0';
        }, duration - 300);
    }

    removeNotification(notification) {
        if (notification && notification.parentNode) {
            notification.style.transform = 'translateX(100%)';
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }
    }

    // ============================================
    // DASHBOARD WIDGETS
    // ============================================

    initDashboardWidgets() {
        this.updateWeatherWidget();
        this.updateSystemWidget();
        this.updateAIStatusWidget();
    }

    async updateWeatherWidget() {
        if (!this.weatherWidget) return;
        
        try {
            // Simulated weather data - in production, use a real weather API
            const weatherData = {
                temperature: Math.floor(Math.random() * 30) + 10,
                description: ['Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy'][Math.floor(Math.random() * 4)]
            };
            
            const tempElement = this.weatherWidget.querySelector('.temperature');
            const descElement = this.weatherWidget.querySelector('.weather-desc');
            
            if (tempElement) tempElement.textContent = `${weatherData.temperature}°C`;
            if (descElement) descElement.textContent = weatherData.description;
        } catch (error) {
            console.warn('Could not update weather widget:', error);
        }
    }

    updateSystemWidget() {
        if (!this.systemWidget) return;
        
        // Simulate system stats
        const cpuUsage = Math.floor(Math.random() * 60) + 20;
        const memoryUsage = Math.floor(Math.random() * 40) + 40;
        
        const statFills = this.systemWidget.querySelectorAll('.stat-fill');
        const statValues = this.systemWidget.querySelectorAll('.stat-value');
        
        if (statFills[0]) statFills[0].style.width = cpuUsage + '%';
        if (statFills[1]) statFills[1].style.width = memoryUsage + '%';
        if (statValues[0]) statValues[0].textContent = cpuUsage + '%';
        if (statValues[1]) statValues[1].textContent = memoryUsage + '%';
    }

    updateAIStatusWidget() {
        if (!this.aiStatusWidget) return;
        
        const responseTime = (Math.random() * 2 + 1).toFixed(1);
        const accuracy = (Math.random() * 2 + 97).toFixed(1);
        
        const metrics = this.aiStatusWidget.querySelectorAll('.metric-value');
        if (metrics[0]) metrics[0].textContent = responseTime + 's';
        if (metrics[1]) metrics[1].textContent = accuracy + '%';
        if (metrics[2]) {
            metrics[2].textContent = 'Online';
            metrics[2].className = 'metric-value online';
        }
    }

    startPerformanceMonitoring() {
        // Update widgets periodically
        setInterval(() => {
            this.updateSystemWidget();
            this.updateAIStatusWidget();
        }, 5000);
        
        // Update weather less frequently
        setInterval(() => {
            this.updateWeatherWidget();
        }, 300000); // 5 minutes
    }

    // ============================================
    // KEYBOARD SHORTCUTS
    // ============================================

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + Enter to send message
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            this.sendTextMessage();
        }
        
        // Escape to stop listening
        if (e.key === 'Escape') {
            if (this.isListening) this.stopListening();
            if (this.settingsPanel?.classList.contains('open')) this.closeSettingsPanel();
        }
        
        // Ctrl/Cmd + L to start listening
        if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
            e.preventDefault();
            this.startListening();
        }
        
        // Ctrl/Cmd + T to toggle theme
        if ((e.ctrlKey || e.metaKey) && e.key === 't') {
            e.preventDefault();
            this.toggleTheme();
        }
        
        // Ctrl/Cmd + , to open settings
        if ((e.ctrlKey || e.metaKey) && e.key === ',') {
            e.preventDefault();
            this.openSettings();
        }
    }
}

// Enhanced Orb Component
class OrbComponent extends BaseComponent {
    constructor(susan) {
        super(susan, 'orb');
        this.orbStates = {
            ready: 'ready',
            listening: 'listening',
            thinking: 'thinking',
            speaking: 'speaking',
            processing: 'processing',
            error: 'error'
        };
        this.currentState = this.orbStates.ready;
        this.animations = new Map();
        this.stateIndicators = new Map();
    }

    async initElements() {
        this.orb = this.getElement('susanOrb');
        this.orbStatus = this.getElement('orb-status');
        this.orbGlow = this.orb?.querySelector('.orb-glow');
        this.orbCore = this.orb?.querySelector('.orb-core');
        this.orbRings = this.orb?.querySelector('.orb-rings');
        this.stateIndicators = this.orb?.querySelectorAll('.state-indicator');
        
        if (!this.orb) {
            console.warn('Susan Orb element not found - using fallback');
            return;
        }
    }

    async bindEvents() {
        if (this.orb) {
            this.addEventListener(this.orb, 'click', () => this.handleOrbClick());
            this.addEventListener(this.orb, 'mouseenter', () => this.handleOrbHover(true));
            this.addEventListener(this.orb, 'mouseleave', () => this.handleOrbHover(false));
            this.addEventListener(this.orb, 'keydown', (e) => this.handleOrbKeydown(e));
        }

        // Listen to Susan state changes
        this.susan.state.on('voice:listening', () => this.setState(this.orbStates.listening));
        this.susan.state.on('voice:stopped', () => this.setState(this.orbStates.ready));
        this.susan.state.on('ai:thinking', () => this.setState(this.orbStates.thinking));
        this.susan.state.on('ai:speaking', () => this.setState(this.orbStates.speaking));
        this.susan.state.on('ai:processing', () => this.setState(this.orbStates.processing));
        this.susan.state.on('system:error', () => this.setState(this.orbStates.error));
    }

    handleOrbClick() {
        this.susan.performance?.startMeasure('orb-interaction');
        
        if (this.currentState === this.orbStates.listening) {
            this.susan.components.get('voice')?.stopListening();
        } else {
            this.susan.components.get('voice')?.startListening();
        }
        
        this.susan.performance?.endMeasure('orb-interaction');
        this.susan.logActivity('voice', 'Orb interaction triggered');
    }

    setState(newState) {
        if (this.currentState === newState) return;
        
        const oldState = this.currentState;
        this.currentState = newState;
        
        // Update orb visual state
        this.updateOrbVisuals(newState, oldState);
        
        // Emit state change event
        this.susan.state.emit('orb:state-changed', { oldState, newState });
        
        console.log(`Orb state changed: ${oldState} -> ${newState}`);
    }

    updateOrbVisuals(newState, oldState) {
        if (!this.orb) return;
        
        // Remove old state classes
        this.orb.classList.remove(oldState);
        
        // Add new state class
        this.orb.classList.add(newState);
        
        // Update data attribute
        this.orb.setAttribute('data-state', newState);
    }

    playWelcomeAnimation() {
        if (!this.orb) return;
        
        // Welcome sequence animation
        const welcomeAnimation = this.orb.animate([
            { transform: 'scale(0)', opacity: 0 },
            { transform: 'scale(1.2)', opacity: 0.8 },
            { transform: 'scale(1)', opacity: 1 }
        ], {
            duration: 1000,
            easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
        });
        
        welcomeAnimation.onfinish = () => {
            this.setState(this.orbStates.ready);
        };
    }

    getState() {
        return this.currentState;
    }
}

// Enhanced UI Component for overall interface management
class UIComponent extends BaseComponent {
    constructor(susan) {
        super(susan, 'ui');
        this.theme = 'dark';
    }

    async bindEvents() {
        // Theme toggle and keyboard shortcuts
        this.addEventListener(document, 'keydown', (e) => this.handleGlobalKeydown(e));
    }

    handleGlobalKeydown(event) {
        // Escape key - close modals/panels
        if (event.code === 'Escape') {
            this.hideSettings();
            return;
        }
        
        // Space - Voice interaction (when not in input)
        if (event.code === 'Space' && !this.isInputFocused()) {
            event.preventDefault();
            this.susan.components.get('voice')?.toggleListening();
            return;
        }
    }

    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.contentEditable === 'true'
        );
    }

    hideSettings() {
        const settingsPanel = this.getElement('settingsPanel');
        if (settingsPanel) {
            settingsPanel.style.display = 'none';
            settingsPanel.setAttribute('aria-hidden', 'true');
        }
    }
}

// Placeholder component classes
class VoiceComponent extends BaseComponent {
    constructor(susan) {
        super(susan, 'voice');
    }
    
    async init() {
        await super.init();
        console.log('Voice component initialized');
    }
    
    toggleListening() {
        // Legacy compatibility
        if (this.susan.isListening) {
            this.susan.stopListening();
        } else {
            this.susan.startListening();
        }
    }
}

class AudioVisualizerComponent extends BaseComponent {
    constructor(susan) {
        super(susan, 'audio');
    }
    
    async init() {
        await super.init();
        console.log('Audio visualizer component initialized');
    }
}

class ChatComponent extends BaseComponent {
    constructor(susan) {
        super(susan, 'chat');
    }
    
    async init() {
        await super.init();
        console.log('Chat component initialized');
    }
}

class WebSocketComponent extends BaseComponent {
    constructor(susan) {
        super(susan, 'websocket');
    }
    
    async init() {
        await super.init();
        console.log('WebSocket component initialized');
    }
}

class NotificationComponent extends BaseComponent {
    constructor(susan) {
        super(susan, 'notifications');
    }
    
    async init() {
        await super.init();
        console.log('Notification component initialized');
    }
}

class SettingsComponent extends BaseComponent {
    constructor(susan) {
        super(susan, 'settings');
    }
    
    async init() {
        await super.init();
        console.log('Settings component initialized');
    }
}

// Initialize Susan when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.susan = new SusanAI();
});

// Load available voices when they're ready
if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = () => {
        const voices = speechSynthesis.getVoices();
        console.log('Available voices:', voices.map(v => v.name));
    };
}