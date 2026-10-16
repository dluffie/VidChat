import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { glow as glowStyle, radius, spacing, typography, useTheme } from '../../theme';
import { Icon, IconName } from './Icon';

export type ButtonVariant = 'primary' | 'ghost' | 'subtle' | 'warm' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  iconRight?: IconName;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const HEIGHTS: Record<ButtonSize, number> = { sm: 40, md: 52, lg: 58 };

export const GradientButton: React.FC<GradientButtonProps> = ({
  label,
  onPress,
  icon,
  iconRight,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
}) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const height = HEIGHTS[size];
  const inactive = disabled || loading;

  const isGradient = variant === 'primary' || variant === 'warm';
  const gradientColors: [string, string] =
    variant === 'warm' ? [c.warm, c.accent] : c.accentGradient;

  const fill =
    variant === 'primary' || variant === 'warm'
      ? null
      : variant === 'danger'
        ? c.danger
        : variant === 'subtle'
          ? c.surfaceElevated
          : 'transparent';

  const textColor =
    variant === 'primary' || variant === 'warm' || variant === 'danger'
      ? c.onAccent
      : c.textPrimary;

  const borderColor =
    variant === 'ghost' || variant === 'subtle' ? c.surfaceBorder : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height,
          borderRadius: radius.pill,
          opacity: inactive ? 0.45 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed && !inactive ? 0.985 : 1 }],
        },
        isGradient && !inactive ? glowStyle(c.accent, 1) : null,
        { alignSelf: fullWidth ? 'stretch' : 'flex-start' },
        style,
      ]}
    >
      <View
        style={[
          styles.inner,
          {
            height,
            borderRadius: radius.pill,
            borderWidth: borderColor === 'transparent' ? 0 : 0.8,
            borderColor,
            backgroundColor: fill ?? 'transparent',
            paddingHorizontal: spacing.xl,
          },
        ]}
      >
        {isGradient && (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]}
          />
        )}
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : (
          <>
            {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} color={textColor} />}
            <Text
              numberOfLines={1}
              style={[
                typography.subheading,
                {
                  color: textColor,
                  marginLeft: icon ? spacing.sm : 0,
                  marginRight: iconRight ? spacing.sm : 0,
                },
              ]}
            >
              {label}
            </Text>
            {iconRight && (
              <Icon name={iconRight} size={size === 'sm' ? 16 : 18} color={textColor} />
            )}
          </>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
