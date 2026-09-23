import { describe, expect, it } from 'vitest';
import { DEMO_DRAFT } from './demoDraft';
import { buildSimulation, effectiveContext, hasOverrides, recompute } from './engine';
import { pickTemplate } from './templates';
import { parseWhatIf } from './whatIf';

function demo() {
  const t = pickTemplate(DEMO_DRAFT.decision);
  return buildSimulation({ id: 'test', input: DEMO_DRAFT, seeds: t.scenarios, source: 'demo' });
}

describe('simulate()', () => {
  it('is deterministic for identical input', () => {
    const a = demo();
    const b = demo();
    expect(a.scenarios.map((s) => s.score)).toEqual(b.scenarios.map((s) => s.score));
    expect(a.recommendation.scenarioId).toBe(b.recommendation.scenarioId);
  });

  it('produces 2-4 scored scenarios with timelines', () => {
    const sim = demo();
    expect(sim.scenarios.length).toBeGreaterThanOrEqual(2);
    expect(sim.scenarios.length).toBeLessThanOrEqual(4);
    for (const s of sim.scenarios) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
      expect(s.timeline.length).toBeGreaterThan(0);
    }
  });

  it('recommends a scenario that exists', () => {
    const sim = demo();
    expect(sim.scenarios.some((s) => s.id === sim.recommendation.scenarioId)).toBe(true);
    expect(sim.recommendation.why.length).toBeGreaterThanOrEqual(2);
  });
});

describe('what_if()', () => {
  it('parses percentage income changes', () => {
    const w = parseWhatIf('What if my income drops 20%?', DEMO_DRAFT.context);
    expect(w?.overrides.monthlyIncome).toBe(400_000);
  });

  it('parses absolute cost changes', () => {
    const w = parseWhatIf('what if the cost is 1.2M', DEMO_DRAFT.context);
    expect(w?.overrides.cost).toBe(1_200_000);
  });

  it('returns null for unknown prompts', () => {
    expect(parseWhatIf('what if it rains', DEMO_DRAFT.context)).toBeNull();
  });

  it('recompute() only changes the overridden variable and can be reset', () => {
    const base = demo();
    const next = recompute(base, { monthlyIncome: 100_000 });
    expect(hasOverrides(next)).toBe(true);
    expect(effectiveContext(next).monthlyIncome).toBe(100_000);
    expect(effectiveContext(next).cost).toBe(DEMO_DRAFT.context.cost);
    expect(next.scenarios.map((s) => s.score)).not.toEqual(base.scenarios.map((s) => s.score));
    expect(recompute(next, {}).scenarios.map((s) => s.score)).toEqual(base.scenarios.map((s) => s.score));
  });
});
