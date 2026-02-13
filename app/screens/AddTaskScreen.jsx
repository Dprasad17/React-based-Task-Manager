import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  Platform,
  KeyboardAvoidingView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { saveTask } from '../store/store';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import NetInfo from '@react-native-community/netinfo';
import NotificationService from '../services/NotificationService';
import StorageService from '../services/StorageService';
import ApiService from '../services/ApiService';
import { SuccessAnimation } from '../components/LottieAnimation';

export default function AddTaskScreen({ navigation, isDark = false }) {
  const dispatch = useDispatch();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('low');
  const [dueDate, setDueDate] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  
  // Animation states
  const [showSuccess, setShowSuccess] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const theme = {
    colors: {
      primary: isDark ? '#6366f1' : '#4f46e5',
      secondary: isDark ? '#10b981' : '#059669',
      background: isDark ? '#111827' : '#f9fafb',
      surface: isDark ? '#1f2937' : '#ffffff',
      text: isDark ? '#ffffff' : '#111827',
      textSecondary: isDark ? '#9ca3af' : '#6b7280',
      border: isDark ? '#374151' : '#e5e7eb',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
    },
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { 
        toValue: 1, 
        duration: 500, 
        useNativeDriver: true 
      }),
      Animated.timing(slideAnim, { 
        toValue: 0, 
        duration: 500, 
        useNativeDriver: true 
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  const handlePriorityChange = useCallback((newPriority) => {
    setPriority(newPriority);
  }, []);

  const handleImagePicker = useCallback((pickerFunction) => {
    pickerFunction({ 
      mediaType: 'photo', 
      includeBase64: false, 
      maxHeight: 200, 
      maxWidth: 200, 
    }, (response) => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.errorCode) {
        console.log('ImagePicker Error: ', response.errorMessage);
        Alert.alert('Error', 'Could not select image.');
      } else if (response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        setImage({ uri: asset.uri, name: asset.fileName, type: asset.type });
      }
    });
  }, []);

  const handleCameraPress = useCallback(() => handleImagePicker(launchCamera), [handleImagePicker]);
  const handleGalleryPress = useCallback(() => handleImagePicker(launchImageLibrary), [handleImagePicker]);
  const removeImage = useCallback(() => setImage(null), []);

  const handleSave = useCallback(async () => {
    if (!title) {
        Alert.alert('Error', 'Task title cannot be empty.');
        return;
    }

    try {
        setLoading(true);
        
        // ApiService.addTask now handles saving to permanent local storage
        const result = await ApiService.addTask({
            title,
            description,
            priority,
            image: image ? image.uri : undefined,
            dueDate,
        });

        if (result.success) {
            // Success message for permanent local save
            Alert.alert(
                'Task Added Locally',
                'Your task has been added and will persist across sessions.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } else {
            Alert.alert('Error', result.error || 'Failed to add task.');
        }
    } catch (e) {
        console.error('Error adding task:', e);
        Alert.alert('Error', 'An unexpected error occurred while adding the task.');
    } finally {
        setLoading(false);
    }
  }, [title, description, priority, image, dueDate, navigation]);

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View 
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <Text style={[styles.title, { color: theme.colors.primary }]}>Create New Task</Text>

          <TextInput
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.surface }]}
            placeholder="Task Title *"
            placeholderTextColor={theme.colors.textSecondary}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          <TextInput
            style={[styles.input, styles.multilineInput, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.surface }]}
            placeholder="Description (optional)"
            placeholderTextColor={theme.colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          <Text style={[styles.label, { color: theme.colors.text }]}>Priority:</Text>
          <View style={styles.priorityContainer}>
            {['low', 'medium', 'high'].map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.priorityButton,
                  { 
                    backgroundColor: priority === p ? theme.colors.primary : theme.colors.surface,
                    borderColor: priority === p ? theme.colors.primary : theme.colors.border,
                  }
                ]}
                onPress={() => handlePriorityChange(p)}
              >
                <Text style={[
                  styles.priorityText, 
                  { color: priority === p ? '#fff' : theme.colors.text }
                ]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: theme.colors.text }]}>Image:</Text>
          <View style={styles.imageSection}>
            <View style={styles.imageButtonsRow}>
              <TouchableOpacity style={styles.imageButton} onPress={handleCameraPress}>
                <Text style={styles.imageButtonText}>📸 Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.imageButton} onPress={handleGalleryPress}>
                <Text style={styles.imageButtonText}>🖼️ Gallery</Text>
              </TouchableOpacity>
            </View>

            {image && (
              <View>
                <Image source={{ uri: image.uri }} style={styles.selectedImage} />
                <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                  <Text style={styles.removeImageText}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TextInput
            style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.surface }]}
            placeholder="Due date (optional)"
            placeholderTextColor={theme.colors.textSecondary}
            value={dueDate}
            onChangeText={setDueDate}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.cancelBtn, { backgroundColor: theme.colors.border }]} 
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.cancelText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]} 
              onPress={handleSave} 
              disabled={loading}
            >
              {loading && <ActivityIndicator size="small" color="#fff" style={styles.loadingIndicator} />}
              <Text style={styles.saveText}>{loading ? 'Saving...' : (isOffline ? 'Save Locally' : 'Save Task')}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 5,
  },
  priorityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    gap: 10,
  },
  priorityButton: {
    flex: 1,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  priorityText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  imageSection: {
    marginBottom: 20,
  },
  imageButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  imageButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  imageButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  selectedImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginTop: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: 5,
    left: 85,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    padding: 5,
    borderRadius: 10,
  },
  removeImageText: {
    color: '#fff',
    fontSize: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  saveText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingIndicator: {
    marginRight: 8,
  }
});