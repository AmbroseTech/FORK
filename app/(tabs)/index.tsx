import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Chip, Code, CodeButton, GlassCard, SectionLabel, Subtitle } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { useDecisionsStore } from '@/features/decisions/store';
import { EXAMPLE_DECISIONS } from '@/features/simulation/demoDraft';
import { useSimulationStore } from '@/features/simulation/store';
import { useSettingsStore } from '@/features/settings/store';
import { useSubscription } from '@/hooks/useSubscription';
import { aiModeLabel } from '@/services/ai';
import { CATEGORIES } from '@/types/simulation';
import { relativeDate } from '@/utils/format';

const CATEGORY_HINT: Record<string, string> = {
  Money: 'Should I buy … now or keep saving?',
  Career: 'Should I take this job offer?',
  Education: 'Should I enroll in this course?',
  Business: 'Should I start my business now?',
  Relationships: 'Should I move closer to my partner?',
  Lifestyle: 'Should I move to a new city?',
};

export default function HomeScreen() {
  const router = useRouter();
  const draft = useSimulationStore((s) => s.draft);
  const setDecision = useSimulationStore((s) => s.setDecision);
  const resetDraft = useSimulationStore((s) => s.resetDraft);
  const loadDemoDraft = useSimulationStore((s) => s.loadDemoDraft);
  const currency = useSettingsStore((s) => s.currency);
  const forks = useDecisionsStore((s) => s.forks);
  const { limits } = useSubscription();
  const [category, setCategory] = useState<string | null>(null);

  const [cursor] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(cursor, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(cursor, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [cursor]);

  const canContinue = draft.decision.trim().length >= 8;
  const recent = forks.slice(0, 2);

  const start = () => {
    if (!limits.canStartNewDecision) {
      router.push('/paywall');
      return;
    }
    router.push('/simulate');
  };

  return (
    <Screen inTabs>
      <View style={styles.brand}>
        <Text style={styles.logo}>
          FORK<Text style={{ color: colors.accent }}>_</Text>
        </Text>
        <Code color={colors.textDim} size={11}>{aiModeLabel()}</Code>
      </View>

      <View>
        <Text style={styles.hero}>What are you deciding?</Text>
        <Subtitle>Don’t just make a decision. See where it leads.</Subtitle>
      </View>

      <GlassCard style={styles.inputCard}>
        <View style={styles.inputRow}>
          <Code color={colors.accent} size={16}>{'>'}</Code>
          <TextInput
            value={draft.decision}
            onChangeText={setDecision}
            placeholder={category ? CATEGORY_HINT[category] : 'Should I buy a laptop now or keep saving?'}
            placeholderTextColor={colors.textDim}
            style={styles.input}
            multiline
            maxLength={160}
            accessibilityLabel="Decision"
            returnKeyType="done"
            blurOnSubmit
          />
          {!draft.decision && <Animated.Text style={[styles.cursor, { opacity: cursor }]}>▍</Animated.Text>}
        </View>
        <View style={styles.categories}>
          {CATEGORIES.map((c) => (
            <Chip key={c} label={c} active={category === c} onPress={() => setCategory(category === c ? null : c)} tone="accent" />
          ))}
        </View>
        <CodeButton label="simulate" size="lg" disabled={!canContinue} onPress={start} />
        {!limits.canStartNewDecision && (
          <Text style={styles.limit}>Free plan: {limits.activeDecisions}/{limits.maxActiveDecisions} active decisions. Decide one or unlock Pro.</Text>
        )}
      </GlassCard>

      <View>
        <SectionLabel>try one</SectionLabel>
        <View style={styles.examples}>
          {EXAMPLE_DECISIONS.map((d) => (
            <Pressable
              key={d}
              onPress={() => {
                if (d.startsWith('Should I buy a laptop')) loadDemoDraft();
                else {
                  resetDraft(currency);
                  setDecision(d);
                }
              }}
              style={({ pressed }) => [styles.example, pressed && { opacity: 0.7 }]}
            >
              <Code color={colors.textDim} size={12}>{'fork('}</Code>
              <Text style={styles.exampleText} numberOfLines={1}>
                {d}
              </Text>
              <Code color={colors.textDim} size={12}>{')'}</Code>
            </Pressable>
          ))}
        </View>
      </View>

      {recent.length > 0 && (
        <View>
          <SectionLabel>recent forks</SectionLabel>
          {recent.map((f) => (
            <Pressable key={f.id} onPress={() => router.push({ pathname: '/fork/[id]', params: { id: f.id } })} style={({ pressed }) => [styles.recent, pressed && { opacity: 0.7 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recentTitle} numberOfLines={1}>
                  {f.simulation.input.decision}
                </Text>
                <Code color={colors.textDim} size={11}>{`${f.status} · ${relativeDate(f.simulation.createdAt)}`}</Code>
              </View>
              <Code color={colors.accent} size={12}>{'→'}</Code>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.foot}>FORK explores possible scenarios. It does not predict the future.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontFamily: fonts.mono, fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: 3 },
  hero: { fontFamily: fonts.sans, fontSize: 34, fontWeight: '800', color: colors.text, letterSpacing: -1, marginBottom: 6, marginTop: spacing.md },
  inputCard: { gap: spacing.md, backgroundColor: colors.bgElevated },
  inputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, minHeight: 56 },
  input: { flex: 1, fontFamily: fonts.sans, fontSize: 18, color: colors.text, lineHeight: 26, paddingTop: 0 },
  cursor: { color: colors.accent, fontSize: 18, position: 'absolute', left: 24, top: 0 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  limit: { fontFamily: fonts.sans, fontSize: 12, color: colors.amber, textAlign: 'center' },
  examples: { gap: spacing.sm },
  example: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  exampleText: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted },
  recent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 12, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  recentTitle: { fontFamily: fonts.sans, fontSize: 14, color: colors.text, marginBottom: 2 },
  foot: { fontFamily: fonts.mono, fontSize: 11, color: colors.textDim, textAlign: 'center', marginTop: spacing.sm },
});
