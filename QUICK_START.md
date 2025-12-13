# MORSE Render Deployment - Quick Start

## 30-Second Summary

Push your code to GitHub, click "Blueprint" in Render, set your Google Gemini API key. Done in 10 minutes.

## Prerequisites (2 minutes)

1. GitHub account with this repo pushed
2. Render account (free): https://render.com/register
3. Google Gemini API key: https://ai.google.dev/

## Deployment (10 minutes)

### Step 1: Validate (30 seconds)

```bash
cd /Users/iudofia/Documents/GitHub/morse
./validate-render-config.sh
```

Should show all green checkmarks.

### Step 2: Push to GitHub (1 minute)

```bash
git add .
git commit -m "Add Render deployment configuration"
git push origin main
```

### Step 3: Deploy on Render (5 minutes)

1. Open https://dashboard.render.com/blueprints
2. Click **"New Blueprint Instance"**
3. Connect your GitHub account (if not connected)
4. Select repository: **morse**
5. Branch: **main**
6. Click **"Apply"**

Render will:
- Create 4 services (frontend, API, database, Redis)
- Run database migrations
- Build Docker images
- Deploy everything

### Step 4: Set API Key (30 seconds)

1. In Render dashboard, click **morse-api** service
2. Click **"Environment"** tab
3. Click **"Add Environment Variable"**
4. Key: `GEMINI_API_KEY`
5. Value: `your_gemini_api_key_from_google`
6. Click **"Save Changes"**

Service will auto-redeploy (~2 minutes).

### Step 5: Test (2 minutes)

1. Wait for all services to show **green "Live"** status
2. Click **morse-frontend** service
3. Copy the URL (like `https://morse-frontend.onrender.com`)
4. Open in browser
5. Create test account
6. Upload audio file
7. Verify transcription works

## Done!

Your app is live at: `https://morse-frontend.onrender.com`

## Common First-Time Issues

### Issue: "Build failed"
**Fix**: Check build logs in the service. Usually a missing dependency.

### Issue: "Transcription not working"
**Fix**: Did you set GEMINI_API_KEY in morse-api environment?

### Issue: "502 Bad Gateway"
**Fix**: Wait 2 more minutes. Services are still starting.

### Issue: "Database connection error"
**Fix**: Check morse-db service is green/live. If not, check logs.

## What's Next?

- **Monitor**: Keep dashboard open, watch logs
- **Custom domain**: Settings → Custom Domain (optional)
- **Alerts**: Settings → Notifications (recommended)
- **Scale**: Wait until you have real users first

## Cost Reminder

- **Free for 90 days** (all services)
- **$21/month after** (or shutdown services)

## Need Help?

1. Check **DEPLOYMENT_CHECKLIST.md** for step-by-step guide
2. Read **RENDER_DEPLOYMENT.md** for troubleshooting
3. See **ARCHITECTURE.md** for technical details
4. Visit **https://community.render.com** for support

---

**Still stuck?** Run the validator again:

```bash
./validate-render-config.sh
```

If it shows errors, fix those first. If all green, the issue is in Render - check service logs.
