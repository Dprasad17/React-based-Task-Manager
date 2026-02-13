import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage Keys
const STORAGE_KEYS = {
  TASKS: 'TASKS', // Repurposed for Permanent Local Tasks
  USER: 'USER',
  THEME: 'THEME',
  SETTINGS: 'APP_SETTINGS',
  CACHE_PREFIX: 'CACHE_',
  OFFLINE_CHANGES: 'OFFLINE_CHANGES', // NEW KEY for tasks waiting to sync to API
};

// Cache expiration time (in milliseconds)
const CACHE_EXPIRATION = {
  SHORT: 5 * 60 * 1000,      // 5 minutes
  MEDIUM: 30 * 60 * 1000,    // 30 minutes
  LONG: 24 * 60 * 60 * 1000, // 24 hours
};

class StorageService {
  // Generic get with cache
  async get(key) {
    try {
      const value = await AsyncStorage.getItem(key);
      if (!value) return null;
      
      // Try to parse as JSON, if it fails, return as plain string
      try {
        return JSON.parse(value);
      } catch (parseError) {
        // If JSON parse fails, return the value as-is (it's a plain string)
        return value;
      }
    } catch (error) {
      console.error(`Error getting ${key}:`, error);
      return null;
    }
  }

  // Generic set
  async set(key, value) {
    try {
      // If value is a string, store as-is, otherwise stringify
      const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
      await AsyncStorage.setItem(key, valueToStore);
      return true;
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
      return false;
    }
  }

  // Generic remove
  async remove(key) {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing ${key}:`, error);
      return false;
    }
  }

  // Get with cache and expiration
  async getCached(key, expirationTime = CACHE_EXPIRATION.MEDIUM) {
    try {
      const cacheKey = `${STORAGE_KEYS.CACHE_PREFIX}${key}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          const now = Date.now();
          
          // Check if cache is still valid
          if (now - timestamp < expirationTime) {
            return data;
          }
          
          // Cache expired, remove it
          await this.remove(cacheKey);
        } catch (parseError) {
          // If parse fails, remove corrupted cache
          await this.remove(cacheKey);
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting cached ${key}:`, error);
      return null;
    }
  }

  // Set with cache and timestamp
  async setCached(key, value, expirationTime = CACHE_EXPIRATION.MEDIUM) {
    try {
      const cacheKey = `${STORAGE_KEYS.CACHE_PREFIX}${key}`;
      const cacheData = {
        data: value,
        timestamp: Date.now(),
        expirationTime,
      };
      
      await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
      return true;
    } catch (error) {
      console.error(`Error setting cached ${key}:`, error);
      return false;
    }
  }

  // Tasks specific methods (for Permanent Local Tasks)
  async getTasks() {
    return await this.get(STORAGE_KEYS.TASKS) || [];
  }

  async saveTasks(tasks) {
    await this.set(STORAGE_KEYS.TASKS, tasks);
    // Also cache tasks list (if this key is used for tasks that are mixed with API data)
    await this.setCached('tasks_list', tasks, CACHE_EXPIRATION.SHORT);
  }

  async getTaskById(id) {
    const tasks = await this.getTasks();
    return tasks.find(task => task.id === id);
  }

  async saveTask(task) {
    const tasks = await this.getTasks();
    const existingIndex = tasks.findIndex(t => t.id === task.id);
    
    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
    } else {
      tasks.push(task);
    }
    
    // Reverse the order so the newest permanent local tasks show at the top
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    await this.saveTasks(tasks);
    return task;
  }

  async updateTask(taskId, updates) {
    const tasks = await this.getTasks();
    const index = tasks.findIndex(t => t.id === taskId);
    
    if (index >= 0) {
      tasks[index] = { ...tasks[index], ...updates };
      await this.saveTasks(tasks);
      return tasks[index];
    }
    
    return null;
  }

  async deleteTask(taskId) {
    const tasks = await this.getTasks();
    const filtered = tasks.filter(t => t.id !== taskId);
    await this.saveTasks(filtered);
    return true;
  }

  // --- Offline Changes Queue Functions ---

  /**
   * Retrieves actions (create/update/delete) queued while offline.
   * @returns {Promise<Array<Object>>}
   */
  async getOfflineChanges() {
    return await this.get(STORAGE_KEYS.OFFLINE_CHANGES) || [];
  }

  /**
   * Saves the list of offline changes.
   * @param {Array<Object>} changes 
   */
  async saveOfflineChanges(changes) {
    return await this.set(STORAGE_KEYS.OFFLINE_CHANGES, changes);
  }

  /**
   * Clears the list of offline changes.
   */
  async clearOfflineChanges() {
    return await this.remove(STORAGE_KEYS.OFFLINE_CHANGES);
  }

  // User specific methods
  async getUser() {
    return await this.get(STORAGE_KEYS.USER);
  }

  async saveUser(user) {
    return await this.set(STORAGE_KEYS.USER, user);
  }

  async clearUser() {
    return await this.remove(STORAGE_KEYS.USER);
  }

  // Theme specific methods
  async getTheme() {
    return await this.get(STORAGE_KEYS.THEME) || 'light';
  }

  async saveTheme(theme) {
    return await this.set(STORAGE_KEYS.THEME, theme);
  }

  // Settings specific methods
  async getSettings() {
    return await this.get(STORAGE_KEYS.SETTINGS) || {
      notifications: true,
      hapticFeedback: true,
      autoSync: true,
      dataUsage: 'wifi',
    };
  }

  async saveSettings(settings) {
    return await this.set(STORAGE_KEYS.SETTINGS, settings);
  }

  // Cache management
  async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(STORAGE_KEYS.CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }

  // Modified clearAllData to respect the persistence of local tasks
  async clearAllData() {
    try {
      const keysToRemove = [
        STORAGE_KEYS.USER,
        STORAGE_KEYS.OFFLINE_CHANGES,
        // STORAGE_KEYS.TASKS is intentionally NOT removed to keep permanent local tasks
      ];
      
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(STORAGE_KEYS.CACHE_PREFIX));
      
      await AsyncStorage.multiRemove([...keysToRemove, ...cacheKeys]);
      
      console.log('✅ App data cleared (excluding Permanent Local Tasks and Settings)');
      return true;
    } catch (error) {
      console.error('Error clearing all data:', error);
      return false;
    }
  }

  // Get storage info
  async getStorageInfo() {
    // ... (rest of the existing getStorageInfo logic)
    try {
      const keys = await AsyncStorage.getAllKeys();
      const items = await AsyncStorage.multiGet(keys);
      
      let totalSize = 0;
      const info = {
        totalKeys: keys.length,
        cacheKeys: 0,
        tasks: 0,
        items: [],
      };

      items.forEach(([key, value]) => {
        // Blob is not available in all environments, using string length as a proxy
        const size = value ? value.length * 2 : 0; 
        totalSize += size;
        
        if (key.startsWith(STORAGE_KEYS.CACHE_PREFIX)) {
          info.cacheKeys++;
        }
        
        if (key === STORAGE_KEYS.TASKS) {
          const tasks = value ? JSON.parse(value) : [];
          info.tasks = tasks.length;
        }
        
        info.items.push({
          key,
          size,
          sizeFormatted: this.formatBytes(size),
        });
      });

      info.totalSize = totalSize;
      info.totalSizeFormatted = this.formatBytes(totalSize);
      
      return info;
    } catch (error) {
      console.error('Error getting storage info:', error);
      return null;
    }
  }

  // Helper to format bytes
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  // Migration utility to fix legacy data
  async migrateLegacyData() {
    // ... (existing migrateLegacyData logic)
    try {
      // Fix THEME key if it exists
      const theme = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
      if (theme && !theme.startsWith('{')) {
        // It's a plain string, no need to migrate
        console.log('Theme is already in correct format');
      }

      // Fix USER key if needed
      const user = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      if (user) {
        try {
          JSON.parse(user);
        } catch (error) {
          console.log('Removing corrupted USER data');
          await AsyncStorage.removeItem(STORAGE_KEYS.USER);
        }
      }

      // Fix TASKS key if needed
      const tasks = await AsyncStorage.getItem(STORAGE_KEYS.TASKS);
      if (tasks) {
        try {
          JSON.parse(tasks);
        } catch (error) {
          console.log('Removing corrupted TASKS data');
          await AsyncStorage.removeItem(STORAGE_KEYS.TASKS);
        }
      }

      // Fix APP_SETTINGS key if needed
      const settings = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (settings) {
        try {
          JSON.parse(settings);
        } catch (error) {
          console.log('Removing corrupted APP_SETTINGS data');
          await AsyncStorage.removeItem(STORAGE_KEYS.SETTINGS);
        }
      }

      return true;
    } catch (error) {
      console.error('Error migrating legacy data:', error);
      return false;
    }
  }

  // Batch operations for better performance
  async batchSave(items) {
    try {
      const pairs = items.map(([key, value]) => [
        key,
        typeof value === 'string' ? value : JSON.stringify(value),
      ]);
      await AsyncStorage.multiSet(pairs);
      return true;
    } catch (error) {
      console.error('Error batch saving:', error);
      return false;
    }
  }

  async batchGet(keys) {
    try {
      const items = await AsyncStorage.multiGet(keys);
      return items.map(([key, value]) => {
        if (!value) return [key, null];
        
        try {
          return [key, JSON.parse(value)];
        } catch (parseError) {
          // Return as plain string if JSON parse fails
          return [key, value];
        }
      });
    } catch (error) {
      console.error('Error batch getting:', error);
      return [];
    }
  }
}

export default new StorageService();
export { STORAGE_KEYS, CACHE_EXPIRATION };