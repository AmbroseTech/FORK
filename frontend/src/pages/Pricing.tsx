import { Check, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page, Spinner } from '../components/ui';
import { api } from '../lib/api';
import type { Plan } from '../lib/types';
import { formatUGX } from '../lib/ui';
import { useAuth } from '../store/auth';

export default function Pricing({ embedded = false }: { embedded?: boolean }) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const { usage, tokens } = useAuth();
  useEffect(() => {
    api<Plan[]>('/api/plans', { auth: false }).then(setPlans).catch(() => setPlans([]));
  }, []);

  const features = (p: Plan) => [
    p.daily_simulations >= 1000 ? 'Unlimited simulations' : `${p.daily_simulations} simulations / day`,
    `Up to ${p.max_scenarios} futures per decision`,
    p.ai_depth === 'deep' ? 'Deep AI scenario explanations' : p.ai_depth === 'standard' ? 'Standard AI explanations' : 'Rule-based explanations',
    p.custom_what_if ? 'Custom what-if questions' : 'Quick what-if presets',
    p.advanced_insights ? 'Advanced insights' : 'Basic insights',
    p.history_limit >= 1000 ? 'Unlimited history' : `${p.history_limit} saved forks`,
  ];

  return (
    <Page title="Plans" subtitle="Free to start. Pay by the week with Mobile Money — no card, no lock-in." className={embedded ? '' : 'pt-12'}>
      {!plans ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const current = usage?.plan_code === p.code;
            const highlight = p.code === 'WEEKLY';
            return (
              <div key={p.code} className={`card relative flex flex-col p-6 ${highlight ? 'ring-2 ring-brand-500' : ''}`}>
                {highlight && (
                  <span className="absolute -top-3 left-6 chip border-brand-500 bg-brand-500 text-white">
                    <Sparkles size={11} /> most popular
                  </span>
                )}
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-ink-300">{p.description}</p>
                <p className="mt-4 text-3xl font-extrabold">
                  {p.price_minor === 0 ? 'UGX 0' : formatUGX(p.price_minor, p.currency)}
                  <span className="text-sm font-medium text-slate-500 dark:text-ink-300"> / {p.duration_days === 7 ? 'week' : `${p.duration_days} days`}</span>
                </p>
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {features(p).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check size={14} className="mt-0.5 shrink-0 text-fork-b" /> {f}
                    </li>
                  ))}
                </ul>
                {p.code === 'FREE' ? (
                  <Link to={tokens ? '/app/fork' : '/signup'} className="btn-ghost mt-6">
                    {current ? 'Current plan' : 'Start free'}
                  </Link>
                ) : current ? (
                  <span className="btn-ghost mt-6 cursor-default">Active{usage?.subscription_ends_at ? ` until ${new Date(usage.subscription_ends_at).toLocaleDateString()}` : ''}</span>
                ) : (
                  <Link to={tokens ? `/app/checkout/${p.code}` : '/signup'} className={`mt-6 ${highlight ? 'btn-primary' : 'btn-ghost'}`}>
                    {tokens ? `Get ${p.name}` : 'Sign up to subscribe'}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-xs text-slate-500 dark:text-ink-300">
        Mobile Money payments are authorised on your own handset. FORK never asks for, sees or stores your PIN. Cards: coming soon.
      </p>
    </Page>
  );
}
