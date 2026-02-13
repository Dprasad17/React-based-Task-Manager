// 5. Session Timeout & Auto Logout (Enhanced Implementation)
import React, { useState, useEffect, useRef } from 'react';
import { 
  AppState, 
  PanResponder, 
  View, 
  Modal, 
  Text, 
  TouchableOpacity, 
  StyleSheet,
  Alert 
} from 'react-native';
import { useAuth } from '../context/AuthContext';

// Set timeout to 5 minutes (in milliseconds)
const TIMEOUT = 5 * 60 * 1000;
const WARNING_TIME = 30 * 1000; // Show warning 30 seconds before logout

const SessionTimeout = ({ children }) => {
  const auth = useAuth();
  const timeoutRef = useRef(null);
  const warningRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(30);

  // Function to reset the inactivity timer
  const resetTimer = () => {
    console.log('🔄 Resetting inactivity timer');
    
    // Clear any existing timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
    }
    
    // Hide warning if showing
    setShowWarning(false);
    setCountdown(30);

    // Only start a new timer if the user is authenticated (not locked)
    if (auth.status === 'authenticated') {
      // Set warning timer (30 seconds before logout)
      warningRef.current = setTimeout(() => {
        console.log('⚠️ Showing inactivity warning');
        setShowWarning(true);
        startCountdown();
      }, TIMEOUT - WARNING_TIME);

      // Set logout timer
      timeoutRef.current = setTimeout(() => {
        console.log('⏱️ User inactive, triggering auto-lock');
        handleAutoLogout();
      }, TIMEOUT);
    }
  };

  // Countdown for warning modal
  const startCountdown = () => {
    let timeLeft = 30;
    const interval = setInterval(() => {
      timeLeft -= 1;
      setCountdown(timeLeft);
      if (timeLeft <= 0) {
        clearInterval(interval);
      }
    }, 1000);
  };

  // Handle auto logout
  const handleAutoLogout = async () => {
    try {
      setShowWarning(false);
      console.log('🔒 Executing auto-logout');
      
      if (auth && typeof auth.logout === 'function') {
        await auth.logout(true); // Pass true to indicate session timeout
      } else {
        console.error('❌ Auth context or logout function not available');
        Alert.alert('Error', 'Unable to logout. Please restart the app.');
      }
    } catch (error) {
      console.error('❌ Error during auto-logout:', error);
      Alert.alert('Error', 'An error occurred during logout.');
    }
  };

  // Handle manual stay logged in
  const handleStayLoggedIn = () => {
    console.log('✅ User chose to stay logged in');
    setShowWarning(false);
    resetTimer();
  };

  // Handle manual logout from warning
  const handleLogoutNow = async () => {
    console.log('🚪 User manually logged out from warning');
    setShowWarning(false);
    await handleAutoLogout();
  };

  // 1. PanResponder: Detects all touches on the wrapped component
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        resetTimer();
        return false; // Don't capture the event
      },
      onMoveShouldSetPanResponder: () => {
        resetTimer();
        return false;
      },
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: () => resetTimer(),
      onPanResponderMove: () => resetTimer(),
      onPanResponderRelease: () => resetTimer(),
    })
  ).current;

  // 2. AppState Listener: Detects background/foreground transitions
  useEffect(() => {
    console.log('🔧 SessionTimeout mounted, auth status:', auth.status);

    // A. Handle app foreground/background
    const handleAppStateChange = (nextAppState) => {
      console.log('📱 AppState changed:', appStateRef.current, '→', nextAppState);
      
      // If the user brings the app back to the foreground and they are authenticated
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        if (auth.status === 'authenticated') {
          console.log('🔄 App returned to foreground, resetting timer');
          resetTimer();
        }
      }
      
      // If the app goes to the background, stop the timer
      if (nextAppState.match(/inactive|background/)) {
        console.log('⏸️ App going to background, clearing timers');
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        if (warningRef.current) {
          clearTimeout(warningRef.current);
        }
        setShowWarning(false);
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // B. Initial timer start
    if (auth.status === 'authenticated') {
      resetTimer();
    }

    // C. Cleanup on unmount
    return () => {
      console.log('🧹 SessionTimeout cleanup');
      subscription.remove();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningRef.current) {
        clearTimeout(warningRef.current);
      }
    };
  }, [auth.status]); // Re-run effect when auth status changes

  // If the user is not authenticated, just show the content without timer
  if (auth.status !== 'authenticated') {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  // If authenticated, wrap children in the PanResponder View
  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}

      {/* Inactivity Warning Modal */}
      <Modal
        visible={showWarning}
        transparent={true}
        animationType="fade"
        onRequestClose={handleStayLoggedIn}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>⏰</Text>
            </View>
            
            <Text style={styles.modalTitle}>Session Expiring Soon</Text>
            <Text style={styles.modalMessage}>
              You've been inactive for a while. For your security, you'll be logged out in:
            </Text>
            
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>{countdown}</Text>
              <Text style={styles.countdownLabel}>seconds</Text>
            </View>

            <Text style={styles.modalHint}>
              Tap "Stay Logged In" to continue your session
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleStayLoggedIn}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Stay Logged In</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={handleLogoutNow}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>Logout Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 36,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  countdownContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  countdownText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#D97706',
    marginBottom: 4,
  },
  countdownLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
  },
  modalHint: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#6B7280',
  },
});

export default SessionTimeout;