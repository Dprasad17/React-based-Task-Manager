import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Animated,
  useColorScheme,
} from 'react-native';

const PinInput = ({ onComplete }) => {
  const [pin, setPin] = useState(['', '', '', '']);
  const inputs = useRef([]);
  const colorScheme = useColorScheme();
  const animations = useRef(pin.map(() => new Animated.Value(1))).current;

  const isDark = colorScheme === 'dark';
  const theme = {
    colors: {
      primary: '#4f46e5',
      surface: isDark ? '#1f2937' : '#ffffff',
      text: isDark ? '#ffffff' : '#111827',
      border: isDark ? '#374151' : '#e5e7eb',
    },
  };

  const handleChange = (text, index) => {
    const newPin = [...pin];
    newPin[index] = text;
    setPin(newPin);

    if (text && index < 3) {
      inputs.current[index + 1]?.focus();
    }

    if (newPin.every(digit => digit !== '')) {
      onComplete?.(newPin.join(''));
    }
  };

  const handleFocus = index => {
    Animated.spring(animations[index], {
      toValue: 1.08,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handleBlur = index => {
    Animated.spring(animations[index], {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handleBackspace = (e, index) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!pin[index] && index > 0) {
        inputs.current[index - 1]?.focus();
      }
      const newPin = [...pin];
      newPin[index] = '';
      setPin(newPin);
    }
  };

  return (
    <View style={styles.pinContainer}>
      {pin.map((_, index) => (
        <Animated.View
          key={index}
          style={[
            styles.pinBox,
            {
              transform: [{ scale: animations[index] }],
              borderColor: pin[index] ? theme.colors.primary : theme.colors.border,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <TextInput
            ref={el => (inputs.current[index] = el)}
            style={[styles.input, { color: theme.colors.text }]}
            keyboardType="numeric"
            maxLength={1}
            onChangeText={text => handleChange(text, index)}
            onFocus={() => handleFocus(index)}
            onBlur={() => handleBlur(index)}
            onKeyPress={e => handleBackspace(e, index)}
            value={pin[index]}
            secureTextEntry
            autoFocus={index === 0}
            selectionColor={theme.colors.primary}
          />
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  pinBox: {
    width: 60,
    height: 70,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  input: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
});

export default PinInput;