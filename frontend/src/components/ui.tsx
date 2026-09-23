import { FORK_BG } from '../lib/ui';
import { Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../store/theme';

export function Logo({ size = 28, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-extrabold tracking-tight">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="14" className="fill-ink-900 dark:fill-ink-700" />
        <path d="M32 52V34M32 34L18 16M32 34L46 16" stroke="#7c9cff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="18" cy="14" r="5" fill="#34d399" />
        <circle cx="46" cy="14" r="5" fill="#f472b6" />
      </svg>
      {withText && <span className="text-lg">FORK</span>}
    </span>
  );
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const toggle = useTheme((s) => s.toggle);
  return (
    <button type="button" onClick={toggle} className={`btn-ghost !px-2.5 ${className}`} aria-label="Toggle theme">
      <Sun size={16} className="hidden dark:block" />
      <Moon size={16} className="dark:hidden" />
    </button>
  );
}

export function Disclaimer({ className = '' }: { className?: string }) {
  return <p className={`text-xs text-slate-500 dark:text-ink-300 ${className}`}>FORK explores possible outcomes. It does not predict the future.</p>;
}

export function SourceBadge({ source, local }: { source: string; local?: boolean }) {
  const demo = source === 'demo';
  return (
    <span
      className={`chip ${demo ? 'border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300' : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300'}`}
      title={demo ? 'Scenario seeds come from deterministic templates' : `Scenario text from ${source}; all numbers computed locally`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${demo ? 'bg-amber-400' : 'bg-emerald-400'}`} />
      {demo ? (local ? 'demo · offline' : 'demo mode') : `live · ${source}`}
    </span>
  );
}

export function Page({ title, subtitle, action, children, className = '' }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`animate-rise mx-auto w-full max-w-5xl px-4 pt-6 pb-28 sm:px-6 md:pb-12 ${className}`}>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-ink-300">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}

export function Empty({ title, body, cta }: { title: string; body: string; cta?: { to: string; label: string } }) {
  return (
    <div className="card flex flex-col items-center p-10 text-center">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-ink-300">{body}</p>
      {cta && (
        <Link to={cta.to} className="btn-primary mt-5">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success' | 'warn'; children: ReactNode }) {
  const styles = {
    info: 'border-brand-400/30 bg-brand-500/10 text-brand-700 dark:text-brand-300',
    error: 'border-rose-400/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    warn: 'border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  }[tone];
  return <div className={`rounded-xl border px-3.5 py-2.5 text-sm ${styles}`}>{children}</div>;
}


export function ScoreBar({ value, index = 0, label }: { value: number; index?: number; label?: string }) {
  return (
    <div>
      {label && (
        <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-ink-300">
          <span>{label}</span>
          <span className="font-mono">{Math.round(value)}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
        <div className={`h-full rounded-full ${FORK_BG[index % 4]} transition-all duration-700`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
