/**
 * Expo inlines `process.env.EXPO_PUBLIC_*` at build time, so every variable
 * must be referenced statically (no dynamic `process.env[key]`).
 */
const or = (value: string | undefined, fallback: string): string => (value === undefined || value === '' ? fallback : value);

export const CONFIG = {
  demoMode: or(process.env.EXPO_PUBLIC_DEMO_MODE, 'true') !== 'false',
  ai: {
    provider: or(process.env.EXPO_PUBLIC_AI_PROVIDER, 'groq') as 'groq' | 'demo',
    groqApiKey: or(process.env.EXPO_PUBLIC_GROQ_API_KEY, ''),
    groqModel: or(process.env.EXPO_PUBLIC_GROQ_MODEL, 'llama-3.3-70b-versatile'),
    groqBaseUrl: 'https://api.groq.com/openai/v1',
  },
  revenuecat: {
    iosKey: or(process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, ''),
    androidKey: or(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY, ''),
    entitlementId: or(process.env.EXPO_PUBLIC_RC_ENTITLEMENT_ID, 'fork_pro'),
    productMonthly: or(process.env.EXPO_PUBLIC_RC_PRODUCT_MONTHLY, 'fork_pro_monthly'),
    productYearly: or(process.env.EXPO_PUBLIC_RC_PRODUCT_YEARLY, 'fork_pro_yearly'),
  },
  freePlan: {
    activeDecisions: 3,
    scenarios: 2,
  },
} as const;

export const isAIConfigured = (): boolean =>
  !CONFIG.demoMode && CONFIG.ai.provider === 'groq' && CONFIG.ai.groqApiKey.length > 0;
