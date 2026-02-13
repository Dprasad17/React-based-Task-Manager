import NetInfo from '@react-native-community/netinfo';
import StorageService, { CACHE_EXPIRATION } from './StorageService';
import { getToken } from './AuthService';

// Fallback for UUID generation if the library is not installed
const generateUniqueId = () => `local-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// API Configuration
const API_CONFIG = {
  BASE_URL: 'https://jsonplaceholder.typicode.com', // Using JSONPlaceholder as demo API
  TIMEOUT: 10000, // 10 seconds
  ENDPOINTS: {
    TASKS: '/todos',
    USERS: '/users',
    POSTS: '/posts',
  },
};

class ApiService {
  constructor() {
    this.isOnline = true;
    this.setupNetworkListener();
  }

  // Setup network listener
  setupNetworkListener() {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected;
      console.log('Network status:', this.isOnline ? 'Online' : 'Offline');
    });
  }

  // Generic API call with error handling
  async apiCall(endpoint, options = {}) {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    
    const authHeaders = {};
    try {
      const token = await getToken();
      if (token) {
        authHeaders.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // If token retrieval fails, proceed without Authorization
    }

    const config = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
      // Only include body for non-GET requests
      ...(options.body && { body: JSON.stringify(options.body) }), 
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText.substring(0, 100)}...`);
      }
      
      // Attempt to parse JSON response. Handle 204 No Content gracefully.
      const responseText = await response.text();
      return responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      console.error(`❌ API call failed to ${endpoint}:`, error);
      throw error;
    }
  }

  // Helper to add changes to the offline queue
  async addToOfflineChangesQueue(action, taskData) {
    const change = { 
        action, 
        task: { ...taskData, id: taskData.id || generateUniqueId(), synced: false }, 
        timestamp: Date.now() 
    };

    const changes = await StorageService.getOfflineChanges();
    changes.push(change);
    await StorageService.saveOfflineChanges(changes);
    console.log(`📝 Added ${action} for task ${taskData.id} to offline queue.`);
  }

  // Helper to fetch tasks from API with cache fallback
  async fetchTasksFromApi(forceRefresh = false) {
    const cacheKey = 'tasks_list';
    
    // 1. Check for valid cache if not forcing refresh
    if (!forceRefresh) {
        const cachedData = await StorageService.getCached(cacheKey, CACHE_EXPIRATION.SHORT);
        if (cachedData) {
            return { success: true, data: cachedData, source: 'cache', offline: false };
        }
    }

    // 2. Fallback to expired cache if offline
    if (!this.isOnline) {
        const expiredCacheData = await StorageService.get(`CACHE_${cacheKey}`);
        if (expiredCacheData && expiredCacheData.data) {
            return { success: true, data: expiredCacheData.data, source: 'cache', offline: true };
        }
        return { success: false, error: 'Offline and no cached data available.', offline: true };
    }

    // 3. Try to fetch from API
    try {
        const response = await this.apiCall(API_CONFIG.ENDPOINTS.TASKS, { method: 'GET' });
        
        // Map the API data to your local task format
        const tasks = response.map(item => ({
            id: item.id ? item.id.toString() : generateUniqueId(),
            title: item.title,
            description: `User ID: ${item.userId} (Completed: ${item.completed})`,
            priority: item.completed ? 'low' : 'medium', 
            source: 'api',
            createdAt: new Date().toISOString(),
        }));

        // Save the fresh data to cache
        await StorageService.setCached(cacheKey, tasks, CACHE_EXPIRATION.SHORT);
        
        return { success: true, data: tasks, source: 'api', offline: false };
    } catch (error) {
        console.error('Error fetching from API:', error);
        // Fallback to expired cache on API error, even if online
        const expiredCacheData = await StorageService.get(`CACHE_${cacheKey}`);
        if (expiredCacheData && expiredCacheData.data) {
            return { success: true, data: expiredCacheData.data, source: 'cache', offline: true };
        }
        return { success: false, error: error.message };
    }
  }

  // --- Task CRUD Operations ---

  async getTasks(forceRefresh = false) {
    let finalData = [];
    let finalSource = 'api';
    let offlineMode = false;

    // 1. Get API/Cached tasks
    const apiResult = await this.fetchTasksFromApi(forceRefresh);

    if (apiResult.success) {
        finalData = apiResult.data;
        finalSource = apiResult.source;
        offlineMode = apiResult.offline;
    }

    // 2. Load and combine permanent local tasks
    const permanentLocalTasks = await StorageService.getTasks();
    
    // Mark them explicitly
    const markedLocalTasks = permanentLocalTasks.map(task => ({
        ...task,
        source: 'local_permanent' // New source type
    }));

    // 3. Combine tasks: API/Cache tasks first, then permanent local tasks
    let combinedTasks = [...finalData, ...markedLocalTasks];
    
    // Ensure unique IDs, prioritizing the API/Cache version
    const uniqueTasksMap = new Map();
    for (const task of combinedTasks) {
        // Only override if the existing task is NOT from API or Cache
        if (!uniqueTasksMap.has(task.id) || task.source === 'api' || task.source === 'cache') {
            uniqueTasksMap.set(task.id, task);
        }
    }
    
    const uniqueTasks = Array.from(uniqueTasksMap.values());

    // Sort by creation date (newest first)
    uniqueTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
        success: true,
        data: uniqueTasks,
        source: finalSource,
        offline: offlineMode,
    };
  }

  async addTask(taskData) {
    // This method is primarily used to create a permanent local task
    const newTask = {
        ...taskData,
        id: generateUniqueId(),
        createdAt: new Date().toISOString(),
        offline: true, // Always consider this offline for simplicity, as it's local only
        source: 'local_permanent', // Mark as permanent local task
        synced: false,
    };
    
    // Save the task to the permanent local storage using the TASKS key
    await StorageService.saveTask(newTask);

    // Clear API task cache to force HomeScreen to reload and see the new local task
    await StorageService.remove('CACHE_tasks_list');
    
    return { success: true, data: newTask, offline: true, source: 'local_permanent' };
  }

  async deleteTask(taskId) {
    // 1. Check if it's a permanent local task
    const isPermanentLocal = !!await StorageService.getTaskById(taskId);
    if (isPermanentLocal) {
        await StorageService.deleteTask(taskId);
        await StorageService.remove('CACHE_tasks_list');
        return { success: true, offline: true, source: 'local_permanent' };
    }

    // 2. If it's an API/Cached task, proceed with sync logic
    if (this.isOnline) {
      try {
        await this.apiCall(`${API_CONFIG.ENDPOINTS.TASKS}/${taskId}`, { method: 'DELETE' });
      } catch (error) {
        // If API delete fails even though online, fall back to offline queue
        console.warn('API delete failed, falling back to offline queue:', error.message);
        await this.addToOfflineChangesQueue('delete', { id: taskId });
        await StorageService.remove('CACHE_tasks_list');
        return { success: true, offline: true };
      }
    } else {
      // Offline: Add to the queue
      await this.addToOfflineChangesQueue('delete', { id: taskId });
    }
    
    // Clear API task cache to force HomeScreen to reload
    await StorageService.remove('CACHE_tasks_list');

    return { success: true, offline: !this.isOnline };
  }
  
  // The updateTask method logic remains similar to the previous implementation
  async updateTask(taskId, updates) {
    // ... (logic for API/Offline update, using StorageService.addToOfflineChangesQueue)
    if (this.isOnline) {
      try {
        const response = await this.apiCall(`${API_CONFIG.ENDPOINTS.TASKS}/${taskId}`, { method: 'PUT', body: updates });
        return { success: true, data: response, offline: false };
      } catch (error) {
        await this.addToOfflineChangesQueue('update', { id: taskId, ...updates });
        return { success: true, offline: true };
      }
    } else {
      await this.addToOfflineChangesQueue('update', { id: taskId, ...updates });
      return { success: true, offline: true };
    }
  }

  // The syncOfflineChanges method logic remains similar to the previous implementation
  async syncOfflineChanges() {
    if (!this.isOnline) {
      return { success: false, error: 'Cannot sync: Device is offline.' };
    }

    let changes = await StorageService.getOfflineChanges();
    if (changes.length === 0) {
      return { success: true, syncResults: [] };
    }

    const syncResults = [];
    
    // ... (API call logic for each change, using this.apiCall for POST, PUT, DELETE)
    for (const change of changes) {
        const { action, task } = change;
        try {
            if (action === 'create') {
                const result = await this.updateTask(task.id, task); // Placeholder for API create
                syncResults.push({ taskId: task.id, result, action: 'create' });
            } else if (action === 'delete') {
                await this.deleteTask(task.id);
                syncResults.push({ taskId: task.id, result: { success: true }, action: 'delete' });
            } else {
                const result = await this.updateTask(task.id, task); // Placeholder for API update
                syncResults.push({ taskId: task.id, result, action: 'update' });
            }
        } catch (error) {
            console.error(`Sync failed for ${action} task ${task.id}:`, error);
        }
    }

    console.log('✅ Sync completed:', syncResults);

    await StorageService.clearOfflineChanges();
    await StorageService.remove('CACHE_tasks_list');

    return { success: true, syncResults };
  }

  async clearAllCaches() {
    try {
      await StorageService.clearCache();
      console.log('🗑️ All caches cleared');
      return { success: true };
    } catch (error) {
      console.error('Error clearing caches:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new ApiService();