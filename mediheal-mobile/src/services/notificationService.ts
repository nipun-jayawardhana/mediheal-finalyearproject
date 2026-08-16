import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Medication } from '../types/medication';

export const REMINDERS_ENABLED_KEY = '@mediheal_medication_reminders_enabled';
export const NOTIFICATION_IDS_KEY = '@mediheal_medication_notification_ids';
export const ANDROID_CHANNEL_ID = 'medication-reminders';

interface StoredNotificationRecord {
  id: string;
  medicationId: string;
  scheduledTime: string;
}

/**
 * Configure foreground notification behavior & Android channel
 */
export const initNotificationHandler = async (): Promise<void> => {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Medication Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#208AEF',
        showBadge: true,
      });
    }
  } catch (err) {
    console.log('Failed to initialize notification handler:', err);
  }
};

/**
 * Check existing OS notification permission status
 */
export const getNotificationPermissionStatus = async (): Promise<Notifications.PermissionStatus> => {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings.status;
  } catch (err) {
    console.log('Error getting notification permissions:', err);
    return Notifications.PermissionStatus.UNDETERMINED;
  }
};

/**
 * Request OS notification permission from user
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== Notifications.PermissionStatus.GRANTED) {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Medication Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#208AEF',
      });
    }

    return finalStatus === Notifications.PermissionStatus.GRANTED;
  } catch (err) {
    console.log('Error requesting notification permission:', err);
    return false;
  }
};

/**
 * Check if medication reminders are enabled in app preferences
 */
export const getRemindersEnabledPreference = async (): Promise<boolean> => {
  try {
    const val = await AsyncStorage.getItem(REMINDERS_ENABLED_KEY);
    return val === 'true';
  } catch (err) {
    return false;
  }
};

/**
 * Save medication reminders preference
 */
export const setRemindersEnabledPreference = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(REMINDERS_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (err) {
    console.log('Error saving reminder preference:', err);
  }
};

/**
 * Get stored notification IDs
 */
export const getStoredNotificationRecords = async (): Promise<StoredNotificationRecord[]> => {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_IDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
};

/**
 * Save stored notification IDs
 */
const saveStoredNotificationRecords = async (records: StoredNotificationRecord[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(NOTIFICATION_IDS_KEY, JSON.stringify(records));
  } catch (err) {
    console.log('Error saving notification IDs:', err);
  }
};

/**
 * Cancel all local MediHeal medication reminders
 */
export const cancelMedicationReminders = async (): Promise<void> => {
  try {
    const records = await getStoredNotificationRecords();
    for (const item of records) {
      try {
        await Notifications.cancelScheduledNotificationAsync(item.id);
      } catch (e) {
        // Notification may have already fired
      }
    }
    await AsyncStorage.removeItem(NOTIFICATION_IDS_KEY);
  } catch (err) {
    console.log('Error cancelling medication reminders:', err);
  }
};

/**
 * Schedule local notifications for a list of active medications.
 * Uses a finite rolling window (next 7 days) respecting startDate & endDate bounds.
 */
export const synchronizeMedicationReminders = async (
  medications: Medication[]
): Promise<{ scheduledCount: number }> => {
  const enabled = await getRemindersEnabledPreference();
  if (!enabled) {
    await cancelMedicationReminders();
    return { scheduledCount: 0 };
  }

  const permissionStatus = await getNotificationPermissionStatus();
  if (permissionStatus !== Notifications.PermissionStatus.GRANTED) {
    await cancelMedicationReminders();
    return { scheduledCount: 0 };
  }

  // Cancel existing scheduled medication notifications to prevent duplicate stacking
  await cancelMedicationReminders();

  const now = new Date();
  const maxDaysAhead = 7;
  const newRecords: StoredNotificationRecord[] = [];
  let scheduledCount = 0;

  for (const med of medications) {
    // 1. Verify active state
    if (!med.isActive) continue;
    if (!med.timeSlots || med.timeSlots.length === 0) continue;

    // Parse start and end dates (YYYY-MM-DD)
    const [startYear, startMonth, startDay] = med.startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = med.endDate.split('-').map(Number);

    if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) {
      continue;
    }

    const startLocalDate = new Date(startYear, startMonth - 1, startDay, 0, 0, 0);
    const endLocalDate = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);

    // If endDate is in the past, skip this medication
    if (endLocalDate < now) continue;

    // Generate date array for the next maxDaysAhead days
    for (let dayOffset = 0; dayOffset < maxDaysAhead; dayOffset++) {
      const checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);

      // Verify date is within [startDate, endDate]
      const checkDateStartOfDay = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate(), 0, 0, 0);
      const checkDateEndOfDay = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate(), 23, 59, 59);

      if (checkDateEndOfDay < startLocalDate || checkDateStartOfDay > endLocalDate) {
        continue;
      }

      // Schedule for each time slot (e.g. "08:00", "20:00")
      for (const slot of med.timeSlots) {
        const [hours, minutes] = slot.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) continue;

        const scheduledTargetDate = new Date(
          checkDate.getFullYear(),
          checkDate.getMonth(),
          checkDate.getDate(),
          hours,
          minutes,
          0
        );

        // Do not schedule past occurrences
        if (scheduledTargetDate <= now) continue;

        let bodyText = `Time to take ${med.medicineName}`;
        if (med.dosage) {
          bodyText += ` ${med.dosage}`;
        }
        if (med.frequency) {
          bodyText += ` — ${med.frequency}`;
        } else {
          bodyText += ` — 1 Dose`;
        }
        if (med.instructions && med.instructions.trim().length > 0) {
          bodyText += `. Note: ${med.instructions.trim()}`;
        }

        try {
          const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Medication Reminder',
              body: bodyText,
              sound: 'default',
              data: {
                screen: '/(patient)/medications',
                medicationId: med._id,
                scheduledTime: slot,
              },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: scheduledTargetDate,
              channelId: ANDROID_CHANNEL_ID,
            },
          });

          newRecords.push({
            id: notificationId,
            medicationId: med._id,
            scheduledTime: scheduledTargetDate.toISOString(),
          });

          scheduledCount++;
        } catch (err) {
          console.log(`Failed to schedule notification for ${med.medicineName} at ${slot}:`, err);
        }
      }
    }
  }

  await saveStoredNotificationRecords(newRecords);
  return { scheduledCount };
};

/**
 * Setup notification response (tap) listener
 */
export const setupNotificationResponseListener = (
  onNavigateToMedications: () => void
): (() => void) => {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data && data.screen === '/(patient)/medications') {
      onNavigateToMedications();
    }
  });

  return () => {
    subscription.remove();
  };
};
