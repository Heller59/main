import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Calendar from '../components/Calendar';
import EventModal from '../components/EventModal';
import Header from '../components/Header';
import UpcomingList from '../components/UpcomingList';
import { useSafeArea } from '../lib/useSafeArea';
import {
  buildEvents,
  indexByDate,
  initialMonthIndex,
  nextOfEachKind,
  scheduleMeta,
  scheduleMonths,
  upcoming,
  type CollectionEvent,
} from '../lib/schedule';
import {
  configureAndroidChannel,
  hasPermission,
  requestPermission,
  rescheduleAll,
  sendTestNotification,
} from '../lib/notifications';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../lib/settings';
import SettingsScreen from './SettingsScreen';
import { colors, space, typography } from '../theme';

export default function HomeScreen() {
  const { bottom } = useSafeArea();

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<CollectionEvent[]>([]);

  // Everything downstream is derived from the JSON plus the chosen zone.
  const events = useMemo(() => buildEvents(settings.zone), [settings.zone]);
  const eventsByDate = useMemo(() => indexByDate(events), [events]);
  const months = useMemo(() => scheduleMonths(events), [events]);
  const startIndex = useMemo(() => initialMonthIndex(months), [months]);
  const ahead = useMemo(() => upcoming(events), [events]);
  const next = useMemo(() => nextOfEachKind(events), [events]);

  // Load saved settings once on launch.
  useEffect(() => {
    let alive = true;
    (async () => {
      await configureAndroidChannel();
      const stored = await loadSettings();
      if (!alive) return;
      setSettings(stored);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Rebuild the notification queue whenever settings or the event list change.
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    (async () => {
      if (settings.notificationsEnabled) {
        const granted = await requestPermission();
        if (!alive) return;
        setPermissionDenied(!granted);
        if (!granted) {
          setScheduledCount(0);
          return;
        }
      } else {
        setPermissionDenied(false);
      }
      const result = await rescheduleAll(events, settings);
      if (alive) setScheduledCount(result.scheduled);
    })();
    return () => {
      alive = false;
    };
  }, [ready, settings, events]);

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    void saveSettings(next);
  }, []);

  // A day with no events opens nothing at all.
  const onSelectDate = useCallback((iso: string, dayEvents: CollectionEvent[]) => {
    if (dayEvents.length === 0) return;
    setSelectedDate(iso);
    setSelectedEvents(dayEvents);
  }, []);

  const closeDay = useCallback(() => setSelectedDate(null), []);

  const onSendTest = useCallback(async () => {
    const granted = await hasPermission();
    if (!granted) {
      setPermissionDenied(true);
      return;
    }
    await sendTestNotification();
  }, []);

  return (
    <View style={styles.root}>
      <Header
        community={scheduleMeta.community}
        subtitle={`${scheduleMeta.township} \u00b7 ${scheduleMeta.year} schedule`}
        notificationsOn={settings.notificationsEnabled && !permissionDenied}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <ScrollView
        contentContainerStyle={{ paddingTop: space(4), paddingBottom: bottom + space(8) }}
        showsVerticalScrollIndicator={false}
      >
        {months.length > 0 ? (
          <Calendar
            months={months}
            eventsByDate={eventsByDate}
            initialIndex={startIndex}
            onSelectDate={onSelectDate}
          />
        ) : null}

        <UpcomingList next={next} remaining={ahead} />

        <Text style={styles.credit}>
          Schedule data: {scheduleMeta.source}.{'\n'}
          Tap a highlighted date for details.
        </Text>
      </ScrollView>

      <EventModal
        visible={selectedDate !== null}
        date={selectedDate}
        events={selectedEvents}
        onClose={closeDay}
      />

      <SettingsScreen
        visible={settingsOpen}
        settings={settings}
        scheduledCount={scheduledCount}
        permissionDenied={permissionDenied}
        onClose={() => setSettingsOpen(false)}
        onChange={updateSettings}
        onSendTest={onSendTest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mint },
  credit: {
    ...typography.small,
    fontSize: 11,
    color: colors.inkFaint,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: space(6),
    paddingHorizontal: space(8),
  },
});
