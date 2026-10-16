import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeScreen } from '../components/SafeScreen';
import { GlassCard, Icon, Pill, ThemePicker } from '../components/ui';
import { radius, spacing, typography, useTheme, Theme } from '../theme';
import { PairingService } from '../services/pairing';
import { WebSocketClient } from '../services/websocket';
import { StorageService } from '../services/storage';
import { VideoTransferService } from '../services/videoTransfer';
import { useConnectionStore } from '../store/connectionStore';
import { DeviceStorageInfo } from '../types/pairing';

interface HomeScreenProps {
  navigation: any;
}

/** Big tappable action card used for the two entry points. */
const ActionCard: React.FC<{
  title: string;
  description: string;
  badge: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  steps: string[];
  gradient: [string, string];
  onPress: () => void;
}> = ({ title, description, badge, icon, steps, gradient, onPress }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.985 : 1 }] }]}
    >
      <GlassCard tone="elevated" corner="xl" depth={2} glowColor={gradient[0]}>
        <View style={styles.cardHeader}>
          <View style={styles.iconTile}>
            <LinearGradient
              colors={gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Icon name={icon} size={22} color={theme.colors.onAccent} />
          </View>
          <Pill label={badge} tone="accent" />
        </View>

        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>

        <View style={styles.steps}>
          {steps.map((step, index) => (
            <React.Fragment key={step}>
              {index > 0 && (
                <Icon name="chevronRight" size={13} color={theme.colors.textMuted} />
              )}
              <Text style={styles.stepText}>{step}</Text>
            </React.Fragment>
          ))}
        </View>
      </GlassCard>
    </Pressable>
  );
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { status, setStatus } = useConnectionStore();
  const [storageInfo, setStorageInfo] = useState<DeviceStorageInfo | null>(null);
  const [isPaired, setIsPaired] = useState<boolean>(false);
  const [link, setLink] = useState(() => VideoTransferService.getLinkInfo());

  useEffect(() => {
    const ws = WebSocketClient.getInstance();
    ws.connect();

    ws.on('connection:change', (data: { status: any }) => {
      setStatus(data.status);
      setLink(VideoTransferService.getLinkInfo());
    });

    StorageService.getStorageInfo().then((info) => {
      setStorageInfo(info);
    });

    const pairingState = PairingService.getPairingState();
    setIsPaired(!!(pairingState.isPaired && pairingState.sessionId));

    // Keep the link-quality readout honest while the user watches the screen.
    const timer = setInterval(() => setLink(VideoTransferService.getLinkInfo()), 4000);
    return () => clearInterval(timer);
  }, [setStatus]);

  const connected = status === 'connected';
  const statusColor = connected ? theme.colors.success : theme.colors.warning;

  return (
    <SafeScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <LinearGradient
                colors={theme.colors.accentGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Icon name="film" size={19} color={theme.colors.onAccent} />
            </View>
            <Text style={styles.brandName}>Convey</Text>
          </View>
          <ThemePicker />
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            Send <Text style={styles.heroAccent}>2 GB</Text>
            {'\n'}over a <Text style={styles.heroAccentAlt}>2G</Text> signal.
          </Text>
          <Text style={styles.heroSubtitle}>
            Pair two phones with a 6-digit code and the file streams straight across. No
            cloud, no account, no upload — the server only relays.
          </Text>
        </View>

        <View style={styles.pillRow}>
          <Pill
            label={connected ? 'Relay connected' : 'Connecting…'}
            icon="signal"
            tone={connected ? 'success' : 'warning'}
          />
          <Pill
            label={link.roundTripMs > 0 ? `Link ${link.label.toLowerCase()}` : 'Measuring link'}
            icon="clock"
            tone={link.tone === 'neutral' ? 'neutral' : link.tone}
          />
          {storageInfo && (
            <Pill
              label={`${storageInfo.freeFormatted} free`}
              icon="database"
              tone="neutral"
            />
          )}
        </View>

        <View style={styles.actions}>
          <ActionCard
            title="Select File"
            description="Pick a video, generate a 6-digit code, and start sending as soon as the other device joins."
            badge="SENDER"
            icon="upload"
            steps={['Choose', 'Code', 'Send']}
            gradient={theme.colors.accentGradient}
            onPress={() => navigation.navigate('Pair', { mode: 'select_file' })}
          />
          <ActionCard
            title="Receive"
            description="Enter your partner's code. Your free space is checked first so a transfer never runs out of room."
            badge="RECEIVER"
            icon="download"
            steps={['Enter code', 'Check space', 'Receive']}
            gradient={[theme.colors.accentAlt, theme.colors.accent]}
            onPress={() => navigation.navigate('Pair', { mode: 'receive' })}
          />
        </View>

        {isPaired && (
          <Pressable
            onPress={() => navigation.navigate('Chat')}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <GlassCard tone="elevated" corner="lg" depth={1} contentStyle={styles.resumeRow}>
              <Icon name="sparkle" size={18} color={theme.colors.accent} />
              <View style={styles.resumeTextBlock}>
                <Text style={styles.resumeTitle}>Session active</Text>
                <Text style={styles.resumeBody}>Tap to open chat and transfers</Text>
              </View>
              <Icon name="chevronRight" size={18} color={theme.colors.textMuted} />
            </GlassCard>
          </Pressable>
        )}

        <View style={styles.footer}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={styles.footerText}>
            {connected
              ? `Relay online${link.roundTripMs > 0 ? ` · ${link.roundTripMs} ms` : ''}`
              : 'Connecting to relay…'}
          </Text>
        </View>
      </ScrollView>
    </SafeScreen>
  );
};

const createStyles = (theme: Theme) => {
  const c = theme.colors;
  return StyleSheet.create({
    content: {
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxxl,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    brandMark: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandName: {
      ...typography.subheading,
      color: c.textPrimary,
      marginLeft: spacing.sm + 2,
      letterSpacing: 0.2,
    },
    hero: {
      marginTop: spacing.xxl,
      marginBottom: spacing.lg,
    },
    heroTitle: {
      ...typography.display,
      color: c.textPrimary,
    },
    // Two-tone emphasis on the numbers: the headline carries the app's whole
    // thesis (a huge file, a terrible link), so the two figures that make that
    // claim get the accent colours.
    heroAccent: {
      color: c.accent,
    },
    heroAccentAlt: {
      color: c.accentAlt,
    },
    heroSubtitle: {
      ...typography.body,
      color: c.textSecondary,
      marginTop: spacing.md,
    },
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    actions: {
      gap: spacing.lg,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    iconTile: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: {
      ...typography.title,
      fontSize: 22,
      color: c.textPrimary,
    },
    cardDescription: {
      ...typography.bodySmall,
      color: c.textSecondary,
      marginTop: spacing.sm,
    },
    steps: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
      gap: spacing.sm,
    },
    stepText: {
      ...typography.caption,
      color: c.textSecondary,
      fontWeight: '600',
    },
    resumeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    resumeTextBlock: {
      flex: 1,
      marginLeft: spacing.md,
    },
    resumeTitle: {
      ...typography.subheading,
      color: c.textPrimary,
    },
    resumeBody: {
      ...typography.caption,
      color: c.textSecondary,
      marginTop: 1,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xxl,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginRight: spacing.sm,
    },
    footerText: {
      ...typography.caption,
      color: c.textMuted,
    },
  });
};
