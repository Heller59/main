import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import Calendar from '../components/Calendar';
import EventModal from '../components/EventModal';
import Header from '../components/Header';
import UpcomingList from '../components/UpcomingList';
import { useLocale } from '../i18n/LocaleContext';
import { todayISO } from '../lib/dates';
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
import { configureAndroidChannel, requestPermission, rescheduleAll } from '../lib/notifications';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../lib/settings';
import SettingsScreen from './SettingsScreen';
import { colors, space, typography } from '../theme';

export default function HomeScreen() {
  const { bottom } = useSafeArea();
  const { locale, t } = useLocale();

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<CollectionEvent[]>([]);

  // Refreshed whenever the app comes back to the foreground, so "today" can't
  // go stale if the app is left open (or backgrounded) across midnight.
  const [today, setToday] = useState(todayISO());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(todayISO());
    });
    return () => sub.remove();
  }, []);

  // Everything downstream is derived from the JSON plus the chosen zone.
  const events = useMemo(() => buildEvents(settings.zone, locale), [settings.zone, locale]);
  const eventsByDate = useMemo(() => indexByDate(events), [events]);
  const months = useMemo(() => scheduleMonths(events), [events]);
  const startIndex = useMemo(() => initialMonthIndex(months), [months]);
  const ahead = useMemo(() => upcoming(events, today), [events, today]);
  const next = useMemo(() => nextOfEachKind(events, today), [events, today]);

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
        if (!granted) return;
      } else {
        setPermissionDenied(false);
      }
      await rescheduleAll(events, settings, locale);
    })();
    return () => {
      alive = false;
    };
  }, [ready, settings, events, locale]);

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

  return (
    <View style={styles.root}>
      <Header
        community={scheduleMeta.community}
        subtitle={t.home.headerSubtitle(scheduleMeta.township, scheduleMeta.year)}
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
            today={today}
            onSelectDate={onSelectDate}
          />
        ) : null}

        <UpcomingList next={next} remaining={ahead} />

        <Text style={styles.credit}>{t.home.credit(scheduleMeta.source)}</Text>
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
        permissionDenied={permissionDenied}
        onClose={() => setSettingsOpen(false)}
        onChange={updateSettings}
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
