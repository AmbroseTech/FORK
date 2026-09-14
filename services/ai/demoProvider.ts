/**
 * DEMO provider — seeded, deterministic, offline.
 *
 * This is NOT an AI. It selects a scenario template that matches the shape of
 * the decision ("buy", "job", "move", "start", "study" …) so the app stays
 * fully usable without network access or API keys. The UI labels its output
 * as seeded demo data.
 */
import { deterministicRecommendation, effectiveContext } from '@/features/simulation/engine';
import { parseWhatIf } from '@/features/simulation/whatIf';
import { computePatterns } from '@/features/insights/patterns';
import type { DecisionContext, DecisionInput, Fork, Recommendation, ScenarioSeed, Simulation, WhatIf } from '@/types/simulation';
import type { AIProvider, DecisionAnalysis } from './provider';

type Template = { match: RegExp; category: string; variables: string[]; scenarios: ScenarioSeed[] };

const TEMPLATES: Template[] = [
  {
    match: /(buy|purchase|get a|upgrade|laptop|phone|camera|bike|car)/i,
    category: 'Money',
    variables: ['savings', 'monthly income', 'monthly expenses', 'purchase cost', 'goal', 'time horizon'],
    scenarios: [
      {
        title: 'Buy now',
        description: 'Make the purchase immediately and start getting value from it today, at the cost of a thinner savings buffer.',
        advantages: ['Immediate productivity and learning gains', 'No more waiting or price anxiety', 'Start building projects / income sooner'],
        tradeoffs: ['Savings buffer drops sharply', 'Less room for surprise expenses', 'Goal savings slow down for a while'],
        modifiers: { costMultiplier: 1, delayMonths: 0, incomeMultiplier: 1, expenseMultiplier: 1, benefitFactor: 0.9, reversibility: 0.3, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
      },
      {
        title: 'Wait 6 weeks',
        description: 'Keep saving for roughly six more weeks, then buy with a healthier buffer and time to compare options.',
        advantages: ['Protects your emergency buffer', 'Keeps your goal on track', 'Time to compare prices and deals'],
        tradeoffs: ['Delays the productivity benefit', 'Prices or availability may change', 'Motivation can fade while waiting'],
        modifiers: { costMultiplier: 1, delayMonths: 2, incomeMultiplier: 1, expenseMultiplier: 1, benefitFactor: 0.8, reversibility: 0.8, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
      },
      {
        title: 'Buy a cheaper model',
        description: 'Buy a more affordable option now — most of the benefit at a fraction of the buffer hit.',
        advantages: ['Most of the value at ~65% of the cost', 'Buffer stays healthier', 'Upgrade later when income grows'],
        tradeoffs: ['May hit performance limits sooner', 'Possible second purchase later', 'Less resale value'],
        modifiers: { costMultiplier: 0.65, delayMonths: 0, incomeMultiplier: 1, expenseMultiplier: 1, benefitFactor: 0.6, reversibility: 0.4, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
      },
    ],
  },
  {
    match: /(job|offer|internship|position|role|employ|work part|freelanc|quit)/i,
    category: 'Career',
    variables: ['current income', 'offered income', 'monthly expenses', 'savings', 'growth potential', 'time horizon'],
    scenarios: [
      {
        title: 'Accept the offer',
        description: 'Take the opportunity now and adapt your routine around it.',
        advantages: ['New skills and network immediately', 'Income and CV grow from month one', 'Momentum in your career'],
        tradeoffs: ['Less time for studies or side projects', 'Adjustment stress in the first weeks', 'Harder to reverse once committed'],
        modifiers: { costMultiplier: 0, delayMonths: 0, incomeMultiplier: 1, expenseMultiplier: 1.1, benefitFactor: 0.9, reversibility: 0.4, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
      },
      {
        title: 'Decline & keep options open',
        description: 'Pass on this one and keep your current setup while looking for a better fit.',
        advantages: ['Protects focus on current goals', 'No disruption to routine', 'Room for a better-aligned opportunity'],
        tradeoffs: ['Opportunity may not return', 'Income and experience plateau', 'Risk of regret'],
        modifiers: { costMultiplier: 0, delayMonths: 0, incomeMultiplier: 1, expenseMultiplier: 1, benefitFactor: 0.3, reversibility: 0.9, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
      },
      {
        title: 'Negotiate a part-time start',
        description: 'Ask for reduced hours or a later start so the role fits around your other commitments.',
        advantages: ['Balance between income and studies', 'Test the fit before going all-in', 'Keeps flexibility'],
        tradeoffs: ['Employer may say no', 'Smaller income uplift', 'Slower progression'],
        modifiers: { costMultiplier: 0, delayMonths: 1, incomeMultiplier: 1, expenseMultiplier: 1.05, benefitFactor: 0.65, reversibility: 0.7, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
      },
    ],
  },
  {
    match: /(move|relocat|apartment|rent|city|abroad|hostel)/i,
    category: 'Lifestyle',
    variables: ['moving cost', 'new rent vs current', 'monthly income', 'savings', 'commute time', 'time horizon'],
    scenarios: [
      {
        title: 'Move now',
        description: 'Relocate immediately, paying the upfront costs and settling in as soon as possible.',
        advantages: ['Fresh start and new opportunities', 'Shorter commute / better environment', 'No prolonged uncertainty'],
        tradeoffs: ['Upfront deposit and moving costs', 'Higher monthly expenses', 'Social adjustment period'],
        modifiers: { costMultiplier: 1, delayMonths: 0, incomeMultiplier: 1, expenseMultiplier: 1.2, benefitFactor: 0.8, reversibility: 0.3, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
      },
      {
        title: 'Stay put',
        description: 'Keep your current setup and revisit the move once your situation is stronger.',
        advantages: ['Zero disruption', 'Savings keep growing', 'Time to research neighbourhoods'],
        tradeoffs: ['Opportunity cost of staying', 'Frustration with current situation continues', 'Prices may rise'],
        modifiers: { costMultiplier: 0, delayMonths: 0, incomeMultiplier: 1, expenseMultiplier: 1, benefitFactor: 0.3, reversibility: 1, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
      },
      {
        title: 'Move in 3 months',
        description: 'Plan the move for a quarter from now with a dedicated savings target.',
        advantages: ['Buffer rebuilt before the move', 'Time to find a better deal', 'Less financial stress'],
        tradeoffs: ['Delayed benefits', 'Plans can slip', 'Housing options may change'],
        modifiers: { costMultiplier: 0.9, delayMonths: 3, incomeMultiplier: 1, expenseMultiplier: 1.1, benefitFactor: 0.65, reversibility: 0.7, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
      },
    ],
  },
  {
    match: /(start|launch|business|startup|side hustle|shop|company|venture)/i,
    category: 'Business',
    variables: ['startup cost', 'expected monthly revenue', 'monthly expenses', 'savings', 'time commitment', 'runway'],
    scenarios: [
      {
        title: 'Go all-in now',
        description: 'Commit fully to the venture right away, investing savings and time to reach traction fast.',
        advantages: ['Maximum focus and speed', 'First-mover learning', 'Full upside if it works'],
        tradeoffs: ['Burns savings quickly', 'Income gap until revenue arrives', 'Hard to reverse'],
        modifiers: { costMultiplier: 1, delayMonths: 0, incomeMultiplier: 0.4, expenseMultiplier: 1, benefitFactor: 0.95, reversibility: 0.2, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
      },
      {
        title: 'Start on the side',
        description: 'Launch a lean version while keeping your income; scale up when revenue proves itself.',
        advantages: ['Income stays intact', 'Validate demand before committing', 'Lower stress'],
        tradeoffs: ['Slower progress', 'Split attention', 'Risk of never fully committing'],
        modifiers: { costMultiplier: 0.4, delayMonths: 0, incomeMultiplier: 1, expenseMultiplier: 1.05, benefitFactor: 0.7, reversibility: 0.8, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
      },
      {
        title: 'Save 3 months, then start',
        description: 'Build a runway cushion first, then launch with a clearer plan.',
        advantages: ['Larger safety buffer', 'Time to sharpen the plan', 'Less pressure to monetise early'],
        tradeoffs: ['Market may move on', 'Momentum loss', 'Delayed learning'],
        modifiers: { costMultiplier: 1, delayMonths: 3, incomeMultiplier: 1, expenseMultiplier: 1, benefitFactor: 0.6, reversibility: 0.6, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
      },
    ],
  },
  {
    match: /(course|study|degree|masters|bootcamp|certif|class|university|school|learn)/i,
    category: 'Education',
    variables: ['tuition cost', 'time per week', 'monthly income', 'savings', 'career impact', 'duration'],
    scenarios: [
      {
        title: 'Enroll now',
        description: 'Start the program immediately and pay the fees upfront.',
        advantages: ['Skills and credentials sooner', 'Structured progress', 'Cohort and network'],
        tradeoffs: ['Large upfront cost', 'Less time for paid work', 'Commitment for the full duration'],
        modifiers: { costMultiplier: 1, delayMonths: 0, incomeMultiplier: 0.85, expenseMultiplier: 1, benefitFactor: 0.9, reversibility: 0.3, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
      },
      {
        title: 'Defer one intake',
        description: 'Join the next intake after saving and preparing.',
        advantages: ['Fees covered without debt', 'Time to prepare and prioritise', 'Buffer protected'],
        tradeoffs: ['Delayed career benefit', 'Fees may rise', 'Risk of losing momentum'],
        modifiers: { costMultiplier: 1.05, delayMonths: 4, incomeMultiplier: 1, expenseMultiplier: 1, benefitFactor: 0.7, reversibility: 0.8, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
      },
      {
        title: 'Self-paced alternative',
        description: 'Take a cheaper self-paced route now and revisit the full program later.',
        advantages: ['Fraction of the cost', 'Learn while earning', 'Fast start'],
        tradeoffs: ['Less recognised credential', 'Requires self-discipline', 'Weaker network'],
        modifiers: { costMultiplier: 0.25, delayMonths: 0, incomeMultiplier: 1, expenseMultiplier: 1, benefitFactor: 0.6, reversibility: 0.9, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
      },
    ],
  },
];

const GENERIC: Template = {
  match: /.*/,
  category: 'Lifestyle',
  variables: ['cost', 'savings', 'monthly income', 'monthly expenses', 'goal', 'time horizon'],
  scenarios: [
    {
      title: 'Go for it now',
      description: 'Commit to the decision today and accept the immediate cost for the earliest benefit.',
      advantages: ['Earliest possible benefit', 'Clarity — no more deliberating', 'Momentum'],
      tradeoffs: ['Immediate hit to your buffer', 'Less flexibility afterwards', 'Limited time to compare options'],
      modifiers: { costMultiplier: 1, delayMonths: 0, incomeMultiplier: 1, expenseMultiplier: 1, benefitFactor: 0.85, reversibility: 0.35, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
    },
    {
      title: 'Wait and prepare',
      description: 'Hold for a couple of months, strengthen your position, then decide with more information.',
      advantages: ['Stronger financial buffer', 'More information', 'Lower stress'],
      tradeoffs: ['Delayed benefit', 'Conditions may change', 'Indecision can linger'],
      modifiers: { costMultiplier: 1, delayMonths: 2, incomeMultiplier: 1, expenseMultiplier: 1, benefitFactor: 0.65, reversibility: 0.85, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
    },
    {
      title: 'Take a smaller step',
      description: 'Choose a lighter version of the same move that captures most of the value for less.',
      advantages: ['Most of the value at lower cost', 'Easy to scale up later', 'Keeps options open'],
      tradeoffs: ['Partial benefit only', 'May need a second step later', 'Less impressive outcome'],
      modifiers: { costMultiplier: 0.55, delayMonths: 0, incomeMultiplier: 1, expenseMultiplier: 1, benefitFactor: 0.65, reversibility: 0.7, extraMonthlyIncome: 0, extraIncomeStartMonth: 0 },
    },
  ],
};

export function pickTemplate(decision: string): Template {
  return TEMPLATES.find((t) => t.match.test(decision)) ?? GENERIC;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class DemoProvider implements AIProvider {
  readonly source = 'demo' as const;

  async analyzeDecision(input: DecisionInput): Promise<DecisionAnalysis> {
    const t = pickTemplate(input.decision);
    const missing: string[] = [];
    if (input.context.cost === undefined) missing.push('What does it cost?');
    if (input.context.monthlyExpenses === undefined) missing.push('What are your monthly essential expenses?');
    if (!input.context.goal) missing.push('What goal are you protecting?');
    return { category: t.category, variables: t.variables, suggestedQuestions: missing };
  }

  async generateScenarios(input: DecisionInput): Promise<ScenarioSeed[]> {
    await wait(150);
    return pickTemplate(input.decision).scenarios.map((s) => ({ ...s, modifiers: { ...s.modifiers } }));
  }

  async explainTradeoffs(sim: Simulation): Promise<string> {
    const best = sim.scenarios.find((s) => s.id === sim.recommendation.scenarioId) ?? sim.scenarios[0];
    return `${best.title} trades ${best.tradeoffs[0]?.toLowerCase() ?? 'some upside'} for ${best.advantages[0]?.toLowerCase() ?? 'stability'}.`;
  }

  async generateRecommendation(sim: Simulation): Promise<Recommendation> {
    return deterministicRecommendation(sim.scenarios, sim.input.priorities, effectiveContext(sim));
  }

  async interpretWhatIf(text: string, ctx: DecisionContext): Promise<WhatIf | null> {
    return parseWhatIf(text, ctx);
  }

  async generateInsight(forks: Fork[]): Promise<string> {
    return computePatterns(forks).headline;
  }
}
