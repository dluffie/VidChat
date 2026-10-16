import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { hairlineWidth, radius, spacing, typography, useTheme, Theme } from '../theme';
import { GlassCard, Pill } from './ui';

interface PairCodeProps {
  code: string;
  expiresAt?: string | null;
  onCopy?: () => void;
}

/**
 * The pairing code, rendered as individual digit tiles so it is easy to read
 * aloud and hard to mistype on the other device.
 */
export const PairCode: React.FC<PairCodeProps> = ({ code, expiresAt, onCopy }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const digits = code.split('');

  return (
    <GlassCard tone="elevated" corner="xl" depth={2}>
      <View style={styles.header}>
        <Text style={styles.label}>Your pairing code</Text>
        <Pill label="10 min" icon="clock" tone="accent" />
      </View>

      <Pressable
        onPress={onCopy}
        accessibilityRole="button"
        accessibilityLabel={`Copy pairing code ${code}`}
        style={({ pressed }) => [styles.codeRow, { opacity: pressed ? 0.75 : 1 }]}
      >
        {digits.map((digit, index) => (
          <View
            key={`${digit}-${index}`}
            style={[
              styles.digitBox,
              index === 3 ? { marginLeft: spacing.md } : null,
            ]}
          >
            <Text style={styles.digitText}>{digit}</Text>
          </View>
        ))}
      </Pressable>

      <View style={styles.hintRow}>
        <View style={styles.pulse} />
        <Text style={styles.hint}>Waiting for the second device…</Text>
      </View>
      <Text style={styles.tapHint}>Tap the code to copy it</Text>
      {expiresAt ? <Text style={styles.expiry}>Expires {new Date(expiresAt).toLocaleTimeString()}</Text> : null}
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
    tapHint: {
      ...typography.caption,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    expiry: {
      ...typography.caption,
      color: c.textMuted,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
  });
};
