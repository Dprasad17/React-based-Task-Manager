import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Animated, Alert, ActivityIndicator, ScrollView } from 'react-native';
import StorageService, { CACHE_EXPIRATION } from '../services/StorageService';

export default function SettingsScreen({ navigation, isDark = false, setIsDark, onLogout }) {
  const [notifications, setNotifications] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [dataUsage, setDataUsage] = useState('wifi');
  const [loading, setLoading] = useState(false);
  const [storageInfo, setStorageInfo] = useState(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const theme = {
    colors: {
      primary: '#4f46e5',
      secondary: '#2563eb',
      background: isDark ? '#111827' : '#f9fafb',
      surface: isDark ? '#1f2937' : '#ffffff',
      text: isDark ? '#ffffff' : '#111827',
      textSecondary: isDark ? '#9ca3af' : '#6b7280',
      border: isDark ? '#374151' : '#e5e7eb',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
    },
  };

  useEffect(() => {
    loadSettings();
    loadStorageInfo();
    
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Try to get from cache first
      const cachedSettings = await StorageService.getCached('app_settings', CACHE_EXPIRATION.LONG);
      
      if (cachedSettings) {
        applySettings(cachedSettings);
      } else {
        // Load from AsyncStorage
        const settings = await StorageService.getSettings();
        applySettings(settings);
        // Cache settings
        await StorageService.setCached('app_settings', settings, CACHE_EXPIRATION.LONG);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const applySettings = (settings) => {
    setNotifications(settings.notifications ?? true);
    setHapticFeedback(settings.hapticFeedback ?? true);
    setAutoSync(settings.autoSync ?? true);
    setDataUsage(settings.dataUsage ?? 'wifi');
  };

  const loadStorageInfo = async () => {
    try {
      const info = await StorageService.getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('Error loading storage info:', error);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      // Save to AsyncStorage
      await StorageService.saveSettings(newSettings);
      
      // Update cache
      await StorageService.setCached('app_settings', newSettings, CACHE_EXPIRATION.LONG);
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    }
  };

  const handleNotificationChange = async (value) => {
    setNotifications(value);
    await saveSettings({
      notifications: value,
      hapticFeedback,
      autoSync,
      dataUsage,
    });
  };

  const handleHapticChange = async (value) => {
    setHapticFeedback(value);
    await saveSettings({
      notifications,
      hapticFeedback: value,
      autoSync,
      dataUsage,
    });
  };

  const handleAutoSyncChange = async (value) => {
    setAutoSync(value);
    await saveSettings({
      notifications,
      hapticFeedback,
      autoSync: value,
      dataUsage,
    });
  };

  const handleDataUsageChange = async (value) => {
    setDataUsage(value);
    await saveSettings({
      notifications,
      hapticFeedback,
      autoSync,
      dataUsage: value,
    });
  };

  const handleThemeChange = async (value) => {
    setIsDark(value);
    await StorageService.saveTheme(value ? 'dark' : 'light');
    // Update theme cache
    await StorageService.setCached('app_theme', value ? 'dark' : 'light', CACHE_EXPIRATION.LONG);
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      `This will clear ${storageInfo?.cacheKeys || 0} cached items. Your tasks and settings will remain safe.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await StorageService.clearCache();
              await loadStorageInfo();
              Alert.alert('Success', 'Cache cleared successfully!');
            } catch (error) {
              console.error('Error clearing cache:', error);
              Alert.alert('Error', 'Failed to clear cache. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out? Your data will be saved locally.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'default',
          onPress: async () => {
            try {
              setLoading(true);
              // Clear user session cache
              await StorageService.clearCache();
              
              // Call the onLogout prop from App.tsx which handles AuthContext logout
              if (onLogout) {
                onLogout();
              } else {
                // Fallback if onLogout is not provided
                Alert.alert(
                  'Logged Out',
                  'You have been successfully logged out. Please restart the app.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      '⚠️ WARNING: This will delete ALL your tasks, settings, and user data. This action cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Everything', 
          style: 'destructive',
          onPress: async () => {
            Alert.alert(
              'Are you absolutely sure?',
              'This is your last chance to cancel. All data will be permanently deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setLoading(true);
                      await StorageService.clearAllData();
                      
                      // Call onLogout to handle navigation properly
                      if (onLogout) {
                        onLogout();
                        Alert.alert('Success', 'All data has been cleared.');
                      } else {
                        Alert.alert(
                          'Success', 
                          'All data has been cleared. Please restart the app.',
                          [{ text: 'OK' }]
                        );
                      }
                    } catch (error) {
                      console.error('Error clearing all data:', error);
                      Alert.alert('Error', 'Failed to clear data. Please try again.');
                    } finally {
                      setLoading(false);
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  const handleExportData = async () => {
    try {
      setLoading(true);
      const info = await StorageService.getStorageInfo();
      
      Alert.alert(
        'Storage Data',
        `Total Tasks: ${info.tasks}\n` +
        `Cache Items: ${info.cacheKeys}\n` +
        `Total Size: ${info.totalSizeFormatted}\n\n` +
        `Total Keys: ${info.totalKeys}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error exporting data:', error);
      Alert.alert('Error', 'Failed to export data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <Text style={[styles.title, { color: theme.colors.text }]}>Settings</Text>
        
        {/* Appearance Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>🎨 Appearance</Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={handleThemeChange}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={isDark ? '#fff' : theme.colors.textSecondary}
              disabled={loading}
            />
          </View>
        </View>

        {/* Notifications Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>🔔 Notifications</Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Push Notifications</Text>
            <Switch
              value={notifications}
              onValueChange={handleNotificationChange}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={notifications ? '#fff' : theme.colors.textSecondary}
              disabled={loading}
            />
          </View>

          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Haptic Feedback</Text>
            <Switch
              value={hapticFeedback}
              onValueChange={handleHapticChange}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={hapticFeedback ? '#fff' : theme.colors.textSecondary}
              disabled={loading}
            />
          </View>
        </View>

        {/* Sync Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>🔄 Sync & Data</Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Auto Sync</Text>
            <Switch
              value={autoSync}
              onValueChange={handleAutoSyncChange}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={autoSync ? '#fff' : theme.colors.textSecondary}
              disabled={loading}
            />
          </View>

          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Data Usage</Text>
          </View>
          <View style={styles.dataUsageContainer}>
            {['wifi', 'cellular', 'always'].map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.dataUsageOption,
                  {
                    backgroundColor: dataUsage === option ? theme.colors.primary : 'transparent',
                    borderColor: theme.colors.border,
                  }
                ]}
                onPress={() => handleDataUsageChange(option)}
                disabled={loading}
              >
                <Text style={[
                  styles.dataUsageText,
                  { color: dataUsage === option ? '#fff' : theme.colors.text }
                ]}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Storage Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>💾 Storage</Text>
          
          {storageInfo && (
            <View style={styles.storageInfo}>
              <View style={styles.storageRow}>
                <Text style={[styles.storageLabel, { color: theme.colors.textSecondary }]}>
                  Total Tasks:
                </Text>
                <Text style={[styles.storageValue, { color: theme.colors.text }]}>
                  {storageInfo.tasks}
                </Text>
              </View>
              <View style={styles.storageRow}>
                <Text style={[styles.storageLabel, { color: theme.colors.textSecondary }]}>
                  Cache Items:
                </Text>
                <Text style={[styles.storageValue, { color: theme.colors.text }]}>
                  {storageInfo.cacheKeys}
                </Text>
              </View>
              <View style={[styles.storageRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.storageLabel, { color: theme.colors.textSecondary }]}>
                  Total Size:
                </Text>
                <Text style={[styles.storageValue, { color: theme.colors.text }]}>
                  {storageInfo.totalSizeFormatted}
                </Text>
              </View>
            </View>
          )}
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleExportData}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>📊 View Storage Details</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.colors.warning, marginTop: 12 }]}
            onPress={handleClearCache}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>🗑️ Clear Cache</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.colors.error, marginTop: 12 }]}
            onPress={handleClearAllData}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>⚠️ Clear All Data</Text>
          </TouchableOpacity>
        </View>

        {/* Account Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>👤 Account</Text>
          
          <TouchableOpacity 
            style={[styles.logoutButton, { backgroundColor: theme.colors.secondary }]}
            onPress={handleLogout}
            disabled={loading}
          >
            <Text style={styles.logoutButtonText}>🚪 Log Out</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 24,
    marginTop: 20,
    textAlign: 'center',
  },
  section: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingLabel: {
    fontSize: 16,
    flex: 1,
    fontWeight: '500',
  },
  dataUsageContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  dataUsageOption: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  dataUsageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  storageInfo: {
    marginBottom: 16,
  },
  storageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  storageLabel: {
    fontSize: 14,
  },
  storageValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});