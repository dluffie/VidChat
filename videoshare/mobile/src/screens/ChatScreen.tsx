import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { ChatBubble } from '../components/ChatBubble';
import { VideoBubble } from '../components/VideoBubble';
import { MessageClientService } from '../services/messages';
import { VideoTransferService } from '../services/videoTransfer';
import { PairingService } from '../services/pairing';
import { WebSocketClient } from '../services/websocket';
import { FileSystemService } from '../services/fileSystem';
import { useChatStore } from '../store/chatStore';
import { useConnectionStore } from '../store/connectionStore';
import { useTransferStore } from '../store/transferStore';
import { CHUNK_SIZES, DEFAULT_CHUNK_SIZE, formatBytes } from '../utils/chunking';
import { ChatMessage } from '../types/messages';

interface ChatScreenProps {
  navigation: any;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ navigation }) => {
  const [inputText, setInputText] = useState('');
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [selectedVideoSizeMb, setSelectedVideoSizeMb] = useState<number>(1);
  const [selectedChunkSize, setSelectedChunkSize] = useState<number>(DEFAULT_CHUNK_SIZE);
  const [customVideoName, setCustomVideoName] = useState('holiday.mp4');

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

    // Listen for new incoming text messages
    const handleNewMessage = (msg: ChatMessage) => {
      addMessage(msg);
      // Mark read
      MessageClientService.markAsRead([msg.messageId]);
    };

    // Listen for message status updates
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

    return () => {
      ws.off('message:new', handleNewMessage);
      ws.off('message:sent', handleMessageSent);
      ws.off('message:delivered', handleMessageDelivered);
      ws.off('message:read', handleMessageRead);
      ws.off('peer:status', handlePeerStatus);
    };
  }, [addMessage, updateMessageStatus, updateMultipleStatuses, setPeerStatus]);

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

  const handleStartVideoTransfer = async () => {
    setVideoModalVisible(false);

    try {
      const sizeInBytes = selectedVideoSizeMb * 1024 * 1024;
      const fileName = customVideoName || 'holiday.mp4';

      // Generate video binary data for testing transport
      const mockVideo = FileSystemService.createMockVideo(fileName, sizeInBytes);

      const transferId = await VideoTransferService.sendVideo(
        fileName,
        mockVideo.data,
        'video/mp4',
        selectedChunkSize,
        {
          onProgress: (progress) => {
            upsertTransfer(progress);
          },
          onComplete: (filePath, metrics) => {
            console.log(`[VideoTransfer] Transfer ${transferId} complete! Verified SHA-256`);
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
      timestamp: Date.now(), // active transfer
    })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* WhatsApp-style Header: ← Friend 🟢 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Friend</Text>
            <View style={styles.peerStatusRow}>
              <View
                style={[
                  styles.statusDot,
                  peerStatus === 'online' ? styles.statusGreen : styles.statusGray,
                ]}
              />
              <Text style={styles.peerStatusText}>
                {peerStatus === 'online' ? 'online' : 'offline'}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Text style={styles.lockIcon}>🔒 Private</Text>
          </View>
        </View>

        {/* Message Feed */}
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
            } else {
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
            }
          }}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Bottom Input Bar: 📎 Type a message... ➤ */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachButton}
            activeOpacity={0.7}
            onPress={() => setVideoModalVisible(true)}
          >
            <Text style={styles.attachIcon}>📎</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor="#64748B"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />

          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            activeOpacity={0.8}
            onPress={handleSendMessage}
            disabled={!inputText.trim()}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>

        {/* Choose Video Modal (Section 11) */}
        <Modal
          visible={videoModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setVideoModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choose Video</Text>
                <TouchableOpacity onPress={() => setVideoModalVisible(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Video Info Preview */}
              <View style={styles.videoPreviewBox}>
                <Text style={styles.previewIcon}>🎥</Text>
                <View style={styles.previewInfo}>
                  <Text style={styles.previewName}>{customVideoName}</Text>
                  <Text style={styles.previewSize}>{formatBytes(selectedVideoSizeMb * 1024 * 1024)}</Text>
                </View>
              </View>

              {/* Test Video Size Presets (Milestone 32: 1MB -> 10MB -> 50MB -> 100MB) */}
              <Text style={styles.modalSectionLabel}>Select Video Size Preset:</Text>
              <View style={styles.sizePresets}>
                {[1, 10, 50, 100].map((size) => (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.presetButton,
                      selectedVideoSizeMb === size && styles.presetButtonActive,
                    ]}
                    onPress={() => {
                      setSelectedVideoSizeMb(size);
                      setCustomVideoName(size === 1 ? 'sample_1mb.mp4' : size === 10 ? 'holiday.mp4' : `video_${size}mb.mp4`);
                    }}
                  >
                    <Text
                      style={[
                        styles.presetButtonText,
                        selectedVideoSizeMb === size && styles.presetButtonTextActive,
                      ]}
                    >
                      {size} MB
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Configurable Chunk Size */}
              <Text style={styles.modalSectionLabel}>Configurable Transport Chunk Size:</Text>
              <View style={styles.chunkRow}>
                <TouchableOpacity
                  style={[
                    styles.chunkOption,
                    selectedChunkSize === CHUNK_SIZES.CHUNK_64KB && styles.chunkOptionActive,
                  ]}
                  onPress={() => setSelectedChunkSize(CHUNK_SIZES.CHUNK_64KB)}
                >
                  <Text
                    style={[
                      styles.chunkOptionText,
                      selectedChunkSize === CHUNK_SIZES.CHUNK_64KB && styles.chunkOptionTextActive,
                    ]}
                  >
                    64 KB (Standard)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.chunkOption,
                    selectedChunkSize === CHUNK_SIZES.CHUNK_128KB && styles.chunkOptionActive,
                  ]}
                  onPress={() => setSelectedChunkSize(CHUNK_SIZES.CHUNK_128KB)}
                >
                  <Text
                    style={[
                      styles.chunkOptionText,
                      selectedChunkSize === CHUNK_SIZES.CHUNK_128KB && styles.chunkOptionTextActive,
                    ]}
                  >
                    128 KB (Fast)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Send Button */}
              <TouchableOpacity
                style={styles.modalSendButton}
                activeOpacity={0.8}
                onPress={handleStartVideoTransfer}
              >
                <Text style={styles.modalSendButtonText}>Send Video Chunks</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backBtn: {
    paddingRight: 14,
    paddingVertical: 4,
  },
  backBtnText: {
    color: '#38BDF8',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
  },
  peerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusGreen: {
    backgroundColor: '#10B981',
  },
  statusGray: {
    backgroundColor: '#64748B',
  },
  peerStatusText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  headerActions: {
    paddingHorizontal: 8,
  },
  lockIcon: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  messageList: {
    paddingVertical: 12,
    flexGrow: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  attachButton: {
    padding: 8,
    marginRight: 6,
  },
  attachIcon: {
    fontSize: 24,
    color: '#94A3B8',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sendButton: {
    backgroundColor: '#059669',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    marginLeft: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalClose: {
    color: '#94A3B8',
    fontSize: 18,
    padding: 4,
  },
  videoPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  previewIcon: {
    fontSize: 32,
    marginRight: 14,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: 'bold',
  },
  previewSize: {
    color: '#38BDF8',
    fontSize: 14,
    marginTop: 2,
  },
  modalSectionLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  sizePresets: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  presetButton: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetButtonActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  presetButtonText: {
    color: '#CBD5E1',
    fontWeight: 'bold',
    fontSize: 14,
  },
  presetButtonTextActive: {
    color: '#FFFFFF',
  },
  chunkRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  chunkOption: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  chunkOptionActive: {
    borderColor: '#059669',
    backgroundColor: 'rgba(5, 150, 105, 0.2)',
  },
  chunkOptionText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  chunkOptionTextActive: {
    color: '#10B981',
    fontWeight: 'bold',
  },
  modalSendButton: {
    backgroundColor: '#059669',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
