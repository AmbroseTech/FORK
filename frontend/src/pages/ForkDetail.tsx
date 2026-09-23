import { Archive, ArrowLeft, Check, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CompareTable, RiskNotice, ScenarioCard } from '../components/ScenarioCards';
import { Alert, Disclaimer, Page, SourceBadge, Spinner } from '../components/ui';
import { relativeDate } from '../engine/format';
import { api, errorMessage } from '../lib/api';
import { toSimulation } from '../lib/forks';
import type { DecisionOut } from '../lib/types';
import { useSim } from '../store/sim';
import { ScenarioView } from './ScenarioDetail';

const RATINGS = [
  ['better', 'Better than expected', 'text-fork-b'],
  ['expected', 'About as expected', 'text-brand-400'],
  ['worse', 'Worse than expected', 'text-fork-c'],
] as const;

export default function ForkDetail() {
  const { id = '', scenarioId } = useParams();
  const navigate = useNavigate();
  const { setCurrent, setSavedId } = useSim();
  const [d, setD] = useState<DecisionOut | null>(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<DecisionOut>(`/api/decisions/${id}`).then(setD).catch((e) => setErr(errorMessage(e)));
  }, [id]);

  if (err) return <Page title="Fork not found"><Alert tone="error">{err}</Alert></Page>;
  if (!d)
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  const sim = toSimulation(d);
  if (scenarioId) return <ScenarioView sim={sim} scenarioId={scenarioId} backTo={`/app/history/${d.id}`} />;

  const run = async (fn: () => Promise<DecisionOut | void>) => {
    setBusy(true);
    setErr('');
    try {
      const r = await fn();
      if (r) setD(r);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const decide = (sid: string) => run(() => api<DecisionOut>(`/api/decisions/${d.id}/decide`, { method: 'POST', body: { scenarioId: sid } }));
  const outcome = (rating: string) => run(() => api<DecisionOut>(`/api/decisions/${d.id}/outcome`, { method: 'POST', body: { rating, note } }));
  const archive = () => run(() => api<DecisionOut>(`/api/decisions/${d.id}`, { method: 'PATCH', body: { isArchived: !d.isArchived } }));
  const remove = () => {
    if (!confirm('Delete this fork? It will no longer count towards insights.')) return;
    void run(async () => {
      await api(`/api/decisions/${d.id}`, { method: 'DELETE' });
      navigate('/app/history');
    });
  };
  const openWhatIf = () => {
    setCurrent(sim, { category: d.category ?? '', aiNote: null, local: false });
    setSavedId(d.id);
    navigate('/app/whatif');
  };

  const chosen = d.scenarios.find((s) => s.id === d.chosenScenarioId);

  return (
    <Page
      title={d.title}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <SourceBadge source={d.source} />
          <span>
            saved {relativeDate(new Date(d.createdAt).getTime())} · {d.status.toLowerCase()}
            {d.isArchived ? ' · archived' : ''}
          </span>
        </span>
      }
      action={
        <div className="flex flex-wrap gap-2">
          <Link to="/app/history" className="btn-ghost text-xs">
            <ArrowLeft size={14} /> history
          </Link>
          <button className="btn-ghost text-xs" onClick={openWhatIf}>
            <Wand2 size={14} /> what_if()
          </button>
          <button className="btn-ghost text-xs" onClick={archive} disabled={busy}>
            <Archive size={14} /> {d.isArchived ? 'unarchive' : 'archive'}
          </button>
          <button className="btn-danger text-xs" onClick={remove} disabled={busy}>
            <Trash2 size={14} />
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <RiskNotice sim={sim} />
        {d.status === 'PENDING' && <Alert tone="info">Which path did you (or will you) take? Choosing a fork is what lets FORK learn your patterns later.</Alert>}
        <div className="grid gap-4 md:grid-cols-2">
          {d.scenarios.map((s, i) => (
            <div key={s.id} className="space-y-2">
              <ScenarioCard sim={sim} s={s} index={i} to={`/app/history/${d.id}/scenario/${s.id}`} chosen={s.id === d.chosenScenarioId} />
              {d.status === 'PENDING' && (
                <button className="btn-ghost w-full text-xs" disabled={busy} onClick={() => decide(s.id)}>
                  <Check size={14} /> I chose {s.letter}
                </button>
              )}
            </div>
          ))}
        </div>
        <CompareTable sim={sim} />

        {d.status === 'DECIDED' && chosen && (
          <div className="card p-5">
            <h3 className="font-bold">How did "{chosen.title}" turn out?</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-ink-300">Record the real outcome when you know it. This is the only data FORK uses for insights.</p>
            <textarea className="input mt-3 min-h-20" placeholder="Optional note — what surprised you?" value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} />
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {RATINGS.map(([v, label, cls]) => (
                <button key={v} className={`btn-ghost text-xs ${cls}`} disabled={busy} onClick={() => outcome(v)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {d.status === 'REVIEWED' && (
          <div className="card p-5">
            <h3 className="font-bold">Outcome: {d.outcomeRating?.toLowerCase()} than expected</h3>
            {d.outcomeNote && <p className="mt-1 text-sm text-slate-600 dark:text-ink-300">“{d.outcomeNote}”</p>}
            <p className="mt-2 text-xs text-slate-500 dark:text-ink-300">Recorded {d.outcomeRecordedAt ? relativeDate(new Date(d.outcomeRecordedAt).getTime()) : ''}</p>
          </div>
        )}
        {d.whatIfs.length > 0 && (
          <div className="card p-5">
            <h3 className="font-bold">What-if experiments</h3>
            <ul className="mt-2 divide-y divide-slate-200 text-sm dark:divide-white/10">
              {d.whatIfs.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 py-2">
                  <span>{w.summary}</span>
                  <span className="font-mono text-xs text-slate-500 dark:text-ink-300">
                    {Object.entries(w.resultScores)
                      .map(([key, sc]) => `${d.scenarios.find((s) => s.id === key || s.letter === key)?.letter ?? key}:${sc}`)
                      .join(' ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {err && <Alert tone="error">{err}</Alert>}
        <Disclaimer />
      </div>
    </Page>
  );
}
