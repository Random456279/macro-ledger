/* Macro Ledger server: one Cloudflare Worker that serves the static app and a small JSON API.
   Auth is a device key (random secret the phone stores once); its sha256 is looked up in D1.
   Routes (all under /api, all need `Authorization: Bearer <device key>`):
     GET  /api/me            -> { user, usage: {month, calls, inTokens, outTokens, estCostUsd} }
     GET  /api/state?days=90 -> { profile, foods, meals, days, serverTime }
     POST /api/docs          -> { docs: [{kind, id, data|null, updated}] }  last writer wins, batched
     POST /api/ask           -> { prompt, images: [base64 jpeg], tier } -> { text, usage, model }
   The Anthropic key never leaves the Worker (set with `wrangler secret put ANTHROPIC_API_KEY`). */

const KINDS = new Set(['profile', 'foods', 'meals', 'days', 'workouts', 'templates', 'exercises']);
const DATED = new Set(['days', 'workouts']);   /* ids start with yyyy-mm-dd, so a recent window is an id range */
const MAX_DOC_BYTES = 256 * 1024;
const PRICE = { /* USD per million tokens, for the usage estimate shown in Me */
  'claude-haiku-5-5': [0.10, 0.50], 'claude-sonnet-5-5': [2, 10], 'claude-opus-5-5': [4, 20],
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const err = (message, status, code) => json({ error: message, code: code || null }, status);

async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
/* The owner's key can be configured without touching the database: OWNER_KEY_HASH (a sha256 hex) in
   wrangler.toml vars. Publishing a hash of a 192-bit random key is safe; the key itself never leaves the phone.
   Further keys (another phone, a friend) live in the devices table. */
async function auth(req, env) {
  const h = req.headers.get('authorization') || '';
  const key = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!key || key.length < 16) return null;
  const hash = await sha256(key);
  if (env.OWNER_KEY_HASH && hash === String(env.OWNER_KEY_HASH).toLowerCase()) return 'owner';
  const row = await env.DB.prepare('SELECT user_id FROM devices WHERE key_hash = ?').bind(hash).first();
  return row ? row.user_id : null;
}
const ymdUTC = d => d.toISOString().slice(0, 10);

/* Tables are created on first use, so a fresh deploy needs no manual schema step. Once per isolate. */
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS devices (key_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, label TEXT, created INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS devices_user ON devices(user_id)',
  'CREATE TABLE IF NOT EXISTS docs (user_id TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (user_id, kind, id))',
  'CREATE TABLE IF NOT EXISTS ai_usage (user_id TEXT NOT NULL, day TEXT NOT NULL, calls INTEGER NOT NULL DEFAULT 0, in_tokens INTEGER NOT NULL DEFAULT 0, out_tokens INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day))',
];
let schemaReady = null;
function ensureSchema(env) {
  if (!schemaReady) schemaReady = env.DB.batch(SCHEMA.map(s => env.DB.prepare(s))).catch(e => { schemaReady = null; throw e; });
  return schemaReady;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    let uid;
    try { await ensureSchema(env); uid = await auth(req, env); } catch (e) { return err('database not ready: ' + e.message, 500); }
    if (!uid) return err('unauthorized', 401, 'unauthorized');
    try {
      if (url.pathname === '/api/me' && req.method === 'GET') return json({ user: uid, usage: await usage(env, uid) });
      if (url.pathname === '/api/state' && req.method === 'GET') return json(await getState(env, uid, Number(url.searchParams.get('days')) || 90));
      if (url.pathname === '/api/docs' && req.method === 'POST') { const body = await req.json(); return json(await putDocs(env, uid, Array.isArray(body.docs) ? body.docs : [])); }
      if (url.pathname === '/api/ask' && req.method === 'POST') return await ask(env, uid, await req.json());
      return err('not found', 404);
    } catch (e) { return err(String(e && e.message || e), 500); }
  },
};

async function getState(env, uid, days) {
  const cutoff = ymdUTC(new Date(Date.now() - days * 86400000));
  const rs = await env.DB.prepare("SELECT kind, id, data, updated FROM docs WHERE user_id = ? AND (kind NOT IN ('days', 'workouts') OR id >= ?)").bind(uid, cutoff).all();
  const out = { profile: null, foods: {}, meals: {}, days: {}, workouts: {}, templates: {}, exercises: {}, serverTime: Date.now() };
  for (const r of rs.results || []) {
    let d; try { d = JSON.parse(r.data); } catch (e) { continue; }
    if (r.kind === 'profile') out.profile = d; else if (out[r.kind]) out[r.kind][r.id] = d;
  }
  return out;
}

async function putDocs(env, uid, docs) {
  const stmts = []; let n = 0;
  for (const doc of docs.slice(0, 500)) {
    if (!doc || !KINDS.has(doc.kind)) continue;
    const id = doc.kind === 'profile' ? 'me' : String(doc.id || '');
    if (!id || id.length > 200) continue;
    const updated = Number(doc.updated) || Date.now();
    if (doc.data === null || doc.data === undefined) {
      stmts.push(env.DB.prepare('DELETE FROM docs WHERE user_id = ? AND kind = ? AND id = ? AND updated <= ?').bind(uid, doc.kind, id, updated));
    } else {
      const data = JSON.stringify(doc.data);
      if (data.length > MAX_DOC_BYTES) continue;
      stmts.push(env.DB.prepare('INSERT INTO docs (user_id, kind, id, data, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, kind, id) DO UPDATE SET data = excluded.data, updated = excluded.updated WHERE excluded.updated >= docs.updated').bind(uid, doc.kind, id, data, updated));
    }
    n++;
  }
  if (stmts.length) await env.DB.batch(stmts);
  return { ok: true, applied: n, serverTime: Date.now() };
}

async function usage(env, uid) {
  const month = ymdUTC(new Date()).slice(0, 7);
  const r = await env.DB.prepare('SELECT SUM(calls) AS calls, SUM(in_tokens) AS i, SUM(out_tokens) AS o FROM ai_usage WHERE user_id = ? AND day LIKE ?').bind(uid, month + '%').first();
  const price = PRICE[env.MODEL_QUICK || 'claude-haiku-5-5'] || [1, 5];
  const est = ((r && r.i || 0) * price[0] + (r && r.o || 0) * price[1]) / 1e6;
  return { month, calls: r && r.calls || 0, inTokens: r && r.i || 0, outTokens: r && r.o || 0, estCostUsd: Math.round(est * 100) / 100 };
}

/* The AI proxy. Images arrive as base64 JPEG (the phone downsizes them first). */
async function ask(env, uid, body) {
  const prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, 60000) : '';
  if (!prompt) return err('prompt required', 400, 'invalid_request');
  const images = Array.isArray(body.images) ? body.images.slice(0, 4).filter(s => typeof s === 'string' && s.length < 6e6) : [];
  const tier = body.tier === 'default' ? 'default' : 'quick';
  const model = tier === 'default' ? (env.MODEL_DEFAULT || 'claude-sonnet-5-5') : (env.MODEL_QUICK || 'claude-haiku-5-5');
  const day = ymdUTC(new Date());
  const cap = Number(env.AI_DAILY_CAP) || 150;
  const used = await env.DB.prepare('SELECT calls FROM ai_usage WHERE user_id = ? AND day = ?').bind(uid, day).first();
  if (used && used.calls >= cap) return err('daily AI limit reached (' + cap + ')', 429, 'rate_limited');

  let text, usageIn = 0, usageOut = 0;
  if (env.AI_STUB) {
    const stub = typeof env.AI_STUB === 'string' && env.AI_STUB !== '1' ? env.AI_STUB : JSON.stringify({ kind: 'food', basis: 'label', name: 'Stub Bar', brand: 'Test', servingLabel: '1 bar (45g)', servingGrams: 45, perServing: { kcal: 210, protein: 12, carbs: 20, fat: 9 }, extras: [], confidence: 'high', notes: 'stubbed reply' });
    text = stub; usageIn = 1000; usageOut = 200;
  } else {
    if (!env.ANTHROPIC_API_KEY) return err('ANTHROPIC_API_KEY is not set on the server', 500, 'server_not_configured');
    const content = images.map(data => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }));
    content.push({ type: 'text', text: prompt });
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content }] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data && data.error && data.error.message || ('upstream ' + res.status);
      const code = res.status === 429 || res.status === 529 ? 'rate_limited' : res.status === 401 ? 'server_not_configured' : 'upstream_error';
      return err(msg, res.status === 429 ? 429 : 502, code);
    }
    text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
    usageIn = data.usage && data.usage.input_tokens || 0; usageOut = data.usage && data.usage.output_tokens || 0;
  }
  await env.DB.prepare('INSERT INTO ai_usage (user_id, day, calls, in_tokens, out_tokens) VALUES (?, ?, 1, ?, ?) ON CONFLICT(user_id, day) DO UPDATE SET calls = calls + 1, in_tokens = in_tokens + excluded.in_tokens, out_tokens = out_tokens + excluded.out_tokens').bind(uid, day, usageIn, usageOut).run();
  return json({ text, model, usage: { inTokens: usageIn, outTokens: usageOut } });
}
