import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, layout } from '../theme';
import { AuroraBackground } from './ui';

interface SafeScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Horizontal page gutter (defaults to the standard screen padding). */
  padded?: boolean;
}

/**
 * Screen shell: paints the aurora canvas, respects the safe area, and applies
 * the standard page gutter.
 */
export const SafeScreen: React.FC<SafeScreenProps> = ({ children, style, padded = true }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <AuroraBackground />
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingHorizontal: padded ? layout.screenPadding : 0,
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
