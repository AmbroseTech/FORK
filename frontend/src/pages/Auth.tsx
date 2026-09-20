import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Logo, Spinner } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import type { AuthResponse, MessageResponse } from '../lib/types';
import { useAuth } from '../store/auth';

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="glow flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="card animate-rise w-full max-w-md p-6 sm:p-8">
        <Link to="/" className="inline-block">
          <Logo />
        </Link>
        <h1 className="mt-6 text-2xl font-extrabold">{title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-ink-300">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password }, auth: false });
      setSession(r.user, r.tokens);
      navigate(from && from.startsWith('/app') ? from : '/app');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Welcome back" subtitle="Pick up where your last fork left off.">
      <form onSubmit={submit} className="space-y-4">
        {err && <Alert tone="error">{err}</Alert>}
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner /> : 'Log in'}
        </button>
        <div className="flex justify-between text-sm text-slate-500 dark:text-ink-300">
          <Link to="/forgot-password" className="hover:underline">
            Forgot password?
          </Link>
          <Link to="/signup" className="hover:underline">
            Create account
          </Link>
        </div>
      </form>
    </Shell>
  );
}

export function Signup() {
  const navigate = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const [form, setForm] = useState({ email: '', username: '', display_name: '', password: '', accept_terms: false, referral_code: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api<AuthResponse>('/api/auth/signup', {
        method: 'POST',
        body: { ...form, referral_code: form.referral_code || null },
        auth: false,
      });
      setSession(r.user, r.tokens);
      navigate('/app/fork');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <Shell title="Create your account" subtitle="5 free trial simulations, then 3 every day. No card needed.">
      <form onSubmit={submit} className="space-y-4">
        {err && <Alert tone="error">{err}</Alert>}
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={form.email} onChange={set('email')} autoComplete="email" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Username</label>
            <input className="input" required minLength={3} maxLength={32} pattern="[a-z0-9_]+" title="lowercase letters, numbers, underscores" value={form.username} onChange={set('username')} />
          </div>
          <div>
            <label className="label">Display name</label>
            <input className="input" value={form.display_name} onChange={set('display_name')} />
          </div>
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" required minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" />
        </div>
        <div>
          <label className="label">Referral code (optional)</label>
          <input className="input" value={form.referral_code} onChange={set('referral_code')} />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" required checked={form.accept_terms} onChange={set('accept_terms')} className="mt-1" />
          <span>
            I accept the{' '}
            <Link to="/legal/terms" className="underline" target="_blank">
              Terms
            </Link>{' '}
            and{' '}
            <Link to="/legal/privacy" className="underline" target="_blank">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner /> : 'Create account'}
        </button>
        <p className="text-center text-sm text-slate-500 dark:text-ink-300">
          Already have an account?{' '}
          <Link to="/login" className="underline">
            Log in
          </Link>
        </p>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [res, setRes] = useState<MessageResponse | null>(null);
  const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      setRes(await api<MessageResponse>('/api/auth/forgot-password', { method: 'POST', body: { email }, auth: false }));
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <Shell title="Reset your password" subtitle="We'll send a reset link if the email exists.">
      <form onSubmit={submit} className="space-y-4">
        {err && <Alert tone="error">{err}</Alert>}
        {res && (
          <Alert tone="success">
            {res.message}
            {res.dev_token && (
              <>
                {' '}
                <Link className="underline" to={`/reset-password?token=${encodeURIComponent(res.dev_token)}`}>
                  Dev mode: open reset link
                </Link>
              </>
            )}
          </Alert>
        )}
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <button className="btn-primary w-full">Send reset link</button>
        <Link to="/login" className="block text-center text-sm underline">
          Back to log in
        </Link>
      </form>
    </Shell>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/api/auth/reset-password', { method: 'POST', body: { token: params.get('token'), new_password: password }, auth: false });
      navigate('/login');
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <Shell title="Choose a new password" subtitle="At least 8 characters.">
      <form onSubmit={submit} className="space-y-4">
        {err && <Alert tone="error">{err}</Alert>}
        <input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <button className="btn-primary w-full">Update password</button>
      </form>
    </Shell>
  );
}

export function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState<'idle' | 'ok' | 'err'>('idle');
  const [msg, setMsg] = useState('');
  const verify = async () => {
    try {
      const r = await api<MessageResponse>('/api/auth/verify-email', { method: 'POST', body: { token: params.get('token') }, auth: false });
      setMsg(r.message);
      setState('ok');
    } catch (e) {
      setMsg(errorMessage(e));
      setState('err');
    }
  };
  return (
    <Shell title="Verify your email" subtitle="One click and you're done.">
      {state !== 'idle' && <Alert tone={state === 'ok' ? 'success' : 'error'}>{msg}</Alert>}
      <button className="btn-primary mt-4 w-full" onClick={verify} disabled={state === 'ok'}>
        Verify
      </button>
      <Link to="/app" className="mt-3 block text-center text-sm underline">
        Continue to FORK
      </Link>
    </Shell>
  );
}
