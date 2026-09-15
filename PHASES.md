# Velocity — build phases, verification record and current state

One file covering every completed phase, what was verified in each, and exactly what is left to do.
Written for a developer opening this repository for the first time in VS Code.

**Current state:** Phases 0 through 4 complete. The application runs end to end in mock mode, passes 25/25
API end-to-end assertions, 99/99 route checks and 36/36 page renders. Everything outstanding is gated on
credentials and platform approvals, not on code.

**Companion documents**

| Document | Answers |
|---|---|
| `DEPLOYMENT.md` | How do I host this? (GitHub, database, hosting, DNS, verification) |
| `docs/Velocity_Deployment_Integration_Runbook.pdf` | How does every feature, endpoint, job and integration work? (42 pages) |
| `docs/Velocity_Interactive_Prototype.html` | What does every screen look like? (41-page clickable prototype) |
| This file | What was built when, what was proven, what is left |

---

## Quick start (five minutes to a running app)

```bash
npm install
cp .env.example .env          # set AUTH_SECRET to any long random string
docker compose up --build     # postgres(pgvector) + redis + minio + app + worker
docker compose logs -f app | grep magic-link   # click the printed sign-in link
```

Then paste any website URL on the onboarding screen. In mock mode the crawler is real, copy is fixtured,
media renders locally with ffmpeg, "connecting" a social account creates a sandbox account, and "publishing"
returns example permalinks with synthetic metrics — the whole loop is exercisable with no external keys.

Without Docker: provide Postgres 16 (with the `vector` extension) and Redis 7, set `STORAGE_DRIVER=local`,
then `npm run db:migrate && npm run db:seed`, and run `npm run dev` and `npm run worker` in two terminals.

**The worker is not optional.** Generation, rendering, publishing, metrics, automations, webhooks and the
weekly digest all run there. An app without a worker accepts requests and never completes them.

---

## Phase 0 + 1 — Foundations and the core loop

**Delivered**

- Next.js 15 + TypeScript app, BullMQ worker, PostgreSQL 16 + pgvector, Redis, S3/MinIO storage,
  Docker Compose, Dockerfile with ffmpeg, complete `.env.example`.
- Database schema: 37 tables covering auth, tenancy, brand profiles, content libraries, publishing,
  automations, attribution, commerce and platform concerns, with generated Drizzle migrations.
- Core services: plans and entitlements (single source of truth), auth (magic link + optional Google/Apple),
  tenancy and API-key resolution, AES-256-GCM token encryption, crawler (native fetch + Firecrawl fallback),
  LLM abstraction with mock fixtures, generation (profile analysis, angles, per-format copy), render pipeline
  (sharp slides/memes, ffmpeg video, burned captions), publisher adapters for TikTok, Instagram, YouTube and
  LinkedIn plus a mock adapter, scheduling with platform validation, automation planner, Stripe billing.
- Background jobs: profile analysis, batch and item generation, publish dispatch and publish with retries,
  metrics collection, token refresh, automation runs, credit allocation, cleanup.
- Complete REST API, OpenAPI document, remote MCP server, tracking snippet and tracked-link redirect.
- Marketing site and the full product UI: onboarding, swipe approval, content library and detail, Studio,
  calendar, automations, analytics, trends, characters, settings, admin.

**Verified in this phase:** typecheck and production build clean; migrations generate 37 tables; the render
pipeline produces a valid 1080×1920 H.264 MP4 with burned captions and a thumbnail.

**Not verified:** nothing had been run against a database yet — this was a compile-level delivery.

---

## Phase 2 — First real runtime, and the defects it found

A live PostgreSQL + Redis stack was stood up and the application was executed end to end for the first time.

**Defects found and fixed**

1. **Rendering starved publishing.** A scheduled post went out roughly 90 seconds late because CPU-heavy
   renders occupied every worker slot. Fixed by splitting into two queues — `velocity-render` and
   `velocity-core` — so time-critical jobs can never queue behind rendering.
2. **Analytics returned 500** on an ambiguous column in the latest-metrics join. Fixed.
3. **Publish-now reported the wrong status**, and posts left mid-publish by a worker restart were never
   recovered. Both fixed; the dispatcher now recovers posts stuck in `publishing` after 15 minutes.

**Added**

- Local filesystem storage driver (`STORAGE_DRIVER=local`) so development needs no MinIO.
- Shared render pipeline with demo-video b-roll for hook + demo, licence-aware human UGC rendering, and a
  `render.item` job for re-rendering from edited copy.
- Image-generation provider contract with a mock; character creation endpoint and UI.
- Admin curation: bulk trend import and human UGC clip registration; trend velocity refresh job.
- Weekly performance digest email; per-plan API rate limiting; platform-level attribution.

**Verified at runtime:** URL → profile → 30-candidate batch (0 render failures) → swipe keep/skip/undo →
edit with versioning → mock OAuth connect → schedule and publish-now with permalinks → tracked links and
attribution → re-render → character creation with correct credit debit → ICS feed → automation run.

---

## Phase 3 — Ecosystem, and a critical sign-in fix

**Critical fix:** Auth.js rejected the request host on first boot (`UntrustedHost`), which would have
returned a 500 on every login attempt. Fixed with `trustHost` and an `AUTH_URL` entry. Magic-link sign-in is
now verified through the full email → link → session path.

**Also fixed:** user-initiated re-renders queued behind batch renders and timed out (queue priorities added:
user renders first, automation batches second, bulk batches third); the attribution report failed once
several posts existed.

**Added**

- Signed webhook delivery (HMAC + timestamp, five attempts with backoff) for `batch.completed`,
  `content.saved`, `post.scheduled`, `post.published`, `post.failed` and `automation.ran`, with CRUD API and
  settings UI.
- Studio timeline editor: reorder and edit slides, caption beats or meme lines, then save-and-re-render.
- Affiliate settlement job (pending → approved after the 30-day refund window) and admin payout marking with
  the $50 minimum.
- Admin cost dashboard with tunable unit costs.
- `npm run test:e2e` — a 25-assertion end-to-end suite that drives the entire loop.
- Playwright browser specs and configuration; SEO catalogue expanded to 27 programmatic pages.

**Verified:** 25/25 end-to-end assertions on the delivered build; three webhook deliveries observed for one
publish; admin session gating, trend import, clip registration and human UGC rendering all exercised.

---

## Phase 4 — Billing proof, AI Studio and production hardening

**Billing verified without a Stripe account.** `npm run test:stripe` signs synthetic events exactly as Stripe
does and posts them to the webhook. Confirmed: subscription created → plan applied; invoice paid → previous
credit balance expired and the monthly grant allocated (idempotent on invoice id); payment failed → 7-day
dunning grace; downgrade → workspaces above the new limit locked, not deleted; credit-pack checkout → credits
added; invoice on a referred account → 30% commission recorded with self-referral excluded; forged signature
→ rejected with 400.

**AI Studio completed:** image generation (4 credits each), video generation (10 credits per second, charged
up front and refunded automatically on final failure), and the character consistency pack. Credit accounting
verified: 350 → 230 across a test run, with a 600-credit request correctly refused.

**Production hardening:** `/api/health` reporting Postgres and Redis; security headers and HSTS; standalone
build; non-root Docker image with a health check; worker drains in-flight jobs on SIGTERM; `npm run backup`
with retention; GitHub Actions CI running typecheck → build → migrate → seed → health → e2e against service
containers.

---

## Additional work after Phase 4

- **SaaS admin panel** — ten tabs: overview, accounts (search, plan changes, credit grants, usage reset, key
  revocation, suspend/restore), keys and webhooks across all accounts, integration status for all 13
  providers, moderation, publishing health, affiliate payouts, costs, curation, audit log.
- **UI overhaul** — new design system, rebuilt app shell with grouped icon sidebar, command palette,
  notifications and plan card; redesigned landing page.
- **Website completeness** — custom 404, full privacy policy, categorised FAQ with schema, expanded
  robots.txt, unique titles and meta descriptions with canonicals on every page, internal linking throughout,
  descriptive alt text, generated Open Graph images with share rows, and a contact page with map and
  directions.
- **Verification tooling** — `npm run qa` crawls all 99 routes and writes a navigable QA console;
  `scripts/screenshots/` renders every page in headless Chromium and builds a page viewer.
- **Hosting readiness** — TLS and pooled-connection support for managed Postgres, blueprints for Render
  (`render.yaml`), Fly (`fly.toml`), Railway (`railway.json`) and a single VM (`docker-compose.prod.yml`),
  plus `DEPLOYMENT.md`.

---

## Verification record

| Check | Command | Result |
|---|---|---|
| Type safety | `npm run typecheck` | Clean |
| Production build | `npm run build` | Clean |
| API end to end | `npm run test:e2e` | 25/25 |
| Billing state machine | `npm run test:stripe` | All events, forged signature rejected |
| Route crawl | `npm run qa` | 99/99 |
| Page renders (headless Chromium) | `node scripts/screenshots/shots.mjs` | 36/36, 0 console errors |
| Browser flows | `npm run test:browser` | Written, not yet run in CI |

---

## What is left — all of it gated on credentials

Nothing on this list is a code task. Each provider can be switched to live independently: anything unset keeps
using its mock even when `PROVIDER_MODE=live`, so go live one provider at a time and re-run `npm run test:e2e`
after each. Admin → Integrations shows what the running process actually sees.

| Item | Blocked on | Lead time |
|---|---|---|
| Real Company Profiles and copy | `ANTHROPIC_API_KEY` | Minutes |
| Voice for AI UGC | `ELEVENLABS_API_KEY` | Minutes |
| Talking-head video instead of preview cards | A vendor behind `VIDEO_PROVIDER_URL` (HeyGen, Hedra, Sync) | Hours–days |
| AI Studio images and character references | `IMAGE_PROVIDER_URL` (fal.ai or compatible) | Minutes |
| Live checkout and invoices | Stripe: six prices + webhook secret | Hours |
| Publishing to TikTok | TikTok Content Posting API approval | **Weeks** |
| Publishing to Instagram Reels | Meta App Review | **Weeks** |
| Publishing to YouTube Shorts | Google OAuth verification | **Weeks** |
| Publishing to LinkedIn | LinkedIn app + products | Days–weeks |
| Human UGC library | Licensed creator clips | Ongoing |
| Trend library at scale | Curator imports via Admin → Curation | Ongoing |

**Start the four platform applications first — they are the long pole.** Everything else can be completed and
tested in mock mode while you wait.

Two further items need a person rather than a key: clicking through the UI in a browser (the one thing never
done in this build), and replacing the placeholder privacy policy, terms and contact address with
counsel-reviewed text.

---

## Known limitations, stated plainly

- **LinkedIn metrics return zero.** Member-post analytics need additional partner permissions from LinkedIn.
  Calendar and analytics will read 0 views for LinkedIn posts until you have them. Platform restriction, not
  a bug.
- **Media must be publicly reachable.** TikTok and Instagram fetch media by URL, so `S3_PUBLIC_URL` has to be
  public (or CDN-fronted). A private bucket breaks publishing.
- **`TOKEN_ENCRYPTION_KEY` cannot be rotated casually.** Every stored social token is encrypted with it;
  changing it forces every customer to reconnect. Rotation needs a decrypt-and-re-encrypt migration with the
  worker stopped.
- **Rendering is CPU-bound.** Scale the worker, not the web tier, when generation backs up. Roughly 2–4
  concurrent renders per 2 vCPU.
- **Vercel alone will not work.** The worker is a long-running process and ffmpeg will not run in Vercel
  functions. Host the worker elsewhere if you use Vercel for the web tier.
- **Adapters follow current platform documentation** but have never made a live call. Expect small
  adjustments — scopes, review notes, error shapes — on the first real publish to each platform.

---

## Suggested first week

1. Boot the stack, run `npm run test:e2e` and `npm run test:stripe`, confirm both pass on your machine.
2. Click through every screen in the browser and note anything cosmetic. Use `docs/Velocity_Interactive_Prototype.html`
   as the reference for what each screen should look like.
3. Push to GitHub, enable branch protection with CI as a required check (`DEPLOYMENT.md` section 1).
4. Submit the TikTok, Meta, Google and LinkedIn developer applications.
5. Deploy to staging on Render or Fly (`DEPLOYMENT.md` section 3) and re-run the e2e suite against it.
6. Add the Anthropic key, set `PROVIDER_MODE=live`, and compare generated copy against the mock fixtures —
   this is the single change that most affects perceived product quality.
