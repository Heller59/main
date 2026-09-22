import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, fmtShort, parseISO } from './dates';
import type { CollectionEvent } from './schedule';
import { REMINDER_HOUR, type Settings } from './settings';

export const CHANNEL_ID = 'collections';

/**
 * iOS keeps at most 64 pending local notifications per app and silently drops
 * the rest, so we schedule the soonest ones and top up whenever the app opens.
 */
const MAX_PENDING = 60;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Collection reminders',
    description: 'Trash, recycling and bulk pickup reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#527F7A',
  });
}

export async function requestPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return true;
  if (!existing.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return asked.status === 'granted';
}

function bodyFor(event: CollectionEvent): string {
  if (event.kind === 'bulk') {
    return `${event.note} ${event.detail ?? ''}`.trim();
  }
  return `Collection is ${fmtShort(event.markerDate)}. ${event.note}`;
}

/** The exact moment a reminder should fire: N days before, at noon local. */
export function reminderTimeFor(event: CollectionEvent, settings: Settings): Date {
  const fire = addDays(parseISO(event.anchorDate), -settings.daysBefore[event.kind]);
  fire.setHours(REMINDER_HOUR, 0, 0, 0);
  return fire;
}

export interface ScheduleResult {
  scheduled: number;
  /** True when the schedule ran past the pending cap and was trimmed. */
  trimmed: boolean;
  nextFire: Date | null;
}

/**
 * Clears everything and rebuilds from scratch. Cheap enough to run on every
 * settings change, and it guarantees we never leave a stale reminder behind.
 */
export async function rescheduleAll(
  events: CollectionEvent[],
  settings: Settings,
): Promise<ScheduleResult> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!settings.notificationsEnabled) {
    return { scheduled: 0, trimmed: false, nextFire: null };
  }

  await configureAndroidChannel();

  const now = Date.now();
  const due = events
    .map((event) => ({ event, fire: reminderTimeFor(event, settings) }))
    .filter((p) => p.fire.getTime() > now)
    .sort((a, b) => a.fire.getTime() - b.fire.getTime());

  const batch = due.slice(0, MAX_PENDING);

  for (const { event, fire } of batch) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: event.title,
          body: bodyFor(event),
          sound: true,
          data: { kind: event.kind, date: event.markerDate },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fire,
          channelId: CHANNEL_ID,
        },
      });
    } catch (err) {
      // One bad trigger shouldn't sink the whole batch.
      console.warn('Could not schedule reminder for', event.id, err);
    }
  }

  return {
    scheduled: batch.length,
    trimmed: due.length > batch.length,
    nextFire: batch.length > 0 ? batch[0].fire : null,
  };
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
