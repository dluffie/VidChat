import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ProgressBar } from './ProgressBar.js';
import { TransferProgress } from '../types/transfers.js';
import { formatBytes } from '../utils/chunking.js';

interface VideoBubbleProps {
  progress: TransferProgress;
  isSelf: boolean;
  onPlay?: (filePath: string) => void;
  onCancel?: (transferId: string) => void;
  onResume?: (transferId: string) => void;
  onViewDetails?: (transferId: string) => void;
}

export const VideoBubble: React.FC<VideoBubbleProps> = ({
  progress,
  isSelf,
  onPlay,
  onCancel,
  onResume,
  onViewDetails,
}) => {
  const isComplete = progress.status === 'completed';
  const isFailed = progress.status === 'failed';
  const isPaused = progress.status === 'paused';
  const isTransferring = progress.status === 'transferring' || progress.status === 'reconstructing' || progress.status === 'verifying';

  const completedBytes = Math.round((progress.completedChunks / progress.totalChunks) * progress.fileSize);

  return (
    <View style={[styles.container, isSelf ? styles.selfContainer : styles.partnerContainer]}>
      <View style={[styles.card, isSelf ? styles.selfCard : styles.partnerCard]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.icon}>🎥</Text>
          <View style={styles.titleContainer}>
            <Text style={styles.fileName} numberOfLines={1}>
              {progress.fileName}
            </Text>
            <Text style={styles.fileSize}>{formatBytes(progress.fileSize)}</Text>
          </View>
        </View>

        {/* Transfer in progress */}
        {isTransferring && (
          <View style={styles.progressContainer}>
            <ProgressBar
              percentage={progress.percentage}
              completedBytes={completedBytes}
              totalBytes={progress.fileSize}
              speedBytesPerSec={progress.speedBytesPerSec}
              etaSeconds={progress.etaSeconds}
              statusText={
                progress.status === 'reconstructing'
                  ? 'Reassembling chunks...'
                  : progress.status === 'verifying'
                  ? 'Verifying SHA-256...'
                  : isSelf
                  ? 'Sending chunks...'
                  : 'Receiving chunks...'
              }
            />
            {onCancel && (
              <TouchableOpacity
                onPress={() => onCancel(progress.transferId)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Transfer Paused */}
        {isPaused && (
          <View style={styles.statusBox}>
            <Text style={styles.pausedText}>Transfer Paused</Text>
            {onResume && (
              <TouchableOpacity
                onPress={() => onResume(progress.transferId)}
                style={styles.resumeButton}
              >
                <Text style={styles.resumeText}>Resume Transfer</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Verified & Complete */}
        {isComplete && (
          <View style={styles.completeBox}>
            <View style={styles.badgeRow}>
              <Text style={styles.verifiedBadge}>✓ Verified</Text>
              <Text style={styles.shaText}>SHA-256 Match</Text>
            </View>

            <View style={styles.actionButtons}>
              {onPlay && progress.localFilePath && (
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={() => onPlay(progress.localFilePath!)}
                >
                  <Text style={styles.playButtonText}>▶ Play</Text>
                </TouchableOpacity>
              )}

              {onViewDetails && (
                <TouchableOpacity
                  style={styles.detailsButton}
                  onPress={() => onViewDetails(progress.transferId)}
                >
                  <Text style={styles.detailsButtonText}>📊 Metrics</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Failed */}
        {isFailed && (
          <View style={styles.failedBox}>
            <Text style={styles.failedText}>Transfer Failed</Text>
            {progress.error && <Text style={styles.errorText}>{progress.error}</Text>}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
  },
  selfContainer: {
    justifyContent: 'flex-end',
  },
  partnerContainer: {
    justifyContent: 'flex-start',
  },
  card: {
    width: 270,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  selfCard: {
    backgroundColor: '#064E3B', // Dark emerald
    borderColor: '#059669',
    borderBottomRightRadius: 2,
  },
  partnerCard: {
    backgroundColor: '#1E293B', // Slate
    borderColor: '#334155',
    borderBottomLeftRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 26,
    marginRight: 10,
  },
  titleContainer: {
    flex: 1,
  },
  fileName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: 'bold',
  },
  fileSize: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 4,
  },
  cancelButton: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  cancelText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBox: {
    marginVertical: 8,
    alignItems: 'center',
  },
  pausedText: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  resumeButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  resumeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  completeBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  verifiedBadge: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 14,
  },
  shaText: {
    color: '#64748B',
    fontSize: 11,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  playButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  playButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  detailsButton: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  detailsButtonText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 13,
  },
  failedBox: {
    marginTop: 8,
    alignItems: 'center',
  },
  failedText: {
    color: '#EF4444',
    fontWeight: 'bold',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
});
