import { useCallback, useEffect } from 'react';
import { create } from 'zustand';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import {
  checkProEntitlement,
  getOfferings,
  initializeRevenueCat,
  isRevenueCatConfigured,
  purchasePackage,
  restorePurchases,
  subscribeToCustomerInfo,
  type ProState,
} from '@/services/revenuecat';
import { CONFIG } from '@/constants/config';
import { useDecisionsStore, selectActiveCount } from '@/features/decisions/store';

interface SubscriptionStore {
  ready: boolean;
  configured: boolean;
  pro: ProState;
  offering: PurchasesOffering | null;
  loading: boolean;
  error: string | null;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
}

const idle: ProState = { isPro: false, expiresAt: null, willRenew: false, productId: null };
let unsubscribe: (() => void) | null = null;

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  ready: false,
  configured: false,
  pro: idle,
  offering: null,
  loading: false,
  error: null,

  init: async () => {
    if (get().ready) return;
    const ok = initializeRevenueCat();
    set({ configured: ok });
    if (ok) {
      unsubscribe?.();
      unsubscribe = subscribeToCustomerInfo((pro) => set({ pro }));
      await get().refresh();
    }
    set({ ready: true });
  },

  refresh: async () => {
    if (!isRevenueCatConfigured()) return;
    set({ loading: true, error: null });
    try {
      const [pro, offering] = await Promise.all([checkProEntitlement(), getOfferings()]);
      set({ pro, offering });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Could not reach RevenueCat' });
    } finally {
      set({ loading: false });
    }
  },

  purchase: async (pkg) => {
    set({ loading: true, error: null });
    try {
      const { state, cancelled } = await purchasePackage(pkg);
      set({ pro: state });
      return !cancelled && state.isPro;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Purchase failed' });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  restore: async () => {
    set({ loading: true, error: null });
    try {
      const state = await restorePurchases();
      set({ pro: state });
      return state.isPro;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Restore failed' });
      return false;
    } finally {
      set({ loading: false });
    }
  },
}));

export interface PlanLimits {
  isPro: boolean;
  maxActiveDecisions: number;
  maxScenarios: number;
  activeDecisions: number;
  canStartNewDecision: boolean;
  canUseCustomWhatIf: boolean;
  canSeeAdvancedInsights: boolean;
}

/** Single hook the UI uses for all subscription + plan-limit questions. */
export function useSubscription() {
  const store = useSubscriptionStore();
  const forks = useDecisionsStore((s) => s.forks);

  useEffect(() => {
    void store.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeDecisions = selectActiveCount(forks);
  const isPro = store.pro.isPro;
  const limits: PlanLimits = {
    isPro,
    maxActiveDecisions: isPro ? Number.POSITIVE_INFINITY : CONFIG.freePlan.activeDecisions,
    maxScenarios: isPro ? Number.POSITIVE_INFINITY : CONFIG.freePlan.scenarios,
    activeDecisions,
    canStartNewDecision: isPro || activeDecisions < CONFIG.freePlan.activeDecisions,
    canUseCustomWhatIf: isPro,
    canSeeAdvancedInsights: isPro,
  };

  const monthly = store.offering?.availablePackages.find(
    (p) => p.product.identifier === CONFIG.revenuecat.productMonthly || p.packageType === 'MONTHLY',
  );
  const yearly = store.offering?.availablePackages.find(
    (p) => p.product.identifier === CONFIG.revenuecat.productYearly || p.packageType === 'ANNUAL',
  );

  const purchase = useCallback((pkg: PurchasesPackage) => store.purchase(pkg), [store]);
  const restore = useCallback(() => store.restore(), [store]);

  return {
    ready: store.ready,
    configured: store.configured,
    loading: store.loading,
    error: store.error,
    pro: store.pro,
    limits,
    packages: { monthly, yearly },
    purchase,
    restore,
    refresh: store.refresh,
  };
}
