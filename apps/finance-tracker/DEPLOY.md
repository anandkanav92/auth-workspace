# Finance Tracker — Mac Mini Deployment Guide

The app is self-contained: two containers brought up by one `docker compose`.
A Hono BFF serves the built React PWA and proxies to finance-tracker's **OWN
PocketBase container** (it does NOT share a PocketBase with other apps — like
habit-tracker and dutch-app, each app brings its own). The two containers talk
over a private bridge network (`finance-net`). See
[§3.5 PocketBase migrations](#35-pocketbase-migrations-own-container).

- BFF container: host **3110** → container **80**
- PocketBase container: host **8092** → container **8090** (8090/8091 are taken
  by other apps' PocketBase on the deploy box)
- Public URL: **https://invest.cya.run**
- Cron (hourly prices etc.) runs **inside the BFF container**, gated by
  `CRON_ENABLED=true` — enable it on this one deployed instance only.

## Prerequisites

- Deploy box running Docker (arm64 — the pb image pulls the linux_arm64
  PocketBase build)
- Cloudflare Tunnel (`cloudflared`) configured
- SSH access to the deploy box
- A Firebase project with Google sign-in enabled + a service-account key
- A Finnhub API key (free tier)

> No shared PocketBase or external `mac-mini-net` network is required — this
> compose file declares its own `finance-net` bridge and a `finance_pb_data`
> named volume.

---

## 1. Clone the repo

```bash
ssh mac-mini
cd ~
# Already cloned for habit-tracker? Just `git pull` instead.
git clone https://github.com/anandkanav92/auth-workspace.git
cd auth-workspace/apps/finance-tracker
```

---

## 2. Create the env file

Copy the template and fill in real values. Unlike habit-tracker, finance-tracker
has **both** build-time (`VITE_*`) and runtime (server) secrets in the same file.

```bash
cp .env.example .env
nano .env
```

Fill in, at minimum:

| Var | Notes |
|-----|-------|
| `PB_URL` | Address of finance-tracker's own PocketBase on `finance-net`: `http://finance-pocketbase:8090` (host port is 8092) |
| `PB_ADMIN_EMAIL` + `PB_ADMIN_PASSWORD` | **Required.** The pb container seeds this superuser on boot; the BFF authenticates with the same creds |
| `PB_ADMIN_TOKEN` | Optional long-lived superuser token. Leave **blank** for this deploy and rely on the email/password above |
| `FIREBASE_SERVICE_ACCOUNT` | Full service-account JSON on ONE line (see §5) |
| `FINNHUB_API_KEY` | From https://finnhub.io |
| `CRON_ENABLED` | `true` on this instance only |
| `VITE_FIREBASE_*` | Public Firebase web config — baked into the build |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | Optional; leave blank to disable |

The `VITE_*` vars are inlined into the SPA at **build** time (Vite replaces
`import.meta.env.VITE_*`). `docker compose build` reads them from `.env` and
passes them as build args; the server runtime vars are read by the container at
start via `env_file: .env`. See `.env.example` for the complete annotated list.

> **Secrets warning:** `.env` holds the PocketBase superuser credentials, the
> Firebase service-account JSON, and the Finnhub key. It is gitignored — never
> commit it.

---

## 3. Build and start the containers

```bash
docker compose up -d --build
```

This brings up **both** containers — `finance-pocketbase` and `finance-tracker`
— on the private `finance-net` bridge. Verify they're running:

```bash
docker compose ps
curl -s http://localhost:8092/api/health  # PocketBase -> {"code":200,...}
curl -s http://localhost:3110/health      # BFF        -> {"ok":true,"ts":...}
curl -I http://localhost:3110             # -> HTTP 200 serving the SPA
```

On boot the BFF logs should show:

- `finance-tracker serving web from ...`
- `finance-tracker BFF on :80`
- `finance-tracker cron enabled (...)` — only when `CRON_ENABLED=true`

### 3.5 PocketBase migrations (own container)

finance-tracker ships its 8 collections as PocketBase **JS migrations** under
`server/pb-schema/migrations/`. The `finance-pocketbase` service mounts that
directory read-only into `/pb/pb_migrations` and runs `serve` with an explicit
`--migrationsDir`, so PocketBase **auto-applies** any pending migrations in
lexicographic order on every boot — no curl seeding, no manual step. The mount
is already declared in `docker-compose.yml`:

```yaml
volumes:
  - finance_pb_data:/pb/pb_data
  - ./server/pb-schema/migrations:/pb/pb_migrations:ro
```

After `docker compose up -d --build`, confirm the collections exist:

```bash
# In the PocketBase admin UI (http://localhost:8092/_/) -> Collections, or via
# the API, you should see:
# accounts, holdings, transactions, imports, holdings_snapshot,
# symbol_profiles, price_cache, fx_rates
```

When a `git pull` brings new migrations, `docker compose up -d --build`
recreates the pb container and the new migrations auto-apply on its next boot.

> **`/api/batch` is enabled on this PocketBase only.** Migration
> `1717000005_finance_import_atomic_and_per_account_dedup.js` sets
> `settings.batch.enabled = true` to make statement import an atomic transaction.
> Because finance-tracker now runs its **own** PocketBase, this is no longer a
> cross-app concern — it only affects finance-tracker's instance, and our
> admin-authenticated BFF is the only client of the (auth-gated) `/api/batch`
> endpoint.

---

## 4. Add Cloudflare Tunnel route

Edit the tunnel config:

```bash
nano ~/.cloudflared/config.yml
```

Add under `ingress` (before the catch-all `- service: http_status:404`):

```yaml
- hostname: invest.cya.run
  service: http://localhost:3110
```

Create the DNS record:

```bash
cloudflared tunnel route dns mac-mini invest.cya.run
```

Reload the tunnel:

```bash
launchctl unload ~/Library/LaunchAgents/com.cloudflare.cloudflared.plist
launchctl load ~/Library/LaunchAgents/com.cloudflare.cloudflared.plist
```

---

## 5. Add domain to Firebase + service account

In [Firebase Console](https://console.firebase.google.com):

1. **Authorized domains** — Authentication → Settings → Authorized domains →
   **Add domain** → `invest.cya.run`. Without this, Google sign-in fails on the
   production domain.
2. **Service account** — Project settings → Service accounts → **Generate new
   private key**. Download the JSON, collapse it to a single line, and paste it
   as `FIREBASE_SERVICE_ACCOUNT` in `.env`. The BFF uses it to verify ID tokens
   server-side and to upsert PocketBase users on first sign-in.

---

## 6. Verify (smoke test, M16.5)

Open **https://invest.cya.run** in your browser.

- [ ] Login page renders
- [ ] Sign in with Google succeeds (proves authorized domain + service account)
- [ ] Empty dashboard / portfolio loads
- [ ] Upload a **real Trading 212 PDF export** → preview → confirm → holdings appear
- [ ] Real prices populate within the hour (or trigger pull-to-refresh) — proves
      the Yahoo→Finnhub chain and `price_cache` writes
- [ ] Re-uploading the same file to the same account returns a clean "already
      imported" dialog (409), not a 500

---

## 7. Backups (restic → Backblaze B2)

finance-tracker now has its **own** PocketBase data, persisted in the
`finance_pb_data` named Docker volume. It is no longer part of any other app's
data directory, so it needs its own backup. A nightly cron can snapshot the
volume and ship it offsite with [`restic`](https://restic.net) to a
**Backblaze B2** bucket. The data lives at the volume's mountpoint (inspect with
`docker volume inspect finance_pb_data`); the snippet below reads it from inside
a throwaway container so paths don't depend on the Docker storage driver:

```bash
export RESTIC_REPOSITORY="b2:finance-tracker-backups:pocketbase"
export RESTIC_PASSWORD="..."                 # from the backup host's secret store
export B2_ACCOUNT_ID="..." B2_ACCOUNT_KEY="..."

# Mount the named volume read-only and back up its contents (DB + uploads).
docker run --rm -v finance_pb_data:/data:ro -w /data alpine \
  tar -cf - . | restic backup --stdin --stdin-filename finance_pb_data.tar
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
```

### Backup verification (M16.7)

- [ ] After the first nightly run post-deploy, list the latest restic snapshot
      and confirm it contains the PocketBase data:
      `restic snapshots --latest 1` and `restic ls latest | grep finance_pb_data`
- [ ] Spot-check that our collections are inside the snapshot's DB (a test
      restore to a scratch dir, then open the DB and confirm `accounts`,
      `holdings`, … exist). Migrations recreate the schema on a fresh container,
      but the backup is what preserves the actual rows/uploads.

### Cron monitoring (M16.6)

The in-container crons (prices, FX, snapshots, profiles, prune) must alert on
repeated failure.

- [ ] Wire an **ntfy** alert that fires if any cron fails **2x in a row**
      (e.g. each job posts a heartbeat on success; a watcher pings
      `ntfy.sh/<topic>` when two consecutive heartbeats are missed, or on a
      caught exception reported via Sentry).
- [ ] Verify the alert path end-to-end once (force a failure, confirm the push
      lands), then confirm the hourly price cron is actually running by watching
      `price_cache` update timestamps advance.

---

## Updating

To deploy new changes:

```bash
ssh <deploy-box>
cd ~/auth-workspace
git pull
cd apps/finance-tracker
docker compose up -d --build
```

This recreates both containers. If the pull includes new PocketBase migrations,
they auto-apply on the `finance-pocketbase` container's next boot (the migrations
dir is mounted into it) — no separate step needed.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Google sign-in fails | Check `invest.cya.run` is in Firebase authorized domains (§5) |
| 401 on every `/api/*` | `FIREBASE_SERVICE_ACCOUNT` missing/malformed, or clock skew on the deploy box |
| BFF won't start | `docker compose logs finance-tracker`; check `.env` has `PB_URL` + PocketBase admin auth + `FIREBASE_SERVICE_ACCOUNT` |
| `Set PB_ADMIN_TOKEN, or PB_ADMIN_EMAIL+PB_ADMIN_PASSWORD` on boot | PocketBase admin auth not set in `.env` |
| pb container won't start / no superuser | `docker compose logs finance-pocketbase`; `PB_ADMIN_EMAIL`/`PB_ADMIN_PASSWORD` must be set (start.sh upserts the superuser from them) |
| Import returns 403 "Batch requests are not allowed" | Migration `…0005…` hasn't applied — `docker compose logs finance-pocketbase` for migration errors, then recreate the pb container (§3.5) |
| Collections missing in PocketBase | Migrations not applied — check `finance-pocketbase` logs; the `migrations/` mount is declared in compose (§3.5) |
| Prices never refresh | `CRON_ENABLED` not `true`, or check logs for `cron enabled` + cron monitor (§7) |
| Site not reachable | Check tunnel config; verify `curl http://localhost:3110/health` works locally |
| Stale build / old Firebase config | `VITE_*` are baked at build time — `docker compose build --no-cache` after editing them |

---

## Pre-prod checklist (tracked follow-ups)

Resolve before relying on this in production:

- [ ] **Cron date comparison test** — add the integration test for the
      bare-date ↔ PocketBase `DateField` comparison (snapshot/prune crons)
      **before** enabling cron on prod. The snapshot "already exists today" and
      prune "older than 90d" logic depends on this comparison being correct.
- [ ] **Finnhub live smoke** — run a live Finnhub smoke test (one ticker through
      the fallback path) before relying on it; the chain falls back to Finnhub
      only when Yahoo returns null, so it's otherwise rarely exercised.
- [ ] **Replace placeholder PWA icons** — the icons in `web/public/icons/` are
      placeholders from `web/scripts/gen-icons.mjs`. Swap in real artwork at the
      same filenames/sizes (192, 512, maskable-512, 180 apple-touch-icon) and
      rebuild. See `web/PWA-NOTES.md`.
- [ ] ~~Confirm `/api/batch` global enable is acceptable~~ — no longer a concern:
      finance-tracker runs its own PocketBase, so migration `…0005…` enabling
      `batch.enabled` affects only finance-tracker's instance (§3.5).
- [ ] **Lighthouse ≥ 90 (PWA + Performance)** — manual check against a prod
      build (`pnpm --filter finance-tracker-web preview`), per `web/PWA-NOTES.md`.
