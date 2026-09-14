import React, { useMemo } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import { Screen } from '@/components/Screen';
import { Body, Chip, Code, CodeButton, Disclaimer, GlassCard, SectionLabel } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { assessConfidence, detectRiskDomain } from '@/features/simulation/engine';
import { useSimulationStore } from '@/features/simulation/store';
import { useSettingsStore } from '@/features/settings/store';
import { CURRENCIES, PRIORITIES, type DecisionContext, type Priority } from '@/types/simulation';
import { formatMoney, parseNumber } from '@/utils/format';

const PRIORITY_LABEL: Record<Priority, string> = {
  money: 'Money',
  career: 'Career',
  education: 'Education',
  convenience: 'Convenience',
  business: 'Business',
  relationships: 'Relationships',
  lifestyle: 'Lifestyle',
};

const NUMERIC_FIELDS: { key: keyof DecisionContext; label: string; hint: string }[] = [
  { key: 'savings', label: 'Current savings', hint: 'What you have set aside right now' },
  { key: 'cost', label: 'Cost of this option', hint: 'Price, tuition, deposit, relocation…' },
  { key: 'monthlyIncome', label: 'Monthly income', hint: 'Salary, allowance, side income' },
  { key: 'monthlyExpenses', label: 'Monthly essential expenses', hint: 'Rent, food, transport, data' },
];

export default function SimulateScreen() {
  const router = useRouter();
  const draft = useSimulationStore((s) => s.draft);
  const setDecision = useSimulationStore((s) => s.setDecision);
  const togglePriority = useSimulationStore((s) => s.togglePriority);
  const setContext = useSimulationStore((s) => s.setContext);
  const setCurrencyPref = useSettingsStore((s) => s.setCurrency);

  const confidence = useMemo(() => assessConfidence(draft), [draft]);
  const risk = useMemo(() => detectRiskDomain(draft.decision), [draft.decision]);
  const ready = draft.decision.trim().length >= 8 && draft.priorities.length > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        footer={
          <View style={{ gap: spacing.sm }}>
            <CodeButton label="simulate" size="lg" disabled={!ready} onPress={() => router.push('/simulate/running')} />
            <Text style={styles.footNote}>
              Confidence: <Text style={{ color: confidence.level === 'HIGH' ? colors.mint : confidence.level === 'MEDIUM' ? colors.amber : colors.rose }}>{confidence.level}</Text>
              {confidence.missing.length > 0 ? ` · add ${confidence.missing.slice(0, 2).join(', ')} to improve` : ' · looks good'}
            </Text>
          </View>
        }
      >
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <Code color={colors.textMuted}>{'← back'}</Code>
        </Pressable>

        <View>
          <SectionLabel>decision</SectionLabel>
          <TextInput value={draft.decision} onChangeText={setDecision} style={styles.decisionInput} multiline placeholderTextColor={colors.textDim} placeholder="What are you deciding?" />
        </View>

        <View>
          <SectionLabel>what matters most</SectionLabel>
          <Body muted style={{ marginBottom: spacing.sm }}>Pick one to three. This weights how each future is scored.</Body>
          <View style={styles.chips}>
            {PRIORITIES.map((p) => (
              <Chip key={p} label={PRIORITY_LABEL[p]} active={draft.priorities.includes(p)} onPress={() => togglePriority(p)} tone="mint" />
            ))}
          </View>
        </View>

        <View>
          <SectionLabel>numbers (optional, but they sharpen the picture)</SectionLabel>
          <GlassCard style={{ gap: spacing.md }}>
            <View style={styles.currencyRow}>
              <Code color={colors.textDim} size={12}>currency</Code>
              <View style={styles.currencyChips}>
                {CURRENCIES.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    active={draft.context.currency === c}
                    onPress={() => {
                      setContext({ currency: c });
                      setCurrencyPref(c);
                    }}
                    tone="neutral"
                  />
                ))}
              </View>
            </View>
            {NUMERIC_FIELDS.map((f) => (
              <NumberField
                key={f.key}
                label={f.label}
                hint={f.hint}
                value={draft.context[f.key] as number | undefined}
                currency={draft.context.currency}
                onChange={(n) => setContext({ [f.key]: n } as Partial<DecisionContext>)}
              />
            ))}
            <View>
              <Text style={styles.fieldLabel}>Goal you’re protecting</Text>
              <TextInput
                value={draft.context.goal ?? ''}
                onChangeText={(goal) => setContext({ goal: goal || undefined })}
                placeholder="e.g. University expenses"
                placeholderTextColor={colors.textDim}
                style={styles.textField}
              />
            </View>
            <View>
              <View style={styles.sliderHead}>
                <Text style={styles.fieldLabel}>Time horizon</Text>
                <Code color={colors.accent}>{`${draft.context.horizonMonths} months`}</Code>
              </View>
              <Slider
                minimumValue={1}
                maximumValue={24}
                step={1}
                value={draft.context.horizonMonths}
                onValueChange={(v) => setContext({ horizonMonths: Math.round(v) })}
                minimumTrackTintColor={colors.accent}
                maximumTrackTintColor={colors.surfaceStrong}
                thumbTintColor={colors.accent}
                accessibilityLabel="Time horizon in months"
              />
            </View>
          </GlassCard>
        </View>

        <Disclaimer domain={risk} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

function NumberField({ label, hint, value, currency, onChange }: { label: string; hint: string; value?: number; currency: DecisionContext['currency']; onChange: (n: number | undefined) => void }) {
  const [text, setText] = React.useState(value !== undefined ? String(value) : '');
  return (
    <View>
      <View style={styles.sliderHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {value !== undefined && <Code color={colors.textDim} size={11}>{formatMoney(value, currency)}</Code>}
      </View>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          onChange(parseNumber(t));
        }}
        keyboardType="numeric"
        placeholder={hint}
        placeholderTextColor={colors.textDim}
        style={styles.textField}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  decisionInput: { fontFamily: fonts.sans, fontSize: 22, fontWeight: '600', color: colors.text, lineHeight: 30, padding: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  currencyRow: { gap: spacing.sm },
  currencyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fieldLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted, marginBottom: 6 },
  textField: { fontFamily: fonts.mono, fontSize: 16, color: colors.text, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12 },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footNote: { fontFamily: fonts.mono, fontSize: 11, color: colors.textDim, textAlign: 'center' },
});
