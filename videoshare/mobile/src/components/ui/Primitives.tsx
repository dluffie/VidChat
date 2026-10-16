import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { hairlineWidth, radius, spacing, typography, useTheme } from '../../theme';

/** Small uppercase section label. */
export const SectionLabel: React.FC<{
  children: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, right, style }) => {
  const { theme } = useTheme();
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={[typography.overline, { color: theme.colors.textMuted }]}>{children}</Text>
      {right}
    </View>
  );
};

/** Key/value row used inside cards. */
export const InfoRow: React.FC<{
  label: string;
  value: string;
  valueColor?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ label, value, valueColor, style }) => {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.infoRow, style]}>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[typography.label, { color: valueColor ?? c.textPrimary, marginLeft: spacing.md }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
};

export const Divider: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const { theme } = useTheme();
  return (
    <View
      style={[
        { height: hairlineWidth, backgroundColor: theme.colors.divider, marginVertical: spacing.md },
        style,
      ]}
    />
  );
};

/** Pulsing-free status dot; colour carries the meaning. */
export const StatusDot: React.FC<{ color: string; size?: number; style?: StyleProp<ViewStyle> }> = ({
  color,
  size = 8,
  style,
}) => (
  <View
    style={[
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      },
      style,
    ]}
  />
);

/** Rounded progress track + gradient fill, used across transfer surfaces. */
export const ProgressTrack: React.FC<{
  value: number;
  height?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}> = ({ value, height = 6, color, style }) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View
      style={[
        {
          height,
          borderRadius: height / 2,
          backgroundColor: c.inputBg,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color ?? c.accent,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
});

export const miscStyles = StyleSheet.create({
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  chipGroupItem: {
    margin: spacing.xs,
    borderRadius: radius.md,
  },
});
