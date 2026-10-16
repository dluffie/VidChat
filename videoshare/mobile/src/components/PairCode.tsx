import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  hairlineWidth,
  radius,
  spacing,
  typography,
  useTheme,
  withAlpha,
  Theme,
} from '../theme';
import { GlassCard, Icon, Pill } from './ui';

interface PairCodeProps {
  code: string;
  /**
   * ISO timestamp from the server. The code's lifetime is server-owned
   * (`PAIRING_EXPIRY_MINUTES`), so the remaining time is derived from this
   * rather than hardcoded — a hardcoded label silently lies the moment the
   * server's TTL is reconfigured.
   */
  expiresAt?: string | null;
}

const DEFAULT_TTL_MINUTES = 10;
const TICK_MS = 30_000;
const CONFIRM_MS = 2_500;

/**
 * The pairing code, rendered as individual digit tiles so it is easy to read
 * aloud and hard to mistype on the other device.
 *
 * Copying lives here rather than in `PairScreen`: the code is the only thing
 * that needs to reach the clipboard, and owning it locally lets the button show
 * its own confirmation without a round-trip through the parent.
 */
export const PairCode: React.FC<PairCodeProps> = ({ code, expiresAt }) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = createStyles(theme);
  const digits = code.split('');

  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // A new code is a new thing to copy, so drop any stale confirmation.
  useEffect(() => setCopied(false), [code]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const minutesLeft = (() => {
    if (!expiresAt) return DEFAULT_TTL_MINUTES;
    const remaining = new Date(expiresAt).getTime() - now;
    return Math.max(0, Math.ceil(remaining / 60_000));
  })();

  const handleCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
    } catch {
      // Best effort: the digits stay on screen to read aloud either way.
    }
  }, [code]);

  return (
    <GlassCard tone="elevated" corner="xl" depth={2}>
      <View style={styles.header}>
        <Text style={styles.label}>Your pairing code</Text>
        <Pill label={`${minutesLeft} min left`} icon="clock" tone="accent" />
      </View>

      <Pressable
        onPress={handleCopy}
        accessibilityRole="button"
        accessibilityLabel={`Copy pairing code ${code}`}
        style={({ pressed }) => [styles.codeRow, { opacity: pressed ? 0.75 : 1 }]}
      >
        {digits.map((digit, index) => (
          <View
            key={`${digit}-${index}`}
            style={[styles.digitBox, index === 3 ? { marginLeft: spacing.md } : null]}
          >
            <Text style={styles.digitText}>{digit}</Text>
          </View>
        ))}
      </Pressable>

      <Pressable
        onPress={handleCopy}
        accessibilityRole="button"
        accessibilityLabel={copied ? 'Pairing code copied' : 'Copy pairing code'}
        style={({ pressed }) => [
          styles.copyButton,
          copied && styles.copyButtonDone,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Icon
          name={copied ? 'check' : 'copy'}
          size={16}
          color={copied ? c.success : c.textPrimary}
        />
        <Text style={[styles.copyLabel, copied ? { color: c.success } : null]}>
          {copied ? 'Copied to clipboard' : 'Copy code'}
        </Text>
      </Pressable>

      <View style={styles.hintRow}>
        <View style={styles.pulse} />
        <Text style={styles.hint}>Waiting for the other phone…</Text>
      </View>
    </GlassCard>
  );
};

const createStyles = (theme: Theme) => {
  const c = theme.colors;
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    label: {
      ...typography.overline,
      color: c.textMuted,
    },
    codeRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    digitBox: {
      width: 42,
      height: 52,
      marginHorizontal: 3,
      borderRadius: radius.sm,
      borderWidth: hairlineWidth,
      borderColor: c.surfaceBorder,
      backgroundColor: c.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    digitText: {
      ...typography.title,
      fontSize: 26,
      color: c.textPrimary,
    },
    copyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      borderRadius: radius.pill,
      borderWidth: hairlineWidth,
      borderColor: c.surfaceBorder,
      backgroundColor: c.surfaceElevated,
      marginBottom: spacing.lg,
    },
    copyButtonDone: {
      borderColor: withAlpha(c.success, 0.4),
      backgroundColor: withAlpha(c.success, 0.16),
    },
    copyLabel: {
      ...typography.subheading,
      color: c.textPrimary,
      marginLeft: spacing.sm,
    },
    hintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    pulse: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: c.accentAlt,
      marginRight: spacing.sm,
    },
    hint: {
      ...typography.bodySmall,
      color: c.accentAlt,
      fontWeight: '600',
    },
  });
};
