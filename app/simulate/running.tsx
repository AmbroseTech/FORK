import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Code, CodeButton } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { useSimulationStore } from '@/features/simulation/store';
import { useHaptics } from '@/hooks/useHaptics';

const STEPS = [
  'parsing decision…',
  'reading your constraints…',
  'forking possible futures…',
  'projecting month by month…',
  'scoring trade-offs…',
  'writing the recommendation…',
];

const MIN_DURATION = 2600;

export default function RunningScreen() {
  const router = useRouter();
  const run = useSimulationStore((s) => s.run);
  const status = useSimulationStore((s) => s.status);
  const error = useSimulationStore((s) => s.error);
  const decision = useSimulationStore((s) => s.draft.decision);
  const { success } = useHaptics();
  const [step, setStep] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const started = useRef(false);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
    Animated.timing(progress, { toValue: 1, duration: MIN_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    const tick = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), MIN_DURATION / STEPS.length);
    return () => clearInterval(tick);
  }, [progress, pulse]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const startedAt = Date.now();
    void run().then((sim) => {
      if (!sim) return;
      const wait = Math.max(0, MIN_DURATION - (Date.now() - startedAt));
      setTimeout(() => {
        success();
        router.replace('/futures');
      }, wait);
    });
  }, [run, router, success]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Screen scroll={false} contentStyle={styles.center}>
      <View style={styles.orbWrap}>
        <Animated.View style={[styles.orbGlow, { transform: [{ scale }] }]} />
        <View style={styles.orb}>
          <Text style={styles.orbText}>⑂</Text>
        </View>
      </View>

      <Text style={styles.fn}>
        simulate<Text style={{ color: colors.accent }}>(</Text>
        <Text style={styles.arg} numberOfLines={2}>
          “{decision.trim()}”
        </Text>
        <Text style={{ color: colors.accent }}>)</Text>
      </Text>

      {status === 'error' ? (
        <View style={styles.errorBox}>
          <Code color={colors.rose}>{'> error'}</Code>
          <Text style={styles.errorText}>{error ?? 'Simulation failed'}</Text>
          <CodeButton label="retry" variant="ghost" onPress={() => { started.current = false; void run().then((s) => s && router.replace('/futures')); }} />
          <CodeButton label="back" variant="subtle" size="sm" onPress={() => router.back()} />
        </View>
      ) : (
        <>
          <View style={styles.steps}>
            {STEPS.map((s, i) => (
              <Text key={s} style={[styles.step, i === step && styles.stepActive, i < step && styles.stepDone]}>
                {i < step ? '✓ ' : i === step ? '▸ ' : '  '}
                {s}
              </Text>
            ))}
          </View>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width }]} />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center', gap: spacing.xl },
  orbWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  orbGlow: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(124,156,255,0.18)' },
  orb: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: `${colors.accent}66`, alignItems: 'center', justifyContent: 'center' },
  orbText: { fontSize: 40, color: colors.accent, fontFamily: fonts.mono },
  fn: { fontFamily: fonts.mono, fontSize: 18, color: colors.text, textAlign: 'center', paddingHorizontal: spacing.md },
  arg: { color: colors.mint, fontSize: 15 },
  steps: { alignSelf: 'stretch', gap: 6, paddingHorizontal: spacing.lg },
  step: { fontFamily: fonts.mono, fontSize: 13, color: colors.textDim },
  stepActive: { color: colors.text },
  stepDone: { color: colors.mint },
  track: { alignSelf: 'stretch', height: 3, backgroundColor: colors.surfaceStrong, borderRadius: 2, marginHorizontal: spacing.lg, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent },
  errorBox: { alignSelf: 'stretch', gap: spacing.md, padding: spacing.md, borderRadius: 16, backgroundColor: colors.roseSoft },
  errorText: { fontFamily: fonts.sans, fontSize: 14, color: colors.text },
});
