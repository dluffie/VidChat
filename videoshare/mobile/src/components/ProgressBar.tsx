import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatBytes, formatSpeed, formatEta } from '../utils/chunking.js';

interface ProgressBarProps {
  percentage: number;
  completedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  etaSeconds: number;
  statusText?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  completedBytes,
  totalBytes,
  speedBytesPerSec,
  etaSeconds,
  statusText,
}) => {
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.statusText}>{statusText || 'Transferring...'}</Text>
        <Text style={styles.percentageText}>{clampedPercentage}%</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clampedPercentage}%` }]} />
      </View>

      <View style={styles.statsRow}>
        <Text style={styles.bytesText}>
          {formatBytes(completedBytes)} / {formatBytes(totalBytes)}
        </Text>
        <Text style={styles.speedText}>{formatSpeed(speedBytesPerSec)}</Text>
      </View>

      {etaSeconds > 0 && clampedPercentage < 100 && (
        <Text style={styles.etaText}>{formatEta(etaSeconds)}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  percentageText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: 'bold',
  },
  track: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#0EA5E9',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  bytesText: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  speedText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  etaText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    textAlign: 'right',
  },
});
