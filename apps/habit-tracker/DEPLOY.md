# Habit Tracker — Mac Mini Deployment Guide

## Prerequisites

- Mac Mini running Docker Desktop
- Cloudflare Tunnel (`cloudflared`) configured
- SSH access to Mac Mini

---

## 1. Clone the repo

```bash
ssh mac-mini
cd ~
git clone https://github.com/anandkanav92/auth-workspace.git
cd auth-workspace/apps/habit-tracker
```

---

## 2. Create the env file

Firebase config is baked into the build at compile time (Vite replaces `import.meta.env.VITE_*`).

```bash
cat > .env << 'EOF'
VITE_FIREBASE_API_KEY=AIzaSyAn-R5Kf_ifAsuJ8ABZkqiDxBEBVB9OD3U
VITE_FIREBASE_AUTH_DOMAIN=auth-sign-9f463.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=auth-sign-9f463
VITE_FIREBASE_APP_ID=1:666383234446:web:e4fa09a14f168de393a0df
EOF
```

---

## 3. Build and start the container

```bash
docker compose up -d --build
```

Verify it's running:

```bash
docker compose ps
curl -I http://localhost:3100
```

Expected: HTTP 200 serving the app.

---

## 4. Add Cloudflare Tunnel route

Edit the tunnel config:

```bash
nano ~/.cloudflared/config.yml
```

Add under `ingress` (before the catch-all `- service: http_status:404`):

```yaml
- hostname: habits.cya.run
  service: http://localhost:3100
```

Create the DNS record:

```bash
cloudflared tunnel route dns mac-mini habits.cya.run
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
3. Add `habits.cya.run`

Without this, Google sign-in will fail on the production domain.

---

## 6. Verify

Open **https://habits.cya.run** in your browser.

- Should show the login page
- Sign in with Google should work
- Habits load after sign-in

---

## Updating

To deploy new changes:

```bash
ssh mac-mini
cd ~/auth-workspace
git pull
cd apps/habit-tracker
docker compose up -d --build
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Google sign-in fails | Check `habits.cya.run` is in Firebase authorized domains |
| Container won't start | Check `.env` exists with all 4 vars, run `docker compose logs` |
| Site not reachable | Check tunnel config, verify `curl http://localhost:3100` works locally |
| Stale build | Run `docker compose build --no-cache` to force full rebuild |
