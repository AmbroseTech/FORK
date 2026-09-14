import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Chip, Code, CodeButton, SectionLabel, Subtitle, Title } from '@/components/ui';
import { colors, fonts, radius, scoreColor, spacing } from '@/constants/theme';
import { useDecisionsStore } from '@/features/decisions/store';
import { useSubscription } from '@/hooks/useSubscription';
import type { Fork, ForkStatus } from '@/types/simulation';
import { relativeDate } from '@/utils/format';

const FILTERS: { key: ForkStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'all' },
  { key: 'pending', label: 'pending' },
  { key: 'decided', label: 'decided' },
  { key: 'reviewed', label: 'reviewed' },
];

const STATUS_TONE: Record<ForkStatus, string> = { pending: colors.amber, decided: colors.accent, reviewed: colors.mint };

export default function ForksScreen() {
  const router = useRouter();
  const forks = useDecisionsStore((s) => s.forks);
  const { limits } = useSubscription();
  const [filter, setFilter] = useState<ForkStatus | 'all'>('all');
  const shown = filter === 'all' ? forks : forks.filter((f) => f.status === filter);

  return (
    <Screen inTabs>
      <View>
        <SectionLabel>my forks</SectionLabel>
        <Title>Decisions you’ve explored</Title>
        <Subtitle>
          {limits.isPro ? 'Unlimited active decisions.' : `${limits.activeDecisions}/${limits.maxActiveDecisions} active on the free plan.`}
        </Subtitle>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} tone="neutral" />
        ))}
      </View>

      {shown.length === 0 ? (
        <View style={styles.empty}>
          <Code color={colors.textDim} size={40}>⑂</Code>
          <Text style={styles.emptyTitle}>No forks yet</Text>
          <Text style={styles.emptyText}>Run a simulation and save it to track where your decision leads.</Text>
          <CodeButton label="simulate" onPress={() => router.push('/')} />
        </View>
      ) : (
        shown.map((f) => <ForkRow key={f.id} fork={f} onPress={() => router.push({ pathname: '/fork/[id]', params: { id: f.id } })} />)
      )}
    </Screen>
  );
}

function ForkRow({ fork, onPress }: { fork: Fork; onPress: () => void }) {
  const sim = fork.simulation;
  const chosen = sim.scenarios.find((s) => s.id === fork.chosenScenarioId);
  const rec = sim.scenarios.find((s) => s.id === sim.recommendation.scenarioId);
  const tone = STATUS_TONE[fork.status];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]} accessibilityRole="button">
      <View style={[styles.statusBar, { backgroundColor: tone }]} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.rowHead}>
          <Code color={tone} size={11}>{fork.status.toUpperCase()}</Code>
          <Code color={colors.textDim} size={11}>{relativeDate(fork.decidedAt ?? sim.createdAt)}</Code>
        </View>
        <Text style={styles.title} numberOfLines={2}>{sim.input.decision}</Text>
        <View style={styles.rowFoot}>
          {chosen ? (
            <Text style={styles.sub}>
              chose <Text style={{ color: colors.text }}>{chosen.title}</Text>
              {rec && rec.id !== chosen.id ? <Text style={{ color: colors.textDim }}> · AI picked {rec.title}</Text> : rec ? <Text style={{ color: colors.mint }}> · matched AI pick</Text> : null}
            </Text>
          ) : (
            <Text style={styles.sub}>
              {sim.scenarios.length} futures · leading <Text style={{ color: colors.text }}>{rec?.title}</Text>
            </Text>
          )}
          {fork.outcome && (
            <Code color={fork.outcome.rating === 'better' ? colors.mint : fork.outcome.rating === 'worse' ? colors.rose : colors.accent} size={11}>
              {`went ${fork.outcome.rating}`}
            </Code>
          )}
        </View>
      </View>
      <View style={styles.scores}>
        {sim.scenarios.map((s) => (
          <Text key={s.id} style={[styles.scoreDot, { color: scoreColor(s.score) }, s.id === fork.chosenScenarioId && styles.scoreChosen]}>
            {s.letter}
            {s.score}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  emptyTitle: { fontFamily: fonts.sans, fontSize: 20, fontWeight: '700', color: colors.text },
  emptyText: { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  statusBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontFamily: fonts.sans, fontSize: 16, fontWeight: '600', color: colors.text, lineHeight: 22 },
  rowFoot: { gap: 4 },
  sub: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
  scores: { justifyContent: 'center', gap: 4 },
  scoreDot: { fontFamily: fonts.mono, fontSize: 11 },
  scoreChosen: { fontWeight: '800', textDecorationLine: 'underline' },
});
