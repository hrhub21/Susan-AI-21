import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StatusBar,
  StyleSheet,
  AppState,
  Alert,
  Platform
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import screens
import DashboardScreen from './screens/DashboardScreen';
import PhotoCaptureScreen from './screens/PhotoCaptureScreen';
import ClaimsScreen from './screens/ClaimsScreen';
import OfflineScreen from './screens/OfflineScreen';
import SyncScreen from './screens/SyncScreen';
import SettingsScreen from './screens/SettingsScreen';

// Import services
import { OfflineStorageService } from './services/OfflineStorageService';
import { LocationService } from './services/LocationService';
import { SyncService } from './services/SyncService';
import { SusanAIService } from './services/SusanAIService';

// Import components
import OfflineIndicator from './components/OfflineIndicator';
import LoadingScreen from './components/LoadingScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

/**
 * Susan AI Mobile App - Field-Ready with Offline Capabilities
 * Revolutionary mobile application for roofing professionals
 */
export default function App() {
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [appState, setAppState] = useState(AppState.currentState);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [location, setLocation] = useState(null);
  const [permissions, setPermissions] = useState({
    camera: false,
    location: false,
    storage: false
  });

  useEffect(() => {
    initializeApp();
    setupNetworkListener();
    setupAppStateListener();
    
    return () => {
      cleanupListeners();
    };
  }, []);

  const initializeApp = async () => {
    try {
      console.log('🚀 Initializing Susan AI Mobile App...');
      
      // Initialize core services
      await OfflineStorageService.initialize();
      await LocationService.initialize();
      await SyncService.initialize();
      await SusanAIService.initialize();
      
      // Request necessary permissions
      const permissionResults = await requestPermissions();
      setPermissions(permissionResults);
      
      // Load offline data
      await loadOfflineData();
      
      // Check for pending sync items
      const pendingCount = await OfflineStorageService.getPendingSyncCount();
      setPendingSyncCount(pendingCount);
      
      // Start location tracking if permitted
      if (permissionResults.location) {
        await startLocationTracking();
      }
      
      setIsLoading(false);
      console.log('✅ Susan AI Mobile App initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize app:', error);
      Alert.alert(
        'Initialization Error',
        'Failed to initialize the app. Please restart and try again.',
        [{ text: 'OK', onPress: () => setIsLoading(false) }]
      );
    }
  };

  const requestPermissions = async () => {
    const results = {
      camera: false,
      location: false,
      storage: false
    };

    try {
      // Request camera permission
      const cameraPermission = await requestCameraPermission();
      results.camera = cameraPermission;

      // Request location permission
      const locationPermission = await requestLocationPermission();
      results.location = locationPermission;

      // Request storage permission (Android)
      if (Platform.OS === 'android') {
        const storagePermission = await requestStoragePermission();
        results.storage = storagePermission;
      } else {
        results.storage = true; // iOS handles this automatically
      }

      return results;
    } catch (error) {
      console.error('❌ Permission request failed:', error);
      return results;
    }
  };

  const requestCameraPermission = async () => {
    try {
      const { check, request, PERMISSIONS, RESULTS } = require('react-native-permissions');
      
      const permission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.CAMERA 
        : PERMISSIONS.ANDROID.CAMERA;

      const result = await check(permission);
      
      if (result === RESULTS.GRANTED) {
        return true;
      } else if (result === RESULTS.DENIED) {
        const requestResult = await request(permission);
        return requestResult === RESULTS.GRANTED;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Camera permission error:', error);
      return false;
    }
  };

  const requestLocationPermission = async () => {
    try {
      return await LocationService.requestPermission();
    } catch (error) {
      console.error('❌ Location permission error:', error);
      return false;
    }
  };

  const requestStoragePermission = async () => {
    try {
      const { check, request, PERMISSIONS, RESULTS } = require('react-native-permissions');
      
      const permission = PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE;
      const result = await check(permission);
      
      if (result === RESULTS.GRANTED) {
        return true;
      } else if (result === RESULTS.DENIED) {
        const requestResult = await request(permission);
        return requestResult === RESULTS.GRANTED;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Storage permission error:', error);
      return false;
    }
  };

  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = !isOnline;
      const isCurrentlyOnline = state.isConnected && state.isInternetReachable;
      
      setIsOnline(isCurrentlyOnline);
      
      // Handle coming back online
      if (wasOffline && isCurrentlyOnline) {
        handleComeOnline();
      }
      
      // Handle going offline
      if (!wasOffline && !isCurrentlyOnline) {
        handleGoOffline();
      }
    });

    return unsubscribe;
  };

  const setupAppStateListener = () => {
    const handleAppStateChange = (nextAppState) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground
        handleAppForeground();
      } else if (appState === 'active' && nextAppState.match(/inactive|background/)) {
        // App has gone to the background
        handleAppBackground();
      }
      
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return subscription;
  };

  const handleComeOnline = async () => {
    console.log('📶 Coming back online');
    
    try {
      // Attempt to sync pending data
      const syncResult = await SyncService.syncPendingData();
      
      if (syncResult.success) {
        setPendingSyncCount(0);
        
        // Show success notification
        Alert.alert(
          'Sync Complete',
          `Successfully synced ${syncResult.itemsSynced} items to the cloud.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Error syncing on reconnect:', error);
    }
  };

  const handleGoOffline = () => {
    console.log('📵 Going offline');
    
    Alert.alert(
      'Offline Mode',
      'You\'re now in offline mode. Your data will be saved locally and synced when you reconnect.',
      [{ text: 'OK' }]
    );
  };

  const handleAppForeground = async () => {
    console.log('📱 App coming to foreground');
    
    // Refresh location if needed
    if (permissions.location) {
      await LocationService.getCurrentLocation();
    }
    
    // Check for pending sync
    const pendingCount = await OfflineStorageService.getPendingSyncCount();
    setPendingSyncCount(pendingCount);
  };

  const handleAppBackground = async () => {
    console.log('📱 App going to background');
    
    // Save any pending data
    await OfflineStorageService.savePendingData();
  };

  const loadOfflineData = async () => {
    try {
      // Load cached claims
      await OfflineStorageService.loadCachedClaims();
      
      // Load offline photos
      await OfflineStorageService.loadOfflinePhotos();
      
      // Load user preferences
      await OfflineStorageService.loadUserPreferences();
      
      console.log('📊 Offline data loaded successfully');
    } catch (error) {
      console.error('❌ Error loading offline data:', error);
    }
  };

  const startLocationTracking = async () => {
    try {
      const currentLocation = await LocationService.getCurrentLocation();
      setLocation(currentLocation);
      
      // Start watching location changes
      LocationService.startWatching((newLocation) => {
        setLocation(newLocation);
      });
      
      console.log('📍 Location tracking started');
    } catch (error) {
      console.error('❌ Error starting location tracking:', error);
    }
  };

  const cleanupListeners = () => {
    LocationService.stopWatching();
  };

  // Main Tab Navigator
  const MainTabNavigator = () => (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Dashboard':
              iconName = 'dashboard';
              break;
            case 'Claims':
              iconName = 'assignment';
              break;
            case 'Camera':
              iconName = 'camera-alt';
              break;
            case 'Sync':
              iconName = 'sync';
              break;
            case 'Settings':
              iconName = 'settings';
              break;
            default:
              iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#b22222', // Burgundy
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#1a0e0e',
          borderTopColor: '#b22222',
          borderTopWidth: 2,
        },
        headerStyle: {
          backgroundColor: '#1a0e0e',
        },
        headerTintColor: '#daa520', // Gold
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          title: 'Susan AI Dashboard',
          tabBarBadge: pendingSyncCount > 0 ? pendingSyncCount : null,
        }}
      />
      <Tab.Screen 
        name="Claims" 
        component={ClaimsScreen}
        options={{
          title: 'Claims Management',
        }}
      />
      <Tab.Screen 
        name="Camera" 
        component={PhotoCaptureScreen}
        options={{
          title: 'Photo Capture',
          tabBarLabel: 'Camera',
        }}
      />
      <Tab.Screen 
        name="Sync" 
        component={SyncScreen}
        options={{
          title: 'Data Sync',
          tabBarBadge: pendingSyncCount > 0 ? '!' : null,
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
    </Tab.Navigator>
  );

  // Show loading screen during initialization
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#1a0e0e"
        translucent={false}
      />
      
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {isOnline || permissions.camera ? (
            <Stack.Screen name="MainApp" component={MainTabNavigator} />
          ) : (
            <Stack.Screen name="Offline" component={OfflineScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {/* Offline Indicator */}
      <OfflineIndicator 
        isOnline={isOnline} 
        pendingSyncCount={pendingSyncCount}
      />

      {/* Location Indicator */}
      {location && (
        <View style={styles.locationIndicator}>
          <Text style={styles.locationText}>
            📍 {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0e0e',
  },
  locationIndicator: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    zIndex: 1000,
  },
  locationText: {
    color: '#daa520',
    fontSize: 12,
    fontWeight: 'bold',
  },
});