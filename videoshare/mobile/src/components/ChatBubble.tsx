import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChatMessage } from '../types/messages';

interface ChatBubbleProps {
  message: ChatMessage;
  isSelf: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, isSelf }) => {
  const formatTime = (ts: number | string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderStatus = () => {
    if (!isSelf) return null;

    switch (message.status) {
      case 'SENDING':
        return <Text style={styles.statusIcon}>🕒</Text>;
      case 'SENT':
        return <Text style={styles.statusIcon}>✓</Text>;
      case 'DELIVERED':
        return <Text style={styles.statusIcon}>✓✓</Text>;
      case 'READ':
        return <Text style={[styles.statusIcon, styles.readStatus]}>✓✓</Text>;
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, isSelf ? styles.selfContainer : styles.partnerContainer]}>
      <View style={[styles.bubble, isSelf ? styles.selfBubble : styles.partnerBubble]}>
        <Text style={[styles.messageText, isSelf ? styles.selfText : styles.partnerText]}>
          {message.text}
        </Text>
        <View style={styles.footer}>
          <Text style={[styles.timeText, isSelf ? styles.selfTimeText : styles.partnerTimeText]}>
            {formatTime(message.timestamp)}
          </Text>
          {renderStatus()}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
  },
  selfContainer: {
    justifyContent: 'flex-end',
  },
  partnerContainer: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  selfBubble: {
    backgroundColor: '#059669', // Emerald/WhatsApp dark outgoing
    borderBottomRightRadius: 2,
  },
  partnerBubble: {
    backgroundColor: '#1E293B', // Dark slate incoming
    borderBottomLeftRadius: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  selfText: {
    color: '#FFFFFF',
  },
  partnerText: {
    color: '#F1F5F9',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    marginRight: 4,
  },
  selfTimeText: {
    color: '#A7F3D0',
  },
  partnerTimeText: {
    color: '#94A3B8',
  },
  statusIcon: {
    fontSize: 11,
    color: '#A7F3D0',
  },
  readStatus: {
    color: '#38BDF8', // Read blue ticks
    fontWeight: 'bold',
  },
});
