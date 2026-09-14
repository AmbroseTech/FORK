import { buildSimulation } from '@/features/simulation/engine';
import { shareText } from '@/features/simulation/share';
import { DEMO_DRAFT } from '@/features/simulation/demoDraft';
import { pickTemplate } from '@/services/ai/demoProvider';

describe('shareText', () => {
  const input = { decision: DEMO_DRAFT.decision, priorities: DEMO_DRAFT.priorities, context: DEMO_DRAFT.context };
  const sim = buildSimulation({ id: 'sim_share', input, seeds: pickTemplate(input.decision).scenarios, source: 'demo' });

  it('lists every scenario, the pick and the disclaimer', () => {
    const text = shareText(sim);
    expect(text).toContain(DEMO_DRAFT.decision);
    sim.scenarios.forEach((s) => expect(text).toContain(`fork ${s.letter} · ${s.title}`));
    expect(text).toContain('Rule-based pick:');
    expect(text).toContain('does not predict the future');
    expect(text).not.toMatch(/\n\n\n/);
  });
});
