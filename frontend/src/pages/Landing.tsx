import { ArrowRight, GitFork, Lightbulb, Scale, Sparkles, Wand2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { EXAMPLE_DECISIONS } from '../engine/demoDraft';
import { useSim } from '../store/sim';

const LOOP = ['DECISION', 'CONTEXT', 'SCENARIOS', 'TRADE-OFFS', 'WHAT-IF', 'INSIGHTS'];

const FEATURES = [
  { fn: 'simulate()', icon: Sparkles, title: 'Simulate the decision', body: 'Describe what you are deciding and add the numbers you know. FORK builds 2–4 plausible paths, month by month.' },
  { fn: 'compare()', icon: Scale, title: 'Compare trade-offs honestly', body: 'Every path shows its upside and its cost across money, opportunity, risk, flexibility and stress. No single "right answer".' },
  { fn: 'what_if()', icon: Wand2, title: 'Run what-if experiments', body: '"What if my income drops 20%?" Re-run the same futures under new assumptions — deterministically, in seconds.' },
  { fn: 'fork()', icon: GitFork, title: 'Save the fork, record the outcome', body: 'Choose a path, then come back later and tell FORK how it really went.' },
  { fn: 'insight()', icon: Lightbulb, title: 'Learn from your own history', body: 'Insights come only from decisions you actually saved. FORK never invents patterns about you.' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { setDraft, loadDemo } = useSim();

  const tryExample = (decision: string) => {
    setDraft({ decision });
    navigate('/app/fork');
  };

  return (
    <div>
      <section className="glow relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
          <span className="chip border-brand-400/30 bg-brand-500/10 text-brand-700 dark:text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> works free · no card · no API key required
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            Don't just make a decision.
            <br />
            <span className="bg-gradient-to-r from-fork-a via-fork-b to-fork-c bg-clip-text text-transparent">See where it leads.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600 dark:text-ink-300">Explore possible futures before you choose one.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              className="btn-primary !px-6 !py-3 text-base"
              onClick={() => {
                loadDemo();
                navigate('/app/fork');
              }}
            >
              Try the demo decision <ArrowRight size={18} />
            </button>
            <Link to="/signup" className="btn-ghost !px-6 !py-3 text-base">
              Create free account
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 font-mono text-xs text-slate-500 dark:text-ink-300">
            {LOOP.map((step, i) => (
              <span key={step} className="flex items-center gap-2">
                <span className="rounded-md border border-slate-200 px-2 py-1 dark:border-white/10">{step}</span>
                {i < LOOP.length - 1 && <span>→</span>}
              </span>
            ))}
            <span>→ DECISION</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <div className="card overflow-hidden p-6 sm:p-10">
          <p className="code">{'>'} simulate("Should I buy a laptop now or keep saving?")</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ['A', 'Buy now', 74, 'text-fork-a', 'Productive immediately; savings drop to UGX 500K.'],
              ['B', 'Save 3 more months', 81, 'text-fork-b', 'Keeps a buffer; ~3 months of slower work.'],
              ['C', 'Buy a cheaper model', 69, 'text-fork-c', 'Middle path; may need to upgrade later.'],
            ].map(([l, t, s, c, d]) => (
              <div key={l as string} className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-sm font-bold ${c}`}>fork {l}</span>
                  <span className="font-mono text-xs text-slate-500 dark:text-ink-300">fit {s}/100</span>
                </div>
                <p className="mt-1 font-semibold">{t}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-ink-300">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs text-slate-500 dark:text-ink-300">Illustrative output from the seeded demo. Your numbers will differ.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">One loop. Better decisions over time.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ fn, icon: Icon, title, body }) => (
            <div key={fn} className="card p-6">
              <div className="flex items-center justify-between">
                <Icon className="text-brand-500" size={22} />
                <span className="code">{fn}</span>
              </div>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-ink-300">{body}</p>
            </div>
          ))}
          <div className="card flex flex-col justify-between bg-gradient-to-br from-brand-500 to-fork-c p-6 text-white">
            <div>
              <span className="font-mono text-xs opacity-80">explore()</span>
              <h3 className="mt-4 font-bold">Start with a real question</h3>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {EXAMPLE_DECISIONS.slice(0, 4).map((d) => (
                <li key={d}>
                  <button onClick={() => tryExample(d)} className="text-left underline-offset-2 hover:underline">
                    {d}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-20 text-center sm:px-6">
        <div className="card p-8 sm:p-12">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Free to start. UGX 3,000 a week to go deeper.</h2>
          <p className="mx-auto mt-3 max-w-lg text-slate-600 dark:text-ink-300">
            5 trial simulations, then 3 free every day. Weekly unlocks more futures, custom what-if questions and richer insights — paid with MTN or Airtel Mobile Money.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/pricing" className="btn-ghost">
              See plans
            </Link>
            <Link to="/signup" className="btn-primary">
              Get started free
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
