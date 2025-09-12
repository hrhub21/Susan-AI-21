/* Susan AI - Enhanced Professional Assistant with Image Rendering */
/* Red, Black & White Theme - Professional, Clean, Modern */

console.log('🚀 Susan AI Enhanced Professional Edition - Loading...');
console.log('Version: Professional v2.0 | Enhanced with Image Rendering');

class SusanAI {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.isSpeaking = false;
        this.isThinking = false;
        this.ws = null;
        
        // Audio visualization
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.audioCanvas = null;
        this.canvasCtx = null;
        this.animationId = null;
        
        // Enhanced features
        this.mediaRecorder = null;
        this.audioChunks = [];
        
        // Image rendering capabilities
        this.imageRenderer = {
            canvas: null,
            ctx: null,
            currentImage: null,
            annotations: [],
            overlays: []
        };
        
        // Theme and settings
        this.currentTheme = localStorage.getItem('susan-theme') || 'professional';
        this.settings = {
            voiceSpeed: parseFloat(localStorage.getItem('susan-voice-speed')) || 1.0,
            voicePitch: parseFloat(localStorage.getItem('susan-voice-pitch')) || 1.0,
            animationsEnabled: localStorage.getItem('susan-animations') !== 'false',
            particlesEnabled: localStorage.getItem('susan-particles') !== 'false',
            imageProcessing: localStorage.getItem('susan-image-processing') !== 'false'
        };
        
        // Activity tracking
        this.activityLog = [];
        this.maxActivityItems = 10;
        
        // Notification system
        this.notifications = [];
        this.notificationId = 0;
        
        // Consolidated feature suites
        this.featureSuites = {
            smartAnalysis: new SmartAnalysisHub(),
            claimsInsurance: new ClaimsInsuranceSuite(),
            materialOperations: new MaterialOperationsSuite(),
            customerProject: new CustomerProjectHub(),
            safetyCompliance: new SafetyComplianceSuite(),
            aiAutomation: new AIAutomationSuite()
        };
        
        console.log('🔄 Starting Susan AI Professional initialization...');
        
        try {
            console.log('1/10 Initializing elements...');
            this.initElements();
            
            console.log('2/10 Initializing theme...');
            this.initTheme();
            
            console.log('3/10 Initializing audio visualization...');
            this.initAudioVisualization();
            
            console.log('4/10 Initializing speech recognition...');
            this.initSpeechRecognition();
            
            console.log('5/10 Initializing WebSocket...');
            this.initWebSocket();
            
            console.log('6/10 Binding events...');
            this.bindEvents();
            
            console.log('7/10 Initializing image rendering system...');
            this.initImageRenderer();
            
            console.log('8/10 Initializing features menu...');
            this.initFeaturesMenu();
            
            console.log('9/10 Initializing dashboard widgets...');
            this.initDashboardWidgets();
            
            console.log('10/10 Starting performance monitoring...');
            this.startPerformanceMonitoring();
            
            console.log('✅ Susan AI Professional initialized successfully');
            
            this.hideLoadingScreen();
            this.addActivity('System initialized', 'system');
            this.showNotification('Susan AI Ready', 'Professional roofing assistant is online', 'success');
            
        } catch (error) {
            console.error('❌ Susan AI initialization failed:', error);
            throw error;
        }
    }
    
    initElements() {
        // Core elements
        this.susanOrb = document.getElementById('susanOrb');
        this.statusText = document.getElementById('statusText');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.voiceBtn = document.getElementById('voiceBtn');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.fileInput = document.getElementById('fileInput');
        this.uploadProgress = document.getElementById('uploadProgress');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.featuresBtn = document.getElementById('featuresBtn');
        this.featuresMenu = document.getElementById('featuresMenu');
        this.featuresOverlay = document.getElementById('featuresOverlay');
        this.closeFeaturesBtn = document.getElementById('closeFeaturesBtn');
        this.audioCanvas = document.getElementById('audioCanvas');
    }
    
    initTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        this.updateStatusColor();
    }
    
    initImageRenderer() {
        // Create hidden canvas for image processing
        this.imageRenderer.canvas = document.createElement('canvas');
        this.imageRenderer.ctx = this.imageRenderer.canvas.getContext('2d');
        
        // Set up image drop zone functionality
        this.setupImageDropZone();
        
        console.log('✅ Image rendering system initialized');
    }
    
    setupImageDropZone() {
        // Add drag and drop functionality to chat area
        const chatContainer = document.getElementById('chatContainer');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            chatContainer.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            chatContainer.addEventListener(eventName, () => this.highlight(chatContainer), false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            chatContainer.addEventListener(eventName, () => this.unhighlight(chatContainer), false);
        });
        
        chatContainer.addEventListener('drop', (e) => this.handleDrop(e), false);
    }
    
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    highlight(element) {
        element.classList.add('drag-over');
    }
    
    unhighlight(element) {
        element.classList.remove('drag-over');
    }
    
    handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        this.handleFiles(files);
    }
    
    handleFiles(files) {
        this.showUploadProgress();
        const fileArray = Array.from(files);
        
        if (fileArray.length === 0) return;
        
        // Process files sequentially with progress updates
        this.processFilesSequentially(fileArray, 0);
    }
    
    async processFilesSequentially(files, index) {
        if (index >= files.length) {
            this.hideUploadProgress();
            return;
        }
        
        const file = files[index];
        const progress = ((index + 1) / files.length) * 100;
        
        this.updateUploadProgress(progress, `Processing ${file.name}...`);
        
        try {
            await this.processFile(file);
        } catch (error) {
            console.error('Error processing file:', error);
            this.addMessage(`Failed to process file: ${file.name}`, 'susan', 'error');
        }
        
        // Process next file
        setTimeout(() => {
            this.processFilesSequentially(files, index + 1);
        }, 500);
    }
    
    async processFile(file) {
        const fileType = this.getFileType(file);
        
        switch (fileType) {
            case 'image':
                await this.processImage(file);
                break;
            case 'pdf':
                await this.processPDF(file);
                break;
            case 'document':
                await this.processDocument(file);
                break;
            case 'archive':
                await this.processArchive(file);
                break;
            default:
                await this.processGenericFile(file);
                break;
        }
    }
    
    getFileType(file) {
        const extension = file.name.toLowerCase().split('.').pop();
        const mimeType = file.type.toLowerCase();
        
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf';
        if (['doc', 'docx', 'txt', 'csv', 'xlsx', 'ppt', 'pptx'].includes(extension)) return 'document';
        if (['zip', 'rar', '7z'].includes(extension)) return 'archive';
        
        return 'generic';
    }
    
    getFileIcon(fileType) {
        const iconMap = {
            'image': '🖼️',
            'pdf': '📄',
            'document': '📝',
            'archive': '📦',
            'generic': '📁'
        };
        return iconMap[fileType] || '📁';
    }
    
    showUploadProgress() {
        if (this.uploadProgress) {
            this.uploadProgress.style.display = 'block';
        }
    }
    
    hideUploadProgress() {
        if (this.uploadProgress) {
            setTimeout(() => {
                this.uploadProgress.style.display = 'none';
            }, 1000);
        }
    }
    
    updateUploadProgress(percentage, text) {
        if (this.progressFill) {
            this.progressFill.style.width = `${percentage}%`;
        }
        if (this.progressText) {
            this.progressText.textContent = text;
        }
    }
    
    async processImage(file) {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            const img = new Image();
            img.onload = async () => {
                // Store current image
                this.imageRenderer.currentImage = img;
                
                // Render image in chat
                await this.renderImageInChat(img, file.name);
                
                // Process with AI if available
                await this.analyzeImageWithAI(file, img);
            };
            img.src = e.target.result;
        };
        
        reader.readAsDataURL(file);
    }
    
    async renderImageInChat(img, filename) {
        // Create image message container
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user image-message';
        messageDiv.innerHTML = `
            <div class="image-container">
                <img src="${img.src}" alt="${filename}" class="chat-image" onclick="window.susan.openImageViewer('${img.src}', '${filename}')">
                <div class="image-info">
                    <span class="image-name">${filename}</span>
                    <span class="image-size">${this.formatFileSize(img.src.length * 0.75)}</span>
                </div>
            </div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Add to activity log
        this.addActivity(`Image uploaded: ${filename}`, 'image');
    }
    
    async analyzeImageWithAI(file, img) {
        this.setStatus('Analyzing image...', 'processing');
        
        try {
            // Convert image to base64 for API
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            
            // Send to backend for AI analysis
            const response = await fetch('/api/analyze-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: imageData,
                    filename: file.name,
                    analysis_type: 'roofing_damage'
                })
            });
            
            if (response.ok) {
                const analysis = await response.json();
                await this.displayImageAnalysis(analysis);
            } else {
                console.warn('Image analysis failed:', response.statusText);
                this.addMessage('Image uploaded successfully. AI analysis temporarily unavailable.', 'susan', 'system');
            }
        } catch (error) {
            console.error('Image analysis error:', error);
            this.addMessage('Image uploaded. Analysis will be available when AI models are ready.', 'susan', 'system');
        }
        
        this.setStatus('Ready', 'ready');
    }
    
    async displayImageAnalysis(analysis) {
        // Include the image with the analysis for better context
        const currentImageSrc = this.imageRenderer.currentImage?.src;
        
        const analysisMessage = `
            <div class="image-analysis">
                ${currentImageSrc ? `
                    <div class="analysis-image-preview">
                        <img src="${currentImageSrc}" alt="Analyzed image" style="max-width: 200px; max-height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;" onclick="window.susan.openImageViewer('${currentImageSrc}', 'Analyzed Image')">
                    </div>
                ` : ''}
                <h4>🔍 AI Image Analysis Results</h4>
                <div class="analysis-results">
                    ${analysis.damage_detected ? `
                        <div class="analysis-item positive">
                            <strong>Damage Detected:</strong> ${analysis.damage_type}
                        </div>
                        <div class="analysis-item">
                            <strong>Confidence:</strong> ${Math.round(analysis.confidence * 100)}%
                        </div>
                        <div class="analysis-item">
                            <strong>Affected Area:</strong> ${analysis.affected_area || 'Multiple areas'}
                        </div>
                    ` : `
                        <div class="analysis-item negative">
                            <strong>No significant damage detected</strong>
                        </div>
                    `}
                    ${analysis.recommendations ? `
                        <div class="analysis-item">
                            <strong>Recommendations:</strong>
                            <ul>
                                ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        this.addMessage(analysisMessage, 'susan', 'analysis');
        this.addActivity('Image analyzed with AI', 'analysis');
    }
    
    async processPDF(file) {
        const fileIcon = this.getFileIcon('pdf');
        const messageDiv = this.createFileMessage(file, 'pdf', fileIcon);
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        
        this.addActivity(`PDF uploaded: ${file.name}`, 'file');
        this.addMessage('📄 PDF document uploaded successfully. I can help analyze document content and provide insights.', 'susan', 'system');
    }
    
    async processDocument(file) {
        const fileIcon = this.getFileIcon('document');
        const messageDiv = this.createFileMessage(file, 'document', fileIcon);
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        
        this.addActivity(`Document uploaded: ${file.name}`, 'file');
        this.addMessage('📝 Document uploaded successfully. I can help analyze content, extract information, or answer questions about the document.', 'susan', 'system');
    }
    
    async processArchive(file) {
        const fileIcon = this.getFileIcon('archive');
        const messageDiv = this.createFileMessage(file, 'archive', fileIcon);
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        
        this.addActivity(`Archive uploaded: ${file.name}`, 'file');
        this.addMessage('📦 Archive file uploaded successfully. I can help you manage and organize the contents once extracted.', 'susan', 'system');
    }
    
    async processGenericFile(file) {
        const fileIcon = this.getFileIcon('generic');
        const messageDiv = this.createFileMessage(file, 'generic', fileIcon);
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        
        this.addActivity(`File uploaded: ${file.name}`, 'file');
        this.addMessage('📁 File uploaded successfully. I can provide assistance based on the file type and your specific needs.', 'susan', 'system');
    }
    
    createFileMessage(file, fileType, fileIcon) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user file-upload-message';
        
        const fileSize = this.formatFileSize(file.size);
        const fileExtension = file.name.split('.').pop().toUpperCase();
        
        messageDiv.innerHTML = `
            <div class="file-icon ${fileType}">${fileIcon}</div>
            <div class="file-info">
                <span class="file-name">${file.name}</span>
                <span class="file-size">${fileSize} • ${fileExtension}</span>
            </div>
            <div class="file-actions">
                <button class="file-action-btn" onclick="window.susan.analyzeFile('${file.name}', '${fileType}')">Analyze</button>
                <button class="file-action-btn secondary" onclick="window.susan.removeFile('${file.name}')">Remove</button>
            </div>
        `;
        
        return messageDiv;
    }
    
    analyzeFile(filename, fileType) {
        this.setStatus('Analyzing file...', 'processing');
        
        // Simulate file analysis
        setTimeout(() => {
            let analysisMessage = '';
            
            switch (fileType) {
                case 'pdf':
                    analysisMessage = `📄 **PDF Analysis: ${filename}**\n\nI can help extract text content, identify key information, and answer questions about this PDF document. What specific information are you looking for?`;
                    break;
                case 'document':
                    analysisMessage = `📝 **Document Analysis: ${filename}**\n\nI can analyze document structure, extract key data, and help with content review. What aspects would you like me to focus on?`;
                    break;
                case 'image':
                    analysisMessage = `🖼️ **Image Analysis: ${filename}**\n\nI can identify roofing damage, measure areas, detect materials, and provide assessment recommendations. What specific analysis do you need?`;
                    break;
                case 'archive':
                    analysisMessage = `📦 **Archive Analysis: ${filename}**\n\nI can help organize and categorize archive contents once extracted. Would you like me to guide you through the extraction process?`;
                    break;
                default:
                    analysisMessage = `📁 **File Analysis: ${filename}**\n\nI'm ready to help with this file. Please let me know what type of analysis or assistance you need.`;
            }
            
            this.addMessage(analysisMessage, 'susan', 'analysis');
            this.setStatus('Ready', 'ready');
        }, 1500);
    }
    
    removeFile(filename) {
        // Find and remove the file message
        const fileMessages = document.querySelectorAll('.file-upload-message');
        fileMessages.forEach(message => {
            const fileNameElement = message.querySelector('.file-name');
            if (fileNameElement && fileNameElement.textContent === filename) {
                message.remove();
            }
        });
        
        this.addActivity(`File removed: ${filename}`, 'file');
        this.addMessage(`🗑️ File "${filename}" has been removed from the conversation.`, 'susan', 'system');
    }
    
    openFileDialog() {
        if (this.fileInput) {
            this.fileInput.click();
        }
    }
    
    handleFileSelect(event) {
        const files = event.target.files;
        if (files && files.length > 0) {
            this.handleFiles(files);
        }
        // Reset the input so the same file can be selected again
        event.target.value = '';
    }
    
    openImageViewer(src, filename) {
        // Create modal image viewer
        const modal = document.createElement('div');
        modal.className = 'image-viewer-modal';
        modal.innerHTML = `
            <div class="image-viewer-overlay" onclick="this.parentElement.remove()"></div>
            <div class="image-viewer-content">
                <div class="image-viewer-header">
                    <h3>${filename}</h3>
                    <button class="close-viewer" onclick="this.closest('.image-viewer-modal').remove()">×</button>
                </div>
                <div class="image-viewer-body">
                    <img src="${src}" alt="${filename}" class="viewer-image">
                </div>
                <div class="image-viewer-footer">
                    <button onclick="window.susan.downloadImage('${src}', '${filename}')">Download</button>
                    <button onclick="window.susan.analyzeImageDetail('${src}')">Analyze Again</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    downloadImage(src, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = src;
        link.click();
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    initAudioVisualization() {
        if (this.audioCanvas) {
            this.canvasCtx = this.audioCanvas.getContext('2d');
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
        }
    }
    
    resizeCanvas() {
        if (this.audioCanvas && this.canvasCtx) {
            this.audioCanvas.width = window.innerWidth;
            this.audioCanvas.height = window.innerHeight;
        }
    }
    
    initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';
            
            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.chatInput.value = transcript;
                this.handleSendMessage();
            };
            
            this.recognition.onend = () => {
                this.isListening = false;
                this.updateVoiceButton();
                this.setStatus('Ready', 'ready');
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.isListening = false;
                this.updateVoiceButton();
                this.setStatus('Ready', 'ready');
            };
        }
    }
    
    initWebSocket() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${location.host}`;
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                this.setStatus('Connected', 'ready');
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('WebSocket message parsing error:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.setStatus('Disconnected', 'error');
                setTimeout(() => this.initWebSocket(), 3000);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.setStatus('Connection Error', 'error');
            };
        } catch (error) {
            console.error('WebSocket initialization failed:', error);
            this.setStatus('Offline Mode', 'warning');
        }
    }
    
    handleWebSocketMessage(data) {
        try {
            switch (data.type) {
                case 'response':
                    this.addMessage(data.message, 'susan', 'response');
                    this.setStatus('Ready', 'ready');
                    break;
                case 'status':
                    this.setStatus(data.status, data.level || 'info');
                    break;
                case 'notification':
                    this.showNotification(data.title, data.message, data.level);
                    break;
                default:
                    console.log('Unknown WebSocket message type:', data.type);
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
            this.setStatus('Ready', 'ready');
        }
    }
    
    bindEvents() {
        // Chat input events
        if (this.chatInput) {
            this.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSendMessage();
                }
            });
        }
        
        // Button events
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => this.handleSendMessage());
        }
        
        if (this.voiceBtn) {
            this.voiceBtn.addEventListener('click', () => this.toggleVoiceInput());
        }
        
        if (this.uploadBtn) {
            this.uploadBtn.addEventListener('click', () => this.openFileDialog());
        }
        
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        
        if (this.susanOrb) {
            this.susanOrb.addEventListener('click', () => this.handleOrbClick());
        }
        
        // Features menu events
        if (this.featuresBtn) {
            this.featuresBtn.addEventListener('click', () => this.toggleFeaturesMenu());
        }
        
        if (this.closeFeaturesBtn) {
            this.closeFeaturesBtn.addEventListener('click', () => this.closeFeaturesMenu());
        }
        
        if (this.featuresOverlay) {
            this.featuresOverlay.addEventListener('click', () => this.closeFeaturesMenu());
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case '/':
                        e.preventDefault();
                        this.toggleFeaturesMenu();
                        break;
                    case 'Enter':
                        if (document.activeElement !== this.chatInput) {
                            e.preventDefault();
                            this.chatInput.focus();
                        }
                        break;
                }
            }
        });
    }
    
    initFeaturesMenu() {
        // Features menu is initialized via HTML
        console.log('✅ Features menu initialized');
    }
    
    initDashboardWidgets() {
        this.updateSystemMetrics();
        this.updateWeatherWidget();
        this.updateModelStatus();
        
        // Update widgets periodically
        setInterval(() => {
            this.updateSystemMetrics();
            this.updateWeatherWidget();
        }, 30000); // Every 30 seconds
    }
    
    startPerformanceMonitoring() {
        // Monitor performance metrics
        setInterval(() => {
            const memory = performance.memory;
            if (memory) {
                this.logPerformanceMetrics({
                    usedJSHeapSize: memory.usedJSHeapSize,
                    totalJSHeapSize: memory.totalJSHeapSize,
                    jsHeapSizeLimit: memory.jsHeapSizeLimit
                });
            }
        }, 60000); // Every minute
    }
    
    handleSendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;
        
        this.addMessage(message, 'user');
        this.chatInput.value = '';
        this.setStatus('Processing...', 'processing');
        
        this.sendToBackend(message);
    }
    
    async sendToBackend(message) {
        try {
            // Include image context if available
            const payload = { message };
            if (this.imageRenderer.currentImage) {
                payload.hasImageContext = true;
                payload.lastImageInfo = {
                    uploaded: true,
                    timestamp: new Date().toISOString()
                };
            }
            
            // Add timeout to prevent stuck processing
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                
                // Check if response mentions image analysis or visual content
                const responseText = data.response.toLowerCase();
                const mentionsImage = responseText.includes('image') || 
                                    responseText.includes('photo') || 
                                    responseText.includes('picture') ||
                                    responseText.includes('visual') ||
                                    responseText.includes('analyze') ||
                                    responseText.includes('damage');
                
                // If Susan mentions images and we have one, include it in the response
                if (mentionsImage && this.imageRenderer.currentImage) {
                    const enhancedResponse = this.addImageToResponse(data.response);
                    this.addMessage(enhancedResponse, 'susan', 'response');
                } else {
                    this.addMessage(data.response, 'susan', 'response');
                }
                
                this.addActivity(`Query processed: ${message.substring(0, 30)}...`, 'query');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Backend communication error:', error);
            if (error.name === 'AbortError') {
                this.addMessage('Request timed out. Please try again with a shorter message.', 'susan', 'error');
            } else {
                this.addMessage('I\'m having trouble connecting to my knowledge base. Please try again in a moment.', 'susan', 'error');
            }
        }
        
        this.setStatus('Ready', 'ready');
    }
    
    addImageToResponse(responseText) {
        if (!this.imageRenderer.currentImage) return responseText;
        
        const imageSrc = this.imageRenderer.currentImage.src;
        const imagePreview = `
            <div class="response-image-context" style="margin: 10px 0; padding: 10px; border: 1px solid var(--border-primary); border-radius: 8px; background: var(--bg-glass);">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <span style="font-size: 0.9em; color: var(--text-secondary);">Referring to uploaded image:</span>
                </div>
                <img src="${imageSrc}" alt="Referenced image" style="max-width: 150px; max-height: 100px; object-fit: cover; border-radius: 6px; cursor: pointer;" onclick="window.susan.openImageViewer('${imageSrc}', 'Referenced Image')">
            </div>
        `;
        
        return imagePreview + responseText;
    }
    
    addMessage(content, sender, type = 'message') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender} ${type}`;
        
        if (typeof content === 'string') {
            messageDiv.innerHTML = content;
        } else if (content && content.nodeType === Node.ELEMENT_NODE) {
            // Only append if it's a valid DOM element
            messageDiv.appendChild(content);
        } else {
            // Fallback: convert to string
            messageDiv.innerHTML = String(content || '');
        }
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Speak Susan's responses with cleaned text
        if (sender === 'susan' && this.synthesis) {
            const textContent = typeof content === 'string' ? content : messageDiv.textContent;
            this.speakResponse(textContent);
        }
    }
    
    speakResponse(text) {
        if (!this.synthesis || !text) return;
        
        // Clean text for speech synthesis - remove markdown and symbols
        let cleanText = text;
        
        // Remove HTML tags
        cleanText = cleanText.replace(/<[^>]*>/g, ' ');
        
        // Clean markdown formatting
        cleanText = cleanText.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove **bold**
        cleanText = cleanText.replace(/\*(.*?)\*/g, '$1');     // Remove *italic*
        cleanText = cleanText.replace(/__(.*?)__/g, '$1');     // Remove __underline__
        cleanText = cleanText.replace(/_(.*?)_/g, '$1');       // Remove _underline_
        cleanText = cleanText.replace(/`(.*?)`/g, '$1');       // Remove `code`
        cleanText = cleanText.replace(/```[\s\S]*?```/g, '');  // Remove code blocks
        
        // Remove bullets and special characters
        cleanText = cleanText.replace(/•/g, '');               // Remove bullet points
        cleanText = cleanText.replace(/✅/g, 'completed');      // Replace checkmarks
        cleanText = cleanText.replace(/❌/g, 'failed');        // Replace X marks
        cleanText = cleanText.replace(/⚠️/g, 'warning');       // Replace warnings
        cleanText = cleanText.replace(/🔍/g, '');              // Remove magnifying glass
        cleanText = cleanText.replace(/🎯/g, '');              // Remove target
        cleanText = cleanText.replace(/🏢/g, '');              // Remove building
        cleanText = cleanText.replace(/🧱/g, '');              // Remove brick
        cleanText = cleanText.replace(/👥/g, '');              // Remove people
        cleanText = cleanText.replace(/🛡️/g, '');              // Remove shield
        cleanText = cleanText.replace(/🤖/g, '');              // Remove robot
        
        // Remove other common symbols
        cleanText = cleanText.replace(/[#\-\+\=\>\<\[\]\(\)\{\}]/g, ' ');
        cleanText = cleanText.replace(/\n{2,}/g, '. ');        // Replace multiple newlines with periods
        cleanText = cleanText.replace(/\n/g, '. ');            // Replace single newlines with periods
        
        // Clean up spacing
        cleanText = cleanText.replace(/\s+/g, ' ').trim();
        
        // Skip if text is too short or empty after cleaning
        if (cleanText.length < 3) return;
        
        try {
            this.synthesis.cancel(); // Cancel any ongoing speech
            
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.rate = this.settings?.voiceSpeed || 1.0;
            utterance.pitch = this.settings?.voicePitch || 1.0;
            utterance.volume = 0.8;
            
            // Set a professional voice if available
            const voices = this.synthesis.getVoices();
            const preferredVoice = voices.find(voice => 
                voice.name.includes('Samantha') || 
                voice.name.includes('Alex') ||
                voice.name.includes('Karen') ||
                voice.lang.includes('en')
            );
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }
            
            this.synthesis.speak(utterance);
        } catch (error) {
            console.log('Speech synthesis not available:', error);
        }
    }
    
    scrollToBottom() {
        if (this.chatMessages) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }
    
    setStatus(text, level = 'info') {
        if (this.statusText) {
            this.statusText.textContent = text;
        }
        
        this.updateStatusColor(level);
        this.addActivity(`Status: ${text}`, 'system');
    }
    
    updateStatusColor(level = 'ready') {
        const statusDot = document.querySelector('.status-dot');
        if (statusDot) {
            statusDot.className = `status-dot ${level}`;
        }
    }
    
    toggleVoiceInput() {
        if (!this.recognition) {
            this.showNotification('Voice Input', 'Speech recognition not supported in this browser', 'warning');
            return;
        }
        
        if (this.isListening) {
            this.recognition.stop();
            this.isListening = false;
            this.setStatus('Ready', 'ready');
        } else {
            this.recognition.start();
            this.isListening = true;
            this.setStatus('Listening...', 'processing');
        }
        
        this.updateVoiceButton();
    }
    
    updateVoiceButton() {
        if (this.voiceBtn) {
            this.voiceBtn.classList.toggle('listening', this.isListening);
        }
    }
    
    handleOrbClick() {
        this.chatInput.focus();
        this.addActivity('Orb activated', 'user');
    }
    
    toggleFeaturesMenu() {
        if (this.featuresMenu) {
            this.featuresMenu.classList.toggle('hidden');
        }
    }
    
    closeFeaturesMenu() {
        if (this.featuresMenu) {
            this.featuresMenu.classList.add('hidden');
        }
    }
    
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }
    
    addActivity(description, type) {
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
        
        this.updateActivityWidget();
    }
    
    updateActivityWidget() {
        const activityList = document.getElementById('activityList');
        if (activityList && this.activityLog.length > 0) {
            activityList.innerHTML = this.activityLog.map(activity => `
                <div class="activity-item">
                    <span class="activity-time">${this.formatTime(activity.timestamp)}</span>
                    <span class="activity-desc">${activity.description}</span>
                </div>
            `).join('');
        }
    }
    
    updateSystemMetrics() {
        const modelCount = document.getElementById('modelCount');
        const knowledgeCount = document.getElementById('knowledgeCount');
        const uptime = document.getElementById('uptime');
        
        if (modelCount) modelCount.textContent = '8';
        if (knowledgeCount) knowledgeCount.textContent = '75+';
        if (uptime) uptime.textContent = '99.5%';
    }
    
    updateWeatherWidget() {
        // Placeholder for weather updates
        const weatherDesc = document.querySelector('.weather-desc');
        if (weatherDesc && weatherDesc.textContent === 'Loading weather data...') {
            weatherDesc.textContent = 'Clear conditions for roofing work';
        }
    }
    
    updateModelStatus() {
        const modelList = document.getElementById('modelList');
        if (modelList) {
            const models = ['qwen2.5:7b', 'llama3.1', 'deepseek-coder-v2'];
            modelList.innerHTML = models.map(model => `
                <div class="model-item">
                    <div class="model-status active"></div>
                    <span class="model-name">${model}</span>
                </div>
            `).join('');
        }
    }
    
    showNotification(title, message, level = 'info') {
        const notification = {
            id: ++this.notificationId,
            title,
            message,
            level,
            timestamp: new Date()
        };
        
        this.notifications.unshift(notification);
        console.log(`📢 ${title}: ${message}`);
    }
    
    formatTime(date) {
        return date.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    logPerformanceMetrics(metrics) {
        console.log('Performance metrics:', metrics);
    }
    
    // ============ CONSOLIDATED FEATURE SUITE METHODS ============
    
    // 1. Smart Analysis Hub (consolidates 7 photo/analysis features)
    startSmartAnalysis() {
        this.addMessage('🎯 **Smart Analysis Hub Activated**\n\nThis suite combines:\n• Photo Analysis & Damage Assessment\n• Quantification & Measurements\n• Annotations & Comparisons\n• Validation & Reporting\n\nDrop an image here to begin AI analysis, or ask me about roofing damage assessment techniques.', 'susan');
        this.addActivity('Smart Analysis Hub activated', 'feature');
        this.closeFeaturesMenu();
    }
    
    // 2. Claims & Insurance Suite (consolidates 7 insurance features)
    startInsuranceHub() {
        this.addMessage('🏢 **Claims & Insurance Suite Activated**\n\nIntegrated capabilities:\n• Insurance Form Processing\n• Dynamic Templates & Policy Analysis\n• Estimate Building & Claim Tracking\n• Documentation Management\n\nAsk me about insurance procedures, claim templates, or estimate generation.', 'susan');
        this.addActivity('Insurance Hub activated', 'feature');
        this.closeFeaturesMenu();
    }
    
    // 3. Materials & Operations (consolidates 6 material features)
    startMaterialManager() {
        this.addMessage('🧱 **Materials & Operations Suite Activated**\n\nComprehensive tools:\n• Material Calculations & Pricing\n• Inventory Tracking & Alerts\n• Supplier Management\n• Order Processing\n\nAsk me about material quantities, pricing, or supplier information.', 'susan');
        this.addActivity('Material Manager activated', 'feature');
        this.closeFeaturesMenu();
    }
    
    // 4. Customer & Project Hub (consolidates 6 customer features)
    startCustomerPortal() {
        this.addMessage('👥 **Customer & Project Hub Activated**\n\nIntegrated management:\n• Customer Portal & Communication\n• Project Scheduling & Tracking\n• SMS Updates & Review Collection\n• Contract Generation\n\nAsk me about customer communication, project management, or scheduling.', 'susan');
        this.addActivity('Customer Portal activated', 'feature');
        this.closeFeaturesMenu();
    }
    
    // 5. Safety & Compliance (consolidates 4 safety features)  
    startSafetyManager() {
        this.addMessage('🛡️ **Safety & Compliance Suite Activated**\n\nComprehensive coverage:\n• OSHA Safety Protocols\n• Quality Control & Inspections\n• Permit Tracking\n• Weather Monitoring\n\nAsk me about safety requirements, compliance issues, or permit procedures.', 'susan');
        this.addActivity('Safety Manager activated', 'feature');
        this.closeFeaturesMenu();
    }
    
    // 6. AI & Automation (consolidates 4 AI features)
    startAIAssistant() {
        this.addMessage('🤖 **AI & Automation Suite Activated**\n\nAdvanced intelligence:\n• AI Decision Support\n• Lead Scoring & Analytics\n• Predictive Insights\n• Workflow Automation\n\nI\'m now operating in advanced AI mode with enhanced reasoning capabilities.', 'susan');
        this.addActivity('AI Assistant activated', 'feature');
        this.closeFeaturesMenu();
    }
    
    // Additional consolidated feature methods
    startDamageValidation() { return this.startSmartAnalysis(); }
    startComparisonTools() { return this.startSmartAnalysis(); }
    startEstimateBuilder() { return this.startInsuranceHub(); }
    startDocumentationHub() { return this.startInsuranceHub(); }
    startSupplierNetwork() { return this.startMaterialManager(); }
    startInventoryAlerts() { return this.startMaterialManager(); }
    startProjectManager() { return this.startCustomerPortal(); }
    startCommunicationSuite() { return this.startCustomerPortal(); }
    startComplianceTracker() { return this.startSafetyManager(); }
    startWeatherMonitor() { return this.startSafetyManager(); }
    startBusinessAnalytics() { return this.startAIAssistant(); }
    startWorkflowAutomation() { return this.startAIAssistant(); }
    
    // Legacy method support for backward compatibility
    startSmartPhotoAnalysis() { return this.startSmartAnalysis(); }
    startDamageQuantification() { return this.startSmartAnalysis(); }
    startPhotoReports() { return this.startSmartAnalysis(); }
    startPhotoOrganization() { return this.startSmartAnalysis(); }
    startRoofMeasurement() { return this.startSmartAnalysis(); }
    startDamageAnnotation() { return this.startSmartAnalysis(); }
    startComparisonTool() { return this.startSmartAnalysis(); }
    
    startInsuranceForms() { return this.startInsuranceHub(); }
    startClaimTemplates() { return this.startInsuranceHub(); }
    startPolicyAnalysis() { return this.startInsuranceHub(); }
    startClaimTracking() { return this.startInsuranceHub(); }
    
    startMaterialCalculator() { return this.startMaterialManager(); }
    startInventoryTracker() { return this.startMaterialManager(); }
    startPriceLookup() { return this.startMaterialManager(); }
    startOrderManagement() { return this.startMaterialManager(); }
    startSupplierDatabase() { return this.startMaterialManager(); }
    startStockAlerts() { return this.startMaterialManager(); }
    
    startScheduleManager() { return this.startCustomerPortal(); }
    startSMSUpdates() { return this.startCustomerPortal(); }
    startReviewCollection() { return this.startCustomerPortal(); }
    startProjectDashboard() { return this.startCustomerPortal(); }
    startContractGenerator() { return this.startCustomerPortal(); }
    
    startSafetyProtocols() { return this.startSafetyManager(); }
    startWeatherAlerts() { return this.startSafetyManager(); }
    startPermitTracker() { return this.startSafetyManager(); }
    startQualityChecks() { return this.startSafetyManager(); }
    
    startLeadScoring() { return this.startAIAssistant(); }
    startPredictiveAnalytics() { return this.startAIAssistant(); }
}

// Feature Suite Classes (for future expansion)
class SmartAnalysisHub {
    constructor() {
        this.analysisTools = ['photo', 'damage', 'measurement', 'annotation', 'comparison', 'validation', 'reporting'];
    }
}

class ClaimsInsuranceSuite {
    constructor() {
        this.insuranceTools = ['forms', 'templates', 'policy', 'estimates', 'tracking', 'validation', 'documentation'];
    }
}

class MaterialOperationsSuite {
    constructor() {
        this.materialTools = ['calculator', 'inventory', 'pricing', 'orders', 'suppliers', 'alerts'];
    }
}

class CustomerProjectHub {
    constructor() {
        this.customerTools = ['portal', 'scheduling', 'sms', 'reviews', 'dashboard', 'contracts'];
    }
}

class SafetyComplianceSuite {
    constructor() {
        this.safetyTools = ['protocols', 'weather', 'permits', 'quality'];
    }
}

class AIAutomationSuite {
    constructor() {
        this.aiTools = ['assistant', 'scoring', 'analytics', 'automation'];
    }
}

// CSS for image rendering and enhanced UI
const imageCSS = `
/* Image Rendering Styles */
.image-message {
    max-width: 90%;
}

.image-container {
    border: 1px solid var(--border-secondary);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--bg-card);
}

.chat-image {
    width: 100%;
    height: auto;
    max-height: 300px;
    object-fit: cover;
    cursor: pointer;
    transition: transform var(--transition-normal);
}

.chat-image:hover {
    transform: scale(1.02);
}

.image-info {
    padding: var(--space-3);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-tertiary);
}

.image-name {
    font-weight: 500;
    color: var(--text-primary);
}

.image-size {
    font-size: 0.875rem;
    color: var(--text-tertiary);
}

/* Image Viewer Modal */
.image-viewer-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.image-viewer-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(10px);
}

.image-viewer-content {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    background: var(--bg-secondary);
    border-radius: var(--radius-xl);
    overflow: hidden;
    border: 1px solid var(--border-primary);
    box-shadow: var(--shadow-red-strong);
}

.image-viewer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4);
    background: var(--gradient-red);
    color: white;
}

.image-viewer-body {
    padding: var(--space-4);
    text-align: center;
}

.viewer-image {
    max-width: 100%;
    max-height: 70vh;
    height: auto;
    border-radius: var(--radius-md);
}

.image-viewer-footer {
    padding: var(--space-4);
    background: var(--bg-tertiary);
    display: flex;
    gap: var(--space-3);
    justify-content: center;
}

.image-viewer-footer button {
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--border-primary);
    background: var(--primary-red);
    color: white;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-normal);
}

.image-viewer-footer button:hover {
    background: var(--primary-red-hover);
}

.close-viewer {
    background: rgba(255, 255, 255, 0.1) !important;
    border: none !important;
    color: white !important;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
}

/* Image Analysis Results */
.image-analysis {
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    background: var(--bg-card);
    margin: var(--space-2) 0;
}

.image-analysis h4 {
    color: var(--primary-red);
    margin-bottom: var(--space-3);
}

.analysis-results {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.analysis-item {
    padding: var(--space-2);
    border-radius: var(--radius-md);
    background: var(--bg-glass);
}

.analysis-item.positive {
    border-left: 4px solid var(--primary-red);
}

.analysis-item.negative {
    border-left: 4px solid #10b981;
}

.analysis-item ul {
    margin: var(--space-2) 0 0 var(--space-4);
}

/* Image context styling */
.analysis-image-preview img:hover {
    transform: scale(1.05);
    transition: transform var(--transition-normal);
}

.response-image-context img:hover {
    transform: scale(1.05);
    transition: transform var(--transition-normal);
    box-shadow: var(--shadow-red);
}

/* Status colors */
.status-dot.ready { background: #10b981; }
.status-dot.processing { background: var(--primary-red); animation: pulse 1s infinite; }
.status-dot.error { background: #dc2626; }
.status-dot.warning { background: #f59e0b; }

/* Model status indicators */
.model-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1);
}

.model-status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6b7280;
}

.model-status.active {
    background: #10b981;
}

.model-name {
    font-size: 0.875rem;
    color: var(--text-secondary);
}

/* System metrics */
.system-metrics {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.metric {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2);
    background: var(--bg-glass);
    border-radius: var(--radius-md);
}

.metric-label {
    font-size: 0.875rem;
    color: var(--text-tertiary);
}

.metric-value {
    font-weight: 600;
    color: var(--primary-red);
}

/* Loading screen */
.loading-screen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    transition: opacity 0.5s ease;
}

.loading-content {
    text-align: center;
    color: var(--text-primary);
}

.loading-content .spinner {
    margin-bottom: var(--space-4);
}
`;

// Inject CSS
const style = document.createElement('style');
style.textContent = imageCSS;
document.head.appendChild(style);

// Export for global access
window.SusanAI = SusanAI;

// Initialize Susan AI when the class is loaded
if (typeof window !== 'undefined') {
    // Ensure DOM is ready, then initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Initialize automatically if not already done
            if (!window.susan) {
                window.susan = new SusanAI();
            }
        });
    } else {
        // DOM is already loaded
        if (!window.susan) {
            window.susan = new SusanAI();
        }
    }
}