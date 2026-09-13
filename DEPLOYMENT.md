# Deploying Velocity

Everything below assumes you are in the extracted `velocity/` folder.

---

## 1. Put it on GitHub

The repository is already initialised with a first commit and a `.gitignore` that excludes `node_modules`, `.next`, `.env`,
`.media` and backups. Create an **empty private repo** on GitHub (no README, no licence), then:

```bash
git remote add origin git@github.com:<you>/velocity.git   # or https://github.com/<you>/velocity.git
git branch -M main
git push -u origin main
```

If you use HTTPS, GitHub will ask for a personal access token rather than a password
(Settings → Developer settings → Personal access tokens → Fine-grained, `Contents: read/write` on this repo).
Never commit `.env` — the ignore file covers it, but check with `git status` before your first push.

CI runs automatically on push: `.github/workflows/ci.yml` spins up Postgres and Redis, then runs typecheck, build,
migrations, health check and the 25-assertion end-to-end suite.

---

## 2. Provision the database

Any PostgreSQL 16 with the `vector` extension works. The migration runner enables `pgcrypto` and `vector` itself, so you
only need a database and a connection string.

| Provider | Notes |
|---|---|
| **Neon** | Free tier, `vector` supported. Use the **pooled** connection string (`-pooler` host) for the web service and the direct string for migrations. |
| **Supabase** | `vector` enabled by default. Use the session pooler (port 5432) for migrations, transaction pooler (6543) for the app. |
| **Render Postgres** | Simplest if you deploy on Render — `render.yaml` wires `DATABASE_URL` for you. |
| **AWS RDS / Aurora** | Run `CREATE EXTENSION vector;` once if your parameter group restricts extensions. |
| **Your own Postgres** | Use `docker-compose.prod.yml`, which runs `pgvector/pgvector:pg16`. |

Set `DATABASE_URL`, and add `?sslmode=require` (managed providers) — TLS and PgBouncer-safe settings are detected
automatically, or force them with `DATABASE_SSL=1` and `PGBOUNCER=1`.

Then, once per environment:

```bash
npm run db:migrate      # creates 37 tables, extensions and the pgvector index
npm run db:seed         # AI model registry, sample characters, trend recipes
```

`render.yaml` and `fly.toml` already run the migration on every deploy as a release/pre-deploy command.

**Redis** is required for the job queues: Upstash, Render Redis, Railway Redis or your own `redis:7`. Set `REDIS_URL`.
Use a plan with persistence if you want scheduled jobs to survive a restart.

**Object storage** for media: Cloudflare R2, Backblaze B2 or S3. Create a bucket, allow public read (or put a CDN in
front), and set `STORAGE_DRIVER=s3` with `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL`.
`STORAGE_DRIVER=local` is fine for a single VM but breaks if you run more than one web instance.

---

## 3. Choose a host

The app is a Next.js server plus a **long-running worker**. The worker is not optional — generation, publishing,
metrics and automations all run there — so pick a host that can run a background process.

### Render (recommended first deploy)
Push to GitHub, then Render → **New → Blueprint** → select the repo. `render.yaml` creates the database, Redis, the web
service and the worker, runs migrations before each deploy, and health-checks `/api/health`. Fill the secrets marked
`sync: false` in the dashboard.

### Fly.io
```bash
fly launch --no-deploy          # reads fly.toml
fly postgres create && fly postgres attach <db>     # or set DATABASE_URL to Neon/Supabase
fly redis create
fly secrets set AUTH_SECRET=... TOKEN_ENCRYPTION_KEY=... APP_URL=https://... AUTH_URL=https://.../api/auth
fly deploy
fly scale count app=1 worker=1
```

### Railway
Point Railway at the repo (`railway.json` selects the Dockerfile), add Postgres and Redis plugins, then add a second
service from the same repo with start command `npm run worker`.

### Your own VM
```bash
cp .env.example .env    # fill it in, set POSTGRES_PASSWORD
docker compose -f docker-compose.prod.yml up -d --build
```
Put Caddy, Nginx or Cloudflare Tunnel in front for TLS. A nightly backup container is included.

### Vercel
Only the web half runs there. Host the worker elsewhere (Fly, Render, a VM) pointing at the same Postgres and Redis,
and use a pooled connection string. Note that ffmpeg rendering will not run inside Vercel functions.

---

## 4. Required environment variables

Minimum for a working deployment in mock mode:

```
APP_URL=https://your-domain.com
AUTH_URL=https://your-domain.com/api/auth
AUTH_SECRET=<openssl rand -base64 32>
TOKEN_ENCRYPTION_KEY=<openssl rand -hex 32>
DATABASE_URL=postgres://...?sslmode=require
REDIS_URL=rediss://...
STORAGE_DRIVER=s3   (+ S3_* values)
ADMIN_EMAILS=you@your-domain.com
PROVIDER_MODE=mock
```

Add provider keys one at a time and switch `PROVIDER_MODE=live` when ready — anything unset keeps using its mock, so
you can go live provider by provider. The Admin → Integrations tab shows what is configured.

**Restart the web service and worker after changing any variable.**

---

## 5. DNS and callbacks

Point your domain at the host, then register these callback URLs with each provider:

```
https://your-domain.com/api/auth/callback/google      (and /apple)
https://your-domain.com/api/v1/socials/connect/tiktok/callback
https://your-domain.com/api/v1/socials/connect/instagram/callback
https://your-domain.com/api/v1/socials/connect/youtube/callback
https://your-domain.com/api/v1/socials/connect/linkedin/callback
https://your-domain.com/api/v1/billing/webhook          (Stripe: checkout.session.completed,
                                                         customer.subscription.*, invoice.paid, invoice.payment_failed)
```

---

## 6. Verify the deployment

```bash
curl -s https://your-domain.com/api/health              # {"status":"ok","checks":{"postgres":"ok","redis":"ok"}}
APP_URL=https://your-domain.com npm run test:e2e        # 25 assertions against the live deployment
SESSION_COOKIE="authjs.session-token=..." npm run qa    # crawls 99 routes, writes qa/index.html
```

Then sign in, run through the onboarding flow, and check Admin → Integrations and Admin → Accounts.

---

## 7. Operating it

- Scale the worker, not the web tier, when rendering backs up (`WORKER_CONCURRENCY`, and extra worker instances).
- `npm run backup` dumps Postgres and local media with retention; schedule it or rely on your provider's snapshots.
- Watch `/api/health`, the worker logs, and Admin → Publishing for failed posts and accounts needing reconnection.
- Rotate `TOKEN_ENCRYPTION_KEY` only with a re-encryption migration — changing it invalidates every stored social token.
