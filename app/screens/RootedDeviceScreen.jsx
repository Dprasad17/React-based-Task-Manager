// 7. App Integrity Check (Rooted devices)
import React from 'react';
import { View, Text, StyleSheet, Button, BackHandler } from 'react-native';

const RootedDeviceScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Security Risk Detected</Text>
      <Text style={styles.message}>
        This application cannot run on a rooted (jailbroken) device for
        security reasons.
      </Text>
      <Button title="Exit App" onPress={() => BackHandler.exitApp()} color="#FF3B30" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 20,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: '#000',
    marginBottom: 40,
  },
});

export default RootedDeviceScreen;
