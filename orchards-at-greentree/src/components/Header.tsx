import React from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeArea } from '../lib/useSafeArea';
import { BellIcon, GearIcon, TreeMark } from '../icons';
import { colors, radius, space, typography } from '../theme';

interface Props {
  community: string;
  subtitle: string;
  notificationsOn: boolean;
  onOpenSettings: () => void;
}

export default function Header({
  community,
  subtitle,
  notificationsOn,
  onOpenSettings,
}: Props) {
  const { top } = useSafeArea();

  return (
    <View style={[styles.band, { paddingTop: top + space(3) }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.teal} />
      <View style={styles.row}>
        <View style={styles.mark}>
          <TreeMark size={30} color={colors.white} />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {community}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>

        <Pressable
          onPress={onOpenSettings}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            notificationsOn ? 'Reminders are on. Open settings' : 'Reminders are off. Open settings'
          }
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <BellIcon size={21} active={notificationsOn} />
        </Pressable>

        <Pressable
          onPress={onOpenSettings}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <GearIcon size={21} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: colors.teal,
    paddingHorizontal: space(4),
    paddingBottom: space(4),
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  mark: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: { flex: 1, marginLeft: space(1) },
  title: {
    ...typography.display,
    fontSize: 19,
    color: colors.white,
  },
  subtitle: {
    ...typography.small,
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 1,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: { backgroundColor: 'rgba(255,255,255,0.18)' },
});
