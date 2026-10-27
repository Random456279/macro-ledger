// One-command deploy of the standalone Macro Ledger to Cloudflare.
//   node tools/setup.mjs            full run: D1 database, schema, device key, secret, build, deploy
//   node tools/setup.mjs --new-key  mint one more device key (another phone, or a friend) and print it
//   node tools/setup.mjs --deploy   build and deploy only (code change)
// Auth: either `npx wrangler login` once, or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in the environment.
// The Anthropic key is read from ANTHROPIC_API_KEY if set, otherwise prompted for; it is stored only as a Worker secret.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const isWin = process.platform === 'win32';

function wr(cmdArgs, opts = {}) {
  const r = spawnSync(isWin ? 'npx.cmd' : 'npx', ['wrangler', ...cmdArgs], { cwd: root, encoding: 'utf8', input: opts.input, env: process.env, shell: isWin, stdio: ['pipe', 'pipe', 'pipe'] });
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0 && !opts.allowFail) { console.error(out); throw new Error('wrangler ' + cmdArgs[0] + ' failed'); }
  return out;
}
const log = m => console.log('\n' + m);
const dbName = 'macro-ledger';
const tomlPath = path.join(root, 'wrangler.toml');

function ensureDatabase() {
  let toml = fs.readFileSync(tomlPath, 'utf8');
  const cur = (toml.match(/database_id\s*=\s*"([^"]+)"/) || [])[1];
  if (cur && !cur.startsWith('00000000')) { log('Database already configured (' + cur + ').'); return; }
  log('Creating the D1 database…');
  let out = wr(['d1', 'create', dbName], { allowFail: true });
  let id = (out.match(/database_id\s*=\s*"([0-9a-f-]{36})"/) || [])[1];
  if (!id) {
    const list = wr(['d1', 'list', '--json']);
    const row = JSON.parse(list.slice(list.indexOf('['))).find(d => d.name === dbName);
    if (!row) { console.error(out); throw new Error('Could not create or find the D1 database'); }
    id = row.uuid;
  }
  toml = toml.replace(/database_id\s*=\s*"[^"]*"/, 'database_id = "' + id + '"');
  fs.writeFileSync(tomlPath, toml);
  log('Database id written to wrangler.toml.');
}
function applySchema() { log('Applying the schema…'); wr(['d1', 'execute', dbName, '--remote', '--file', 'worker/schema.sql', '-y']); }
function mintKey(label) {
  const key = 'ml_' + crypto.randomBytes(24).toString('base64url');
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const user = args.has('--user') ? process.argv[process.argv.indexOf('--user') + 1] : 'owner';
  wr(['d1', 'execute', dbName, '--remote', '-y', '--command', `INSERT INTO devices (key_hash, user_id, label, created) VALUES ('${hash}', '${user}', '${label.replace(/'/g, '')}', ${Date.now()})`]);
  return key;
}
function hasDevices() {
  const out = wr(['d1', 'execute', dbName, '--remote', '--json', '-y', '--command', 'SELECT COUNT(*) AS n FROM devices']);
  try { const j = JSON.parse(out.slice(out.indexOf('['))); return (j[0].results[0].n | 0) > 0; } catch (e) { return false; }
}
async function setSecret() {
  let key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    key = (await rl.question('Anthropic API key (sk-ant-…), or Enter to skip for now: ')).trim(); rl.close();
  }
  if (!key) { log('Skipped the AI key. Scanning will say "server has no AI key" until you run: npx wrangler secret put ANTHROPIC_API_KEY'); return; }
  log('Storing the Anthropic key as a Worker secret…');
  wr(['secret', 'put', 'ANTHROPIC_API_KEY'], { input: key + '\n' });
}
function buildAndDeploy() {
  log('Building…');
  const b = spawnSync(process.execPath, [path.join(root, 'tools/build.mjs'), '--standalone'], { cwd: root, encoding: 'utf8' });
  if (b.status !== 0) { console.error(b.stdout, b.stderr); throw new Error('build failed'); }
  log('Deploying…');
  const out = wr(['deploy']);
  const url = (out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/) || [])[0];
  return url;
}

(async () => {
  const who = wr(['whoami'], { allowFail: true });
  if (/not authenticated|You are not logged in|Unable to authenticate/i.test(who)) {
    console.error('Not logged in to Cloudflare. Run `npx wrangler login` (opens a browser) or set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.');
    process.exit(1);
  }
  if (args.has('--new-key')) { ensureDatabase(); const k = mintKey('extra device ' + new Date().toISOString().slice(0, 10)); log('New device key (shown once):\n\n   ' + k + '\n'); return; }
  if (args.has('--deploy')) { const url = buildAndDeploy(); log('Deployed' + (url ? ': ' + url : '.')); return; }
  ensureDatabase();
  applySchema();
  let key = null;
  if (!hasDevices()) key = mintKey('first phone');
  await setSecret();
  const url = buildAndDeploy();
  log('Done.' + (url ? '\n\nOpen this on your iPhone in Safari, then Share → Add to Home Screen:\n\n   ' + url : ''));
  if (key) log('Your device key (shown once; paste it into the app when it asks):\n\n   ' + key + '\n\nNeed another phone or a friend later: node tools/setup.mjs --new-key');
  else log('No new device key minted (one already exists). For another: node tools/setup.mjs --new-key');
})().catch(e => { console.error('\n' + e.message); process.exit(1); });
