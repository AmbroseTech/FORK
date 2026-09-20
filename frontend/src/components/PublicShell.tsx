import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { Disclaimer, Logo, ThemeToggle } from './ui';

export default function PublicShell() {
  const authed = useAuth((s) => Boolean(s.tokens));
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-[#f5f7fb]/80 backdrop-blur dark:border-white/10 dark:bg-ink-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex dark:text-ink-300">
            <Link to="/about" className="hover:text-slate-900 dark:hover:text-white">
              About
            </Link>
            <Link to="/pricing" className="hover:text-slate-900 dark:hover:text-white">
              Pricing
            </Link>
            <Link to="/support" className="hover:text-slate-900 dark:hover:text-white">
              Support
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {authed ? (
              <Link to="/app" className="btn-primary">
                Open FORK
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost hidden sm:inline-flex">
                  Log in
                </Link>
                <Link to="/signup" className="btn-primary">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200/60 dark:border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:text-ink-300">
          <div>
            <Logo size={20} />
            <Disclaimer className="mt-2" />
          </div>
          <nav className="flex flex-wrap gap-4">
            <Link to="/about">About</Link>
            <Link to="/legal/terms">Terms</Link>
            <Link to="/legal/privacy">Privacy</Link>
            <Link to="/support">Support</Link>
            <a href="https://github.com/AmbroseTech/FORK" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
