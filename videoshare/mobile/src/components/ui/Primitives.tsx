import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

/**
 * Indeterminate progress: a gradient segment sweeping along a track.
 *
 * Used while waiting on something that reports no progress at all — notably the
 * document and image pickers, which copy an entire video into the app cache
 * *before* their promise resolves. A determinate bar cannot honestly be drawn
 * there, and a bare spinner reads as "hung" during a multi-minute wait on a
 * 2 GB file.
 */
export const IndeterminateBar: React.FC<{
  height?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ height = 8, style }) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const progress = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const segment = Math.max(72, trackWidth * 0.34);

  return (
    <View
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
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
      <Animated.View
        style={{
          width: segment,
          height: '100%',
          borderRadius: height / 2,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-segment, trackWidth || segment * 2],
              }),
            },
          ],
        }}
      >
        <LinearGradient
          colors={c.accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
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
