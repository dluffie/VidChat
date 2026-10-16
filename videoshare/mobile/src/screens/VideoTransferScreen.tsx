import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeScreen } from '../components/SafeScreen';
import {
  Divider,
  GlassCard,
  GlassIconButton,
  Icon,
  InfoRow,
  Pill,
  SectionLabel,
} from '../components/ui';
import { radius, spacing, typography, useTheme, Theme } from '../theme';
import { useTransferStore } from '../store/transferStore';
import { formatBytes, formatSpeed } from '../utils/chunking';
import { calculateEncodedSize, calculateOverheadRatio } from '../utils/encoding';
import { useVideoPlayer, VideoView } from 'expo-video';

interface VideoTransferScreenProps {
  route: any;
  navigation: any;
}

export const VideoTransferScreen: React.FC<VideoTransferScreenProps> = ({ route, navigation }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { transferId } = route.params || {};
  const { transfers } = useTransferStore();
  const transfer = transfers[transferId];

  // expo-video: the player must be created unconditionally (Rules of Hooks).
  // It stays empty until a completed transfer supplies a local file path.
  const videoSource =
    transfer && transfer.status === 'completed' && transfer.localFilePath
      ? transfer.localFilePath
      : null;

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = false;
  });

  if (!transfer) {
    return (
      <SafeScreen>
        <View style={styles.centerScreen}>
          <GlassIconButton name="back" accessibilityLabel="Go back" onPress={() => navigation.goBack()} />
          <Text style={styles.notFoundText}>Transfer session not found</Text>
        </View>
      </SafeScreen>
    );
  }

  const encodedSize = calculateEncodedSize(transfer.fileSize);
  const overheadRatio = calculateOverheadRatio(transfer.fileSize, encodedSize);
  const isVerified = transfer.status === 'completed';
  const hasPlayableFile = isVerified && !!transfer.localFilePath;

  return (
    <SafeScreen>
      <View style={styles.headerRow}>
        <GlassIconButton
          name="back"
          accessibilityLabel="Back to chat"
          onPress={() => navigation.goBack()}
        />
        <Text style={styles.headerTitle} numberOfLines={1}>
          Transfer details
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Media surface — the one place that stays black, so video looks right. */}
        <View style={styles.mediaBox}>
          {hasPlayableFile ? (
            <VideoView
              player={player}
              style={styles.videoPlayer}
              contentFit="contain"
              nativeControls
              fullscreenOptions={{ enable: true }}
            />
          ) : (
            <View style={styles.mediaPlaceholder}>
              <View style={styles.mediaIconRing}>
                <Icon
                  name={transfer.status === 'failed' ? 'alert' : 'film'}
                  size={26}
                  color={isVerified ? theme.colors.success : theme.colors.textSecondary}
                />
              </View>
              <Text style={styles.mediaTitle} numberOfLines={2}>
                {transfer.fileName}
              </Text>
              <Text style={styles.mediaMeta}>{formatBytes(transfer.fileSize)}</Text>
            </View>
          )}
        </View>

        {/* Verification banner */}
        <GlassCard
          corner="lg"
          depth={1}
          glowColor={isVerified ? theme.colors.success : undefined}
        >
          <View style={styles.bannerRow}>
            <View
              style={[
                styles.bannerIcon,
                {
                  backgroundColor: isVerified
                    ? 'rgba(74,222,128,0.16)'
                    : theme.colors.accentSoft,
                },
              ]}
            >
              <Icon
                name={isVerified ? 'check' : 'clock'}
                size={16}
                color={isVerified ? theme.colors.success : theme.colors.accent}
              />
            </View>
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle}>
                {isVerified
                  ? 'Integrity verified'
                  : transfer.status === 'failed'
                    ? 'Transfer failed'
                    : 'Verifying…'}
              </Text>
              <Text style={styles.bannerSubtitle}>
                {isVerified
                  ? 'Every chunk hash matched and the reassembled length is exact.'
                  : transfer.status === 'failed'
                    ? transfer.error || 'The transfer could not be completed.'
                    : 'Chunks are validated individually as they arrive.'}
              </Text>
            </View>
            <Pill
              label={transfer.status}
              tone={
                isVerified
                  ? 'success'
                  : transfer.status === 'failed'
                    ? 'danger'
                    : 'accent'
              }
            />
          </View>
        </GlassCard>

        {/* Transport metrics */}
        <SectionLabel style={styles.sectionGap}>Transport</SectionLabel>
        <GlassCard corner="lg" depth={1}>
          <InfoRow label="Original size" value={`${formatBytes(transfer.fileSize)}`} />
          <Divider style={styles.tightDivider} />
          <InfoRow label="Base64 payload" value={`${formatBytes(encodedSize)}`} />
          <Divider style={styles.tightDivider} />
          <InfoRow label="Representation ratio" value={`${overheadRatio}x`} />
          <Divider style={styles.tightDivider} />
          <InfoRow label="Chunks" value={`${transfer.totalChunks}`} />
          <Divider style={styles.tightDivider} />
          <InfoRow
            label="Average speed"
            value={transfer.speedBytesPerSec > 0 ? formatSpeed(transfer.speedBytesPerSec) : '—'}
            valueColor={theme.colors.success}
          />
          <Divider style={styles.tightDivider} />
          <InfoRow
            label="Progress"
            value={`${transfer.completedChunks} / ${transfer.totalChunks}`}
          />
        </GlassCard>

        <SectionLabel style={styles.sectionGap}>Fingerprint</SectionLabel>
        <GlassCard corner="lg" depth={1} tone="base">
          <Text style={styles.hashLabel}>
            SHA-256 of file name, size, chunk count and chunk size
          </Text>
          <Text style={styles.hashValue} selectable>
            {transfer.checksum}
          </Text>
        </GlassCard>
      </ScrollView>
    </SafeScreen>
  );
};

const createStyles = (theme: Theme) => {
  const c = theme.colors;
  return StyleSheet.create({
    centerScreen: {
      flex: 1,
      alignItems: 'center',
      paddingTop: spacing.xxl,
    },
    notFoundText: {
      ...typography.body,
      color: c.textSecondary,
      marginTop: spacing.xl,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    headerTitle: {
      ...typography.subheading,
      color: c.textPrimary,
      flex: 1,
      textAlign: 'center',
      marginHorizontal: spacing.md,
    },
    headerSpacer: {
      width: 40,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: spacing.xxxl,
      gap: spacing.md,
    },
    mediaBox: {
      height: 220,
      borderRadius: radius.xl,
      overflow: 'hidden',
      backgroundColor: theme.mode === 'dark' ? '#05070C' : '#0B0F18',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.surfaceBorder,
    },
    videoPlayer: {
      width: '100%',
      height: 220,
    },
    mediaPlaceholder: {
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
    },
    mediaIconRing: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.14)',
      marginBottom: spacing.md,
    },
    mediaTitle: {
      ...typography.subheading,
      color: '#F4F6FB',
      textAlign: 'center',
    },
    mediaMeta: {
      ...typography.caption,
      color: 'rgba(244,246,251,0.55)',
      marginTop: spacing.xs,
    },
    bannerRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    bannerIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    bannerText: {
      flex: 1,
      marginRight: spacing.sm,
    },
    bannerTitle: {
      ...typography.subheading,
      color: c.textPrimary,
    },
    bannerSubtitle: {
      ...typography.caption,
      color: c.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    sectionGap: {
      marginTop: spacing.lg,
    },
    tightDivider: {
      marginVertical: spacing.xs + 1,
    },
    hashLabel: {
      ...typography.caption,
      color: c.textMuted,
      marginBottom: spacing.sm,
    },
    hashValue: {
      ...typography.mono,
      color: c.accentAlt,
    },
  });
};
