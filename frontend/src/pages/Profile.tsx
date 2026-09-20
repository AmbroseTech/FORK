import { Copy, LogOut, Save, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Page, ThemeToggle } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import type { MessageResponse, Profile as ProfileT, User } from '../lib/types';
import { useAuth } from '../store/auth';
import { useSim } from '../store/sim';

type Form = Pick<ProfileT, 'display_name' | 'bio' | 'avatar_url' | 'location' | 'visibility'> & { interests: string; skills: string };

const empty: Form = { display_name: '', bio: '', avatar_url: '', location: '', visibility: 'PUBLIC', interests: '', skills: '' };

function fromProfile(p: ProfileT | null): Form {
  if (!p) return empty;
  return {
    display_name: p.display_name,
    bio: p.bio,
    avatar_url: p.avatar_url ?? '',
    location: p.location ?? '',
    visibility: p.visibility,
    interests: p.interests.join(', '),
    skills: p.skills.join(', '),
  };
}

function split(s: string) {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export default function Profile() {
  const { user, setUser, clear } = useAuth();
  const resetSim = useSim((s) => s.resetAll);
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(() => fromProfile(user?.profile ?? null));
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pw, setPw] = useState({ current_password: '', new_password: '' });
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const profile = await api<ProfileT>('/api/profiles/me', {
        method: 'PATCH',
        body: { ...form, avatar_url: form.avatar_url || null, location: form.location || null, interests: split(form.interests), skills: split(form.skills) },
      });
      if (user) setUser({ ...user, profile });
      setMsg({ tone: 'success', text: 'Profile saved.' });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<MessageResponse>('/api/auth/change-password', { method: 'POST', body: pw });
      setMsg({ tone: 'success', text: r.message });
      setPw({ current_password: '', new_password: '' });
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const sendVerify = async () => {
    try {
      const r = await api<MessageResponse>('/api/auth/send-verification', { method: 'POST' });
      setMsg({ tone: 'success', text: r.dev_token ? `${r.message} Dev token: ${r.dev_token}` : r.message });
      if (r.dev_token) navigate(`/verify-email?token=${r.dev_token}`);
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  };

  const logoutAll = async () => {
    await api('/api/auth/logout-all', { method: 'POST' }).catch(() => undefined);
    clear();
    resetSim();
    navigate('/');
  };

  const deleteAccount = async () => {
    if (!confirm('Delete your account and all saved forks? This cannot be undone.')) return;
    try {
      await api('/api/users/me', { method: 'DELETE' });
      clear();
      resetSim();
      navigate('/');
    } catch (e) {
      setMsg({ tone: 'error', text: errorMessage(e) });
    }
  };

  if (!user) return null;
  const u: User = user;
  const field = (k: keyof Form) => ({ value: form[k] ?? '', onChange: (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <Page title="Profile & settings" subtitle={`@${u.username} · ${u.email}${u.email_verified ? '' : ' · unverified'}`}>
      <div className="grid gap-4 lg:grid-cols-3">
        <form onSubmit={save} className="card space-y-4 p-6 lg:col-span-2">
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-fork-c text-2xl font-extrabold text-white">
              {form.avatar_url ? <img src={form.avatar_url} alt="" className="h-full w-full object-cover" /> : (form.display_name || u.username)[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <label className="label">Display name</label>
              <input className="input" maxLength={64} {...field('display_name')} />
            </div>
          </div>
          <div>
            <label className="label">Bio</label>
            <textarea className="input min-h-20" maxLength={600} {...field('bio')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Avatar URL</label>
              <input className="input" placeholder="https://…" {...field('avatar_url')} />
            </div>
            <div>
              <label className="label">Location (optional)</label>
              <input className="input" placeholder="Kampala" {...field('location')} />
            </div>
            <div>
              <label className="label">Interests (comma separated)</label>
              <input className="input" placeholder="business, education" {...field('interests')} />
            </div>
            <div>
              <label className="label">Skills (comma separated)</label>
              <input className="input" placeholder="design, accounting" {...field('skills')} />
            </div>
            <div>
              <label className="label">Profile visibility</label>
              <select className="input" {...field('visibility')}>
                <option value="PUBLIC">Public</option>
                <option value="CONNECTIONS">Connections only</option>
                <option value="PRIVATE">Private</option>
              </select>
            </div>
            <div>
              <label className="label">Appearance</label>
              <ThemeToggle className="btn-ghost w-full justify-center" />
            </div>
          </div>
          <button className="btn-primary" disabled={busy}>
            <Save size={14} /> Save profile
          </button>
        </form>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold">Referral code</h3>
            <div className="mt-2 flex items-center gap-2">
              <code className="input flex-1 font-mono text-sm">{u.referral_code}</code>
              <button className="btn-ghost" type="button" onClick={() => navigator.clipboard.writeText(u.referral_code)}>
                <Copy size={14} />
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-ink-300">Share it with friends when they sign up. Rewards land in a later release.</p>
          </div>
          {!u.email_verified && (
            <div className="card p-5">
              <h3 className="font-bold">Verify your email</h3>
              <button className="btn-ghost mt-2 w-full text-xs" type="button" onClick={sendVerify}>
                Send verification link
              </button>
            </div>
          )}
          <form onSubmit={changePw} className="card space-y-3 p-5">
            <h3 className="font-bold">Change password</h3>
            <input className="input" type="password" placeholder="Current password" required value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
            <input className="input" type="password" placeholder="New password (8+ chars)" required minLength={8} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
            <button className="btn-ghost w-full text-xs" disabled={busy}>
              Update password
            </button>
          </form>
          <div className="card space-y-2 p-5">
            <button className="btn-ghost w-full text-xs" type="button" onClick={logoutAll}>
              <LogOut size={14} /> Log out of all devices
            </button>
            <button className="btn-danger w-full text-xs" type="button" onClick={deleteAccount}>
              <Trash2 size={14} /> Delete account
            </button>
          </div>
        </div>
      </div>
    </Page>
  );
}
