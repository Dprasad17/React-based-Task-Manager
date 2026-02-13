import React, { useRef } from 'react';
import { Animated, PanResponder, Vibration } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

// Swipe to delete gesture
export const SwipeToDelete = ({ children, onDelete, threshold = 100 }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dx) > 10;
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dx < 0) {
        translateX.setValue(gestureState.dx);
        opacity.setValue(1 + gestureState.dx / 200);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx < -threshold) {
        // Swipe left to delete
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: -300,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onDelete();
        });
      } else {
        // Snap back
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.spring(opacity, {
            toValue: 1,
            useNativeDriver: true,
          }),
        ]).start();
      }
    },
  });

  return (
    <Animated.View
      style={{
        transform: [{ translateX }],
        opacity,
      }}
      {...panResponder.panHandlers}
    >
      {children}
    </Animated.View>
  );
};

// Drag and drop gesture
export const DragAndDrop = ({ children, onDrag, onDrop, disabled = false }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .onStart(() => {
      Animated.spring(scale, {
        toValue: 1.1,
        useNativeDriver: true,
      }).start();
    })
    .onUpdate((event) => {
      translateX.setValue(event.translationX);
      translateY.setValue(event.translationY);
      onDrag?.(event);
    })
    .onEnd((event) => {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
      onDrop?.(event);
    });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={{
          transform: [
            { translateX },
            { translateY },
            { scale },
          ],
        }}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
};

// Long press gesture
export const LongPress = ({ children, onLongPress, delay = 500, haptic = true }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const longPressGesture = Gesture.LongPress()
    .minDuration(delay)
    .onStart(() => {
      if (haptic) {
        Vibration.vibrate(50);
      }
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
      onLongPress();
    });

  return (
    <GestureDetector gesture={longPressGesture}>
      <Animated.View
        style={{
          transform: [{ scale }],
        }}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
};

// Pinch to zoom gesture
export const PinchToZoom = ({ children, onZoom }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.setValue(event.scale);
      onZoom?.(event);
    })
    .onEnd(() => {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    });

  return (
    <GestureDetector gesture={pinchGesture}>
      <Animated.View
        style={{
          transform: [{ scale }],
        }}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
};

// Tap gesture with haptic feedback
export const TapWithHaptic = ({ children, onTap, haptic = true }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const tapGesture = Gesture.Tap()
    .onStart(() => {
      if (haptic) {
        Vibration.vibrate(10);
      }
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.95,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 50,
          useNativeDriver: true,
        }),
      ]).start();
      onTap();
    });

  return (
    <GestureDetector gesture={tapGesture}>
      <Animated.View
        style={{
          transform: [{ scale }],
        }}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
};

// Combined gesture for task items
export const TaskGestureHandler = ({ 
  children, 
  onSwipeDelete, 
  onLongPress, 
  onTap,
  onDrag,
  onDrop,
  disabled = false 
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.setValue(event.translationX);
      }
    })
    .onEnd((event) => {
      if (event.translationX < -100) {
        // Swipe to delete
        Animated.timing(translateX, {
          toValue: -300,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          onSwipeDelete?.();
        });
      } else {
        // Snap back
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      Vibration.vibrate(50);
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
      onLongPress?.();
    });

  const tapGesture = Gesture.Tap()
    .onStart(() => {
      Vibration.vibrate(10);
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.98,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 50,
          useNativeDriver: true,
        }),
      ]).start();
      onTap?.();
    });

  const combinedGesture = Gesture.Simultaneous(
    panGesture,
    longPressGesture,
    tapGesture
  );

  return (
    <GestureDetector gesture={combinedGesture}>
      <Animated.View
        style={{
          transform: [
            { translateX },
            { scale },
          ],
        }}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
};









