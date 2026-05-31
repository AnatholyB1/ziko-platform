import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import type * as NotificationsType from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';

// Lazy load expo-notifications to avoid crashing when ExpoTopicSubscriptionModule
// native module is not linked (Expo Go on Android, SDK 54+).
function N(): typeof NotificationsType | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications');
  } catch {
    return null;
  }
}

const SKIP_COUNT_KEY = 'notification_skip_count';
const DEVICE_ID_KEY = 'notification_device_id';
const PROJECT_ID = '9b672c1a-10c4-4d66-882c-b9a08294650f';

async function setupAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const n = N();
  if (!n) return;

  await n.setNotificationChannelAsync('coach', {
    name: 'Coach & Programme',
    importance: n.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#7B5BD0',
    sound: 'default',
    showBadge: true,
  });
  await n.setNotificationChannelAsync('workout', {
    name: 'Rappels séance',
    importance: n.AndroidImportance.DEFAULT,
    sound: 'default',
    showBadge: true,
  });
  await n.setNotificationChannelAsync('gamification', {
    name: 'Récompenses & Succès',
    importance: n.AndroidImportance.DEFAULT,
    lightColor: '#E8A33A',
    showBadge: true,
  });
  await n.setNotificationChannelAsync('health', {
    name: 'Santé & Habitudes',
    importance: n.AndroidImportance.LOW,
    showBadge: false,
  });
  await n.setNotificationChannelAsync('system', {
    name: 'Alertes système',
    importance: n.AndroidImportance.HIGH,
    showBadge: true,
  });
}

function generateUUID(): string {
  // crypto.randomUUID() is not available in all Hermes builds on Android
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const newId = generateUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
  return newId;
}

async function getAndRegisterToken(
  userId: string,
  deviceId: string,
  session: Session
): Promise<void> {
  const n = N();
  if (!n) return;
  try {
    const { data: token } = await n.getExpoPushTokenAsync({
      projectId: PROJECT_ID,
    });
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    await fetch(`${apiUrl}/notifications/token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, platform, deviceId }),
    });
  } catch (err) {
    console.warn('[useNotificationSetup] Token registration failed:', err);
  }
}

export interface NotificationSetup {
  showModal: boolean;
  onActivate: () => void;
  onSkip: () => void;
}

export function useNotificationSetup(
  userId?: string,
  session?: Session | null
): NotificationSetup {
  const [showModal, setShowModal] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');

  // Setup Android channels on mount (idempotent)
  useEffect(() => {
    setupAndroidChannels().catch((err) => {
      console.warn('[useNotificationSetup] Android channels setup failed:', err);
    });
  }, []);

  // Permission + token flow
  useEffect(() => {
    if (!userId || !session) return;

    let tokenSub: NotificationsType.Subscription | undefined;

    (async () => {
      const n = N();
      if (!n) return;

      // Obtain or create stable device_id
      const id = await getOrCreateDeviceId();
      setDeviceId(id);

      // Check existing permission status
      const { status, canAskAgain } = await n.getPermissionsAsync();

      if (status === 'granted') {
        // Already granted — register token directly
        await getAndRegisterToken(userId, id, session);

        // Listen for token rotation
        tokenSub = n.addPushTokenListener(async () => {
          await getAndRegisterToken(userId, id, session);
        });
        return;
      }

      if (!canAskAgain) {
        // OS permanently denied — never show modal
        return;
      }

      // Check skip count
      const skipRaw = await AsyncStorage.getItem(SKIP_COUNT_KEY);
      const skipCount = skipRaw !== null ? parseInt(skipRaw, 10) : 0;
      if (skipCount >= 3) {
        // User has skipped 3 times — stop showing modal
        return;
      }

      // Show pre-permission modal
      setShowModal(true);
    })();

    return () => {
      tokenSub?.remove();
    };
  }, [userId, session]);

  const onActivate = async (): Promise<void> => {
    if (!userId || !session || !deviceId) return;
    const n = N();
    if (!n) { setShowModal(false); return; }

    const { status, canAskAgain } = await n.requestPermissionsAsync();

    if (status === 'granted') {
      await getAndRegisterToken(userId, deviceId, session);
    }

    // If canAskAgain is false after denial, silently close
    if (!canAskAgain && status !== 'granted') {
      // Do nothing extra — the Settings screen handles the permanent denial CTA
    }

    setShowModal(false);
  };

  const onSkip = async (): Promise<void> => {
    const skipRaw = await AsyncStorage.getItem(SKIP_COUNT_KEY);
    const skipCount = skipRaw !== null ? parseInt(skipRaw, 10) : 0;
    await AsyncStorage.setItem(SKIP_COUNT_KEY, String(skipCount + 1));
    setShowModal(false);
  };

  return { showModal, onActivate, onSkip };
}
