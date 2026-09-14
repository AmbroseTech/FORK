import { z } from 'zod';

export const PRIORITIES = [
  'money',
  'career',
  'education',
  'convenience',
  'business',
  'relationships',
  'lifestyle',
] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CATEGORIES = [
  'Money',
  'Career',
  'Education',
  'Business',
  'Relationships',
  'Lifestyle',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CURRENCIES = ['UGX', 'USD', 'KES', 'NGN', 'EUR', 'GBP', 'INR'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Numeric + textual inputs describing the user's situation. */
export interface DecisionContext {
  currency: Currency;
  savings?: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  /** One-off cost of the thing being decided (price, tuition, relocation cost…). */
  cost?: number;
  goal?: string;
  goalAmount?: number;
  horizonMonths: number;
}

export interface DecisionInput {
  decision: string;
  priorities: Priority[];
  context: DecisionContext;
}

/**
 * Deterministic knobs an AI (or the demo seed) attaches to a scenario.
 * The simulation engine turns these into month-by-month projections.
 */
export const ScenarioModifiersSchema = z.object({
  costMultiplier: z.number().min(0).max(5).default(1),
  delayMonths: z.number().min(0).max(36).default(0),
  incomeMultiplier: z.number().min(0).max(5).default(1),
  expenseMultiplier: z.number().min(0).max(5).default(1),
  /** 0–1: how much upside (career/opportunity/lifestyle) the path unlocks. */
  benefitFactor: z.number().min(0).max(1).default(0.5),
  /** 0–1: how reversible the path is. */
  reversibility: z.number().min(0).max(1).default(0.5),
  /** Extra monthly income from month N (e.g. internship/side-hustle). */
  extraMonthlyIncome: z.number().min(0).default(0),
  extraIncomeStartMonth: z.number().min(0).default(0),
});
export type ScenarioModifiers = z.infer<typeof ScenarioModifiersSchema>;

export const ScenarioSeedSchema = z.object({
  title: z.string().min(2).max(40),
  description: z.string().min(10).max(280),
  advantages: z.array(z.string().max(120)).min(1).max(5),
  tradeoffs: z.array(z.string().max(120)).min(1).max(5),
  modifiers: ScenarioModifiersSchema,
});
export type ScenarioSeed = z.infer<typeof ScenarioSeedSchema>;

export const ScenarioSeedListSchema = z.object({
  scenarios: z.array(ScenarioSeedSchema).min(2).max(4),
});

export interface Metrics {
  financial: number;
  opportunity: number;
  goal: number;
  risk: number;
  flexibility: number;
  stress: number;
}

export interface TimelineEvent {
  id: string;
  label: string;
  title: string;
  detail?: string;
  balance?: number;
  tone: 'neutral' | 'positive' | 'negative' | 'milestone';
}

export interface Scenario extends ScenarioSeed {
  id: string;
  letter: string;
  score: number;
  metrics: Metrics;
  timeline: TimelineEvent[];
  projectedBalance: number;
  minBalance: number;
}

export const RecommendationSchema = z.object({
  scenarioId: z.string(),
  take: z.string().min(10).max(320),
  why: z.array(z.string().max(160)).min(2).max(5),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export interface Confidence {
  level: ConfidenceLevel;
  present: string[];
  missing: string[];
}

export type Source = 'demo' | 'groq';

export interface Simulation {
  id: string;
  createdAt: number;
  input: DecisionInput;
  /** Live what-if overrides applied on top of input.context. */
  overrides: Partial<DecisionContext>;
  scenarios: Scenario[];
  recommendation: Recommendation;
  confidence: Confidence;
  source: Source;
  riskDomain?: 'medical' | 'legal' | 'financial';
}

export type ForkStatus = 'pending' | 'decided' | 'reviewed';
export type OutcomeRating = 'better' | 'expected' | 'worse';

export interface Fork {
  id: string;
  simulation: Simulation;
  status: ForkStatus;
  chosenScenarioId?: string;
  decidedAt?: number;
  outcome?: {
    rating: OutcomeRating;
    note: string;
    recordedAt: number;
  };
}

export const WhatIfSchema = z.object({
  summary: z.string().max(120),
  overrides: z.object({
    savings: z.number().optional(),
    monthlyIncome: z.number().optional(),
    monthlyExpenses: z.number().optional(),
    cost: z.number().optional(),
    horizonMonths: z.number().optional(),
  }),
});
export type WhatIf = z.infer<typeof WhatIfSchema>;
