import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  useColorScheme,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import ReactNativeBiometrics from 'react-native-biometrics';
import PinInput from '../components/PinInput';
import { useAuth } from '../context/AuthContext';

const rnBiometrics = new ReactNativeBiometrics();

const PinLoginScreen = () => {
  const [error, setError] = useState('');
  const [attemptingBio, setAttemptingBio] = useState(false);
  const auth = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const shakeAnim = React.useRef(new Animated.Value(0)).current;

  const theme = {
    colors: {
      primary: '#4f46e5',
      secondary: '#2563eb',
      background: isDark ? '#111827' : '#f9fafb',
      surface: isDark ? '#1f2937' : '#ffffff',
      text: isDark ? '#ffffff' : '#111827',
      textSecondary: isDark ? '#9ca3af' : '#6b7280',
      error: '#ef4444',
    },
  };

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    attemptBiometrics();
  }, []);

  const attemptBiometrics = async () => {
    try {
      setAttemptingBio(true);
      const { available } = await rnBiometrics.isSensorAvailable();
      if (!available) {
        setAttemptingBio(false);
        return;
      }

      const { success } = await rnBiometrics.simplePrompt({
        promptMessage: 'Log in to YourSecureApp',
      });

      if (success) {
        const pin = await auth.getPin();
        auth.unlockWithPin(pin);
      } else {
        setAttemptingBio(false);
      }
    } catch (e) {
      console.error('Biometric error', e);
      setAttemptingBio(false);
    }
  };

  const shakeAnimation = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const onPinComplete = async (pin) => {
    const success = await auth.unlockWithPin(pin);
    if (!success) {
      setError('Incorrect PIN. Please try again.');
      shakeAnimation();
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerIcon}>🔐</Text>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Secure Access</Text>
            <Text style={styles.headerSubtitle}>Enter your PIN to continue</Text>
          </View>
        </View>
      </View>

      {/* Content Area with Keyboard Avoiding */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            style={[
              styles.content, 
              { 
                opacity: fadeAnim,
                transform: [{ translateX: shakeAnim }]
              }
            ]}
          >
            {/* Main Card */}
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.title, { color: theme.colors.text }]}>Enter Your PIN</Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                Please enter your 4-digit PIN to unlock the app
              </Text>

              {/* PIN Input Component */}
              <View style={styles.pinWrapper}>
                <PinInput onComplete={onPinComplete} />
              </View>
              
              {/* Error Message */}
              {error && (
                <View style={[styles.errorContainer, { backgroundColor: theme.colors.error + '20' }]}>
                  <Text style={[styles.error, { color: theme.colors.error }]}>⚠️ {error}</Text>
                </View>
              )}

              {/* Divider */}
              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: theme.colors.textSecondary + '30' }]} />
                <Text style={[styles.dividerText, { color: theme.colors.textSecondary }]}>OR</Text>
                <View style={[styles.dividerLine, { backgroundColor: theme.colors.textSecondary + '30' }]} />
              </View>

              {/* Biometric Button */}
              <TouchableOpacity
                style={[styles.bioButton, { backgroundColor: theme.colors.secondary }]}
                onPress={attemptBiometrics}
                disabled={attemptingBio}
              >
                {attemptingBio ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={styles.bioButtonIcon}>👆</Text>
                    <Text style={styles.bioButtonText}>Use Fingerprint / Face ID</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Help Tip */}
            <View style={[styles.helpContainer, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
              <Text style={styles.tipIcon}>💡</Text>
              <Text style={[styles.helpText, { color: theme.colors.textSecondary }]}>
                Tip: You can use biometric authentication for faster access
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

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
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 36,
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    color: '#d1d5db',
    fontSize: 15,
    marginTop: 4,
    fontWeight: '500',
  },
  keyboardAvoidView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 32,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  pinWrapper: {
    marginBottom: 20,
  },
  errorContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 12,
    fontWeight: '600',
  },
  bioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bioButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  bioButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tipIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  helpText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default PinLoginScreen;