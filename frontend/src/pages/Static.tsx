import { Link, useParams } from 'react-router-dom';
import { Page } from '../components/ui';

export function About() {
  return (
    <Page title="About FORK" subtitle="A decision-exploration tool, not a fortune teller.">
      <div className="prose-sm max-w-2xl space-y-4 text-slate-700 dark:text-ink-100">
        <p>
          Most tools help you <em>pick</em>. FORK helps you <em>see</em>. You describe a real decision, add the context you know (savings, income, costs, goals, time horizon) and FORK
          builds several plausible futures you can compare side by side.
        </p>
        <p>
          The numbers are deterministic: the same inputs always produce the same projections, so a what-if experiment shows you the effect of the change and nothing else. AI
          (when enabled) only proposes scenario shapes and explains trade-offs in plain language — it never does the arithmetic.
        </p>
        <h3 className="font-bold">Responsible by design</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li>FORK explores possible outcomes. It does not predict the future.</li>
          <li>Insights are computed only from decisions you actually saved and outcomes you recorded.</li>
          <li>Medical, legal and high-risk financial decisions show an explicit reminder to consult a qualified professional.</li>
          <li>The app works fully offline in demo mode; no AI key, card or account is needed to try it.</li>
        </ul>
        <h3 className="font-bold">Built in Uganda for people everywhere</h3>
        <p>Prices are in UGX and payments use Mobile Money because that is what our first users have. Currency and payment options will grow with the community.</p>
        <p>
          <a className="text-brand-600 dark:text-brand-300" href="https://github.com/AmbroseTech/FORK" target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
        </p>
      </div>
    </Page>
  );
}

export function Support() {
  return (
    <Page title="Support" subtitle="We read everything.">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ['Getting started', 'Create a free account, describe a decision and press simulate(). You get 5 trial runs, then 3 per day.'],
          ['Payments', 'Weekly access is UGX 3,000 via MTN or Airtel Mobile Money. You approve the payment on your own phone; FORK never asks for your PIN.'],
          ['Demo mode', 'If you see a "demo mode" badge, scenario text comes from seeded templates rather than AI. All numbers are still real projections of your inputs.'],
          ['Privacy & data', 'Delete your account any time from Profile → Danger zone. Decisions are soft-deleted immediately and purged on schedule.'],
        ].map(([t, b]) => (
          <div key={t} className="card p-5">
            <h3 className="font-bold">{t}</h3>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-ink-300">{b}</p>
          </div>
        ))}
      </div>
      <div className="card mt-6 p-5 text-sm">
        Email <a className="text-brand-600 dark:text-brand-300" href="mailto:support@fork.app">support@fork.app</a> or open an issue on{' '}
        <a className="text-brand-600 dark:text-brand-300" href="https://github.com/AmbroseTech/FORK/issues" target="_blank" rel="noreferrer">
          GitHub
        </a>
        . See also <Link to="/legal/terms" className="underline">Terms</Link> and <Link to="/legal/privacy" className="underline">Privacy</Link>.
      </div>
    </Page>
  );
}

export const TERMS_VERSION = '2026-09';

export function Legal() {
  const { doc } = useParams();
  const privacy = doc === 'privacy';
  return (
    <Page title={privacy ? 'Privacy Policy' : 'Terms of Service'} subtitle={`Version ${TERMS_VERSION}`}>
      <div className="max-w-2xl space-y-4 text-sm text-slate-700 dark:text-ink-100">
        {privacy ? (
          <>
            <p>
              <strong>What we store.</strong> Your account (email, username, hashed password), profile fields you fill in, the decisions and scenarios you save, what-if experiments,
              outcomes you record, and payment records (provider, masked phone number, amount, status).
            </p>
            <p>
              <strong>What we never store.</strong> Mobile Money PINs, full card numbers or CVVs. Payment authorisation happens on your handset with your provider. AI provider keys live
              only on our servers.
            </p>
            <p>
              <strong>AI processing.</strong> When live AI is enabled, the text of your decision and a numeric summary of scenarios may be sent to the configured provider (Gemini by
              default) to generate scenario descriptions and explanations. In demo mode nothing is sent to any AI.
            </p>
            <p>
              <strong>Your controls.</strong> Export or delete your data from Profile at any time. Deleting your account soft-deletes your data immediately and purges it within 30
              days.
            </p>
          </>
        ) : (
          <>
            <p>
              <strong>1. Nature of the service.</strong> FORK is an exploration tool. Scenarios, projections, recommendations and insights are illustrative and depend entirely on the
              inputs you provide. FORK does not provide financial, legal, medical or professional advice and does not predict the future.
            </p>
            <p>
              <strong>2. Accounts.</strong> You must provide accurate information and keep your credentials secure. You are responsible for activity under your account.
            </p>
            <p>
              <strong>3. Plans and payments.</strong> Free usage includes trial and daily allowances that may change. Paid plans are billed per period in UGX via supported Mobile Money
              providers. Access is activated only after the provider confirms payment. Refunds follow the provider's rules and applicable law.
            </p>
            <p>
              <strong>4. Acceptable use.</strong> No abuse, scraping, reverse engineering of AI prompts, or use for unlawful purposes.
            </p>
            <p>
              <strong>5. Liability.</strong> To the maximum extent permitted by law, FORK is provided "as is" without warranties, and we are not liable for decisions you make based on
              the service.
            </p>
            <p>
              <strong>6. Changes.</strong> We may update these terms; the version you accepted is recorded on your account and you will be asked to accept material changes.
            </p>
          </>
        )}
      </div>
    </Page>
  );
}

export function NotFound() {
  return (
    <Page title="404 — this fork doesn't exist" subtitle="The path you followed leads nowhere.">
      <Link to="/" className="btn-primary">
        Back home
      </Link>
    </Page>
  );
}

export function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <Page title={title} subtitle="Coming soon">
      <div className="card p-8 text-center">
        <p className="text-slate-600 dark:text-ink-300">{body}</p>
        <Link to="/app/fork" className="btn-primary mt-6">
          Simulate a decision instead
        </Link>
      </div>
    </Page>
  );
}
