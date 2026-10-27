# Moving Macro Ledger to its own URL

The standalone app runs on Cloudflare's free tier: one Worker serves the app and a small API, a D1 database
holds your data, and the Anthropic key lives only on the server. No login screen; the phone holds a device
key you paste once. Cloudflare builds and deploys straight from the GitHub repo, so no tokens are needed
anywhere after setup; every push to `main` goes live in about a minute.

## One-time setup (all in the Cloudflare dashboard, about 10 minutes)

1. **Create the database.** Left menu → Storage & databases → **D1 SQL Database** → Create database →
   name `macro-ledger` → Create. On the database page, copy the **Database ID** (a long UUID) and put it in
   `wrangler.toml` under `database_id` (Claude does this for you if you send it the ID). Tables are created
   automatically on the first request; no SQL to run.
2. **Connect the repo.** Left menu → Compute → Workers & Pages → **Create application** → Workers tab →
   **Import a repository** → connect GitHub and pick `macro-ledger`. Settings on the next screen:
   - Project name: `macro-ledger`
   - Production branch: `main`
   - Build command: `npm run build:standalone`
   - Deploy command: `npx wrangler deploy`
   - Root directory: `/`

   Click **Deploy**. The first build takes a minute or two; the app appears at
   `https://macro-ledger.<your-subdomain>.workers.dev`.
3. **Add the AI key.** On the Worker's page → Settings → **Variables and Secrets** → Add → Type **Secret** →
   name `ANTHROPIC_API_KEY` → paste the key → Deploy. (Scanning works from the next request; everything else
   works without it.)
4. **Phone.** Open the URL in Safari, paste your device key when asked, then Share → **Add to Home Screen**.
5. **Move your data.** In the old claude.ai version: Me → Copy backup. In the new one: Me → Import backup → paste.

## Device keys

The owner's key is configured as a hash in `wrangler.toml` (`OWNER_KEY_HASH`); the key itself is shown once and
lives only on your phone. To rotate it, generate a new key, replace the hash, push. For another phone or a
friend, add a row to the `devices` table (D1 → macro-ledger → Console):

```sql
INSERT INTO devices (key_hash, user_id, label, created) VALUES ('<sha256 of the new key>', 'friend-name', 'label', 0);
```

`node -e "const c=require('crypto');const k='ml_'+c.randomBytes(24).toString('base64url');console.log(k, c.createHash('sha256').update(k).digest('hex'))"`
prints a fresh key and its hash. A different `user_id` gets completely separate data.

## Day-to-day

- Updates: push to `main` (Claude does this). The app picks up a new build on its next launch while online;
  offline it keeps running the last one.
- Offline: logging works without a connection and syncs when it returns (Me → Data shows pending counts).
  Scanning and estimates need the network.
- Costs: the Cloudflare free tier covers this many times over (100k requests a day, 5 GB of D1). Anthropic
  usage shows in Me → Data once connected; the server caps AI calls at 150 a day per user.
- Backups: Me → Copy backup gives you the whole dataset as text whenever you want it.

## Alternative: deploy from a terminal

`tools/setup.mjs` does the same job from a machine that can reach Cloudflare's API: `npx wrangler login`,
then `npm run setup` (creates the database, mints a device key into the `devices` table, stores the secret,
deploys). `npm run deploy` redeploys. Useful if you ever move off GitHub-driven builds.

## Local development

```
npm test                 # artifact build + headless suite
npm run test:standalone  # standalone build against a local Worker (wrangler dev, AI stubbed)
npm run dev              # local Worker at http://localhost:8787 with a stubbed AI
```
