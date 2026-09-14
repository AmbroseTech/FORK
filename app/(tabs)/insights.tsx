import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Body, Code, CodeButton, GlassCard, SectionLabel, Subtitle, Title } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { useDecisionsStore } from '@/features/decisions/store';
import { computePatterns } from '@/features/insights/patterns';
import { useSubscription } from '@/hooks/useSubscription';
import { getAIProvider } from '@/services/ai';

export default function InsightsScreen() {
  const router = useRouter();
  const forks = useDecisionsStore((s) => s.forks);
  const { limits } = useSubscription();
  const report = useMemo(() => computePatterns(forks), [forks]);
  const [insight, setInsight] = useState<string | null>(null);

  useEffect(() => {
    if (forks.length === 0) return;
    let alive = true;
    getAIProvider()
      .generateInsight(forks)
      .then((t) => alive && setInsight(t))
      .catch(() => alive && setInsight(null));
    return () => {
      alive = false;
    };
  }, [forks]);

  const { stats } = report;
  const visible = limits.canSeeAdvancedInsights ? report.patterns : report.patterns.slice(0, 1);
  const hidden = report.patterns.length - visible.length;

  return (
    <Screen inTabs>
      <View>
        <SectionLabel>my decision patterns</SectionLabel>
        <Title>How you decide</Title>
        <Subtitle>{report.headline}</Subtitle>
      </View>

      <View style={styles.statsRow}>
        <Stat n={stats.total} label="forks" />
        <Stat n={stats.decided} label="decided" />
        <Stat n={stats.reviewed} label="reviewed" />
        <Stat n={stats.decided ? Math.round((stats.followedRecommendation / stats.decided) * 100) : 0} label="% aligned" tone={colors.mint} />
      </View>

      {stats.reviewed > 0 && (
        <GlassCard style={{ gap: spacing.sm }}>
          <SectionLabel>outcomes so far</SectionLabel>
          <OutcomeBar outcomes={stats.outcomes} />
          <View style={styles.legend}>
            <Legend color={colors.mint} label={`better ${stats.outcomes.better}`} />
            <Legend color={colors.accent} label={`expected ${stats.outcomes.expected}`} />
            <Legend color={colors.rose} label={`worse ${stats.outcomes.worse}`} />
          </View>
        </GlassCard>
      )}

      {insight && forks.length > 0 && (
        <GlassCard glow={colors.accent} style={{ gap: spacing.sm }}>
          <View style={styles.rowBetween}>
            <Code color={colors.accent} size={12}>{'> insight'}</Code>
            <Code color={colors.textDim} size={11}>{forks[0]?.simulation.source === 'groq' ? 'AI' : 'rule-based'}</Code>
          </View>
          <Body>{insight}</Body>
        </GlassCard>
      )}

      {visible.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <SectionLabel>patterns</SectionLabel>
          {visible.map((p) => (
            <GlassCard key={p.id} style={{ gap: 6 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.patternTitle}>{p.title}</Text>
                <Code color={colors.textDim} size={11}>{`${p.strength}%`}</Code>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${p.strength}%` }]} />
              </View>
              <Text style={styles.patternDetail}>{p.detail}</Text>
            </GlassCard>
          ))}
          {hidden > 0 && (
            <Pressable onPress={() => router.push('/paywall')} style={({ pressed }) => [styles.locked, pressed && { opacity: 0.8 }]}>
              <Code color={colors.amber} size={12}>{`> ${hidden} more pattern${hidden > 1 ? 's' : ''} · fork_pro`}</Code>
              <Text style={styles.lockedText}>Advanced decision patterns, outcome trends and unlimited history with FORK Pro.</Text>
            </Pressable>
          )}
        </View>
      )}

      {forks.length === 0 && <CodeButton label="simulate" variant="ghost" onPress={() => router.push('/')} />}

      <Text style={styles.foot}>Patterns are computed locally from your saved forks. They describe tendencies, not verdicts.</Text>
    </Screen>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statN, tone ? { color: tone } : null]}>{n}</Text>
      <Code color={colors.textDim} size={10}>{label}</Code>
    </View>
  );
}

function OutcomeBar({ outcomes }: { outcomes: { better: number; expected: number; worse: number } }) {
  const total = outcomes.better + outcomes.expected + outcomes.worse || 1;
  return (
    <View style={styles.outcomeBar}>
      <View style={{ flex: outcomes.better / total, backgroundColor: colors.mint }} />
      <View style={{ flex: outcomes.expected / total, backgroundColor: colors.accent }} />
      <View style={{ flex: outcomes.worse / total, backgroundColor: colors.rose }} />
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
      <Code color={colors.textMuted} size={11}>{label}</Code>
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 2 },
  statN: { fontFamily: fonts.mono, fontSize: 24, fontWeight: '700', color: colors.text },
  legend: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  outcomeBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.surfaceStrong },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  patternTitle: { flex: 1, fontFamily: fonts.sans, fontSize: 16, fontWeight: '700', color: colors.text },
  patternDetail: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceStrong, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent },
  locked: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.amberSoft, borderWidth: 1, borderColor: `${colors.amber}44`, gap: 6 },
  lockedText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
  foot: { fontFamily: fonts.mono, fontSize: 11, color: colors.textDim, textAlign: 'center' },
});
