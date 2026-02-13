import { configureStore, createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Simple async thunk to load tasks
export const loadTasks = createAsyncThunk('tasks/load', async () => {
  try {
    const json = await AsyncStorage.getItem('TASKS');
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error('Error loading tasks:', error);
    return [];
  }
});

// Simple async thunk to save task
export const saveTask = createAsyncThunk('tasks/save', async (task) => {
  try {
    const existing = await AsyncStorage.getItem('TASKS');
    const tasks = existing ? JSON.parse(existing) : [];
    tasks.push(task);
    await AsyncStorage.setItem('TASKS', JSON.stringify(tasks));
    return task;
  } catch (error) {
    console.error('Error saving task:', error);
    throw error;
  }
});

// Simple async thunk to delete task
export const deleteTask = createAsyncThunk('tasks/delete', async (taskId) => {
  try {
    const existing = await AsyncStorage.getItem('TASKS');
    const tasks = existing ? JSON.parse(existing) : [];
    const updated = tasks.filter(task => task.id !== taskId);
    await AsyncStorage.setItem('TASKS', JSON.stringify(updated));
    return taskId;
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
});

const tasksSlice = createSlice({
  name: 'tasks',
  initialState: { 
    tasks: [], 
    loading: false, 
    error: null,
    isOffline: false,
  },
  reducers: {
    addTask: (state, action) => {
      state.tasks.push(action.payload);
    },
    removeTask: (state, action) => {
      state.tasks = state.tasks.filter(t => t.id !== action.payload);
    },
    updateTask: (state, action) => {
      const index = state.tasks.findIndex(task => task.id === action.payload.id);
      if (index !== -1) {
        state.tasks[index] = action.payload;
        // Also update in AsyncStorage
        AsyncStorage.setItem('TASKS', JSON.stringify(state.tasks));
      }
    },
    setOffline: (state, action) => {
      state.isOffline = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadTasks.pending, (state) => { 
        state.loading = true; 
        state.error = null;
      })
      .addCase(loadTasks.fulfilled, (state, action) => { 
        state.loading = false; 
        state.tasks = action.payload; 
      })
      .addCase(loadTasks.rejected, (state, action) => { 
        state.loading = false; 
        state.error = action.error.message; 
      })
      .addCase(saveTask.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveTask.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks.push(action.payload);
      })
      .addCase(saveTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(deleteTask.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteTask.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks = state.tasks.filter(task => task.id !== action.payload);
      })
      .addCase(deleteTask.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  }
});

export const { addTask, removeTask, updateTask, setOffline, clearError } = tasksSlice.actions;

// Create and export the store
export const store = configureStore({ 
  reducer: { 
    tasks: tasksSlice.reducer 
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export default store;