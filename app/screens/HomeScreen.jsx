import React, { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  RefreshControl,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { 
  loadTasks, 
  deleteTask,
  setOffline,
  clearError 
} from '../store/store';
import NetInfo from '@react-native-community/netinfo';
import ApiService from '../services/ApiService';
import StorageService from '../services/StorageService';
import { useFocusEffect } from '@react-navigation/native'; // Added for instant refresh

// Helper function to get priority color
const getPriorityColor = (priority) => {
  switch (priority) {
    case 'high': return '#ef4444';
    case 'medium': return '#f59e0b';
    case 'low': return '#10b981';
    default: return '#10b981';
  }
};

// Source badge component
const SourceBadge = ({ source, offline, taskSource }) => { 
  const getSourceInfo = () => {
    
    // UPDATED: Change 'Offline' to 'Local Task' for unsynced tasks (yellow/orange)
    if (offline) return { text: 'Local Task', color: '#f59e0b', icon: '📡' };
    
    // Check for the permanent local task source (purple)
    if (taskSource === 'local_permanent') return { text: 'Local Task', color: '#8b5cf6', icon: '📌' }; 

    if (source === 'cache') return { text: 'Local Cache', color: '#10b981', icon: '⚡' };
    if (source === 'api') return { text: 'API', color: '#3b82f6', icon: '🌐' };
    return { text: 'Stored', color: '#6b7280', icon: '💾' };
  };

  const info = getSourceInfo();

  return (
    <View style={[styles.sourceBadge, { backgroundColor: info.color }]}>
      <Text style={styles.sourceBadgeText}>{info.icon} {info.text}</Text>
    </View>
  );
};

// Optimized Task Item with animations
const TaskItem = React.memo(({ task, onPress, onDelete, theme, source, offline }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { 
      toValue: 1, 
      duration: 500, 
      useNativeDriver: true 
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View 
      style={[
        styles.taskItem,
        { opacity: fadeAnim, backgroundColor: theme.colors.surface }
      ]}
    >
      <View style={styles.taskContent}>
        <View 
          style={[
            styles.priorityIndicator, 
            { backgroundColor: getPriorityColor(task.priority) }
          ]} 
        />
        
        {task.image && (
          <Image 
            source={{ uri: task.image }} 
            style={styles.taskImage}
            resizeMode="cover"
          />
        )}
        
        <View style={styles.taskText}>
          <Text style={[styles.taskTitle, { color: theme.colors.text }]} numberOfLines={2}>
            {task.title}
          </Text>
          <Text style={[styles.taskSubtitle, { color: theme.colors.textSecondary }]}>
            {task.description || 'No description'}
          </Text>
          {/* PASS THE NEW 'task.source' PROPERTY */}
          <SourceBadge source={source} offline={offline || task.offline} taskSource={task.source} />
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
          onPress={onPress}
          accessibilityLabel="View task details"
          accessibilityRole="button"
        >
          <Text style={styles.actionButtonText}>👁️</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.colors.error }]}
          onPress={onDelete}
          accessibilityLabel="Delete task"
          accessibilityRole="button"
        >
          <Text style={styles.actionButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

// Empty state component
const EmptyState = ({ theme, onAddTask, onLoadFromAPI }) => (
  <View style={styles.emptyContainer}>
    <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
      No tasks yet
    </Text>
    <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
      Create your first task or load from API!
    </Text>
    <View style={styles.emptyActions}>
      <TouchableOpacity 
        style={[styles.emptyButton, { backgroundColor: theme.colors.primary }]}
        onPress={onAddTask}
        accessibilityLabel="Add your first task"
        accessibilityRole="button"
      >
        <Text style={styles.emptyButtonText}>+ Add Task</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.emptyButton, { backgroundColor: theme.colors.secondary }]}
        onPress={onLoadFromAPI}
        accessibilityLabel="Load tasks from API"
        accessibilityRole="button"
      >
        <Text style={styles.emptyButtonText}>🌐 Load from API</Text>
      </TouchableOpacity>
    </View>
  </View>
);

export default function HomeScreen({ navigation, route, isDark = false }) {
  const dispatch = useDispatch();
  // Using simplified Redux state structure (as derived from the thunk import)
  const { tasks, loading, error, isOffline } = useSelector(state => state.tasks); 
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery] = useState('');
  const [localTasks, setLocalTasks] = useState([]);
  const [loadingLocal, setLoadingLocal] = useState(true);
  const [dataSource, setDataSource] = useState('storage'); // 'cache', 'storage', 'api'
  const [isOfflineLocal, setIsOfflineLocal] = useState(false);

  // Create theme object
  const theme = useMemo(() => ({
    isDark,
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
  }), [isDark]);

  // Function to remove duplicate tasks
  const removeDuplicateTasks = (taskArray) => {
    const seen = new Set();
    // Prioritize tasks with 'api' or 'local_permanent' source
    return taskArray
      .sort((a, b) => {
        if (a.source === 'api') return -1;
        if (b.source === 'api') return 1;
        if (a.source === 'local_permanent') return -1;
        if (b.source === 'local_permanent') return 1;
        return 0;
      })
      .filter(task => {
        const isDuplicate = seen.has(task.id);
        seen.add(task.id);
        // Only keep the first occurrence (which is prioritized by the sort)
        return !isDuplicate;
      });
  };

  // Load tasks from API with caching
  const loadTasksFromAPI = useCallback(async (forceRefresh = false) => {
    try {
      setLoadingLocal(true);
      
      console.log('🔄 Loading tasks from API and Local Storage...');
      // ApiService.getTasks now handles combining API/Cache and permanent local tasks
      // Assuming ApiService.getTasks exists and returns { success, data, source, offline }
      const result = await ApiService.getTasks(forceRefresh);
      
      if (result.success) {
        const uniqueTasks = removeDuplicateTasks(result.data);
        setLocalTasks(uniqueTasks);
        setDataSource(result.source);
        
        console.log(`✅ Tasks loaded from: ${result.source}`);
        console.log(`📊 Total tasks: ${uniqueTasks.length}`);
        
        // Show notification based on source
        if (result.offline) {
          Alert.alert(
            '📡 Offline Mode',
            'Showing cached and local data. Changes will sync when you reconnect.',
            [{ text: 'OK' }]
          );
        } else if (result.source === 'api') {
          console.log('✅ Fresh data from API loaded successfully');
        }
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      Alert.alert('Error', 'Failed to load tasks. Please try again.');
    } finally {
      setLoadingLocal(false);
    }
  }, []); 

  // Initial load
  useEffect(() => {
    loadTasksFromAPI();
  }, [loadTasksFromAPI]);
  
  // Use useFocusEffect to reload when returning from AddTaskScreen (Previous Fix)
  useFocusEffect(
    useCallback(() => {
      // Check for the refresh parameter set in AddTaskScreen
      if (route.params?.refresh) {
        console.log('Detected refresh signal from AddTaskScreen. Reloading tasks...');
        // Force a refresh from all sources
        loadTasksFromAPI(true); 
        // Clear the refresh parameter so it only triggers once
        navigation.setParams({ refresh: undefined }); 
      }
    }, [route.params?.refresh, loadTasksFromAPI, navigation]) 
  );

  // Network status monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !state.isConnected;
      setIsOfflineLocal(offline);
      dispatch(setOffline(offline));

      // Auto-sync when coming back online
      if (!offline && isOfflineLocal) {
        handleSyncOfflineChanges();
      }
    });
    return unsubscribe;
  }, [dispatch, isOfflineLocal, handleSyncOfflineChanges]);

  // Error handling
  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [
        { text: 'OK', onPress: () => dispatch(clearError()) }
      ]);
    }
  }, [error, dispatch]);

  // Sync offline changes
  const handleSyncOfflineChanges = useCallback(async () => {
    try {
      console.log('🔄 Syncing offline changes...');
      // Assuming ApiService.syncOfflineChanges returns { success, syncResults }
      const result = await ApiService.syncOfflineChanges();
      
      if (result.success) {
        Alert.alert(
          '✅ Sync Complete',
          `Successfully synced ${result.syncResults.length} pending changes.`,
          [{ text: 'OK' }]
        );
        
        // Reload tasks to get the updated API IDs and data
        await loadTasksFromAPI(true);
      }
    } catch (error) {
      console.error('Error syncing:', error);
    }
  }, [loadTasksFromAPI]);

  // Memoized filtered tasks (MODIFIED FOR LOCAL_PERMANENT ONLY)
  const filteredTasks = useMemo(() => {
    // 1. Get unique tasks from all sources
    const allTasks = removeDuplicateTasks(localTasks);
    
    // 2. FILTER: Only keep tasks explicitly marked as permanently local (manually added)
    const permanentLocalTasks = allTasks.filter(task => task.source === 'local_permanent');

    if (!searchQuery) return permanentLocalTasks;
    
    // 3. Apply search query filter to the filtered tasks
    return permanentLocalTasks.filter(task => 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [localTasks, searchQuery]);

  const handleDelete = useCallback(async (id) => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              console.log(`🗑️ Deleting task ${id}...`);
              
              // Let ApiService handle the delete logic (local_permanent vs. API/Offline queue)
              // Assuming ApiService.deleteTask returns { success, source, offline, error }
              const result = await ApiService.deleteTask(id);
              
              if (result.success) {
                // Update local state immediately
                setLocalTasks(prev => prev.filter(task => task.id !== id));
                
                Alert.alert('Success', 'Task deleted successfully!');
                
                if (result.source === 'local_permanent') {
                  console.log('📌 Local task removed.');
                } else if (result.offline) {
                  Alert.alert(
                    'Offline',
                    'Task deletion recorded locally. Will sync when online.',
                    [{ text: 'OK' }]
                  );
                }
              } else {
                Alert.alert('Error', result.error || 'Failed to delete task');
              }
            } catch (deleteError) {
              console.error('Error deleting task:', deleteError);
              Alert.alert('Error', 'Failed to delete task. Please try again.');
            }
          }
        }
      ]
    );
  }, []);

  // Optimized render item with unique key
  const renderItem = useCallback(({ item, index }) => (
    <TaskItem
      key={`task-${item.id}-${index}`}
      task={item}
      onPress={() => navigation.navigate('TaskDetails', { taskId: item.id, task: item })}
      onDelete={() => handleDelete(item.id)}
      theme={theme}
      // Note: dataSource will still reflect the last *fetch* source (e.g., 'api' or 'cache'), 
      // but the tasks displayed are filtered to 'local_permanent'
      source={dataSource}
      offline={isOfflineLocal || item.offline}
    />
  ), [navigation, theme, handleDelete, dataSource, isOfflineLocal]);

  // Memoized key extractor
  const keyExtractor = useCallback((item, index) => {
    return `task-${item.id}-${index}-${item.createdAt || Date.now()}`;
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadTasksFromAPI(true); // Force refresh from API
    } finally {
      setRefreshing(false);
    }
  }, [loadTasksFromAPI]);

  const handleAddTask = useCallback(() => {
    navigation.navigate('AddTask');
  }, [navigation]);

  const handleLoadFromAPI = useCallback(async () => {
    // We intentionally don't load from API when this button is pressed, 
    // as the user only wants local tasks.
    Alert.alert("Feature Blocked", "Tasks from API are currently disabled based on your configuration. Only manually added tasks are visible.");
  }, []);

  if ((loading || loadingLocal) && filteredTasks.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            {/* The loading text is updated to reflect that it's checking local/API */}
            Loading tasks... (Checking local cache and API)
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with network status */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>My Local Tasks</Text>
            <Text style={styles.subtitle}>
              {filteredTasks.length} Task{filteredTasks.length !== 1 ? 's' : ''}
              {isOfflineLocal && ' (Offline)'}
            </Text>
            {dataSource && (
              <Text style={styles.sourceText}>
                {/* Updated source text to reflect only local tasks are shown */}
                📌 Showing only permanent local tasks
              </Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleSyncOfflineChanges}
              accessibilityLabel="Sync offline changes"
              accessibilityRole="button"
            >
              <Text style={styles.headerButtonText}>🔄</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.navigate('Profile')}
              accessibilityLabel="Go to Profile"
              accessibilityRole="button"
            >
              <Text style={styles.headerButtonText}>👤</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.navigate('Settings')}
              accessibilityLabel="Go to Settings"
              accessibilityRole="button"
            >
              <Text style={styles.headerButtonText}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>
        {isOfflineLocal && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>📡 Working offline - Changes will sync automatically</Text>
          </View>
        )}
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.searchIcon, { color: theme.colors.textSecondary }]}>🔍</Text>
        <Text style={[styles.searchPlaceholder, { color: theme.colors.textSecondary }]}>
          Search local tasks...
        </Text>
      </View>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <EmptyState theme={theme} onAddTask={handleAddTask} onLoadFromAPI={handleLoadFromAPI} />
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              title="Pull to refresh all data"
            />
          }
          // Performance optimizations
          windowSize={10}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          initialNumToRender={10}
          updateCellsBatchingPeriod={50}
          extraData={filteredTasks}
          // Accessibility
          accessibilityLabel="Tasks list"
          accessibilityRole="list"
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={handleAddTask}
        accessibilityLabel="Add new task"
        accessibilityRole="button"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    fontSize: 18,
    color: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    color: '#d1d5db',
    fontSize: 16,
    fontWeight: '500',
  },
  sourceText: {
    color: '#a5f3fc',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  offlineBanner: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  offlineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  searchPlaceholder: {
    fontSize: 16,
    flex: 1,
  },
  listContainer: {
    paddingBottom: 100,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  taskItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginVertical: 6,
    marginHorizontal: 16,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  taskContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  taskText: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  taskSubtitle: {
    fontSize: 12,
    marginBottom: 4,
  },
  priorityIndicator: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 20,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  sourceBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});