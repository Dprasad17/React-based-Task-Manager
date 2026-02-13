import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { ErrorAnimation } from './LottieAnimation';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });

    // Log to external service (e.g., Sentry, Crashlytics)
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService = (error, errorInfo) => {
    // In a real app, you would send this to your error reporting service
    console.log('Logging error to service:', {
      error: error.toString(),
      errorInfo: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: 'React Native',
    });
  };

  handleRetry = () => {
    const { retryCount } = this.state;
    const maxRetries = 3;

    if (retryCount < maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
      }));
    } else {
      Alert.alert(
        'Maximum Retries Reached',
        'The app has encountered multiple errors. Please restart the app.',
        [
          { text: 'OK', onPress: () => this.handleRestart() }
        ]
      );
    }
  };

  handleRestart = () => {
    // In a real app, you might want to restart the app or navigate to a safe state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });
  };

  handleReportError = () => {
    const { error, errorInfo } = this.state;
    
    Alert.alert(
      'Report Error',
      'Would you like to report this error to help us improve the app?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Report', 
          onPress: () => {
            // In a real app, you would send this to your error reporting service
            console.log('User reported error:', { error, errorInfo });
            Alert.alert('Thank you', 'Error report sent successfully.');
          }
        }
      ]
    );
  };

  render() {
    if (this.state.hasError) {
      const { retryCount } = this.state;
      const maxRetries = 3;

      return (
        <View style={styles.container}>
          <ErrorAnimation 
            visible={true} 
            size={150}
            style={styles.animation}
          />
          
          <Text style={styles.title}>Oops! Something went wrong</Text>
          
          <Text style={styles.message}>
            We're sorry, but something unexpected happened. 
            Don't worry, your data is safe.
          </Text>

          {__DEV__ && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugTitle}>Debug Information:</Text>
              <Text style={styles.debugText}>
                {this.state.error && this.state.error.toString()}
              </Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.retryButton]}
              onPress={this.handleRetry}
              disabled={retryCount >= maxRetries}
            >
              <Text style={styles.buttonText}>
                {retryCount >= maxRetries ? 'Max Retries' : 'Try Again'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.reportButton]}
              onPress={this.handleReportError}
            >
              <Text style={styles.buttonText}>Report Error</Text>
            </TouchableOpacity>
          </View>

          {retryCount > 0 && (
            <Text style={styles.retryInfo}>
              Retry attempt: {retryCount}/{maxRetries}
            </Text>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for error boundaries
export const withErrorBoundary = (Component, fallbackComponent) => {
  return class extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
      return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
      console.error('withErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
      if (this.state.hasError) {
        return fallbackComponent || <ErrorBoundary />;
      }

      return <Component {...this.props} />;
    }
  };
};

// Hook for error handling
export const useErrorHandler = () => {
  const [error, setError] = React.useState(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error) => {
    console.error('useErrorHandler captured error:', error);
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      // Log error to service
      console.log('Logging error from useErrorHandler:', error);
    }
  }, [error]);

  return { error, resetError, captureError };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  animation: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  debugInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#6c757d',
    fontFamily: 'monospace',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
  },
  retryButton: {
    backgroundColor: '#007bff',
  },
  reportButton: {
    backgroundColor: '#6c757d',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryInfo: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
});

export default ErrorBoundary;