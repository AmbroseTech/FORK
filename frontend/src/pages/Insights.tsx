import { Lightbulb } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Alert, Disclaimer, Empty, Page, Spinner } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import type { Insights as InsightsT } from '../lib/types';

const TONE = {
  positive: 'border-fork-b/40 bg-fork-b/5',
  neutral: 'border-slate-200 dark:border-white/10',
  caution: 'border-fork-d/40 bg-fork-d/5',
};

function num(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}

export default function Insights() {
  const [data, setData] = useState<InsightsT | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api<InsightsT>('/api/insights').then(setData).catch((e) => setErr(errorMessage(e)));
  }, []);

  const outcomes = (data?.stats.outcomes ?? {}) as Record<string, unknown>;
  const stats: [string, unknown][] = data
    ? [
        ['Saved', data.stats.total],
        ['Decided', data.stats.decided],
        ['Reviewed', data.stats.reviewed],
        ['Followed pick', data.stats.followedRecommendation],
      ]
    : [];

  return (
    <Page
      title={
        <>
          <span className="code">insight()</span> patterns
        </>
      }
      subtitle="Computed only from decisions you saved, paths you chose and outcomes you recorded. Nothing is inferred beyond that."
    >
      {err && <Alert tone="error">{err}</Alert>}
      {!data && !err && (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      )}
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map(([k, v]) => (
              <div key={k} className="card p-4">
                <p className="text-xs text-slate-500 dark:text-ink-300">{k}</p>
                <p className="font-mono text-2xl font-extrabold">{num(v)}</p>
              </div>
            ))}
          </div>
          {data.decisions_considered > 0 && (
            <div className="card flex flex-wrap items-center gap-4 p-4 text-sm">
              <span className="font-semibold">Outcomes</span>
              {(['better', 'expected', 'worse'] as const).map((k) => (
                <span key={k} className="font-mono">
                  <span className={k === 'better' ? 'text-fork-b' : k === 'worse' ? 'text-fork-c' : 'text-brand-400'}>{num(outcomes[k])}</span> {k}
                </span>
              ))}
            </div>
          )}
          {!data.enough_data ? (
            <Empty title={data.headline} body="Save at least 3 forks, choose a path on each, and record outcomes as they happen. Patterns appear only once there is real data." cta={{ to: '/app/fork', label: 'simulate()' }} />
          ) : (
            <>
              <div className="card glow p-5">
                <p className="flex items-center gap-2 text-xs font-semibold text-brand-600 dark:text-brand-300">
                  <Lightbulb size={14} /> Based on {data.decisions_considered} decisions
                </p>
                <h2 className="mt-1 text-xl font-bold">{data.headline}</h2>
                {data.ai_note && <p className="mt-2 text-sm text-slate-600 dark:text-ink-300">{data.ai_note}</p>}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {data.patterns.map((p) => (
                  <div key={p.id} className={`card border p-5 ${TONE[p.tone]}`}>
                    <h3 className="font-bold">{p.title}</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-ink-300">{p.detail}</p>
                  </div>
                ))}
              </div>
            </>
          )}
          <Disclaimer />
        </div>
      )}
    </Page>
  );
}
