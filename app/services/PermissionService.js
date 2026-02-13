import { Platform, Alert, Linking } from 'react-native';
import { request, PERMISSIONS, RESULTS, check } from 'react-native-permissions';

class PermissionService {
  constructor() {
    this.permissions = {
      CAMERA: Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.CAMERA 
        : PERMISSIONS.ANDROID.CAMERA,
      STORAGE: Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.PHOTO_LIBRARY 
        : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
      NOTIFICATIONS: Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.NOTIFICATIONS 
        : PERMISSIONS.ANDROID.POST_NOTIFICATIONS,
      LOCATION: Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE 
        : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    };
  }

  async checkPermission(permissionType) {
    try {
      const permission = this.permissions[permissionType];
      if (!permission) {
        throw new Error(`Unknown permission type: ${permissionType}`);
      }

      const result = await check(permission);
      return {
        granted: result === RESULTS.GRANTED,
        status: result,
        permission: permissionType,
      };
    } catch (error) {
      console.error('Error checking permission:', error);
      return {
        granted: false,
        status: RESULTS.UNAVAILABLE,
        permission: permissionType,
        error: error.message,
      };
    }
  }

  async requestPermission(permissionType, showAlert = true) {
    try {
      const permission = this.permissions[permissionType];
      if (!permission) {
        throw new Error(`Unknown permission type: ${permissionType}`);
      }

      const result = await request(permission);
      
      const response = {
        granted: result === RESULTS.GRANTED,
        status: result,
        permission: permissionType,
      };

      if (!response.granted && showAlert) {
        this.showPermissionAlert(permissionType, result);
      }

      return response;
    } catch (error) {
      console.error('Error requesting permission:', error);
      return {
        granted: false,
        status: RESULTS.UNAVAILABLE,
        permission: permissionType,
        error: error.message,
      };
    }
  }

  async requestMultiplePermissions(permissionTypes, showAlert = true) {
    const results = {};
    
    for (const permissionType of permissionTypes) {
      results[permissionType] = await this.requestPermission(permissionType, false);
    }
    
    const allGranted = Object.values(results).every(result => result.granted);
    
    if (!allGranted && showAlert) {
      this.showMultiplePermissionsAlert(permissionTypes, results);
    }
    
    return results;
  }

  showPermissionAlert(permissionType, status) {
    const messages = {
      CAMERA: {
        [RESULTS.DENIED]: 'Camera permission is needed to take photos for your tasks.',
        [RESULTS.BLOCKED]: 'Camera permission has been blocked. Please enable it in settings.',
        [RESULTS.UNAVAILABLE]: 'Camera is not available on this device.',
      },
      STORAGE: {
        [RESULTS.DENIED]: 'Storage permission is needed to access your photos.',
        [RESULTS.BLOCKED]: 'Storage permission has been blocked. Please enable it in settings.',
        [RESULTS.UNAVAILABLE]: 'Storage is not available on this device.',
      },
      NOTIFICATIONS: {
        [RESULTS.DENIED]: 'Notification permission is needed to send task reminders.',
        [RESULTS.BLOCKED]: 'Notification permission has been blocked. Please enable it in settings.',
        [RESULTS.UNAVAILABLE]: 'Notifications are not available on this device.',
      },
      LOCATION: {
        [RESULTS.DENIED]: 'Location permission is needed for location-based features.',
        [RESULTS.BLOCKED]: 'Location permission has been blocked. Please enable it in settings.',
        [RESULTS.UNAVAILABLE]: 'Location is not available on this device.',
      },
    };

    const message = messages[permissionType]?.[status] || 'Permission is required for this feature.';
    
    Alert.alert(
      'Permission Required',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Settings', 
          onPress: () => this.openSettings(),
          style: 'default'
        }
      ]
    );
  }

  showMultiplePermissionsAlert(permissionTypes, results) {
    const deniedPermissions = permissionTypes.filter(type => !results[type].granted);
    
    Alert.alert(
      'Permissions Required',
      `The following permissions are needed: ${deniedPermissions.join(', ')}. Please enable them in settings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Settings', 
          onPress: () => this.openSettings(),
          style: 'default'
        }
      ]
    );
  }

  async openSettings() {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error('Error opening settings:', error);
      Alert.alert(
        'Open Settings',
        'Please go to Settings > Apps > Task Manager > Permissions to enable the required permissions.',
        [{ text: 'OK' }]
      );
    }
  }

  async checkAllPermissions() {
    const permissionTypes = Object.keys(this.permissions);
    const results = {};
    
    for (const permissionType of permissionTypes) {
      results[permissionType] = await this.checkPermission(permissionType);
    }
    
    return results;
  }

  async requestAllPermissions() {
    const permissionTypes = Object.keys(this.permissions);
    return await this.requestMultiplePermissions(permissionTypes);
  }

  getPermissionStatusMessage(permissionType, status) {
    const messages = {
      CAMERA: {
        [RESULTS.GRANTED]: 'Camera permission granted',
        [RESULTS.DENIED]: 'Camera permission denied',
        [RESULTS.BLOCKED]: 'Camera permission blocked',
        [RESULTS.UNAVAILABLE]: 'Camera not available',
      },
      STORAGE: {
        [RESULTS.GRANTED]: 'Storage permission granted',
        [RESULTS.DENIED]: 'Storage permission denied',
        [RESULTS.BLOCKED]: 'Storage permission blocked',
        [RESULTS.UNAVAILABLE]: 'Storage not available',
      },
      NOTIFICATIONS: {
        [RESULTS.GRANTED]: 'Notification permission granted',
        [RESULTS.DENIED]: 'Notification permission denied',
        [RESULTS.BLOCKED]: 'Notification permission blocked',
        [RESULTS.UNAVAILABLE]: 'Notifications not available',
      },
      LOCATION: {
        [RESULTS.GRANTED]: 'Location permission granted',
        [RESULTS.DENIED]: 'Location permission denied',
        [RESULTS.BLOCKED]: 'Location permission blocked',
        [RESULTS.UNAVAILABLE]: 'Location not available',
      },
    };
    
    return messages[permissionType]?.[status] || 'Unknown permission status';
  }
}

export default new PermissionService();

