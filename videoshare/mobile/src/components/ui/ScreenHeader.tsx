import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { hairlineWidth, radius, spacing, typography, useTheme } from '../../theme';
import { Icon } from './Icon';

interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  /** Rendered at the trailing edge (icon buttons, badges…). */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Compact circular glass button used for header actions. */
export const GlassIconButton: React.FC<{
  name: React.ComponentProps<typeof Icon>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
}> = ({ name, onPress, accessibilityLabel, size = 40 }) => {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.surface,
          borderColor: c.surfaceBorder,
          borderWidth: hairlineWidth,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon name={name} size={size * 0.5} color={c.textPrimary} />
    </Pressable>
  );
};

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  onBack,
  right,
  style,
}) => {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.leading}>
        {onBack && (
          <GlassIconButton name="back" onPress={onBack} accessibilityLabel="Go back" />
        )}
        {(title || subtitle) && (
          <View style={[styles.titleBlock, onBack ? { marginLeft: spacing.md } : null]}>
            {title && (
              <Text numberOfLines={1} style={[typography.heading, { color: c.textPrimary }]}>
                {title}
              </Text>
            )}
            {subtitle && (
              <Text
                numberOfLines={1}
                style={[typography.caption, { color: c.textSecondary, marginTop: 1 }]}
              >
                {subtitle}
              </Text>
            )}
          </View>
        )}
      </View>
      {right ? <View style={styles.trailing}>{right}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  leading: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  titleBlock: {
    flexShrink: 1,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
