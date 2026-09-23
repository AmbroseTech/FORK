import { AlertTriangle, ChevronRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { effectiveContext, hasOverrides } from '../engine/engine';
import { formatCompact } from '../engine/format';
import type { Metrics, Scenario, Simulation } from '../engine/types';
import { FORK_COLORS } from '../lib/ui';
import { ScoreBar } from './ui';

const METRIC_LABEL: Record<keyof Metrics, string> = {
  financial: 'Financial',
  opportunity: 'Opportunity',
  goal: 'Goal fit',
  risk: 'Safety',
  flexibility: 'Flexibility',
  stress: 'Stress',
};

export function RiskNotice({ sim }: { sim: Simulation }) {
  if (!sim.riskDomain) return null;
  const who = { medical: 'a doctor or licensed health professional', legal: 'a qualified lawyer', financial: 'a licensed financial adviser' }[sim.riskDomain];
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>
        This looks like a {sim.riskDomain} decision. FORK only explores scenarios from your inputs — please consult {who} before acting.
      </span>
    </div>
  );
}

export function ScenarioCard({ sim, s, index, to, chosen }: { sim: Simulation; s: Scenario; index: number; to?: string; chosen?: boolean }) {
  const ctx = effectiveContext(sim);
  const isRec = sim.recommendation.scenarioId === s.id;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className={`font-mono text-xs font-bold ${FORK_COLORS[index % 4]}`}>fork {s.letter}</span>
          <h3 className="mt-0.5 text-lg font-bold">{s.title}</h3>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-extrabold">{s.score}</p>
          <p className="text-[10px] tracking-wide text-slate-500 uppercase dark:text-ink-300">fit /100</p>
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-ink-300">{s.description}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {isRec && (
          <span className="chip border-brand-400/40 bg-brand-500/10 text-brand-700 dark:text-brand-300">
            <Star size={11} /> {sim.source === 'demo' ? 'rule-based pick' : 'AI pick'}
          </span>
        )}
        {chosen && <span className="chip border-fork-b/40 bg-fork-b/10 text-emerald-700 dark:text-emerald-300">you chose this</span>}
        {ctx.savings !== undefined && (
          <span className="chip border-slate-200 dark:border-white/10">
            ends ≈ {formatCompact(s.projectedBalance, ctx.currency)} · low {formatCompact(s.minBalance, ctx.currency)}
          </span>
        )}
      </div>
      <div className="mt-4">
        <ScoreBar value={s.score} index={index} />
      </div>
      {to && (
        <div className="mt-3 flex items-center justify-end text-xs font-semibold text-brand-600 dark:text-brand-300">
          timeline & trade-offs <ChevronRight size={14} />
        </div>
      )}
    </>
  );
  const cls = `card block p-5 transition ${to ? 'hover:-translate-y-0.5 hover:shadow-lg' : ''} ${isRec ? 'ring-1 ring-brand-400/50' : ''}`;
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function CompareTable({ sim }: { sim: Simulation }) {
  const keys = Object.keys(METRIC_LABEL) as (keyof Metrics)[];
  return (
    <div className="card overflow-x-auto p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">
          <span className="code">compare()</span> trade-offs
        </h3>
        {hasOverrides(sim) && <span className="chip border-fork-d/40 bg-fork-d/10 text-amber-700 dark:text-amber-300">what-if applied</span>}
      </div>
      <table className="mt-3 w-full min-w-[480px] text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 dark:text-ink-300">
            <th className="py-2 font-medium">Dimension</th>
            {sim.scenarios.map((s, i) => (
              <th key={s.id} className={`py-2 font-mono font-bold ${FORK_COLORS[i % 4]}`}>
                {s.letter}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-white/10">
          {keys.map((k) => {
            const vals = sim.scenarios.map((s) => s.metrics[k]);
            const best = k === 'stress' ? Math.min(...vals) : Math.max(...vals);
            return (
              <tr key={k}>
                <td className="py-2 text-slate-600 dark:text-ink-300">{METRIC_LABEL[k]}</td>
                {vals.map((v, i) => (
                  <td key={i} className={`py-2 font-mono ${v === best ? 'font-bold text-fork-b' : ''}`}>
                    {Math.round(v)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
