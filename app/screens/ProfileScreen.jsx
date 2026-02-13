import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Animated,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { useSelector } from 'react-redux';
import NetInfo from '@react-native-community/netinfo';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import StorageService, { CACHE_EXPIRATION } from '../services/StorageService';

export default function ProfileScreen({ navigation, isDark = false, user: propsUser }) {
  const [user, setUser] = useState(propsUser);
  const [isOffline, setIsOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [profileStats, setProfileStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [imageLoading, setImageLoading] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Get tasks from Redux store for stats
  const { tasks } = useSelector(state => state.tasks);

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
    initializeProfile();

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

    // Monitor network status
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !state.isConnected;
      setIsOffline(offline);
      
      if (offline && isEditing) {
        Alert.alert(
          'Connection Lost',
          'You went offline while editing. Changes will be saved locally and synced when you reconnect.',
          [{ text: 'OK' }]
        );
      }
    });

    return unsubscribe;
  }, []);

  // Update stats when tasks change
  useEffect(() => {
    calculateProfileStats();
  }, [tasks]);

  const initializeProfile = async () => {
    try {
      setLoading(true);
      await loadUserProfile();
      await calculateProfileStats();
    } catch (error) {
      console.error('Error initializing profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      // Try to get from cache first
      const cachedUser = await StorageService.getCached('user_profile', CACHE_EXPIRATION.LONG);
      
      if (cachedUser) {
        setUser(cachedUser);
        setLastSyncTime(new Date().toISOString());
      } else {
        // Load from AsyncStorage
        const storedUser = await StorageService.getUser();
        
        if (storedUser) {
          setUser(storedUser);
          // Cache it for future use
          await StorageService.setCached('user_profile', storedUser, CACHE_EXPIRATION.LONG);
          setLastSyncTime(new Date().toISOString());
        } else if (propsUser) {
          // Use props user as fallback
          setUser(propsUser);
          // Save to storage
          await StorageService.saveUser(propsUser);
          await StorageService.setCached('user_profile', propsUser, CACHE_EXPIRATION.LONG);
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      
      // Fallback to props user if available
      if (propsUser) {
        setUser(propsUser);
      }
    }
  };

  const calculateProfileStats = async () => {
    try {
      // Try to get from cache first
      const cachedStats = await StorageService.getCached('profile_stats', CACHE_EXPIRATION.SHORT);
      
      if (cachedStats) {
        setProfileStats(cachedStats);
      } else {
        // Load tasks from storage
        const storedTasks = await StorageService.getTasks();
        const tasksToUse = storedTasks.length > 0 ? storedTasks : tasks;
        
        const stats = {
          totalTasks: tasksToUse.length,
          completedTasks: tasksToUse.filter(t => t.completed).length,
          pendingTasks: tasksToUse.filter(t => !t.completed).length,
        };
        
        setProfileStats(stats);
        
        // Cache the stats
        await StorageService.setCached('profile_stats', stats, CACHE_EXPIRATION.SHORT);
      }
    } catch (error) {
      console.error('Error calculating profile stats:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    
    try {
      // Check network status
      const netInfo = await NetInfo.fetch();
      
      if (!netInfo.isConnected) {
        Alert.alert(
          'Offline',
          'Cannot refresh profile data while offline. Showing cached data.',
          [{ text: 'OK' }]
        );
        setRefreshing(false);
        return;
      }

      // Reload user profile
      await loadUserProfile();
      
      // Recalculate stats
      await calculateProfileStats();
      
      // Clear relevant caches to force fresh data
      await StorageService.remove('CACHE_user_profile');
      await StorageService.remove('CACHE_profile_stats');
      
      // Reload with fresh data
      await loadUserProfile();
      await calculateProfileStats();
      
      setLastSyncTime(new Date().toISOString());
      
      Alert.alert('Success', 'Profile refreshed successfully!');
    } catch (error) {
      console.error('Error refreshing profile:', error);
      Alert.alert('Error', 'Failed to refresh profile. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleEditProfile = () => {
    if (!user) return;
    
    setEditedName(user.name || '');
    setEditedEmail(user.email || '');
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!editedName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    if (!editedEmail.trim()) {
      Alert.alert('Error', 'Email cannot be empty');
      return;
    }

    try {
      setLoading(true);

      const updatedUser = {
        ...user,
        name: editedName.trim(),
        email: editedEmail.trim(),
        lastUpdated: new Date().toISOString(),
      };

      // Save to AsyncStorage
      await StorageService.saveUser(updatedUser);

      // Update caches
      await StorageService.setCached('user_profile', updatedUser, CACHE_EXPIRATION.LONG);
      await StorageService.setCached('current_user', updatedUser, CACHE_EXPIRATION.LONG);

      // Update state
      setUser(updatedUser);
      setIsEditing(false);

      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedName('');
    setEditedEmail('');
  };

  const handleImagePicker = (type) => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 500,
      maxHeight: 500,
      includeBase64: false,
    };

    const callback = async (response) => {
      if (response.didCancel) {
        return;
      }

      if (response.error) {
        Alert.alert('Error', 'Failed to select image. Please try again.');
        return;
      }

      if (response.assets && response.assets[0]) {
        try {
          setImageLoading(true);
          const asset = response.assets[0];

          const updatedUser = {
            ...user,
            avatar: asset.uri,
            lastUpdated: new Date().toISOString(),
          };

          // Save to AsyncStorage
          await StorageService.saveUser(updatedUser);

          // Update caches
          await StorageService.setCached('user_profile', updatedUser, CACHE_EXPIRATION.LONG);
          await StorageService.setCached('current_user', updatedUser, CACHE_EXPIRATION.LONG);

          // Update state
          setUser(updatedUser);

          Alert.alert('Success', 'Profile picture updated successfully!');
        } catch (error) {
          console.error('Error updating avatar:', error);
          Alert.alert('Error', 'Failed to update profile picture. Please try again.');
        } finally {
          setImageLoading(false);
        }
      }
    };

    if (type === 'camera') {
      launchCamera(options, callback);
    } else {
      launchImageLibrary(options, callback);
    }
  };

  const handleChangePhoto = () => {
    Alert.alert(
      'Change Profile Picture',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: () => handleImagePicker('camera'),
        },
        {
          text: 'Choose from Gallery',
          onPress: () => handleImagePicker('gallery'),
        },
        {
          text: 'Remove Photo',
          onPress: handleRemovePhoto,
          style: 'destructive',
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleRemovePhoto = async () => {
    try {
      setImageLoading(true);

      const updatedUser = {
        ...user,
        avatar: null,
        lastUpdated: new Date().toISOString(),
      };

      // Save to AsyncStorage
      await StorageService.saveUser(updatedUser);

      // Update caches
      await StorageService.setCached('user_profile', updatedUser, CACHE_EXPIRATION.LONG);
      await StorageService.setCached('current_user', updatedUser, CACHE_EXPIRATION.LONG);

      // Update state
      setUser(updatedUser);

      Alert.alert('Success', 'Profile picture removed successfully!');
    } catch (error) {
      console.error('Error removing avatar:', error);
      Alert.alert('Error', 'Failed to remove profile picture. Please try again.');
    } finally {
      setImageLoading(false);
    }
  };

  const handleViewTasks = () => {
    navigation.navigate('Home');
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    
    const syncDate = new Date(lastSyncTime);
    const now = new Date();
    const diffMs = now - syncDate;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    return syncDate.toLocaleDateString();
  };

  if (loading && !user) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          Loading profile...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            style={styles.editHeaderButton}
            onPress={handleEditProfile}
            disabled={isEditing}
          >
            <Text style={styles.editHeaderButtonText}>
              {isEditing ? '...' : '✏️'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Offline Banner */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>📡 Offline - Showing cached data</Text>
          </View>
        )}

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.colors.surface }]}>
          {/* Avatar */}
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={handleChangePhoto}
            disabled={imageLoading}
          >
            {imageLoading ? (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            ) : user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Text style={styles.cameraIconText}>📷</Text>
            </View>
            {isOffline && (
              <View style={styles.offlineIndicator}>
                <Text style={styles.offlineIndicatorText}>📡</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* User Info */}
          {!isEditing ? (
            <>
              <Text style={[styles.userName, { color: theme.colors.text }]}>
                {user?.name || 'User'}
              </Text>
              <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>
                {user?.email || 'user@example.com'}
              </Text>
              
              {user?.joinDate && (
                <Text style={[styles.joinDate, { color: theme.colors.textSecondary }]}>
                  Member since {new Date(user.joinDate).toLocaleDateString()}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleEditProfile}
              >
                <Text style={styles.editButtonText}>✏️ Edit Profile</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.editForm}>
              <Text style={[styles.editLabel, { color: theme.colors.text }]}>Name</Text>
              <TextInput
                style={[styles.editInput, { 
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                }]}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Enter your name"
                placeholderTextColor={theme.colors.textSecondary}
              />

              <Text style={[styles.editLabel, { color: theme.colors.text }]}>Email</Text>
              <TextInput
                style={[styles.editInput, { 
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                }]}
                value={editedEmail}
                onChangeText={setEditedEmail}
                placeholder="Enter your email"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={[styles.editActionButton, { backgroundColor: theme.colors.textSecondary }]}
                  onPress={handleCancelEdit}
                  disabled={loading}
                >
                  <Text style={styles.editActionButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.editActionButton, { backgroundColor: theme.colors.success }]}
                  onPress={handleSaveProfile}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.editActionButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Stats Card */}
        <View style={[styles.statsCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.statsTitle, { color: theme.colors.text }]}>
            📊 Task Statistics
          </Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                {profileStats.totalTasks}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Total Tasks
              </Text>
            </View>

            <View style={[styles.statItem, styles.statItemBorder, { borderLeftColor: theme.colors.border, borderRightColor: theme.colors.border }]}>
              <Text style={[styles.statValue, { color: theme.colors.success }]}>
                {profileStats.completedTasks}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Completed
              </Text>
            </View>

            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.colors.warning }]}>
                {profileStats.pendingTasks}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Pending
              </Text>
            </View>
          </View>

          {profileStats.totalTasks > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      backgroundColor: theme.colors.success,
                      width: `${(profileStats.completedTasks / profileStats.totalTasks) * 100}%`
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>
                {Math.round((profileStats.completedTasks / profileStats.totalTasks) * 100)}% Complete
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.viewTasksButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleViewTasks}
          >
            <Text style={styles.viewTasksButtonText}>View All Tasks</Text>
          </TouchableOpacity>
        </View>

        {/* Sync Info Card */}
        <View style={[styles.syncCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.syncHeader}>
            <Text style={[styles.syncTitle, { color: theme.colors.text }]}>
              🔄 Sync Status
            </Text>
            <View style={[
              styles.syncStatusBadge,
              { backgroundColor: isOffline ? theme.colors.warning : theme.colors.success }
            ]}>
              <Text style={styles.syncStatusText}>
                {isOffline ? 'Offline' : 'Online'}
              </Text>
            </View>
          </View>

          <View style={styles.syncInfo}>
            <Text style={[styles.syncLabel, { color: theme.colors.textSecondary }]}>
              Last synced:
            </Text>
            <Text style={[styles.syncValue, { color: theme.colors.text }]}>
              {formatLastSync()}
            </Text>
          </View>

          {isOffline && (
            <View style={styles.offlineMessage}>
              <Text style={[styles.offlineMessageText, { color: theme.colors.textSecondary }]}>
                Your data is cached locally. Changes will sync automatically when you're back online.
              </Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.actionIcon}>⚙️</Text>
            <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Settings</Text>
            <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>
              App preferences
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: theme.colors.surface }]}
            onPress={() => Alert.alert('Help', 'Help & support coming soon!')}
          >
            <Text style={styles.actionIcon}>❓</Text>
            <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Help</Text>
            <Text style={[styles.actionSubtitle, { color: theme.colors.textSecondary }]}>
              Support & FAQ
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  editHeaderButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 40,
    height: 30,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editHeaderButtonText: {
    fontSize: 16,
    color: '#fff',
  },
  offlineBanner: {
    backgroundColor: '#fef3c7',
    padding: 12,
    margin: 20,
    marginBottom: 0,
    borderRadius: 12,
    alignItems: 'center',
  },
  offlineText: {
    color: '#92400e',
    fontSize: 14,
    fontWeight: '600',
  },
  profileCard: {
    margin: 20,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4f46e5',
  },
  cameraIconText: {
    fontSize: 14,
  },
  offlineIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#fef3c7',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  offlineIndicatorText: {
    fontSize: 12,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    marginBottom: 8,
  },
  joinDate: {
    fontSize: 14,
    marginBottom: 16,
  },
  editButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editForm: {
    width: '100%',
    marginTop: 16,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  editActionButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  editActionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statsCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  viewTasksButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  viewTasksButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  syncCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  syncHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  syncTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  syncStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  syncStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  syncInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncLabel: {
    fontSize: 14,
  },
  syncValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  offlineMessage: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
  },
  offlineMessageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  actionCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
});