import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  useColorScheme,
  Animated,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PinInput from '../components/PinInput';
import { useAuth } from '../context/AuthContext';

const PinSetupScreen = () => {
  const [pin, setPin] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState('');
  const auth = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  const theme = {
    colors: {
      primary: '#4f46e5',
      secondary: '#2563eb',
      success: '#10b981',
      background: isDark ? '#111827' : '#f9fafb',
      surface: isDark ? '#1f2937' : '#ffffff',
      text: isDark ? '#ffffff' : '#111827',
      textSecondary: isDark ? '#9ca3af' : '#6b7280',
      error: '#ef4444',
    },
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: isConfirming ? 1 : 0.5,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isConfirming]);

  const onPinComplete = (newPin) => {
    if (!isConfirming) {
      setPin(newPin);
      setIsConfirming(true);
      setError('');
    } else {
      if (pin === newPin) {
        auth.setPin(newPin);
      } else {
        setError('PINs do not match. Please try again.');
        setTimeout(() => {
          setIsConfirming(false);
          setPin('');
          setError('');
        }, 2000);
      }
    }
  };

  const handleReset = () => {
    setIsConfirming(false);
    setPin('');
    setError('');
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>🔒 PIN Setup</Text>
            <Text style={styles.headerSubtitle}>
              {isConfirming ? 'Step 2 of 2' : 'Step 1 of 2'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.stepIndicator}>
              <View style={[styles.stepDot, styles.stepDotActive]} />
              <View style={[styles.stepDot, isConfirming && styles.stepDotActive]} />
            </View>
          </View>
        </View>
        
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <Animated.View 
            style={[
              styles.progressBar, 
              { 
                width: progressWidth,
                backgroundColor: theme.colors.success 
              }
            ]} 
          />
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
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            {/* Main Card */}
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                {isConfirming ? 'Confirm Your PIN' : 'Set Up App PIN'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                {isConfirming 
                  ? 'Re-enter your PIN to confirm' 
                  : 'Choose a 4-digit PIN to secure your app'}
              </Text>

              {/* PIN Input Component */}
              <View style={styles.pinInputWrapper}>
                <PinInput key={isConfirming ? 'confirm' : 'setup'} onComplete={onPinComplete} />
              </View>
              
              {/* Error Message */}
              {error && (
                <View style={[styles.errorContainer, { backgroundColor: theme.colors.error + '20' }]}>
                  <Text style={[styles.error, { color: theme.colors.error }]}>⚠️ {error}</Text>
                </View>
              )}

              {/* Reset Button */}
              {isConfirming && !error && (
                <TouchableOpacity 
                  style={[styles.resetButton, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}
                  onPress={handleReset}
                >
                  <Text style={[styles.resetButtonText, { color: theme.colors.textSecondary }]}>
                    ← Start Over
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Security Tips */}
            <View style={[styles.tipsContainer, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
              <Text style={[styles.tipsTitle, { color: theme.colors.text }]}>
                🛡️ Security Tips
              </Text>
              <Text style={[styles.tipsText, { color: theme.colors.textSecondary }]}>
                • Choose a PIN that's easy to remember but hard to guess{'\n'}
                • Don't use sequential numbers (1234) or repeated digits (1111){'\n'}
                • Keep your PIN private and secure
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  stepIndicator: {
    flexDirection: 'row',
    gap: 8,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  stepDotActive: {
    backgroundColor: '#fff',
  },
  progressContainer: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
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
  pinInputWrapper: {
    marginBottom: 16,
  },
  errorContainer: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  resetButton: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tipsContainer: {
    padding: 20,
    borderRadius: 12,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  tipsText: {
    fontSize: 13,
    lineHeight: 24,
  },
});

export default PinSetupScreen;