import * as Keychain from 'react-native-keychain';

// Service keys for different credentials
const JWT_SERVICE = 'com.yoursecureapp.jwt';
const PIN_SERVICE = 'com.yoursecureapp.pin';

// ============================================
// JWT TOKEN MANAGEMENT
// ============================================

// Store JWT
export const storeToken = async (token) => {
  try {
    await Keychain.setGenericPassword('user', token, { service: JWT_SERVICE });
    console.log('✅ JWT token stored securely');
  } catch (error) {
    console.error('❌ Error storing token:', error);
    throw error;
  }
};

// Get JWT
export const getToken = async () => {
  try {
    const credentials = await Keychain.getGenericPassword({ service: JWT_SERVICE });
    return credentials ? credentials.password : null;
  } catch (error) {
    console.error('❌ Error getting token:', error);
    return null;
  }
};

// Clear JWT (on full logout)
export const clearToken = async () => {
  try {
    await Keychain.resetGenericPassword({ service: JWT_SERVICE });
    console.log('✅ JWT token cleared');
  } catch (error) {
    console.error('❌ Error clearing token:', error);
    throw error;
  }
};

// ============================================
// PIN MANAGEMENT
// ============================================

// Store App PIN
export const storePin = async (pin) => {
  try {
    await Keychain.setGenericPassword('app-pin', pin, { service: PIN_SERVICE });
    console.log('✅ PIN stored securely');
  } catch (error) {
    console.error('❌ Error storing PIN:', error);
    throw error;
  }
};

// Get App PIN
export const getPin = async () => {
  try {
    const credentials = await Keychain.getGenericPassword({ service: PIN_SERVICE });
    return credentials ? credentials.password : null;
  } catch (error) {
    console.error('❌ Error getting PIN:', error);
    return null;
  }
};

// Clear App PIN (on full logout)
export const clearPin = async () => {
  try {
    await Keychain.resetGenericPassword({ service: PIN_SERVICE });
    console.log('✅ PIN cleared from secure storage');
  } catch (error) {
    console.error('❌ Error clearing PIN:', error);
    throw error;
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Clear all stored credentials (full logout)
 * Clears both JWT token and PIN
 */
export const clearAllCredentials = async () => {
  try {
    await Promise.all([
      clearToken(),
      clearPin(),
    ]);
    console.log('✅ All credentials cleared');
  } catch (error) {
    console.error('❌ Error clearing all credentials:', error);
    throw error;
  }
};

/**
 * Check if PIN exists
 * Useful for determining if user needs to set up PIN
 */
export const hasPinSet = async () => {
  try {
    const pin = await getPin();
    return !!pin;
  } catch (error) {
    console.error('❌ Error checking PIN:', error);
    return false;
  }
};

/**
 * Verify PIN matches stored PIN
 * @param inputPin - PIN entered by user
 * @returns boolean - true if PIN matches
 */
export const verifyPin = async (inputPin) => {
  try {
    const storedPin = await getPin();
    return storedPin === inputPin;
  } catch (error) {
    console.error('❌ Error verifying PIN:', error);
    return false;
  }
};