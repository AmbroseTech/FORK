import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fitLabel, fonts, radius, scoreColor, spacing } from '@/constants/theme';
import type { Currency, Scenario } from '@/types/simulation';
import { formatCompact } from '@/utils/format';
import { Code, MetricBar } from './ui';

interface Props {
  scenario: Scenario;
  currency: Currency;
  recommended?: boolean;
  chosen?: boolean;
  locked?: boolean;
  compact?: boolean;
  onPress?: () => void;
}

export function ScenarioCard({ scenario, currency, recommended, chosen, locked, compact, onPress }: Props) {
  const color = scoreColor(scenario.score);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Scenario ${scenario.letter}: ${scenario.title}`}
      style={({ pressed }) => [
        styles.card,
        recommended && { borderColor: `${colors.mint}66` },
        chosen && { borderColor: colors.accent },
        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={[styles.accent, { backgroundColor: color }]} />
      <View style={styles.head}>
        <View style={styles.letterWrap}>
          <Code color={colors.textDim} size={12}>{`fork ${scenario.letter}`}</Code>
          <Text style={styles.title}>{scenario.title}</Text>
        </View>
        <View style={styles.scoreWrap}>
          <Text style={[styles.score, { color }]}>{locked ? '••' : scenario.score}</Text>
          <Text style={[styles.fit, { color }]}>{locked ? 'LOCKED' : fitLabel(scenario.score)}</Text>
        </View>
      </View>

      {locked ? (
        <View style={styles.lockBox}>
          <Code color={colors.amber} size={12}>{'> fork_pro required'}</Code>
          <Text style={styles.lockText}>Unlock a third future and unlimited scenarios with FORK Pro.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.desc}>{scenario.description}</Text>
          {!compact && (
            <View style={styles.metrics}>
              <MetricBar label="Financial" value={scenario.metrics.financial} />
              <MetricBar label="Opportunity" value={scenario.metrics.opportunity} />
              <MetricBar label="Goal" value={scenario.metrics.goal} />
              <MetricBar label="Stress" value={scenario.metrics.stress} invert />
            </View>
          )}
          <View style={styles.footer}>
            <View>
              <Code color={colors.textDim} size={10}>PROJECTED</Code>
              <Text style={styles.money}>{formatCompact(scenario.projectedBalance, currency)}</Text>
            </View>
            <View>
              <Code color={colors.textDim} size={10}>LOWEST POINT</Code>
              <Text style={[styles.money, scenario.minBalance < 0 && { color: colors.rose }]}>{formatCompact(scenario.minBalance, currency)}</Text>
            </View>
            {recommended ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>AI PICK</Text>
              </View>
            ) : chosen ? (
              <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.badgeText, { color: colors.accent }]}>CHOSEN</Text>
              </View>
            ) : (
              <Code color={colors.textDim} size={12}>{'view →'}</Code>
            )}
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    overflow: 'hidden',
    gap: spacing.sm,
  },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  letterWrap: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.sans, fontSize: 19, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  scoreWrap: { alignItems: 'flex-end' },
  score: { fontFamily: fonts.mono, fontSize: 32, fontWeight: '700', letterSpacing: -1.5, lineHeight: 34 },
  fit: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1 },
  desc: { fontFamily: fonts.sans, fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  metrics: { marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 },
  money: { fontFamily: fonts.mono, fontSize: 15, color: colors.text, fontWeight: '600' },
  badge: { backgroundColor: colors.mintSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  badgeText: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: colors.mint, fontWeight: '700' },
  lockBox: { gap: 6, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.amberSoft },
  lockText: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
});
