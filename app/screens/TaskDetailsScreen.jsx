import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Animated, 
  Alert, 
  Image,
  ActivityIndicator
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { updateTask, deleteTask } from '../store/store';
// Assuming these services are correctly implemented, they are left as is
import NotificationService from '../services/NotificationService';
import StorageService from '../services/StorageService';

export default function TaskDetailsScreen({ navigation, route, isDark = false }) {
  // 1. Get Task ID
  const { taskId } = route.params || {}; 
  const dispatch = useDispatch();
  const { tasks } = useSelector(state => state.tasks);

  // 2. Derive task directly from Redux (Primary Source of Truth)
  // FIX: Ensure both IDs are strings for reliable comparison.
  const taskFromRedux = tasks.find(t => String(t.id) === String(taskId));
  
  // 3. Local State (Fallback and Action Loading)
  const [task, setTask] = useState(taskFromRedux || null);
  const [loadingTask, setLoadingTask] = useState(!taskFromRedux); // Start loading if Redux doesn't have it
  const [loading, setLoading] = useState(false); // Action loading state (delete/complete)

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Theme definition
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

  /**
    * Function to load task data from persistent storage (Cache or AsyncStorage).
    * Used as a fallback only when Redux store is not yet populated.
    */
  const loadTaskFallback = async () => {
    if (!taskId) return;

    try {
      let foundTask = null;

      // 1. Try from cache (fast persistent read)
      foundTask = await StorageService.getCached(`task_${taskId}`);
      
      // 2. Last resort: load from AsyncStorage
      if (!foundTask) {
        foundTask = await StorageService.get(`task_${taskId}`); 
      }

      if (foundTask) {
        setTask(foundTask);
        // Cache the result for next time
        await StorageService.setCached(`task_${taskId}`, foundTask);
      }
    } catch (error) {
      console.error('Error loading task fallback:', error);
      Alert.alert('Error', 'Failed to load task details from storage.');
    } finally {
      setLoadingTask(false);
    }
  };

  /**
    * Primary effect for syncing with Redux and managing initial load/animations.
    * Runs whenever the Redux tasks array or the route taskId changes.
    */
  useEffect(() => {
    if (!taskId) {
      setTask(null);
      setLoadingTask(false);
      return;
    }

    // 1. Sync with Redux (Highest priority, real-time update)
    if (taskFromRedux) {
      setTask(taskFromRedux);
      setLoadingTask(false);
      // Update cache non-blocking with the latest Redux data
      StorageService.setCached(`task_${taskId}`, taskFromRedux);
    } else if (tasks.length > 0) {
      // Redux is populated, but this task is not found (deleted or doesn't exist)
      // This is a crucial check to prevent unnecessary fallback lookup for a non-existent task
      setTask(null);
      setLoadingTask(false);
    } else {
      // Redux is empty/loading: Fallback to persistent storage
      loadTaskFallback();
    }

    // 2. Run Animations
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
    
  }, [tasks, taskId]); // Dependency array simplified to only include primary data sources

  // Helper function to get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return theme.colors.error;
      case 'medium': return theme.colors.warning;
      case 'low': return theme.colors.success;
      default: return theme.colors.success;
    }
  };

  // Helper function for consistent date formatting and safety
  const getFormattedDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const handleToggleComplete = async () => {
    if (!task) return;

    try {
      setLoading(true);
      const updatedTask = { 
        ...task, 
        completed: !task.completed,
        completedAt: !task.completed ? new Date().toISOString() : null
      };

      // Update in AsyncStorage
      await StorageService.updateTask(task.id, updatedTask);
      
      // Update in Redux
      dispatch(updateTask(updatedTask));
      
      // Update cache
      await StorageService.setCached(`task_${task.id}`, updatedTask);
      
      // Clear tasks list cache to force refresh on other screens
      await StorageService.remove('CACHE_tasks_list');

      // Send notification
      try {
        const notificationTitle = updatedTask.completed ? '🎉 Task Completed!' : '📝 Task Reopened';
        const notificationBody = updatedTask.completed 
          ? `"${updatedTask.title}" has been marked as completed`
          : `"${updatedTask.title}" has been marked as pending`;
          
        await NotificationService.sendPushNotification(
          notificationTitle,
          notificationBody,
          { taskId: updatedTask.id, type: updatedTask.completed ? 'task_completed' : 'task_reopened' }
        );
      } catch (notificationError) {
        console.log('Notification not sent:', notificationError);
      }
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Error', 'Failed to update task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!task) return;

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
              setLoading(true);
              
              // Delete from AsyncStorage
              await StorageService.deleteTask(task.id);
              
              // Delete from Redux
              dispatch(deleteTask(task.id));
              
              // Clear caches
              await StorageService.remove(`CACHE_task_${task.id}`);
              await StorageService.remove('CACHE_tasks_list');
              
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting task:', error);
              Alert.alert('Error', 'Failed to delete task. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleEdit = () => {
    navigation.navigate('AddTask', { taskToEdit: task });
  };

  // Use a reliable full-screen container for centering
  if (loadingTask) {
    return (
      <View style={[styles.fullScreenContainer, { backgroundColor: theme.colors.background }]}> 
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          Loading task...
        </Text>
      </View>
    );
  }

  if (!task) {
    return (
      <View style={[styles.fullScreenContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          Task not found
        </Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
          <TouchableOpacity
            style={styles.headerBackButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.headerBackButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Task Details</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEdit}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Task Card */}
        <View style={[styles.taskCard, { backgroundColor: theme.colors.surface }]}>
          {/* Priority Indicator */}
          <View style={styles.priorityContainer}>
            <View 
              style={[
                styles.priorityIndicator, 
                { backgroundColor: getPriorityColor(task.priority) }
              ]} 
            />
            <Text style={[styles.priorityText, { color: getPriorityColor(task.priority) }]}>
              {task.priority ? (task.priority.charAt(0).toUpperCase() + task.priority.slice(1)) : 'Unknown'} Priority
            </Text>
          </View>

          {/* Task Image */}
          {task.image && (
            <View style={styles.imageContainer}>
              <Image 
                source={{ uri: task.image }} 
                style={styles.taskImage} 
                // Added image error handler
                onError={(e) => console.log('Image failed to load:', e.nativeEvent.error)}
              />
            </View>
          )}

          {/* Task Content */}
          <View style={styles.contentContainer}>
            <Text style={[styles.taskTitle, { color: theme.colors.text }]}>
              {task.title}
            </Text>
            
            {task.description && (
              <Text style={[styles.taskDescription, { color: theme.colors.textSecondary }]}>
                {task.description}
              </Text>
            )}

            {/* Task Meta */}
            <View style={styles.metaContainer}>
              <View style={[styles.metaItem, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>
                  Created
                </Text>
                <Text style={[styles.metaValue, { color: theme.colors.text }]}>
                  {getFormattedDate(task.createdAt)}
                </Text>
              </View>

              {task.dueDate && (
                <View style={[styles.metaItem, { borderBottomColor: theme.colors.border }]}>
                  <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>
                    Due Date
                  </Text>
                  <Text style={[styles.metaValue, { color: theme.colors.text }]}>
                    {task.dueDate}
                  </Text>
                </View>
              )}

              <View style={[styles.metaItem, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>
                  Status
                </Text>
                <Text style={[
                  styles.statusText, 
                  { color: task.completed ? theme.colors.success : theme.colors.warning }
                ]}>
                  {task.completed ? 'Completed' : 'Pending'}
                </Text>
              </View>

              {task.completedAt && (
                <View style={[styles.metaItem, { borderBottomColor: theme.colors.border }]}>
                  <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>
                    Completed At
                  </Text>
                  <Text style={[styles.metaValue, { color: theme.colors.text }]}>
                    {getFormattedDate(task.completedAt)}
                  </Text>
                </View>
              )}

              {task.offline && (
                <View style={[styles.offlineIndicator, { 
                  backgroundColor: isDark ? '#374151' : '#fef3c7' // Dark mode support for indicator
                }]}>
                  <Text style={[styles.offlineText, { 
                    color: isDark ? theme.colors.text : '#92400e' // Dark mode support for text
                  }]}>📡 Created offline</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[
              styles.actionButton, 
              { 
                backgroundColor: task.completed ? theme.colors.warning : theme.colors.success 
              }
            ]}
            onPress={handleToggleComplete}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>
                {task.completed ? 'Mark as Pending' : 'Mark as Complete'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.colors.error }]}
            onPress={handleDelete}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>Delete Task</Text>
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
  // New style to ensure full-screen containers for loading/error states work correctly
  fullScreenContainer: { 
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingContainer: {
    // This style is now overridden by fullScreenContainer in the conditional rendering blocks
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 50, // Ensures content is below the status bar/notch
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  headerBackButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerBackButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  editButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  taskCard: {
    margin: 20,
    borderRadius: 20,
    padding: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  priorityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  priorityIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 12,
  },
  priorityText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  imageContainer: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    aspectRatio: 16 / 9, // Added aspect ratio for better mobile layout stability
  },
  taskImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  contentContainer: {
    gap: 16,
  },
  taskTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  taskDescription: {
    fontSize: 16,
    lineHeight: 24,
  },
  metaContainer: {
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    // borderBottomColor is now dynamically applied
  },
  metaLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  offlineIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
    // Background color is now dynamically applied
  },
  offlineText: {
    fontSize: 12,
    fontWeight: '600',
    // Color is now dynamically applied
  },
  actionsContainer: {
    padding: 20,
    gap: 12,
    paddingBottom: 40, // Added padding for home indicator safety
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
  backButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12, // Consistent border radius
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});