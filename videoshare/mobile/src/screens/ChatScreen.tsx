import React, { useState, useEffect, useRef } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeScreen } from '../components/SafeScreen';
import { ChatBubble } from '../components/ChatBubble';
import { VideoBubble } from '../components/VideoBubble';
import {
  GlassCard,
  GlassIconButton,
  GradientButton,
  Icon,
  Pill,
  SegmentedControl,
  ThemePicker,
} from '../components/ui';
import { hairlineWidth, radius, spacing, typography, useTheme, Theme } from '../theme';
import { MessageClientService } from '../services/messages';
import { VideoTransferService, recommendedChunkSize } from '../services/videoTransfer';
import { PairingService } from '../services/pairing';
import { WebSocketClient } from '../services/websocket';
import { FileSystemService } from '../services/fileSystem';
import { useChatStore } from '../store/chatStore';
import { useConnectionStore } from '../store/connectionStore';
import { useTransferStore } from '../store/transferStore';
import { formatBytes } from '../utils/chunking';
import { ChatMessage } from '../types/messages';

interface ChatScreenProps {
  navigation: any;
}

/**
 * Transport profiles. `auto` reads the live link measurement, which is what a
 * 2G connection needs: it drops to 16 KB chunks so a single frame can complete
 * before the connection is at risk of being mistaken for stalled.
 */
type TransportProfile = 'auto' | 'fast' | 'balanced' | 'saver';

const PROFILE_LABELS: { value: TransportProfile; label: string; icon: any }[] = [
  { value: 'auto', label: 'Auto', icon: 'sparkle' },
  { value: 'fast', label: 'Fast', icon: 'upload' },
  { value: 'balanced', label: 'Balanced', icon: 'signal' },
  { value: 'saver', label: 'Data saver', icon: 'download' },
];

const PROFILE_CHUNK_SIZE: Record<Exclude<TransportProfile, 'auto'>, number> = {
  fast: 128 * 1024,
  balanced: 64 * 1024,
  saver: 16 * 1024,
};

export const ChatScreen: React.FC<ChatScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [inputText, setInputText] = useState('');
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [selectedVideoSizeMb, setSelectedVideoSizeMb] = useState<number>(1);
  const [profile, setProfile] = useState<TransportProfile>('auto');
  const [customVideoName, setCustomVideoName] = useState('holiday.mp4');
  const [link, setLink] = useState(() => VideoTransferService.getLinkInfo());

  const { messages, addMessage, updateMessageStatus, updateMultipleStatuses } = useChatStore();
  const { peerStatus, setPeerStatus } = useConnectionStore();
  const { transfers, upsertTransfer, setSelectedTransferId } = useTransferStore();

  const pairingState = PairingService.getPairingState();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const ws = WebSocketClient.getInstance();
    ws.connect();

    // Authenticate active session credentials
    PairingService.authenticateActiveSession();

    // Initialize VideoTransferService listeners
    VideoTransferService.init();

    // Render transfers in both directions. Transfers the user did not start
    // themselves (incoming videos) are surfaced here too.
    const unsubscribeTransfers = VideoTransferService.subscribeProgress((progress) => {
      upsertTransfer(progress);
    });

    const handleNewMessage = (msg: ChatMessage) => {
      addMessage(msg);
      MessageClientService.markAsRead([msg.messageId]);
    };

    const handleMessageSent = (data: { messageId: string; status: any }) => {
      updateMessageStatus(data.messageId, data.status);
    };

    const handleMessageDelivered = (data: { messageId: string }) => {
      updateMessageStatus(data.messageId, 'DELIVERED');
    };

    const handleMessageRead = (data: { messageIds: string[] }) => {
      updateMultipleStatuses(data.messageIds, 'READ');
    };

    const handlePeerStatus = (data: { status: 'online' | 'offline' }) => {
      setPeerStatus(data.status);
    };

    ws.on('message:new', handleNewMessage);
    ws.on('message:sent', handleMessageSent);
    ws.on('message:delivered', handleMessageDelivered);
    ws.on('message:read', handleMessageRead);
    ws.on('peer:status', handlePeerStatus);

    const linkTimer = setInterval(() => setLink(VideoTransferService.getLinkInfo()), 4000);

    // When the keyboard opens the list shrinks, so keep the newest message in
    // view instead of leaving it hidden behind the composer.
    const keyboardSub = Keyboard.addListener('keyboardDidShow', () => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });

    return () => {
      clearInterval(linkTimer);
      keyboardSub.remove();
      unsubscribeTransfers();
      ws.off('message:new', handleNewMessage);
      ws.off('message:sent', handleMessageSent);
      ws.off('message:delivered', handleMessageDelivered);
      ws.off('message:read', handleMessageRead);
      ws.off('peer:status', handlePeerStatus);
    };
  }, [addMessage, updateMessageStatus, updateMultipleStatuses, setPeerStatus, upsertTransfer]);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    try {
      const sentMsg = MessageClientService.sendTextMessage(inputText.trim());
      addMessage(sentMsg);
      setInputText('');
    } catch (err: any) {
      console.warn('Failed to send text message:', err);
    }
  };

  /** Resolves the chunk size the chosen profile implies for the current link. */
  const resolveChunkSize = (): number => {
    if (profile === 'auto') {
      return recommendedChunkSize(VideoTransferService.getLinkInfo().roundTripMs);
    }
    return PROFILE_CHUNK_SIZE[profile];
  };

  const handleStartVideoTransfer = async () => {
    setVideoModalVisible(false);

    try {
      const sizeInBytes = selectedVideoSizeMb * 1024 * 1024;
      const fileName = customVideoName || 'holiday.mp4';

      // Materialise the synthetic video on disk (streamed in slices) so the
      // normal file-streaming transfer path is exercised end to end.
      const mockFilePath = await FileSystemService.createMockVideoFile(fileName, sizeInBytes);

      const transferId = await VideoTransferService.sendVideoFromFile(
        mockFilePath,
        fileName,
        'video/mp4',
        resolveChunkSize(),
        {
          onProgress: (progress) => {
            upsertTransfer(progress);
          },
          onComplete: (filePath, metrics) => {
            console.log(`[VideoTransfer] Transfer ${transferId} complete! Verified`);
          },
          onError: (error) => {
            console.error(`[VideoTransfer] Transfer ${transferId} failed:`, error);
          },
        }
      );

      const initialProgress = VideoTransferService.getTransfer(transferId);
      if (initialProgress) {
        upsertTransfer(initialProgress);
      }
    } catch (err: any) {
      console.error('Failed to initiate video transfer:', err);
    }
  };

  const handlePlayVideo = (filePath: string, transferId: string) => {
    setSelectedTransferId(transferId);
    navigation.navigate('VideoTransfer', { transferId });
  };

  const handleViewDetails = (transferId: string) => {
    setSelectedTransferId(transferId);
    navigation.navigate('VideoTransfer', { transferId });
  };

  const handleCancelTransfer = (transferId: string) => {
    VideoTransferService.cancel(transferId);
    const tr = VideoTransferService.getTransfer(transferId);
    if (tr) upsertTransfer(tr);
  };

  const handleResumeTransfer = (transferId: string) => {
    VideoTransferService.resumeTransfer(transferId);
  };

  // Combine messages and video transfers into a single chronological feed
  const combinedFeed: Array<{ type: 'message' | 'transfer'; data: any; timestamp: number }> = [
    ...messages.map((m) => ({
      type: 'message' as const,
      data: m,
      timestamp: typeof m.timestamp === 'number' ? m.timestamp : new Date(m.timestamp).getTime(),
    })),
    ...Object.values(transfers).map((t) => ({
      type: 'transfer' as const,
      data: t,
      timestamp: Date.now(),
    })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  const online = peerStatus === 'online';

  return (
    <SafeScreen padded={false}>
      {/*
        Android needs `behavior="padding"` here. Since edge-to-edge became the
        default, Android no longer honours `adjustResize` for the window, so the
        `undefined` behavior this screen used to pass left the composer under the
        keyboard. `KeyboardAvoidingView` measures the overlap against its own
        frame, so this is also self-correcting: on any device where the window
        *does* resize, the overlap is zero and no padding is added.
      */}
      <KeyboardAvoidingView style={styles.container} behavior="padding">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <GlassIconButton
              name="back"
              accessibilityLabel="Back to home"
              onPress={() => navigation.navigate('Home')}
            />
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>F</Text>
              <View
                style={[
                  styles.avatarDot,
                  { backgroundColor: online ? theme.colors.success : theme.colors.textMuted },
                ]}
              />
            </View>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.headerTitle}>Friend</Text>
              <Text style={styles.peerStatusText}>
                {online ? 'online' : 'offline'}
                {link.roundTripMs > 0 ? ` · ${link.label.toLowerCase()} link` : ''}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pill label="Private" icon="lock" tone="success" />
            <ThemePicker />
          </View>
        </View>

        {/* Message feed */}
        <FlatList
          ref={flatListRef}
          data={combinedFeed}
          keyExtractor={(item, index) =>
            item.type === 'message' ? item.data.messageId : `transfer-${item.data.transferId}-${index}`
          }
          renderItem={({ item }) => {
            if (item.type === 'message') {
              const isSelf = item.data.senderDeviceId === pairingState.deviceId;
              return <ChatBubble message={item.data} isSelf={isSelf} />;
            }
            const isSelf = item.data.direction === 'outgoing';
            return (
              <VideoBubble
                progress={item.data}
                isSelf={isSelf}
                onPlay={(path) => handlePlayVideo(path, item.data.transferId)}
                onCancel={handleCancelTransfer}
                onResume={handleResumeTransfer}
                onViewDetails={handleViewDetails}
              />
            );
          }}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />

        {/* Composer */}
        <View style={styles.composer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send a test video"
            onPress={() => setVideoModalVisible(true)}
            style={({ pressed }) => [styles.attachButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Icon name="plus" size={20} color={theme.colors.textPrimary} />
          </Pressable>

          <TextInput
            style={styles.textInput}
            placeholder="Message"
            placeholderTextColor={theme.colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={handleSendMessage}
            disabled={!inputText.trim()}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: inputText.trim() ? theme.colors.accent : theme.colors.surface,
                opacity: pressed ? 0.8 : inputText.trim() ? 1 : 0.5,
              },
            ]}
          >
            <Icon
              name="send"
              size={19}
              color={inputText.trim() ? theme.colors.onAccent : theme.colors.textMuted}
            />
          </Pressable>
        </View>

        {/* Video composer modal */}
        <Modal
          visible={videoModalVisible}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setVideoModalVisible(false)}
        >
          {/* The sheet is anchored to the bottom, so the keyboard has to be
              avoided explicitly here too — the outer KeyboardAvoidingView only
              wraps the screen behind the modal. */}
          <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
            <Pressable
              style={[styles.modalBackdrop, { backgroundColor: theme.colors.scrim }]}
              onPress={() => setVideoModalVisible(false)}
            />
            <View style={styles.modalWrapper}>
              <GlassCard
                tone="elevated"
                corner="xl"
                depth={3}
                padded={false}
                style={styles.modalSheet}
                contentStyle={styles.modalSheetContent}
              >
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderText}>
                    <Text style={styles.modalTitle}>Send a test video</Text>
                    <Text style={styles.modalSubtitle}>
                      Generated on device, streamed through the real transfer path
                    </Text>
                  </View>
                  <GlassIconButton
                    name="close"
                    accessibilityLabel="Close"
                    onPress={() => setVideoModalVisible(false)}
                    size={34}
                  />
                </View>

                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalBody}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {/* Live link readout */}
                  <View style={styles.linkRow}>
                    <View style={styles.linkItem}>
                      <Pill label={link.label} icon="signal" tone={link.tone === 'neutral' ? 'neutral' : link.tone} />
                      <Text style={styles.linkDetail}>{link.detail}</Text>
                    </View>
                    <View style={styles.linkItem}>
                      <Pill label={`${link.windowSize} in flight`} icon="database" tone="neutral" />
                      <Text style={styles.linkDetail}>adaptive window</Text>
                    </View>
                  </View>

                  <Text style={styles.sectionLabel}>File name</Text>
                  <View style={styles.previewBox}>
                    <View style={styles.previewIcon}>
                      <Icon name="film" size={20} color={theme.colors.accent} />
                    </View>
                    <View style={styles.previewInfo}>
                      <TextInput
                        style={styles.previewNameInput}
                        value={customVideoName}
                        onChangeText={setCustomVideoName}
                        placeholder="holiday.mp4"
                        placeholderTextColor={theme.colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="done"
                        maxLength={80}
                        accessibilityLabel="File name"
                      />
                      <Text style={styles.previewSize}>
                        {formatBytes(selectedVideoSizeMb * 1024 * 1024)} ·{' '}
                        {formatBytes(resolveChunkSize())} chunks
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.sectionLabel}>Size</Text>
                  <View style={styles.sizePresets}>
                    {[1, 10, 50, 100].map((size) => {
                      const active = selectedVideoSizeMb === size;
                      return (
                        <Pressable
                          key={size}
                          onPress={() => {
                            setSelectedVideoSizeMb(size);
                            setCustomVideoName(
                              size === 1
                                ? 'sample_1mb.mp4'
                                : size === 10
                                  ? 'holiday.mp4'
                                  : `video_${size}mb.mp4`
                            );
                          }}
                          style={({ pressed }) => [
                            styles.presetButton,
                            {
                              borderColor: active ? theme.colors.accent : theme.colors.surfaceBorder,
                              backgroundColor: active
                                ? theme.colors.accentSoft
                                : theme.colors.inputBg,
                              opacity: pressed ? 0.8 : 1,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.presetText,
                              { color: active ? theme.colors.accent : theme.colors.textSecondary },
                            ]}
                          >
                            {size} MB
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.sectionLabel}>Transport</Text>
                  <SegmentedControl
                    options={PROFILE_LABELS}
                    value={profile}
                    onChange={(value) => setProfile(value as TransportProfile)}
                  />
                  <Text style={styles.profileHint}>
                    Auto adapts the chunk size to the measured round-trip time. Data saver uses
                    16 KB chunks for very poor connections.
                  </Text>

                  <GradientButton
                    label="Start transfer"
                    iconRight="arrowRight"
                    onPress={handleStartVideoTransfer}
                    style={styles.modalSend}
                  />
                </ScrollView>
              </GlassCard>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
};

const createStyles = (theme: Theme) => {
  const c = theme.colors;
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginLeft: spacing.md,
      backgroundColor: c.accentSoft,
      borderWidth: hairlineWidth,
      borderColor: c.surfaceBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      ...typography.subheading,
      color: c.accent,
    },
    avatarDot: {
      position: 'absolute',
      right: -1,
      bottom: -1,
      width: 11,
      height: 11,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: c.background,
    },
    headerTitleBlock: {
      marginLeft: spacing.md,
      flexShrink: 1,
    },
    headerTitle: {
      ...typography.subheading,
      color: c.textPrimary,
    },
    peerStatusText: {
      ...typography.caption,
      color: c.textSecondary,
      marginTop: 1,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    messageList: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      flexGrow: 1,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      gap: spacing.sm,
    },
    attachButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: hairlineWidth,
      borderColor: c.surfaceBorder,
    },
    textInput: {
      flex: 1,
      backgroundColor: c.inputBg,
      borderRadius: radius.lg,
      borderWidth: hairlineWidth,
      borderColor: c.inputBorder,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      color: c.textPrimary,
      fontSize: 15,
      maxHeight: 110,
      minHeight: 44,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: hairlineWidth,
      borderColor: c.surfaceBorder,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    modalWrapper: {
      width: '100%',
      padding: spacing.md,
      paddingBottom: spacing.xxl,
    },
    modalSheet: {
      maxHeight: '88%',
    },
    modalSheetContent: {
      flexShrink: 1,
    },
    modalScroll: {
      flexGrow: 0,
      flexShrink: 1,
    },
    modalHeaderText: {
      flex: 1,
      marginRight: spacing.md,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: hairlineWidth,
      borderBottomColor: c.divider,
    },
    modalTitle: {
      ...typography.heading,
      color: c.textPrimary,
    },
    modalSubtitle: {
      ...typography.caption,
      color: c.textSecondary,
      marginTop: 2,
    },
    modalBody: {
      padding: spacing.lg,
    },
    linkRow: {
      flexDirection: 'row',
      marginBottom: spacing.lg,
      gap: spacing.lg,
    },
    linkItem: {
      flex: 1,
    },
    linkDetail: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: spacing.xs + 1,
    },
    previewBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.inputBg,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: hairlineWidth,
      borderColor: c.surfaceBorder,
      marginBottom: spacing.lg,
    },
    previewIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    previewInfo: {
      flex: 1,
    },
    previewNameInput: {
      ...typography.subheading,
      color: c.textPrimary,
      padding: 0,
      margin: 0,
    },
    previewSize: {
      ...typography.caption,
      color: c.accentAlt,
      marginTop: 2,
    },
    sectionLabel: {
      ...typography.overline,
      color: c.textMuted,
      marginBottom: spacing.sm,
    },
    sizePresets: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    presetButton: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      borderWidth: hairlineWidth,
    },
    presetText: {
      ...typography.label,
    },
    profileHint: {
      ...typography.caption,
      color: c.textMuted,
      marginTop: spacing.sm,
      lineHeight: 16,
    },
    modalSend: {
      marginTop: spacing.xl,
    },
  });
};
