import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EventKind, Zone } from './schedule';

const KEY = 'orchards.settings.v1';

export interface Settings {
  notificationsEnabled: boolean;
  /** How many days ahead of the collection to send the reminder. */
  daysBefore: Record<EventKind, number>;
  zone: Zone;
}

/**
 * One day before, at noon. For bulk that means one day before the Monday you
 * can start putting items out, not before the crews arrive.
 */
export const DEFAULT_SETTINGS: Settings = {
  notificationsEnabled: true,
  daysBefore: { trash: 1, recycling: 1, bulk: 1 },
  zone: '3-4',
};

/** The Orchards is in one bulk zone; every other zone is shown but locked. */
export const isZoneSelectable = (zone: Zone): boolean => zone === DEFAULT_SETTINGS.zone;

export const REMINDER_HOUR = 12;
export const MIN_DAYS_BEFORE = 0;
export const MAX_DAYS_BEFORE = 14;

export async function loadSettings(): Promise<Settings> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (!stored) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(stored) as Partial<Settings>;
    return {
      notificationsEnabled: parsed.notificationsEnabled ?? DEFAULT_SETTINGS.notificationsEnabled,
      daysBefore: { ...DEFAULT_SETTINGS.daysBefore, ...(parsed.daysBefore ?? {}) },
      // A zone saved before others were locked falls back to the home zone.
      zone: parsed.zone && isZoneSelectable(parsed.zone) ? parsed.zone : DEFAULT_SETTINGS.zone,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage is a convenience here; losing it just resets to defaults.
  }
}

export function clampDays(n: number): number {
  return Math.max(MIN_DAYS_BEFORE, Math.min(MAX_DAYS_BEFORE, n));
}

export function leadLabel(days: number): string {
  if (days === 0) return 'Same day, at noon';
  if (days === 1) return '1 day before, at noon';
  return `${days} days before, at noon`;
}
