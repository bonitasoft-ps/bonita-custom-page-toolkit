// Deploy the built custom-page zip to a Bonita server (Studio embedded or the
// Docker bundle) over the REST API. Same mechanism for both; only the target
// URL changes. Idempotent: creates the page if missing, updates it if present.
//
// Usage:  node scripts/deploy-page.mjs      (or: npm run deploy)
// Config via env (defaults for a local bundle on :8095):
//   BONITA_URL   base URL incl. context, e.g. http://localhost:8095/bonita
//   BONITA_USER  admin/technical user (default install)
//   BONITA_PASS  password (default install)
//   PAGE_ZIP     path to the page zip (default dist/page-__NAME__.zip)
//   PAGE_TOKEN   custom page urlToken (default custompage___NAME__)

import { readFile } from 'node:fs/promises';

const BASE = process.env.BONITA_URL || 'http://localhost:8095/bonita';
const USER = process.env.BONITA_USER || 'install';
const PASS = process.env.BONITA_PASS || 'install';
const ZIP = process.env.PAGE_ZIP || 'dist/page-__NAME__.zip';
const TOKEN = process.env.PAGE_TOKEN || 'custompage___NAME__';

let cookie = '';
let token = '';

function jarFrom(res) {
  const setc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const jar = {};
  cookie.split('; ').filter(Boolean).forEach((c) => { const i = c.indexOf('='); jar[c.slice(0, i)] = c.slice(i + 1); });
  for (const c of setc) { const kv = c.split(';')[0]; const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
  cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  if (jar['X-Bonita-API-Token']) token = jar['X-Bonita-API-Token'];
}
function headers(extra = {}) {
  const h = { ...extra };
  if (cookie) h.Cookie = cookie;
  if (token) h['X-Bonita-API-Token'] = token;
  return h;
}
async function login() {
  const body = new URLSearchParams({ username: USER, password: PASS, redirect: 'false' });
  const res = await fetch(`${BASE}/loginservice`, { method: 'POST', body, redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  jarFrom(res);
  if (!token) throw new Error(`login failed (HTTP ${res.status}) — check BONITA_URL/USER/PASS`);
  console.log(`[deploy-page] login OK on ${BASE} (${res.status})`);
}

async function main() {
  const zip = await readFile(ZIP);
  await login();

  const fd = new FormData();
  fd.append('file', new Blob([zip], { type: 'application/zip' }), ZIP.split(/[\\/]/).pop());
  const up = await fetch(`${BASE}/portal/pageUpload`, { method: 'POST', headers: headers(), body: fd });
  const tmp = (await up.text()).trim().split('::')[0];
  if (up.status >= 300 || !tmp) throw new Error(`pageUpload -> HTTP ${up.status}`);

  const found = await fetch(`${BASE}/API/portal/page?p=0&c=1&f=urlToken=${TOKEN}`, { headers: headers() });
  const list = await found.json().catch(() => []);
  const existing = Array.isArray(list) && list[0]?.id ? list[0].id : null;

  let res;
  if (existing) {
    res = await fetch(`${BASE}/API/portal/page/${existing}`, { method: 'PUT', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ pageZip: tmp }) });
    console.log(`[deploy-page] updated page ${TOKEN} (id=${existing}) -> HTTP ${res.status}`);
  } else {
    res = await fetch(`${BASE}/API/portal/page`, { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ pageZip: tmp }) });
    console.log(`[deploy-page] created page ${TOKEN} -> HTTP ${res.status}`);
  }
  if (res.status >= 300) throw new Error(`deploy -> HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  console.log('[deploy-page] done');
}

main().then(() => process.exit(0)).catch((e) => { console.error('[deploy-page] FAILED:', e.message); process.exit(1); });
