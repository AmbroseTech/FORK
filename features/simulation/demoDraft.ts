import type { DecisionContext, Priority } from '@/types/simulation';

export interface Draft {
  decision: string;
  priorities: Priority[];
  context: DecisionContext;
}

/** The seeded demo decision from the product spec. */
export const DEMO_DRAFT: Draft = {
  decision: 'Should I buy a laptop now or keep saving?',
  priorities: ['money', 'education', 'career'],
  context: {
    currency: 'UGX',
    savings: 2_000_000,
    cost: 1_500_000,
    monthlyIncome: 500_000,
    monthlyExpenses: 280_000,
    goal: 'University expenses',
    horizonMonths: 6,
  },
};

export const EXAMPLE_DECISIONS = [
  'Should I buy a laptop now or save?',
  'Should I take this internship offer?',
  'Should I move closer to campus?',
  'Should I start my business now or after graduating?',
  'Should I enroll in the data science bootcamp?',
];
