# Moving Macro Ledger to its own URL

The standalone app runs on Cloudflare's free tier: one Worker serves the app and a small API, a D1 database
holds your data, and the Anthropic key lives only on the server. No login screen; the phone holds a device
key you paste once. Everything below happens in a browser or in one terminal window.

## What you need (about 15 minutes, once)

1. **A Cloudflare account** (free): https://dash.cloudflare.com/sign-up
2. **An Anthropic API key** with a few dollars of credit: https://console.anthropic.com → API Keys → Create Key,
   then Billing → add $5. Label scans and meal estimates cost a few cents a month at normal use.

## Path A: run the deploy yourself on Windows (secrets never leave your machine)

1. Install Node.js (LTS) from https://nodejs.org (one installer, defaults are fine).
2. Unzip the project folder somewhere like `C:\Users\you\macro-ledger`.
3. Open a terminal in that folder (right-click the folder → Open in Terminal) and run:

   ```
   npm install
   npx wrangler login
   npm run setup
   ```

   `wrangler login` opens your browser to approve Cloudflare access. `npm run setup` creates the database,
   asks for your Anthropic key (paste it; it is stored as a Worker secret), builds, deploys, and prints two
   things: the app URL and your device key.
4. On your iPhone, open the URL in Safari, paste the device key when asked, then Share → Add to Home Screen.
5. Move your existing data: in the old (claude.ai) version, Me → Copy backup; in the new one, Me → Import backup
   and paste. Then delete the old icon.

Later changes to the app: Claude sends you an updated zip (or you pull from GitHub) and you run `npm run deploy`.
Another phone, or a friend: `npm run setup -- --new-key` prints a fresh key; each key has its own private data
if you pass `--user name`.

## Path B: let Claude deploy

1. In the Cloudflare dashboard: Manage Account → Account API Tokens → Create Token → Custom token with
   **Workers Scripts: Edit**, **D1: Edit**, **Workers KV Storage: Edit**, **Account Settings: Read** for your account.
   Copy the token, and your Account ID (shown on the Workers & Pages overview page).
2. Send Claude the token, the account ID, and the Anthropic key. Claude runs `npm run setup` from its own
   environment with `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `ANTHROPIC_API_KEY` set, and gives you
   the URL and device key.
3. Afterwards, roll the Cloudflare token (Edit → Roll) if you like; deploys only need a token at deploy time.

## Day-to-day

- Updates: `npm run deploy` (Path A) or Claude deploys (Path B). The app picks up a new build on its next launch
  while online; offline it keeps running the last one.
- Offline: logging works without a connection and syncs when it returns (Me → Data shows "pending" counts).
  Scanning and estimates need the network.
- Costs: Cloudflare free tier covers this many times over (100k requests a day, 5 GB of D1). Anthropic usage
  shows in Me → Data once the server is connected. The server also caps AI calls at 150 a day per user.
- Backups: Me → Copy backup gives you the whole dataset as text whenever you want it.

## Local development

```
npm test                 # artifact build + headless suite
npm run test:standalone  # standalone build against a local Worker (wrangler dev, AI stubbed)
npm run dev              # local Worker at http://localhost:8787 with a stubbed AI
```
