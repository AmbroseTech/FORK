import { ArrowRight, Clock, GitFork, Lightbulb, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Page, SourceBadge } from '../components/ui';
import { EXAMPLE_DECISIONS } from '../engine/demoDraft';
import { relativeDate } from '../engine/format';
import { api } from '../lib/api';
import type { DecisionList } from '../lib/types';
import { useAuth } from '../store/auth';
import { useSim } from '../store/sim';

export default function Home() {
  const { user, usage } = useAuth();
  const { setDraft, loadDemo, current } = useSim();
  const navigate = useNavigate();
  const [recent, setRecent] = useState<DecisionList | null>(null);

  useEffect(() => {
    api<DecisionList>('/api/decisions?limit=3')
      .then(setRecent)
      .catch(() => setRecent({ items: [], total: 0 }));
  }, []);

  const name = user?.profile?.display_name || user?.username;
  const left = usage ? usage.trial_remaining + usage.remaining_today : null;

  return (
    <Page title={`Hey ${name} 👋`} subtitle="What are you deciding today?">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card glow p-6 md:col-span-2">
          <p className="code">{'>'} simulate()</p>
          <h2 className="mt-2 text-xl font-bold">Explore a decision</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-ink-300">Describe it in one sentence. Add numbers if you have them.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLE_DECISIONS.map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDraft({ decision: d });
                  navigate('/app/fork');
                }}
                className="chip border-slate-200 hover:border-brand-400 hover:text-brand-600 dark:border-white/10 dark:hover:text-brand-300"
              >
                {d}
              </button>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/app/fork" className="btn-primary">
              New decision <ArrowRight size={16} />
            </Link>
            <button
              className="btn-ghost"
              onClick={() => {
                loadDemo();
                navigate('/app/fork');
              }}
            >
              Load demo
            </button>
            {current && (
              <Link to="/app/futures" className="btn-ghost">
                Resume current
              </Link>
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Usage</h3>
            <Sparkles size={16} className="text-brand-400" />
          </div>
          {usage ? (
            <>
              <p className="mt-3 text-3xl font-extrabold">{usage.plan_code === 'FREE' ? left : '∞'}</p>
              <p className="text-xs text-slate-500 dark:text-ink-300">
                {usage.plan_code === 'FREE'
                  ? usage.trial_remaining > 0
                    ? `${usage.trial_remaining} trial + ${usage.remaining_today}/${usage.daily_limit} today`
                    : `${usage.remaining_today} of ${usage.daily_limit} left today`
                  : `${usage.plan_name} · up to ${usage.max_scenarios} futures`}
              </p>
              <Link to="/app/pricing" className="btn-ghost mt-4 w-full text-xs">
                {usage.plan_code === 'FREE' ? 'Unlock Weekly · UGX 3,000' : 'Manage plan'}
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500 dark:text-ink-300">Loading…</p>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold">
              <GitFork size={16} /> Recent forks
            </h3>
            <Link to="/app/history" className="text-xs text-brand-600 dark:text-brand-300">
              View all
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-200 dark:divide-white/10">
            {recent?.items.length === 0 && <li className="py-3 text-sm text-slate-500 dark:text-ink-300">No saved forks yet. Your first one is a click away.</li>}
            {recent?.items.map((d) => (
              <li key={d.id}>
                <Link to={`/app/history/${d.id}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="truncate">{d.title}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500 dark:text-ink-300">
                    <SourceBadge source={d.source} /> <Clock size={12} /> {relativeDate(new Date(d.createdAt).getTime())}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <h3 className="flex items-center gap-2 font-bold">
            <Lightbulb size={16} /> Insights
          </h3>
          <p className="mt-3 text-sm text-slate-500 dark:text-ink-300">
            FORK learns from decisions you save and outcomes you record — nothing else. Save 3+ forks to unlock your first pattern.
          </p>
          <Link to="/app/insights" className="btn-ghost mt-4 text-xs">
            Open insights
          </Link>
        </div>
      </div>
    </Page>
  );
}
