import React from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { CloseIcon, CouchIcon, RecycleIcon, TrashIcon } from '../icons';
import { useSafeArea } from '../lib/useSafeArea';
import { ALL_KINDS, KIND_LABEL, scheduleMeta, type EventKind } from '../lib/schedule';
import { MAX_DAYS_BEFORE, MIN_DAYS_BEFORE, clampDays, leadLabel, type Settings } from '../lib/settings';
import { colors, radius, shadow, space, typography } from '../theme';

function Glyph({ kind }: { kind: EventKind }) {
  if (kind === 'trash') return <TrashIcon size={20} />;
  if (kind === 'recycling') return <RecycleIcon size={20} />;
  return <CouchIcon size={20} />;
}

/** Bulk counts back from the Monday you may start setting items out. */
function anchorHint(kind: EventKind): string {
  return kind === 'bulk' ? 'Before the Monday you can start putting items out' : 'Before pickup day';
}

function Stepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  const btn = (label: string, delta: number, blocked: boolean) => (
    <Pressable
      onPress={() => onChange(clampDays(value + delta))}
      disabled={disabled || blocked}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={delta > 0 ? 'Increase days' : 'Decrease days'}
      style={({ pressed }) => [
        styles.stepBtn,
        (disabled || blocked) && styles.stepBtnOff,
        pressed && !disabled && !blocked && styles.stepBtnPressed,
      ]}
    >
      <Text style={[styles.stepBtnText, (disabled || blocked) && styles.stepBtnTextOff]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.stepper}>
      {btn('\u2212', -1, value <= MIN_DAYS_BEFORE)}
      <Text style={[styles.stepValue, disabled && styles.mutedText]}>{value}</Text>
      {btn('+', 1, value >= MAX_DAYS_BEFORE)}
    </View>
  );
}

interface Props {
  visible: boolean;
  settings: Settings;
  permissionDenied: boolean;
  onClose: () => void;
  onChange: (next: Settings) => void;
}

export default function SettingsScreen({
  visible,
  settings,
  permissionDenied,
  onClose,
  onChange,
}: Props) {
  const { top, bottom } = useSafeArea();
  const on = settings.notificationsEnabled;

  const setDays = (kind: EventKind, days: number) =>
    onChange({ ...settings, daysBefore: { ...settings.daysBefore, [kind]: days } });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: top }]}>
        <View style={styles.bar}>
          <Text style={styles.barTitle}>Settings</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close settings"
            style={({ pressed }) => [styles.close, pressed && { backgroundColor: colors.mintDeep }]}
          >
            <CloseIcon size={22} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: space(4), paddingBottom: bottom + space(10) }}
          showsVerticalScrollIndicator={false}
        >
          {/* Reminders on/off */}
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: space(3) }}>
                <Text style={styles.cardTitle}>Collection reminders</Text>
                <Text style={styles.cardNote}>
                  Get a notification before each trash, recycling and bulk pickup.
                </Text>
              </View>
              <Switch
                value={on}
                onValueChange={(v) => onChange({ ...settings, notificationsEnabled: v })}
                trackColor={{ false: colors.line, true: colors.sage }}
                thumbColor={on ? colors.teal : colors.white}
                ios_backgroundColor={colors.line}
              />
            </View>

            {permissionDenied ? (
              <Pressable onPress={() => Linking.openSettings()} style={styles.warning}>
                <Text style={styles.warningText}>
                  Notifications are blocked for this app. Tap to open your device settings and
                  allow them.
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Lead time per collection type */}
          <Text style={styles.sectionLabel}>When to notify me</Text>
          <View style={styles.card}>
            {ALL_KINDS.map((kind, i) => (
              <View key={kind} style={[styles.leadRow, i > 0 && styles.divider]}>
                <View style={styles.leadIcon}>
                  <Glyph kind={kind} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.leadTitle, !on && styles.mutedText]}>
                    {KIND_LABEL[kind]}
                  </Text>
                  <Text style={[styles.leadValue, !on && styles.mutedText]}>
                    {leadLabel(settings.daysBefore[kind])}
                  </Text>
                  <Text style={styles.leadHint}>{anchorHint(kind)}</Text>
                </View>
                <Stepper
                  value={settings.daysBefore[kind]}
                  onChange={(n) => setDays(kind, n)}
                  disabled={!on}
                />
              </View>
            ))}
          </View>
          <Text style={styles.footnote}>
            Every reminder arrives at 12:00 noon on the day you choose.
          </Text>

          {/* About */}
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.card}>
            <AboutRow label="Regular trash day" value={scheduleMeta.regularTrashDay} />
            <AboutRow label="Township" value={scheduleMeta.township} divider />
            <AboutRow label="Bulk pickup zone" value="Zone 4" divider />
            <AboutRow
              label="Recycling hotline"
              value={scheduleMeta.recyclingHotline}
              divider
              onPress={() => Linking.openURL(`tel:${scheduleMeta.recyclingHotline}`)}
            />
            <AboutRow
              label="HOA website"
              value="orchardsatgreentree.com"
              divider
              onPress={() => Linking.openURL(scheduleMeta.website)}
            />
          </View>
          <Text style={styles.footnote}>
            Dates come from the {scheduleMeta.source}. Always defer to the township if the two
            ever disagree.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function AboutRow({
  label,
  value,
  divider,
  onPress,
}: {
  label: string;
  value: string;
  divider?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <View style={[styles.aboutRow, divider && styles.divider]}>
      <Text style={styles.aboutLabel}>{label}</Text>
      <Text style={[styles.aboutValue, onPress && styles.linkValue]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="link">
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.mint },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(4),
    paddingVertical: space(3),
  },
  barTitle: { ...typography.display, color: colors.ink },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionLabel: {
    ...typography.tiny,
    color: colors.inkFaint,
    marginTop: space(6),
    marginBottom: space(2),
    marginLeft: space(1),
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space(4),
    ...shadow.card,
  },
  cardTitle: { ...typography.heading, color: colors.ink },
  cardNote: { ...typography.small, color: colors.inkSoft, marginTop: 3, lineHeight: 19 },
  switchRow: { flexDirection: 'row', alignItems: 'center' },

  warning: {
    marginTop: space(3),
    backgroundColor: '#FDF0E7',
    borderRadius: radius.md,
    padding: space(3),
  },
  warningText: { ...typography.small, fontSize: 12, color: '#8A4B1F', lineHeight: 18 },

  leadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(3),
  },
  leadIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadTitle: { ...typography.small, fontWeight: '700', color: colors.ink },
  leadValue: { ...typography.small, fontSize: 12, color: colors.teal, marginTop: 1 },
  leadHint: { ...typography.small, fontSize: 11, color: colors.inkFaint, marginTop: 1 },
  mutedText: { color: colors.inkFaint },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPressed: { backgroundColor: colors.mintDeep },
  stepBtnOff: { backgroundColor: colors.line, opacity: 0.5 },
  stepBtnText: { fontSize: 18, fontWeight: '700', color: colors.tealDark, lineHeight: 22 },
  stepBtnTextOff: { color: colors.inkFaint },
  stepValue: { ...typography.title, color: colors.ink, minWidth: 22, textAlign: 'center' },

  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space(3),
    paddingVertical: space(2.5),
  },
  aboutLabel: { ...typography.small, color: colors.inkSoft },
  aboutValue: { ...typography.small, fontWeight: '600', color: colors.ink, flexShrink: 1 },
  linkValue: { color: colors.teal },

  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  footnote: {
    ...typography.small,
    fontSize: 12,
    color: colors.inkFaint,
    marginTop: space(2),
    marginHorizontal: space(1),
    lineHeight: 17,
  },
});
