import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { ChevronIcon } from '../icons';
import { fmtMonthYear, toISO, todayISO } from '../lib/dates';
import type { CollectionEvent, EventKind } from '../lib/schedule';
import { colors, radius, shadow, space, typography } from '../theme';
import KindBadge from './KindBadge';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CARD_MARGIN = space(4);
const GRID_PAD = space(2);

type MonthRef = { year: number; month: number };

interface Cell {
  iso: string;
  day: number;
  inMonth: boolean;
}

/** Six-week grid including the greyed spill from neighbouring months. */
function buildCells(year: number, month: number): Cell[] {
  const first = new Date(year, month, 1);
  const lead = first.getDay();
  const start = new Date(year, month, 1 - lead);
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ iso: toISO(d), day: d.getDate(), inMonth: d.getMonth() === month });
  }
  // Trim a trailing all-spill week so short months don't leave a dead row.
  while (cells.length > 35 && cells.slice(-7).every((c) => !c.inMonth)) {
    cells.splice(-7, 7);
  }
  return cells;
}

interface Props {
  months: MonthRef[];
  eventsByDate: Map<string, CollectionEvent[]>;
  initialIndex: number;
  onSelectDate: (iso: string, events: CollectionEvent[]) => void;
}

export default function Calendar({ months, eventsByDate, initialIndex, onSelectDate }: Props) {
  const { width } = useWindowDimensions();
  const pageWidth = width - CARD_MARGIN * 2;
  const cellWidth = (pageWidth - GRID_PAD * 2) / 7;
  // Badges share the cell width: roomy for one or two, tighter when three collide.
  const badgeSizeFor = (count: number) =>
    Math.min(22, Math.floor((cellWidth - 2) / Math.max(2, count)) - 2);

  const [index, setIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<MonthRef>>(null);
  const today = todayISO();

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(months.length - 1, next));
      if (clamped === index) return;
      setIndex(clamped);
      listRef.current?.scrollToIndex({ index: clamped, animated: true });
    },
    [index, months.length],
  );

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      if (next !== index) setIndex(next);
    },
    [index, pageWidth],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<MonthRef> | null | undefined, i: number) => ({
      length: pageWidth,
      offset: pageWidth * i,
      index: i,
    }),
    [pageWidth],
  );

  const renderMonth = useCallback(
    ({ item }: ListRenderItemInfo<MonthRef>) => {
      const cells = buildCells(item.year, item.month);
      return (
        <View style={{ width: pageWidth, paddingHorizontal: GRID_PAD }}>
          <View style={styles.dowRow}>
            {DOW.map((d, i) => (
              <View key={i} style={{ width: cellWidth }}>
                <Text style={styles.dowText}>{d}</Text>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((cell) => {
              const dayEvents = cell.inMonth ? eventsByDate.get(cell.iso) ?? [] : [];
              const hasEvents = dayEvents.length > 0;
              const isToday = cell.iso === today;

              return (
                <Pressable
                  key={cell.iso}
                  disabled={!hasEvents}
                  onPress={() => onSelectDate(cell.iso, dayEvents)}
                  android_ripple={hasEvents ? { color: colors.mintDeep, borderless: true } : undefined}
                  accessibilityRole={hasEvents ? 'button' : undefined}
                  accessibilityLabel={
                    hasEvents
                      ? `${cell.day}, ${dayEvents.map((e) => e.title).join(', ')}`
                      : undefined
                  }
                  style={({ pressed }) => [
                    styles.cell,
                    { width: cellWidth, height: cellWidth * 1.18 },
                    pressed && hasEvents && styles.cellPressed,
                  ]}
                >
                  <View style={[styles.dayPill, isToday && styles.dayPillToday]}>
                    <Text
                      style={[
                        styles.dayText,
                        !cell.inMonth && styles.dayTextMuted,
                        isToday && styles.dayTextToday,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </View>

                  <View style={styles.markerRow}>
                    {dayEvents.slice(0, 3).map((e) => (
                      <View key={e.id} style={styles.marker}>
                        <KindBadge
                          kind={e.kind}
                          size={badgeSizeFor(Math.min(dayEvents.length, 3))}
                          glyphRatio={0.68}
                        />
                      </View>
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    },
    [cellWidth, eventsByDate, onSelectDate, pageWidth, today],
  );

  const current = months[index] ?? months[0];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          onPress={() => goTo(index - 1)}
          disabled={index === 0}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
        >
          <ChevronIcon direction="left" color={index === 0 ? colors.inkFaint : colors.teal} />
        </Pressable>

        <Text style={styles.monthLabel}>
          {current ? fmtMonthYear(current.year, current.month) : ''}
        </Text>

        <Pressable
          onPress={() => goTo(index + 1)}
          disabled={index >= months.length - 1}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
        >
          <ChevronIcon
            direction="right"
            color={index >= months.length - 1 ? colors.inkFaint : colors.teal}
          />
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={months}
        keyExtractor={(m) => `${m.year}-${m.month}`}
        renderItem={renderMonth}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={getItemLayout}
        onMomentumScrollEnd={onMomentumEnd}
        windowSize={3}
        onScrollToIndexFailed={({ index: i }) => {
          setTimeout(() => listRef.current?.scrollToIndex({ index: i, animated: false }), 60);
        }}
      />

      <View style={styles.legend}>
        <LegendItem icon={<KindBadge kind="trash" size={24} glyphRatio={0.68} />} label="Trash" />
        <LegendItem
          icon={<KindBadge kind="recycling" size={24} glyphRatio={0.68} />}
          label="Recycling"
        />
        <LegendItem icon={<KindBadge kind="bulk" size={24} glyphRatio={0.68} />} label="Bulk" />
      </View>
    </View>
  );
}

function LegendItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.legendItem}>
      {icon}
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    marginHorizontal: CARD_MARGIN,
    borderRadius: radius.lg,
    paddingVertical: space(3),
    ...shadow.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(4),
    paddingBottom: space(2),
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnPressed: { backgroundColor: colors.mint },
  monthLabel: { ...typography.title, color: colors.ink },
  dowRow: { flexDirection: 'row', paddingBottom: space(1) },
  dowText: {
    ...typography.tiny,
    color: colors.inkFaint,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: space(1),
    borderRadius: radius.sm,
  },
  cellPressed: { backgroundColor: colors.mint },
  dayPill: {
    minWidth: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dayPillToday: { backgroundColor: colors.teal },
  dayText: { fontSize: 14, fontWeight: '500', color: colors.ink },
  dayTextMuted: { color: colors.inkFaint, opacity: 0.55 },
  dayTextToday: { color: colors.white, fontWeight: '700' },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    minHeight: 22,
  },
  marker: { marginHorizontal: 1 },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space(5),
    paddingTop: space(3),
    marginTop: space(1),
    marginHorizontal: space(4),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  legendText: { ...typography.small, color: colors.inkSoft },
});
