/**
 * RevenueCat service — the ONLY place the app talks to the Purchases SDK.
 * UI consumes subscription state through `useSubscription()`.
 *
 * If no public SDK key is configured for the current platform, the service
 * reports `configured: false` and the paywall explains how to wire it up —
 * it never fakes offerings or purchase success.
 */
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { CONFIG } from '@/constants/config';

export interface ProState {
  isPro: boolean;
  expiresAt: string | null;
  willRenew: boolean;
  productId: string | null;
}

let configured = false;

export function getPlatformKey(): string {
  if (Platform.OS === 'ios') return CONFIG.revenuecat.iosKey;
  if (Platform.OS === 'android') return CONFIG.revenuecat.androidKey;
  return '';
}

export function isRevenueCatConfigured(): boolean {
  return configured;
}

export function initializeRevenueCat(appUserId?: string): boolean {
  if (configured) return true;
  const apiKey = getPlatformKey();
  if (!apiKey) return false;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey, appUserID: appUserId ?? null });
  configured = true;
  return true;
}

export function proStateFrom(info: CustomerInfo): ProState {
  const ent = info.entitlements.active[CONFIG.revenuecat.entitlementId];
  return {
    isPro: Boolean(ent),
    expiresAt: ent?.expirationDate ?? null,
    willRenew: ent?.willRenew ?? false,
    productId: ent?.productIdentifier ?? null,
  };
}

export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!configured) return null;
  const offerings = await Purchases.getOfferings();
  return offerings.current ?? null;
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<{ state: ProState; cancelled: boolean }> {
  if (!configured) throw new Error('RevenueCat is not configured');
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { state: proStateFrom(customerInfo), cancelled: false };
  } catch (e) {
    if (isUserCancelled(e)) {
      return { state: await checkProEntitlement(), cancelled: true };
    }
    throw e;
  }
}

export async function restorePurchases(): Promise<ProState> {
  if (!configured) throw new Error('RevenueCat is not configured');
  const info = await Purchases.restorePurchases();
  return proStateFrom(info);
}

export async function checkProEntitlement(): Promise<ProState> {
  if (!configured) return { isPro: false, expiresAt: null, willRenew: false, productId: null };
  const info = await Purchases.getCustomerInfo();
  return proStateFrom(info);
}

export function subscribeToCustomerInfo(listener: (state: ProState) => void): () => void {
  if (!configured) return () => undefined;
  const wrapped = (info: CustomerInfo) => listener(proStateFrom(info));
  Purchases.addCustomerInfoUpdateListener(wrapped);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(wrapped);
  };
}

function isUserCancelled(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'userCancelled' in e && Boolean((e as { userCancelled: unknown }).userCancelled);
}

export function savingsPercent(monthlyPrice: number, yearlyPrice: number): number {
  if (monthlyPrice <= 0) return 0;
  return Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);
}
