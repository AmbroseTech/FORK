import React from 'react';
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Body, Chip, Code, CodeButton, GlassCard, SectionLabel, Subtitle, Title } from '@/components/ui';
import { CONFIG } from '@/constants/config';
import { colors, fonts, spacing } from '@/constants/theme';
import { useDecisionsStore } from '@/features/decisions/store';
import { useSimulationStore } from '@/features/simulation/store';
import { useSettingsStore } from '@/features/settings/store';
import { useSubscription } from '@/hooks/useSubscription';
import { aiModeLabel } from '@/services/ai';
import { clearAllData } from '@/services/storage';
import { CURRENCIES } from '@/types/simulation';

const REPO_URL = 'https://github.com/AmbroseTech/FORK';

export default function ProfileScreen() {
  const router = useRouter();
  const settings = useSettingsStore();
  const forks = useDecisionsStore((s) => s.forks);
  const clearForks = useDecisionsStore((s) => s.clear);
  const loadDemo = useSimulationStore((s) => s.loadDemoDraft);
  const { pro, limits, configured, restore, loading, error } = useSubscription();

  const onReset = () =>
    Alert.alert('Clear all local data?', 'Saved forks, settings and the current simulation will be removed from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          clearForks();
          await clearAllData();
        },
      },
    ]);

  return (
    <Screen inTabs>
      <View>
        <SectionLabel>profile</SectionLabel>
        <Title>You & FORK</Title>
        <Subtitle>{forks.length} forks saved on this device. No account needed.</Subtitle>
      </View>

      <GlassCard glow={pro.isPro ? colors.mint : colors.accent} style={{ gap: spacing.sm }}>
        <View style={styles.rowBetween}>
          <Code color={pro.isPro ? colors.mint : colors.accent} size={12}>{pro.isPro ? '> fork_pro · active' : '> free plan'}</Code>
          {pro.isPro && pro.expiresAt && <Code color={colors.textDim} size={11}>{`${pro.willRenew ? 'renews' : 'ends'} ${new Date(pro.expiresAt).toLocaleDateString()}`}</Code>}
        </View>
        {pro.isPro ? (
          <Body>Unlimited decisions, all scenarios, custom what-ifs and advanced patterns. Thank you for supporting FORK.</Body>
        ) : (
          <>
            <Body>
              {limits.activeDecisions}/{limits.maxActiveDecisions} active decisions · {limits.maxScenarios} scenarios per simulation · preset what-ifs · basic patterns.
            </Body>
            <CodeButton label="upgrade" onPress={() => router.push('/paywall')} />
          </>
        )}
        <Pressable onPress={() => void restore()} disabled={!configured || loading} hitSlop={8}>
          <Code color={configured ? colors.textMuted : colors.textDim} size={12}>
            {configured ? 'restore_purchases()' : 'restore_purchases() · RevenueCat not configured on this platform'}
          </Code>
        </Pressable>
        {error && <Code color={colors.rose} size={11}>{error}</Code>}
      </GlassCard>

      <GlassCard style={{ gap: spacing.md }}>
        <SectionLabel>preferences</SectionLabel>
        <View>
          <Text style={styles.label}>Default currency</Text>
          <View style={styles.chips}>
            {CURRENCIES.map((c) => (
              <Chip key={c} label={c} active={settings.currency === c} onPress={() => settings.setCurrency(c)} tone="neutral" />
            ))}
          </View>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Haptic feedback</Text>
          <Switch value={settings.haptics} onValueChange={settings.setHaptics} trackColor={{ true: colors.accent, false: colors.surfaceStrong }} thumbColor={colors.text} />
        </View>
      </GlassCard>

      <GlassCard style={{ gap: spacing.sm }}>
        <SectionLabel>engine</SectionLabel>
        <Row k="ai" v={aiModeLabel()} />
        <Row k="numbers" v="deterministic · on-device" />
        <Row k="storage" v="local only · AsyncStorage" />
        <Row k="entitlement" v={CONFIG.revenuecat.entitlementId} />
        <Row k="demo mode" v={CONFIG.demoMode ? 'on' : 'off'} />
        <CodeButton
          label="load_demo_decision"
          variant="ghost"
          size="sm"
          onPress={() => {
            loadDemo();
            router.push('/simulate');
          }}
        />
      </GlassCard>

      <GlassCard style={{ gap: spacing.sm }}>
        <SectionLabel>responsible ai</SectionLabel>
        <Body muted>
          FORK explores possible scenarios based on the numbers and priorities you give it. It does not predict the future, and it is not financial, legal, medical or
          career advice. Demo mode uses seeded data and is labelled as such.
        </Body>
      </GlassCard>

      <View style={{ gap: spacing.sm }}>
        <CodeButton label="view_source" variant="subtle" size="sm" onPress={() => void Linking.openURL(REPO_URL)} />
        <CodeButton label="clear_local_data" variant="danger" size="sm" onPress={onReset} />
      </View>

      <Text style={styles.foot}>FORK v1.0.0 · MIT · built for RevenueCat Shipaton 2026</Text>
    </Screen>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.rowBetween}>
      <Code color={colors.textDim} size={12}>{k}</Code>
      <Code color={colors.text} size={12}>{v}</Code>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  label: { fontFamily: fonts.sans, fontSize: 14, color: colors.text, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  foot: { fontFamily: fonts.mono, fontSize: 11, color: colors.textDim, textAlign: 'center' },
});
