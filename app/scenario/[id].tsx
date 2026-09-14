import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BalanceChart } from '@/components/BalanceChart';
import { Screen } from '@/components/Screen';
import { Timeline } from '@/components/Timeline';
import { BigNumber, Body, Code, CodeButton, Disclaimer, GlassCard, MetricBar, SectionLabel } from '@/components/ui';
import { colors, fitLabel, fonts, radius, scoreColor, spacing } from '@/constants/theme';
import { useDecisionsStore } from '@/features/decisions/store';
import { resolveContext } from '@/features/simulation/engine';
import { useSimulationStore } from '@/features/simulation/store';
import { getAIProvider } from '@/services/ai';
import { formatMoney } from '@/utils/format';

export default function ScenarioScreen() {
  const router = useRouter();
  const { id, forkId } = useLocalSearchParams<{ id: string; forkId?: string }>();
  const current = useSimulationStore((s) => s.current);
  const forks = useDecisionsStore((s) => s.forks);
  const fork = forkId ? forks.find((f) => f.id === forkId) : undefined;
  const sim = fork?.simulation ?? current;
  const scenario = sim?.scenarios.find((s) => s.id === id);
  const [explain, setExplain] = useState<string | null>(null);

  useEffect(() => {
    if (!sim) return;
    let alive = true;
    getAIProvider()
      .explainTradeoffs(sim)
      .then((t) => alive && setExplain(t))
      .catch(() => alive && setExplain(null));
    return () => {
      alive = false;
    };
  }, [sim]);

  if (!sim || !scenario) {
    return (
      <Screen>
        <Code>scenario not found</Code>
        <CodeButton label="back" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const ctx = resolveContext(sim.input.context, sim.overrides);
  const color = scoreColor(scenario.score);
  const isRec = sim.recommendation.scenarioId === scenario.id;

  return (
    <Screen
      footer={
        <View style={styles.footerRow}>
          <CodeButton label="what_if" variant="ghost" style={{ flex: 1 }} onPress={() => router.push('/whatif')} />
          {fork && fork.status === 'pending' ? (
            <CodeButton label={`choose_${scenario.letter}`} style={{ flex: 1.2 }} onPress={() => router.push({ pathname: '/fork/[id]', params: { id: fork.id, choose: scenario.id } })} />
          ) : (
            <CodeButton label="compare" variant="subtle" style={{ flex: 1 }} onPress={() => router.back()} />
          )}
        </View>
      }
    >
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
        <Code color={colors.textMuted}>{'← futures'}</Code>
      </Pressable>

      <View style={styles.head}>
        <View style={{ flex: 1, gap: 4 }}>
          <Code color={colors.textDim} size={12}>{`fork ${scenario.letter}${isRec ? ' · AI pick' : ''}`}</Code>
          <Text style={styles.title}>{scenario.title}</Text>
          <Body muted>{scenario.description}</Body>
        </View>
      </View>

      <GlassCard style={styles.scoreCard} glow={color}>
        <View style={{ flex: 1 }}>
          <SectionLabel>decision fit</SectionLabel>
          <Text style={[styles.fit, { color }]}>{fitLabel(scenario.score)}</Text>
          <Text style={styles.fitNote}>Estimated fit for your stated priorities — not a probability of success.</Text>
        </View>
        <BigNumber color={color} size={72}>{scenario.score}</BigNumber>
      </GlassCard>

      <View style={styles.numbers}>
        <Stat label="projected" value={formatMoney(scenario.projectedBalance, ctx.currency)} />
        <Stat label="lowest point" value={formatMoney(scenario.minBalance, ctx.currency)} tone={scenario.minBalance < 0 ? colors.rose : undefined} />
      </View>

      <GlassCard>
        <SectionLabel>metrics</SectionLabel>
        <MetricBar label="Financial" value={scenario.metrics.financial} />
        <MetricBar label="Opportunity" value={scenario.metrics.opportunity} />
        <MetricBar label="Goal alignment" value={scenario.metrics.goal} />
        <MetricBar label="Safety" value={scenario.metrics.risk} />
        <MetricBar label="Flexibility" value={scenario.metrics.flexibility} />
        <MetricBar label="Stress" value={scenario.metrics.stress} invert />
      </GlassCard>

      <GlassCard>
        <SectionLabel>{`${ctx.horizonMonths}-month timeline`}</SectionLabel>
        <Timeline events={scenario.timeline} currency={ctx.currency} />
      </GlassCard>

      <GlassCard>
        <SectionLabel>balance vs. other forks</SectionLabel>
        <BalanceChart simulation={sim} highlight={scenario.id} />
      </GlassCard>

      <View style={styles.cols}>
        <GlassCard style={{ flex: 1 }}>
          <Code color={colors.mint} size={11}>{'+ advantages'}</Code>
          {scenario.advantages.map((a) => (
            <Text key={a} style={styles.li}>• {a}</Text>
          ))}
        </GlassCard>
        <GlassCard style={{ flex: 1 }}>
          <Code color={colors.rose} size={11}>{'- trade-offs'}</Code>
          {scenario.tradeoffs.map((a) => (
            <Text key={a} style={styles.li}>• {a}</Text>
          ))}
        </GlassCard>
      </View>

      {explain && (
        <GlassCard style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Code color={colors.accent} size={12}>{'> trade-off read'}</Code>
            <Code color={colors.textDim} size={11}>{sim.source === 'groq' ? 'AI' : 'rule-based'}</Code>
          </View>
          <Body>{explain}</Body>
        </GlassCard>
      )}

      <Disclaimer domain={sim.riskDomain} />
    </Screen>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Code color={colors.textDim} size={10}>{label.toUpperCase()}</Code>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: spacing.md },
  title: { fontFamily: fonts.sans, fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.8 },
  scoreCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.bgElevated },
  fit: { fontFamily: fonts.mono, fontSize: 14, letterSpacing: 2, fontWeight: '700' },
  fitNote: { fontFamily: fonts.sans, fontSize: 12, color: colors.textDim, marginTop: 6, lineHeight: 17 },
  numbers: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 },
  statValue: { fontFamily: fonts.mono, fontSize: 17, fontWeight: '700', color: colors.text },
  cols: { flexDirection: 'row', gap: spacing.sm },
  li: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, lineHeight: 19, marginTop: 6 },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
});
