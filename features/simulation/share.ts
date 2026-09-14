import { resolveContext } from './engine';
import type { Simulation } from '@/types/simulation';
import { formatCompact } from '@/utils/format';

/** Plain-text summary of a simulation, suitable for the OS share sheet. */
export function shareText(sim: Simulation): string {
  const ctx = resolveContext(sim.input.context, sim.overrides);
  const rec = sim.scenarios.find((s) => s.id === sim.recommendation.scenarioId);
  const lines = [
    `FORK_ · ${sim.input.decision}`,
    `${ctx.horizonMonths}-month horizon · confidence ${sim.confidence.level}`,
    '',
    ...sim.scenarios.map((s) => {
      const money = ctx.savings !== undefined ? ` · ends ≈ ${formatCompact(s.projectedBalance, ctx.currency)}` : '';
      return `fork ${s.letter} · ${s.title} — fit ${s.score}/100${money}`;
    }),
    '',
    rec ? `${sim.source === 'groq' ? 'AI' : 'Rule-based'} pick: ${rec.title}` : '',
    sim.recommendation.take,
    '',
    'FORK explores possible scenarios. It does not predict the future.',
    'https://github.com/AmbroseTech/FORK',
  ];
  return lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
}
