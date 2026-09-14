import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import { Screen } from '@/components/Screen';
import { Chip, Code, CodeButton, GlassCard, SectionLabel, Subtitle, Title } from '@/components/ui';
import { colors, fonts, radius, scoreColor, spacing } from '@/constants/theme';
import { resolveContext } from '@/features/simulation/engine';
import { useSimulationStore } from '@/features/simulation/store';
import { WHAT_IF_PRESETS, labelFor } from '@/features/simulation/whatIf';
import { useHaptics } from '@/hooks/useHaptics';
import { useSubscription } from '@/hooks/useSubscription';
import { getAIProvider } from '@/services/ai';
import type { DecisionContext } from '@/types/simulation';
import { formatCompact } from '@/utils/format';

type NumKey = 'savings' | 'monthlyIncome' | 'monthlyExpenses' | 'cost' | 'horizonMonths';
const SLIDERS: { key: NumKey; min: number; max: number }[] = [
  { key: 'cost', min: 0, max: 3 },
  { key: 'monthlyIncome', min: 0, max: 3 },
  { key: 'monthlyExpenses', min: 0, max: 3 },
  { key: 'savings', min: 0, max: 3 },
];

export default function WhatIfScreen() {
  const router = useRouter();
  const sim = useSimulationStore((s) => s.current);
  const applyOverrides = useSimulationStore((s) => s.applyOverrides);
  const clearOverrides = useSimulationStore((s) => s.clearOverrides);
  const { limits } = useSubscription();
  const { select } = useHaptics();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const base = sim?.input.context;
  const ctx = useMemo(() => (sim ? resolveContext(sim.input.context, sim.overrides) : null), [sim]);

  if (!sim || !base || !ctx) {
    return (
      <Screen>
        <Code>no active simulation</Code>
        <CodeButton label="close" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const ask = async () => {
    if (!text.trim()) return;
    if (!limits.canUseCustomWhatIf) {
      router.push('/paywall');
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const w = await getAIProvider().interpretWhatIf(text, ctx);
      if (!w || Object.keys(w.overrides).length === 0) {
        setStatus("Couldn't map that to a variable. Try “income drops 20%” or “it costs 1.2m”.");
      } else {
        applyOverrides(w.overrides);
        setStatus(`applied: ${w.summary}`);
        setText('');
        select();
      }
    } finally {
      setBusy(false);
    }
  };

  const top = [...sim.scenarios].sort((a, b) => b.score - a.score)[0];

  return (
    <Screen
      footer={
        <View style={styles.footerRow}>
          <CodeButton label="reset" variant="ghost" style={{ flex: 1 }} onPress={clearOverrides} disabled={Object.keys(sim.overrides).length === 0} />
          <CodeButton label="done" style={{ flex: 1.3 }} onPress={() => router.back()} />
        </View>
      }
    >
      <View style={styles.topRow}>
        <Title>what_if<Text style={{ color: colors.accent }}>()</Text></Title>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Code color={colors.textMuted}>{'close ×'}</Code>
        </Pressable>
      </View>
      <Subtitle>Change one variable. Watch every future recalculate instantly.</Subtitle>

      <GlassCard style={styles.live} glow={scoreColor(top.score)}>
        <SectionLabel>live scores</SectionLabel>
        <View style={styles.scoreRow}>
          {sim.scenarios.map((s) => (
            <View key={s.id} style={styles.scoreItem}>
              <Text style={[styles.scoreNum, { color: scoreColor(s.score) }]}>{s.score}</Text>
              <Text style={styles.scoreLabel} numberOfLines={1}>{s.letter} · {s.title}</Text>
              <Code color={colors.textDim} size={10}>{formatCompact(s.projectedBalance, ctx.currency)}</Code>
            </View>
          ))}
        </View>
        <Text style={styles.leading}>
          leading: <Text style={{ color: scoreColor(top.score) }}>{top.title}</Text>
        </Text>
      </GlassCard>

      <View>
        <SectionLabel>what if…</SectionLabel>
        <View style={styles.presets}>
          {WHAT_IF_PRESETS.map((p) => (
            <Chip
              key={p.id}
              label={p.label}
              tone="amber"
              onPress={() => {
                applyOverrides(p.apply(base));
                setStatus(`applied: ${p.label}`);
              }}
            />
          ))}
        </View>
      </View>

      <GlassCard style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <SectionLabel>ask in plain words</SectionLabel>
          {!limits.canUseCustomWhatIf && <Code color={colors.amber} size={11}>fork_pro</Code>}
        </View>
        <View style={styles.askRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="my income drops 20% and I wait 2 more months"
            placeholderTextColor={colors.textDim}
            style={styles.askInput}
            onSubmitEditing={ask}
            returnKeyType="go"
            accessibilityLabel="Custom what-if"
          />
          <CodeButton label="run" size="sm" onPress={ask} disabled={busy || !text.trim()} />
        </View>
        {status && <Code color={status.startsWith('applied') ? colors.mint : colors.amber} size={12}>{status}</Code>}
      </GlassCard>

      <GlassCard style={{ gap: spacing.md }}>
        <SectionLabel>change one variable</SectionLabel>
        {SLIDERS.map(({ key, min, max }) => {
          const baseVal = base[key] ?? 0;
          if (!baseVal) return null;
          const cur = ctx[key] ?? baseVal;
          const ratio = cur / baseVal;
          return (
            <View key={key}>
              <View style={styles.sliderHead}>
                <Text style={styles.sliderLabel}>{labelFor(key)}</Text>
                <Code color={ratio === 1 ? colors.textMuted : colors.amber} size={12}>
                  {`${formatCompact(cur, ctx.currency)}  ${ratio === 1 ? '' : `(${ratio > 1 ? '+' : ''}${Math.round((ratio - 1) * 100)}%)`}`}
                </Code>
              </View>
              <Slider
                minimumValue={min}
                maximumValue={max}
                step={0.05}
                value={ratio}
                onValueChange={(r) => applyOverrides({ [key]: Math.round(baseVal * r) } as Partial<DecisionContext>)}
                minimumTrackTintColor={colors.amber}
                maximumTrackTintColor={colors.surfaceStrong}
                thumbTintColor={colors.amber}
                accessibilityLabel={labelFor(key)}
              />
            </View>
          );
        })}
        <View>
          <View style={styles.sliderHead}>
            <Text style={styles.sliderLabel}>Time horizon</Text>
            <Code color={ctx.horizonMonths === base.horizonMonths ? colors.textMuted : colors.amber} size={12}>{`${ctx.horizonMonths} months`}</Code>
          </View>
          <Slider
            minimumValue={1}
            maximumValue={24}
            step={1}
            value={ctx.horizonMonths}
            onValueChange={(v) => applyOverrides({ horizonMonths: Math.round(v) })}
            minimumTrackTintColor={colors.amber}
            maximumTrackTintColor={colors.surfaceStrong}
            thumbTintColor={colors.amber}
            accessibilityLabel="Time horizon"
          />
        </View>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  live: { gap: spacing.sm, backgroundColor: colors.bgElevated },
  scoreRow: { flexDirection: 'row', gap: spacing.sm },
  scoreItem: { flex: 1, alignItems: 'center', gap: 2, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface },
  scoreNum: { fontFamily: fonts.mono, fontSize: 30, fontWeight: '700', letterSpacing: -1 },
  scoreLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.textMuted },
  leading: { fontFamily: fonts.mono, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  askRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  askInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.text, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10 },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
});
