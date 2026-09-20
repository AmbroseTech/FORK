# FORK

**Don't just make a decision. See where it leads.**

FORK is a decision-exploration platform. Describe a real decision, add your
context and priorities, and FORK builds several plausible futures you can
compare, stress-test with what-if experiments, save, and revisit once you know
how things actually turned out.

> FORK explores possible outcomes. It does not predict the future.

```
DECISION → CONTEXT → SCENARIOS → TRADE-OFFS → WHAT-IF → INSIGHTS → DECISION
```

## Stack

| Layer     | Tech                                                                 |
| --------- | -------------------------------------------------------------------- |
| Frontend  | React 19, Vite, TypeScript, Tailwind CSS v4, Zustand, PWA-ready      |
| Backend   | FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, PyJWT, bcrypt           |
| Data      | PostgreSQL (source of truth), Redis (cache / rate limits / counters) |
| AI        | Gemini free tier by default → deterministic demo fallback. Groq and OpenAI-compatible providers are optional. |
| Payments  | MTN / Airtel Mobile Money abstraction (handset authorization, PIN never touches FORK). Cards: coming soon. |
| Infra     | Dockerfiles, Docker Compose (frontend + backend + Postgres + Redis), GitHub Actions |

## Quick start (Docker)

```bash
cp .env.example .env          # optional — everything works with defaults
docker compose up --build
```

- App: http://localhost:8080
- API: http://localhost:8000 (`/health`, `/health/ready`, `/docs`)

Migrations run automatically when the backend container starts
(`RUN_MIGRATIONS=false` to disable).

## Local development

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
# Postgres + Redis (or use `docker compose up postgres redis`)
alembic upgrade head
uvicorn app.main:app --reload
```

Redis is optional locally: if it is unreachable the backend falls back to an
in-process cache.

### Frontend

```bash
cd frontend
npm ci
npm run dev                    # http://localhost:5173, proxies /api → :8000
```

The simulator also works **without an account or backend**: guests get a fully
local deterministic simulation. Signing in unlocks saved Forks, outcomes,
insights, and server-side usage limits.

## AI providers

- `AI_PROVIDER=gemini` is the default and uses the **free** Gemini tier.
- No key is required. If `GEMINI_API_KEY` is empty, or any Gemini call fails or
  times out, FORK transparently uses `DEMO_MODE` deterministic responses and
  labels them as such in the UI.
- `groq` (`llama-3.3-70b-versatile`) and `openai` (any OpenAI-compatible
  endpoint) are optional alternatives. OpenAI is never required.
- All provider keys live only in backend environment variables. The React app
  only ever talks to `/api/*`.
- Every number (balances, runway, goal progress, scores) is produced by the
  deterministic engine, never by an LLM. The AI only phrases scenario
  narratives, recommendation reasoning, what-if interpretations and insights.

## Plans & usage (enforced server-side)

| Plan   | Price            | Simulations                        | Extras                          |
| ------ | ---------------- | ---------------------------------- | ------------------------------- |
| Free   | UGX 0            | 5 introductory trials, then 3/day  | Local what-if presets           |
| Weekly | UGX 3,000 / week | 30 / day                           | Custom AI what-ifs, AI insights |
| Pro    | configurable     | 60 / day                           | Everything in Weekly + priority |

## Payments

Mobile Money (MTN, Airtel) via `POST /api/payments/initiate` →
provider handset prompt → `verify` / signed webhook → subscription activated
**only after verified success**. Payments are idempotent per
`(user, idempotency_key)`, expire after `PAYMENT_EXPIRY_MINUTES`, and are
tracked through `PENDING → PROCESSING → SUCCESS | FAILED | CANCELLED | EXPIRED`.

FORK never asks for, collects, transmits, stores, hashes, logs or analyzes a
Mobile Money PIN. `PAYMENTS_DEMO=true` (default) simulates the provider so the
full checkout can be exercised locally; the demo payment can be approved or
declined from the checkout page.

## API overview

| Area      | Endpoints                                                                                     |
| --------- | --------------------------------------------------------------------------------------------- |
| Health    | `GET /health`, `GET /health/ready`                                                            |
| Auth      | `POST /api/auth/{signup,login,refresh,logout,logout-all,forgot-password,reset-password,change-password,send-verification,verify-email}`, `GET /api/auth/me` |
| Profiles  | `GET/PATCH /api/profiles/me`, `GET /api/users/{username}`, `DELETE /api/users/me`             |
| Simulate  | `POST /api/simulate/seed` (consumes one simulation), `POST /api/simulate/recommend`           |
| Decisions | `GET/POST /api/decisions`, `GET/PATCH/DELETE /api/decisions/{id}`, `POST .../decide`, `POST .../outcome`, `POST .../what-if` |
| What-if   | `POST /api/what-if/interpret`                                                                 |
| Insights  | `GET /api/insights` (stored decision data only; returns an insufficient-data state honestly)  |
| Billing   | `GET /api/plans`, `GET /api/usage`, `GET /api/payments/methods`, `POST /api/payments/initiate`, `GET /api/payments`, `GET /api/payments/{id}`, `POST /api/payments/{id}/{verify,cancel,demo-confirm}`, `POST /api/payments/webhooks/{provider}` |
| Misc      | `GET /api/notifications`, `POST /api/notifications/read-all`, `POST /api/notifications/{id}/read`, `GET /api/admin/overview` (admin) |

## Checks

```bash
# frontend
cd frontend && npm run typecheck && npm run lint && npm test && npm run build
# backend
cd backend && ruff check app tests alembic && mypy app && pytest -q
```

## Roadmap (later phases)

Public forks & explore feed, follows, messaging, media uploads, voice/video
(WebRTC), push notifications, referrals, business & portfolio profiles, and the
admin panel. Database models for several of these already exist; the UI shows
them as "coming soon".

## License

MIT — see [LICENSE](LICENSE).
