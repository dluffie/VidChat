import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { elevation, glow, hairlineWidth, radius, spacing, useTheme } from '../../theme';

interface GlassCardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** `elevated` is the brighter glass used for raised or active surfaces. */
  tone?: 'base' | 'elevated';
  /** Applies default inner padding. */
  padded?: boolean;
  /** Renders a coloured halo (primary CTAs, active transfer cards). */
  glowColor?: string;
  glowLevel?: 1 | 2;
  corner?: keyof typeof radius;
  /** Skips the top specular sheen (useful for very short cards). */
  flat?: boolean;
  /** Standard drop shadow. */
  depth?: 0 | 1 | 2 | 3;
}

/**
 * The core surface of the design language: a translucent pane with a hairline
 * border, a top-edge highlight and an optional coloured glow.
 *
 * The shadow lives on an outer view and the clipping on an inner one, because
 * `overflow: hidden` (needed to clip the sheen to the rounded corner) also
 * clips the shadow on both platforms.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  contentStyle,
  tone = 'base',
  padded = true,
  glowColor,
  glowLevel = 1,
  corner = 'lg',
  flat = false,
  depth = 1,
}) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const borderRadius = radius[corner];

  return (
    <View
      style={[
        { borderRadius },
        elevation(depth, c.shadowColor),
        glowColor ? glow(glowColor, glowLevel) : null,
        style,
      ]}
    >
      <View
        style={{
          borderRadius,
          borderWidth: hairlineWidth,
          borderColor: c.surfaceBorder,
          backgroundColor: tone === 'elevated' ? c.surfaceElevated : c.surface,
          overflow: 'hidden',
        }}
      >
        {!flat && (
          <LinearGradient
            pointerEvents="none"
            colors={[c.surfaceHighlight, 'rgba(255,255,255,0)']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.55, y: 1 }}
            style={[StyleSheet.absoluteFill, { height: '58%' }]}
          />
        )}
        <View style={[padded && { padding: spacing.lg }, contentStyle]}>{children}</View>
      </View>
    </View>
  );
};
