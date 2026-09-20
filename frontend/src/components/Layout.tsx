import { Bell, Compass, GitFork, Home, Lightbulb, LogOut, MessageCircle, Sparkles, User } from 'lucide-react';
import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { NotificationList } from '../lib/types';
import { guestAllowed, useRefreshUsage } from '../lib/ui';
import { useAuth } from '../store/auth';
import { Disclaimer, Logo, ThemeToggle } from './ui';
import { create } from 'zustand';

const NAV = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/fork', label: 'Fork', icon: GitFork },
  { to: '/app/explore', label: 'Explore', icon: Compass },
  { to: '/app/messages', label: 'Messages', icon: MessageCircle },
  { to: '/app/insights', label: 'Insights', icon: Lightbulb },
  { to: '/app/profile', label: 'Profile', icon: User },
];

const useUnread = create<{ unread: number; set: (n: number) => void }>((set) => ({ unread: 0, set: (unread) => set({ unread }) }));

export default function AppLayout() {
  const { user, usage, clear, tokens } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const refresh = useRefreshUsage();
  const { unread, set: setUnread } = useUnread();
  const guest = !tokens;

  useEffect(() => {
    if (!tokens) {
      if (!guestAllowed(pathname)) navigate('/login', { replace: true, state: { from: pathname } });
      return;
    }
    void refresh();
    api<NotificationList>('/api/notifications')
      .then((n) => setUnread(n.unread))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens, pathname]);

  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST', body: { refresh_token: tokens?.refresh_token } });
    } catch {
      /* ignore */
    }
    clear();
    navigate('/');
  };

  const remaining = usage ? usage.trial_remaining + usage.remaining_today : null;

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-slate-200 bg-white/60 p-4 backdrop-blur md:flex dark:border-white/10 dark:bg-ink-900/70">
        <Link to="/app" className="px-2">
          <Logo />
        </Link>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-ink-300 dark:hover:bg-white/5'
                }`
              }
            >
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          {guest && (
            <Link to="/signup" className="card block p-3 text-xs">
              <span className="font-semibold">Guest mode</span>
              <p className="mt-1 text-slate-500 dark:text-ink-300">Simulations run on-device. Sign up to save forks & get AI explanations.</p>
            </Link>
          )}
          {usage && (
            <Link to="/app/pricing" className="card block p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{usage.plan_name}</span>
                <Sparkles size={14} className="text-brand-400" />
              </div>
              <p className="mt-1 text-slate-500 dark:text-ink-300">
                {usage.plan_code === 'FREE' ? `${remaining} simulation${remaining === 1 ? '' : 's'} left` : 'Unlimited-ish · thanks!'}
              </p>
            </Link>
          )}
          <div className="flex items-center justify-between gap-2">
            <ThemeToggle />
            <Link to="/app/notifications" className="btn-ghost relative !px-2.5" aria-label="Notifications">
              <Bell size={16} />
              {unread > 0 && <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-fork-c px-1 text-[10px] font-bold text-white">{unread}</span>}
            </Link>
            {guest ? (
              <Link to="/login" className="btn-primary !px-3 text-xs">
                Log in
              </Link>
            ) : (
              <button onClick={logout} className="btn-ghost !px-2.5" aria-label="Log out">
                <LogOut size={16} />
              </button>
            )}
          </div>
          {user && <p className="truncate px-1 text-xs text-slate-500 dark:text-ink-300">@{user.username}</p>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/70 px-4 py-3 backdrop-blur md:hidden dark:border-white/10 dark:bg-ink-900/70">
          <Link to="/app">
            <Logo size={24} />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/app/notifications" className="btn-ghost relative !px-2.5" aria-label="Notifications">
              <Bell size={16} />
              {unread > 0 && <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-fork-c px-1 text-[10px] font-bold text-white">{unread}</span>}
            </Link>
          </div>
        </header>
        <main className="flex-1 pb-20 md:pb-0">
          {guest && (
            <div className="flex items-center justify-between gap-3 bg-brand-500/10 px-4 py-2 text-xs md:hidden">
              <span>Guest mode · on-device simulation</span>
              <Link to="/signup" className="font-semibold underline">
                Sign up free
              </Link>
            </div>
          )}
          <Outlet />
        </main>
        <footer className="hidden px-6 py-4 md:block">
          <Disclaimer />
        </footer>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-slate-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-white/10 dark:bg-ink-900/90">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${isActive ? 'text-brand-600 dark:text-brand-300' : 'text-slate-500 dark:text-ink-300'}`
            }
          >
            <Icon size={20} /> {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
