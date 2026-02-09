# Scanner App Deployment Guide

## Platform: Render (Free Tier)

**Why Render:** Free tier, Node.js native, auto-deploy from GitHub, custom domains with free HTTPS, `render.yaml` already configured in repo.

---

## Step 1: Deploy on Render (~5 minutes)

1. Go to **https://render.com** → Sign up / Log in (use GitHub OAuth for easiest setup)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account if not already connected
4. Select repo: **`LoneWolf-Biotech/Scanner`**
5. Branch: **`feature/production-enhancements-2026-02`**
6. Render will auto-detect `render.yaml`. Verify these settings:
   - **Name:** `scanner-app`
   - **Runtime:** Node
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `node backend/server.js`
   - **Instance Type:** **Free**
7. Add **Environment Variables:**

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `3001` |
   | `CORS_ORIGINS` | `https://scanner.lonewolfgenetics.com,https://scanner-app.onrender.com` |
   | `QR_API_KEY` | `9526800f85632346232e6a6a4161c0eb3e5c4b2cb1c45153929ddd70ea296d52` |

8. Click **"Create Web Service"**
9. Wait for build to complete (~2-3 minutes)
10. Note the Render URL: **`scanner-app.onrender.com`** (or similar — check the dashboard)

> ⚠️ **Free tier note:** Render free services spin down after 15 min of inactivity. First request after sleep takes ~30 seconds. This is fine for a scanner app that's used during work hours.

---

## Step 2: Add Custom Domain on Render

1. In Render dashboard → your service → **"Settings"** tab
2. Scroll to **"Custom Domains"**
3. Click **"Add Custom Domain"**
4. Enter: **`scanner.lonewolfgenetics.com`**
5. Render will show you the CNAME target (likely `scanner-app.onrender.com`)
6. Render handles HTTPS/TLS automatically once DNS propagates

---

## Step 3: Add DNS Record on Squarespace

1. Log into **Squarespace** → go to **Settings** → **Domains**
2. Click on **`lonewolfgenetics.com`**
3. Click **"DNS Settings"** (or "Advanced Settings")
4. Click **"Add Record"**
5. Configure:
   - **Type:** `CNAME`
   - **Host:** `scanner`
   - **Value:** `scanner-app.onrender.com` *(use the exact hostname Render gives you)*
   - **TTL:** Leave default (or set to 3600)
6. Click **Save**
7. DNS propagation takes 5–30 minutes (up to 48h in rare cases)

---

## Step 4: Verify Deployment

After DNS propagates, test these:

```bash
# Health check
curl https://scanner.lonewolfgenetics.com/health

# Check CORS headers
curl -I -H "Origin: https://scanner.lonewolfgenetics.com" https://scanner.lonewolfgenetics.com/health

# Test a scan page (should return HTML even if no mapping exists)
curl https://scanner.lonewolfgenetics.com/s/TEST001
```

Expected `/health` response:
```json
{"status":"ok","timestamp":"...","uptime":...}
```

---

## Notes

- **In-memory storage:** QR mappings reset on every deploy/restart. The app is designed this way — the HQ workbook is the source of truth. This is fine for the scanner's use case.
- **Auto-deploy:** Any push to `feature/production-enhancements-2026-02` will auto-deploy on Render.
- **Upgrade path:** If you need persistent QR mappings or zero cold-start, upgrade to Render's $7/mo paid tier (always-on + persistent disk). Or add a free PostgreSQL/Redis addon.
- **Zebra printer:** The `ZEBRA_PRINTER_IP`/`ZEBRA_PRINTER_PORT` env vars are for local network printing — not needed in cloud deployment (printer access is from the browser/local network, not the server).

---

## Quick Reference

| Item | Value |
|------|-------|
| **Platform** | Render (free tier) |
| **Repo** | `LoneWolf-Biotech/Scanner` |
| **Branch** | `feature/production-enhancements-2026-02` |
| **Render URL** | `scanner-app.onrender.com` (verify after deploy) |
| **Custom Domain** | `scanner.lonewolfgenetics.com` |
| **DNS Record** | CNAME `scanner` → `scanner-app.onrender.com` |
| **QR_API_KEY** | `9526800f85632346232e6a6a4161c0eb3e5c4b2cb1c45153929ddd70ea296d52` |
