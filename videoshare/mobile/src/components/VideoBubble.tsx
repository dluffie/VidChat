import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from './ProgressBar';
import { GlassCard, GradientButton, Icon, Pill } from './ui';
import { radius, spacing, typography, useTheme, Theme } from '../theme';
import { TransferProgress } from '../types/transfers';
import { formatBytes } from '../utils/chunking';

interface VideoBubbleProps {
  progress: TransferProgress;
  isSelf: boolean;
  onPlay?: (filePath: string) => void;
  onCancel?: (transferId: string) => void;
  onResume?: (transferId: string) => void;
  onViewDetails?: (transferId: string) => void;
}

/** In-chat card representing a video transfer, in either direction. */
export const VideoBubble: React.FC<VideoBubbleProps> = ({
  progress,
  isSelf,
  onPlay,
  onCancel,
  onResume,
  onViewDetails,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const isComplete = progress.status === 'completed';
  const isFailed = progress.status === 'failed';
  const isPaused = progress.status === 'paused';
  const isTransferring =
    progress.status === 'transferring' ||
    progress.status === 'reconstructing' ||
    progress.status === 'verifying';

  const completedBytes = Math.round(
    (progress.completedChunks / Math.max(1, progress.totalChunks)) * progress.fileSize
  );

  const accent = isComplete
    ? theme.colors.success
    : isFailed
      ? theme.colors.danger
      : isPaused
        ? theme.colors.warning
        : theme.colors.accent;

  const statusLabel = isComplete
    ? 'Complete'
    : isFailed
      ? 'Failed'
      : isPaused
        ? 'Paused'
        : progress.status === 'reconstructing'
          ? 'Assembling'
          : progress.status === 'verifying'
            ? 'Verifying'
            : isSelf
              ? 'Sending'
              : 'Receiving';

  return (
    <View style={[styles.container, isSelf ? styles.selfContainer : styles.partnerContainer]}>
      <GlassCard
        tone="elevated"
        corner="lg"
        depth={1}
        style={styles.card}
        glowColor={isTransferring || isComplete ? accent : undefined}
      >
        <View style={styles.header}>
          <View style={[styles.iconTile, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
            <Icon name={isFailed ? 'alert' : 'film'} size={18} color={accent} />
          </View>
          <View style={styles.titleContainer}>
            <Text style={styles.fileName} numberOfLines={1}>
              {progress.fileName}
            </Text>
            <Text style={styles.fileSize}>{formatBytes(progress.fileSize)}</Text>
          </View>
          <Pill
            label={statusLabel}
            tone={
              isComplete
                ? 'success'
                : isFailed
                  ? 'danger'
                  : isPaused
                    ? 'warning'
                    : 'accent'
            }
          />
        </View>

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
                  ? 'Reassembling chunks…'
                  : progress.status === 'verifying'
                    ? 'Verifying fingerprint…'
                    : isSelf
                      ? 'Sending chunks…'
                      : 'Receiving chunks…'
              }
            />
            {onCancel && (
              <GradientButton
                label="Cancel"
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => onCancel(progress.transferId)}
                style={styles.cancelButton}
              />
            )}
          </View>
        )}

        {isPaused && (
          <View style={styles.centeredBox}>
            <Text style={styles.pausedText}>Transfer paused</Text>
            {onResume && (
              <GradientButton
                label="Resume"
                icon="refresh"
                size="sm"
                onPress={() => onResume(progress.transferId)}
              />
            )}
          </View>
        )}

        {isComplete && (
          <View style={styles.completeBox}>
            <View style={styles.badgeRow}>
              <View style={styles.verifiedRow}>
                <Icon name="check" size={13} color={theme.colors.success} />
                <Text style={styles.verifiedBadge}>Verified</Text>
              </View>
              <Text style={styles.shaText}>fingerprint match</Text>
            </View>

            <View style={styles.actionButtons}>
              {onPlay && progress.localFilePath && (
                <GradientButton
                  label="Play"
                  icon="play"
                  size="sm"
                  onPress={() => onPlay(progress.localFilePath!)}
                  style={styles.actionButton}
                />
              )}
              {onViewDetails && (
                <GradientButton
                  label="Details"
                  variant="subtle"
                  size="sm"
                  onPress={() => onViewDetails(progress.transferId)}
                  style={styles.actionButton}
                />
              )}
            </View>
          </View>
        )}

        {isFailed && (
          <View style={styles.failedBox}>
            <Text style={styles.failedText}>Transfer failed</Text>
            {progress.error ? (
              <Text style={styles.errorText} numberOfLines={3}>
                {progress.error}
              </Text>
            ) : null}
          </View>
        )}
      </GlassCard>
    </View>
  );
};

const createStyles = (theme: Theme) => {
  const c = theme.colors;
  return StyleSheet.create({
    container: {
      marginVertical: spacing.xs + 2,
      flexDirection: 'row',
    },
    selfContainer: {
      justifyContent: 'flex-end',
    },
    partnerContainer: {
      justifyContent: 'flex-start',
    },
    card: {
      width: '100%',
      maxWidth: 320,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    iconTile: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    titleContainer: {
      flex: 1,
      marginRight: spacing.sm,
    },
    fileName: {
      ...typography.subheading,
      color: c.textPrimary,
    },
    fileSize: {
      ...typography.caption,
      color: c.textSecondary,
      marginTop: 1,
    },
    progressContainer: {
      marginTop: spacing.xs,
    },
    cancelButton: {
      alignSelf: 'flex-end',
      marginTop: spacing.sm,
    },
    centeredBox: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    pausedText: {
      ...typography.label,
      color: c.warning,
    },
    completeBox: {
      marginTop: spacing.sm,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    verifiedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    verifiedBadge: {
      ...typography.label,
      color: c.success,
      marginLeft: spacing.xs,
    },
    shaText: {
      ...typography.caption,
      color: c.textMuted,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    actionButton: {
      flex: 1,
    },
    failedBox: {
      marginTop: spacing.sm,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
      alignItems: 'center',
    },
    failedText: {
      ...typography.label,
      color: c.danger,
    },
    errorText: {
      ...typography.caption,
      color: c.textSecondary,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
  });
};
