import { Archive, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, Page, SourceBadge, Spinner } from '../components/ui';
import { relativeDate } from '../engine/format';
import { api } from '../lib/api';
import type { DecisionList } from '../lib/types';

const STATUS_CLS: Record<string, string> = {
  PENDING: 'border-fork-d/40 bg-fork-d/10 text-amber-700 dark:text-amber-300',
  DECIDED: 'border-brand-400/40 bg-brand-500/10 text-brand-700 dark:text-brand-300',
  REVIEWED: 'border-fork-b/40 bg-fork-b/10 text-emerald-700 dark:text-emerald-300',
};

export default function History() {
  const [data, setData] = useState<DecisionList | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [archived, setArchived] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams({ limit: '50', archived: String(archived) });
    if (q) p.set('q', q);
    if (status) p.set('status', status);
    const t = setTimeout(() => {
      api<DecisionList>(`/api/decisions?${p}`)
        .then(setData)
        .catch(() => setData({ items: [], total: 0 }));
    }, 200);
    return () => clearTimeout(t);
  }, [q, status, archived]);

  return (
    <Page
      title="Your forks"
      subtitle="Every decision you saved. Choose a path, then record how it went."
      action={
        <button className={`btn-ghost text-xs ${archived ? 'ring-1 ring-brand-400' : ''}`} onClick={() => setArchived(!archived)}>
          <Archive size={14} /> {archived ? 'archived' : 'active'}
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute top-3 left-3 text-slate-400" />
          <input className="input !pl-9" placeholder="Search decisions" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="DECIDED">Decided</option>
          <option value="REVIEWED">Reviewed</option>
        </select>
      </div>
      {!data ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : data.items.length === 0 ? (
        <Empty title="No forks here yet" body="Run a simulation and press fork() to save it. Saved forks power your insights." cta={{ to: '/app/fork', label: 'simulate()' }} />
      ) : (
        <ul className="grid gap-3">
          {data.items.map((d) => {
            const chosen = d.scenarios.find((s) => s.id === d.chosenScenarioId);
            return (
              <li key={d.id}>
                <Link to={`/app/history/${d.id}`} className="card flex flex-col gap-2 p-4 transition hover:-translate-y-0.5 hover:shadow-lg sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{d.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-ink-300">
                      {d.scenarios.length} futures · {relativeDate(new Date(d.createdAt).getTime())}
                      {chosen ? ` · chose ${chosen.letter} ${chosen.title}` : ''}
                      {d.outcomeRating ? ` · went ${d.outcomeRating.toLowerCase()}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <SourceBadge source={d.source} />
                    <span className={`chip ${STATUS_CLS[d.status]}`}>{d.status.toLowerCase()}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
