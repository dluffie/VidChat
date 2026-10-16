import React from 'react';
import { StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';

/**
 * Soft light bloom.
 *
 * React Native has no radial gradient, so a smooth halo is built by stacking
 * concentric translucent discs. At low opacity the stepping is imperceptible
 * and it is far cheaper (and far more reliable on Android 11) than a real
 * backdrop blur.
 */
const Bloom: React.FC<{
  color: string;
  size: number;
  opacity: number;
  rings?: number;
  style?: ViewStyle;
}> = ({ color, size, opacity, rings = 9, style }) => (
  <View pointerEvents="none" style={[{ width: size, height: size }, styles.center, style]}>
    {Array.from({ length: rings }).map((_, i) => {
      const ringSize = size * (1 - i / (rings + 1));
      return (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            backgroundColor: color,
            opacity: opacity / rings,
          }}
        />
      );
    })}
  </View>
);

/**
 * Full-screen canvas: a vertical gradient wash plus three floating light
 * blooms. Every screen renders this behind its content.
 */
export const AuroraBackground: React.FC = () => {
  const { theme, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const c = theme.colors;

  const unit = Math.max(width, height);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={c.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Bloom
        color={c.auroraA}
        size={unit * 1.05}
        opacity={c.auroraOpacity}
        style={{ top: -unit * 0.42, left: -unit * 0.3 }}
      />
      <Bloom
        color={c.auroraB}
        size={unit * 0.92}
        opacity={c.auroraOpacity * 0.8}
        style={{ top: height * 0.16, right: -unit * 0.36 }}
      />
      <Bloom
        color={c.auroraC}
        size={unit * 0.8}
        opacity={c.auroraOpacity * 0.45}
        style={{ bottom: -unit * 0.34, left: -unit * 0.2 }}
      />

      {/* Specular sheen so the canvas itself reads as a pane of glass. */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.01)', 'rgba(255,255,255,0)']
            : ['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.25)', 'rgba(255,255,255,0)']
        }
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={[StyleSheet.absoluteFill, { height: height * 0.55 }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
