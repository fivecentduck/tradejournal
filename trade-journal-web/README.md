# Trade Journal (web)

A simple futures day trading journal with accounts. Static frontend + Vercel serverless API + Redis.

Features: open positions, close positions, full trade entry, trade log, P&L calendar, P&L chart, starting balance,
contract list (ES, MES, NQ, MNQ, NNQ, YM, MYM, RTY, M2K, CL, MCL, GC, MGC, SI, SIL + custom), per-contract fees,
6 UI styles (Minimalist, Plaintext, Aurora, Terminal, Brutalist, Editorial), 4 themes + 2 custom slots, animations, optional loading screen, JSON backup/restore.

## Deploy to Vercel

1. **Push to GitHub.** Create an empty repo, then in this folder:

       git init
       git add .
       git commit -m "Trade Journal"
       git branch -M main
       git remote add origin https://github.com/YOUR-USERNAME/trade-journal-web.git
       git push -u origin main

2. **Import it on Vercel.** vercel.com > Add New > Project > pick the repo. Leave all build settings as they are and click Deploy
   (the first deploy will load but sign-in won't work until steps 3 and 4).
3. **Add a database.** In your Vercel project open **Storage** > **Marketplace** and add a **Redis** store (either the Redis or the
   Upstash option works), then connect it to the project. Vercel adds the connection variable automatically
   (`REDIS_URL`, or `KV_REST_API_URL` + `KV_REST_API_TOKEN` for Upstash). The app detects whichever one is present.
4. **Add a secret.** Project > Settings > Environment Variables > add `SESSION_SECRET` with a long random value
   (run `openssl rand -hex 32`). Apply to Production, Preview and Development.
5. **Redeploy.** Deployments > the latest one > Redeploy. Open the site and create your account.

### Run locally

    npm i -g vercel
    vercel link
    vercel env pull .env.local
    vercel dev

When testing locally everything comes from one IP, so set `DISABLE_IP_LIMIT=1` in `.env.local` to create more than one test account.

## How accounts work

- Username + password. Passwords are hashed with scrypt and a per-user salt; they are never stored in plain text.
- Login uses a signed, HttpOnly, SameSite cookie that lasts 30 days.
- Each journal is saved as one JSON document in Redis under the user's key and auto-saved a moment after every change.
- Sign-in attempts are rate limited per IP and per username. Registration attempts are rate limited per IP.
- Settings > Account lets people sign out or delete their account (this also frees up their IP slot).

## One account per IP: read this

Registration is blocked when an account was already created from the same IP address. Things to know:

- The IP is never stored raw: only a keyed HMAC-SHA256 hash is saved, so the database can't be used to list IPs.
- IPv6 addresses are grouped by their /64 prefix, so one household can't get many accounts from one IPv6 range.
- **Legitimate people will sometimes be blocked:** family members, roommates, offices, schools, and mobile carriers often share one public IP.
- **It is not airtight:** anyone with a VPN or another connection can make a second account. Treat it as a speed bump, not a guarantee.
- Only registration is limited. Signing in works from any network.
- The IP is read from Vercel's `x-vercel-forwarded-for` / `x-real-ip` headers, which Vercel sets itself. If you host this
  somewhere else behind your own proxy, make sure the proxy overwrites those headers or the check can be spoofed.
- To turn the rule off, set the environment variable `DISABLE_IP_LIMIT=1` and redeploy.

## Take profit / stop loss

Open positions can carry a take profit and stop loss (set them when adding the position, or type them straight into the
position card on the Overview). Each position then shows **TP hit** and **SL hit** buttons: one tap closes the trade at that
price with the current time, and a toast lets you **Undo**. Positions show what you'd make or lose at each level
(after estimated fees) and the reward-to-risk ratio.

The trade log has two tick columns: **Ticks / contract** (how far price moved for one contract, so you can judge the trade
itself) and **Total ticks** (that times your contract count).

## Mobile

The app picks its layout automatically: portrait screens (aspect ratio taller than wide), narrow windows, and phones turned
sideways get the mobile layout (bottom tab bar with a + button, trades as cards, bottom-sheet forms). Landscape/desktop
windows get the desktop layout, and it switches live as you resize or rotate.

## Admin account

The account named `admin` gets an extra **Admin** tab: a list of every account (joined date, trades, win rate, P&L, balance) and
a read-only view of any account's trade history. Everyone else never sees the tab, and the server refuses admin requests from
any other account no matter what the browser does.

- Because anyone could otherwise register `admin` first, the name is **reserved**: set `ADMIN_SETUP_CODE` in Vercel
  (Settings > Environment Variables, 8+ characters), redeploy, then register `admin` and type that code in the extra field that appears.
  The admin account is exempt from the one-per-IP rule so it can't be locked out by a regular account on the same network.
- Password hashes and IP data are never returned by the admin API.
- Admin can read everyone's journals, so tell your users. The sign-up screen says so.

## TradingView paper trading

TradingView has no public API for paper-trading accounts, so there is no live connection. Instead:

1. In TradingView: open a chart > Paper Trading panel > Order History tab > tick all columns (Side, Type, Qty, Fill Price,
   Status, Commission, Closing Time, Order ID) > TradingView menu > **Export data** > Order History > Export.
2. In Trade Journal: Trade log (or Settings > Data) > **Import TradingView CSV**.
3. Check the symbol mapping (NQ1!, MESZ2026 and so on are matched to your contracts), then Import.

Filled orders are paired first-in-first-out into closed trades; whatever is still open becomes an open position. Re-importing
is safe: trades already imported are skipped and old open-position snapshots are replaced.

Open positions have a **Current price** box (type the price, see unrealized P&L) and a **Chart** link that opens the
contract on TradingView. There is no free official real-time futures feed, so prices are entered by hand.

## Mac app (syncs with the web version)

The `desktop/` folder is a Mac app (Apple Silicon) that connects to your deployed site. Sign in there with the same
account and your journal is shared between the app and the web. See `desktop/README.md`. Quick version:

    cd desktop
    ./build.sh https://your-journal.vercel.app

## Project layout

    public/        index.html, styles.css, app.js   (the whole UI)
    api/           register, login, logout, me, data, account, admin   (Vercel serverless functions)
    lib/core.js    Redis client, hashing, sessions, IP handling, rate limiting
    vercel.json    security headers (CSP)
    desktop/       Mac app that connects to the deployed site (not deployed to Vercel)

## Notes on trade math

- Fees are per contract, per side (a round trip pays twice).
- P&L = (exit - entry) x direction x contracts x point value - fees, where point value = tick value / tick size.
- Calendar and daily totals use the exit date.
