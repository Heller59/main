import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CouchIcon, RecycleIcon, TrashIcon } from '../icons';
import type { EventKind } from '../lib/schedule';
import { colors } from '../theme';

const TINT: Record<EventKind, string> = {
  trash: colors.trashSoft,
  recycling: colors.recycleSoft,
  bulk: colors.bulkSoft,
};

function Glyph({ kind, size }: { kind: EventKind; size: number }) {
  if (kind === 'trash') return <TrashIcon size={size} />;
  if (kind === 'recycling') return <RecycleIcon size={size} />;
  return <CouchIcon size={size} />;
}

interface Props {
  kind: EventKind;
  size?: number;
  /** Icon size as a fraction of the badge; small badges need a larger share. */
  glyphRatio?: number;
}

/** A collection icon on its rounded, softly tinted background. */
export default function KindBadge({ kind, size = 42, glyphRatio = 0.52 }: Props) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: TINT[kind], width: size, height: size, borderRadius: size * 0.29 },
      ]}
    >
      <Glyph kind={kind} size={size * glyphRatio} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
});
