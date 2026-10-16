import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { layout, radius, spacing, typography, useTheme } from '../../theme';
import { GlassCard } from './GlassCard';
import { GlassIconButton } from './ScreenHeader';
import { Icon } from './Icon';

const Swatch: React.FC<{ colors: [string, string, string]; size?: number; active: boolean }> = ({
  colors,
  size = 46,
  active,
}) => {
  const { theme } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        overflow: 'hidden',
        borderWidth: active ? 1.5 : 0.8,
        borderColor: active ? theme.colors.accent : theme.colors.surfaceBorder,
      }}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
};

/**
 * Appearance picker. Renders a glass trigger button that opens a bottom sheet
 * listing every available theme; selecting one applies it instantly.
 */
export const ThemePicker: React.FC<{ label?: string }> = ({ label }) => {
  const { theme, themes, themeId, setThemeId } = useTheme();
  const [open, setOpen] = useState(false);
  const c = theme.colors;

  return (
    <>
      <GlassIconButton
        name="palette"
        accessibilityLabel={`${label ?? 'Appearance'}: ${theme.name}`}
        onPress={() => setOpen(true)}
      />

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={[styles.scrim, { backgroundColor: c.scrim }]} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheetWrapper} onPress={(e) => e.stopPropagation()}>
            <GlassCard
              corner="xl"
              tone="elevated"
              padded={false}
              depth={3}
              style={styles.sheet}
            >
              <View style={[styles.sheetHeader, { borderBottomColor: c.divider }]}>
                <View>
                  <Text style={[typography.heading, { color: c.textPrimary }]}>Appearance</Text>
                  <Text style={[typography.caption, { color: c.textSecondary, marginTop: 2 }]}>
                    Themes apply instantly
                  </Text>
                </View>
                <GlassIconButton
                  name="close"
                  accessibilityLabel="Close appearance picker"
                  onPress={() => setOpen(false)}
                  size={36}
                />
              </View>

              <ScrollView
                style={styles.list}
                contentContainerStyle={{ padding: spacing.lg }}
                showsVerticalScrollIndicator={false}
              >
                {themes.map((meta) => {
                  const active = meta.id === themeId;
                  return (
                    <Pressable
                      key={meta.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setThemeId(meta.id)}
                      style={({ pressed }) => [
                        styles.row,
                        {
                          borderColor: active ? c.accent : 'transparent',
                          backgroundColor: active ? c.accentSoft : 'transparent',
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <Swatch colors={meta.swatch} active={active} />
                      <View style={styles.rowText}>
                        <Text style={[typography.subheading, { color: c.textPrimary }]}>
                          {meta.name}
                        </Text>
                        <Text
                          style={[typography.caption, { color: c.textSecondary, marginTop: 1 }]}
                          numberOfLines={2}
                        >
                          {meta.description}
                        </Text>
                      </View>
                      {active && (
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: c.accent,
                          }}
                        >
                          <Icon name="check" size={13} color={c.onAccent} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </GlassCard>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetWrapper: {
    width: '100%',
    maxWidth: layout.maxContentWidth + 80,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sheet: {
    maxHeight: 560,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  rowText: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
});
