import type { DecisionContext, WhatIf } from './types';

export interface WhatIfPreset {
  id: string;
  label: string;
  pro?: boolean;
  apply: (ctx: DecisionContext) => Partial<DecisionContext>;
}

export const WHAT_IF_PRESETS: WhatIfPreset[] = [
  {
    id: 'income_down',
    label: 'my income decreases by 20%',
    apply: (c) => ({ monthlyIncome: (c.monthlyIncome ?? 0) * 0.8 }),
  },
  {
    id: 'cost_down',
    label: 'it costs 20% less',
    apply: (c) => ({ cost: (c.cost ?? 0) * 0.8 }),
  },
  {
    id: 'expenses_up',
    label: 'my monthly expenses increase by 15%',
    apply: (c) => ({ monthlyExpenses: (c.monthlyExpenses ?? 0) * 1.15 }),
  },
  {
    id: 'wait_3',
    label: 'I look 3 months further ahead',
    apply: (c) => ({ horizonMonths: c.horizonMonths + 3 }),
  },
  {
    id: 'internship',
    label: 'I get an internship (+40% income)',
    pro: true,
    apply: (c) => ({ monthlyIncome: (c.monthlyIncome ?? 0) * 1.4 }),
  },
  {
    id: 'savings_half',
    label: 'an emergency uses half my savings',
    pro: true,
    apply: (c) => ({ savings: (c.savings ?? 0) * 0.5 }),
  },
];

/**
 * Lightweight, offline interpreter for free-text "what if" statements.
 * Handles: "<variable> (increases|decreases|drops|rises) by N%" and
 * "<variable> is/becomes N". Used in demo mode and as an AI fallback.
 */
export function parseWhatIf(text: string, ctx: DecisionContext): WhatIf | null {
  const t = text.toLowerCase();
  const pctMatch = t.match(/(\d+(?:\.\d+)?)\s*%/);
  const numMatch = t.match(/(?:to|is|becomes|=)\s*([0-9][0-9,._]*)\s*(k|m)?/);
  const monthsMatch = t.match(/(\d+)\s*(more\s*)?months?/);

  const direction = /(decreas|drop|fall|less|lower|cut|lose|reduc)/.test(t)
    ? -1
    : /(increas|rise|more|higher|grow|gain|raise|double)/.test(t)
      ? 1
      : 0;

  const variable: keyof DecisionContext | null = /(income|salary|earn|pay|wage|internship|job)/.test(t)
    ? 'monthlyIncome'
    : /(expense|spend|rent|bills|cost of living)/.test(t)
      ? 'monthlyExpenses'
      : /(price|cost|cheaper|expensive|discount)/.test(t)
        ? 'cost'
        : /(saving|buffer|emergency)/.test(t)
          ? 'savings'
          : null;

  if (/(wait|later|further|horizon|longer)/.test(t) && monthsMatch && !variable) {
    const months = Number(monthsMatch[1]);
    return { summary: `Horizon +${months} months`, overrides: { horizonMonths: ctx.horizonMonths + months } };
  }

  if (!variable) return null;
  const current = (ctx[variable] as number | undefined) ?? 0;

  if (/double/.test(t)) {
    return { summary: `${labelFor(variable)} ×2`, overrides: { [variable]: current * 2 } };
  }
  if (pctMatch) {
    const p = Number(pctMatch[1]) / 100;
    const dir = direction === 0 ? (variable === 'cost' && /cheaper|discount/.test(t) ? -1 : 1) : direction;
    const value = current * (1 + dir * p);
    return {
      summary: `${labelFor(variable)} ${dir > 0 ? '+' : '−'}${Math.round(p * 100)}%`,
      overrides: { [variable]: Math.max(0, value) },
    };
  }
  if (numMatch) {
    let value = Number(numMatch[1].replace(/[,_]/g, ''));
    if (numMatch[2] === 'k') value *= 1_000;
    if (numMatch[2] === 'm') value *= 1_000_000;
    if (Number.isFinite(value)) {
      return { summary: `${labelFor(variable)} → ${value.toLocaleString('en-US')}`, overrides: { [variable]: value } };
    }
  }
  if (/internship|side hustle|second job|freelanc/.test(t) && variable === 'monthlyIncome') {
    return { summary: 'Income +40% (new work)', overrides: { monthlyIncome: current * 1.4 } };
  }
  return null;
}

export function labelFor(key: keyof DecisionContext): string {
  switch (key) {
    case 'monthlyIncome':
      return 'Income';
    case 'monthlyExpenses':
      return 'Expenses';
    case 'cost':
      return 'Cost';
    case 'savings':
      return 'Savings';
    case 'horizonMonths':
      return 'Horizon';
    case 'goalAmount':
      return 'Goal amount';
    default:
      return String(key);
  }
}
