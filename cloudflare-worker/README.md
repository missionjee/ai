# 24/7 Cloudflare Worker Prediction Engine Setup

This worker runs your **v5.2 Institutional Number-First Quantitative Engine** 24/7 on Cloudflare's edge network, polling the 1M lottery API every minute via a Tri-Proxy resilience layer, calculating continuous latent trajectories and 10-class probability distributions, and publishing the official prediction to Supabase (`global_signals`).

All client users receive the **exact same signal, lucky numbers, and history**, regardless of device, browser, or time zone.

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

## Verification & Diagnostic Endpoints

Once deployed, you can verify your worker in the browser:
* **Health Check Endpoint (`/health`):**
  `https://hiroto-engine-worker.<your-subdomain>.workers.dev/health`
  ```json
  {
    "status": "HEALTHY",
    "platform": "Cloudflare Workers 24/7",
    "engine": "v5.2 Institutional Number-First Quantitative Engine",
    "historical_rounds_buffered": 548,
    "upstream_lottery_api": "https://tirangaprediction.ai/api_fixed.php?action=latest_results&source=1M",
    "buffer_target": "2,000-Round FIFO Ring Buffer",
    "timestamp": "2026-08-30T04:20:00.000Z"
  }
  ```

* **Instant Signal Endpoint (`/signal`):**
  `https://hiroto-engine-worker.<your-subdomain>.workers.dev/signal`
  Returns the active Number-First prediction, continuous latent trajectory, entropy metrics, and derived Big/Small without stake units.
