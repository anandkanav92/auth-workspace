# Dutch App — Mac Mini Deployment Guide

## Prerequisites

- Mac Mini running Docker Desktop
- Cloudflare Tunnel (`cloudflared`) configured
- SSH access to Mac Mini

---

## 1. Clone the repo (skip if already done for habit-tracker)

```bash
ssh mac-mini
cd ~/projects/auth-workspace
git pull origin main
```

---

## 2. Create the env file

Firebase config is baked into the build at compile time (Next.js replaces `process.env.NEXT_PUBLIC_*`).

```bash
cd apps/dutch-app
cat > .env << 'EOF'
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAn-R5Kf_ifAsuJ8ABZkqiDxBEBVB9OD3U
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=auth-sign-9f463.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=auth-sign-9f463
NEXT_PUBLIC_FIREBASE_APP_ID=1:666383234446:web:e4fa09a14f168de393a0df
NEXT_PUBLIC_PB_URL=https://dutch-pb.cya.run
PB_EMAIL=admin@dutch-app.local
PB_PASSWORD=changeme123456
EOF
```

---

## 3. Build and start the containers

```bash
docker compose up -d --build
```

Verify it's running:

```bash
docker compose ps
curl -I http://localhost:3102
```

Expected: HTTP 200 serving the app.

---

## 4. Add Cloudflare Tunnel routes

Edit the tunnel config:

```bash
nano ~/.cloudflared/config.yml
```

Add under `ingress` (before the catch-all `- service: http_status:404`):

```yaml
- hostname: dutch.cya.run
  service: http://localhost:3102
- hostname: dutch-pb.cya.run
  service: http://localhost:8091
```

Create the DNS records:

```bash
cloudflared tunnel route dns mac-mini dutch.cya.run
cloudflared tunnel route dns mac-mini dutch-pb.cya.run
```

Reload the tunnel:

```bash
launchctl unload ~/Library/LaunchAgents/com.cloudflare.cloudflared.plist
launchctl load ~/Library/LaunchAgents/com.cloudflare.cloudflared.plist
```

---

## 5. Add domain to Firebase

In [Firebase Console](https://console.firebase.google.com):

1. Go to **Authentication > Settings > Authorized domains**
2. Click **Add domain**
3. Add `dutch.cya.run`

Without this, Google sign-in will fail on the production domain.

---

## 6. Verify

Open **https://dutch.cya.run** in your browser.

- Should show the dashboard
- Works without sign-in (localStorage mode)
- Sign in with Google should work
- Flashcards, notes, and progress persist after sign-out/in

---

## Updating

Automatic via GitHub Actions on push to `main`. Or manually:

```bash
ssh mac-mini
cd ~/projects/auth-workspace
git pull
cd apps/dutch-app
docker compose up -d --build
```

---

## Port Mapping

| Service | Container Port | Host Port | URL |
|---------|---------------|-----------|-----|
| dutch-app | 3000 | 3102 | https://dutch.cya.run |
| pocketbase | 8090 | 8091 | https://dutch-pb.cya.run |

(Habit-tracker uses 3100/8090, so dutch-app uses 3102/8091 to avoid conflicts.)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Google sign-in fails | Check `dutch.cya.run` is in Firebase authorized domains |
| Container won't start | Check `.env` exists with all vars, run `docker compose logs` |
| Site not reachable | Check tunnel config, verify `curl http://localhost:3102` works locally |
| PocketBase not working | Check `curl http://localhost:8091/api/health`, check `docker compose logs pocketbase` |
| Stale build | Run `docker compose build --no-cache` to force full rebuild |
