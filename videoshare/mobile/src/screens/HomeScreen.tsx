import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { PairingService } from '../services/pairing.js';
import { WebSocketClient } from '../services/websocket.js';
import { StorageService } from '../services/storage.js';
import { useConnectionStore } from '../store/connectionStore.js';
import { DeviceStorageInfo } from '../types/pairing.js';

interface HomeScreenProps {
  navigation: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { status, setStatus } = useConnectionStore();
  const [storageInfo, setStorageInfo] = useState<DeviceStorageInfo | null>(null);
  const [isPaired, setIsPaired] = useState<boolean>(false);

  useEffect(() => {
    const ws = WebSocketClient.getInstance();
    ws.connect();

    ws.on('connection:change', (data: { status: any }) => {
      setStatus(data.status);
    });

    // Check device available storage on launch
    StorageService.getStorageInfo().then((info) => {
      setStorageInfo(info);
    });

    const pairingState = PairingService.getPairingState();
    setIsPaired(!!(pairingState.isPaired && pairingState.sessionId));
  }, [setStatus]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header & Branding */}
        <View style={styles.header}>
          <Text style={styles.logoIcon}>📹</Text>
          <Text style={styles.title}>VideoShare</Text>
          <Text style={styles.subtitle}>
            Direct text-transported video sharing between two paired devices
          </Text>

          {/* Device Storage Status Pill */}
          {storageInfo && (
            <View style={styles.storagePill}>
              <Text style={styles.storagePillIcon}>💾</Text>
              <Text style={styles.storagePillText}>
                Device Storage: <Text style={styles.storageHighlight}>{storageInfo.freeFormatted} Available</Text> ({storageInfo.totalFormatted} Total)
              </Text>
            </View>
          )}
        </View>

        {/* Primary Two-Option Actions */}
        <View style={styles.actions}>
          {/* OPTION 1: Select File (Pre-process video & Generate 6-digit Code) */}
          <TouchableOpacity
            style={styles.selectFileCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Pair', { mode: 'select_file' })}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBoxSend}>
                <Text style={styles.cardIcon}>🎬</Text>
              </View>
              <View style={styles.badgeSender}>
                <Text style={styles.badgeSenderText}>SENDER</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>Select File</Text>
            <Text style={styles.cardDescription}>
              Select a video file to immediately start pre-processing and generate your 6-digit pairing code.
            </Text>
            <View style={styles.stepPreviewRow}>
              <Text style={styles.stepDot}>1. Choose Video</Text>
              <Text style={styles.stepArrow}>→</Text>
              <Text style={styles.stepDot}>2. Pre-process</Text>
              <Text style={styles.stepArrow}>→</Text>
              <Text style={styles.stepDot}>3. 6-Digit Code</Text>
            </View>
          </TouchableOpacity>

          {/* OPTION 2: Receive (Enter Code & Show Storage Available) */}
          <TouchableOpacity
            style={styles.receiveCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Pair', { mode: 'receive' })}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBoxReceive}>
                <Text style={styles.cardIcon}>📥</Text>
              </View>
              <View style={styles.badgeReceiver}>
                <Text style={styles.badgeReceiverText}>RECEIVER</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>Receive</Text>
            <Text style={styles.cardDescription}>
              Enter partner's 6-digit code. Shows your available storage to eliminate unwanted transfers.
            </Text>
            <View style={styles.stepPreviewRow}>
              <Text style={styles.stepDot}>1. Enter Code</Text>
              <Text style={styles.stepArrow}>→</Text>
              <Text style={styles.stepDot}>2. Verify Storage</Text>
              <Text style={styles.stepArrow}>→</Text>
              <Text style={styles.stepDot}>3. Receive Video</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Active Session Quick Jump if already paired */}
        {isPaired && (
          <TouchableOpacity
            style={styles.resumeBanner}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Chat')}
          >
            <Text style={styles.resumeBannerText}>
              💬 Paired Session Active — Tap to Open Chat & Transfers →
            </Text>
          </TouchableOpacity>
        )}

        {/* Server Connection Status Footer */}
        <View style={styles.footer}>
          <View
            style={[
              styles.statusDot,
              status === 'connected' ? styles.statusGreen : styles.statusGray,
            ]}
          />
          <Text style={styles.serverStatusText}>
            Server Status: {status === 'connected' ? 'Connected (Ready)' : 'Connecting to WebSocket...'}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0F1D',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoIcon: {
    fontSize: 52,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
    lineHeight: 18,
  },
  storagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  storagePillIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  storagePillText: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  storageHighlight: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  actions: {
    gap: 16,
    marginVertical: 16,
  },
  selectFileCard: {
    backgroundColor: '#0F291E',
    borderWidth: 1.5,
    borderColor: '#059669',
    borderRadius: 18,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIconBoxSend: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#064E3B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxReceive: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0C4A6E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    fontSize: 22,
  },
  badgeSender: {
    backgroundColor: '#059669',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeSenderText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  receiveCard: {
    backgroundColor: '#0C2340',
    borderWidth: 1.5,
    borderColor: '#0284C7',
    borderRadius: 18,
    padding: 20,
  },
  badgeReceiver: {
    backgroundColor: '#0284C7',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeReceiverText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  cardDescription: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  stepPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepDot: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  stepArrow: {
    color: '#64748B',
    fontSize: 11,
    marginHorizontal: 6,
  },
  resumeBanner: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  resumeBannerText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
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
  serverStatusText: {
    color: '#64748B',
    fontSize: 12,
  },
});
