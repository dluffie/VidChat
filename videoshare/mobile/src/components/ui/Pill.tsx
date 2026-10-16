import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { hairlineWidth, radius, spacing, typography, useTheme } from '../../theme';
import { Icon, IconName } from './Icon';

export type PillTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'warm';

interface PillProps {
  label: string;
  icon?: IconName;
  tone?: PillTone;
  style?: StyleProp<ViewStyle>;
}

/** Small status chip. Colour is driven by tone, never by the caller. */
export const Pill: React.FC<PillProps> = ({ label, icon, tone = 'neutral', style }) => {
  const { theme } = useTheme();
  const c = theme.colors;

  const toneColor: Record<PillTone, string> = {
    neutral: c.textSecondary,
    accent: c.accent,
    success: c.success,
    warning: c.warning,
    danger: c.danger,
    info: c.info,
    warm: c.warm,
  };

  const color = toneColor[tone];
  const background =
    tone === 'neutral' ? c.surface : 'transparent';

  return (
    <View
      style={[
        styles.pill,
        {
          borderColor: tone === 'neutral' ? c.surfaceBorder : color,
          backgroundColor: background,
          opacity: tone === 'neutral' ? 1 : 0.98,
        },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={12} color={color} />}
      <Text
        style={[
          typography.caption,
          { color, marginLeft: icon ? spacing.xs + 1 : 0, letterSpacing: 0.2 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: hairlineWidth,
  },
});
