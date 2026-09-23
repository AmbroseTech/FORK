import { Bookmark, Check, Copy, RotateCcw, Share2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CompareTable, RiskNotice, ScenarioCard } from '../components/ScenarioCards';
import { Alert, Disclaimer, Page, SourceBadge } from '../components/ui';
import { effectiveContext, hasOverrides } from '../engine/engine';
import { shareText } from '../engine/share';
import { errorMessage } from '../lib/api';
import { saveFork } from '../lib/forks';
import { useAuth } from '../store/auth';
import { useSim } from '../store/sim';

export default function Futures() {
  const { current, category, aiNote, local, savedId, setSavedId, clearOverrides } = useSim();
  const authed = useAuth((s) => Boolean(s.tokens));
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator.share === 'function';

  if (!current) return <Navigate to="/app/fork" replace />;
  const sim = current;
  const rec = sim.scenarios.find((s) => s.id === sim.recommendation.scenarioId);
  const ctx = effectiveContext(sim);

  const save = async () => {
    if (!authed) return navigate('/signup');
    setBusy(true);
    setErr('');
    try {
      const d = await saveFork(sim, category);
      setSavedId(d.id);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const text = shareText(sim);
    if (canNativeShare) {
      try {
        await navigator.share({ title: 'FORK', text });
        return;
      } catch {
        /* fall through to clipboard */
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Page
      title={sim.input.decision}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <SourceBadge source={sim.source} local={local} />
          <span>
            {ctx.horizonMonths}-month horizon · confidence {sim.confidence.level}
            {category ? ` · ${category}` : ''}
          </span>
        </span>
      }
      action={
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost text-xs" onClick={share}>
            {copied ? <Check size={14} /> : canNativeShare ? <Share2 size={14} /> : <Copy size={14} />} share()
          </button>
          <Link to="/app/whatif" className="btn-ghost text-xs">
            <Wand2 size={14} /> what_if()
          </Link>
          <button className="btn-primary text-xs" onClick={save} disabled={busy || Boolean(savedId)}>
            <Bookmark size={14} /> {savedId ? 'saved' : 'fork()'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {err && <Alert tone="error">{err}</Alert>}
        {savedId && (
          <Alert tone="success">
            Saved to your history.{' '}
            <Link to={`/app/history/${savedId}`} className="font-semibold underline">
              Choose a path & track the outcome →
            </Link>
          </Alert>
        )}
        {aiNote && <Alert tone="info">{aiNote}</Alert>}
        <RiskNotice sim={sim} />
        {hasOverrides(sim) && (
          <Alert tone="warn">
            <span className="flex items-center justify-between gap-3">
              <span>Showing futures under your what-if assumptions.</span>
              <button className="inline-flex items-center gap-1 font-semibold underline" onClick={clearOverrides}>
                <RotateCcw size={12} /> reset
              </button>
            </span>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {sim.scenarios.map((s, i) => (
            <ScenarioCard key={s.id} sim={sim} s={s} index={i} to={`/app/futures/${s.id}`} />
          ))}
        </div>

        <CompareTable sim={sim} />

        {rec && (
          <div className="card glow p-5">
            <p className="code">{'>'} {sim.source === 'demo' ? 'rule_based_recommendation()' : 'ai_recommendation()'}</p>
            <h3 className="mt-2 text-lg font-bold">
              Leaning: <span className="text-brand-600 dark:text-brand-300">{rec.title}</span>
            </h3>
            <p className="mt-1 text-sm text-slate-700 dark:text-ink-100">{sim.recommendation.take}</p>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-ink-300">
              {sim.recommendation.why.map((w) => (
                <li key={w} className="flex gap-2">
                  <span className="text-brand-400">›</span> {w}
                </li>
              ))}
            </ul>
            {sim.confidence.missing.length > 0 && (
              <p className="mt-3 text-xs text-slate-500 dark:text-ink-300">Confidence would improve with: {sim.confidence.missing.join(', ')}.</p>
            )}
          </div>
        )}
        <Disclaimer />
      </div>
    </Page>
  );
}
