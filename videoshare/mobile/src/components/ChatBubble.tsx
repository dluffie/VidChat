import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { hairlineWidth, radius, spacing, typography, useTheme, Theme } from '../theme';
import { Icon } from './ui';
import { ChatMessage } from '../types/messages';

interface ChatBubbleProps {
  message: ChatMessage;
  isSelf: boolean;
}

/**
 * Chat message in the glass language: a tinted, hairline-bordered pane with a
 * squared-off corner pointing at its author.
 */
export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isSelf }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const formatTime = (ts: number | string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  /** Delivery state, drawn with icons so it never depends on a font glyph. */
  const renderStatus = () => {
    if (!isSelf) return null;

    const muted = theme.colors.textMuted;
    const read = theme.colors.accentAlt;

    switch (message.status) {
      case 'SENDING':
        return (
          <View style={styles.statusRow}>
            <Icon name="clock" size={11} color={muted} weight={1.2} />
          </View>
        );
      case 'SENT':
        return (
          <View style={styles.statusRow}>
            <Icon name="check" size={11} color={muted} weight={1.6} />
          </View>
        );
      case 'DELIVERED':
        return (
          <View style={styles.statusRow}>
            <Icon name="check" size={11} color={muted} weight={1.6} style={styles.secondTick} />
            <Icon name="check" size={11} color={muted} weight={1.6} />
          </View>
        );
      case 'READ':
        return (
          <View style={styles.statusRow}>
            <Icon name="check" size={11} color={read} weight={1.8} style={styles.secondTick} />
            <Icon name="check" size={11} color={read} weight={1.8} />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, isSelf ? styles.selfContainer : styles.partnerContainer]}>
      <View style={[styles.bubble, isSelf ? styles.selfBubble : styles.partnerBubble]}>
        <Text style={[styles.messageText, { color: theme.colors.textPrimary }]}>
          {message.text}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.timeText}>{formatTime(message.timestamp)}</Text>
          {renderStatus()}
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) => {
  const c = theme.colors;
  return StyleSheet.create({
    container: {
      marginVertical: spacing.xs + 1,
      flexDirection: 'row',
    },
    selfContainer: {
      justifyContent: 'flex-end',
      paddingLeft: spacing.xxxl,
    },
    partnerContainer: {
      justifyContent: 'flex-start',
      paddingRight: spacing.xxxl,
    },
    bubble: {
      maxWidth: '100%',
      borderRadius: radius.lg,
      borderWidth: hairlineWidth,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      overflow: 'hidden',
    },
    selfBubble: {
      backgroundColor: c.bubbleOut,
      borderColor: c.bubbleOutBorder,
      borderBottomRightRadius: radius.xs,
    },
    partnerBubble: {
      backgroundColor: c.bubbleIn,
      borderColor: c.bubbleInBorder,
      borderBottomLeftRadius: radius.xs,
    },
    messageText: {
      ...typography.body,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    timeText: {
      ...typography.caption,
      fontSize: 10,
      color: c.textMuted,
      marginRight: spacing.xs + 1,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    secondTick: {
      marginRight: -4,
    },
  });
};
