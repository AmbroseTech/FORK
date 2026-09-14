import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '@/constants/theme';
import type { Currency, TimelineEvent } from '@/types/simulation';
import { formatCompact } from '@/utils/format';

const toneColor: Record<TimelineEvent['tone'], string> = {
  neutral: colors.textDim,
  positive: colors.mint,
  negative: colors.rose,
  milestone: colors.accent,
};

export function Timeline({ events, currency }: { events: TimelineEvent[]; currency: Currency }) {
  return (
    <View style={styles.root}>
      {events.map((e, i) => {
        const last = i === events.length - 1;
        const c = toneColor[e.tone];
        return (
          <View key={e.id} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, { borderColor: c, backgroundColor: e.tone === 'milestone' ? c : colors.bg }]} />
              {!last && <View style={styles.line} />}
            </View>
            <View style={[styles.content, last && { paddingBottom: 0 }]}>
              <Text style={[styles.label, { color: c }]}>{e.label}</Text>
              <Text style={styles.title}>{e.title}</Text>
              {e.detail ? <Text style={styles.detail}>{e.detail}</Text> : null}
              {typeof e.balance === 'number' ? (
                <Text style={[styles.balance, e.balance < 0 && { color: colors.rose }]}>{formatCompact(e.balance, currency)}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingVertical: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 16, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 4 },
  line: { flex: 1, width: 1, backgroundColor: colors.borderStrong, marginVertical: 4 },
  content: { flex: 1, paddingBottom: spacing.lg, gap: 2 },
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2 },
  title: { fontFamily: fonts.sans, fontSize: 16, fontWeight: '600', color: colors.text },
  detail: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  balance: { fontFamily: fonts.mono, fontSize: 13, color: colors.mint, marginTop: 2 },
});
