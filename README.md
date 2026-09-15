# Velocity — AI marketing on autopilot

Production-grade codebase implementing the Fastlane-clone requirements specification (modules M1–M22, excluding M17).
URL → Company Profile → batch short-form content → Blitz swipe approval → native scheduling/publishing → analytics + attribution,
plus automations, trends, AI characters, credits/billing, team, API/MCP, affiliates and admin.

## Quick start (local, mock mode — no external keys needed)

```bash
cp .env.example .env            # defaults already point at docker services
docker compose up --build       # postgres(pgvector) + redis + minio + app + worker
# open http://localhost:3000 → Get started → enter your email
# the magic-link is printed in the app container log:  docker compose logs -f app | grep magic-link
```

Then paste any website URL on the onboarding screen. In mock mode the crawler is real, but the LLM returns fixtures,
AI UGC videos are rendered as captioned preview cards, "connecting" a social account creates a sandbox account, and
"publishing" returns example permalinks with synthetic metrics — so the entire loop is exercisable without credentials.

### Running without Docker

```bash
npm ci
# start Postgres 16 with pgvector and Redis 7; set DATABASE_URL / REDIS_URL in .env
# STORAGE_DRIVER=local keeps media on disk under .media/ (served at /media/*) — no S3/MinIO needed for development
npm run db:migrate && npm run db:seed
npm run dev          # Next.js app on :3000
npm run worker       # BullMQ worker (separate process) — required for generation/publishing
```
ffmpeg and ffprobe must be on PATH for the worker (the Dockerfile installs them).

## Going live

Set `PROVIDER_MODE=live` and fill in the keys for the providers you want:

| Capability | Env vars | Notes |
|---|---|---|
| Copywriting + profile analysis | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Without a key, fixtures are used |
| JS-heavy site crawling | `FIRECRAWL_API_KEY` | Native fetch is tried first |
| Voice for AI UGC | `ELEVENLABS_API_KEY` | Character `voice_id` used when set |
| Talking-head video | `VIDEO_PROVIDER_URL`, `VIDEO_PROVIDER_KEY` | Any HTTP endpoint implementing the contract in `src/lib/render/index.ts` (`talkingHead`). Wire HeyGen/Hedra/Sync here. Credits are charged at 10/second |
| TikTok publishing | `TIKTOK_CLIENT_KEY/SECRET` | Requires an approved TikTok app with Content Posting API + `video.publish` scope |
| Instagram Reels | `META_APP_ID/SECRET` | Requires Meta App Review for `instagram_content_publish`; IG account must be Business/Creator linked to a Facebook Page |
| YouTube Shorts | `GOOGLE_YT_CLIENT_ID/SECRET` | Google OAuth verification needed for `youtube.upload` in production |
| LinkedIn | `LINKEDIN_CLIENT_ID/SECRET` | "Share on LinkedIn" product; organisation posting needs Community Management API |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | Create 6 prices (3 plans × month/year); point the webhook at `/api/v1/billing/webhook` with events `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed` |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | Magic links + invites; without it links print to the log |
| OAuth login | `AUTH_GOOGLE_ID/SECRET`, `AUTH_APPLE_ID/SECRET` | Optional; magic link always works |
| Token encryption | `TOKEN_ENCRYPTION_KEY` | `openssl rand -hex 32` — **required in production** |
| Admin access | `ADMIN_EMAILS` | Comma-separated; unlocks `/app/admin` (session sign-in only — API keys are never admin) |
| Image generation | `IMAGE_PROVIDER_URL`, `IMAGE_PROVIDER_KEY` | fal.ai-compatible endpoint for AI Studio / character images (4 credits each) |
| Storage | `STORAGE_DRIVER` = `local` or `s3` | Local mode for dev/single node; S3/R2 + CDN for production |
| Auth base | `AUTH_URL` | `${APP_URL}/api/auth`; `trustHost` is enabled for proxies/load balancers |
| Webhooks | `ALLOW_HTTP_WEBHOOKS=1` | Only for local testing; production requires https endpoints |

OAuth redirect URIs to register: `${APP_URL}/api/v1/socials/connect/{tiktok|instagram|youtube|linkedin}/callback`
and `${APP_URL}/api/auth/callback/{google|apple}`.

## Architecture

```
src/
  app/                 Next.js 15 App Router
    (marketing)/       landing, pricing, tools/compare/alternatives/industries (programmatic SEO), blog, developers, legal
    app/               authenticated product UI: onboarding, blitz, content, studio, calendar, automations, analytics,
                       trends, characters, settings/*, affiliate, admin
    api/v1/            REST API (also used by the UI). Session cookie OR `Authorization: Bearer sk_...`
    api/mcp/           Remote MCP server (JSON-RPC over HTTP) exposing the tool surface
    api/t/v1           Tracking event ingest;   r/[slug]  tracked-link redirect;   public/t.js  snippet
  db/                  Drizzle schema (schema.ts), migrations runner, seed (models, 8 characters, 6 trend recipes)
  lib/
    plans.ts           Single source of truth for plans, limits, credit tariff — UI and gates both read it
    tenancy.ts         Actor resolution, workspace roles, entitlement checks (402 + code), usage counters, credits, audit
    generation.ts      Profile analysis + angle/copy prompts (with mock fixtures)
    render/            sharp (slides, memes, caption frames) + ffmpeg (stitch, captions, loudness, thumbs); TTS/talking-head contracts
    publishers/        Publisher interface; mock adapter; TikTok, Instagram, YouTube, LinkedIn implementations
    scheduling.ts      next-free-slot queues, schedule-time validation, idempotency, tracked links
    automations.ts     slot planner with guardrails;  stripe.ts  checkout/portal/webhooks/plan changes
  workers/index.ts     BullMQ jobs on two queues — velocity-render (generate.batch/item, render.item; CPU-bound) and
                       velocity-core (profile.analyze, publish.dispatch/post, metrics.pull, tokens.refresh,
                       automation.run/tick, credits.allocate, digest.weekly, trends.refresh, cleanup). Rendering can
                       never delay publishing. Size with WORKER_CONCURRENCY (render) and CORE_CONCURRENCY.
drizzle/               generated SQL migrations
```

Key design points:
- **Every external dependency sits behind an interface with a mock** (`PROVIDER_MODE`). Swap providers without touching callers.
- **Entitlements are enforced server-side** and return `402 { error: { code: "PLAN_LIMIT_SAVES", upgrade_url } }`; the UI turns any 402 into an upgrade wall.
- **Trends store metadata + recipes only** (no third-party media). **Characters are synthetic.** Published videos carry the AI-generated flag where platforms support it.
- **Tokens are AES-256-GCM encrypted at rest**; API keys are stored hashed.
- Content is soft-deleted and purged by the cleanup job; accounts purge 30 days after deletion.

## Tests

- `npm run test:e2e` — API-level end-to-end suite (25 checks) against a running stack in mock mode: creates a throwaway account, then drives
  profile → generation → Blitz → edit/re-render → mock social connect → schedule/publish → tracked links/attribution → metrics/analytics →
  characters/credits → automations → ICS → webhooks → plan gates → rate limiting. Set `METRICS_FIRST_PULL_DELAY_MS=5000` for a fast run.
- `npm run test:stripe` — signs synthetic Stripe events with `STRIPE_WEBHOOK_SECRET` and posts them to the webhook, so the billing state
  machine (plan apply, workspace locking, credit allocation/expiry, dunning, credit packs, affiliate commissions, signature rejection) can be
  verified with no Stripe account. Set `STRIPE_SECRET_KEY` to any value and the `STRIPE_PRICE_*` ids to placeholders first.
- `npm run qa` — crawls every page and API GET route with a session (`SESSION_COOKIE="authjs.session-token=…"`), verifies status, expected
  content and that every JS chunk each page references loads, and writes `qa/index.html`: a navigable QA console with a guided
  click-through order, per-route status, a preview pane and a live re-check button. Passed 99/99 on the delivered build.
- `npm run test:browser` — Playwright specs in `tests/` (marketing pages, magic-link sign-in → onboarding → Blitz, save wall). Needs `npx playwright install`.

## Runtime-verified (mock mode)

The full loop has been executed against a live Postgres + Redis: URL analysis → 30-candidate batch (0 render failures) →
Blitz keep/skip/undo → edit + re-render → mock social connect → schedule / publish now → metrics pull → analytics,
tracked links + attribution, automation preview/run, character creation with credit debit, ICS feed, API rate limiting.

## Scripts

`npm run dev` · `npm run build` · `npm run start` · `npm run typecheck` · `npm run worker` · `npm run db:migrate` · `npm run db:seed`
· `npx drizzle-kit generate` (after schema changes).

## Production checklist

- `GET /api/health` returns postgres/redis status (used by the Docker HEALTHCHECK and load balancers).
- Security headers (frame, nosniff, referrer, permissions, HSTS) are set in `next.config.ts`; `poweredByHeader` off; standalone output.
- The worker drains in-flight jobs on SIGTERM; render jobs hold a 3-minute lock.
- `.github/workflows/ci.yml` runs typecheck → build → migrate/seed → health → e2e (and Playwright, non-blocking) with Postgres + Redis services.
- `npm run backup` dumps Postgres (custom format) and local media with retention; for S3 use bucket versioning/replication.
- Set `TOKEN_ENCRYPTION_KEY`, real `AUTH_SECRET`, `STORAGE_DRIVER=s3` with a CDN in front of `S3_PUBLIC_URL`, and `ALLOW_HTTP_WEBHOOKS=0`.
- Point an uptime monitor at `/api/health` and forward app/worker logs to your log platform (structured console output).

## Documentation

- **PHASES.md** — build history, verification record, known limitations and what remains (start here).
- **DEPLOYMENT.md** — hosting: GitHub, database, host blueprints, DNS and callbacks, verification.
- **docs/Velocity_Deployment_Integration_Runbook.pdf** — 42-page reference for every feature, endpoint, job and integration.
- **docs/Velocity_Interactive_Prototype.html** — clickable prototype of all 41 screens.

## Deployment

See **DEPLOYMENT.md** for the full guide: pushing to GitHub, provisioning managed Postgres (Neon/Supabase/Render/RDS),
Redis and object storage, one-click blueprints for Render (`render.yaml`), Fly (`fly.toml`), Railway (`railway.json`) and a
single-VM `docker-compose.prod.yml`, plus DNS/callback URLs and post-deploy verification.


Any Node 22 host with ffmpeg. Recommended: the `app` container behind a load balancer (stateless) and 1..N `worker`
containers; managed Postgres with the `vector` extension; managed Redis; S3/R2 bucket with public read on `S3_PUBLIC_URL`
(or switch `publicUrl()` to signed URLs). Set `WORKER_CONCURRENCY` per worker (ffmpeg is CPU-bound; 2–4 per vCPU pair).

## Licence and third-party notes

This codebase is original. Replace the placeholder brand name, copy, privacy policy and terms before launch.
Platform names are used descriptively; no affiliation is implied.
