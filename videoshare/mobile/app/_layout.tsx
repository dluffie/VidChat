// Must be first import — patches globalThis.crypto for uuid / Hermes compatibility
import '../src/utils/polyfills';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { VideoTransferService } from '../src/services/videoTransfer';
import { PairingService } from '../src/services/pairing';
import { ThemeProvider, useTheme } from '../src/theme';

function ThemedNavigation() {
  const { isDark, theme } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}

export default function RootLayout() {
  // Register WebSocket listeners once, at app start. The receiving side must be
  // listening for video:start / video:chunk BEFORE the sender starts streaming:
  // the server relays chunks straight through with no buffering, so anything
  // that arrives while no handler is attached is lost forever.
  useEffect(() => {
    VideoTransferService.init();
    PairingService.initPairSuccessListener();
    PairingService.initReconnectAuth();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedNavigation />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
