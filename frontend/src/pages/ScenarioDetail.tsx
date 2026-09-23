import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Page, ScoreBar } from '../components/ui';
import { FORK_COLORS } from '../lib/ui';
import { effectiveContext } from '../engine/engine';
import { formatCompact } from '../engine/format';
import type { Simulation } from '../engine/types';
import { useSim } from '../store/sim';

export function ScenarioView({ sim, scenarioId, backTo }: { sim: Simulation; scenarioId: string; backTo: string }) {
  const index = sim.scenarios.findIndex((s) => s.id === scenarioId);
  const s = sim.scenarios[index];
  if (!s) return <Navigate to={backTo} replace />;
  const ctx = effectiveContext(sim);
  const toneCls = { neutral: 'bg-slate-300 dark:bg-white/30', positive: 'bg-fork-b', negative: 'bg-fork-c', milestone: 'bg-fork-d' };

  return (
    <Page
      title={
        <>
          <span className={`font-mono ${FORK_COLORS[index % 4]}`}>fork {s.letter}</span> · {s.title}
        </>
      }
      subtitle={s.description}
      action={
        <Link to={backTo} className="btn-ghost text-xs">
          <ArrowLeft size={14} /> all futures
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-bold">Timeline · {ctx.horizonMonths} months</h3>
          <ol className="relative mt-4 space-y-5 border-l border-slate-200 pl-5 dark:border-white/10">
            {s.timeline.map((ev) => (
              <li key={ev.id} className="relative">
                <span className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full ring-4 ring-white dark:ring-ink-800 ${toneCls[ev.tone]}`} />
                <p className="font-mono text-[10px] tracking-wider text-slate-500 dark:text-ink-300">{ev.label}</p>
                <p className="font-semibold">{ev.title}</p>
                {ev.detail && <p className="text-sm text-slate-600 dark:text-ink-300">{ev.detail}</p>}
                {ev.balance !== undefined && ctx.savings !== undefined && <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-ink-300">balance ≈ {formatCompact(ev.balance, ctx.currency)}</p>}
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-baseline justify-between">
              <h3 className="font-bold">Fit score</h3>
              <span className="font-mono text-2xl font-extrabold">{s.score}</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {(['financial', 'opportunity', 'goal', 'risk', 'flexibility', 'stress'] as const).map((k) => (
                <ScoreBar key={k} value={s.metrics[k]} index={index} label={k === 'risk' ? 'safety' : k === 'goal' ? 'goal fit' : k} />
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h3 className="flex items-center gap-2 font-bold text-fork-b">
              <Plus size={14} /> Advantages
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {s.advantages.map((a) => (
                <li key={a}>· {a}</li>
              ))}
            </ul>
            <h3 className="mt-4 flex items-center gap-2 font-bold text-fork-c">
              <Minus size={14} /> Trade-offs
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {s.tradeoffs.map((t) => (
                <li key={t}>· {t}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Page>
  );
}

export default function ScenarioDetail() {
  const { scenarioId = '' } = useParams();
  const sim = useSim((s) => s.current);
  if (!sim) return <Navigate to="/app/fork" replace />;
  return <ScenarioView sim={sim} scenarioId={scenarioId} backTo="/app/futures" />;
}
