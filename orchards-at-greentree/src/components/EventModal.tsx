import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CloseIcon, CouchIcon, RecycleIcon, TrashIcon } from '../icons';
import { fmtLong, relativeLabel } from '../lib/dates';
import type { CollectionEvent, EventKind } from '../lib/schedule';
import { colors, radius, shadow, space, typography } from '../theme';

const TINT: Record<EventKind, string> = {
  trash: colors.trashSoft,
  recycling: colors.recycleSoft,
  bulk: colors.bulkSoft,
};

function KindBadge({ kind }: { kind: EventKind }) {
  return (
    <View style={[styles.badge, { backgroundColor: TINT[kind] }]}>
      {kind === 'trash' ? (
        <TrashIcon size={22} />
      ) : kind === 'recycling' ? (
        <RecycleIcon size={22} />
      ) : (
        <CouchIcon size={22} />
      )}
    </View>
  );
}

interface Props {
  visible: boolean;
  date: string | null;
  events: CollectionEvent[];
  onClose: () => void;
}

export default function EventModal({ visible, date, events, onClose }: Props) {
  // A day with nothing scheduled never opens this, but guard anyway.
  if (!date || events.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.date}>{fmtLong(date)}</Text>
              <Text style={styles.relative}>{relativeLabel(date)}</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [styles.close, pressed && { backgroundColor: colors.mintDeep }]}
            >
              <CloseIcon />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {events.map((e) => (
              <View key={e.id} style={styles.row}>
                <KindBadge kind={e.kind} />
                <View style={styles.rowBody}>
                  <Text style={styles.title}>{e.title}</Text>
                  <Text style={styles.note}>{e.note}</Text>
                  {e.detail ? <Text style={styles.detail}>{e.detail}</Text> : null}
                </View>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(46, 79, 75, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: space(6),
  },
  sheet: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: space(5),
    ...shadow.lift,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: space(4),
  },
  date: { ...typography.title, color: colors.ink },
  relative: { ...typography.small, color: colors.teal, marginTop: 2, fontWeight: '600' },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: space(3),
    paddingVertical: space(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  badge: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  title: { ...typography.heading, color: colors.ink, marginBottom: 3 },
  note: { ...typography.small, color: colors.inkSoft, lineHeight: 19 },
  detail: { ...typography.small, color: colors.teal, marginTop: 4, lineHeight: 19 },
});
