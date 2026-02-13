import React, { useRef, useEffect } from 'react';
import LottieView from 'lottie-react-native';
import { View, StyleSheet } from 'react-native';

// Success animation component (Used in AddTaskScreen)
export const SuccessAnimation = ({ 
  visible = false, 
  onAnimationFinish,
  size = 200,
  style 
}) => {
  const animationRef = useRef(null);

  useEffect(() => {
    // ⭐️ If visible is true, play the animation from frame 0
    if (visible && animationRef.current) {
      animationRef.current.play(0); 
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={[styles.container, style]}>
      <LottieView
        ref={animationRef}
        source={require('../assets/Success.json')} // Your success JSON file
        style={{ width: size, height: size }}
        autoPlay={false} // Manual control
        loop={false} // Play once
        onAnimationFinish={onAnimationFinish}
        resizeMode="contain"
      />
    </View>
  );
};

// ⭐️ Notification animation component (For notification updates)
export const NotificationAnimation = ({
  visible = false,
  onAnimationFinish,
  size = 200,
  style
}) => {
  const animationRef = useRef(null);

  useEffect(() => {
    // ⭐️ If visible is true, play the animation from frame 0
    if (visible && animationRef.current) {
      animationRef.current.play(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={[styles.container, style]}>
      <LottieView
        ref={animationRef}
        source={require('../assets/Notification.json')} // Your notification JSON file
        style={{ width: size, height: size }}
        autoPlay={false} // Manual control
        loop={false} // Play once
        onAnimationFinish={onAnimationFinish}
        resizeMode="contain"
      />
    </View>
  );
};

// Loading animation component (Kept for reference, assuming you use it elsewhere)
export const LoadingAnimation = ({ 
  visible = true, 
  size = 100,
  style 
}) => {
  if (!visible) return null;

  return (
    <View style={[styles.container, style]}>
      <LottieView
        source={require('../assets/Loading.json')}
        style={{ width: size, height: size }}
        autoPlay={true}
        loop={true}
        resizeMode="contain"
      />
    </View>
  );
};

// Custom Lottie animation wrapper (Kept for reference)
export const LottieAnimation = ({ 
  source, 
  visible = true, 
  autoPlay = true, 
  loop = true, 
  onAnimationFinish,
  size = 200,
  style,
  speed = 1,
  colorFilters = []
}) => {
  const animationRef = useRef(null);

  useEffect(() => {
    if (visible && animationRef.current && autoPlay) {
      animationRef.current.play();
    }
  }, [visible, autoPlay]);

  if (!visible) return null;

  return (
    <View style={[styles.container, style]}>
      <LottieView
        ref={animationRef}
        source={source}
        style={{ width: size, height: size }}
        autoPlay={autoPlay}
        loop={loop}
        onAnimationFinish={onAnimationFinish}
        resizeMode="contain"
        speed={speed}
        colorFilters={colorFilters}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // Basic container style for the animations
    justifyContent: 'center',
    alignItems: 'center',
  },
});
