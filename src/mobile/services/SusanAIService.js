/**
 * Susan AI Service for Mobile App
 * Handles communication with Susan AI backend services
 */
export class SusanAIService {
  static instance = null;
  
  constructor() {
    if (SusanAIService.instance) {
      return SusanAIService.instance;
    }
    
    this.isInitialized = false;
    this.baseURL = 'https://api.susanai.roof-er.com'; // Production URL
    this.apiVersion = 'v1';
    this.timeout = 30000; // 30 seconds
    
    // API endpoints
    this.endpoints = {
      claims: '/claims',
      photos: '/photos',
      analysis: '/analysis',
      templates: '/templates',
      sync: '/sync',
      auth: '/auth',
      settings: '/settings'
    };
    
    // Request headers
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'SusanAI-Mobile/1.0.0',
      'X-API-Version': this.apiVersion
    };
    
    // Authentication
    this.authToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    
    SusanAIService.instance = this;
  }

  static async initialize() {
    const instance = new SusanAIService();
    await instance.init();
    return instance;
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      console.log('🤖 Initializing Susan AI Service...');
      
      // Load saved authentication tokens
      await this.loadAuthTokens();
      
      // Validate connection
      await this.validateConnection();
      
      this.isInitialized = true;
      console.log('✅ Susan AI Service initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Susan AI service:', error);
      throw error;
    }
  }

  async loadAuthTokens() {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      
      const tokenData = await AsyncStorage.getItem('@SusanAI:auth_tokens');
      if (tokenData) {
        const { authToken, refreshToken, tokenExpiry } = JSON.parse(tokenData);
        this.authToken = authToken;
        this.refreshToken = refreshToken;
        this.tokenExpiry = tokenExpiry;
        
        // Check if token needs refresh
        if (this.isTokenExpired()) {
          await this.refreshAuthToken();
        }
      }
    } catch (error) {
      console.error('❌ Error loading auth tokens:', error);
    }
  }

  async saveAuthTokens() {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      
      const tokenData = {
        authToken: this.authToken,
        refreshToken: this.refreshToken,
        tokenExpiry: this.tokenExpiry
      };
      
      await AsyncStorage.setItem('@SusanAI:auth_tokens', JSON.stringify(tokenData));
    } catch (error) {
      console.error('❌ Error saving auth tokens:', error);
    }
  }

  isTokenExpired() {
    if (!this.tokenExpiry) return true;
    return new Date().toISOString() > this.tokenExpiry;
  }

  async validateConnection() {
    try {
      const response = await this.makeRequest('GET', '/health');
      
      if (response.status === 'ok') {
        console.log('✅ Susan AI backend connection validated');
        return true;
      } else {
        throw new Error('Backend health check failed');
      }
    } catch (error) {
      console.warn('⚠️ Backend connection validation failed:', error.message);
      // Don't throw error - allow offline mode
      return false;
    }
  }

  async makeRequest(method, endpoint, data = null, options = {}) {
    try {
      const url = `${this.baseURL}/api/${this.apiVersion}${endpoint}`;
      
      // Prepare headers
      const headers = {
        ...this.defaultHeaders,
        ...options.headers
      };
      
      // Add authentication if available
      if (this.authToken && !this.isTokenExpired()) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }
      
      // Prepare request configuration
      const config = {
        method,
        headers,
        timeout: options.timeout || this.timeout
      };
      
      // Add body for POST/PUT requests
      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        if (data instanceof FormData) {
          // For file uploads
          delete headers['Content-Type']; // Let browser set it
          config.body = data;
        } else {
          config.body = JSON.stringify(data);
        }
      }
      
      console.log(`🌐 ${method} ${url}`);
      
      // Make request
      const response = await fetch(url, config);
      
      // Handle authentication errors
      if (response.status === 401 && this.refreshToken) {
        await this.refreshAuthToken();
        
        // Retry request with new token
        headers['Authorization'] = `Bearer ${this.authToken}`;
        const retryResponse = await fetch(url, { ...config, headers });
        return await this.handleResponse(retryResponse);
      }
      
      return await this.handleResponse(response);
      
    } catch (error) {
      console.error(`❌ Request failed: ${method} ${endpoint}`, error);
      throw this.handleRequestError(error);
    }
  }

  async handleResponse(response) {
    const contentType = response.headers.get('content-type');
    
    let responseData;
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }
    
    if (!response.ok) {
      throw new Error(responseData.message || responseData || `HTTP ${response.status}`);
    }
    
    return responseData;
  }

  handleRequestError(error) {
    if (error.name === 'TypeError' && error.message.includes('Network request failed')) {
      return new Error('Network connection failed. Please check your internet connection.');
    } else if (error.name === 'TimeoutError') {
      return new Error('Request timed out. Please try again.');
    } else {
      return error;
    }
  }

  async refreshAuthToken() {
    try {
      if (!this.refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const response = await this.makeRequest('POST', '/auth/refresh', {
        refreshToken: this.refreshToken
      });
      
      this.authToken = response.authToken;
      this.refreshToken = response.refreshToken;
      this.tokenExpiry = response.expiresAt;
      
      await this.saveAuthTokens();
      
      console.log('✅ Auth token refreshed');
      
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      
      // Clear invalid tokens
      this.authToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
      await this.saveAuthTokens();
      
      throw error;
    }
  }

  // Authentication methods
  async login(credentials) {
    try {
      const response = await this.makeRequest('POST', '/auth/login', credentials);
      
      this.authToken = response.authToken;
      this.refreshToken = response.refreshToken;
      this.tokenExpiry = response.expiresAt;
      
      await this.saveAuthTokens();
      
      return {
        success: true,
        user: response.user,
        message: 'Login successful'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async logout() {
    try {
      if (this.authToken) {
        await this.makeRequest('POST', '/auth/logout');
      }
    } catch (error) {
      console.error('❌ Logout request failed:', error);
    } finally {
      // Clear tokens regardless of request success
      this.authToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
      await this.saveAuthTokens();
    }
  }

  // Claim operations
  async uploadClaim(claimData) {
    try {
      const response = await this.makeRequest('POST', this.endpoints.claims, claimData);
      
      return {
        success: true,
        claimId: response.claimId,
        message: 'Claim uploaded successfully'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateClaim(claimId, claimData) {
    try {
      const response = await this.makeRequest('PUT', `${this.endpoints.claims}/${claimId}`, claimData);
      
      return {
        success: true,
        claim: response.claim,
        message: 'Claim updated successfully'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteClaim(claimId) {
    try {
      await this.makeRequest('DELETE', `${this.endpoints.claims}/${claimId}`);
      
      return {
        success: true,
        message: 'Claim deleted successfully'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getClaim(claimId) {
    try {
      const response = await this.makeRequest('GET', `${this.endpoints.claims}/${claimId}`);
      
      return {
        success: true,
        claim: response.claim
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getClaims(filters = {}) {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const endpoint = queryParams ? `${this.endpoints.claims}?${queryParams}` : this.endpoints.claims;
      
      const response = await this.makeRequest('GET', endpoint);
      
      return {
        success: true,
        claims: response.claims,
        pagination: response.pagination
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Photo operations
  async uploadPhoto(photoData) {
    try {
      const formData = new FormData();
      
      // Add photo file
      formData.append('photo', {
        uri: `data:image/jpeg;base64,${photoData.base64}`,
        type: 'image/jpeg',
        name: photoData.filename || 'photo.jpg'
      });
      
      // Add metadata
      formData.append('claimId', photoData.claimId);
      formData.append('timestamp', photoData.timestamp);
      formData.append('damageType', photoData.damageType || 'unknown');
      
      if (photoData.location) {
        formData.append('location', JSON.stringify(photoData.location));
      }
      
      if (photoData.aiAnalysis) {
        formData.append('aiAnalysis', JSON.stringify(photoData.aiAnalysis));
      }
      
      const response = await this.makeRequest('POST', this.endpoints.photos, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return {
        success: true,
        photoId: response.photoId,
        url: response.url,
        message: 'Photo uploaded successfully'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deletePhoto(photoId) {
    try {
      await this.makeRequest('DELETE', `${this.endpoints.photos}/${photoId}`);
      
      return {
        success: true,
        message: 'Photo deleted successfully'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getPhoto(photoId) {
    try {
      const response = await this.makeRequest('GET', `${this.endpoints.photos}/${photoId}`);
      
      return {
        success: true,
        photo: response.photo
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // AI Analysis operations
  async analyzePhoto(photoData) {
    try {
      const formData = new FormData();
      
      formData.append('photo', {
        uri: `data:image/jpeg;base64,${photoData.base64}`,
        type: 'image/jpeg',
        name: 'analysis.jpg'
      });
      
      formData.append('analysisType', photoData.analysisType || 'damage_assessment');
      
      if (photoData.location) {
        formData.append('location', JSON.stringify(photoData.location));
      }
      
      const response = await this.makeRequest('POST', `${this.endpoints.analysis}/photo`, formData, {
        timeout: 60000 // 60 seconds for AI analysis
      });
      
      return {
        success: true,
        analysis: response.analysis,
        confidence: response.confidence,
        recommendations: response.recommendations
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateReport(claimId, reportType = 'comprehensive') {
    try {
      const response = await this.makeRequest('POST', `${this.endpoints.analysis}/report`, {
        claimId,
        reportType
      }, {
        timeout: 120000 // 2 minutes for report generation
      });
      
      return {
        success: true,
        reportId: response.reportId,
        reportUrl: response.reportUrl,
        message: 'Report generated successfully'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Template operations
  async getTemplates(category = null) {
    try {
      const endpoint = category 
        ? `${this.endpoints.templates}?category=${category}`
        : this.endpoints.templates;
      
      const response = await this.makeRequest('GET', endpoint);
      
      return {
        success: true,
        templates: response.templates
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getOptimalTemplate(adjusterInfo, claimContext) {
    try {
      const response = await this.makeRequest('POST', `${this.endpoints.templates}/optimal`, {
        adjusterInfo,
        claimContext
      });
      
      return {
        success: true,
        template: response.template,
        confidence: response.confidence,
        reasoning: response.reasoning
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Analytics operations
  async uploadAnalytics(analyticsData) {
    try {
      const response = await this.makeRequest('POST', '/analytics', analyticsData);
      
      return {
        success: true,
        message: 'Analytics uploaded successfully'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAnalytics(filters = {}) {
    try {
      const queryParams = new URLSearchParams(filters).toString();
      const endpoint = queryParams ? `/analytics?${queryParams}` : '/analytics';
      
      const response = await this.makeRequest('GET', endpoint);
      
      return {
        success: true,
        analytics: response.analytics
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Sync operations
  async syncData(syncPayload) {
    try {
      const response = await this.makeRequest('POST', this.endpoints.sync, syncPayload);
      
      return {
        success: true,
        syncedItems: response.syncedItems,
        conflicts: response.conflicts,
        message: 'Data synced successfully'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getServerStatus() {
    try {
      const response = await this.makeRequest('GET', '/status');
      
      return {
        success: true,
        status: response.status,
        version: response.version,
        timestamp: response.timestamp
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Utility methods
  isAuthenticated() {
    return !!this.authToken && !this.isTokenExpired();
  }

  getAuthToken() {
    return this.authToken;
  }

  // Public API
  static async getInstance() {
    if (!SusanAIService.instance) {
      await SusanAIService.initialize();
    }
    return SusanAIService.instance;
  }
}

export default SusanAIService;