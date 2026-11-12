#!/usr/bin/env node
// Preuves backend UAT: /health, /credits/balance (auth), POST /ai/chat, POST /ai/chat avec outil force.
// Login uat-athlete via l'API auth de la branche; mot de passe jamais affiche.
import { readFileSync } from 'node:fs';
const uatEnv = process.argv.slice(2).find((a) => !a.startsWith('--')) ??'C:/ziko-platform/.claude/worktrees/integration-v1.20/.uat/env';
const e = Object.fromEntries(readFileSync(uatEnv, 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1)]));
if (!e.SUPABASE_URL.includes('oloobswzsziidjwycthm')) throw new Error('mauvaise branche');
const API = process.env.UAT_API ?? 'http://127.0.0.1:8200';
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };

const h = await fetch(`${API}/health`);
console.log('GET /health ->', h.status, await j(h));

const lr = await fetch(`${e.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: e.SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ email: e.UAT_ATHLETE_EMAIL, password: e.UAT_ATHLETE_PASSWORD }),
});
const login = await j(lr);
console.log('login uat-athlete ->', lr.status, login.user?.email);
const auth = { Authorization: `Bearer ${login.access_token}`, 'content-type': 'application/json' };

const b = await fetch(`${API}/credits/balance`, { headers: auth });
console.log('GET /credits/balance ->', b.status, JSON.stringify(await j(b)).slice(0, 300));

const noauth = await fetch(`${API}/credits/balance`);
console.log('GET /credits/balance sans token ->', noauth.status);

const chat = async (content) => {
  const r = await fetch(`${API}/ai/chat`, { method: 'POST', headers: auth, body: JSON.stringify({ messages: [{ role: 'user', content }] }) });
  return [r.status, JSON.stringify(await j(r)).slice(0, 400)];
};
console.log('POST /ai/chat ->', ...(await chat('Bonjour coach')));
if (process.argv.includes('--tool')) console.log('POST /ai/chat [[tool]] ->', ...(await chat('Ajoute 500 ml. [[tool:hydration_log {"amount_ml":500}]]')));
const st = await fetch(`${API}/ai/chat/stream`, { method: 'POST', headers: auth, body: JSON.stringify({ messages: [{ role: 'user', content: 'Salut en stream' }] }) });
console.log('POST /ai/chat/stream ->', st.status, (await st.text()).slice(0, 300).replace(/\n/g, ' | '));
const a = await fetch('http://127.0.0.1:8211/__script');
console.log('fake-anthropic log ->', JSON.stringify((await a.json()).log));
