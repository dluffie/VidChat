import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { PairingService } from '../services/pairing';
import { WebSocketClient } from '../services/websocket';
import { StorageService } from '../services/storage';
import { FileSystemService } from '../services/fileSystem';
import { VideoTransferService, PreProcessedVideo } from '../services/videoTransfer';
import { useTransferStore } from '../store/transferStore';
import { PairCode } from '../components/PairCode';
import { DeviceStorageInfo } from '../types/pairing';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { base64ToUint8Array } from '../utils/encoding';

interface PairScreenProps {
  route: any;
  navigation: any;
}

interface VideoPreset {
  name: string;
  sizeMb: number;
  description: string;
  resolution: string;
}

const SAMPLE_PRESETS: VideoPreset[] = [
  { name: 'sample_nature_720p.mp4', sizeMb: 5.0, description: 'Nature Doc Clip (720p)', resolution: '1280x720' },
  { name: 'sample_drone_1080p.mp4', sizeMb: 12.5, description: 'City Drone Tour (1080p)', resolution: '1920x1080' },
  { name: 'sample_action_4k.mp4', sizeMb: 25.0, description: 'Action Reel (High Bitrate 4K)', resolution: '3840x2160' },
  { name: 'sample_micro_test.mp4', sizeMb: 1.0, description: 'Quick Benchmark Video', resolution: '640x360' },
];

export const PairScreen: React.FC<PairScreenProps> = ({ route, navigation }) => {
  const initialMode = route.params?.mode || 'select_file';
  const [mode, setMode] = useState<'select_file' | 'receive'>(
    initialMode === 'receive' || initialMode === 'join' ? 'receive' : 'select_file'
  );

  // Common State
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [pairingCode, setPairingCode] = useState<string>('');

  // Sender / File Selector State
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(1); // Default to 12.5 MB
  const [customFileName, setCustomFileName] = useState<string>('');
  const [customSizeMb, setCustomSizeMb] = useState<string>('10');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [pickedVideoFile, setPickedVideoFile] = useState<{ uri: string; name: string; size: number } | null>(null);
  const [pickedBinaryData, setPickedBinaryData] = useState<Uint8Array | null>(null);

  // Pre-Processing State
  const [isPreProcessing, setIsPreProcessing] = useState<boolean>(false);
  const [preProcessProgress, setPreProcessProgress] = useState<number>(0);
  const [preProcessStep, setPreProcessStep] = useState<string>('');
  const [preProcessedVideo, setPreProcessedVideo] = useState<PreProcessedVideo | null>(null);

  // Receiver Storage Verification on Sender
  const [receiverStorage, setReceiverStorage] = useState<DeviceStorageInfo | null>(null);
  const [storageCheckResult, setStorageCheckResult] = useState<{
    sufficient: boolean;
    requiredFormatted: string;
    availableFormatted: string;
    message: string;
  } | null>(null);
  const [isTransferStarting, setIsTransferStarting] = useState<boolean>(false);

  // Receiver State
  const [inputCode, setInputCode] = useState<string>('');
  const [localDeviceStorage, setLocalDeviceStorage] = useState<DeviceStorageInfo | null>(null);
  const [receiverWaitingMessage, setReceiverWaitingMessage] = useState<string | null>(null);

  const { upsertTransfer } = useTransferStore();

  useEffect(() => {
    const ws = WebSocketClient.getInstance();

    // Ensure partner pairing success listener is registered
    PairingService.initPairSuccessListener();

    // Load local device storage
    StorageService.getStorageInfo().then((info) => {
      setLocalDeviceStorage(info);
    });

    // Handle pair:success event
    const handlePairSuccess = (data: any) => {
      setIsSuccess(true);

      // If receiver storage is attached to pair:success (received by Sender)
      if (data.receiverStorage) {
        setReceiverStorage(data.receiverStorage);
      }

      // If in receive mode, show confirmation that storage was shared and wait for sender
      if (mode === 'receive') {
        setReceiverWaitingMessage(
          'Paired successfully! Device storage details transmitted to sender. Waiting for sender to verify storage and initiate transfer...'
        );
      }
    };

    // Handle real-time storage info update
    const handleStorageInfo = (data: { storage: DeviceStorageInfo }) => {
      if (data.storage) {
        setReceiverStorage(data.storage);
      }
    };

    // If receiver receives video:start, navigate to chat/transfer
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

  // Re-run storage verification when receiverStorage or preProcessedVideo changes
  useEffect(() => {
    if (receiverStorage && preProcessedVideo) {
      const check = StorageService.verifyStorage(
        preProcessedVideo.fileSize,
        receiverStorage.freeBytes
      );
      setStorageCheckResult(check);
    }
  }, [receiverStorage, preProcessedVideo]);

  /**
   * SENDER STEP 1: Select File -> Start Video Pre-processing -> Generate 6-Digit Code
   */
  const handleStartPreProcessingAndPair = async () => {
    setError(null);
    setIsPreProcessing(true);
    setPreProcessProgress(0);
    setPreProcessStep('Initializing file binary...');

    try {
      let fileName: string;
      let binaryData: Uint8Array;
      let mimeType: string = 'video/mp4';

      if (pickedVideoFile && pickedBinaryData) {
        fileName = pickedVideoFile.name;
        binaryData = pickedBinaryData;
      } else {
        fileName = isCustomMode
          ? customFileName.trim() || 'custom_video.mp4'
          : SAMPLE_PRESETS[selectedPresetIndex].name;
        const sizeMb = isCustomMode
          ? parseFloat(customSizeMb) || 10
          : SAMPLE_PRESETS[selectedPresetIndex].sizeMb;
        const sizeInBytes = Math.floor(sizeMb * 1024 * 1024);

        // 1. Prepare video binary data
        setPreProcessStep('Preparing video stream data...');
        setPreProcessProgress(10);
        const mockVideo = FileSystemService.createMockVideo(fileName, sizeInBytes);
        binaryData = mockVideo.data;
      }

      // 2. Pre-process: Slicing chunks, Base64 text-safe encoding, and SHA-256 calculation
      const preprocessed = await VideoTransferService.preProcessVideo(
        fileName,
        binaryData,
        mimeType,
        64 * 1024,
        (progress, step) => {
          setPreProcessProgress(progress);
          setPreProcessStep(step);
        }
      );

      setPreProcessedVideo(preprocessed);
      setPreProcessProgress(100);
      setPreProcessStep('Pre-processing complete ✓ Requesting 6-digit code...');

      // 3. Generate 6-figure pairing code from backend
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

  /**
   * SENDER: Pick Real Video from device storage
   */
  const handlePickRealVideo = async () => {
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
      const fileName = asset.name || 'selected_video.mp4';
      const uri = asset.uri;

      setIsPreProcessing(true);
      setPreProcessProgress(5);
      setPreProcessStep('Reading selected video from device storage...');

      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binaryData = base64ToUint8Array(base64Data);
      const actualSize = asset.size || binaryData.byteLength;

      setPickedVideoFile({
        uri,
        name: fileName,
        size: actualSize,
      });
      setPickedBinaryData(binaryData);
      setIsCustomMode(false);

      // Proceed with preProcessVideo flow
      const preprocessed = await VideoTransferService.preProcessVideo(
        fileName,
        binaryData,
        asset.mimeType || 'video/mp4',
        64 * 1024,
        (progress, step) => {
          setPreProcessProgress(progress);
          setPreProcessStep(step);
        }
      );

      setPreProcessedVideo(preprocessed);
      setPreProcessProgress(100);
      setPreProcessStep('Pre-processing complete ✓ Requesting 6-digit code...');

      setLoading(true);
      const res = await PairingService.createPair();
      setPairingCode(res.pairingCode);
      setIsPreProcessing(false);
    } catch (err: any) {
      setIsPreProcessing(false);
      setError(err.message || 'Failed to read or pre-process selected video');
    } finally {
      setLoading(false);
    }
  };

  /**
   * SENDER STEP 2: Storage Verified -> Start Video Transfer
   */
  const handleConfirmAndStartTransfer = async () => {
    if (!preProcessedVideo) return;
    setIsTransferStarting(true);
    setError(null);

    try {
      const transferId = await VideoTransferService.sendPreProcessedVideo(
        preProcessedVideo,
        {
          onProgress: (progress) => {
            upsertTransfer(progress);
          },
          onComplete: () => {
            console.log('Video transfer completed successfully!');
          },
          onError: (err) => {
            setError(err);
          },
        }
      );

      const initialProgress = VideoTransferService.getTransfer(transferId);
      if (initialProgress) {
        upsertTransfer(initialProgress);
      }

      // Navigate to Chat to show live bubble and progress
      navigation.replace('Chat');
    } catch (err: any) {
      setIsTransferStarting(false);
      setError(err.message || 'Failed to start video transfer');
    }
  };

  /**
   * SENDER: Cancel Transfer to eliminate unwanted transfer
   */
  const handleCancelTransfer = () => {
    PairingService.resetPairing();
    setReceiverStorage(null);
    setStorageCheckResult(null);
    setPairingCode('');
    setPreProcessedVideo(null);
    setPickedVideoFile(null);
    setPickedBinaryData(null);
    setIsSuccess(false);
    navigation.goBack();
  };

  /**
   * RECEIVER STEP: Enter Code -> Report Storage -> Pair
   */
  const handleJoin = async () => {
    if (inputCode.trim().length !== 6) {
      setError('Please enter a valid 6-digit pairing code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Gather latest storage info
      const storage = await StorageService.getStorageInfo();

      // Join pair and pass storage details
      await PairingService.joinPair(inputCode.trim(), storage);

      setIsSuccess(true);
      setReceiverWaitingMessage(
        'Connected with Sender! Storage details verified. Waiting for sender to initiate transfer...'
      );
    } catch (err: any) {
      setError(err.message || 'Invalid or expired pairing code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>← Back to Home</Text>
            </TouchableOpacity>

            {localDeviceStorage && (
              <View style={styles.deviceStorageBadge}>
                <Text style={styles.deviceStorageBadgeText}>
                  💾 Free: {localDeviceStorage.freeFormatted}
                </Text>
              </View>
            )}
          </View>

          {/* Mode Switcher Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === 'select_file' && styles.activeTabSend]}
              onPress={() => {
                setMode('select_file');
                setError(null);
              }}
            >
              <Text style={[styles.tabText, mode === 'select_file' && styles.activeTabText]}>
                🎬 Select File (Send)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, mode === 'receive' && styles.activeTabReceive]}
              onPress={() => {
                setMode('receive');
                setError(null);
              }}
            >
              <Text style={[styles.tabText, mode === 'receive' && styles.activeTabText]}>
                📥 Receive Video
              </Text>
            </TouchableOpacity>
          </View>

          {/* ========================================================================= */}
          {/* FLOW A: SELECT FILE (SENDER) */}
          {/* ========================================================================= */}
          {mode === 'select_file' ? (
            <View style={styles.contentCard}>
              {/* STAGE 1: File Selection */}
              {!preProcessedVideo && !isPreProcessing && (
                <View>
                  <Text style={styles.sectionHeaderTitle}>Select Video to Transfer</Text>
                  <Text style={styles.sectionSubtext}>
                    Selecting a video will start local pre-processing (SHA-256 integrity hash & Base64 chunking) and generate your 6-digit pairing code.
                  </Text>

                  <Text style={styles.presetLabel}>Choose Sample Video Preset:</Text>
                  {SAMPLE_PRESETS.map((preset, index) => {
                    const isSelected = !isCustomMode && !pickedVideoFile && selectedPresetIndex === index;
                    return (
                      <TouchableOpacity
                        key={preset.name}
                        style={[styles.presetCard, isSelected && styles.presetCardSelected]}
                        activeOpacity={0.8}
                        onPress={() => {
                          setIsCustomMode(false);
                          setPickedVideoFile(null);
                          setPickedBinaryData(null);
                          setSelectedPresetIndex(index);
                        }}
                      >
                        <View style={styles.presetLeft}>
                          <Text style={styles.presetIcon}>🎬</Text>
                          <View>
                            <Text style={styles.presetName}>{preset.description}</Text>
                            <Text style={styles.presetDetails}>
                              {preset.resolution} • {preset.name}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.presetSizeBadge}>
                          <Text style={styles.presetSizeText}>{preset.sizeMb.toFixed(1)} MB</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Pick Real Video Option */}
                  <TouchableOpacity
                    style={[styles.presetCard, pickedVideoFile && !isCustomMode && styles.presetCardSelected]}
                    activeOpacity={0.8}
                    onPress={handlePickRealVideo}
                  >
                    <View style={styles.presetLeft}>
                      <Text style={styles.presetIcon}>📱</Text>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.presetName}>
                          {pickedVideoFile ? `Picked: ${pickedVideoFile.name}` : 'Pick Real Video'}
                        </Text>
                        <Text style={styles.presetDetails}>
                          {pickedVideoFile
                            ? `${(pickedVideoFile.size / (1024 * 1024)).toFixed(1)} MB • Real device video`
                            : 'Select video from device gallery or files'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.presetSizeBadge, pickedVideoFile ? { backgroundColor: '#064E3B' } : undefined]}>
                      <Text style={styles.presetSizeText}>
                        {pickedVideoFile ? `${(pickedVideoFile.size / (1024 * 1024)).toFixed(1)} MB` : 'Browse 📂'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Custom Video Option */}
                  <TouchableOpacity
                    style={[styles.presetCard, isCustomMode && styles.presetCardSelected]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setIsCustomMode(true);
                      setPickedVideoFile(null);
                      setPickedBinaryData(null);
                    }}
                  >
                    <View style={styles.presetLeft}>
                      <Text style={styles.presetIcon}>📁</Text>
                      <View>
                        <Text style={styles.presetName}>Custom File Size & Name</Text>
                        <Text style={styles.presetDetails}>Specify arbitrary video parameters</Text>
                      </View>
                    </View>
                    <Text style={styles.customArrow}>✏️</Text>
                  </TouchableOpacity>

                  {isCustomMode && (
                    <View style={styles.customBox}>
                      <Text style={styles.inputLabel}>File Name:</Text>
                      <TextInput
                        style={styles.textInput}
                        value={customFileName}
                        onChangeText={setCustomFileName}
                        placeholder="my_vacation_clip.mp4"
                        placeholderTextColor="#475569"
                      />
                      <Text style={styles.inputLabel}>File Size (MB):</Text>
                      <TextInput
                        style={styles.textInput}
                        value={customSizeMb}
                        onChangeText={setCustomSizeMb}
                        keyboardType="decimal-pad"
                        placeholder="15"
                        placeholderTextColor="#475569"
                      />
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.primaryActionButton}
                    activeOpacity={0.85}
                    onPress={handleStartPreProcessingAndPair}
                  >
                    <Text style={styles.primaryActionButtonText}>
                      Start Pre-Processing & Generate Code →
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* STAGE 2: Video Pre-processing in Progress */}
              {isPreProcessing && (
                <View style={styles.preProcessingBox}>
                  <ActivityIndicator size="large" color="#10B981" />
                  <Text style={styles.preProcessingTitle}>Pre-Processing Video...</Text>
                  <Text style={styles.preProcessingStep}>{preProcessStep}</Text>

                  {/* Progress Bar */}
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${preProcessProgress}%` }]} />
                  </View>
                  <Text style={styles.progressPercent}>{preProcessProgress}%</Text>

                  <View style={styles.preProcessingChecklist}>
                    <Text style={styles.checkItem}>✓ Reading binary video stream</Text>
                    <Text style={styles.checkItem}>
                      {preProcessProgress >= 30 ? '✓' : '○'} Computing SHA-256 checksum
                    </Text>
                    <Text style={styles.checkItem}>
                      {preProcessProgress >= 90 ? '✓' : '○'} Progressive Base64 chunk slicing
                    </Text>
                  </View>
                </View>
              )}

              {/* STAGE 3: 6-Digit Pairing Code Generated & Waiting for Receiver */}
              {preProcessedVideo && pairingCode && !receiverStorage && (
                <View style={styles.codeGeneratedBox}>
                  <View style={styles.videoSummaryCard}>
                    <Text style={styles.videoSummaryHeader}>READY FOR TRANSFER</Text>
                    <Text style={styles.videoSummaryTitle}>{preProcessedVideo.fileName}</Text>
                    <View style={styles.videoSummaryRow}>
                      <Text style={styles.videoSummaryStat}>
                        📦 Size: {(preProcessedVideo.fileSize / (1024 * 1024)).toFixed(1)} MB
                      </Text>
                      <Text style={styles.videoSummaryStat}>
                        🧩 Chunks: {preProcessedVideo.totalChunks}
                      </Text>
                    </View>
                    <Text style={styles.videoSummaryHash} numberOfLines={1}>
                      🔐 SHA-256: {preProcessedVideo.checksum}
                    </Text>
                  </View>

                  <Text style={styles.pairInstruction}>
                    Have the receiver select "Receive" and enter this 6-digit code:
                  </Text>

                  <PairCode code={pairingCode} />

                  <View style={styles.waitingReceiverPill}>
                    <ActivityIndicator size="small" color="#38BDF8" />
                    <Text style={styles.waitingReceiverText}>
                      Waiting for receiver to enter code & report storage...
                    </Text>
                  </View>
                </View>
              )}

              {/* STAGE 4: Receiver Paired & Storage Verification Gate */}
              {preProcessedVideo && receiverStorage && (
                <View style={styles.verificationBox}>
                  <View style={styles.connectedBanner}>
                    <Text style={styles.connectedBannerText}>✓ Receiver Connected!</Text>
                  </View>

                  <Text style={styles.verifyTitle}>Receiver Storage Verification</Text>
                  <Text style={styles.verifySubtitle}>
                    Eliminating unwanted transfer by confirming receiver capacity:
                  </Text>

                  <View style={styles.storageCompareCard}>
                    <View style={styles.compareRow}>
                      <Text style={styles.compareLabel}>Video Size Required:</Text>
                      <Text style={styles.compareValueReq}>
                        {(preProcessedVideo.fileSize / (1024 * 1024)).toFixed(1)} MB
                      </Text>
                    </View>

                    <View style={styles.compareRow}>
                      <Text style={styles.compareLabel}>Receiver Available Space:</Text>
                      <Text style={styles.compareValueAvail}>{receiverStorage.freeFormatted}</Text>
                    </View>

                    <View style={styles.compareRow}>
                      <Text style={styles.compareLabel}>Receiver Total Space:</Text>
                      <Text style={styles.compareValue}>{receiverStorage.totalFormatted}</Text>
                    </View>

                    {storageCheckResult && (
                      <View
                        style={[
                          styles.verdictBox,
                          storageCheckResult.sufficient ? styles.verdictGood : styles.verdictBad,
                        ]}
                      >
                        <Text style={styles.verdictIcon}>
                          {storageCheckResult.sufficient ? '✅' : '⚠️'}
                        </Text>
                        <Text style={styles.verdictText}>{storageCheckResult.message}</Text>
                      </View>
                    )}
                  </View>

                  {/* Verification Actions */}
                  {storageCheckResult?.sufficient ? (
                    <TouchableOpacity
                      style={styles.startTransferBtn}
                      activeOpacity={0.85}
                      onPress={handleConfirmAndStartTransfer}
                      disabled={isTransferStarting}
                    >
                      {isTransferStarting ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.startTransferBtnText}>
                          🚀 Storage Verified — Start Video Transfer
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.blockedBox}>
                      <Text style={styles.blockedText}>
                        Transfer blocked due to insufficient storage on receiver.
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.cancelTransferBtn}
                    activeOpacity={0.8}
                    onPress={handleCancelTransfer}
                  >
                    <Text style={styles.cancelTransferBtnText}>❌ Cancel Transfer</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            /* ========================================================================= */
            /* FLOW B: RECEIVE VIDEO (RECEIVER) */
            /* ========================================================================= */
            <View style={styles.contentCard}>
              {isSuccess && receiverWaitingMessage ? (
                <View style={styles.receiverWaitingBox}>
                  <Text style={styles.receiverWaitingIcon}>✓</Text>
                  <Text style={styles.receiverWaitingTitle}>Paired with Sender!</Text>
                  <Text style={styles.receiverWaitingSubtext}>{receiverWaitingMessage}</Text>

                  {localDeviceStorage && (
                    <View style={styles.reportedStorageBox}>
                      <Text style={styles.reportedStorageLabel}>Reported Storage Capacity:</Text>
                      <Text style={styles.reportedStorageVal}>
                        💾 {localDeviceStorage.freeFormatted} Free / {localDeviceStorage.totalFormatted} Total
                      </Text>
                    </View>
                  )}

                  <View style={styles.awaitingTransferPill}>
                    <ActivityIndicator size="small" color="#10B981" />
                    <Text style={styles.awaitingTransferText}>
                      Awaiting sender's transfer initiation...
                    </Text>
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={styles.sectionHeaderTitle}>Receive Video File</Text>
                  <Text style={styles.sectionSubtext}>
                    Enter the 6-digit pairing code shown on the sender's screen:
                  </Text>

                  {/* 6-DIGIT CODE INPUT */}
                  <TextInput
                    style={styles.codeInput}
                    placeholder="482913"
                    placeholderTextColor="#334155"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={inputCode}
                    onChangeText={(text) => {
                      setInputCode(text.replace(/[^0-9]/g, ''));
                      setError(null);
                    }}
                  />

                  {/* ================================================================= */}
                  {/* REQUIREMENT: SHOW THE USER HOW MUCH STORAGE IS AVAILABLE BELOW */}
                  {/* ================================================================= */}
                  <View style={styles.receiverStorageCard}>
                    <View style={styles.receiverStorageHeader}>
                      <Text style={styles.receiverStorageTitle}>💾 Available Device Storage</Text>
                      {localDeviceStorage && (
                        <Text style={styles.receiverStorageHighlight}>
                          {localDeviceStorage.freeFormatted} Free
                        </Text>
                      )}
                    </View>

                    {localDeviceStorage && (
                      <>
                        <View style={styles.storageMeterTrack}>
                          {/* Calculate approximate used ratio */}
                          <View
                            style={[
                              styles.storageMeterFill,
                              {
                                width: `${Math.min(
                                  100,
                                  Math.max(
                                    10,
                                    100 -
                                      Math.round(
                                        (localDeviceStorage.freeBytes / localDeviceStorage.totalBytes) *
                                          100
                                      )
                                  )
                                )}%`,
                              },
                            ]}
                          />
                        </View>
                        <View style={styles.storageMeterLabels}>
                          <Text style={styles.storageMeterSubtext}>
                            Total: {localDeviceStorage.totalFormatted}
                          </Text>
                          <Text style={styles.storageMeterSubtext}>
                            Available: {localDeviceStorage.freeFormatted}
                          </Text>
                        </View>
                      </>
                    )}

                    <Text style={styles.storageExplainer}>
                      ℹ️ Your storage details will be verified by the sender upon pairing to ensure complete transfer and eliminate unwanted transfers.
                    </Text>
                  </View>

                  {/* Pair Action Button */}
                  <TouchableOpacity
                    style={[styles.primaryActionButtonReceive, loading && styles.disabledBtn]}
                    onPress={handleJoin}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryActionButtonText}>
                        Pair & Verify Storage →
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Error Message Display */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0F1D',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  backText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '600',
  },
  deviceStorageBadge: {
    backgroundColor: '#1E293B',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  deviceStorageBadgeText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTabSend: {
    backgroundColor: '#059669',
  },
  activeTabReceive: {
    backgroundColor: '#0284C7',
  },
  tabText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 14,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  contentCard: {
    backgroundColor: '#131D31',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  sectionHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  sectionSubtext: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },
  presetLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  presetCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  presetCardSelected: {
    borderColor: '#10B981',
    backgroundColor: '#0F291E',
  },
  presetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  presetIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  presetName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  presetDetails: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  presetSizeBadge: {
    backgroundColor: '#064E3B',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  presetSizeText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  customArrow: {
    fontSize: 16,
  },
  customBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    fontSize: 14,
  },
  primaryActionButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryActionButtonReceive: {
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 18,
  },
  primaryActionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  preProcessingBox: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  preProcessingTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
  },
  preProcessingStep: {
    color: '#38BDF8',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    marginTop: 20,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
  progressPercent: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  preProcessingChecklist: {
    alignSelf: 'stretch',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    gap: 6,
  },
  checkItem: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  codeGeneratedBox: {
    alignItems: 'center',
  },
  videoSummaryCard: {
    alignSelf: 'stretch',
    backgroundColor: '#0F291E',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  videoSummaryHeader: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  videoSummaryTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  videoSummaryRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  videoSummaryStat: {
    color: '#94A3B8',
    fontSize: 12,
  },
  videoSummaryHash: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  pairInstruction: {
    color: '#E2E8F0',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  waitingReceiverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  waitingReceiverText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  verificationBox: {
    alignItems: 'center',
  },
  connectedBanner: {
    backgroundColor: '#064E3B',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 12,
  },
  connectedBannerText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
  },
  verifyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  verifySubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  storageCompareCard: {
    alignSelf: 'stretch',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 18,
  },
  compareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  compareLabel: {
    color: '#94A3B8',
    fontSize: 13,
  },
  compareValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  compareValueReq: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '700',
  },
  compareValueAvail: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
  },
  verdictBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  verdictGood: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  verdictBad: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  verdictIcon: {
    fontSize: 18,
  },
  verdictText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  startTransferBtn: {
    alignSelf: 'stretch',
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  startTransferBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  blockedBox: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  blockedText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  cancelTransferBtn: {
    paddingVertical: 10,
  },
  cancelTransferBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  codeInput: {
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#0284C7',
    borderRadius: 14,
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 8,
    paddingVertical: 14,
    marginBottom: 18,
  },
  receiverStorageCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  receiverStorageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  receiverStorageTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  receiverStorageHighlight: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '800',
  },
  storageMeterTrack: {
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  storageMeterFill: {
    height: '100%',
    backgroundColor: '#0284C7',
  },
  storageMeterLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  storageMeterSubtext: {
    color: '#64748B',
    fontSize: 11,
  },
  storageExplainer: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  receiverWaitingBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  receiverWaitingIcon: {
    fontSize: 54,
    color: '#10B981',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  receiverWaitingTitle: {
    color: '#10B981',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  receiverWaitingSubtext: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  reportedStorageBox: {
    alignSelf: 'stretch',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reportedStorageLabel: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 4,
  },
  reportedStorageVal: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  awaitingTransferPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F291E',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#059669',
  },
  awaitingTransferText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
