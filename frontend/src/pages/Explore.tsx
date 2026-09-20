import { ArrowRight, Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../components/ui';
import type { Priority } from '../engine/types';
import { useSim } from '../store/sim';

const GALLERY: { title: string; category: string; priorities: Priority[]; blurb: string }[] = [
  { title: 'Should I buy a laptop now or keep saving?', category: 'Money', priorities: ['money', 'education'], blurb: 'The classic buffer-vs-productivity fork.' },
  { title: 'Should I take this internship offer?', category: 'Career', priorities: ['career', 'money'], blurb: 'Experience now vs. income and time.' },
  { title: 'Should I move closer to campus?', category: 'Lifestyle', priorities: ['convenience', 'money'], blurb: 'Rent, commute time and focus.' },
  { title: 'Should I start my business now or after graduating?', category: 'Business', priorities: ['business', 'career'], blurb: 'Momentum versus a safer runway.' },
  { title: 'Should I enroll in the data science bootcamp?', category: 'Education', priorities: ['education', 'career'], blurb: 'Upfront cost against future options.' },
  { title: 'Should I switch from my full-time job to freelancing?', category: 'Career', priorities: ['money', 'lifestyle', 'career'], blurb: 'Income variance vs. freedom.' },
];

export default function Explore() {
  const setDraft = useSim((s) => s.setDraft);
  const navigate = useNavigate();
  return (
    <Page
      title={
        <>
          <span className="code">explore()</span> decisions
        </>
      }
      subtitle="Template forks to start from. Community-shared forks, profiles and connections arrive in a later release."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GALLERY.map((g) => (
          <button
            key={g.title}
            onClick={() => {
              setDraft({ decision: g.title, priorities: g.priorities });
              navigate('/app/fork');
            }}
            className="card flex flex-col p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span className="chip w-fit border-slate-200 text-xs dark:border-white/10">{g.category}</span>
            <h3 className="mt-3 font-bold">{g.title}</h3>
            <p className="mt-1 flex-1 text-sm text-slate-500 dark:text-ink-300">{g.blurb}</p>
            <span className="mt-4 flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-300">
              simulate this <ArrowRight size={12} />
            </span>
          </button>
        ))}
      </div>
      <div className="card mt-6 flex items-center gap-3 p-5 text-sm text-slate-500 dark:text-ink-300">
        <Compass size={18} className="shrink-0 text-brand-400" />
        Public forks, follows and connections are planned. Your saved forks stay private until you choose to share.
      </div>
    </Page>
  );
}
