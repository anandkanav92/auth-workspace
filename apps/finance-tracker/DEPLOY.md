# Finance Tracker — Mac Mini Deployment Guide

The app is a single container: a Hono BFF that serves the built React PWA and
proxies to the **shared workspace PocketBase** (the same instance habit-tracker
uses). There is no PocketBase service of its own — see
[§3.5 PocketBase migrations](#35-pocketbase-migrations-shared-instance).

- BFF container: host **3110** → container **80**
- Public URL: **https://invest.cya.run**
- Cron (hourly prices etc.) runs **inside this container**, gated by
  `CRON_ENABLED=true` — enable it on this one deployed instance only.

## Prerequisites

- Mac Mini running Docker Desktop
- The shared workspace PocketBase container already running on the
  `mac-mini-net` Docker network (habit-tracker's deploy brings it up)
- Cloudflare Tunnel (`cloudflared`) configured
- SSH access to Mac Mini
- A Firebase project with Google sign-in enabled + a service-account key
- A Finnhub API key (free tier)

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
| `PB_URL` | Address of the shared PocketBase on `mac-mini-net`, e.g. `http://pocketbase:8090` |
| `PB_ADMIN_TOKEN` | Long-lived PocketBase superuser token (preferred). If blank, set `PB_ADMIN_EMAIL` + `PB_ADMIN_PASSWORD` |
| `FIREBASE_SERVICE_ACCOUNT` | Full service-account JSON on ONE line (see §5) |
| `FINNHUB_API_KEY` | From https://finnhub.io |
| `CRON_ENABLED` | `true` on this instance only |
| `VITE_FIREBASE_*` | Public Firebase web config — baked into the build |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | Optional; leave blank to disable |

The `VITE_*` vars are inlined into the SPA at **build** time (Vite replaces
`import.meta.env.VITE_*`). `docker compose build` reads them from `.env` and
passes them as build args; the server runtime vars are read by the container at
start via `env_file: .env`. See `.env.example` for the complete annotated list.

> **Secrets warning:** `.env` holds the PocketBase admin token, the Firebase
> service-account JSON, and the Finnhub key. It is gitignored — never commit it.

---

## 3. Build and start the container

```bash
docker compose up -d --build
```

Verify it's running:

```bash
docker compose ps
curl -s http://localhost:3110/health      # -> {"ok":true,"ts":...}
curl -I http://localhost:3110             # -> HTTP 200 serving the SPA
```

On boot the logs should show:

- `finance-tracker serving web from ...`
- `finance-tracker BFF on :80`
- `finance-tracker cron enabled (...)` — only when `CRON_ENABLED=true`

### 3.5 PocketBase migrations (shared instance)

finance-tracker ships its 8 collections as PocketBase **JS migrations** under
`server/pb-schema/migrations/`. They are NOT bundled into this container — they
must be applied to the shared PocketBase. PocketBase auto-applies any pending
migrations in lexicographic order on boot, so the shared PocketBase container
must **mount our migrations directory**. In that container's service definition:

```yaml
volumes:
  - ~/auth-workspace/apps/finance-tracker/server/pb-schema/migrations:/pb/pb_migrations:ro
```

(Adjust the host path to wherever the repo is checked out.) Restart the
PocketBase container after adding the mount so the migrations run. Confirm with:

```bash
# In the PocketBase admin UI -> Collections, you should now see:
# accounts, holdings, transactions, imports, holdings_snapshot,
# symbol_profiles, price_cache, fx_rates
```

> **Cross-app warning — `/api/batch` is a GLOBAL PocketBase setting.** Migration
> `1717000005_finance_import_atomic_and_per_account_dedup.js` sets
> `settings.batch.enabled = true` to make statement import an atomic transaction.
> This is a workspace-wide PocketBase setting and therefore also exposes the
> (auth-gated) `/api/batch` endpoint to **habit-tracker** on the shared instance.
> Our admin-token BFF is the only intended client. Confirm this is acceptable
> before the migration lands on prod — see the Pre-prod checklist below.

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

PocketBase data (our 8 collections live in the shared SQLite DB) is covered by
the workspace's existing nightly backup — finance-tracker's schema simply joins
it, so there is **no new backup job to write**. For reference, that nightly cron
snapshots the PocketBase data directory and ships it offsite with
[`restic`](https://restic.net) to a **Backblaze B2** bucket:

```bash
# Illustrative — the workspace already runs an equivalent on a nightly cron.
export RESTIC_REPOSITORY="b2:auth-workspace-backups:pocketbase"
export RESTIC_PASSWORD="..."                 # from the backup host's secret store
export B2_ACCOUNT_ID="..." B2_ACCOUNT_KEY="..."

restic backup /pb/pb_data                    # PocketBase data dir (DB + uploads)
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
```

Because finance-tracker is on the **same** PocketBase data directory, no path
change is needed — verify (don't re-implement) per the checklist below.

### Backup verification (M16.7)

- [ ] After the first nightly run post-deploy, list the latest restic snapshot
      and confirm it contains the PocketBase data dir:
      `restic snapshots --latest 1` and `restic ls latest | grep pb_data`
- [ ] Spot-check that our collections are inside the snapshot's DB (a test
      restore to a scratch dir, then open the DB and confirm `accounts`,
      `holdings`, … exist).

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
ssh mac-mini
cd ~/auth-workspace
git pull
cd apps/finance-tracker
docker compose up -d --build
```

If the pull includes new PocketBase migrations, restart the **shared
PocketBase** container too (it auto-applies pending migrations on boot).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Google sign-in fails | Check `invest.cya.run` is in Firebase authorized domains (§5) |
| 401 on every `/api/*` | `FIREBASE_SERVICE_ACCOUNT` missing/malformed, or clock skew on the Mini |
| Container won't start | `docker compose logs`; check `.env` has `PB_URL` + PocketBase admin auth + `FIREBASE_SERVICE_ACCOUNT` |
| `Set PB_ADMIN_TOKEN, or PB_ADMIN_EMAIL+PB_ADMIN_PASSWORD` on boot | PocketBase admin auth not set in `.env` |
| Import returns 403 "Batch requests are not allowed" | Migration `…0005…` hasn't applied — confirm the shared PocketBase mounts our `migrations/` dir and was restarted (§3.5) |
| Collections missing in PocketBase | Migrations not mounted/applied on the shared PocketBase (§3.5) |
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
- [ ] **Confirm `/api/batch` global enable is acceptable** — migration `…0005…`
      flips `batch.enabled` on the shared PocketBase, which also affects
      habit-tracker (§3.5). Sign off that this is acceptable.
- [ ] **Lighthouse ≥ 90 (PWA + Performance)** — manual check against a prod
      build (`pnpm --filter finance-tracker-web preview`), per `web/PWA-NOTES.md`.
