import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BalanceChart } from '@/components/BalanceChart';
import { ScenarioCard } from '@/components/ScenarioCard';
import { Screen } from '@/components/Screen';
import { Body, Chip, Code, CodeButton, Disclaimer, GlassCard, SectionLabel, Title } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { useDecisionsStore } from '@/features/decisions/store';
import { resolveContext } from '@/features/simulation/engine';
import { labelFor } from '@/features/simulation/whatIf';
import { useSimulationStore } from '@/features/simulation/store';
import { useHaptics } from '@/hooks/useHaptics';
import { useSubscription } from '@/hooks/useSubscription';
import type { DecisionContext } from '@/types/simulation';
import { formatCompact } from '@/utils/format';

export default function FuturesScreen() {
  const router = useRouter();
  const sim = useSimulationStore((s) => s.current);
  const clearOverrides = useSimulationStore((s) => s.clearOverrides);
  const forks = useDecisionsStore((s) => s.forks);
  const save = useDecisionsStore((s) => s.save);
  const { limits } = useSubscription();
  const { success } = useHaptics();
  const [view, setView] = useState<'cards' | 'compare'>('cards');

  const existing = useMemo(() => forks.find((f) => f.simulation.id === sim?.id), [forks, sim?.id]);

  if (!sim) {
    return (
      <Screen>
        <Title>No simulation yet</Title>
        <CodeButton label="go_home" variant="ghost" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const ctx = resolveContext(sim.input.context, sim.overrides);
  const overrideKeys = Object.keys(sim.overrides) as (keyof DecisionContext)[];
  const recommended = sim.scenarios.find((s) => s.id === sim.recommendation.scenarioId);
  const sorted = [...sim.scenarios].sort((a, b) => b.score - a.score);
  const confColor = sim.confidence.level === 'HIGH' ? colors.mint : sim.confidence.level === 'MEDIUM' ? colors.amber : colors.rose;

  const onSave = () => {
    const fork = save(sim);
    success();
    router.push({ pathname: '/fork/[id]', params: { id: fork.id } });
  };

  return (
    <Screen
      footer={
        <View style={styles.footerRow}>
          <CodeButton label="what_if" variant="ghost" style={{ flex: 1 }} onPress={() => router.push('/whatif')} />
          <CodeButton label={existing ? 'open_fork' : 'save_decision'} style={{ flex: 1.3 }} onPress={existing ? () => router.push({ pathname: '/fork/[id]', params: { id: existing.id } }) : onSave} />
        </View>
      }
    >
      <View style={styles.topRow}>
        <Pressable onPress={() => router.replace('/')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Home">
          <Code color={colors.textMuted}>{'← home'}</Code>
        </Pressable>
        <Code color={colors.textDim} size={11}>{sim.source === 'groq' ? 'groq · live' : 'demo · seeded'}</Code>
      </View>

      <View>
        <SectionLabel>your possible futures</SectionLabel>
        <Text style={styles.decision}>{sim.input.decision}</Text>
        <View style={styles.metaRow}>
          <Code color={colors.textDim} size={11}>{`${ctx.horizonMonths}-month horizon`}</Code>
          <Code color={colors.textDim} size={11}>·</Code>
          <Code color={confColor} size={11}>{`confidence ${sim.confidence.level}`}</Code>
        </View>
      </View>

      {overrideKeys.length > 0 && (
        <View style={styles.overrideBox}>
          <View style={{ flex: 1, gap: 4 }}>
            <Code color={colors.amber} size={11}>{'what_if() active'}</Code>
            <Text style={styles.overrideText}>
              {overrideKeys.map((k) => `${labelFor(k)} → ${k === 'horizonMonths' ? `${ctx.horizonMonths} mo` : formatCompact(ctx[k] as number, ctx.currency)}`).join(' · ')}
            </Text>
          </View>
          <Pressable onPress={clearOverrides} hitSlop={8}>
            <Code color={colors.textMuted} size={12}>reset</Code>
          </Pressable>
        </View>
      )}

      <View style={styles.toggle}>
        <Chip label="cards" active={view === 'cards'} onPress={() => setView('cards')} />
        <Chip label="compare()" active={view === 'compare'} onPress={() => setView('compare')} />
      </View>

      {view === 'cards' ? (
        <View style={{ gap: spacing.md }}>
          {sim.scenarios.map((s, i) => {
            const locked = !limits.isPro && i >= limits.maxScenarios;
            return (
              <ScenarioCard
                key={s.id}
                scenario={s}
                currency={ctx.currency}
                recommended={s.id === sim.recommendation.scenarioId}
                chosen={existing?.chosenScenarioId === s.id}
                locked={locked}
                onPress={() => (locked ? router.push('/paywall') : router.push({ pathname: '/scenario/[id]', params: { id: s.id } }))}
              />
            );
          })}
        </View>
      ) : (
        <GlassCard style={{ gap: spacing.md }}>
          <SectionLabel>projected balance over time</SectionLabel>
          <BalanceChart simulation={sim} />
          <View style={styles.table}>
            <View style={styles.tr}>
              <Text style={[styles.th, { flex: 1.4 }]}>metric</Text>
              {sim.scenarios.map((s) => (
                <Text key={s.id} style={styles.th}>{s.letter}</Text>
              ))}
            </View>
            {(['financial', 'opportunity', 'goal', 'risk', 'flexibility', 'stress'] as const).map((k) => {
              const best = k === 'stress' ? Math.min(...sim.scenarios.map((s) => s.metrics[k])) : Math.max(...sim.scenarios.map((s) => s.metrics[k]));
              return (
                <View key={k} style={styles.tr}>
                  <Text style={[styles.td, { flex: 1.4, color: colors.textMuted }]}>{k}</Text>
                  {sim.scenarios.map((s, i) => {
                    const locked = !limits.isPro && i >= limits.maxScenarios;
                    return (
                      <Text key={s.id} style={[styles.td, s.metrics[k] === best && !locked && { color: colors.mint, fontWeight: '700' }]}>
                        {locked ? '••' : Math.round(s.metrics[k])}
                      </Text>
                    );
                  })}
                </View>
              );
            })}
            <View style={[styles.tr, { borderTopWidth: 1, borderTopColor: colors.borderStrong, paddingTop: 8 }]}>
              <Text style={[styles.td, { flex: 1.4, color: colors.text, fontWeight: '700' }]}>decision fit</Text>
              {sim.scenarios.map((s, i) => (
                <Text key={s.id} style={[styles.td, { fontWeight: '700', color: s.id === sorted[0].id ? colors.mint : colors.text }]}>
                  {!limits.isPro && i >= limits.maxScenarios ? '••' : s.score}
                </Text>
              ))}
            </View>
          </View>
        </GlassCard>
      )}

      {recommended && (
        <GlassCard glow={colors.mint} style={styles.recBox}>
          <View style={styles.recHead}>
            <Code color={colors.mint} size={12}>{'> recommendation'}</Code>
            <Code color={colors.textDim} size={11}>{sim.source === 'groq' ? 'AI' : 'rule-based'}</Code>
          </View>
          <Text style={styles.recTitle}>
            fork {recommended.letter} · {recommended.title}
          </Text>
          <Body>{sim.recommendation.take}</Body>
          <View style={{ gap: 6, marginTop: 4 }}>
            {sim.recommendation.why.map((w) => (
              <View key={w} style={styles.bullet}>
                <Code color={colors.mint} size={12}>→</Code>
                <Text style={styles.bulletText}>{w}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      )}

      <GlassCard style={{ gap: spacing.sm }}>
        <View style={styles.recHead}>
          <Code color={confColor} size={12}>{`analysis confidence: ${sim.confidence.level}`}</Code>
        </View>
        {sim.confidence.present.length > 0 && (
          <Text style={styles.confText}>
            <Text style={{ color: colors.mint }}>have </Text>
            {sim.confidence.present.join(', ')}
          </Text>
        )}
        {sim.confidence.missing.length > 0 && (
          <Text style={styles.confText}>
            <Text style={{ color: colors.amber }}>missing </Text>
            {sim.confidence.missing.join(', ')}
          </Text>
        )}
      </GlassCard>

      <Disclaimer domain={sim.riskDomain} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  decision: { fontFamily: fonts.sans, fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.5, lineHeight: 30 },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  overrideBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.amberSoft, borderWidth: 1, borderColor: `${colors.amber}44` },
  overrideText: { fontFamily: fonts.mono, fontSize: 12, color: colors.text },
  toggle: { flexDirection: 'row', gap: spacing.sm },
  table: { gap: 6 },
  tr: { flexDirection: 'row', alignItems: 'center' },
  th: { flex: 1, textAlign: 'center', fontFamily: fonts.mono, fontSize: 11, color: colors.textDim, letterSpacing: 1 },
  td: { flex: 1, textAlign: 'center', fontFamily: fonts.mono, fontSize: 14, color: colors.text },
  recBox: { gap: spacing.sm, backgroundColor: 'rgba(110,231,183,0.06)' },
  recHead: { flexDirection: 'row', justifyContent: 'space-between' },
  recTitle: { fontFamily: fonts.sans, fontSize: 18, fontWeight: '700', color: colors.text },
  bullet: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bulletText: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  confText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
});
