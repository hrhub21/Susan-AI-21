import { OfflineStorageService } from './OfflineStorageService';
import { SusanAIService } from './SusanAIService';
import NetInfo from '@react-native-community/netinfo';

/**
 * Sync Service for Susan AI Mobile
 * Handles data synchronization between offline storage and cloud services
 */
export class SyncService {
  static instance = null;
  
  constructor() {
    if (SyncService.instance) {
      return SyncService.instance;
    }
    
    this.isInitialized = false;
    this.isSyncing = false;
    this.syncInProgress = new Map();
    this.syncHistory = [];
    this.retryQueue = [];
    
    // Sync configuration
    this.config = {
      autoSync: true,
      syncOnWifiOnly: false,
      maxRetries: 3,
      retryDelayMs: 5000,
      batchSize: 10,
      syncInterval: 300000, // 5 minutes
      maxSyncHistorySize: 100
    };
    
    // Sync priorities
    this.priorities = {
      'claim': 1,
      'photo': 2,
      'delete_claim': 3,
      'delete_photo': 4,
      'analytics': 5
    };
    
    this.syncStats = {
      totalSynced: 0,
      totalFailed: 0,
      lastSyncTime: null,
      averageSyncTime: 0,
      networkType: 'unknown'
    };
    
    SyncService.instance = this;
  }

  static async initialize() {
    const instance = new SyncService();
    await instance.init();
    return instance;
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      console.log('🔄 Initializing Sync Service...');
      
      // Setup network monitoring
      this.setupNetworkMonitoring();
      
      // Start auto-sync if enabled
      if (this.config.autoSync) {
        this.startAutoSync();
      }
      
      this.isInitialized = true;
      console.log('✅ Sync Service initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize sync service:', error);
      throw error;
    }
  }

  setupNetworkMonitoring() {
    NetInfo.addEventListener(state => {
      this.syncStats.networkType = state.type;
      
      // Auto-sync when coming online if enabled
      if (state.isConnected && state.isInternetReachable && this.config.autoSync) {
        setTimeout(() => {
          this.syncPendingData();
        }, 2000); // Wait 2 seconds after connection
      }
    });
  }

  startAutoSync() {
    setInterval(async () => {
      try {
        const networkState = await NetInfo.fetch();
        
        if (networkState.isConnected && networkState.isInternetReachable) {
          // Check if we should sync (WiFi only setting)
          if (this.config.syncOnWifiOnly && networkState.type !== 'wifi') {
            return;
          }
          
          await this.syncPendingData();
        }
      } catch (error) {
        console.error('❌ Auto-sync error:', error);
      }
    }, this.config.syncInterval);
  }

  async syncPendingData() {
    if (this.isSyncing) {
      console.log('⚠️ Sync already in progress');
      return { success: false, reason: 'sync_in_progress' };
    }
    
    try {
      this.isSyncing = true;
      const startTime = Date.now();
      
      console.log('🔄 Starting sync process...');
      
      // Check network connectivity
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected || !networkState.isInternetReachable) {
        throw new Error('No internet connection');
      }
      
      // Get pending sync items
      const offlineStorage = await OfflineStorageService.getInstance();
      const syncQueue = await offlineStorage.getSyncQueue();
      const pendingItems = syncQueue.filter(item => item.status === 'pending');
      
      if (pendingItems.length === 0) {
        console.log('📭 No pending items to sync');
        return { success: true, itemsSynced: 0, message: 'No items to sync' };
      }
      
      // Sort by priority and timestamp
      const sortedItems = this.sortSyncItems(pendingItems);
      
      // Process items in batches
      const results = await this.processSyncBatches(sortedItems);
      
      // Calculate sync statistics
      const syncTime = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;
      
      // Update statistics
      this.updateSyncStats(syncTime, successCount, failedCount);
      
      // Log sync completion
      const syncResult = {
        success: true,
        itemsSynced: successCount,
        itemsFailed: failedCount,
        totalTime: syncTime,
        results
      };
      
      this.addToSyncHistory(syncResult);
      
      console.log(`✅ Sync completed: ${successCount} synced, ${failedCount} failed`);
      
      return syncResult;
      
    } catch (error) {
      console.error('❌ Sync process failed:', error);
      
      const failedResult = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      this.addToSyncHistory(failedResult);
      
      return failedResult;
      
    } finally {
      this.isSyncing = false;
    }
  }

  sortSyncItems(items) {
    return items.sort((a, b) => {
      // First by priority
      const priorityA = this.priorities[a.type] || 999;
      const priorityB = this.priorities[b.type] || 999;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Then by timestamp (oldest first)
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
  }

  async processSyncBatches(items) {
    const results = [];
    
    for (let i = 0; i < items.length; i += this.config.batchSize) {
      const batch = items.slice(i, i + this.config.batchSize);
      
      console.log(`🔄 Processing batch ${Math.floor(i / this.config.batchSize) + 1} (${batch.length} items)`);
      
      const batchResults = await Promise.allSettled(
        batch.map(item => this.syncItem(item))
      );
      
      batchResults.forEach((result, index) => {
        const item = batch[index];
        
        if (result.status === 'fulfilled' && result.value.success) {
          results.push({
            itemId: item.id,
            type: item.type,
            success: true,
            data: result.value
          });
        } else {
          const error = result.status === 'rejected' 
            ? result.reason 
            : result.value.error;
          
          results.push({
            itemId: item.id,
            type: item.type,
            success: false,
            error: error.message || error
          });
        }
      });
      
      // Small delay between batches to prevent overwhelming the server
      if (i + this.config.batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  async syncItem(syncItem) {
    try {
      this.syncInProgress.set(syncItem.id, Date.now());
      
      let result;
      
      switch (syncItem.type) {
        case 'claim':
          result = await this.syncClaim(syncItem);
          break;
        case 'photo':
          result = await this.syncPhoto(syncItem);
          break;
        case 'delete_claim':
          result = await this.syncClaimDeletion(syncItem);
          break;
        case 'delete_photo':
          result = await this.syncPhotoDeletion(syncItem);
          break;
        case 'analytics':
          result = await this.syncAnalytics(syncItem);
          break;
        default:
          throw new Error(`Unknown sync type: ${syncItem.type}`);
      }
      
      // Mark as synced in local storage
      const offlineStorage = await OfflineStorageService.getInstance();
      await offlineStorage.markSyncComplete(syncItem.id);
      
      console.log(`✅ Synced ${syncItem.type}: ${syncItem.id}`);
      
      return { success: true, result };
      
    } catch (error) {
      console.error(`❌ Failed to sync ${syncItem.type} ${syncItem.id}:`, error);
      
      // Mark as failed and potentially retry
      const offlineStorage = await OfflineStorageService.getInstance();
      await offlineStorage.markSyncFailed(syncItem.id, error);
      
      // Add to retry queue if not exceeded max retries
      if (syncItem.attempts < this.config.maxRetries) {
        this.addToRetryQueue(syncItem);
      }
      
      return { success: false, error };
      
    } finally {
      this.syncInProgress.delete(syncItem.id);
    }
  }

  async syncClaim(syncItem) {
    try {
      const susanAI = await SusanAIService.getInstance();
      const claimData = syncItem.data;
      
      // Upload claim to cloud
      const response = await susanAI.uploadClaim(claimData);
      
      if (response.success) {
        // Update local claim with server ID
        if (response.claimId && response.claimId !== claimData.id) {
          const offlineStorage = await OfflineStorageService.getInstance();
          const updatedClaim = { ...claimData, serverId: response.claimId };
          await offlineStorage.saveClaim(updatedClaim);
        }
        
        return response;
      } else {
        throw new Error(response.error || 'Failed to upload claim');
      }
      
    } catch (error) {
      throw new Error(`Claim sync failed: ${error.message}`);
    }
  }

  async syncPhoto(syncItem) {
    try {
      const susanAI = await SusanAIService.getInstance();
      const offlineStorage = await OfflineStorageService.getInstance();
      
      const photoMetadata = syncItem.data;
      
      // Get photo data from local storage
      const photoData = await offlineStorage.getPhoto(photoMetadata.id);
      
      if (!photoData) {
        throw new Error('Photo data not found locally');
      }
      
      // Upload photo to cloud
      const response = await susanAI.uploadPhoto({
        ...photoData,
        claimId: photoMetadata.claimId
      });
      
      if (response.success) {
        // Update local photo metadata
        const updatedPhoto = { 
          ...photoMetadata, 
          serverId: response.photoId,
          syncStatus: 'completed',
          cloudUrl: response.url
        };
        
        // Update in storage
        const photos = await offlineStorage.getPhotos();
        const photoIndex = photos.findIndex(p => p.id === photoMetadata.id);
        if (photoIndex >= 0) {
          photos[photoIndex] = updatedPhoto;
          await AsyncStorage.setItem('@SusanAI:photos', JSON.stringify(photos));
        }
        
        return response;
      } else {
        throw new Error(response.error || 'Failed to upload photo');
      }
      
    } catch (error) {
      throw new Error(`Photo sync failed: ${error.message}`);
    }
  }

  async syncClaimDeletion(syncItem) {
    try {
      const susanAI = await SusanAIService.getInstance();
      const { claimId } = syncItem.data;
      
      // Delete claim from cloud
      const response = await susanAI.deleteClaim(claimId);
      
      if (response.success) {
        return response;
      } else {
        throw new Error(response.error || 'Failed to delete claim');
      }
      
    } catch (error) {
      throw new Error(`Claim deletion sync failed: ${error.message}`);
    }
  }

  async syncPhotoDeletion(syncItem) {
    try {
      const susanAI = await SusanAIService.getInstance();
      const { photoId } = syncItem.data;
      
      // Delete photo from cloud
      const response = await susanAI.deletePhoto(photoId);
      
      if (response.success) {
        return response;
      } else {
        throw new Error(response.error || 'Failed to delete photo');
      }
      
    } catch (error) {
      throw new Error(`Photo deletion sync failed: ${error.message}`);
    }
  }

  async syncAnalytics(syncItem) {
    try {
      const susanAI = await SusanAIService.getInstance();
      const analyticsData = syncItem.data;
      
      // Upload analytics to cloud
      const response = await susanAI.uploadAnalytics(analyticsData);
      
      if (response.success) {
        return response;
      } else {
        throw new Error(response.error || 'Failed to upload analytics');
      }
      
    } catch (error) {
      throw new Error(`Analytics sync failed: ${error.message}`);
    }
  }

  addToRetryQueue(syncItem) {
    this.retryQueue.push({
      ...syncItem,
      retryAt: Date.now() + this.config.retryDelayMs * Math.pow(2, syncItem.attempts) // Exponential backoff
    });
  }

  async processRetryQueue() {
    const now = Date.now();
    const readyToRetry = this.retryQueue.filter(item => item.retryAt <= now);
    
    for (const item of readyToRetry) {
      try {
        await this.syncItem(item);
        
        // Remove from retry queue if successful
        this.retryQueue = this.retryQueue.filter(queueItem => queueItem.id !== item.id);
        
      } catch (error) {
        console.error(`❌ Retry failed for ${item.type} ${item.id}:`, error);
      }
    }
  }

  updateSyncStats(syncTime, successCount, failedCount) {
    this.syncStats.totalSynced += successCount;
    this.syncStats.totalFailed += failedCount;
    this.syncStats.lastSyncTime = new Date().toISOString();
    
    // Update average sync time
    const totalSyncs = this.syncHistory.filter(h => h.success).length;
    if (totalSyncs > 0) {
      const totalTime = this.syncHistory
        .filter(h => h.success && h.totalTime)
        .reduce((sum, h) => sum + h.totalTime, 0);
      this.syncStats.averageSyncTime = Math.round(totalTime / totalSyncs);
    }
  }

  addToSyncHistory(result) {
    this.syncHistory.push({
      ...result,
      timestamp: new Date().toISOString()
    });
    
    // Keep only recent history
    if (this.syncHistory.length > this.config.maxSyncHistorySize) {
      this.syncHistory = this.syncHistory.slice(-this.config.maxSyncHistorySize);
    }
  }

  // Manual sync operations
  async forceSyncClaim(claimId) {
    try {
      const offlineStorage = await OfflineStorageService.getInstance();
      const claim = await offlineStorage.getClaim(claimId);
      
      if (!claim) {
        throw new Error('Claim not found');
      }
      
      const syncItem = {
        id: `manual_${Date.now()}`,
        type: 'claim',
        data: claim,
        timestamp: new Date().toISOString(),
        attempts: 0,
        status: 'pending'
      };
      
      return await this.syncItem(syncItem);
      
    } catch (error) {
      console.error('❌ Force sync claim failed:', error);
      throw error;
    }
  }

  async forceSyncPhoto(photoId) {
    try {
      const offlineStorage = await OfflineStorageService.getInstance();
      const photos = await offlineStorage.getPhotos();
      const photo = photos.find(p => p.id === photoId);
      
      if (!photo) {
        throw new Error('Photo not found');
      }
      
      const syncItem = {
        id: `manual_${Date.now()}`,
        type: 'photo',
        data: photo,
        timestamp: new Date().toISOString(),
        attempts: 0,
        status: 'pending'
      };
      
      return await this.syncItem(syncItem);
      
    } catch (error) {
      console.error('❌ Force sync photo failed:', error);
      throw error;
    }
  }

  // Configuration and status
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Restart auto-sync if interval changed
    if (newConfig.syncInterval !== undefined) {
      // Implementation would restart the interval timer
      console.log('🔄 Sync configuration updated');
    }
  }

  getConfig() {
    return { ...this.config };
  }

  getSyncStats() {
    return {
      ...this.syncStats,
      isSyncing: this.isSyncing,
      itemsInProgress: this.syncInProgress.size,
      retryQueueSize: this.retryQueue.length,
      historySize: this.syncHistory.length
    };
  }

  getSyncHistory(limit = 20) {
    return this.syncHistory.slice(-limit).reverse();
  }

  async getSyncStatus() {
    try {
      const offlineStorage = await OfflineStorageService.getInstance();
      const pendingCount = await offlineStorage.getPendingSyncCount();
      const networkState = await NetInfo.fetch();
      
      return {
        isOnline: networkState.isConnected && networkState.isInternetReachable,
        networkType: networkState.type,
        isSyncing: this.isSyncing,
        pendingItems: pendingCount,
        itemsInProgress: this.syncInProgress.size,
        retryQueueSize: this.retryQueue.length,
        lastSyncTime: this.syncStats.lastSyncTime,
        canSync: networkState.isConnected && 
                (!this.config.syncOnWifiOnly || networkState.type === 'wifi')
      };
      
    } catch (error) {
      console.error('❌ Error getting sync status:', error);
      return {
        isOnline: false,
        isSyncing: false,
        pendingItems: 0,
        error: error.message
      };
    }
  }

  // Cleanup and maintenance
  async clearSyncHistory() {
    this.syncHistory = [];
    console.log('🧹 Sync history cleared');
  }

  async clearRetryQueue() {
    this.retryQueue = [];
    console.log('🧹 Retry queue cleared');
  }

  // Public API
  static async getInstance() {
    if (!SyncService.instance) {
      await SyncService.initialize();
    }
    return SyncService.instance;
  }
}

export default SyncService;