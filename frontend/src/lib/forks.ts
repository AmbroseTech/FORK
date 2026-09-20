import type { Simulation } from '../engine/types';
import { api } from './api';
import type { DecisionOut } from './types';

/** Persist the current (client-computed) simulation as a Fork on the server. */
export function saveFork(sim: Simulation, category: string | null): Promise<DecisionOut> {
  return api<DecisionOut>('/api/decisions', {
    method: 'POST',
    body: {
      input: sim.input,
      overrides: sim.overrides,
      scenarios: sim.scenarios,
      recommendation: sim.recommendation,
      confidence: sim.confidence,
      source: sim.source,
      riskDomain: sim.riskDomain ?? null,
      category,
    },
  });
}

/** Rebuild a Simulation object from a stored decision so the same views can render it. */
export function toSimulation(d: DecisionOut): Simulation {
  return {
    id: d.id,
    createdAt: new Date(d.createdAt).getTime(),
    input: { decision: d.title, priorities: d.priorities, context: d.context },
    overrides: d.overrides,
    scenarios: d.scenarios,
    recommendation: d.recommendation,
    confidence: d.confidence,
    source: d.source === 'groq' || d.source === 'gemini' || d.source === 'openai' ? d.source : 'demo',
    riskDomain: d.riskDomain ?? undefined,
  };
}
