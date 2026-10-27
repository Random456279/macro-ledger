/* Where the page runs and how it reaches storage and Claude.
   Three backends: 'artifact' (claude.ai capabilities), 'api' (the standalone Worker on the same origin,
   authorized by a device key), or 'local' (this device only). This module owns the API client and the
   "ask Claude for JSON" call so ai.js never cares which backend answers. */
import { S } from './state.js';

export const API = { base: '/api', key: null, online: true, lastSync: 0 };
const KEY_LS = 'macroledger.key';

/* The standalone shell sets window.__ML_STANDALONE__ before the app script runs. */
export const isStandalone = () => typeof window !== 'undefined' && !!window.__ML_STANDALONE__;
export function loadKey() { try { API.key = localStorage.getItem(KEY_LS) || null; } catch (e) { API.key = null; } return API.key; }
export function saveKey(k) { API.key = k; try { localStorage.setItem(KEY_LS, k); } catch (e) { /* ignore */ } }
export function clearKey() { API.key = null; try { localStorage.removeItem(KEY_LS); } catch (e) { /* ignore */ } }

async function call(method, path, body) {
  let res;
  try {
    res = await fetch(API.base + path, { method, headers: Object.assign({ authorization: 'Bearer ' + (API.key || '') }, body ? { 'content-type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  } catch (e) { API.online = false; throw { code: 'offline', message: 'No connection' }; }
  API.online = true;
  let data = null; try { data = await res.json(); } catch (e) { data = null; }
  if (res.ok) return data;
  throw { code: (data && data.code) || (res.status === 401 ? 'unauthorized' : 'http_' + res.status), message: (data && data.error) || res.statusText, status: res.status };
}
export const apiMe = () => call('GET', '/me');
export const apiGetState = (days = 90) => call('GET', '/state?days=' + days);
export const apiPutDocs = docs => call('POST', '/docs', { docs });
export const apiAsk = payload => call('POST', '/ask', payload);

/* ---- Claude ---- */
export const aiAvailable = () => !!S.ai.sample || (S.mode === 'api' && !!API.key);
export const imagesAvailable = () => S.ai.sample ? !!S.ai.images : (S.mode === 'api' && !!API.key);

/* Resize a photo on the phone before upload: long edge 1280 px, JPEG. Returns base64 without the data: prefix. */
export async function toJpegBase64(file, max = 1280) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { bmp = await createImageBitmap(file); }
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  const dataUrl = c.toDataURL('image/jpeg', 0.85);
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

/* Tolerant JSON extraction, same rules as the artifact runtime: whole text, a code fence, or first {..} / [..]. */
export function parseJsonTolerant(text) {
  if (typeof text !== 'string') return undefined;
  const tries = [text.trim()];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i); if (fence) tries.push(fence[1].trim());
  const a = text.indexOf('{'), b = text.lastIndexOf('}'); if (a > -1 && b > a) tries.push(text.slice(a, b + 1));
  const c = text.indexOf('['), d = text.lastIndexOf(']'); if (c > -1 && d > c) tries.push(text.slice(c, d + 1));
  for (const t of tries) { try { return JSON.parse(t); } catch (e) { /* next */ } }
  return undefined;
}

/* Ask Claude and get one JSON value back, whichever backend is live. Rejects with {code, message, text?}. */
export async function askJSON(prompt, opts = {}) {
  if (S.ai.sample) return S.ai.sample.json(prompt, opts);
  if (S.mode === 'api' && API.key) {
    const images = [];
    for (const f of (opts.images || [])) {
      try { images.push(await toJpegBase64(f)); } catch (e) { throw { code: 'image_rejected', message: 'Could not read that photo' }; }
    }
    const r = await apiAsk({ prompt, images, tier: opts.modelTier === 'default' ? 'default' : 'quick' });
    const v = parseJsonTolerant(r && r.text);
    if (v === undefined) throw { code: 'invalid_json', message: 'No JSON in the reply', text: r && r.text };
    return v;
  }
  throw { code: 'not_granted', message: 'No AI backend available' };
}
