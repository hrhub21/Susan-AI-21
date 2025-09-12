/**
 * Susan AI Roofing Analysis Frontend
 * Handles image upload, drag/drop, analysis progress, and results display
 */

class RoofingAnalysisApp {
    constructor() {
        this.apiBaseUrl = `${window.location.protocol}//${window.location.hostname}:3001/api/v1`;
        this.websocket = null;
        this.uploadedFiles = new Map();
        this.analysisResults = new Map();
        this.currentAnalysis = null;
        this.wsReconnectTimer = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupWebSocket();
        this.updateAnalysisStatus('ready', 'Ready for Analysis');
        
        console.log('🚀 Susan AI Roofing Analysis initialized');
    }

    initializeElements() {
        // Main elements
        this.photoDropZone = document.getElementById('photoDropZone');
        this.fileInput = document.getElementById('fileInput');
        this.photoGrid = document.getElementById('photoGrid');
        this.photoThumbnails = document.getElementById('photoThumbnails');
        this.analyzeBtn = document.getElementById('analyzeBtn');
        this.clearPhotos = document.getElementById('clearPhotos');
        
        // Progress elements
        this.analysisProgress = document.getElementById('analysisProgress');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.currentOperation = document.getElementById('currentOperation');
        
        // Results elements
        this.resultsSection = document.getElementById('resultsSection');
        this.overallAssessment = document.getElementById('overallAssessment');
        
        // Stats elements
        this.totalPhotos = document.getElementById('totalPhotos');
        this.damageCount = document.getElementById('damageCount');
        this.confidenceAvg = document.getElementById('confidenceAvg');
        
        // Status elements
        this.analysisStatus = document.getElementById('analysisStatus');
        this.confidenceFill = document.getElementById('confidenceFill');
        this.confidenceValue = document.getElementById('confidenceValue');
        
        // Analysis feed
        this.analysisFeed = document.getElementById('analysisFeed');
        
        // Create file input if it doesn't exist
        if (!this.fileInput) {
            this.fileInput = document.createElement('input');
            this.fileInput.type = 'file';
            this.fileInput.id = 'fileInput';
            this.fileInput.multiple = true;
            this.fileInput.accept = 'image/*';
            this.fileInput.style.display = 'none';
            document.body.appendChild(this.fileInput);
        }
    }

    setupEventListeners() {
        // Drag and drop handlers
        this.photoDropZone.addEventListener('click', () => this.fileInput.click());
        this.photoDropZone.addEventListener('dragover', this.handleDragOver.bind(this));
        this.photoDropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.photoDropZone.addEventListener('drop', this.handleDrop.bind(this));
        
        // File input handler
        this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        
        // Button handlers
        this.analyzeBtn?.addEventListener('click', this.startAnalysis.bind(this));
        this.clearPhotos?.addEventListener('click', this.clearAllPhotos.bind(this));
        
        // Tab handlers
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Prevent default drag behavior on document
        document.addEventListener('dragover', e => e.preventDefault());
        document.addEventListener('drop', e => e.preventDefault());
    }

    setupWebSocket() {
        const wsUrl = `ws://${window.location.hostname}:3001/ws`;
        console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
        
        try {
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('✅ WebSocket connected');
                this.addToFeed('system', 'WebSocket connection established', 'Connected to real-time analysis service');
                this.clearReconnectTimer();
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('WebSocket message parse error:', error);
                }
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.addToFeed('error', 'WebSocket error', 'Connection issues detected');
            };
            
            this.websocket.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                this.addToFeed('warning', 'WebSocket disconnected', 'Attempting to reconnect...');
                this.scheduleReconnect();
            };
            
        } catch (error) {
            console.error('WebSocket setup error:', error);
            this.addToFeed('error', 'WebSocket unavailable', 'Real-time updates disabled');
        }
    }

    scheduleReconnect() {
        this.clearReconnectTimer();
        this.wsReconnectTimer = setTimeout(() => {
            console.log('🔄 Attempting WebSocket reconnection...');
            this.setupWebSocket();
        }, 3000);
    }

    clearReconnectTimer() {
        if (this.wsReconnectTimer) {
            clearTimeout(this.wsReconnectTimer);
            this.wsReconnectTimer = null;
        }
    }

    handleWebSocketMessage(data) {
        console.log('📨 WebSocket message:', data);
        
        switch (data.type) {
            case 'analysis_progress':
                this.updateProgress(data.progress, data.message, data.operation);
                break;
            case 'analysis_complete':
                this.handleAnalysisComplete(data.results);
                break;
            case 'analysis_error':
                this.handleAnalysisError(data.error);
                break;
            case 'system_status':
                this.updateAnalysisStatus(data.status, data.message);
                break;
            default:
                console.log('Unknown WebSocket message type:', data.type);
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        this.photoDropZone.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        this.photoDropZone.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.photoDropZone.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
    }

    processFiles(files) {
        console.log(`📁 Processing ${files.length} files`);
        
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            this.showNotification('Please select only image files (JPG, PNG, WebP, TIFF)', 'error');
            return;
        }

        if (imageFiles.length > 20) {
            this.showNotification('Maximum 20 images allowed at once', 'warning');
            return;
        }

        imageFiles.forEach(file => this.addPhotoToGrid(file));
        this.updateAnalyzeButton();
        this.showPhotoGrid();
        
        this.addToFeed('success', `${imageFiles.length} photos uploaded`, 'Ready for analysis');
        this.showNotification(`${imageFiles.length} photos uploaded successfully`, 'success');
    }

    addPhotoToGrid(file) {
        const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.uploadedFiles.set(fileId, file);

        const reader = new FileReader();
        reader.onload = (e) => {
            const thumbnail = this.createThumbnail(fileId, file.name, e.target.result);
            this.photoThumbnails.appendChild(thumbnail);
            this.updateStats();
        };
        reader.readAsDataURL(file);
    }

    createThumbnail(fileId, fileName, dataUrl) {
        const thumbnail = document.createElement('div');
        thumbnail.className = 'photo-thumbnail';
        thumbnail.dataset.fileId = fileId;
        
        thumbnail.innerHTML = `
            <div class="thumbnail-image">
                <img src="${dataUrl}" alt="${fileName}" loading="lazy">
                <div class="thumbnail-overlay">
                    <button class="remove-photo" data-file-id="${fileId}" title="Remove photo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="thumbnail-info">
                <div class="thumbnail-name" title="${fileName}">${fileName}</div>
                <div class="thumbnail-status">Ready</div>
            </div>
            <div class="analysis-overlay" style="display: none;">
                <div class="analysis-spinner"></div>
                <div class="analysis-text">Analyzing...</div>
            </div>
        `;

        // Add remove button handler
        const removeBtn = thumbnail.querySelector('.remove-photo');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removePhoto(fileId);
        });

        return thumbnail;
    }

    removePhoto(fileId) {
        this.uploadedFiles.delete(fileId);
        this.analysisResults.delete(fileId);
        
        const thumbnail = document.querySelector(`[data-file-id="${fileId}"]`);
        if (thumbnail) {
            thumbnail.remove();
        }

        this.updateAnalyzeButton();
        this.updateStats();
        
        if (this.uploadedFiles.size === 0) {
            this.hidePhotoGrid();
        }
    }

    clearAllPhotos() {
        this.uploadedFiles.clear();
        this.analysisResults.clear();
        this.photoThumbnails.innerHTML = '';
        this.hidePhotoGrid();
        this.hideResults();
        this.updateStats();
        this.addToFeed('info', 'All photos cleared', 'Ready for new uploads');
    }

    showPhotoGrid() {
        this.photoGrid.style.display = 'block';
    }

    hidePhotoGrid() {
        this.photoGrid.style.display = 'none';
        this.fileInput.value = '';
    }

    updateAnalyzeButton() {
        if (!this.analyzeBtn) return;
        
        const hasFiles = this.uploadedFiles.size > 0;
        const isAnalyzing = this.currentAnalysis !== null;
        
        this.analyzeBtn.disabled = !hasFiles || isAnalyzing;
        this.analyzeBtn.textContent = isAnalyzing ? 'Analyzing...' : `Analyze ${this.uploadedFiles.size} Photos`;
    }

    async startAnalysis() {
        if (this.uploadedFiles.size === 0) {
            this.showNotification('Please upload photos first', 'warning');
            return;
        }

        console.log(`🔍 Starting analysis of ${this.uploadedFiles.size} photos`);
        
        this.currentAnalysis = {
            startTime: Date.now(),
            totalFiles: this.uploadedFiles.size,
            completedFiles: 0,
            results: new Map()
        };

        this.showAnalysisProgress();
        this.updateAnalysisStatus('analyzing', 'Analysis in Progress');
        this.updateAnalyzeButton();

        const fileEntries = Array.from(this.uploadedFiles.entries());
        
        try {
            // Process files in parallel (max 3 concurrent)
            await this.processFilesInBatches(fileEntries, 3);
            
            this.completeAnalysis();
            
        } catch (error) {
            console.error('Analysis error:', error);
            this.handleAnalysisError(error.message);
        }
    }

    async processFilesInBatches(fileEntries, batchSize) {
        for (let i = 0; i < fileEntries.length; i += batchSize) {
            const batch = fileEntries.slice(i, i + batchSize);
            const promises = batch.map(([fileId, file]) => this.analyzePhoto(fileId, file));
            
            await Promise.allSettled(promises);
        }
    }

    async analyzePhoto(fileId, file) {
        const thumbnail = document.querySelector(`[data-file-id="${fileId}"]`);
        
        try {
            // Show analyzing state
            this.setThumbnailStatus(thumbnail, 'analyzing', 'Analyzing...');
            
            // Convert file to base64
            const dataUrl = await this.fileToDataUrl(file);
            
            // Make API request
            const response = await fetch(`${this.apiBaseUrl}/photo-analysis/analyze-photo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: dataUrl,
                    filename: file.name
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log(`✅ Analysis complete for ${file.name}:`, result);
            
            // Store result
            this.analysisResults.set(fileId, result);
            this.currentAnalysis.results.set(fileId, result);
            this.currentAnalysis.completedFiles++;
            
            // Update thumbnail
            this.setThumbnailStatus(thumbnail, 'complete', result.damageType || 'Complete');
            
            // Update progress
            const progress = (this.currentAnalysis.completedFiles / this.currentAnalysis.totalFiles) * 100;
            this.updateProgress(progress, `${this.currentAnalysis.completedFiles}/${this.currentAnalysis.totalFiles} photos analyzed`, result.damageType);
            
        } catch (error) {
            console.error(`❌ Analysis failed for ${file.name}:`, error);
            
            // Store error result
            const errorResult = {
                damageType: 'Analysis failed',
                severity: 'Unknown',
                confidence: 0,
                description: `Analysis failed: ${error.message}`,
                error: error.message,
                filename: file.name
            };
            
            this.analysisResults.set(fileId, errorResult);
            this.currentAnalysis.results.set(fileId, errorResult);
            this.currentAnalysis.completedFiles++;
            
            // Update thumbnail
            this.setThumbnailStatus(thumbnail, 'error', 'Failed');
            
            // Update progress
            const progress = (this.currentAnalysis.completedFiles / this.currentAnalysis.totalFiles) * 100;
            this.updateProgress(progress, `${this.currentAnalysis.completedFiles}/${this.currentAnalysis.totalFiles} photos processed`, 'Error occurred');
        }
    }

    setThumbnailStatus(thumbnail, status, text) {
        if (!thumbnail) return;
        
        const statusEl = thumbnail.querySelector('.thumbnail-status');
        const overlayEl = thumbnail.querySelector('.analysis-overlay');
        
        thumbnail.className = `photo-thumbnail ${status}`;
        
        if (statusEl) statusEl.textContent = text;
        
        if (overlayEl) {
            overlayEl.style.display = status === 'analyzing' ? 'flex' : 'none';
        }
    }

    fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    showAnalysisProgress() {
        this.analysisProgress.style.display = 'block';
        this.updateProgress(0, 'Starting analysis...', 'Initializing AI models');
    }

    hideAnalysisProgress() {
        this.analysisProgress.style.display = 'none';
    }

    updateProgress(percentage, text, operation) {
        if (this.progressFill) {
            this.progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
        }
        
        if (this.progressText) {
            this.progressText.textContent = text;
        }
        
        if (this.currentOperation) {
            this.currentOperation.textContent = operation || '';
        }
    }

    completeAnalysis() {
        const totalTime = (Date.now() - this.currentAnalysis.startTime) / 1000;
        console.log(`✅ Analysis complete in ${totalTime}s`);
        
        this.hideAnalysisProgress();
        this.updateAnalysisStatus('complete', 'Analysis Complete');
        this.currentAnalysis = null;
        this.updateAnalyzeButton();
        
        // Calculate statistics
        const results = Array.from(this.analysisResults.values());
        const damageDetected = results.filter(r => r.damageType && r.damageType !== 'No roofing damage detected' && !r.error).length;
        const avgConfidence = results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length;
        
        // Update stats
        this.updateStats();
        this.updateConfidence(avgConfidence);
        
        // Show results
        this.displayResults(results);
        this.showResults();
        
        // Add to feed
        this.addToFeed('success', 'Analysis complete', `${damageDetected} damage instances detected with ${avgConfidence.toFixed(1)}% average confidence`);
        
        this.showNotification(`Analysis complete! Found ${damageDetected} potential damage instances`, 'success');
    }

    handleAnalysisError(error) {
        console.error('Analysis error:', error);
        
        this.hideAnalysisProgress();
        this.updateAnalysisStatus('error', 'Analysis Failed');
        this.currentAnalysis = null;
        this.updateAnalyzeButton();
        
        this.addToFeed('error', 'Analysis failed', error);
        this.showNotification(`Analysis failed: ${error}`, 'error');
    }

    displayResults(results) {
        if (!this.overallAssessment) return;
        
        const damageCount = results.filter(r => r.damageType && r.damageType !== 'No roofing damage detected' && !r.error).length;
        const avgConfidence = results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length;
        const severityCount = this.categorizeSeverity(results);
        
        this.overallAssessment.innerHTML = `
            <div class="assessment-header">
                <h3>Overall Assessment</h3>
                <div class="assessment-badges">
                    <div class="badge ${damageCount > 0 ? (damageCount > 5 ? 'severe' : 'moderate') : 'good'}">
                        ${damageCount > 0 ? `${damageCount} Issues Found` : 'No Major Issues'}
                    </div>
                    <div class="badge confidence">
                        ${avgConfidence.toFixed(1)}% Confidence
                    </div>
                </div>
            </div>
            <div class="assessment-summary">
                <div class="summary-stats">
                    <div class="stat">
                        <span class="stat-number">${results.length}</span>
                        <span class="stat-label">Photos Analyzed</span>
                    </div>
                    <div class="stat">
                        <span class="stat-number">${damageCount}</span>
                        <span class="stat-label">Issues Detected</span>
                    </div>
                    <div class="stat">
                        <span class="stat-number">${severityCount.high}</span>
                        <span class="stat-label">High Priority</span>
                    </div>
                    <div class="stat">
                        <span class="stat-number">${severityCount.moderate}</span>
                        <span class="stat-label">Moderate</span>
                    </div>
                </div>
            </div>
        `;
        
        // Update damage categories
        this.updateDamageCategories(results);
    }

    categorizeSeverity(results) {
        return results.reduce((acc, result) => {
            if (result.severity === 'High') acc.high++;
            else if (result.severity === 'Moderate') acc.moderate++;
            else if (result.severity === 'Low') acc.low++;
            return acc;
        }, { high: 0, moderate: 0, low: 0 });
    }

    updateDamageCategories(results) {
        const categories = {
            hail: results.filter(r => r.damageType?.toLowerCase().includes('hail')),
            wind: results.filter(r => r.damageType?.toLowerCase().includes('wind')),
            granule: results.filter(r => r.damageType?.toLowerCase().includes('granule')),
            collateral: results.filter(r => r.damageType?.toLowerCase().includes('collateral') || r.damageType?.toLowerCase().includes('gutter'))
        };

        Object.entries(categories).forEach(([type, damages]) => {
            const severityEl = document.getElementById(`${type}Severity`);
            const contentEl = document.getElementById(`${type}Content`);
            
            if (severityEl && contentEl) {
                if (damages.length > 0) {
                    const maxSeverity = this.getMaxSeverity(damages);
                    severityEl.textContent = `${damages.length} Detected (${maxSeverity})`;
                    severityEl.className = `severity-badge ${maxSeverity.toLowerCase()}`;
                    
                    contentEl.innerHTML = damages.map(d => `
                        <div class="damage-item">
                            <div class="damage-info">
                                <strong>${d.filename}</strong>
                                <p>${d.description}</p>
                            </div>
                            <div class="damage-meta">
                                <span class="confidence">${d.confidence}% confidence</span>
                            </div>
                        </div>
                    `).join('');
                } else {
                    severityEl.textContent = 'Not Detected';
                    severityEl.className = 'severity-badge none';
                    contentEl.innerHTML = '<p>No damage of this type detected in the uploaded photos.</p>';
                }
            }
        });
    }

    getMaxSeverity(damages) {
        const severities = damages.map(d => d.severity).filter(Boolean);
        if (severities.includes('High')) return 'High';
        if (severities.includes('Moderate')) return 'Moderate';
        if (severities.includes('Low')) return 'Low';
        return 'Unknown';
    }

    showResults() {
        if (this.resultsSection) {
            this.resultsSection.style.display = 'block';
            this.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    hideResults() {
        if (this.resultsSection) {
            this.resultsSection.style.display = 'none';
        }
    }

    updateStats() {
        const photoCount = this.uploadedFiles.size;
        const results = Array.from(this.analysisResults.values());
        const damageCount = results.filter(r => r.damageType && r.damageType !== 'No roofing damage detected' && !r.error).length;
        const avgConfidence = results.length > 0 ? results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length : 0;
        
        if (this.totalPhotos) this.totalPhotos.textContent = photoCount;
        if (this.damageCount) this.damageCount.textContent = damageCount;
        if (this.confidenceAvg) this.confidenceAvg.textContent = `${avgConfidence.toFixed(0)}%`;
    }

    updateConfidence(confidence) {
        const safeConfidence = Math.min(100, Math.max(0, confidence || 0));
        
        if (this.confidenceFill) {
            this.confidenceFill.style.width = `${safeConfidence}%`;
        }
        
        if (this.confidenceValue) {
            this.confidenceValue.textContent = `${safeConfidence.toFixed(1)}%`;
        }
    }

    updateAnalysisStatus(status, message) {
        if (!this.analysisStatus) return;
        
        const statusDot = this.analysisStatus.querySelector('.status-dot');
        const statusText = this.analysisStatus.querySelector('.status-text');
        
        if (statusDot) {
            statusDot.className = `status-dot ${status}`;
        }
        
        if (statusText) {
            statusText.textContent = message;
        }
    }

    addToFeed(type, title, message) {
        if (!this.analysisFeed) return;
        
        const feedItem = document.createElement('div');
        feedItem.className = `feed-item ${type}`;
        
        feedItem.innerHTML = `
            <div class="item-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    ${this.getFeedIcon(type)}
                </svg>
            </div>
            <div class="item-content">
                <div class="item-title">${title}</div>
                <div class="item-text">${message}</div>
                <div class="item-time">${new Date().toLocaleTimeString()}</div>
            </div>
        `;
        
        // Insert at top
        this.analysisFeed.insertBefore(feedItem, this.analysisFeed.firstChild);
        
        // Limit feed items
        const feedItems = this.analysisFeed.querySelectorAll('.feed-item');
        if (feedItems.length > 20) {
            feedItems[feedItems.length - 1].remove();
        }
    }

    getFeedIcon(type) {
        const icons = {
            success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22,4 12,14.01 9,11.01"></polyline>',
            error: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
            warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
            info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
            system: '<circle cx="12" cy="12" r="3"></circle>'
        };
        return icons[type] || icons.info;
    }

    switchTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabId}Tab`);
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${this.getFeedIcon(type)}
                    </svg>
                </div>
                <div class="notification-message">${message}</div>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `;
        
        const container = document.getElementById('notificationContainer');
        if (container) {
            container.appendChild(notification);
            
            // Auto remove after 5 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 5000);
        }
    }

    // Public API for testing
    getUploadedFilesCount() {
        return this.uploadedFiles.size;
    }

    getAnalysisResultsCount() {
        return this.analysisResults.size;
    }

    isAnalyzing() {
        return this.currentAnalysis !== null;
    }

    getWebSocketState() {
        return this.websocket?.readyState;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.roofingApp = new RoofingAnalysisApp();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoofingAnalysisApp;
}