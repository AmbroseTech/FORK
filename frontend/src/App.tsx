import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/Layout';
import PublicShell from './components/PublicShell';
import { Logo, Spinner } from './components/ui';
import { ForgotPassword, Login, ResetPassword, Signup, VerifyEmail } from './pages/Auth';
import Landing from './pages/Landing';
import { About, ComingSoon, Legal, NotFound, Support } from './pages/Static';
import { useTheme } from './store/theme';

const Home = lazy(() => import('./pages/Home'));
const Fork = lazy(() => import('./pages/Fork'));
const Futures = lazy(() => import('./pages/Futures'));
const ScenarioDetail = lazy(() => import('./pages/ScenarioDetail'));
const WhatIf = lazy(() => import('./pages/WhatIf'));
const History = lazy(() => import('./pages/History'));
const ForkDetail = lazy(() => import('./pages/ForkDetail'));
const Insights = lazy(() => import('./pages/Insights'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Profile = lazy(() => import('./pages/Profile'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Explore = lazy(() => import('./pages/Explore'));

function Splash() {
  return (
    <div className="glow flex min-h-dvh flex-col items-center justify-center gap-4">
      <Logo size={40} />
      <p className="text-sm text-slate-500 dark:text-ink-300">Don't just make a decision. See where it leads.</p>
      <Spinner className="text-brand-400" />
    </div>
  );
}

export default function App() {
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  useEffect(() => {
    setTheme(theme);
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, [theme, setTheme]);

  return (
    <BrowserRouter>
      <Suspense fallback={<Splash />}>
        <Routes>
          <Route element={<PublicShell />}>
            <Route path="/" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/support" element={<Support />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/legal/:doc" element={<Legal />} />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Home />} />
            <Route path="fork" element={<Fork />} />
            <Route path="futures" element={<Futures />} />
            <Route path="futures/:scenarioId" element={<ScenarioDetail />} />
            <Route path="whatif" element={<WhatIf />} />
            <Route path="history" element={<History />} />
            <Route path="history/:id" element={<ForkDetail />} />
            <Route path="history/:id/scenario/:scenarioId" element={<ForkDetail />} />
            <Route path="insights" element={<Insights />} />
            <Route path="explore" element={<Explore />} />
            <Route path="messages" element={<ComingSoon title="Messages" body="Private conversations, sharing forks with friends and group decisions are planned for a later release." />} />
            <Route path="pricing" element={<Pricing embedded />} />
            <Route path="checkout/:planCode" element={<Checkout />} />
            <Route path="profile" element={<Profile />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
          <Route path="/home" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
