import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

/**
 * Offline Storage Service for Susan AI Mobile
 * Handles local data storage, caching, and offline functionality
 */
export class OfflineStorageService {
  static instance = null;
  
  constructor() {
    if (OfflineStorageService.instance) {
      return OfflineStorageService.instance;
    }
    
    this.isInitialized = false;
    this.storageKeys = {
      CLAIMS: '@SusanAI:claims',
      PHOTOS: '@SusanAI:photos',
      PENDING_SYNC: '@SusanAI:pending_sync',
      USER_PREFERENCES: '@SusanAI:user_preferences',
      CACHED_DATA: '@SusanAI:cached_data',
      OFFLINE_QUEUE: '@SusanAI:offline_queue',
      TEMPLATES: '@SusanAI:templates',
      ADJUSTER_PROFILES: '@SusanAI:adjuster_profiles',
      ANALYTICS: '@SusanAI:analytics'
    };
    
    this.photosDirectory = Platform.OS === 'ios' 
      ? RNFS.DocumentDirectoryPath + '/SusanAI/Photos'
      : RNFS.ExternalDirectoryPath + '/SusanAI/Photos';
    
    this.cacheDirectory = Platform.OS === 'ios'
      ? RNFS.DocumentDirectoryPath + '/SusanAI/Cache'
      : RNFS.ExternalDirectoryPath + '/SusanAI/Cache';
    
    this.maxCacheSize = 500 * 1024 * 1024; // 500MB
    this.maxPhotoAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    OfflineStorageService.instance = this;
  }

  static async initialize() {
    const instance = new OfflineStorageService();
    await instance.init();
    return instance;
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      console.log('💾 Initializing Offline Storage Service...');
      
      // Create directories
      await this.createDirectories();
      
      // Initialize storage
      await this.initializeStorage();
      
      // Clean up old data
      await this.cleanupOldData();
      
      this.isInitialized = true;
      console.log('✅ Offline Storage Service initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize offline storage:', error);
      throw error;
    }
  }

  async createDirectories() {
    try {
      // Create photos directory
      const photosExists = await RNFS.exists(this.photosDirectory);
      if (!photosExists) {
        await RNFS.mkdir(this.photosDirectory);
      }
      
      // Create cache directory
      const cacheExists = await RNFS.exists(this.cacheDirectory);
      if (!cacheExists) {
        await RNFS.mkdir(this.cacheDirectory);
      }
      
      console.log('📁 Storage directories created');
      
    } catch (error) {
      console.error('❌ Error creating directories:', error);
      throw error;
    }
  }

  async initializeStorage() {
    try {
      // Initialize empty storage if not exists
      const keys = Object.values(this.storageKeys);
      
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value === null) {
          await AsyncStorage.setItem(key, JSON.stringify(this.getDefaultValue(key)));
        }
      }
      
    } catch (error) {
      console.error('❌ Error initializing storage:', error);
      throw error;
    }
  }

  getDefaultValue(key) {
    switch (key) {
      case this.storageKeys.CLAIMS:
        return [];
      case this.storageKeys.PHOTOS:
        return [];
      case this.storageKeys.PENDING_SYNC:
        return [];
      case this.storageKeys.OFFLINE_QUEUE:
        return [];
      case this.storageKeys.TEMPLATES:
        return {};
      case this.storageKeys.ADJUSTER_PROFILES:
        return {};
      case this.storageKeys.ANALYTICS:
        return {};
      case this.storageKeys.USER_PREFERENCES:
        return {
          autoSync: true,
          photoQuality: 'high',
          gpsTracking: true,
          offlineMode: true,
          syncOnWifi: true,
          maxPhotosPerClaim: 50,
          compressionLevel: 0.8
        };
      case this.storageKeys.CACHED_DATA:
        return {
          lastSync: null,
          cacheVersion: '1.0.0',
          totalSize: 0
        };
      default:
        return {};
    }
  }

  // Claims Management
  async saveClaim(claim) {
    try {
      const claims = await this.getClaims();
      const existingIndex = claims.findIndex(c => c.id === claim.id);
      
      if (existingIndex >= 0) {
        claims[existingIndex] = { ...claims[existingIndex], ...claim };
      } else {
        claims.push({
          ...claim,
          createdOffline: true,
          lastModified: new Date().toISOString()
        });
      }
      
      await AsyncStorage.setItem(this.storageKeys.CLAIMS, JSON.stringify(claims));
      
      // Add to sync queue if online
      await this.addToSyncQueue('claim', claim);
      
      console.log(`💾 Claim saved: ${claim.id}`);
      return claim;
      
    } catch (error) {
      console.error('❌ Error saving claim:', error);
      throw error;
    }
  }

  async getClaims() {
    try {
      const claimsJson = await AsyncStorage.getItem(this.storageKeys.CLAIMS);
      return claimsJson ? JSON.parse(claimsJson) : [];
    } catch (error) {
      console.error('❌ Error getting claims:', error);
      return [];
    }
  }

  async getClaim(claimId) {
    try {
      const claims = await this.getClaims();
      return claims.find(c => c.id === claimId);
    } catch (error) {
      console.error('❌ Error getting claim:', error);
      return null;
    }
  }

  async deleteClaim(claimId) {
    try {
      const claims = await this.getClaims();
      const filteredClaims = claims.filter(c => c.id !== claimId);
      
      await AsyncStorage.setItem(this.storageKeys.CLAIMS, JSON.stringify(filteredClaims));
      
      // Delete associated photos
      await this.deleteClaimPhotos(claimId);
      
      // Add deletion to sync queue
      await this.addToSyncQueue('delete_claim', { claimId });
      
      console.log(`🗑️ Claim deleted: ${claimId}`);
      
    } catch (error) {
      console.error('❌ Error deleting claim:', error);
      throw error;
    }
  }

  // Photo Management
  async savePhoto(photo) {
    try {
      const photoId = photo.id || this.generatePhotoId();
      const filename = `${photoId}.jpg`;
      const filepath = `${this.photosDirectory}/${filename}`;
      
      // Save photo to file system
      await RNFS.writeFile(filepath, photo.base64, 'base64');
      
      // Create photo metadata
      const photoMetadata = {
        id: photoId,
        claimId: photo.claimId,
        filename,
        filepath,
        timestamp: new Date().toISOString(),
        location: photo.location || null,
        damageType: photo.damageType || 'unknown',
        aiAnalysis: photo.aiAnalysis || null,
        size: photo.size || 0,
        compression: photo.compression || 1.0,
        syncStatus: 'pending'
      };
      
      // Save metadata
      const photos = await this.getPhotos();
      photos.push(photoMetadata);
      await AsyncStorage.setItem(this.storageKeys.PHOTOS, JSON.stringify(photos));
      
      // Add to sync queue
      await this.addToSyncQueue('photo', photoMetadata);
      
      console.log(`📸 Photo saved: ${photoId}`);
      return photoMetadata;
      
    } catch (error) {
      console.error('❌ Error saving photo:', error);
      throw error;
    }
  }

  async getPhotos(claimId = null) {
    try {
      const photosJson = await AsyncStorage.getItem(this.storageKeys.PHOTOS);
      const photos = photosJson ? JSON.parse(photosJson) : [];
      
      if (claimId) {
        return photos.filter(p => p.claimId === claimId);
      }
      
      return photos;
    } catch (error) {
      console.error('❌ Error getting photos:', error);
      return [];
    }
  }

  async getPhoto(photoId) {
    try {
      const photos = await this.getPhotos();
      const photoMetadata = photos.find(p => p.id === photoId);
      
      if (!photoMetadata) return null;
      
      // Read photo data
      const photoData = await RNFS.readFile(photoMetadata.filepath, 'base64');
      
      return {
        ...photoMetadata,
        base64: photoData
      };
      
    } catch (error) {
      console.error('❌ Error getting photo:', error);
      return null;
    }
  }

  async deletePhoto(photoId) {
    try {
      const photos = await this.getPhotos();
      const photo = photos.find(p => p.id === photoId);
      
      if (photo) {
        // Delete file
        const fileExists = await RNFS.exists(photo.filepath);
        if (fileExists) {
          await RNFS.unlink(photo.filepath);
        }
        
        // Remove from metadata
        const filteredPhotos = photos.filter(p => p.id !== photoId);
        await AsyncStorage.setItem(this.storageKeys.PHOTOS, JSON.stringify(filteredPhotos));
        
        // Add deletion to sync queue
        await this.addToSyncQueue('delete_photo', { photoId });
        
        console.log(`🗑️ Photo deleted: ${photoId}`);
      }
      
    } catch (error) {
      console.error('❌ Error deleting photo:', error);
      throw error;
    }
  }

  async deleteClaimPhotos(claimId) {
    try {
      const photos = await this.getPhotos(claimId);
      
      for (const photo of photos) {
        await this.deletePhoto(photo.id);
      }
      
      console.log(`🗑️ Deleted ${photos.length} photos for claim: ${claimId}`);
      
    } catch (error) {
      console.error('❌ Error deleting claim photos:', error);
    }
  }

  // Sync Queue Management
  async addToSyncQueue(type, data) {
    try {
      const queue = await this.getSyncQueue();
      
      const syncItem = {
        id: this.generateSyncId(),
        type,
        data,
        timestamp: new Date().toISOString(),
        attempts: 0,
        maxAttempts: 3,
        status: 'pending'
      };
      
      queue.push(syncItem);
      await AsyncStorage.setItem(this.storageKeys.PENDING_SYNC, JSON.stringify(queue));
      
      return syncItem;
      
    } catch (error) {
      console.error('❌ Error adding to sync queue:', error);
      throw error;
    }
  }

  async getSyncQueue() {
    try {
      const queueJson = await AsyncStorage.getItem(this.storageKeys.PENDING_SYNC);
      return queueJson ? JSON.parse(queueJson) : [];
    } catch (error) {
      console.error('❌ Error getting sync queue:', error);
      return [];
    }
  }

  async getPendingSyncCount() {
    try {
      const queue = await this.getSyncQueue();
      return queue.filter(item => item.status === 'pending').length;
    } catch (error) {
      return 0;
    }
  }

  async markSyncComplete(syncId) {
    try {
      const queue = await this.getSyncQueue();
      const item = queue.find(i => i.id === syncId);
      
      if (item) {
        item.status = 'completed';
        item.completedAt = new Date().toISOString();
        await AsyncStorage.setItem(this.storageKeys.PENDING_SYNC, JSON.stringify(queue));
      }
      
    } catch (error) {
      console.error('❌ Error marking sync complete:', error);
    }
  }

  async markSyncFailed(syncId, error) {
    try {
      const queue = await this.getSyncQueue();
      const item = queue.find(i => i.id === syncId);
      
      if (item) {
        item.attempts++;
        item.lastError = error.message;
        item.lastAttempt = new Date().toISOString();
        
        if (item.attempts >= item.maxAttempts) {
          item.status = 'failed';
        }
        
        await AsyncStorage.setItem(this.storageKeys.PENDING_SYNC, JSON.stringify(queue));
      }
      
    } catch (error) {
      console.error('❌ Error marking sync failed:', error);
    }
  }

  // Cache Management
  async cacheData(key, data, expirationHours = 24) {
    try {
      const cacheItem = {
        data,
        timestamp: new Date().toISOString(),
        expiration: new Date(Date.now() + expirationHours * 60 * 60 * 1000).toISOString()
      };
      
      const cacheKey = `@SusanAI:cache:${key}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheItem));
      
      // Update cache size
      await this.updateCacheSize();
      
    } catch (error) {
      console.error('❌ Error caching data:', error);
    }
  }

  async getCachedData(key) {
    try {
      const cacheKey = `@SusanAI:cache:${key}`;
      const cacheJson = await AsyncStorage.getItem(cacheKey);
      
      if (!cacheJson) return null;
      
      const cacheItem = JSON.parse(cacheJson);
      const now = new Date().toISOString();
      
      // Check if expired
      if (now > cacheItem.expiration) {
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }
      
      return cacheItem.data;
      
    } catch (error) {
      console.error('❌ Error getting cached data:', error);
      return null;
    }
  }

  async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('@SusanAI:cache:'));
      
      await AsyncStorage.multiRemove(cacheKeys);
      
      // Clear cache directory
      const files = await RNFS.readDir(this.cacheDirectory);
      for (const file of files) {
        await RNFS.unlink(file.path);
      }
      
      console.log('🧹 Cache cleared');
      
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
    }
  }

  // Data Management
  async loadCachedClaims() {
    return await this.getCachedData('claims');
  }

  async loadOfflinePhotos() {
    return await this.getPhotos();
  }

  async loadUserPreferences() {
    try {
      const prefsJson = await AsyncStorage.getItem(this.storageKeys.USER_PREFERENCES);
      return prefsJson ? JSON.parse(prefsJson) : this.getDefaultValue(this.storageKeys.USER_PREFERENCES);
    } catch (error) {
      console.error('❌ Error loading user preferences:', error);
      return this.getDefaultValue(this.storageKeys.USER_PREFERENCES);
    }
  }

  async saveUserPreferences(preferences) {
    try {
      await AsyncStorage.setItem(this.storageKeys.USER_PREFERENCES, JSON.stringify(preferences));
    } catch (error) {
      console.error('❌ Error saving user preferences:', error);
    }
  }

  async savePendingData() {
    try {
      // Save any unsaved data before app goes to background
      const pendingCount = await this.getPendingSyncCount();
      console.log(`💾 Saved pending data (${pendingCount} items)`);
    } catch (error) {
      console.error('❌ Error saving pending data:', error);
    }
  }

  // Cleanup and Maintenance
  async cleanupOldData() {
    try {
      // Clean up old photos
      await this.cleanupOldPhotos();
      
      // Clean up completed sync items
      await this.cleanupCompletedSyncItems();
      
      // Clean up expired cache
      await this.cleanupExpiredCache();
      
      console.log('🧹 Old data cleaned up');
      
    } catch (error) {
      console.error('❌ Error cleaning up old data:', error);
    }
  }

  async cleanupOldPhotos() {
    try {
      const photos = await this.getPhotos();
      const now = Date.now();
      const photosToDelete = [];
      
      for (const photo of photos) {
        const photoAge = now - new Date(photo.timestamp).getTime();
        if (photoAge > this.maxPhotoAge && photo.syncStatus === 'completed') {
          photosToDelete.push(photo);
        }
      }
      
      for (const photo of photosToDelete) {
        await this.deletePhoto(photo.id);
      }
      
      if (photosToDelete.length > 0) {
        console.log(`🧹 Cleaned up ${photosToDelete.length} old photos`);
      }
      
    } catch (error) {
      console.error('❌ Error cleaning up old photos:', error);
    }
  }

  async cleanupCompletedSyncItems() {
    try {
      const queue = await this.getSyncQueue();
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      
      const filteredQueue = queue.filter(item => {
        if (item.status === 'completed') {
          const completedDate = new Date(item.completedAt);
          return completedDate > cutoffDate;
        }
        return true;
      });
      
      if (filteredQueue.length !== queue.length) {
        await AsyncStorage.setItem(this.storageKeys.PENDING_SYNC, JSON.stringify(filteredQueue));
        console.log(`🧹 Cleaned up ${queue.length - filteredQueue.length} completed sync items`);
      }
      
    } catch (error) {
      console.error('❌ Error cleaning up sync items:', error);
    }
  }

  async cleanupExpiredCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('@SusanAI:cache:'));
      const now = new Date().toISOString();
      
      for (const key of cacheKeys) {
        const cacheJson = await AsyncStorage.getItem(key);
        if (cacheJson) {
          const cacheItem = JSON.parse(cacheJson);
          if (now > cacheItem.expiration) {
            await AsyncStorage.removeItem(key);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error cleaning up expired cache:', error);
    }
  }

  async updateCacheSize() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('@SusanAI:cache:'));
      
      let totalSize = 0;
      for (const key of cacheKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }
      
      // Update cache metadata
      const cacheData = await this.getCachedData('metadata') || {};
      cacheData.totalSize = totalSize;
      cacheData.lastUpdated = new Date().toISOString();
      
      await this.cacheData('metadata', cacheData, 24 * 7); // Cache for a week
      
      // Check if cache is too large
      if (totalSize > this.maxCacheSize) {
        await this.clearOldCache();
      }
      
    } catch (error) {
      console.error('❌ Error updating cache size:', error);
    }
  }

  async clearOldCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('@SusanAI:cache:'));
      
      // Get cache items with timestamps
      const cacheItems = [];
      for (const key of cacheKeys) {
        const cacheJson = await AsyncStorage.getItem(key);
        if (cacheJson) {
          const cacheItem = JSON.parse(cacheJson);
          cacheItems.push({
            key,
            timestamp: cacheItem.timestamp,
            size: cacheJson.length
          });
        }
      }
      
      // Sort by timestamp (oldest first)
      cacheItems.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Remove oldest items until under limit
      let currentSize = cacheItems.reduce((sum, item) => sum + item.size, 0);
      const targetSize = this.maxCacheSize * 0.8; // Target 80% of max
      
      for (const item of cacheItems) {
        if (currentSize <= targetSize) break;
        
        await AsyncStorage.removeItem(item.key);
        currentSize -= item.size;
      }
      
      console.log('🧹 Cleared old cache items');
      
    } catch (error) {
      console.error('❌ Error clearing old cache:', error);
    }
  }

  // Utility Methods
  generatePhotoId() {
    return `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSyncId() {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getStorageInfo() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const susanKeys = keys.filter(key => key.startsWith('@SusanAI:'));
      
      let totalSize = 0;
      for (const key of susanKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }
      
      // Get file system usage
      const photoFiles = await RNFS.readDir(this.photosDirectory);
      let photoSize = 0;
      for (const file of photoFiles) {
        photoSize += file.size;
      }
      
      return {
        asyncStorageKeys: susanKeys.length,
        asyncStorageSize: totalSize,
        photoCount: photoFiles.length,
        photoSize,
        totalSize: totalSize + photoSize,
        photosDirectory: this.photosDirectory,
        cacheDirectory: this.cacheDirectory
      };
      
    } catch (error) {
      console.error('❌ Error getting storage info:', error);
      return null;
    }
  }

  // Public API
  static async getInstance() {
    if (!OfflineStorageService.instance) {
      await OfflineStorageService.initialize();
    }
    return OfflineStorageService.instance;
  }
}

export default OfflineStorageService;