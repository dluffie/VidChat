import React, { useState, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeScreen } from '../components/SafeScreen';
import { PairCode } from '../components/PairCode';
import {
  Divider,
  GlassCard,
  GlassIconButton,
  GradientButton,
  Icon,
  InfoRow,
  Pill,
  ProgressTrack,
  SectionLabel,
  SegmentedControl,
  ThemePicker,
} from '../components/ui';
import { hairlineWidth, radius, spacing, typography, useTheme, Theme } from '../theme';
import { PairingService } from '../services/pairing';
import { WebSocketClient } from '../services/websocket';
import { StorageService } from '../services/storage';
import { VideoTransferService, PreProcessedVideo } from '../services/videoTransfer';
import { useTransferStore } from '../store/transferStore';
import { DeviceStorageInfo } from '../types/pairing';
import { formatBytes } from '../utils/chunking';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

interface PairScreenProps {
  route: any;
  navigation: any;
}

interface PickedVideoInfo {
  uri: string;
  name: string;
  size: number;
  duration?: number | null;
  width?: number;
  height?: number;
  mimeType?: string;
}

/** A large, tappable source option (gallery / files). */
const SourceOption: React.FC<{
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
}> = ({ icon, title, subtitle, onPress }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
    >
      <GlassCard corner="lg" depth={1} contentStyle={styles.sourceRow}>
        <View style={styles.sourceIcon}>
          <Icon name={icon} size={19} color={theme.colors.accent} />
        </View>
        <View style={styles.sourceText}>
          <Text style={styles.sourceTitle}>{title}</Text>
          <Text style={styles.sourceSubtitle}>{subtitle}</Text>
        </View>
        <Icon name="chevronRight" size={17} color={theme.colors.textMuted} />
      </GlassCard>
    </Pressable>
  );
};

export const PairScreen: React.FC<PairScreenProps> = ({ route, navigation }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const initialMode = route.params?.mode || 'select_file';
  const [mode, setMode] = useState<'select_file' | 'receive'>(
    initialMode === 'receive' || initialMode === 'join' ? 'receive' : 'select_file'
  );

  // Common state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [pairingCode, setPairingCode] = useState<string>('');

  // Sender / video selector
  const [selectedVideo, setSelectedVideo] = useState<PickedVideoInfo | null>(null);

  // Pre-processing
  const [isPreProcessing, setIsPreProcessing] = useState<boolean>(false);
  const [preProcessProgress, setPreProcessProgress] = useState<number>(0);
  const [preProcessStep, setPreProcessStep] = useState<string>('');
  const [preProcessedVideo, setPreProcessedVideo] = useState<PreProcessedVideo | null>(null);

  // Receiver storage verification (on the sender)
  const [receiverStorage, setReceiverStorage] = useState<DeviceStorageInfo | null>(null);
  const [storageCheckResult, setStorageCheckResult] = useState<{
    sufficient: boolean;
    requiredFormatted: string;
    availableFormatted: string;
    message: string;
  } | null>(null);
  const [isTransferStarting, setIsTransferStarting] = useState<boolean>(false);

  // Receiver state
  const [inputCode, setInputCode] = useState<string>('');
  const [localDeviceStorage, setLocalDeviceStorage] = useState<DeviceStorageInfo | null>(null);
  const [receiverWaitingMessage, setReceiverWaitingMessage] = useState<string | null>(null);

  const { upsertTransfer } = useTransferStore();

  useEffect(() => {
    const ws = WebSocketClient.getInstance();

    PairingService.initPairSuccessListener();

    StorageService.getStorageInfo().then((info) => {
      setLocalDeviceStorage(info);
    });

    const handlePairSuccess = (data: any) => {
      setIsSuccess(true);

      if (data.receiverStorage) {
        setReceiverStorage(data.receiverStorage);
      }

      if (mode === 'receive') {
        setReceiverWaitingMessage(
          'Storage details sent to the sender. Waiting for them to confirm and start the transfer…'
        );
      }
    };

    const handleStorageInfo = (data: { storage: DeviceStorageInfo }) => {
      if (data.storage) {
        setReceiverStorage(data.storage);
      }
    };

    const handleIncomingVideoStart = (meta: any) => {
      navigation.replace('Chat');
    };

    ws.on('pair:success', handlePairSuccess);
    ws.on('storage:info', handleStorageInfo);
    ws.on('video:start', handleIncomingVideoStart);

    return () => {
      ws.off('pair:success', handlePairSuccess);
      ws.off('storage:info', handleStorageInfo);
      ws.off('video:start', handleIncomingVideoStart);
    };
  }, [mode, navigation]);

  // Re-run storage verification when the receiver reports its capacity
  useEffect(() => {
    if (receiverStorage && preProcessedVideo) {
      const check = StorageService.verifyStorage(
        preProcessedVideo.fileSize,
        receiverStorage.freeBytes
      );
      setStorageCheckResult(check);
    }
  }, [receiverStorage, preProcessedVideo]);

  /** SENDER: pick a video from the camera roll. */
  const handlePickFromGallery = async () => {
    try {
      setError(null);
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          setError('Camera roll / media permission is required to select a video.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const uri = asset.uri;
      const fileName = asset.fileName || uri.split('/').pop() || 'selected_video.mp4';
      let size = asset.fileSize || 0;

      if (!size) {
        try {
          const info = await FileSystem.getInfoAsync(uri);
          if (info.exists && 'size' in info) {
            size = (info as any).size || 0;
          }
        } catch {
          // ignore
        }
      }

      setSelectedVideo({
        uri,
        name: fileName,
        size,
        duration: asset.duration,
        width: asset.width,
        height: asset.height,
        mimeType: asset.mimeType || 'video/mp4',
      });
    } catch (err: any) {
      console.error('Error picking video from gallery:', err);
      setError(err.message || 'Failed to pick video from gallery');
    }
  };

  /** SENDER: pick a video from device storage. */
  const handlePickFromFiles = async () => {
    try {
      setError(null);
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const uri = asset.uri;
      const fileName = asset.name || uri.split('/').pop() || 'selected_video.mp4';
      let size = asset.size || 0;

      if (!size) {
        try {
          const info = await FileSystem.getInfoAsync(uri);
          if (info.exists && 'size' in info) {
            size = (info as any).size || 0;
          }
        } catch {
          // ignore
        }
      }

      setSelectedVideo({
        uri,
        name: fileName,
        size,
        mimeType: asset.mimeType || 'video/mp4',
      });
    } catch (err: any) {
      console.error('Error picking video from files:', err);
      setError(err.message || 'Failed to pick file from device');
    }
  };

  /** SENDER: prepare the transfer and request a pairing code. */
  const handleStartPreProcessingAndPair = async () => {
    if (!selectedVideo) {
      setError('Please select a video from your device first.');
      return;
    }

    const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB limit
    if (selectedVideo.size > MAX_VIDEO_SIZE) {
      setError(
        `Selected video is ${(selectedVideo.size / (1024 * 1024 * 1024)).toFixed(2)} GB. The maximum allowed transfer size is 2 GB.`
      );
      return;
    }

    setError(null);
    setIsPreProcessing(true);
    setPreProcessProgress(10);
    setPreProcessStep('Preparing the selected video…');

    try {
      // Prepare the transfer descriptor. No full-file read happens here: chunks
      // are streamed off disk on demand once the transfer starts, so even a 2 GB
      // video uses almost no memory. The chunk size follows the measured link.
      const chunkSize = VideoTransferService.recommendedChunkSize();
      const preprocessed = await VideoTransferService.preProcessVideo(
        selectedVideo.uri,
        selectedVideo.name,
        selectedVideo.mimeType || 'video/mp4',
        chunkSize,
        (progress, step) => {
          setPreProcessProgress(progress);
          setPreProcessStep(step);
        }
      );

      setPreProcessedVideo(preprocessed);
      setPreProcessProgress(100);
      setPreProcessStep('Ready — requesting pairing code…');

      setLoading(true);
      const res = await PairingService.createPair();
      setPairingCode(res.pairingCode);
      setIsPreProcessing(false);
    } catch (err: any) {
      setIsPreProcessing(false);
      setError(err.message || 'Pre-processing or pairing code generation failed');
    } finally {
      setLoading(false);
    }
  };

  /** SENDER: storage verified — start streaming. */
  const handleConfirmAndStartTransfer = async () => {
    if (!preProcessedVideo) return;
    setIsTransferStarting(true);
    setError(null);

    try {
      const transferId = await VideoTransferService.sendPreProcessedVideo(preProcessedVideo, {
        onProgress: (progress) => {
          upsertTransfer(progress);
        },
        onComplete: () => {
          console.log('Video transfer completed successfully!');
        },
        onError: (err) => {
          setError(err);
        },
      });

      const initialProgress = VideoTransferService.getTransfer(transferId);
      if (initialProgress) {
        upsertTransfer(initialProgress);
      }

      navigation.replace('Chat');
    } catch (err: any) {
      setIsTransferStarting(false);
      setError(err.message || 'Failed to start video transfer');
    }
  };

  /** SENDER: abandon the transfer. */
  const handleCancelTransfer = () => {
    PairingService.resetPairing();
    setReceiverStorage(null);
    setStorageCheckResult(null);
    setPairingCode('');
    setPreProcessedVideo(null);
    setSelectedVideo(null);
    setIsSuccess(false);
    navigation.goBack();
  };

  /** RECEIVER: enter code, report storage, pair. */
  const handleJoin = async () => {
    if (inputCode.trim().length !== 6) {
      setError('Please enter a valid 6-digit pairing code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const storage = await StorageService.getStorageInfo();
      await PairingService.joinPair(inputCode.trim(), storage);

      setIsSuccess(true);
      setReceiverWaitingMessage(
        'Connected with the sender. Waiting for them to confirm storage and start the transfer…'
      );
    } catch (err: any) {
      setError(err.message || 'Invalid or expired pairing code');
    } finally {
      setLoading(false);
    }
  };

  const videoSizeMb = selectedVideo ? selectedVideo.size / (1024 * 1024) : 0;

  return (
    <SafeScreen padded={false}>
      {/*
        `behavior="padding"` on Android as well as iOS: since edge-to-edge became
        the default, Android no longer honours `adjustResize`, so the code input
        used to end up behind the keyboard.
      */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              <GlassIconButton
                name="back"
                accessibilityLabel="Back to home"
                onPress={() => navigation.goBack()}
              />
              <Text style={styles.topBarTitle}>Pair devices</Text>
            </View>
            <View style={styles.topBarRight}>
              {localDeviceStorage && (
                <Pill label={`${localDeviceStorage.freeFormatted} free`} icon="database" />
              )}
              <ThemePicker />
            </View>
          </View>

          <SegmentedControl
            options={[
              { value: 'select_file', label: 'Send', icon: 'upload' },
              { value: 'receive', label: 'Receive', icon: 'download' },
            ]}
            value={mode}
            onChange={(value) => {
              setMode(value as 'select_file' | 'receive');
              setError(null);
            }}
            style={styles.modeSwitch}
          />

          {/* ============================ FLOW A: SEND ============================ */}
          {mode === 'select_file' ? (
            <View style={styles.flow}>
              {/* Stage 1 — choose a file */}
              {!preProcessedVideo && !isPreProcessing && (
                <View style={styles.stage}>
                  <SectionLabel>Step 1 of 3</SectionLabel>
                  <Text style={styles.stageTitle}>Choose a video</Text>
                  <Text style={styles.stageSubtitle}>
                    Nothing is uploaded. The file stays on your device and is streamed straight
                    to the other phone.
                  </Text>

                  {!selectedVideo ? (
                    <View style={styles.stack}>
                      <SourceOption
                        icon="film"
                        title="Camera roll"
                        subtitle="Videos from your gallery"
                        onPress={handlePickFromGallery}
                      />
                      <SourceOption
                        icon="database"
                        title="Browse files"
                        subtitle="Any video in device storage"
                        onPress={handlePickFromFiles}
                      />
                      <View style={styles.limitNote}>
                        <Icon name="alert" size={13} color={theme.colors.textMuted} />
                        <Text style={styles.limitText}>Maximum file size is 2 GB</Text>
                      </View>
                    </View>
                  ) : (
                    <GlassCard tone="elevated" corner="lg" depth={2}>
                      <View style={styles.selectedHeader}>
                        <View style={styles.selectedIcon}>
                          <LinearGradient
                            colors={theme.colors.accentGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFill}
                          />
                          <Icon name="film" size={20} color={theme.colors.onAccent} />
                        </View>
                        <View style={styles.selectedInfo}>
                          <Text style={styles.selectedName} numberOfLines={1}>
                            {selectedVideo.name}
                          </Text>
                          <Text style={styles.selectedMeta}>
                            {formatBytes(selectedVideo.size)}
                            {selectedVideo.duration
                              ? ` · ${Math.round(selectedVideo.duration / 1000)}s`
                              : ''}
                            {selectedVideo.width && selectedVideo.height
                              ? ` · ${selectedVideo.width}×${selectedVideo.height}`
                              : ''}
                          </Text>
                        </View>
                      </View>

                      <Divider />

                      <View style={styles.selectedActions}>
                        <GradientButton
                          label="Change"
                          variant="ghost"
                          size="sm"
                          fullWidth={false}
                          icon="refresh"
                          onPress={() => setSelectedVideo(null)}
                          style={styles.changeButton}
                        />
                        <GradientButton
                          label="Generate code"
                          iconRight="arrowRight"
                          onPress={handleStartPreProcessingAndPair}
                          loading={loading}
                          style={styles.growButton}
                        />
                      </View>
                    </GlassCard>
                  )}
                </View>
              )}

              {/* Stage 2 — preparing */}
              {isPreProcessing && (
                <View style={styles.stage}>
                  <SectionLabel>Step 2 of 3</SectionLabel>
                  <Text style={styles.stageTitle}>Preparing transfer</Text>
                  <Text style={styles.stageSubtitle}>{preProcessStep}</Text>

                  <GlassCard corner="lg" depth={1} style={styles.preprocessCard}>
                    <View style={styles.preprocessRow}>
                      <Text style={styles.preprocessPercent}>{preProcessProgress}%</Text>
                      <Text style={styles.preprocessStep} numberOfLines={2}>
                        {preProcessStep}
                      </Text>
                    </View>
                    <ProgressTrack value={preProcessProgress / 100} height={8} style={styles.preprocessTrack} />

                    <View style={styles.checklist}>
                      {[
                        { at: 15, label: 'Locating the file on device' },
                        { at: 45, label: 'Measuring size and planning chunks' },
                        { at: 80, label: 'Computing transfer fingerprint' },
                      ].map((item) => {
                        const done = preProcessProgress >= item.at;
                        return (
                          <View key={item.label} style={styles.checkRow}>
                            <View
                              style={[
                                styles.checkMark,
                                {
                                  backgroundColor: done ? theme.colors.success : 'transparent',
                                  borderColor: done
                                    ? theme.colors.success
                                    : theme.colors.surfaceBorder,
                                },
                              ]}
                            >
                              {done && (
                                <Icon name="check" size={10} color={theme.colors.onAccent} />
                              )}
                            </View>
                            <Text
                              style={[
                                styles.checkLabel,
                                { color: done ? theme.colors.textPrimary : theme.colors.textMuted },
                              ]}
                            >
                              {item.label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </GlassCard>
                </View>
              )}

              {/* Stage 3 — code shown, waiting for receiver */}
              {preProcessedVideo && pairingCode && !receiverStorage && (
                <View style={styles.stage}>
                  <SectionLabel>Step 3 of 3</SectionLabel>
                  <Text style={styles.stageTitle}>Share this code</Text>
                  <Text style={styles.stageSubtitle}>
                    Ask the other device to choose Receive and enter it.
                  </Text>

                  <GlassCard corner="lg" depth={1} style={styles.summaryCard}>
                    <InfoRow label="File" value={preProcessedVideo.fileName} />
                    <Divider style={styles.tightDivider} />
                    <InfoRow label="Size" value={formatBytes(preProcessedVideo.fileSize)} />
                    <Divider style={styles.tightDivider} />
                    <InfoRow
                      label="Chunks"
                      value={`${preProcessedVideo.totalChunks} × ${formatBytes(
                        preProcessedVideo.chunkSize
                      )}`}
                    />
                  </GlassCard>

                  <PairCode code={pairingCode} />

                  <View style={styles.waitingRow}>
                    <View style={styles.waitingDot} />
                    <Text style={styles.waitingText}>Waiting for the receiver…</Text>
                  </View>
                </View>
              )}

              {/* Stage 4 — storage gate */}
              {preProcessedVideo && receiverStorage && (
                <View style={styles.stage}>
                  <SectionLabel>Almost there</SectionLabel>
                  <Text style={styles.stageTitle}>Storage check</Text>
                  <Text style={styles.stageSubtitle}>
                    The receiver's free space is confirmed before a single byte is sent.
                  </Text>

                  <GlassCard corner="lg" depth={1}>
                    <View style={styles.connectedRow}>
                      <View
                        style={[
                          styles.connectedIcon,
                          { backgroundColor: 'rgba(74,222,128,0.16)' },
                        ]}
                      >
                        <Icon name="check" size={15} color={theme.colors.success} />
                      </View>
                      <Text style={styles.connectedText}>Receiver connected</Text>
                    </View>

                    <Divider />

                    <InfoRow
                      label="Required"
                      value={`${(preProcessedVideo.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                    />
                    <Divider style={styles.tightDivider} />
                    <InfoRow
                      label="Receiver free space"
                      value={receiverStorage.freeFormatted}
                      valueColor={theme.colors.success}
                    />
                    <Divider style={styles.tightDivider} />
                    <InfoRow label="Receiver total" value={receiverStorage.totalFormatted} />

                    {storageCheckResult && (
                      <View
                        style={[
                          styles.verdict,
                          {
                            borderColor: storageCheckResult.sufficient
                              ? theme.colors.success
                              : theme.colors.warning,
                            backgroundColor: storageCheckResult.sufficient
                              ? 'rgba(74,222,128,0.12)'
                              : 'rgba(251,191,36,0.12)',
                          },
                        ]}
                      >
                        <Icon
                          name={storageCheckResult.sufficient ? 'check' : 'alert'}
                          size={14}
                          color={
                            storageCheckResult.sufficient
                              ? theme.colors.success
                              : theme.colors.warning
                          }
                        />
                        <Text style={styles.verdictText}>{storageCheckResult.message}</Text>
                      </View>
                    )}
                  </GlassCard>

                  {storageCheckResult?.sufficient ? (
                    <GradientButton
                      label="Start transfer"
                      iconRight="arrowRight"
                      onPress={handleConfirmAndStartTransfer}
                      loading={isTransferStarting}
                    />
                  ) : (
                    <GlassCard corner="lg" depth={0} flat>
                      <Text style={styles.blockedText}>
                        Transfer blocked — the receiver does not have enough free space.
                      </Text>
                    </GlassCard>
                  )}

                  <GradientButton
                    label="Cancel"
                    variant="ghost"
                    onPress={handleCancelTransfer}
                    style={styles.cancelButton}
                  />
                </View>
              )}
            </View>
          ) : (
            /* ========================== FLOW B: RECEIVE ========================== */
            <View style={styles.flow}>
              {isSuccess && receiverWaitingMessage ? (
                <View style={styles.stage}>
                  <SectionLabel>Paired</SectionLabel>
                  <Text style={styles.stageTitle}>Waiting for the sender</Text>
                  <Text style={styles.stageSubtitle}>{receiverWaitingMessage}</Text>

                  <GlassCard corner="lg" depth={1} tone="elevated">
                    <View style={styles.connectedRow}>
                      <View
                        style={[
                          styles.connectedIcon,
                          { backgroundColor: 'rgba(74,222,128,0.16)' },
                        ]}
                      >
                        <Icon name="check" size={15} color={theme.colors.success} />
                      </View>
                      <Text style={styles.connectedText}>Storage shared with the sender</Text>
                    </View>

                    {localDeviceStorage && (
                      <>
                        <Divider />
                        <InfoRow
                          label="Free space"
                          value={localDeviceStorage.freeFormatted}
                          valueColor={theme.colors.success}
                        />
                        <Divider style={styles.tightDivider} />
                        <InfoRow label="Total space" value={localDeviceStorage.totalFormatted} />
                      </>
                    )}
                  </GlassCard>

                  <View style={styles.waitingRow}>
                    <View style={styles.waitingDot} />
                    <Text style={styles.waitingText}>Awaiting transfer initiation…</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.stage}>
                  <SectionLabel>Step 1 of 2</SectionLabel>
                  <Text style={styles.stageTitle}>Enter the code</Text>
                  <Text style={styles.stageSubtitle}>
                    Type the 6-digit code shown on the sender's screen.
                  </Text>

                  <TextInput
                    style={styles.codeInput}
                    placeholder="000000"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={inputCode}
                    onChangeText={(text) => {
                      setInputCode(text.replace(/[^0-9]/g, ''));
                      setError(null);
                    }}
                  />

                  <GlassCard corner="lg" depth={1}>
                    <View style={styles.storageHeader}>
                      <Text style={styles.storageTitle}>Your available storage</Text>
                      {localDeviceStorage && (
                        <Pill
                          label={`${localDeviceStorage.freeFormatted} free`}
                          tone="success"
                        />
                      )}
                    </View>

                    {localDeviceStorage && (
                      <>
                        <ProgressTrack
                          value={1 - localDeviceStorage.freeBytes / localDeviceStorage.totalBytes}
                          height={8}
                          color={theme.colors.warm}
                          style={styles.storageTrack}
                        />
                        <View style={styles.storageLabels}>
                          <Text style={styles.storageLabelText}>
                            Total {localDeviceStorage.totalFormatted}
                          </Text>
                          <Text style={styles.storageLabelText}>
                            Available {localDeviceStorage.freeFormatted}
                          </Text>
                        </View>
                      </>
                    )}

                    <Text style={styles.storageExplainer}>
                      Your free space is shared with the sender so they can confirm the transfer
                      will fit before starting.
                    </Text>
                  </GlassCard>

                  <GradientButton
                    label="Pair and verify"
                    iconRight="arrowRight"
                    onPress={handleJoin}
                    loading={loading}
                    disabled={inputCode.trim().length !== 6}
                  />
                </View>
              )}
            </View>
          )}

          {error && (
            <GlassCard
              corner="lg"
              depth={0}
              contentStyle={styles.errorRow}
              style={styles.errorCard}
            >
              <Icon name="alert" size={15} color={theme.colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </GlassCard>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
};

const createStyles = (theme: Theme) => {
  const c = theme.colors;
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
      gap: spacing.md,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.sm,
    },
    topBarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
    },
    topBarTitle: {
      ...typography.heading,
      color: c.textPrimary,
      marginLeft: spacing.md,
    },
    topBarRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    modeSwitch: {
      marginTop: spacing.lg,
    },
    flow: {
      marginTop: spacing.lg,
      gap: spacing.lg,
    },
    stage: {
      gap: spacing.md,
    },
    stageTitle: {
      ...typography.title,
      color: c.textPrimary,
    },
    stageSubtitle: {
      ...typography.bodySmall,
      color: c.textSecondary,
      marginTop: -spacing.xs,
    },
    stack: {
      gap: spacing.md,
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sourceIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    sourceText: {
      flex: 1,
    },
    sourceTitle: {
      ...typography.subheading,
      color: c.textPrimary,
    },
    sourceSubtitle: {
      ...typography.caption,
      color: c.textSecondary,
      marginTop: 1,
    },
    limitNote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    limitText: {
      ...typography.caption,
      color: c.textMuted,
    },
    selectedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    selectedIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    selectedInfo: {
      flex: 1,
    },
    selectedName: {
      ...typography.subheading,
      color: c.textPrimary,
    },
    selectedMeta: {
      ...typography.caption,
      color: c.textSecondary,
      marginTop: 2,
    },
    selectedActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    changeButton: {
      flex: 0,
    },
    growButton: {
      flex: 1,
    },
    preprocessCard: {
      marginTop: spacing.sm,
    },
    preprocessRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginBottom: spacing.md,
    },
    preprocessPercent: {
      ...typography.numeric,
      color: c.accent,
      marginRight: spacing.md,
    },
    preprocessStep: {
      ...typography.bodySmall,
      color: c.textSecondary,
      flex: 1,
    },
    preprocessTrack: {
      marginBottom: spacing.lg,
    },
    checklist: {
      gap: spacing.sm,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    checkMark: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    checkLabel: {
      ...typography.caption,
    },
    summaryCard: {
      marginBottom: spacing.sm,
    },
    tightDivider: {
      marginVertical: spacing.xs + 1,
    },
    waitingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    waitingDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: c.accentAlt,
      marginRight: spacing.sm,
    },
    waitingText: {
      ...typography.bodySmall,
      color: c.textSecondary,
    },
    connectedRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    connectedIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    connectedText: {
      ...typography.subheading,
      color: c.textPrimary,
    },
    verdict: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: hairlineWidth,
    },
    verdictText: {
      ...typography.caption,
      color: c.textPrimary,
      flex: 1,
    },
    blockedText: {
      ...typography.bodySmall,
      color: c.warning,
      textAlign: 'center',
    },
    cancelButton: {
      marginTop: spacing.xs,
    },
    codeInput: {
      ...typography.display,
      color: c.textPrimary,
      textAlign: 'center',
      letterSpacing: 12,
      paddingVertical: spacing.lg,
      backgroundColor: c.inputBg,
      borderRadius: radius.lg,
      borderWidth: hairlineWidth,
      borderColor: c.inputBorder,
    },
    storageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    storageTitle: {
      ...typography.subheading,
      color: c.textPrimary,
    },
    storageTrack: {
      marginBottom: spacing.sm,
    },
    storageLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    storageLabelText: {
      ...typography.caption,
      color: c.textSecondary,
    },
    storageExplainer: {
      ...typography.caption,
      color: c.textMuted,
      lineHeight: 16,
    },
    errorCard: {
      marginTop: spacing.md,
      borderColor: c.danger,
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    errorText: {
      ...typography.bodySmall,
      color: c.danger,
      flex: 1,
    },
  });
};
