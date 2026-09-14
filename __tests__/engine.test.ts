import { buildSimulation, recompute, assessConfidence, detectRiskDomain } from '@/features/simulation/engine';
import { parseWhatIf } from '@/features/simulation/whatIf';
import { pickTemplate } from '@/services/ai/demoProvider';
import { computePatterns } from '@/features/insights/patterns';
import { DEMO_DRAFT } from '@/features/simulation/demoDraft';
import type { Fork } from '@/types/simulation';

const input = { decision: DEMO_DRAFT.decision, priorities: DEMO_DRAFT.priorities, context: DEMO_DRAFT.context };
const seeds = pickTemplate(input.decision).scenarios;

describe('simulation engine', () => {
  const sim = buildSimulation({ id: 'sim_test', input, seeds, source: 'demo' });

  it('builds three lettered scenarios with bounded metrics', () => {
    expect(sim.scenarios.map((s) => s.letter)).toEqual(['A', 'B', 'C']);
    sim.scenarios.forEach((s) => {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
      Object.values(s.metrics).forEach((m) => {
        expect(m).toBeGreaterThanOrEqual(0);
        expect(m).toBeLessThanOrEqual(100);
      });
    });
  });

  it('projects balances deterministically for the demo scenario', () => {
    const buyNow = sim.scenarios[0];
    // 2.0M - 1.5M = 0.5M now, +220K/month for 6 months = 1.82M
    expect(buyNow.timeline[0].balance).toBe(500_000);
    expect(buyNow.projectedBalance).toBe(1_820_000);
    const wait = sim.scenarios[1];
    expect(wait.minBalance).toBeGreaterThan(buyNow.minBalance);
    expect(wait.metrics.risk).toBeGreaterThan(buyNow.metrics.risk);
    expect(buyNow.metrics.opportunity).toBeGreaterThan(wait.metrics.opportunity);
  });

  it('timeline starts at NOW and ends with projected position', () => {
    const t = sim.scenarios[0].timeline;
    expect(t[0].label).toBe('NOW');
    expect(t[t.length - 1].tone).toBe('milestone');
  });

  it('recommendation points to the highest-scoring scenario with reasons', () => {
    const best = [...sim.scenarios].sort((a, b) => b.score - a.score)[0];
    expect(sim.recommendation.scenarioId).toBe(best.id);
    expect(sim.recommendation.why.length).toBeGreaterThanOrEqual(2);
    expect(sim.recommendation.take).toMatch(/appears|edges|based on the information provided/i);
  });

  it('what-if overrides change the numbers and can be cleared', () => {
    const cheaper = recompute(sim, { cost: 1_000_000 });
    expect(cheaper.scenarios[0].projectedBalance).toBe(2_320_000);
    expect(cheaper.scenarios[0].score).toBeGreaterThan(sim.scenarios[0].score);
    const back = recompute(cheaper, {});
    expect(back.scenarios[0].projectedBalance).toBe(sim.scenarios[0].projectedBalance);
  });

  it('assesses confidence from provided fields', () => {
    expect(assessConfidence(input).level).toBe('HIGH');
    expect(
      assessConfidence({ decision: 'x', priorities: [], context: { currency: 'UGX', horizonMonths: 6 } }).level,
    ).toBe('LOW');
  });

  it('detects high-risk domains', () => {
    expect(detectRiskDomain('Should I invest in crypto?')).toBe('financial');
    expect(detectRiskDomain('Should I have the surgery?')).toBe('medical');
    expect(detectRiskDomain('Should I buy a laptop?')).toBeUndefined();
  });
});

describe('what-if parser', () => {
  const ctx = DEMO_DRAFT.context;
  it('parses percentage changes', () => {
    expect(parseWhatIf('my income decreases by 20%', ctx)?.overrides.monthlyIncome).toBe(400_000);
    expect(parseWhatIf('the laptop costs 20% less', ctx)?.overrides.cost).toBe(1_200_000);
    expect(parseWhatIf('my monthly expenses increase by 10%', ctx)?.overrides.monthlyExpenses).toBeCloseTo(308_000);
  });
  it('parses horizon and absolute values', () => {
    expect(parseWhatIf('I wait 3 months', ctx)?.overrides.horizonMonths).toBe(9);
    expect(parseWhatIf('the price is 1.2m', ctx)?.overrides.cost).toBe(1_200_000);
  });
  it('returns null for unknown statements', () => {
    expect(parseWhatIf('the weather is nice', ctx)).toBeNull();
  });
});

describe('patterns', () => {
  it('handles empty history', () => {
    expect(computePatterns([]).headline).toMatch(/first simulation/);
  });
  it('detects follow-rate once decisions exist', () => {
    const sim = buildSimulation({ id: 's1', input, seeds, source: 'demo' });
    const forks: Fork[] = [
      { id: 'f1', simulation: sim, status: 'decided', chosenScenarioId: sim.recommendation.scenarioId },
      { id: 'f2', simulation: sim, status: 'decided', chosenScenarioId: sim.scenarios[0].id },
    ];
    const report = computePatterns(forks);
    expect(report.stats.decided).toBe(2);
    expect(report.patterns.some((p) => p.id === 'follow')).toBe(true);
  });
});
