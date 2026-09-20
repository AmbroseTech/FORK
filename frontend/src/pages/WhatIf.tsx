import { ArrowLeft, Lock, RotateCcw, Wand2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CompareTable } from '../components/ScenarioCards';
import { Alert, Disclaimer, Page } from '../components/ui';
import { FORK_COLORS } from '../lib/ui';
import { effectiveContext, hasOverrides, recompute } from '../engine/engine';
import { formatCompact } from '../engine/format';
import type { DecisionContext } from '../engine/types';
import { labelFor, parseWhatIf, WHAT_IF_PRESETS } from '../engine/whatIf';
import { api, ApiError, errorMessage } from '../lib/api';
import type { WhatIfInterpretation } from '../lib/types';
import { useAuth } from '../store/auth';
import { useSim } from '../store/sim';

export default function WhatIf() {
  const { current, applyOverrides, clearOverrides, savedId } = useSim();
  const usage = useAuth((s) => s.usage);
  const authed = useAuth((s) => Boolean(s.tokens));
  const [prompt, setPrompt] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [err, setErr] = useState<{ msg: string; upgrade?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!current) return <Navigate to="/app/fork" replace />;
  const sim = current;
  const base = recompute(sim, {});
  const ctx = effectiveContext(sim);
  const pro = usage ? usage.custom_what_if : false;

  const apply = (label: string, overrides: Partial<DecisionContext>) => {
    applyOverrides(overrides);
    setSummary(label);
    setErr(null);
    if (authed && savedId) {
      const next = recompute(sim, { ...sim.overrides, ...overrides });
      const scores = Object.fromEntries(next.scenarios.map((s) => [s.letter, s.score]));
      api(`/api/decisions/${savedId}/what-if`, {
        method: 'POST',
        body: { prompt: label, context: sim.input.context, ruleSummary: label, ruleOverrides: overrides, resultScores: scores },
      }).catch(() => undefined);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = prompt.trim();
    if (!text) return;
    setBusy(true);
    setErr(null);
    const rule = parseWhatIf(text, ctx);
    if (rule) {
      apply(rule.summary, rule.overrides);
      setBusy(false);
      return;
    }
    if (!authed || !pro) {
      setErr({ msg: 'FORK could not turn that into numbers offline. Custom AI what-if questions need Weekly or Pro.', upgrade: true });
      setBusy(false);
      return;
    }
    try {
      const r = await api<WhatIfInterpretation>('/api/what-if/interpret', { method: 'POST', body: { prompt: text, context: ctx } });
      apply(r.summary, r.overrides);
    } catch (e) {
      setErr({ msg: errorMessage(e), upgrade: e instanceof ApiError && e.status === 402 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title={
        <>
          <span className="code">what_if()</span> experiments
        </>
      }
      subtitle="Change one assumption and re-run the same futures. Deterministic: only the change you make moves the numbers."
      action={
        <Link to="/app/futures" className="btn-ghost text-xs">
          <ArrowLeft size={14} /> futures
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <form onSubmit={submit} className="card p-5">
            <label className="label">Ask anything</label>
            <input className="input" placeholder="What if my income drops 20%?" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={280} />
            <button className="btn-primary mt-3 w-full" disabled={busy || !prompt.trim()}>
              <Wand2 size={14} /> run experiment
            </button>
            <p className="mt-2 text-xs text-slate-500 dark:text-ink-300">
              Understands "income −20%", "cost becomes 1.2M", "wait 3 more months"{pro ? ' — and free-form questions via AI.' : '. Free-form AI questions need Weekly.'}
            </p>
          </form>
          <div className="card p-5">
            <h3 className="font-bold">Quick experiments</h3>
            <div className="mt-3 flex flex-col gap-2">
              {WHAT_IF_PRESETS.map((p) => {
                const locked = p.pro && !pro;
                return (
                  <button
                    key={p.id}
                    disabled={locked}
                    onClick={() => apply(`What if ${p.label}?`, p.apply(sim.input.context))}
                    className="chip justify-between border-slate-200 py-2 text-left disabled:opacity-50 hover:border-brand-400 dark:border-white/10"
                  >
                    <span>what if {p.label}</span>
                    {locked && <Lock size={12} />}
                  </button>
                );
              })}
            </div>
            {!pro && (
              <Link to="/app/pricing" className="mt-3 block text-xs text-brand-600 underline dark:text-brand-300">
                Unlock all experiments · UGX 3,000/week
              </Link>
            )}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {err && (
            <Alert tone={err.upgrade ? 'warn' : 'error'}>
              {err.msg}{' '}
              {err.upgrade && (
                <Link to="/app/pricing" className="font-semibold underline">
                  See plans
                </Link>
              )}
            </Alert>
          )}
          {hasOverrides(sim) ? (
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="code">{'>'} what_if("{summary ?? 'custom'}")</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-ink-300">
                    {Object.entries(sim.overrides)
                      .filter(([, v]) => v !== undefined)
                      .map(([k, v]) => `${labelFor(k as keyof DecisionContext)} → ${k === 'horizonMonths' ? `${v} mo` : formatCompact(v as number, ctx.currency)}`)
                      .join(' · ')}
                  </p>
                </div>
                <button className="btn-ghost text-xs" onClick={() => { clearOverrides(); setSummary(null); }}>
                  <RotateCcw size={12} /> reset
                </button>
              </div>
              <ul className="mt-4 divide-y divide-slate-200 dark:divide-white/10">
                {sim.scenarios.map((s, i) => {
                  const before = base.scenarios[i];
                  const delta = s.score - before.score;
                  return (
                    <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                      <span>
                        <span className={`font-mono font-bold ${FORK_COLORS[i % 4]}`}>{s.letter}</span> {s.title}
                      </span>
                      <span className="font-mono">
                        {before.score} → <b>{s.score}</b>{' '}
                        <span className={delta > 0 ? 'text-fork-b' : delta < 0 ? 'text-fork-c' : 'text-slate-400'}>
                          ({delta > 0 ? '+' : ''}
                          {delta})
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {sim.recommendation.scenarioId !== base.recommendation.scenarioId && (
                <Alert tone="info">
                  The leaning changed: now <b>{sim.scenarios.find((s) => s.id === sim.recommendation.scenarioId)?.title}</b>.
                </Alert>
              )}
            </div>
          ) : (
            <div className="card p-8 text-center text-sm text-slate-500 dark:text-ink-300">Pick a quick experiment or type your own to see how the futures shift.</div>
          )}
          <CompareTable sim={sim} />
          <Disclaimer />
        </div>
      </div>
    </Page>
  );
}
