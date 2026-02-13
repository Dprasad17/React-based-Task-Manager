import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPin, storePin, clearToken, storeToken, getToken, clearPin } from '../services/AuthService'; 

// Define new statuses for the secure flow
type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'locked' | 'no_pin';

type AuthContextType = {
  status: AuthStatus;
  user: any | null;
  login: (user: any) => Promise<void>;
  // shouldClearPin: true for full logout, false for session timeout
  logout: (shouldClearPin?: boolean) => Promise<void>;
  checkCachedToken: () => Promise<boolean>;
  checkCachedUser: () => Promise<any | null>;
  checkBiometricUser: () => Promise<any | null>;
  // PIN/Lock management methods
  setPin: (pin: string) => Promise<void>;
  getPin: () => Promise<string | null>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  setLocked: (locked: boolean) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<any | null>(null);

  // --- Utility Functions ---
  const checkCachedToken = async (): Promise<boolean> => {
    const token = await getToken();
    return !!token;
  };

  const checkCachedUser = async (): Promise<any | null> => {
    const cachedUser = await AsyncStorage.getItem('USER');
    return cachedUser ? JSON.parse(cachedUser) : null;
  };
  
  const checkBiometricUser = async (): Promise<any | null> => {
    const json = await AsyncStorage.getItem('BIOMETRIC_USER');
    return json ? JSON.parse(json) : null;
  };
  
  // --- Authentication Flow Methods ---

  const login = async (userData: any) => {
    try {
      // Store session data
      await storeToken('local-token');
      await AsyncStorage.setItem('USER', JSON.stringify(userData));
      await AsyncStorage.setItem('BIOMETRIC_USER', JSON.stringify(userData)); // For biometric quick access
      setUser(userData);
      
      const pinExists = await getPin();
      // If session exists: force PIN setup if no PIN, otherwise user is 'authenticated' (will likely go to locked screen next)
      setStatus(pinExists ? 'authenticated' : 'no_pin');
    } catch (e) {
      console.error('login error', e);
      throw e;
    }
  };

  /**
   * Logout function
   * @param shouldClearPin - If true, performs full logout (clears PIN). If false, session timeout (keeps PIN)
   * 
   * CRITICAL: When logging out from Settings, we need to clear EVERYTHING including PIN
   * This ensures clean state when user logs back in
   */
  const logout = async (shouldClearPin: boolean = true) => {
    try {
      console.log('🚪 Logging out... shouldClearPin:', shouldClearPin);
      
      // Always clear user session data
      await AsyncStorage.removeItem('USER');
      await clearToken(); // Clear token from Keychain

      if (shouldClearPin) {
        // Full logout: Clear PIN and biometric data
        console.log('🗑️ Clearing PIN and biometric data...');
        await AsyncStorage.removeItem('BIOMETRIC_USER');
        
        // Clear the PIN from secure storage
        if (typeof clearPin === 'function') {
          await clearPin();
        } else {
          // Fallback if clearPin doesn't exist in AuthService
          console.warn('clearPin function not found in AuthService');
          await AsyncStorage.removeItem('USER_PIN'); // Fallback to AsyncStorage
        }
      } else {
        // Session timeout: Keep PIN and biometric data for faster re-login
        console.log('⏰ Session timeout - keeping PIN for re-authentication');
      }
      
      setUser(null);
      setStatus('unauthenticated');
      console.log('✅ Logout complete - status set to unauthenticated');
    } catch (e) {
      console.error('❌ Logout error:', e);
      throw e;
    }
  };

  // --- PIN/Lock Management Methods ---

  const setPin = async (pin: string) => {
    try {
      await storePin(pin);
      // Once PIN is set, transition from 'no_pin' to 'authenticated'
      setStatus('authenticated');
    } catch (e) {
      console.error('setPin error', e);
      throw e;
    }
  };

  const unlockWithPin = async (pin: string): Promise<boolean> => {
    try {
      const storedPin = await getPin();
      if (storedPin === pin) {
        setStatus('authenticated');
        return true;
      }
      return false;
    } catch (e) {
      console.error('unlockWithPin error', e);
      return false;
    }
  };
  
  const setLocked = (locked: boolean) => {
    // SessionTimeout component uses this to move to the lock screen state
    if (locked && status === 'authenticated') {
      console.log('🔒 App set to locked state by SessionTimeout.');
      setStatus('locked');
    }
    // Note: unlocking is handled only by unlockWithPin
  };


  // --- Initial check on mount ---
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        console.log('🔄 Bootstrapping auth state...');
        const token = await checkCachedToken();
        const cachedUser = await checkCachedUser();
        const pin = await getPin();

        console.log('Auth bootstrap:', { 
          hasToken: !!token, 
          hasUser: !!cachedUser, 
          hasPin: !!pin 
        });

        if (token && cachedUser) {
          // User has an active session
          setUser(cachedUser);
          
          if (pin) {
            // Session exists, PIN exists: Start in 'locked' state (Security Lock Screen)
            console.log('🔒 Session + PIN found - starting in locked state');
            setStatus('locked'); 
          } else {
            // Session exists, NO PIN: Force PIN setup
            console.log('📌 Session found but no PIN - forcing PIN setup');
            setStatus('no_pin');
          }
        } else {
          // No active session: Go to standard login screen
          console.log('🔓 No session found - showing login screen');
          setStatus('unauthenticated');
        }
      } catch (e) {
        console.error('❌ Bootstrap failed:', e);
        setStatus('unauthenticated');
      }
    };

    bootstrapAsync();
  }, []);

  const value: AuthContextType = {
    status,
    user,
    login,
    logout,
    checkCachedToken,
    checkCachedUser,
    checkBiometricUser,
    setPin, 
    getPin, 
    unlockWithPin, 
    setLocked, 
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context as AuthContextType;
};