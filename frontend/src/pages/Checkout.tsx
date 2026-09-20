import { Check, Lock, ShieldCheck, Smartphone, X } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { formatUGX, useRefreshUsage } from '../lib/ui';
import { Alert, Page, Spinner } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import type { Payment, PaymentMethod, Plan } from '../lib/types';

const STATUS_TEXT: Record<Payment['status'], string> = {
  PENDING: 'Waiting for provider…',
  PROCESSING: 'Check your phone and approve the payment prompt.',
  SUCCESS: 'Payment confirmed. Your plan is active.',
  FAILED: 'The payment did not go through.',
  CANCELLED: 'You cancelled this payment.',
  EXPIRED: 'The request expired before it was approved.',
  REFUNDED: 'This payment was refunded.',
};

export default function Checkout() {
  const { planCode = '' } = useParams();
  const refreshUsage = useRefreshUsage();
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [provider, setProvider] = useState<'MTN' | 'AIRTEL'>('MTN');
  const [phone, setPhone] = useState('');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [instructions, setInstructions] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [idem] = useState(() => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    api<Plan[]>('/api/plans', { auth: false })
      .then((ps) => setPlan(ps.find((p) => p.code === planCode) ?? null))
      .catch(() => setPlan(null));
    api<PaymentMethod[]>('/api/payments/methods').then(setMethods).catch(() => undefined);
  }, [planCode]);

  useEffect(() => {
    if (!payment || !['PENDING', 'PROCESSING'].includes(payment.status)) return;
    const t = setInterval(() => {
      api<Payment>(`/api/payments/${payment.id}/verify`, { method: 'POST' })
        .then((p) => {
          setPayment(p);
          if (p.status === 'SUCCESS') void refreshUsage();
        })
        .catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.id, payment?.status]);

  if (plan === null) return <Navigate to="/app/pricing" replace />;
  if (!plan)
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );

  const initiate = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ payment: Payment; instructions: string }>('/api/payments/initiate', {
        method: 'POST',
        body: { plan_code: plan.code, provider, phone, idempotency_key: idem },
      });
      setPayment(r.payment);
      setInstructions(r.instructions);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const demoConfirm = async (approve: boolean) => {
    if (!payment) return;
    setBusy(true);
    try {
      const p = await api<Payment>(`/api/payments/${payment.id}/demo-confirm`, { method: 'POST', body: { approve } });
      setPayment(p);
      if (p.status === 'SUCCESS') await refreshUsage();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!payment) return;
    try {
      setPayment(await api<Payment>(`/api/payments/${payment.id}/cancel`, { method: 'POST' }));
    } catch (e) {
      setErr(errorMessage(e));
    }
  };

  return (
    <Page title={`Checkout · ${plan.name}`} subtitle={`${formatUGX(plan.price_minor, plan.currency)} for ${plan.duration_days} days. Activates only after your provider confirms payment.`}>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!payment ? (
            <form onSubmit={initiate} className="card space-y-5 p-6">
              {err && <Alert tone="error">{err}</Alert>}
              <div>
                <label className="label">Payment method</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {methods.map((m) => {
                    const on = m.enabled && provider === m.id;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        disabled={!m.enabled}
                        onClick={() => m.enabled && setProvider(m.id as 'MTN' | 'AIRTEL')}
                        className={`flex items-center justify-between rounded-xl border p-3 text-left text-sm transition disabled:opacity-50 ${
                          on ? 'border-brand-500 bg-brand-500/10' : 'border-slate-200 dark:border-white/10'
                        }`}
                      >
                        <span>
                          <span className="font-semibold">{m.label}</span>
                          <span className="block text-xs text-slate-500 dark:text-ink-300">{m.note}</span>
                        </span>
                        {on && <Check size={16} className="text-brand-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="label">Mobile Money number</label>
                <input className="input" inputMode="tel" required placeholder="0772 123 456" value={phone} onChange={(e) => setPhone(e.target.value)} minLength={9} maxLength={16} />
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-ink-300">
                  <Lock size={12} /> You'll approve on your handset. We never ask for your PIN.
                </p>
              </div>
              <button className="btn-primary w-full !py-3" disabled={busy || !phone}>
                {busy ? <Spinner /> : <Smartphone size={16} />} Pay {formatUGX(plan.price_minor, plan.currency)}
              </button>
            </form>
          ) : (
            <div className="card space-y-4 p-6">
              <div className="flex items-center gap-3">
                {['PENDING', 'PROCESSING'].includes(payment.status) ? (
                  <Spinner className="text-brand-400" />
                ) : payment.status === 'SUCCESS' ? (
                  <Check className="text-fork-b" />
                ) : (
                  <X className="text-fork-c" />
                )}
                <div>
                  <p className="font-bold">{payment.status.toLowerCase()}</p>
                  <p className="text-sm text-slate-600 dark:text-ink-300">{STATUS_TEXT[payment.status]}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-slate-500 dark:text-ink-300">Provider</dt>
                <dd>{payment.provider}</dd>
                <dt className="text-slate-500 dark:text-ink-300">Phone</dt>
                <dd className="font-mono">{payment.payer_phone_masked}</dd>
                <dt className="text-slate-500 dark:text-ink-300">Amount</dt>
                <dd>{formatUGX(payment.amount_minor, payment.currency)}</dd>
                <dt className="text-slate-500 dark:text-ink-300">Reference</dt>
                <dd className="truncate font-mono text-xs">{payment.id}</dd>
              </dl>
              {payment.failure_reason && <Alert tone="error">{payment.failure_reason}</Alert>}
              {instructions && payment.status === 'PROCESSING' && <Alert tone="info">{instructions}</Alert>}
              {payment.is_demo && payment.status === 'PROCESSING' && (
                <div className="rounded-xl border border-dashed border-amber-400/50 p-4">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Sandbox handset — simulate what you would tap on your phone:</p>
                  <div className="mt-2 flex gap-2">
                    <button className="btn-primary text-xs" disabled={busy} onClick={() => demoConfirm(true)}>
                      Approve
                    </button>
                    <button className="btn-danger text-xs" disabled={busy} onClick={() => demoConfirm(false)}>
                      Decline
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {['PENDING', 'PROCESSING'].includes(payment.status) && (
                  <button className="btn-ghost text-xs" onClick={cancel}>
                    Cancel payment
                  </button>
                )}
                {payment.status === 'SUCCESS' && (
                  <Link to="/app/fork" className="btn-primary text-xs">
                    Start simulating
                  </Link>
                )}
                {['FAILED', 'CANCELLED', 'EXPIRED'].includes(payment.status) && (
                  <button className="btn-ghost text-xs" onClick={() => setPayment(null)}>
                    Try again
                  </button>
                )}
              </div>
              {err && <Alert tone="error">{err}</Alert>}
            </div>
          )}
        </div>
        <aside className="card h-fit space-y-3 p-5 text-sm">
          <h3 className="flex items-center gap-2 font-bold">
            <ShieldCheck size={16} className="text-fork-b" /> How this stays safe
          </h3>
          <ul className="space-y-2 text-slate-600 dark:text-ink-300">
            <li>· Payment is authorised on your phone by MTN / Airtel.</li>
            <li>· FORK stores only a masked number, amount and status.</li>
            <li>· Your plan activates only after the provider confirms success.</li>
            <li>· Requests expire automatically if not approved.</li>
          </ul>
          <Link to="/app/pricing" className="block text-xs underline">
            Back to plans
          </Link>
        </aside>
      </div>
    </Page>
  );
}
