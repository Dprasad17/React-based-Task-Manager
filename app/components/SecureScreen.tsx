import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import FlagSecure from 'react-native-flag-secure-android';

interface SecureScreenProps {
  children: React.ReactNode;
}

const SecureScreen: React.FC<SecureScreenProps> = ({ children }) => {
  useEffect(() => {
    if (Platform.OS === 'android') {
      FlagSecure.activate();
      return () => {
        FlagSecure.deactivate();
      };
    }
  }, []);

  return <>{children}</>;
};

export default SecureScreen;