import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScenarioCard } from '@/components/ScenarioCard';
import { Screen } from '@/components/Screen';
import { Body, Chip, Code, CodeButton, Disclaimer, GlassCard, SectionLabel, Subtitle } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { useDecisionsStore } from '@/features/decisions/store';
import { useSimulationStore } from '@/features/simulation/store';
import { useHaptics } from '@/hooks/useHaptics';
import type { OutcomeRating } from '@/types/simulation';
import { relativeDate } from '@/utils/format';

const RATINGS: { key: OutcomeRating; label: string; tone: 'mint' | 'accent' | 'rose' }[] = [
  { key: 'better', label: 'better than expected', tone: 'mint' },
  { key: 'expected', label: 'about as expected', tone: 'accent' },
  { key: 'worse', label: 'worse than expected', tone: 'rose' },
];

export default function ForkScreen() {
  const router = useRouter();
  const { id, choose } = useLocalSearchParams<{ id: string; choose?: string }>();
  const fork = useDecisionsStore((s) => s.forks.find((f) => f.id === id));
  const decide = useDecisionsStore((s) => s.decide);
  const recordOutcome = useDecisionsStore((s) => s.recordOutcome);
  const remove = useDecisionsStore((s) => s.remove);
  const setCurrent = useSimulationStore((s) => s.setCurrent);
  const { success } = useHaptics();
  const [rating, setRating] = useState<OutcomeRating | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (fork) setCurrent(fork.simulation);
  }, [fork, setCurrent]);

  useEffect(() => {
    if (fork && choose && fork.status === 'pending') {
      decide(fork.id, choose);
      success();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choose]);

  if (!fork) {
    return (
      <Screen>
        <Code>fork not found</Code>
        <CodeButton label="back" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const sim = fork.simulation;
  const chosen = sim.scenarios.find((s) => s.id === fork.chosenScenarioId);
  const rec = sim.scenarios.find((s) => s.id === sim.recommendation.scenarioId);

  const onDelete = () =>
    Alert.alert('Delete this fork?', 'This removes the saved decision and its outcome.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          remove(fork.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <Code color={colors.textMuted}>{'← back'}</Code>
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={12} accessibilityRole="button" accessibilityLabel="Delete fork">
          <Code color={colors.textDim} size={12}>delete</Code>
        </Pressable>
      </View>

      <View>
        <SectionLabel>{`fork · ${fork.status} · ${relativeDate(sim.createdAt)}`}</SectionLabel>
        <Text style={styles.decision}>{sim.input.decision}</Text>
        <Subtitle>{sim.input.priorities.join(' · ')}</Subtitle>
      </View>

      {fork.status === 'pending' && (
        <GlassCard style={{ gap: spacing.sm }} glow={colors.accent}>
          <Code color={colors.accent} size={12}>{'> decide()'}</Code>
          <Body>Which path are you taking? Pick one to start tracking the outcome.</Body>
          <View style={styles.chooseRow}>
            {sim.scenarios.map((s) => (
              <CodeButton
                key={s.id}
                label={`choose_${s.letter}`}
                size="sm"
                variant={s.id === rec?.id ? 'primary' : 'ghost'}
                style={{ flex: 1 }}
                onPress={() => {
                  decide(fork.id, s.id);
                  success();
                }}
              />
            ))}
          </View>
          {rec && <Code color={colors.textDim} size={11}>{`AI pick: ${rec.letter} · ${rec.title}`}</Code>}
        </GlassCard>
      )}

      {fork.status === 'decided' && chosen && (
        <GlassCard style={{ gap: spacing.sm }} glow={colors.mint}>
          <Code color={colors.mint} size={12}>{'> record_outcome()'}</Code>
          <Body>
            You chose <Text style={{ fontWeight: '700' }}>{chosen.title}</Text>
            {rec && rec.id !== chosen.id ? ` — the AI leaned toward ${rec.title}.` : rec ? ' — same as the AI pick.' : '.'} How did it go?
          </Body>
          <View style={styles.ratings}>
            {RATINGS.map((r) => (
              <Chip key={r.key} label={r.label} tone={r.tone} active={rating === r.key} onPress={() => setRating(r.key)} />
            ))}
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="What actually happened? (optional)"
            placeholderTextColor={colors.textDim}
            style={styles.note}
            multiline
          />
          <CodeButton
            label="save_outcome"
            disabled={!rating}
            onPress={() => {
              if (!rating) return;
              recordOutcome(fork.id, rating, note.trim());
              success();
            }}
          />
        </GlassCard>
      )}

      {fork.status === 'reviewed' && fork.outcome && (
        <GlassCard style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Code color={colors.mint} size={12}>{'> outcome'}</Code>
            <Code color={colors.textDim} size={11}>{relativeDate(fork.outcome.recordedAt)}</Code>
          </View>
          <Text style={styles.outcomeRating}>
            {fork.outcome.rating === 'better' ? 'Better than expected' : fork.outcome.rating === 'worse' ? 'Worse than expected' : 'About as expected'}
          </Text>
          {fork.outcome.note ? <Body muted>{fork.outcome.note}</Body> : null}
          {chosen && rec && (
            <Code color={colors.textDim} size={11}>
              {chosen.id === rec.id ? 'you followed the AI pick' : `you chose ${chosen.title}; AI picked ${rec.title}`}
            </Code>
          )}
        </GlassCard>
      )}

      <View>
        <SectionLabel>the futures you compared</SectionLabel>
        <View style={{ gap: spacing.sm }}>
          {sim.scenarios.map((s) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              currency={sim.input.context.currency}
              compact
              recommended={s.id === rec?.id && !chosen}
              chosen={s.id === chosen?.id}
              onPress={() => router.push({ pathname: '/scenario/[id]', params: { id: s.id, forkId: fork.id } })}
            />
          ))}
        </View>
      </View>

      <CodeButton label="re_simulate" variant="subtle" onPress={() => router.push('/futures')} />
      <Disclaimer domain={sim.riskDomain} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  decision: { fontFamily: fonts.sans, fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.5, lineHeight: 30, marginBottom: 4 },
  chooseRow: { flexDirection: 'row', gap: spacing.sm },
  ratings: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  note: { fontFamily: fonts.sans, fontSize: 14, color: colors.text, minHeight: 64, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 12 },
  outcomeRating: { fontFamily: fonts.sans, fontSize: 18, fontWeight: '700', color: colors.text },
});
