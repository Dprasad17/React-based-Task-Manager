import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider } from 'react-redux';
import { View, ActivityIndicator, StyleSheet, Alert, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

// ============================================
// SECURITY COMPONENTS & CONTEXT
// ============================================
import { AuthProvider, useAuth } from './context/AuthContext';
import SessionTimeout from './components/SessionTimeout';
// Removed: import SecureScreen from './components/SecureScreen';
import RootedDeviceScreen from './screens/RootedDeviceScreen';

// ============================================
// SECURITY SCREENS (PIN & BIOMETRICS)
// ============================================
import PinSetupScreen from './screens/PinSetupScreen';
import PinLoginScreen from './screens/PinLoginScreen';

// ============================================
// SERVICES & STORE
// ============================================
import StorageService, { CACHE_EXPIRATION } from './services/StorageService';
import { store } from './store/store';

// ============================================
// APPLICATION SCREENS
// ============================================
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import AddTaskScreen from './screens/AddTaskScreen';
import SettingsScreen from './screens/SettingsScreen';
import ProfileScreen from './screens/ProfileScreen';
import TaskDetailsScreen from './screens/TaskDetailsScreen';

// ============================================
// TYPE DEFINITIONS
// ============================================
export interface User {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  joinDate: string;
  lastLogin?: string;
}

const RootStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();

// ============================================
// MAIN APP NAVIGATION STACK
// ============================================
/**
 * HomeStack - Contains all authenticated app screens
 * Wrapped with SessionTimeout for automatic logout
 */
function HomeStack({
  isDark,
  setIsDark,
  user,
  onLogout
}: {
  isDark: boolean;
  setIsDark: (v: boolean) => void;
  user: User | null;
  onLogout: () => void;
}) {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="Home">
        {(props) => <HomeScreen {...props} isDark={isDark} />}
      </MainStack.Screen>
      
      <MainStack.Screen name="AddTask">
        {(props) => <AddTaskScreen {...props} isDark={isDark} />}
      </MainStack.Screen>
      
      <MainStack.Screen name="TaskDetails">
        {(props) => <TaskDetailsScreen {...props} isDark={isDark} />}
      </MainStack.Screen>
      
      <MainStack.Screen name="Settings">
        {(props) => (
          <SettingsScreen 
            {...props} 
            isDark={isDark} 
            setIsDark={setIsDark}
            onLogout={onLogout}
          />
        )}
      </MainStack.Screen>
      
      {/* Profile Screen - SecureScreen wrapper removed */}
      <MainStack.Screen name="Profile">
        {(props) => (
          // The screen is no longer wrapped in SecureScreen
          <ProfileScreen {...props} isDark={isDark} user={user} />
        )}
      </MainStack.Screen>
    </MainStack.Navigator>
  );
}

// ============================================
// SPLASH SCREEN COMPONENT
// ============================================
/**
 * CustomSplashScreen - Displayed during loading states
 */
function CustomSplashScreen({ isDark }: { isDark: boolean }) {
  return (
    <View style={[
      styles.splashContainer,
      { backgroundColor: isDark ? '#111827' : '#f9fafb' }
    ]}>
      <ActivityIndicator size="large" color="#4f46e5" />
    </View>
  );
}

// ============================================
// APP NAVIGATOR - SECURITY FLOW
// ============================================
/**
 * AppNavigator - Controls the navigation flow based on authentication status
 * Status flow: loading → unauthenticated → no_pin → locked → authenticated
 * * CRITICAL: The key prop on RootStack.Navigator forces remount when status changes
 * This ensures clean navigation reset when logging out
 */
function AppNavigator({ 
  isDark, 
  setIsDark 
}: { 
  isDark: boolean; 
  setIsDark: (v: boolean) => void;
}) {
  const { status, user, login, logout } = useAuth();

  // Show splash while checking authentication state
  if (status === 'loading') {
    return <CustomSplashScreen isDark={isDark} />;
  }

  /**
   * Handle login with user data
   * AuthContext manages token storage internally
   */
  const handleLogin = async (userData: User) => {
    await login(userData);
  };

  /**
   * Handle logout - clear session and return to login
   * Called from SettingsScreen logout button
   */
  const handleLogout = async () => {
    try {
      await logout();
      // Navigation will automatically reset because status changes to 'unauthenticated'
      // and the navigator remounts due to the key prop
    } catch (error) {
      console.error('Error during logout:', error);
      Alert.alert('Error', 'Failed to log out properly. Please try again.');
    }
  };

  return (
    <RootStack.Navigator 
      screenOptions={{ headerShown: false }}
      key={status} // CRITICAL: Forces navigator to remount when status changes
    >
      {/* ============================================ */}
      {/* UNAUTHENTICATED STATE - Show Login Screen */}
      {/* ============================================ */}
      {status === 'unauthenticated' ? (
        <RootStack.Screen 
          name="Login"
          options={{
            animationTypeForReplace: 'pop', // Smooth transition when logging out
          }}
        >
          {(props) => (
            <LoginScreen
              {...props}
              onLogin={handleLogin}
            />
          )}
        </RootStack.Screen>
      ) 
      
      /* ============================================ */
      /* NO PIN STATE - First Time Setup */
      /* ============================================ */
      : status === 'no_pin' ? (
        <RootStack.Screen name="PinSetup" component={PinSetupScreen} />
      ) 
      
      /* ============================================ */
      /* LOCKED STATE - PIN/Biometric Required */
      /* ============================================ */
      : status === 'locked' ? (
        <RootStack.Screen name="PinLogin" component={PinLoginScreen} />
      ) 
      
      /* ============================================ */
      /* AUTHENTICATED STATE - Full App Access */
      /* ============================================ */
      : (
        <RootStack.Screen name="HomeStack">
          {() => (
            <SessionTimeout>
              <HomeStack
                isDark={isDark}
                setIsDark={setIsDark}
                user={user as User}
                onLogout={handleLogout}
              />
            </SessionTimeout>
          )}
        </RootStack.Screen>
      )}
    </RootStack.Navigator>
  );
}

// ============================================
// DEVICE INTEGRITY CHECK WRAPPER
// ============================================
/**
 * RootedDeviceCheckWrapper - Performs device security check on startup
 * Blocks app if rooted/jailbroken device is detected
 */
function RootedDeviceCheckWrapper({ children }: { children: React.ReactNode }) {
  const [isRooted, setIsRooted] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkDeviceIntegrity = async () => {
      // Only perform check on mobile platforms
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        try {
          let isJailbroken = false;
          let isRooted = false;

          // Check if DeviceInfo methods exist
          // Using 'as any' to bypass TypeScript issues with dynamic method checks
          const isJailbrokenFunc = (DeviceInfo as any).isJailbroken;
          const isRootedFunc = (DeviceInfo as any).isRooted;
          
          if (typeof isJailbrokenFunc === 'function' && typeof isRootedFunc === 'function') {
            isJailbroken = await isJailbrokenFunc();
            isRooted = await isRootedFunc();
          } else {
            console.warn('Device integrity check methods not available. Skipping check.');
          }
          
          if (isJailbroken || isRooted) {
            Alert.alert(
              'Security Risk', 
              'Rooted/Jailbroken device detected. The app will not run.'
            );
          }
          setIsRooted(isJailbroken || isRooted);
        } catch (e) {
          console.warn('Device integrity check failed:', e);
          // Fail safe: assume not rooted if check fails
          setIsRooted(false);
        } finally {
          setIsChecking(false);
        }
      } else {
        // Skip check on web/desktop environments
        setIsChecking(false);
      }
    };
    
    checkDeviceIntegrity();
  }, []);

  // Show splash during integrity check
  if (isChecking) {
    return <CustomSplashScreen isDark={false} />;
  }

  // Block app if security risk detected
  if (isRooted) {
    return <RootedDeviceScreen />;
  }

  return <>{children}</>;
}

// ============================================
// ROOT APP COMPONENT
// ============================================
/**
 * RootApp - Handles Redux, Theme, and Storage initialization
 */
function RootApp() {
  const [isDark, setIsDark] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Initialize app services and theme
   */
  const initializeApp = async () => {
    try {
      // Migrate legacy data if exists
      await StorageService.migrateLegacyData();

      // Load theme from cache or storage
      const cachedTheme = await StorageService.getCached(
        'app_theme', 
        CACHE_EXPIRATION.LONG
      );

      if (cachedTheme) {
        setIsDark(cachedTheme === 'dark');
      } else {
        const savedTheme = await StorageService.getTheme();
        setIsDark(savedTheme === 'dark');
        await StorageService.setCached(
          'app_theme', 
          savedTheme, 
          CACHE_EXPIRATION.LONG
        );
      }
    } catch (error) {
      console.error('Error initializing app:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle theme changes with storage persistence
   */
  const handleThemeChange = async (darkMode: boolean) => {
    try {
      setIsDark(darkMode);
      
      await StorageService.saveTheme(darkMode ? 'dark' : 'light');
      
      await StorageService.setCached(
        'app_theme', 
        darkMode ? 'dark' : 'light', 
        CACHE_EXPIRATION.LONG
      );
    } catch (error) {
      console.error('Error changing theme:', error);
    }
  };

  /**
   * Preload tasks for better performance
   */
  const preloadTasks = async () => {
    try {
      const tasks = await StorageService.getTasks();
      if (tasks.length > 0) {
        await StorageService.setCached(
          'tasks_list', 
          tasks, 
          CACHE_EXPIRATION.SHORT
        );
      }
    } catch (error) {
      console.error('Error preloading tasks:', error);
    }
  };

  useEffect(() => {
    initializeApp();
    preloadTasks();
  }, []);

  // Show splash during app initialization
  if (isLoading) {
    return <CustomSplashScreen isDark={isDark} />;
  }

  return (
    <Provider store={store}>
      <AuthProvider>
        <NavigationContainer>
          <AppNavigator isDark={isDark} setIsDark={handleThemeChange} />
        </NavigationContainer>
      </AuthProvider>
    </Provider>
  );
}

// ============================================
// EXPORTED APP COMPONENT
// ============================================
/**
 * App - Entry point with device integrity check
 * Security flow order:
 * 1. Device integrity check (rooted/jailbroken)
 * 2. App initialization (theme, storage)
 * 3. Authentication flow (login → PIN setup → main app)
 * 4. Logout flow (settings → clear session → return to login)
 * * Navigation Reset Strategy:
 * - When logout() is called, AuthContext changes status to 'unauthenticated'
 * - The key={status} prop on RootStack.Navigator forces a remount
 * - This automatically clears the navigation stack and shows Login screen
 * - No manual navigation.reset() calls needed
 */
export default function App() {
  return (
    <RootedDeviceCheckWrapper>
      <RootApp />
    </RootedDeviceCheckWrapper>
  );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});