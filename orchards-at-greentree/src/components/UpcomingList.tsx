import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CouchIcon, RecycleIcon, TrashIcon } from '../icons';
import { MONTHS, fmtLong, fmtShort, parseISO, relativeLabel } from '../lib/dates';
import type { CollectionEvent, EventKind } from '../lib/schedule';
import { colors, radius, shadow, space, typography } from '../theme';

const TINT: Record<EventKind, string> = {
  trash: colors.trashSoft,
  recycling: colors.recycleSoft,
  bulk: colors.bulkSoft,
};

function Glyph({ kind, size = 22 }: { kind: EventKind; size?: number }) {
  if (kind === 'trash') return <TrashIcon size={size} />;
  if (kind === 'recycling') return <RecycleIcon size={size} />;
  return <CouchIcon size={size} />;
}

function Badge({ kind, size = 42 }: { kind: EventKind; size?: number }) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: TINT[kind], width: size, height: size, borderRadius: size * 0.29 },
      ]}
    >
      <Glyph kind={kind} size={size * 0.52} />
    </View>
  );
}

/** The prominent "what's next" card, one per collection typography. */
function NextCard({ event }: { event: CollectionEvent }) {
  const soon = relativeLabel(event.markerDate);
  const isImminent = soon === 'Today' || soon === 'Tomorrow';

  return (
    <View style={styles.nextCard}>
      <Badge kind={event.kind} />
      <View style={styles.nextBody}>
        <View style={styles.nextTopRow}>
          <Text style={styles.nextTitle}>{event.title}</Text>
          <View style={[styles.chip, isImminent && styles.chipHot]}>
            <Text style={[styles.chipText, isImminent && styles.chipTextHot]}>{soon}</Text>
          </View>
        </View>
        <Text style={styles.nextDate}>{fmtLong(event.markerDate)}</Text>
        <Text style={styles.nextNote}>{event.note}</Text>
        {event.detail ? <Text style={styles.nextDetail}>{event.detail}</Text> : null}
      </View>
    </View>
  );
}

/** One compact line in the full remaining-dates list. */
function ScheduleRow({ event }: { event: CollectionEvent }) {
  return (
    <View style={styles.row}>
      <Badge kind={event.kind} size={32} />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{event.title}</Text>
        <Text style={styles.rowNote} numberOfLines={2}>
          {event.note}
          {event.detail ? ` ${event.detail}` : ''}
        </Text>
      </View>
      <Text style={styles.rowDate}>{fmtShort(event.markerDate)}</Text>
    </View>
  );
}

interface Props {
  next: CollectionEvent[];
  remaining: CollectionEvent[];
}

export default function UpcomingList({ next, remaining }: Props) {
  // Group the long tail by month so it stays scannable.
  const groups: { key: string; label: string; items: CollectionEvent[] }[] = [];
  for (const e of remaining) {
    const d = parseISO(e.markerDate);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(e);
    else groups.push({ key, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, items: [e] });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionHeading}>Coming up next</Text>
      {next.length > 0 ? (
        next.map((e) => <NextCard key={`next-${e.id}`} event={e} />)
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No collections left this year. Load next year&rsquo;s schedule to see more.
          </Text>
        </View>
      )}

      {groups.length > 0 ? (
        <>
          <Text style={[styles.sectionHeading, { marginTop: space(7) }]}>
            Rest of the schedule
          </Text>
          {groups.map((g) => (
            <View key={g.key} style={styles.group}>
              <Text style={styles.groupLabel}>{g.label}</Text>
              <View style={styles.groupCard}>
                {g.items.map((e, i) => (
                  <View key={e.id} style={i > 0 ? styles.divider : undefined}>
                    <ScheduleRow event={e} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space(4), paddingTop: space(6) },
  sectionHeading: {
    ...typography.heading,
    color: colors.tealDeep,
    marginBottom: space(3),
  },
  badge: { alignItems: 'center', justifyContent: 'center' },

  nextCard: {
    flexDirection: 'row',
    gap: space(3),
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space(4),
    marginBottom: space(3),
    ...shadow.card,
  },
  nextBody: { flex: 1 },
  nextTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space(2),
  },
  nextTitle: { ...typography.heading, color: colors.ink, flexShrink: 1 },
  chip: {
    backgroundColor: colors.mint,
    paddingHorizontal: space(2),
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipHot: { backgroundColor: colors.teal },
  chipText: { ...typography.tiny, color: colors.tealDark },
  chipTextHot: { color: colors.white },
  nextDate: { ...typography.body, color: colors.tealDark, fontWeight: '600', marginTop: 3 },
  nextNote: { ...typography.small, color: colors.inkSoft, marginTop: 4, lineHeight: 19 },
  nextDetail: { ...typography.small, color: colors.teal, marginTop: 3, lineHeight: 19 },

  group: { marginBottom: space(4) },
  groupLabel: {
    ...typography.tiny,
    color: colors.inkFaint,
    marginBottom: space(2),
    letterSpacing: 0.4,
  },
  groupCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: space(3),
    ...shadow.card,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(3),
  },
  rowBody: { flex: 1 },
  rowTitle: { ...typography.small, fontWeight: '700', color: colors.ink },
  rowNote: { ...typography.small, fontSize: 12, color: colors.inkSoft, marginTop: 1, lineHeight: 17 },
  rowDate: { ...typography.small, fontWeight: '700', color: colors.teal },

  empty: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space(5),
    ...shadow.card,
  },
  emptyText: { ...typography.small, color: colors.inkSoft, lineHeight: 20 },
});
