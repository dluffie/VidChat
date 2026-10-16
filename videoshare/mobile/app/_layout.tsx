// Must be first import — patches globalThis.crypto for uuid / Hermes compatibility
import '../src/utils/polyfills';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { VideoTransferService } from '../src/services/videoTransfer';
import { PairingService } from '../src/services/pairing';

export default function RootLayout() {
  // Register WebSocket listeners once, at app start. The receiving side must be
  // listening for video:start / video:chunk BEFORE the sender starts streaming:
  // the server relays chunks straight through with no buffering, so anything
  // that arrives while no handler is attached is lost forever.
  useEffect(() => {
    VideoTransferService.init();
    PairingService.initPairSuccessListener();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0F172A' },
          animation: 'slide_from_right',
        }}
      />
    </SafeAreaProvider>
  );
}
