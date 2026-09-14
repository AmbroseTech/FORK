import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, scoreColor, spacing } from '@/constants/theme';
import { project, resolveContext } from '@/features/simulation/engine';
import type { Currency, Scenario, Simulation } from '@/types/simulation';
import { formatCompact } from '@/utils/format';

const H = 120;

/** Dependency-free bar chart of each scenario's month-by-month balance. */
export function BalanceChart({ simulation, highlight }: { simulation: Simulation; highlight?: string }) {
  const ctx = resolveContext(simulation.input.context, simulation.overrides);
  const series = simulation.scenarios.map((s) => ({ s, balances: project(s, ctx).balances }));
  const all = series.flatMap((x) => x.balances);
  const max = Math.max(1, ...all);
  const min = Math.min(0, ...all);
  const span = max - min || 1;
  const months = ctx.horizonMonths;

  return (
    <View style={styles.root}>
      <View style={styles.chart}>
        {Array.from({ length: months + 1 }).map((_, m) => (
          <View key={m} style={styles.monthCol}>
            {series.map(({ s, balances }) => {
              const v = balances[m] ?? 0;
              const h = Math.max(2, ((v - min) / span) * H);
              const dim = highlight && highlight !== s.id;
              return (
                <View
                  key={s.id}
                  style={[styles.bar, { height: h, backgroundColor: scoreColor(s.score), opacity: dim ? 0.25 : 0.9 }]}
                />
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>now</Text>
        <Text style={styles.axisText}>{`month ${months}`}</Text>
      </View>
      <View style={styles.legend}>
        {series.map(({ s }) => (
          <LegendItem key={s.id} scenario={s} currency={ctx.currency} dim={Boolean(highlight && highlight !== s.id)} />
        ))}
      </View>
    </View>
  );
}

function LegendItem({ scenario, currency, dim }: { scenario: Scenario; currency: Currency; dim: boolean }) {
  return (
    <View style={[styles.legendItem, dim && { opacity: 0.4 }]}>
      <View style={[styles.swatch, { backgroundColor: scoreColor(scenario.score) }]} />
      <Text style={styles.legendText} numberOfLines={1}>
        {scenario.letter} · {scenario.title}
      </Text>
      <Text style={styles.legendValue}>{formatCompact(scenario.projectedBalance, currency)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  chart: { height: H, flexDirection: 'row', alignItems: 'flex-end', gap: 6, borderBottomWidth: 1, borderBottomColor: colors.borderStrong, paddingBottom: 1 },
  monthCol: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { fontFamily: fonts.mono, fontSize: 10, color: colors.textDim },
  legend: { gap: 6, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  legendText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted },
  legendValue: { fontFamily: fonts.mono, fontSize: 12, color: colors.text },
});
