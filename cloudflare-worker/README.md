# 24/7 Cloudflare Worker Prediction Engine Setup

This worker runs your v4.0 Prediction Engine 24/7 on Cloudflare's edge network, polling the 1M lottery API every minute, running statistical models, and publishing the official prediction to Supabase (`global_signals`).

All client users will receive the **exact same signal and history**, regardless of device, browser, or time zone.

---

## Method 1: Web Dashboard (No Installation Required — 2 Minutes)

1. **Log in to Cloudflare:**
   * Go to [dash.cloudflare.com](https://dash.cloudflare.com) (Free account).
2. **Create Worker:**
   * In the left sidebar, click **Workers & Pages** ➔ **Create application** ➔ **Create Worker**.
   * Name: `hiroto-engine-worker` ➔ Click **Deploy**.
3. **Paste the Code:**
   * Click **Edit code** (Quick Edit).
   * Copy the entire contents of [`worker.js`](worker.js) and paste it into the editor, replacing everything.
   * Click **Save and Deploy**.
4. **Set 1-Minute Cron Trigger:**
   * Go to **Settings** ➔ **Triggers** ➔ **Cron Triggers** ➔ **Add Cron Trigger**.
   * Schedule: `* * * * *` (Every minute).
   * Click **Save trigger**.

---

## Method 2: Command Line via Wrangler CLI

If you have Node.js installed locally, deploy directly from this directory:

```bash
cd cloudflare-worker
npx wrangler login
npx wrangler deploy
```

---

## Verification

Once deployed, you can verify it in your browser:
* Visit your Worker's URL (e.g. `https://hiroto-engine-worker.<your-subdomain>.workers.dev/`):
  It will return the live prediction JSON:
  ```json
  {
    "status": "ONLINE",
    "platform": "Cloudflare Workers 24/7",
    "engine": "v4.0 Enterprise",
    "data": {
      "success": true,
      "period": "20260829100010540",
      "prediction": "BIG",
      "confidence": 85,
      "status": "SNIPER",
      "stake": "3U"
    }
  }
  ```
