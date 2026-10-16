import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, spacing, typography, useTheme, Theme } from '../theme';
import { formatBytes, formatSpeed, formatEta } from '../utils/chunking';

interface ProgressBarProps {
  percentage: number;
  completedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  etaSeconds: number;
  statusText?: string;
}

/** Gradient progress meter with byte and speed readouts. */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  completedBytes,
  totalBytes,
  speedBytesPerSec,
  etaSeconds,
  statusText,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.statusText} numberOfLines={1}>
          {statusText || 'Transferring…'}
        </Text>
        <Text style={styles.percentageText}>{clampedPercentage}%</Text>
      </View>

      <View style={styles.track}>
        {clampedPercentage > 0 && (
          <View style={[styles.fillWrap, { width: `${clampedPercentage}%` }]}>
            <LinearGradient
              colors={theme.colors.accentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fill}
            />
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <Text style={styles.bytesText}>
          {formatBytes(completedBytes)} / {formatBytes(totalBytes)}
        </Text>
        <Text style={styles.speedText}>{formatSpeed(speedBytesPerSec)}</Text>
      </View>

      {etaSeconds > 0 && clampedPercentage < 100 && (
        <Text style={styles.etaText}>{formatEta(etaSeconds)} remaining</Text>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) => {
  const c = theme.colors;
  return StyleSheet.create({
    container: {
      marginVertical: spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    statusText: {
      ...typography.label,
      color: c.textSecondary,
      flexShrink: 1,
    },
    percentageText: {
      ...typography.label,
      color: c.textPrimary,
      marginLeft: spacing.sm,
      fontVariant: ['tabular-nums'],
    },
    track: {
      height: 8,
      backgroundColor: c.inputBg,
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    fillWrap: {
      height: '100%',
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    fill: {
      flex: 1,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    bytesText: {
      ...typography.caption,
      color: c.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    speedText: {
      ...typography.caption,
      color: c.success,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    etaText: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: spacing.xs,
      textAlign: 'right',
    },
  });
};
