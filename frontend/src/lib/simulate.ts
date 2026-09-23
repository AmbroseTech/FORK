/**
 * Orchestrates one simulation run.
 *
 * Numbers are ALWAYS computed here, deterministically, from `engine.ts`.
 * The backend (and, behind it, an optional AI provider) only supplies
 * scenario seeds and explanatory text — never arithmetic.
 */
import { buildSimulation, deterministicRecommendation, effectiveContext } from '../engine/engine';
import { pickTemplate } from '../engine/templates';
import type { DecisionInput, Recommendation, ScenarioSeed, Simulation, Source } from '../engine/types';
import { api, ApiError } from './api';
import type { RecommendResponse, SeedResponse } from './types';
import { useAuth } from '../store/auth';

export const PROCESSING_STATES = [
  'reading_context...',
  'building_scenarios...',
  'comparing_outcomes...',
  'calculating_tradeoffs...',
  'generating_insights...',
] as const;

export class UsageLimitError extends Error {
  usage: unknown;
  constructor(message: string, usage: unknown) {
    super(message);
    this.usage = usage;
  }
}

export interface RunResult {
  simulation: Simulation;
  category: string;
  aiNote: string | null;
  /** True when the run was computed fully in the browser (guest / offline). */
  local: boolean;
}

function newId(): string {
  return `sim_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function toSource(s: string): Source {
  return s === 'groq' || s === 'gemini' || s === 'openai' ? s : 'demo';
}

/** Guest / offline path: seeded templates only, nothing leaves the browser. */
export function runLocal(input: DecisionInput): RunResult {
  const tpl = pickTemplate(input.decision);
  const simulation = buildSimulation({ id: newId(), input, seeds: tpl.scenarios as ScenarioSeed[], source: 'demo' });
  return { simulation, category: tpl.category, aiNote: null, local: true };
}

export async function runSimulation(input: DecisionInput, onState?: (i: number) => void): Promise<RunResult> {
  const authed = Boolean(useAuth.getState().tokens);
  onState?.(0);
  if (!authed) {
    await tick(350);
    onState?.(1);
    const r = runLocal(input);
    await tick(350);
    onState?.(2);
    return r;
  }

  let seed: SeedResponse;
  try {
    seed = await api<SeedResponse>('/api/simulate/seed', { method: 'POST', body: input });
  } catch (e) {
    if (e instanceof ApiError && e.status === 402) {
      const d = e.detail as { message?: string; usage?: unknown } | null;
      throw new UsageLimitError(d?.message ?? e.message, d?.usage);
    }
    throw e;
  }
  onState?.(1);
  const id = newId();
  let sim = buildSimulation({ id, input, seeds: seed.scenarios, source: toSource(seed.source) });
  onState?.(2);

  // Ask the server to phrase the recommendation from the deterministic summaries; keep our fallback if it fails.
  const ctx = effectiveContext(sim);
  const fallback: Recommendation = deterministicRecommendation(sim.scenarios, input.priorities, ctx);
  onState?.(3);
  try {
    const rec = await api<RecommendResponse>('/api/simulate/recommend', {
      method: 'POST',
      body: {
        input,
        scenarios: sim.scenarios.map((s) => ({
          id: s.id,
          letter: s.letter,
          title: s.title,
          score: s.score,
          metrics: s.metrics,
          projectedBalance: s.projectedBalance,
          minBalance: s.minBalance,
        })),
        fallback,
      },
    });
    sim = buildSimulation({ id, input, seeds: seed.scenarios, source: toSource(seed.source), recommendation: rec.recommendation, createdAt: sim.createdAt });
  } catch {
    // deterministic recommendation already in place
  }
  onState?.(4);
  return { simulation: sim, category: seed.category, aiNote: seed.ai_note, local: false };
}

function tick(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
