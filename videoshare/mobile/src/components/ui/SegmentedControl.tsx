import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { hairlineWidth, radius, spacing, typography, useTheme } from '../../theme';
import { Icon, IconName } from './Icon';

export interface SegmentOption {
  value: string;
  label: string;
  icon?: IconName;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  style?: StyleProp<ViewStyle>;
  /** Stretch options to fill the width evenly. */
  fill?: boolean;
}

/** Glass segmented control with a gradient plate behind the active option. */
export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  style,
  fill = true,
}) => {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: c.surface, borderColor: c.surfaceBorder },
        style,
      ]}
    >
      {options.map((option) => {
        const active = option.value === value;
        const content = (
          <>
            {active && (
              <LinearGradient
                colors={c.accentGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: radius.md - 3 }]}
              />
            )}
            {option.icon && (
              <Icon
                name={option.icon}
                size={15}
                color={active ? c.onAccent : c.textSecondary}
              />
            )}
            <Text
              numberOfLines={1}
              style={[
                typography.label,
                {
                  color: active ? c.onAccent : c.textSecondary,
                  marginLeft: option.icon ? spacing.xs + 2 : 0,
                },
              ]}
            >
              {option.label}
            </Text>
          </>
        );

        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              fill && { flex: 1 },
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            {content}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.md,
    borderWidth: hairlineWidth,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md - 3,
    overflow: 'hidden',
  },
});
