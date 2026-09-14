import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: React.ReactNode;
  /** Set when the screen sits inside the tab bar (no bottom inset needed). */
  inTabs?: boolean;
}

export function Screen({ children, scroll = true, style, contentStyle, footer, inTabs }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padBottom = inTabs ? spacing.xl : Math.max(insets.bottom, spacing.md);
  return (
    <View style={[styles.root, style]}>
      <View style={styles.glowTop} pointerEvents="none" />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: footer ? spacing.md : padBottom + spacing.xl }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1, paddingTop: insets.top + spacing.md, paddingBottom: footer ? spacing.md : padBottom }, contentStyle]}>{children}</View>
      )}
      {footer ? <View style={[styles.footer, { paddingBottom: padBottom }]}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  glowTop: {
    position: 'absolute',
    top: -180,
    left: -60,
    right: -60,
    height: 360,
    borderRadius: 400,
    backgroundColor: 'rgba(124,156,255,0.10)',
  },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
