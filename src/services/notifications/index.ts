// src/services/notifications/index.ts
// NeuralOS Notification Service — local notifications via Notifee

import notifee, {
  AndroidImportance,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native';

const CHANNEL_ID = 'neuralos-default';
const CHANNEL_NAME = 'NeuralOS';

let channelCreated = false;

async function ensureChannel(): Promise<string> {
  if (channelCreated) return CHANNEL_ID;

  await notifee.createChannel({
    id: CHANNEL_ID,
    name: CHANNEL_NAME,
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });

  channelCreated = true;
  return CHANNEL_ID;
}

export async function showNotification(
  title: string,
  body: string,
): Promise<void> {
  const channelId = await ensureChannel();

  await notifee.displayNotification({
    title,
    body,
    android: {
      channelId,
      smallIcon: 'ic_launcher',
      pressAction: { id: 'default' },
    },
  });

  console.log('[Notifications] Shown:', title);
}

export async function scheduleNotification(
  title: string,
  body: string,
  delaySeconds: number,
): Promise<void> {
  const channelId = await ensureChannel();

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: Date.now() + delaySeconds * 1000,
  };

  await notifee.createTriggerNotification(
    {
      title,
      body,
      android: {
        channelId,
        smallIcon: 'ic_launcher',
        pressAction: { id: 'default' },
      },
    },
    trigger,
  );

  console.log(`[Notifications] Scheduled: "${title}" in ${delaySeconds}s`);
}

export async function cancelAllNotifications(): Promise<void> {
  await notifee.cancelAllNotifications();
  console.log('[Notifications] All cancelled');
}
