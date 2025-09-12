import Geolocation from '@react-native-community/geolocation';
import { Platform, PermissionsAndroid } from 'react-native';

/**
 * Location Service for Susan AI Mobile
 * Handles GPS tracking, location permissions, and geospatial data
 */
export class LocationService {
  static instance = null;
  
  constructor() {
    if (LocationService.instance) {
      return LocationService.instance;
    }
    
    this.isInitialized = false;
    this.isTracking = false;
    this.watchId = null;
    this.currentLocation = null;
    this.locationHistory = [];
    this.callbacks = new Set();
    
    // Configuration
    this.config = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 5000,
      distanceFilter: 10, // meters
      interval: 10000, // 10 seconds
      fastestInterval: 5000, // 5 seconds
    };
    
    // Location metadata
    this.metadata = {
      provider: 'unknown',
      accuracy: 0,
      altitude: null,
      bearing: null,
      speed: null,
      timestamp: null
    };
    
    LocationService.instance = this;
  }

  static async initialize() {
    const instance = new LocationService();
    await instance.init();
    return instance;
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      console.log('📍 Initializing Location Service...');
      
      // Configure geolocation
      this.configureGeolocation();
      
      this.isInitialized = true;
      console.log('✅ Location Service initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize location service:', error);
      throw error;
    }
  }

  configureGeolocation() {
    // Set geolocation configuration
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: 'whenInUse',
      enableBackgroundLocationUpdates: false,
      locationProvider: 'auto'
    });
  }

  async requestPermission() {
    try {
      if (Platform.OS === 'ios') {
        return await this.requestIOSPermission();
      } else {
        return await this.requestAndroidPermission();
      }
    } catch (error) {
      console.error('❌ Error requesting location permission:', error);
      return false;
    }
  }

  async requestIOSPermission() {
    return new Promise((resolve) => {
      Geolocation.requestAuthorization(
        () => {
          console.log('✅ iOS location permission granted');
          resolve(true);
        },
        (error) => {
          console.error('❌ iOS location permission denied:', error);
          resolve(false);
        }
      );
    });
  }

  async requestAndroidPermission() {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Susan AI Location Permission',
          message: 'Susan AI needs access to your location to tag photos with GPS coordinates and provide accurate damage assessments.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('✅ Android location permission granted');
        return true;
      } else {
        console.log('❌ Android location permission denied');
        return false;
      }
    } catch (error) {
      console.error('❌ Error requesting Android permission:', error);
      return false;
    }
  }

  async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const location = this.processLocationData(position);
          this.currentLocation = location;
          this.addToLocationHistory(location);
          
          console.log('📍 Current location obtained:', {
            lat: location.latitude.toFixed(6),
            lng: location.longitude.toFixed(6),
            accuracy: location.accuracy
          });
          
          resolve(location);
        },
        (error) => {
          console.error('❌ Error getting current location:', error);
          reject(this.handleLocationError(error));
        },
        {
          enableHighAccuracy: this.config.enableHighAccuracy,
          timeout: this.config.timeout,
          maximumAge: this.config.maximumAge,
        }
      );
    });
  }

  startWatching(callback) {
    if (this.isTracking) {
      console.log('⚠️ Location tracking already started');
      return;
    }
    
    try {
      if (callback) {
        this.callbacks.add(callback);
      }
      
      this.watchId = Geolocation.watchPosition(
        (position) => {
          const location = this.processLocationData(position);
          this.currentLocation = location;
          this.addToLocationHistory(location);
          
          // Notify all callbacks
          this.callbacks.forEach(cb => {
            try {
              cb(location);
            } catch (error) {
              console.error('❌ Error in location callback:', error);
            }
          });
          
          console.log('📍 Location updated:', {
            lat: location.latitude.toFixed(6),
            lng: location.longitude.toFixed(6),
            accuracy: location.accuracy
          });
        },
        (error) => {
          const errorDetails = this.handleLocationError(error);
          console.error('❌ Location tracking error:', errorDetails);
          
          // Notify callbacks of error
          this.callbacks.forEach(cb => {
            try {
              cb(null, errorDetails);
            } catch (callbackError) {
              console.error('❌ Error in location error callback:', callbackError);
            }
          });
        },
        {
          enableHighAccuracy: this.config.enableHighAccuracy,
          timeout: this.config.timeout,
          maximumAge: this.config.maximumAge,
          distanceFilter: this.config.distanceFilter,
        }
      );
      
      this.isTracking = true;
      console.log('📍 Location tracking started');
      
    } catch (error) {
      console.error('❌ Error starting location tracking:', error);
      throw error;
    }
  }

  stopWatching() {
    if (!this.isTracking || !this.watchId) {
      return;
    }
    
    try {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isTracking = false;
      this.callbacks.clear();
      
      console.log('📍 Location tracking stopped');
      
    } catch (error) {
      console.error('❌ Error stopping location tracking:', error);
    }
  }

  processLocationData(position) {
    const { coords, timestamp } = position;
    
    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      altitude: coords.altitude,
      altitudeAccuracy: coords.altitudeAccuracy,
      heading: coords.heading,
      speed: coords.speed,
      timestamp: new Date(timestamp).toISOString(),
      
      // Additional metadata
      provider: this.determineProvider(coords),
      quality: this.determineLocationQuality(coords),
      address: null, // Will be populated by reverse geocoding
      coordinates: `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`,
      
      // Derived information
      isHighAccuracy: coords.accuracy <= 10,
      isOutdoor: coords.accuracy <= 50,
      confidenceLevel: this.calculateConfidenceLevel(coords)
    };
  }

  determineProvider(coords) {
    // Determine location provider based on accuracy and other factors
    if (coords.accuracy <= 5) {
      return 'gps';
    } else if (coords.accuracy <= 100) {
      return 'network';
    } else {
      return 'passive';
    }
  }

  determineLocationQuality(coords) {
    const accuracy = coords.accuracy;
    
    if (accuracy <= 5) {
      return 'excellent';
    } else if (accuracy <= 10) {
      return 'good';
    } else if (accuracy <= 50) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  calculateConfidenceLevel(coords) {
    let confidence = 100;
    
    // Reduce confidence based on accuracy
    if (coords.accuracy > 50) {
      confidence -= 40;
    } else if (coords.accuracy > 20) {
      confidence -= 20;
    } else if (coords.accuracy > 10) {
      confidence -= 10;
    }
    
    // Reduce confidence if no altitude data
    if (!coords.altitude) {
      confidence -= 5;
    }
    
    // Reduce confidence if no speed data (indicates poor GPS fix)
    if (!coords.speed && !coords.heading) {
      confidence -= 10;
    }
    
    return Math.max(0, Math.min(100, confidence));
  }

  addToLocationHistory(location) {
    this.locationHistory.push(location);
    
    // Keep only last 100 locations to prevent memory issues
    if (this.locationHistory.length > 100) {
      this.locationHistory.shift();
    }
  }

  handleLocationError(error) {
    const errorDetails = {
      code: error.code,
      message: error.message,
      timestamp: new Date().toISOString()
    };
    
    switch (error.code) {
      case 1:
        errorDetails.type = 'PERMISSION_DENIED';
        errorDetails.userMessage = 'Location access denied. Please enable location permissions in settings.';
        break;
      case 2:
        errorDetails.type = 'POSITION_UNAVAILABLE';
        errorDetails.userMessage = 'Location unavailable. Please check your GPS settings and try again.';
        break;
      case 3:
        errorDetails.type = 'TIMEOUT';
        errorDetails.userMessage = 'Location request timed out. Please try again.';
        break;
      default:
        errorDetails.type = 'UNKNOWN_ERROR';
        errorDetails.userMessage = 'Unknown location error occurred.';
    }
    
    return errorDetails;
  }

  // Utility Methods
  calculateDistance(location1, location2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = location1.latitude * Math.PI / 180;
    const φ2 = location2.latitude * Math.PI / 180;
    const Δφ = (location2.latitude - location1.latitude) * Math.PI / 180;
    const Δλ = (location2.longitude - location1.longitude) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c; // Distance in meters
  }

  calculateBearing(location1, location2) {
    const φ1 = location1.latitude * Math.PI / 180;
    const φ2 = location2.latitude * Math.PI / 180;
    const Δλ = (location2.longitude - location1.longitude) * Math.PI / 180;
    
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    
    const θ = Math.atan2(y, x);
    
    return (θ * 180 / Math.PI + 360) % 360; // Bearing in degrees
  }

  isLocationAccurate(location, requiredAccuracy = 20) {
    return location.accuracy <= requiredAccuracy;
  }

  isLocationRecent(location, maxAgeMinutes = 5) {
    const locationTime = new Date(location.timestamp);
    const now = new Date();
    const ageMinutes = (now - locationTime) / (1000 * 60);
    
    return ageMinutes <= maxAgeMinutes;
  }

  formatLocationForDisplay(location) {
    if (!location) return 'No location available';
    
    return {
      coordinates: `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
      accuracy: `±${Math.round(location.accuracy)}m`,
      quality: location.quality,
      timestamp: new Date(location.timestamp).toLocaleString(),
      provider: location.provider
    };
  }

  async reverseGeocode(location) {
    try {
      // In a real implementation, this would call a geocoding service
      // For now, return a placeholder
      const address = {
        street: 'Unknown Street',
        city: 'Unknown City',
        state: 'Unknown State',
        country: 'Unknown Country',
        postalCode: 'Unknown ZIP',
        formattedAddress: `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
      };
      
      return address;
    } catch (error) {
      console.error('❌ Error reverse geocoding:', error);
      return null;
    }
  }

  // Photo tagging helpers
  async getLocationForPhoto() {
    try {
      let location = this.currentLocation;
      
      // If current location is stale or inaccurate, get a fresh one
      if (!location || 
          !this.isLocationRecent(location) || 
          !this.isLocationAccurate(location)) {
        location = await this.getCurrentLocation();
      }
      
      // Add reverse geocoding if available
      if (location) {
        location.address = await this.reverseGeocode(location);
      }
      
      return location;
    } catch (error) {
      console.error('❌ Error getting location for photo:', error);
      return null;
    }
  }

  createLocationMetadata(location) {
    if (!location) return null;
    
    return {
      gps: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        altitude: location.altitude,
        heading: location.heading,
        speed: location.speed
      },
      timestamp: location.timestamp,
      provider: location.provider,
      quality: location.quality,
      address: location.address,
      coordinates: location.coordinates,
      confidenceLevel: location.confidenceLevel
    };
  }

  // Statistics and analytics
  getLocationStats() {
    if (this.locationHistory.length === 0) {
      return {
        totalLocations: 0,
        averageAccuracy: 0,
        bestAccuracy: 0,
        worstAccuracy: 0,
        trackingDuration: 0
      };
    }
    
    const accuracies = this.locationHistory.map(loc => loc.accuracy);
    const timestamps = this.locationHistory.map(loc => new Date(loc.timestamp));
    
    return {
      totalLocations: this.locationHistory.length,
      averageAccuracy: Math.round(accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length),
      bestAccuracy: Math.min(...accuracies),
      worstAccuracy: Math.max(...accuracies),
      trackingDuration: this.locationHistory.length > 1 
        ? Math.max(...timestamps) - Math.min(...timestamps)
        : 0,
      currentLocation: this.currentLocation,
      isTracking: this.isTracking
    };
  }

  // Public API
  static async getInstance() {
    if (!LocationService.instance) {
      await LocationService.initialize();
    }
    return LocationService.instance;
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Restart tracking with new config if currently tracking
    if (this.isTracking) {
      this.stopWatching();
      setTimeout(() => {
        this.startWatching();
      }, 1000);
    }
  }

  getLocationHistory() {
    return [...this.locationHistory];
  }

  clearLocationHistory() {
    this.locationHistory = [];
    console.log('📍 Location history cleared');
  }
}

export default LocationService;