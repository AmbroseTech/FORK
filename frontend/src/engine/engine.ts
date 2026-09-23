/**
 * Deterministic simulation engine.
 *
 * AI is used to *understand* a decision and propose scenarios (as structured
 * modifiers). Everything numeric — projections, scores, timelines — is
 * computed here so `what_if()` and "change one variable" update instantly
 * and reproducibly without another model call.
 *
 * All outputs are *estimated fit* for the information provided, never a
 * prediction of what will happen.
 */
import type {
  Confidence,
  DecisionContext,
  DecisionInput,
  Metrics,
  Priority,
  Recommendation,
  Scenario,
  ScenarioSeed,
  Simulation,
  Source,
  TimelineEvent,
} from './types';
import { formatCompact } from './format';

const clamp = (n: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, n));
const round = (n: number): number => Math.round(n);

export const LETTERS = ['A', 'B', 'C', 'D'] as const;

export function resolveContext(
  base: DecisionContext,
  overrides: Partial<DecisionContext>,
): DecisionContext {
  const defined = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as Partial<DecisionContext>;
  const merged: DecisionContext = { ...base, ...defined };
  if (!merged.horizonMonths || merged.horizonMonths < 1) merged.horizonMonths = 6;
  return merged;
}

interface Projection {
  balances: number[];
  minBalance: number;
  endBalance: number;
  costPaid: number;
  paidAtMonth: number;
  netMonthly: number;
  runwayMonths: number;
  hasNumbers: boolean;
}

export function project(seed: ScenarioSeed, ctx: DecisionContext): Projection {
  const m = seed.modifiers;
  const savings = ctx.savings ?? 0;
  const income = (ctx.monthlyIncome ?? 0) * m.incomeMultiplier;
  const expenses = (ctx.monthlyExpenses ?? 0) * m.expenseMultiplier;
  const cost = (ctx.cost ?? 0) * m.costMultiplier;
  const paidAtMonth = Math.min(m.delayMonths, ctx.horizonMonths);
  const hasNumbers = [ctx.savings, ctx.monthlyIncome, ctx.monthlyExpenses, ctx.cost].some(
    (v) => v !== undefined,
  );

  const balances: number[] = [];
  let balance = savings;
  if (paidAtMonth === 0) balance -= cost;
  balances.push(balance);
  for (let month = 1; month <= ctx.horizonMonths; month += 1) {
    const extra = month >= m.extraIncomeStartMonth ? m.extraMonthlyIncome : 0;
    balance += income + extra - expenses;
    if (month === paidAtMonth && paidAtMonth > 0) balance -= cost;
    balances.push(balance);
  }
  const minBalance = Math.min(...balances);
  const endBalance = balances[balances.length - 1];
  const netMonthly = income - expenses;
  const runwayMonths = expenses > 0 ? minBalance / expenses : minBalance > 0 ? 6 : 0;

  return { balances, minBalance, endBalance, costPaid: cost, paidAtMonth, netMonthly, runwayMonths, hasNumbers };
}

export function computeMetrics(seed: ScenarioSeed, ctx: DecisionContext, p: Projection): Metrics {
  const m = seed.modifiers;
  const savings = Math.max(ctx.savings ?? 0, 1);

  let financial: number;
  let riskSafety: number;
  let flexibility: number;
  if (p.hasNumbers) {
    const runwayScore = clamp((p.runwayMonths / 6) * 100);
    const growth = clamp(50 + ((p.endBalance - (ctx.savings ?? 0)) / savings) * 60);
    financial = 0.55 * runwayScore + 0.45 * growth;

    const negativePenalty = p.minBalance < 0 ? 55 : 0;
    const thinBufferPenalty = clamp((1 - p.runwayMonths / 3) * 40, 0, 40);
    riskSafety = clamp(100 - negativePenalty - thinBufferPenalty) * (0.75 + 0.25 * m.reversibility);

    flexibility = 0.5 * m.reversibility * 100 + 0.5 * clamp((p.minBalance / savings) * 100);
  } else {
    financial = clamp(62 - (m.costMultiplier - 1) * 25 - (m.expenseMultiplier - 1) * 30 + (m.incomeMultiplier - 1) * 30);
    riskSafety = clamp(45 + m.reversibility * 45 - (m.costMultiplier - 1) * 15);
    flexibility = clamp(m.reversibility * 100);
  }

  const delayDecay = 1 - Math.min(m.delayMonths / (ctx.horizonMonths + 6), 0.8);
  const opportunity = clamp(m.benefitFactor * 100 * delayDecay);

  let goal: number;
  if (ctx.goalAmount && ctx.goalAmount > 0) {
    goal = clamp((p.endBalance / ctx.goalAmount) * 100);
  } else {
    goal = clamp(0.5 * financial + 0.5 * opportunity);
  }

  const stress = clamp(100 - 0.5 * riskSafety - 0.3 * financial - 0.2 * flexibility);

  return {
    financial: round(financial),
    opportunity: round(opportunity),
    goal: round(goal),
    risk: round(riskSafety),
    flexibility: round(flexibility),
    stress: round(stress),
  };
}

export function priorityWeights(priorities: Priority[]): Record<keyof Omit<Metrics, 'stress'>, number> {
  const w = { financial: 1, opportunity: 1, goal: 1, risk: 0.8, flexibility: 0.6 };
  priorities.forEach((p) => {
    switch (p) {
      case 'money':
        w.financial += 1;
        w.risk += 0.5;
        break;
      case 'career':
      case 'business':
        w.opportunity += 1;
        break;
      case 'education':
        w.goal += 1;
        break;
      case 'convenience':
      case 'lifestyle':
        w.opportunity += 0.5;
        w.flexibility += 0.5;
        break;
      case 'relationships':
        w.flexibility += 0.5;
        w.risk += 0.3;
        break;
    }
  });
  return w;
}

export function scoreScenario(metrics: Metrics, priorities: Priority[]): number {
  const w = priorityWeights(priorities);
  const total = w.financial + w.opportunity + w.goal + w.risk + w.flexibility;
  const weighted =
    metrics.financial * w.financial +
    metrics.opportunity * w.opportunity +
    metrics.goal * w.goal +
    metrics.risk * w.risk +
    metrics.flexibility * w.flexibility;
  return round(clamp(weighted / total - metrics.stress * 0.08));
}

export function buildTimeline(seed: ScenarioSeed, ctx: DecisionContext, p: Projection, id: string): TimelineEvent[] {
  const cur = ctx.currency;
  const events: TimelineEvent[] = [];
  const m = seed.modifiers;
  const money = (n: number) => (p.hasNumbers ? formatCompact(n, cur) : undefined);

  events.push({
    id: `${id}_now`,
    label: 'NOW',
    title: p.paidAtMonth === 0 && p.costPaid > 0 ? `Commit: ${seed.title.toLowerCase()}` : seed.title,
    detail: p.paidAtMonth === 0 && p.costPaid > 0 ? `${money(p.costPaid) ?? 'Cost'} leaves your savings immediately.` : undefined,
    balance: p.balances[0],
    tone: p.paidAtMonth === 0 && p.costPaid > 0 ? 'negative' : 'neutral',
  });

  if (p.paidAtMonth === 0 && p.costPaid > 0) {
    events.push({
      id: `${id}_w2`,
      label: 'WEEK 2',
      title: 'Lower available savings',
      detail: p.hasNumbers ? `Buffer now ${money(p.balances[0])}.` : undefined,
      tone: p.balances[0] < 0 ? 'negative' : 'neutral',
    });
  } else {
    events.push({
      id: `${id}_w2`,
      label: 'WEEK 2',
      title: p.netMonthly > 0 ? 'Savings keep building' : 'Position holds steady',
      detail: p.netMonthly > 0 && p.hasNumbers ? `≈ ${money(p.netMonthly)} net per month.` : undefined,
      tone: p.netMonthly > 0 ? 'positive' : 'neutral',
    });
  }

  if (m.benefitFactor >= 0.6 && m.delayMonths <= 1) {
    events.push({
      id: `${id}_m1`,
      label: 'MONTH 1',
      title: 'Upside begins to compound',
      detail: seed.advantages[0],
      tone: 'positive',
    });
  } else if (m.benefitFactor < 0.4) {
    events.push({
      id: `${id}_m1`,
      label: 'MONTH 1',
      title: 'Opportunity cost accumulates',
      detail: seed.tradeoffs[0],
      tone: 'negative',
    });
  }

  if (p.paidAtMonth > 0 && p.costPaid > 0) {
    events.push({
      id: `${id}_pay`,
      label: `MONTH ${p.paidAtMonth}`,
      title: `Cost paid: ${money(p.costPaid) ?? seed.title.toLowerCase()}`,
      detail: `Buffer after payment ≈ ${money(p.balances[p.paidAtMonth]) ?? '—'}.`,
      balance: p.balances[p.paidAtMonth],
      tone: p.balances[p.paidAtMonth] < 0 ? 'negative' : 'neutral',
    });
  }

  if (p.hasNumbers && p.minBalance < 0) {
    const idx = p.balances.findIndex((b) => b < 0);
    events.push({
      id: `${id}_neg`,
      label: idx === 0 ? 'NOW' : `MONTH ${idx}`,
      title: 'Buffer falls below zero',
      detail: 'This path would require borrowing or cutting expenses.',
      tone: 'negative',
    });
  }

  const mid = Math.max(2, Math.floor(ctx.horizonMonths / 2));
  if (mid < ctx.horizonMonths && p.hasNumbers && p.minBalance >= 0) {
    const recovered = p.balances[mid] >= (ctx.savings ?? 0);
    events.push({
      id: `${id}_mid`,
      label: `MONTH ${mid}`,
      title: recovered ? 'Savings recover' : 'Savings rebuilding',
      detail: `≈ ${money(p.balances[mid])}`,
      balance: p.balances[mid],
      tone: recovered ? 'positive' : 'neutral',
    });
  }

  const goalHit = ctx.goalAmount ? p.endBalance >= ctx.goalAmount : undefined;
  events.push({
    id: `${id}_end`,
    label: `MONTH ${ctx.horizonMonths}`,
    title: 'Projected position',
    detail: p.hasNumbers
      ? `≈ ${money(p.endBalance)}${goalHit === undefined ? '' : goalHit ? ' · goal within reach' : ' · goal not yet reached'}`
      : 'Based on qualitative trade-offs only. Add numbers to strengthen this projection.',
    balance: p.endBalance,
    tone: 'milestone',
  });

  const order = (e: TimelineEvent) => {
    if (e.label === 'NOW') return 0;
    if (e.label.startsWith('WEEK')) return 0.5;
    return Number(e.label.replace('MONTH ', '')) + (e.id.endsWith('_end') ? 0.01 : 0);
  };
  return events.sort((a, b) => order(a) - order(b));
}

export function buildScenario(seed: ScenarioSeed, ctx: DecisionContext, priorities: Priority[], index: number, id: string): Scenario {
  const p = project(seed, ctx);
  const metrics = computeMetrics(seed, ctx, p);
  return {
    ...seed,
    id,
    letter: LETTERS[index] ?? String(index + 1),
    score: scoreScenario(metrics, priorities),
    metrics,
    timeline: buildTimeline(seed, ctx, p, id),
    projectedBalance: p.endBalance,
    minBalance: p.minBalance,
  };
}

export function assessConfidence(input: DecisionInput): Confidence {
  const c = input.context;
  const checks: [string, boolean][] = [
    ['Clear budget / cost', c.cost !== undefined],
    ['Current savings', c.savings !== undefined],
    ['Monthly income', c.monthlyIncome !== undefined],
    ['Monthly expenses', c.monthlyExpenses !== undefined],
    ['Defined goal', Boolean(c.goal && c.goal.trim().length > 2)],
    ['Time horizon', c.horizonMonths > 0],
    ['Priorities', input.priorities.length > 0],
  ];
  const present = checks.filter(([, ok]) => ok).map(([label]) => label);
  const missing = checks.filter(([, ok]) => !ok).map(([label]) => label);
  const level = present.length >= 6 ? 'HIGH' : present.length >= 4 ? 'MEDIUM' : 'LOW';
  return { level, present, missing };
}

export function detectRiskDomain(decision: string): Simulation['riskDomain'] {
  const d = decision.toLowerCase();
  if (/\b(surgery|medic|doctor|diagnos|medication|therapy|treatment|hospital)\b/.test(d)) return 'medical';
  if (/\b(lawsuit|legal|sue|contract dispute|court|visa|immigration|divorce)\b/.test(d)) return 'legal';
  if (/\b(invest|crypto|stocks?|shares|forex|mortgage|loan|gamble|bet)\b/.test(d)) return 'financial';
  return undefined;
}

export function deterministicRecommendation(scenarios: Scenario[], priorities: Priority[], ctx: DecisionContext): Recommendation {
  const sorted = [...scenarios].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const runner = sorted[1];
  const why: string[] = [];
  const cur = ctx.currency;

  if (runner) {
    if (best.metrics.risk > runner.metrics.risk + 5) {
      why.push(
        best.minBalance > runner.minBalance && ctx.savings !== undefined
          ? `Protects your buffer — lowest balance ≈ ${formatCompact(best.minBalance, cur)} vs ${formatCompact(runner.minBalance, cur)} for ${runner.title}.`
          : 'Keeps more room for error than the alternatives.',
      );
    }
    if (best.metrics.goal >= runner.metrics.goal) {
      why.push(ctx.goal ? `Keeps "${ctx.goal}" on track (goal alignment ${best.metrics.goal} vs ${runner.metrics.goal}).` : `Stronger goal alignment (${best.metrics.goal} vs ${runner.metrics.goal}).`);
    }
    if (best.metrics.opportunity < runner.metrics.opportunity) {
      why.push(`Trade-off: ${runner.title} unlocks the upside sooner (opportunity ${runner.metrics.opportunity} vs ${best.metrics.opportunity}).`);
    } else if (best.metrics.opportunity > runner.metrics.opportunity) {
      why.push(`Captures more of the upside (opportunity ${best.metrics.opportunity} vs ${runner.metrics.opportunity}).`);
    }
    if (best.metrics.flexibility > runner.metrics.flexibility + 5) {
      why.push('Leaves more options open if circumstances change.');
    }
  }
  if (best.tradeoffs[0] && why.length < 4) why.push(`Watch out: ${best.tradeoffs[0]}`);
  while (why.length < 2) why.push(best.advantages[why.length] ?? 'Best overall balance across your priorities.');

  const focus = priorities.length ? priorities.slice(0, 2).join(' and ') : 'your priorities';
  const take =
    runner && best.score - runner.score <= 4
      ? `${best.title} and ${runner.title} are close. ${best.title} edges ahead on ${focus} based on the information provided.`
      : `${best.title} appears to better protect ${focus} while keeping the decision within reach, based on the information provided.`;

  return { scenarioId: best.id, take, why: why.slice(0, 5) };
}

export interface BuildOptions {
  id: string;
  input: DecisionInput;
  seeds: ScenarioSeed[];
  source: Source;
  overrides?: Partial<DecisionContext>;
  recommendation?: Recommendation;
  createdAt?: number;
}

export function buildSimulation(opts: BuildOptions): Simulation {
  const overrides = opts.overrides ?? {};
  const ctx = resolveContext(opts.input.context, overrides);
  const scenarios = opts.seeds.map((seed, i) =>
    buildScenario(seed, ctx, opts.input.priorities, i, `${opts.id}_${LETTERS[i] ?? i}`),
  );
  const fallback = deterministicRecommendation(scenarios, opts.input.priorities, ctx);
  const recommendation =
    opts.recommendation && scenarios.some((s) => s.id === opts.recommendation?.scenarioId)
      ? opts.recommendation
      : fallback;
  return {
    id: opts.id,
    createdAt: opts.createdAt ?? Date.now(),
    input: opts.input,
    overrides,
    scenarios,
    recommendation,
    confidence: assessConfidence(opts.input),
    source: opts.source,
    riskDomain: detectRiskDomain(opts.input.decision),
  };
}

/** Re-run numeric layer with new overrides; keeps seeds, drops the AI take in favour of a deterministic one. */
export function recompute(sim: Simulation, overrides: Partial<DecisionContext>): Simulation {
  return buildSimulation({
    id: sim.id,
    input: sim.input,
    seeds: sim.scenarios.map(({ title, description, advantages, tradeoffs, modifiers }) => ({
      title,
      description,
      advantages,
      tradeoffs,
      modifiers,
    })),
    source: sim.source,
    overrides,
    createdAt: sim.createdAt,
  });
}

export function effectiveContext(sim: Simulation): DecisionContext {
  return resolveContext(sim.input.context, sim.overrides);
}

export function hasOverrides(sim: Simulation): boolean {
  return Object.values(sim.overrides).some((v) => v !== undefined);
}
