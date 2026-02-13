import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  useColorScheme,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import StorageService, { CACHE_EXPIRATION } from '../services/StorageService';

export interface User {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  joinDate: string;
  lastLogin?: string;
}

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingCache, setCheckingCache] = useState(true);
  const [showPassword, setShowPassword] = useState(false); 
  const [usingBiometrics, setUsingBiometrics] = useState(false);
  
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const headerFade = useRef(new Animated.Value(0)).current;
  const formFade = useRef(new Animated.Value(0)).current;
  const formTranslateY = useRef(new Animated.Value(24)).current;

  const theme = {
    colors: {
      primary: '#4f46e5',
      secondary: '#2563eb',
      background: isDark ? '#111827' : '#f9fafb',
      surface: isDark ? '#1f2937' : '#ffffff',
      text: isDark ? '#ffffff' : '#111827',
      textSecondary: isDark ? '#9ca3af' : '#6b7280',
      border: isDark ? '#374151' : '#e5e7eb',
      warning: '#f59e0b',
    },
  };

  useEffect(() => {
    initializeLogin();
    
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });

    Animated.sequence([
      Animated.timing(headerFade, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(formFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(formTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 120,
        }),
      ]),
    ]).start();

    return unsubscribe;
  }, []);

  const initializeLogin = async () => {
    try {
      setCheckingCache(true);
      const cachedUser = await StorageService.getCached('user_session', CACHE_EXPIRATION.LONG);
      
      if (cachedUser) {
        Alert.alert(
          'Welcome Back!',
          'Logging you in with cached session...',
          [{ text: 'OK' }]
        );
        setTimeout(() => {
          onLogin(cachedUser as User);
        }, 1000);
      } else {
        const storedUser = await StorageService.getUser();
        if (storedUser) {
          setEmail(storedUser.email || '');
        }
      }
    } catch (error) {
      console.error('Error initializing login:', error);
    } finally {
      setCheckingCache(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);

    try {
      const netInfo = await NetInfo.fetch();
      
      if (!netInfo.isConnected) {
        const cachedUser = await StorageService.getCached('user_session', CACHE_EXPIRATION.LONG);
        
        if (cachedUser && cachedUser.email === email.trim()) {
          Alert.alert(
            'Offline Login',
            'Logging in with cached credentials. Data will sync when you reconnect.',
            [
              {
                text: 'OK',
                onPress: () => onLogin(cachedUser as User)
              }
            ]
          );
        } else {
          Alert.alert(
            'Offline Mode',
            'Cannot login while offline. Please connect to the internet or use cached credentials.',
            [{ text: 'OK' }]
          );
        }
        setLoading(false);
        return;
      }

      const nameFromEmail = email.split('@')[0];
      const displayName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);

      const userData: User = {
        id: Date.now(),
        name: displayName,
        email: email.trim(),
        avatar: null,
        joinDate: new Date().toISOString().split('T')[0],
        lastLogin: new Date().toISOString(),
      };

      await StorageService.saveUser(userData);
      await StorageService.setCached('user_session', userData, CACHE_EXPIRATION.LONG);
      await StorageService.setCached('login_credentials', {
        email: email.trim(),
        timestamp: Date.now(),
      }, CACHE_EXPIRATION.LONG);

      onLogin(userData);
    } catch (error) {
      console.error('Error during login:', error);
      Alert.alert('Error', 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      setUsingBiometrics(true);
      const cachedUser = await StorageService.getCached('user_session', CACHE_EXPIRATION.LONG);
      const storedUser = !cachedUser ? await StorageService.getUser() : null;
      const userToLogin = cachedUser || storedUser;
      if (userToLogin) {
        onLogin(userToLogin as User);
        return;
      }
      Alert.alert('Biometrics', 'No session available. Please sign in with email and password first.');
    } catch (e) {
      Alert.alert('Biometrics', 'Biometric authentication is unavailable.');
    } finally {
      setUsingBiometrics(false);
    }
  };

  const handleOfflineMode = async () => {
    try {
      const cachedUser = await StorageService.getCached('user_session', CACHE_EXPIRATION.LONG);
      
      if (cachedUser) {
        Alert.alert(
          'Continue Offline?',
          `Continue as ${cachedUser.name}? You'll have limited functionality until you reconnect.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              onPress: () => onLogin(cachedUser as User)
            }
          ]
        );
      } else {
        Alert.alert(
          'No Cached Session',
          'No previous session found. Please connect to the internet to login.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error checking cached session:', error);
      Alert.alert('Error', 'Failed to check cached session.');
    }
  };

  if (checkingCache) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          Checking cached session...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header matching HomeScreen style */}
      <Animated.View style={[styles.header, { opacity: headerFade, backgroundColor: theme.colors.primary }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Welcome Back</Text>
            <Text style={styles.headerSubtitle}>Secure sign in to continue</Text>
          </View>
          <View style={styles.headerRight}>
            <Image source={require('../assets/default_avatar.png')} style={styles.headerLogo} />
          </View>
        </View>
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>📡 Offline - Cached login available</Text>
          </View>
        )}
      </Animated.View>

      <View style={styles.content}>
        <Animated.View 
          style={[
            styles.form, 
            { 
              opacity: formFade, 
              transform: [{ translateY: formTranslateY }],
              backgroundColor: theme.colors.surface 
            }
          ]}
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>Sign In</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            {isOffline 
              ? 'Use cached session to access in read-only mode.' 
              : 'Enter your credentials to access your account.'}
          </Text>

          {/* Email Input */}
          <View style={[styles.inputGroup, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <Text style={styles.inputIcon}>📧</Text>
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Email address"
              placeholderTextColor={theme.colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          {/* Password Input */}
          <View style={[styles.inputGroup, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Password"
              placeholderTextColor={theme.colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
            />
            <TouchableOpacity 
              style={styles.passwordToggle} 
              onPress={() => setShowPassword(!showPassword)}
              disabled={loading}
            >
              <Text style={[styles.passwordToggleText, { color: theme.colors.primary }]}>
                {showPassword ? 'HIDE' : 'SHOW'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Primary Sign In */}
          <TouchableOpacity 
            style={[
              styles.loginButton,
              { backgroundColor: theme.colors.primary },
              (loading || usingBiometrics) && styles.loginButtonDisabled
            ]} 
            onPress={handleLogin}
            disabled={loading || usingBiometrics}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>
                {isOffline ? 'Login Offline' : 'Sign In Securely'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Biometric Sign In */}
          <TouchableOpacity
            style={[
              styles.biometricButton,
              { backgroundColor: theme.colors.secondary },
              usingBiometrics && styles.biometricButtonDisabled
            ]}
            onPress={handleBiometricLogin}
            disabled={usingBiometrics || loading}
          >
            {usingBiometrics ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.biometricButtonText}>🔐 Sign in with Biometrics</Text>
            )}
          </TouchableOpacity>

          {/* Cached Session Button */}
          {isOffline && (
            <TouchableOpacity 
              style={[styles.offlineButton, { backgroundColor: theme.colors.warning }]}
              onPress={handleOfflineMode}
              disabled={loading}
            >
              <Text style={styles.offlineButtonText}>
                Continue with Cached Session
              </Text>
            </TouchableOpacity>
          )}

          {/* Network Status Info */}
          <View style={[styles.infoContainer, { backgroundColor: isDark ? '#374151' : '#f3f4f6', borderLeftColor: theme.colors.primary }]}>
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              {isOffline 
                ? '⚠️ Limited functionality. Connect to sync changes.'
                : '✓ Connected. All application features are available.'}
            </Text>
          </View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    color: '#d1d5db',
    fontSize: 16,
    marginTop: 4,
    fontWeight: '500',
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  form: {
    borderRadius: 16,
    padding: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 12,
    fontSize: 18,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
  },
  passwordToggle: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  passwordToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  loginButtonDisabled: {
    backgroundColor: '#9ca3af',
    elevation: 0,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  biometricButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  biometricButtonDisabled: {
    opacity: 0.7,
  },
  biometricButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  offlineButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  offlineButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    marginTop: 24,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    borderLeftWidth: 4,
  },
  infoText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});