import { ArrowRight, Check, Lock, Sparkles } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRefreshUsage } from '../lib/ui';
import { Alert, Disclaimer, Page, Spinner } from '../components/ui';
import { assessConfidence } from '../engine/engine';
import { parseNumber } from '../engine/format';
import { CURRENCIES, type DecisionContext, PRIORITIES, type Priority } from '../engine/types';
import { errorMessage } from '../lib/api';
import { PROCESSING_STATES, runSimulation, UsageLimitError } from '../lib/simulate';
import { useAuth } from '../store/auth';
import { useSim } from '../store/sim';

const PRIORITY_LABEL: Record<Priority, string> = {
  money: 'Money',
  career: 'Career',
  education: 'Education',
  convenience: 'Convenience',
  business: 'Business',
  relationships: 'Relationships',
  lifestyle: 'Lifestyle',
};

const NUMERIC: { key: keyof DecisionContext; label: string; hint: string }[] = [
  { key: 'savings', label: 'Current savings', hint: 'e.g. 2,000,000' },
  { key: 'cost', label: 'One-off cost', hint: 'price / tuition / moving cost' },
  { key: 'monthlyIncome', label: 'Monthly income', hint: 'salary, allowance, side work' },
  { key: 'monthlyExpenses', label: 'Monthly expenses', hint: 'rent, food, transport…' },
  { key: 'goalAmount', label: 'Goal amount (optional)', hint: 'what you are saving for' },
];

export default function Fork() {
  const { draft, setDraft, setCurrent, resetDraft } = useSim();
  const usage = useAuth((s) => s.usage);
  const navigate = useNavigate();
  const refreshUsage = useRefreshUsage();
  const [state, setState] = useState<number | null>(null);
  const [err, setErr] = useState<{ msg: string; limit?: boolean } | null>(null);
  const [raw, setRaw] = useState<Record<string, string>>({});
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const conf = assessConfidence(draft);
  const canRun = draft.decision.trim().length >= 8 && draft.priorities.length > 0 && state === null;

  const togglePriority = (p: Priority) => {
    const has = draft.priorities.includes(p);
    if (has) setDraft({ priorities: draft.priorities.filter((x) => x !== p) });
    else if (draft.priorities.length < 3) setDraft({ priorities: [...draft.priorities, p] });
  };

  const setNum = (key: keyof DecisionContext, v: string) => {
    setRaw({ ...raw, [key]: v });
    setDraft({ context: { ...draft.context, [key]: parseNumber(v) } });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canRun) return;
    setErr(null);
    setState(0);
    try {
      const r = await runSimulation(draft, (i) => mounted.current && setState(i));
      setCurrent(r.simulation, { category: r.category, aiNote: r.aiNote, local: r.local });
      await refreshUsage();
      navigate('/app/futures');
    } catch (e) {
      if (e instanceof UsageLimitError) setErr({ msg: e.message, limit: true });
      else setErr({ msg: errorMessage(e) });
      setState(null);
    }
  };

  if (state !== null) {
    return (
      <Page title="Building your futures" subtitle={draft.decision}>
        <div className="card mx-auto max-w-lg p-8">
          <ul className="space-y-3 font-mono text-sm">
            {PROCESSING_STATES.map((s, i) => (
              <li key={s} className={`flex items-center gap-3 ${i > state ? 'opacity-30' : ''}`}>
                {i < state ? <Check size={16} className="text-fork-b" /> : i === state ? <Spinner className="text-brand-400" /> : <span className="h-4 w-4" />}
                <span className={i === state ? 'animate-fork-pulse' : ''}>{s}</span>
              </li>
            ))}
          </ul>
          <Disclaimer className="mt-8" />
        </div>
      </Page>
    );
  }

  return (
    <Page
      title={
        <>
          <span className="code">simulate()</span> a decision
        </>
      }
      subtitle="Describe the decision, add what you know. Uncertain numbers are fine — you can what-if them later."
      action={
        <button className="btn-ghost text-xs" onClick={() => { resetDraft(); setRaw({}); }}>
          Clear
        </button>
      }
    >
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {err && (
            <Alert tone={err.limit ? 'warn' : 'error'}>
              {err.msg}{' '}
              {err.limit && (
                <Link to="/app/pricing" className="font-semibold underline">
                  Unlock Weekly
                </Link>
              )}
            </Alert>
          )}
          <div className="card p-5">
            <label className="label">Decision</label>
            <textarea
              className="input min-h-24 resize-y text-base"
              placeholder="Should I buy a laptop now or keep saving?"
              maxLength={280}
              value={draft.decision}
              onChange={(e) => setDraft({ decision: e.target.value })}
            />
            <div className="mt-4">
              <label className="label">What matters most (up to 3)</label>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => {
                  const on = draft.priorities.includes(p);
                  return (
                    <button
                      type="button"
                      key={p}
                      onClick={() => togglePriority(p)}
                      className={`chip ${on ? 'border-brand-500 bg-brand-500/15 text-brand-700 dark:text-brand-300' : 'border-slate-200 dark:border-white/10'}`}
                    >
                      {on && <Check size={12} />} {PRIORITY_LABEL[p]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Context</h3>
              <select className="input !w-auto !py-1.5 text-xs" value={draft.context.currency} onChange={(e) => setDraft({ context: { ...draft.context, currency: e.target.value as DecisionContext['currency'] } })}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {NUMERIC.map(({ key, label, hint }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder={hint}
                    value={raw[key] ?? (draft.context[key] !== undefined ? String(draft.context[key]) : '')}
                    onChange={(e) => setNum(key, e.target.value)}
                  />
                </div>
              ))}
              <div>
                <label className="label">Goal (optional)</label>
                <input className="input" maxLength={120} placeholder="University expenses" value={draft.context.goal ?? ''} onChange={(e) => setDraft({ context: { ...draft.context, goal: e.target.value || undefined } })} />
              </div>
              <div>
                <label className="label">Horizon · {draft.context.horizonMonths} months</label>
                <input type="range" min={1} max={36} className="w-full accent-brand-500" value={draft.context.horizonMonths} onChange={(e) => setDraft({ context: { ...draft.context, horizonMonths: Number(e.target.value) } })} />
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold">Confidence</h3>
            <p className={`mt-1 text-2xl font-extrabold ${conf.level === 'HIGH' ? 'text-fork-b' : conf.level === 'MEDIUM' ? 'text-fork-d' : 'text-fork-c'}`}>{conf.level}</p>
            <ul className="mt-3 space-y-1 text-xs">
              {conf.present.map((p) => (
                <li key={p} className="flex items-center gap-2 text-slate-600 dark:text-ink-300">
                  <Check size={12} className="text-fork-b" /> {p}
                </li>
              ))}
              {conf.missing.map((p) => (
                <li key={p} className="flex items-center gap-2 text-slate-400 dark:text-ink-300/60">
                  <span className="inline-block h-3 w-3 rounded-full border border-current" /> {p}
                </li>
              ))}
            </ul>
          </div>
          <button className="btn-primary w-full !py-3" disabled={!canRun}>
            <Sparkles size={16} /> simulate() <ArrowRight size={16} />
          </button>
          {usage && usage.plan_code === 'FREE' && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-ink-300">
              <Lock size={12} /> {usage.trial_remaining + usage.remaining_today} free simulation{usage.trial_remaining + usage.remaining_today === 1 ? '' : 's'} left · up to {usage.max_scenarios} futures
            </p>
          )}
          <Disclaimer />
        </aside>
      </form>
    </Page>
  );
}
