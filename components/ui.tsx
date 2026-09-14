import React from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';

/* ────────────────────────── Code-syntax labels ────────────────────────── */

export function SectionLabel({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.section, style]}>{`// ${children}`}</Text>;
}

export function Code({ children, color = colors.code, size = 13, style }: { children: string; color?: string; size?: number; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ fontFamily: fonts.mono, color, fontSize: size }, style]}>{children}</Text>;
}

/* ────────────────────────── Buttons ────────────────────────── */

interface CodeButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  size?: 'md' | 'lg' | 'sm';
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
}

/** Button rendered like a function call: `[ simulate() ]` */
export function CodeButton({ label, variant = 'primary', size = 'md', style, disabled, onPress, haptic = true, ...rest }: CodeButtonProps) {
  const { tap } = useHaptics();
  const fn = label.endsWith(')') ? label : `${label}()`;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={(e) => {
        if (haptic) tap();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.btn,
        size === 'lg' && styles.btnLg,
        size === 'sm' && styles.btnSm,
        variant === 'primary' && styles.btnPrimary,
        variant === 'ghost' && styles.btnGhost,
        variant === 'subtle' && styles.btnSubtle,
        variant === 'danger' && styles.btnDanger,
        pressed && { opacity: 0.8, transform: [{ scale: 0.985 }] },
        disabled && { opacity: 0.4 },
        style,
      ]}
      {...rest}
    >
      <Text
        style={[
          styles.btnText,
          size === 'lg' && { fontSize: 17 },
          size === 'sm' && { fontSize: 12 },
          variant === 'primary' && { color: '#0A0B0F' },
          variant === 'danger' && { color: colors.rose },
        ]}
      >
        {`[ ${fn} ]`}
      </Text>
    </Pressable>
  );
}

/* ────────────────────────── Chips ────────────────────────── */

export function Chip({ label, active, onPress, tone = 'accent', style }: { label: string; active?: boolean; onPress?: () => void; tone?: 'accent' | 'mint' | 'amber' | 'rose' | 'neutral'; style?: StyleProp<ViewStyle> }) {
  const { select } = useHaptics();
  const toneColor = tone === 'mint' ? colors.mint : tone === 'amber' ? colors.amber : tone === 'rose' ? colors.rose : tone === 'neutral' ? colors.textMuted : colors.accent;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected: active }}
      onPress={() => {
        select();
        onPress?.();
      }}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: `${toneColor}22`, borderColor: toneColor },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      <Text style={[styles.chipText, active && { color: toneColor }]}>{label}</Text>
    </Pressable>
  );
}

/* ────────────────────────── Surfaces ────────────────────────── */

export function GlassCard({ children, style, glow }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; glow?: string }) {
  return (
    <View style={[styles.card, glow ? { borderColor: `${glow}55`, shadowColor: glow } : null, style]}>
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

/* ────────────────────────── Text ────────────────────────── */

export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}
export function Subtitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}
export function Body({ children, style, muted }: { children: React.ReactNode; style?: StyleProp<TextStyle>; muted?: boolean }) {
  return <Text style={[styles.body, muted && { color: colors.textMuted }, style]}>{children}</Text>;
}
export function BigNumber({ children, color = colors.text, size = 64 }: { children: React.ReactNode; color?: string; size?: number }) {
  return <Text style={[styles.bigNumber, { color, fontSize: size, lineHeight: size * 1.05 }]}>{children}</Text>;
}

/* ────────────────────────── Metric bar ────────────────────────── */

export function MetricBar({ label, value, color, invert }: { label: string; value: number; color?: string; invert?: boolean }) {
  const shown = Math.round(value);
  const barColor = color ?? (invert ? (shown > 60 ? colors.rose : shown > 35 ? colors.amber : colors.mint) : shown >= 70 ? colors.mint : shown >= 45 ? colors.accent : colors.amber);
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricTrack}>
        <View style={[styles.metricFill, { width: `${Math.max(2, Math.min(100, shown))}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.metricValue, { color: barColor }]}>{shown}%</Text>
    </View>
  );
}

/* ────────────────────────── Disclaimer ────────────────────────── */

export function Disclaimer({ domain }: { domain?: 'medical' | 'legal' | 'financial' }) {
  const extra =
    domain === 'medical'
      ? 'This looks like a health decision — please consult a qualified medical professional.'
      : domain === 'legal'
        ? 'This looks like a legal matter — please consult a qualified legal professional.'
        : domain === 'financial'
          ? 'This looks like a high-stakes financial decision — consider speaking with a licensed advisor.'
          : null;
  return (
    <View style={[styles.disclaimer, domain ? { borderColor: `${colors.amber}66`, backgroundColor: colors.amberSoft } : null]}>
      <Code color={domain ? colors.amber : colors.textDim} size={11}>{domain ? '> caution' : '> note'}</Code>
      <Text style={styles.disclaimerText}>
        FORK explores possible scenarios. It does not predict the future.{extra ? ` ${extra}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.textDim,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  btnLg: { paddingVertical: 18, paddingHorizontal: 24 },
  btnSm: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm },
  btnPrimary: { backgroundColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  btnGhost: { backgroundColor: 'transparent', borderColor: colors.borderStrong },
  btnSubtle: { backgroundColor: colors.surfaceStrong },
  btnDanger: { backgroundColor: colors.roseSoft, borderColor: `${colors.rose}44` },
  btnText: { fontFamily: fonts.mono, fontSize: 14, color: colors.text, fontWeight: '600' },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: { fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  title: { fontFamily: fonts.sans, fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.sans, fontSize: 16, color: colors.textMuted, lineHeight: 23 },
  body: { fontFamily: fonts.sans, fontSize: 15, color: colors.text, lineHeight: 22 },
  bigNumber: { fontFamily: fonts.mono, fontWeight: '700', letterSpacing: -2 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: 5 },
  metricLabel: { flex: 1.2, fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
  metricTrack: { flex: 2, height: 6, borderRadius: 3, backgroundColor: colors.surfaceStrong, overflow: 'hidden' },
  metricFill: { height: '100%', borderRadius: 3 },
  metricValue: { width: 44, textAlign: 'right', fontFamily: fonts.mono, fontSize: 13, fontWeight: '600' },
  disclaimer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 6,
    backgroundColor: colors.surface,
  },
  disclaimerText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, lineHeight: 18 },
});
