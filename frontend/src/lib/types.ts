import type { Confidence, DecisionContext, DecisionInput, Recommendation, Scenario, ScenarioSeed, Source } from '../engine/types';

export interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface Profile {
  display_name: string;
  bio: string;
  avatar_url: string | null;
  location: string | null;
  interests: string[];
  skills: string[];
  social_links: Record<string, string>;
  visibility: 'PUBLIC' | 'CONNECTIONS' | 'PRIVATE';
  theme_preference: 'dark' | 'light' | 'system';
  notification_preferences: Record<string, boolean>;
}

export interface User {
  id: string;
  email: string;
  username: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN' | string;
  email_verified: boolean;
  trial_simulations_remaining: number;
  referral_code: string;
  created_at: string;
  profile: Profile | null;
}

export interface AuthResponse {
  user: User;
  tokens: Tokens;
  dev_verification_token?: string | null;
}

export interface MessageResponse {
  message: string;
  dev_token?: string | null;
}

export interface Plan {
  code: 'FREE' | 'WEEKLY' | 'PRO';
  name: string;
  description: string;
  price_minor: number;
  currency: string;
  duration_days: number;
  daily_simulations: number;
  max_scenarios: number;
  ai_depth: string;
  custom_what_if: boolean;
  advanced_insights: boolean;
  history_limit: number;
}

export interface Usage {
  plan_code: Plan['code'];
  plan_name: string;
  status: string;
  subscription_ends_at: string | null;
  trial_remaining: number;
  daily_limit: number;
  daily_used: number;
  remaining_today: number;
  resets_at: string;
  max_scenarios: number;
  ai_depth: string;
  custom_what_if: boolean;
  advanced_insights: boolean;
  history_limit: number;
  can_simulate: boolean;
}

export interface PaymentMethod {
  id: string;
  label: string;
  kind: 'mobile_money' | 'card';
  enabled: boolean;
  note: string;
}

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';

export interface Payment {
  id: string;
  provider: 'MTN' | 'AIRTEL' | string;
  status: PaymentStatus;
  amount_minor: number;
  currency: string;
  payer_phone_masked: string;
  is_demo: boolean;
  failure_reason: string | null;
  verified_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface SeedResponse {
  category: string;
  scenarios: ScenarioSeed[];
  source: Source | string;
  ai_note: string | null;
}

export interface RecommendResponse {
  recommendation: Recommendation;
  tradeoffs: string | null;
  source: string;
}

export interface WhatIfInterpretation {
  id: string | null;
  summary: string;
  overrides: Partial<Pick<DecisionContext, 'savings' | 'cost' | 'monthlyIncome' | 'monthlyExpenses' | 'goalAmount' | 'horizonMonths'>>;
  source: string;
}

export interface WhatIfOut {
  id: string;
  prompt: string;
  summary: string;
  overrides: Record<string, number>;
  resultScores: Record<string, number>;
  source: string;
  createdAt: string;
}

export interface DecisionOut {
  id: string;
  title: string;
  category: string | null;
  priorities: DecisionInput['priorities'];
  context: DecisionContext;
  overrides: Partial<DecisionContext>;
  confidence: Confidence;
  recommendation: Recommendation;
  source: Source | string;
  riskDomain: 'medical' | 'legal' | 'financial' | null;
  status: 'PENDING' | 'DECIDED' | 'REVIEWED';
  chosenScenarioId: string | null;
  decidedAt: string | null;
  outcomeRating: 'BETTER' | 'EXPECTED' | 'WORSE' | null;
  outcomeNote: string | null;
  outcomeRecordedAt: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  scenarios: Scenario[];
  whatIfs: WhatIfOut[];
}

export interface DecisionList {
  items: DecisionOut[];
  total: number;
}

export interface Insights {
  enough_data: boolean;
  decisions_considered: number;
  patterns: { id: string; title: string; detail: string; tone: 'positive' | 'neutral' | 'caution' }[];
  stats: Record<string, unknown>;
  headline: string;
  ai_note: string | null;
  source: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationList {
  items: Notification[];
  unread: number;
}
