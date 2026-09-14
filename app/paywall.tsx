import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';
import { Screen } from '@/components/Screen';
import { Body, Code, CodeButton, GlassCard, SectionLabel, Title } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useSubscription } from '@/hooks/useSubscription';
import { savingsPercent } from '@/services/revenuecat';

const FEATURES: { free: string; pro: string; label: string }[] = [
  { label: 'Active decisions', free: '3', pro: 'Unlimited' },
  { label: 'Futures per decision', free: '2', pro: 'All (3–4)' },
  { label: 'what_if() presets', free: '✓', pro: '✓' },
  { label: 'Custom what_if() in plain words', free: '—', pro: '✓' },
  { label: 'Decision patterns', free: 'Basic', pro: 'Advanced + trends' },
  { label: 'Outcome tracking', free: '✓', pro: '✓' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { configured, ready, loading, error, packages, purchase, restore, pro } = useSubscription();
  const { success } = useHaptics();
  const [selected, setSelected] = useState<'monthly' | 'yearly'>('yearly');
  const [done, setDone] = useState(false);

  const monthly = packages.monthly;
  const yearly = packages.yearly;
  const pkg: PurchasesPackage | undefined = selected === 'yearly' ? yearly ?? monthly : monthly ?? yearly;
  const saving = monthly && yearly ? savingsPercent(monthly.product.price, yearly.product.price) : 0;

  const buy = async () => {
    if (!pkg) return;
    const ok = await purchase(pkg);
    if (ok) {
      success();
      setDone(true);
    }
  };

  if (pro.isPro || done) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <Code color={colors.mint} size={48}>⑂</Code>
        <Title>fork_pro <Text style={{ color: colors.mint }}>unlocked</Text></Title>
        <Body muted style={{ textAlign: 'center' }}>Every future, every variable, every pattern. Thank you for supporting an open-source project.</Body>
        <CodeButton label="continue" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={{ gap: spacing.sm }}>
          {configured ? (
            <CodeButton
              label={pkg ? `subscribe · ${pkg.product.priceString}` : 'loading_offerings'}
              size="lg"
              disabled={!pkg || loading}
              onPress={() => void buy()}
            />
          ) : (
            <View style={styles.notConfigured}>
              <Code color={colors.amber} size={12}>{'> RevenueCat not configured'}</Code>
              <Text style={styles.notConfiguredText}>
                Purchases require the native app with EXPO_PUBLIC_REVENUECAT_IOS_KEY / ANDROID_KEY set. No fake purchases here — the free plan stays fully usable.
              </Text>
            </View>
          )}
          <View style={styles.footLinks}>
            <Pressable onPress={() => void restore()} disabled={!configured || loading} hitSlop={8}>
              <Code color={colors.textMuted} size={12}>restore_purchases()</Code>
            </Pressable>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Code color={colors.textMuted} size={12}>not_now()</Code>
            </Pressable>
          </View>
          {error && <Code color={colors.rose} size={11}>{error}</Code>}
        </View>
      }
    >
      <View style={styles.topRow}>
        <SectionLabel style={{ marginBottom: 0 }}>fork_pro</SectionLabel>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Code color={colors.textMuted}>{'close ×'}</Code>
        </Pressable>
      </View>

      <Title>See every future.{'\n'}Change every variable.</Title>
      <Body muted>Free FORK is genuinely useful. Pro removes the ceilings for people making decisions every week.</Body>

      <GlassCard style={{ gap: 0 }}>
        <View style={[styles.tr, styles.thRow]}>
          <Text style={[styles.th, { flex: 2, textAlign: 'left' }]}>feature</Text>
          <Text style={styles.th}>free</Text>
          <Text style={[styles.th, { color: colors.mint }]}>pro</Text>
        </View>
        {FEATURES.map((f) => (
          <View key={f.label} style={styles.tr}>
            <Text style={[styles.td, { flex: 2, textAlign: 'left', color: colors.textMuted }]}>{f.label}</Text>
            <Text style={styles.td}>{f.free}</Text>
            <Text style={[styles.td, { color: colors.mint, fontWeight: '700' }]}>{f.pro}</Text>
          </View>
        ))}
      </GlassCard>

      <View style={styles.plans}>
        <Plan
          title="yearly"
          pkg={yearly}
          fallbackPrice="—"
          badge={saving > 0 ? `save ${saving}%` : 'best value'}
          active={selected === 'yearly'}
          onPress={() => setSelected('yearly')}
          loading={!ready || loading}
          configured={configured}
        />
        <Plan title="monthly" pkg={monthly} fallbackPrice="—" active={selected === 'monthly'} onPress={() => setSelected('monthly')} loading={!ready || loading} configured={configured} />
      </View>

      <Text style={styles.fine}>
        Subscriptions are billed through the App Store / Google Play and managed by RevenueCat. Cancel anytime. Prices shown are live from the store for your region.
      </Text>
    </Screen>
  );
}

function Plan({ title, pkg, fallbackPrice, badge, active, onPress, loading, configured }: { title: string; pkg?: PurchasesPackage; fallbackPrice: string; badge?: string; active: boolean; onPress: () => void; loading: boolean; configured: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.plan, active && styles.planActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <View style={styles.rowBetween}>
        <Code color={active ? colors.accent : colors.textMuted} size={12}>{title}</Code>
        {badge && <Text style={styles.badge}>{badge}</Text>}
      </View>
      {loading && configured ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <Text style={styles.price}>{pkg ? pkg.product.priceString : fallbackPrice}</Text>
      )}
      <Code color={colors.textDim} size={11}>{pkg ? pkg.product.title : configured ? 'not in offering' : 'store price'}</Code>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  thRow: { borderBottomColor: colors.borderStrong },
  th: { flex: 1, textAlign: 'center', fontFamily: fonts.mono, fontSize: 11, color: colors.textDim, letterSpacing: 1 },
  td: { flex: 1, textAlign: 'center', fontFamily: fonts.sans, fontSize: 13, color: colors.text },
  plans: { flexDirection: 'row', gap: spacing.sm },
  plan: { flex: 1, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgElevated, gap: 6 },
  planActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { fontFamily: fonts.mono, fontSize: 10, color: colors.mint, backgroundColor: colors.mintSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  price: { fontFamily: fonts.mono, fontSize: 24, fontWeight: '700', color: colors.text },
  fine: { fontFamily: fonts.sans, fontSize: 11, color: colors.textDim, lineHeight: 16, textAlign: 'center' },
  notConfigured: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.amberSoft, gap: 6 },
  notConfiguredText: { fontFamily: fonts.sans, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  footLinks: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.sm },
});
