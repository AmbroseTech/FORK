# FORK_

**An AI-powered personal decision simulator.**

> Don't just make a decision. See where it leads.

FORK takes a real decision — *"Should I buy a laptop now or keep saving?"*, *"Should I take this internship?"* — asks for the minimum useful context, and forks it into several plausible futures. Each future is projected month by month, scored against what you said matters, and laid out as a timeline you can compare. Change one assumption with `what_if()` and every future recalculates instantly. Save the fork, choose a path, and record what actually happened so FORK can learn your decision patterns.

FORK is **not** a chatbot, a financial adviser, or a fortune teller. It explores scenarios; it does not predict the future — and it says so on every screen.

Built for the **RevenueCat Shipaton 2026 · Next Gen Award**. Open source under MIT.

---

## The flow

```
decision → context → fork() → simulate() → compare() → what_if() → save_decision() → decide() → record_outcome()
```

| Step | What happens |
|---|---|
| **Decision** | Type it in plain words. No login wall. Categories: Money, Career, Education, Business, Relationships, Lifestyle. |
| **Context** | Pick 1–3 priorities. Optionally add savings, cost, income, expenses, goal and a time horizon. FORK shows analysis confidence and what's missing. |
| **Futures** | 2–4 scenario cards (e.g. *Buy now*, *Wait 6 weeks*, *Buy a cheaper model*) with a decision-fit score, metrics, projected & lowest balance. |
| **Compare** | Side-by-side table plus a month-by-month balance chart for all futures. |
| **Scenario detail** | Full timeline, advantages, trade-offs and a cautious trade-off explanation. |
| **what_if()** | Presets (“my income drops 20%”), sliders, or plain-language input. Numbers recalculate locally and instantly. |
| **Recommendation** | A cautious pick with reasons and a “watch out” — labelled *rule-based* or *Groq · llama-3.3-70b* so you always know the source. |
| **My Forks** | Saved decisions. Choose the path you took, then rate the outcome later (better / as expected / worse). |
| **Insights** | Local pattern detection: do you follow the recommendation? Do you favour safety or upside? How do outcomes compare? |

## Responsible AI, by design

- Every simulation screen carries: *“FORK explores possible scenarios. It does not predict the future.”*
- Medical, legal and high-stakes financial decisions trigger an explicit warning to consult a professional.
- Scores are shown as **estimated decision fit**, never as probability or certainty.
- Confidence (`LOW` / `MEDIUM` / `HIGH`) and *missing information* are surfaced alongside every result.
- Demo output is labelled **“demo · seeded data”** — it is never presented as live AI.
- All numeric projections are deterministic and computed on-device; AI is only used to interpret language, propose scenario seeds and phrase explanations.

## Quick start

```bash
git clone https://github.com/AmbroseTech/FORK.git
cd FORK
npm install --legacy-peer-deps
npx expo start          # press i / a / w for iOS simulator / Android / web
```

That's it — FORK runs fully offline in **demo mode** with seeded, rule-based scenarios. No API keys required.

### Enable live AI (Groq, free tier)

FORK uses [Groq](https://console.groq.com/keys) with an open model (`llama-3.3-70b-versatile` by default). Groq offers free API keys.

```bash
cp .env.example .env
# then edit .env:
EXPO_PUBLIC_DEMO_MODE=false
EXPO_PUBLIC_AI_PROVIDER=groq
EXPO_PUBLIC_GROQ_API_KEY=gsk_...
# optional: EXPO_PUBLIC_GROQ_MODEL=llama-3.1-8b-instant
```

All AI output is validated with **Zod** schemas before it touches the engine. If Groq is unreachable, rate-limited or returns invalid JSON, FORK falls back to the deterministic engine and tells you it did.

### Enable subscriptions (RevenueCat)

1. Create a project at [app.revenuecat.com](https://app.revenuecat.com).
2. Create products `fork_pro_monthly` and `fork_pro_yearly` and attach them to an entitlement `fork_pro` in a default offering.
3. Add the **public** SDK keys to `.env`:

```bash
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_...
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_...
```

4. Build a native app (`npx expo run:ios` / `npx expo run:android` or EAS). RevenueCat requires a native binary — on Expo Go/web the paywall explains this instead of faking a purchase.

| Free | FORK Pro |
|---|---|
| 3 active decisions | Unlimited decisions |
| 2 futures per decision | Up to 4 futures |
| Preset what-ifs | Plain-language what-ifs |
| Basic insights | Advanced decision patterns |

## Architecture

```
app/                      Expo Router screens
  (tabs)/                 home · forks · insights · profile
  simulate/               context form → cinematic running screen
  futures.tsx             cards / compare() view + recommendation
  scenario/[id].tsx       timeline + trade-offs
  whatif.tsx              presets · plain-language · sliders
  fork/[id].tsx           decide() + record_outcome()
  paywall.tsx             RevenueCat paywall
components/               UI primitives, ScenarioCard, Timeline, BalanceChart
features/
  simulation/engine.ts    deterministic projection, metrics, scoring, timeline, recompute()
  simulation/whatIf.ts    local natural-language what-if parser + presets
  simulation/store.ts     Zustand: draft, current simulation, overrides
  decisions/store.ts      Zustand + AsyncStorage: saved forks, decide, outcomes
  insights/patterns.ts    decision-pattern detection
services/
  ai/provider.ts          AIProvider interface + AIProviderError
  ai/demoProvider.ts      seeded, rule-based provider (offline)
  ai/groqProvider.ts      Groq (OpenAI-compatible HTTP) + Zod validation + fallbacks
  revenuecat/             react-native-purchases wrapper, isolated from UI
hooks/                    useSubscription, useHaptics
types/simulation.ts       Zod schemas + TypeScript types
```

**Key principle:** the AI proposes, the engine computes. `generateScenarios()` returns *seeds* (modifiers such as `costMultiplier`, `delayMonths`, `extraMonthlyIncome`); `buildSimulation()` turns them into month-by-month projections, metrics and timelines. `recompute(sim, overrides)` re-runs only the numeric part, which is why `what_if()` is instant and works offline.

```ts
interface AIProvider {
  readonly source: 'demo' | 'groq';
  analyzeDecision(input: DecisionInput): Promise<DecisionAnalysis>;
  generateScenarios(input: DecisionInput): Promise<ScenarioSeed[]>;
  explainTradeoffs(simulation: Simulation): Promise<string>;
  generateRecommendation(simulation: Simulation): Promise<Recommendation>;
  interpretWhatIf(text: string, ctx: DecisionContext): Promise<WhatIf | null>;
  generateInsight(forks: Fork[]): Promise<string>;
}
```

## Scripts

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (expo config, react-compiler rules)
npm test            # jest — simulation engine + what-if parser
```

## Demo script (≈ 60s)

1. Home → tap **“Should I buy a laptop now or save?”** → `simulate()`.
2. Context is pre-filled (UGX 2M savings, 1.5M laptop, 500K income, 280K expenses, 6 months). Confidence: HIGH. → `simulate()`.
3. Watch futures fork. Compare *Buy now* vs *Wait 6 weeks* vs *Buy a cheaper model*.
4. Tap `compare()` for the balance chart; open a scenario for its timeline.
5. `what_if()` → “my income decreases by 20%” — scores and balances shift live.
6. `save_decision()` → `choose_B()` → later `record_outcome()`.
7. Insights tab shows your emerging patterns. Profile → `upgrade()` shows the real RevenueCat paywall.

## Roadmap

- Scenario branching (fork a fork).
- Shareable “future cards”.
- Notifications to revisit a decision when its horizon ends.
- Voice-first decision entry.
- Localised currencies and languages.

## License

MIT — see [LICENSE](./LICENSE).
