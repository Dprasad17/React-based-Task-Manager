import notifee from '@notifee/react-native';
import { Platform, Alert } from 'react-native';

class NotificationService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Request permission
      const settings = await notifee.requestPermission();
      
      if (settings.authorizationStatus === 1) {
        // Create notification channels for Android
        if (Platform.OS === 'android') {
          await this.createNotificationChannels();
        }
        this.initialized = true;
        return true;
      } else {
        Alert.alert('Permission Required', 'Please enable notifications in settings');
        return false;
      }
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  }

  async createNotificationChannels() {
    // Task reminder channel
    await notifee.createChannel({
      id: 'task-reminders',
      name: 'Task Reminders',
      description: 'Notifications for task reminders and updates',
      importance: 4,
      sound: 'default',
      vibration: true,
    });

    // General notifications channel
    await notifee.createChannel({
      id: 'general',
      name: 'General Notifications',
      description: 'General app notifications',
      importance: 3,
    });
  }

  async scheduleTaskReminder(task) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const notificationId = `task-${task.id}`;
      
      await notifee.displayNotification({
        id: notificationId,
        title: 'Task Reminder',
        body: task.title,
        data: { 
          taskId: task.id,
          type: 'task_reminder'
        },
        android: {
          channelId: 'task-reminders',
          smallIcon: 'ic_launcher',
          pressAction: {
            id: 'default',
          },
          actions: [
            {
              title: 'Mark Complete',
              pressAction: {
                id: 'complete',
              },
            },
            {
              title: 'View Details',
              pressAction: {
                id: 'view',
              },
            },
          ],
        },
      });

      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      throw error;
    }
  }

  async cancelTaskReminder(taskId) {
    try {
      const notificationId = `task-${taskId}`;
      await notifee.cancelNotification(notificationId);
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  async sendPushNotification(title, body, data = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await notifee.displayNotification({
        title,
        body,
        data,
        android: {
          channelId: 'general',
          smallIcon: 'ic_launcher',
        },
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  async getNotificationSettings() {
    try {
      return await notifee.getNotificationSettings();
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return null;
    }
  }

  async openNotificationSettings() {
    try {
      await notifee.openNotificationSettings();
    } catch (error) {
      console.error('Error opening notification settings:', error);
    }
  }

  // Handle notification events
  setupNotificationHandlers() {
    // Foreground event handler
    notifee.onForegroundEvent(({ type, detail }) => {
      console.log('Foreground notification event:', type, detail);
      
      if (type === 1) { // Press
        this.handleNotificationPress(detail.notification);
      } else if (type === 2) { // Action press
        this.handleNotificationAction(detail.notification, detail.pressAction);
      }
    });

    // Background event handler
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      console.log('Background notification event:', type, detail);
      
      if (type === 2) { // Action press
        this.handleNotificationAction(detail.notification, detail.pressAction);
      }
    });
  }

  handleNotificationPress(notification) {
    const { data } = notification;
    
    if (data?.taskId) {
      // Navigate to task details
      console.log('Navigate to task:', data.taskId);
      // This would typically use navigation service
    }
  }

  handleNotificationAction(notification, action) {
    const { data } = notification;
    
    switch (action.id) {
      case 'complete':
        console.log('Mark task complete:', data.taskId);
        // Handle task completion
        break;
      case 'view':
        console.log('View task details:', data.taskId);
        // Navigate to task details
        break;
      default:
        console.log('Unknown action:', action.id);
    }
  }
}

export default new NotificationService();

