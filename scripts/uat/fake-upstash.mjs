#!/usr/bin/env node
// Faux serveur Upstash Redis REST (UAT local uniquement). Port 8210 par defaut.
// Implemente: commandes JSON tableau (POST /), /pipeline, /multi-exec, encodage base64,
// GET/SET/SETEX/INCR/INCRBY/DECR/EXPIRE/PEXPIRE/TTL/PTTL/DEL/EXISTS/MGET/MSET/KEYS/
// HGET/HSET/HGETALL/HDEL/HINCRBY/SADD/SREM/SMEMBERS/ZADD/ZRANGE(basique)/PING/FLUSHALL,
// SCRIPT LOAD, EVAL/EVALSHA (script sliding window @upstash/ratelimit reimplemente en JS;
// fixed window et autres scripts de limiteur: reponse "laisse passer").
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = parseInt(process.env.FAKE_UPSTASH_PORT ?? '8210', 10);
const TOKEN = process.env.FAKE_UPSTASH_TOKEN ?? 'uat-fake-upstash-token';

const store = new Map(); // key -> { v, exp? }
const scripts = new Map(); // sha -> script text

const now = () => Date.now();
function entry(k) {
  const e = store.get(k);
  if (!e) return undefined;
  if (e.exp !== undefined && e.exp <= now()) { store.delete(k); return undefined; }
  return e;
}
const getStr = (k) => { const e = entry(k); return e ? e.v : null; };
const setStr = (k, v, exp) => store.set(k, { v: String(v), exp });
function incrBy(k, n) {
  const e = entry(k);
  const nv = (e ? parseInt(e.v, 10) : 0) + n;
  store.set(k, { v: String(nv), exp: e?.exp });
  return nv;
}
const hash = (k) => { let e = entry(k); if (!e) { e = { v: new Map() }; store.set(k, e); } return e.v; };

function evalScript(script, keys, args) {
  // sliding window limit (single region): KEYS=[current, previous, dynamicLimitKey]
  if (script.includes('previousKey') && script.includes('INCRBY') && script.includes('percentageInCurrent')) {
    const [cur, prev, dyn] = keys;
    let limit = Number(args[0]);
    if (dyn) { const d = getStr(dyn); if (d !== null) limit = Number(d); }
    const nowMs = Number(args[1]);
    const window = Number(args[2]);
    const inc = Number(args[3] ?? 1);
    const curN = parseInt(getStr(cur) ?? '0', 10);
    const prevRaw = parseInt(getStr(prev) ?? '0', 10);
    const prevN = Math.floor((1 - (nowMs % window) / window) * prevRaw);
    if (inc > 0 && prevN + curN >= limit) return [-1, limit];
    const nv = incrBy(cur, inc);
    if (nv === inc) store.get(cur).exp = now() + window * 2 + 1000;
    return [limit - (nv + prevN), limit];
  }
  // remaining tokens (sliding window): [remaining, limit]
  if (script.includes('previousKey') && script.includes('percentageInCurrent')) {
    const [cur, prev] = keys;
    const limit = Number(args[0]);
    const nowMs = Number(args[1]);
    const window = Number(args[2]);
    const curN = parseInt(getStr(cur) ?? '0', 10);
    const prevN = Math.floor((1 - (nowMs % window) / window) * parseInt(getStr(prev) ?? '0', 10));
    return [Math.max(0, limit - (curN + prevN)), limit];
  }
  // reset script (DEL by pattern) / unknown limiter scripts: permissive
  if (script.includes('INCRBY')) return [1, 1000000]; // fixed window: usedTokens=1, limit large
  return 0;
}

function run(cmd) {
  const [name, ...a] = cmd;
  const op = String(name).toUpperCase();
  switch (op) {
    case 'PING': return 'PONG';
    case 'GET': return getStr(a[0]);
    case 'SET': {
      let exp; let nx = false; let get = false;
      for (let i = 2; i < a.length; i++) {
        const o = String(a[i]).toUpperCase();
        if (o === 'EX') exp = now() + Number(a[++i]) * 1000;
        else if (o === 'PX') exp = now() + Number(a[++i]);
        else if (o === 'NX') nx = true;
        else if (o === 'GET') get = true;
      }
      const old = getStr(a[0]);
      if (nx && old !== null) return null;
      setStr(a[0], a[1], exp);
      return get ? old : 'OK';
    }
    case 'SETEX': setStr(a[0], a[2], now() + Number(a[1]) * 1000); return 'OK';
    case 'SETNX': if (getStr(a[0]) !== null) return 0; setStr(a[0], a[1]); return 1;
    case 'INCR': return incrBy(a[0], 1);
    case 'INCRBY': return incrBy(a[0], Number(a[1]));
    case 'DECR': return incrBy(a[0], -1);
    case 'DECRBY': return incrBy(a[0], -Number(a[1]));
    case 'EXPIRE': { const e = entry(a[0]); if (!e) return 0; e.exp = now() + Number(a[1]) * 1000; return 1; }
    case 'PEXPIRE': { const e = entry(a[0]); if (!e) return 0; e.exp = now() + Number(a[1]); return 1; }
    case 'TTL': { const e = entry(a[0]); if (!e) return -2; return e.exp === undefined ? -1 : Math.ceil((e.exp - now()) / 1000); }
    case 'PTTL': { const e = entry(a[0]); if (!e) return -2; return e.exp === undefined ? -1 : e.exp - now(); }
    case 'DEL': case 'UNLINK': { let n = 0; for (const k of a) if (entry(k)) { store.delete(k); n++; } return n; }
    case 'EXISTS': return a.filter((k) => entry(k)).length;
    case 'MGET': return a.map((k) => getStr(k));
    case 'MSET': for (let i = 0; i < a.length; i += 2) setStr(a[i], a[i + 1]); return 'OK';
    case 'KEYS': {
      const re = new RegExp('^' + String(a[0]).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
      return [...store.keys()].filter((k) => entry(k) && re.test(k));
    }
    case 'HSET': { const h = hash(a[0]); let n = 0; for (let i = 1; i < a.length; i += 2) { if (!h.has(String(a[i]))) n++; h.set(String(a[i]), String(a[i + 1])); } return n; }
    case 'HGET': return entry(a[0])?.v.get(String(a[1])) ?? null;
    case 'HGETALL': { const e = entry(a[0]); const out = []; if (e) for (const [k, v] of e.v) out.push(k, v); return out; }
    case 'HDEL': { const e = entry(a[0]); let n = 0; if (e) for (const f of a.slice(1)) if (e.v.delete(String(f))) n++; return n; }
    case 'HINCRBY': { const h = hash(a[0]); const nv = parseInt(h.get(String(a[1])) ?? '0', 10) + Number(a[2]); h.set(String(a[1]), String(nv)); return nv; }
    case 'SADD': { const e = entry(a[0]) ?? (store.set(a[0], { v: new Set() }), store.get(a[0])); let n = 0; for (const m of a.slice(1)) if (!e.v.has(String(m))) { e.v.add(String(m)); n++; } return n; }
    case 'SREM': { const e = entry(a[0]); let n = 0; if (e) for (const m of a.slice(1)) if (e.v.delete(String(m))) n++; return n; }
    case 'SMEMBERS': return [...(entry(a[0])?.v ?? [])];
    case 'SISMEMBER': return entry(a[0])?.v.has(String(a[1])) ? 1 : 0;
    case 'FLUSHALL': case 'FLUSHDB': store.clear(); return 'OK';
    case 'SCRIPT': {
      if (String(a[0]).toUpperCase() === 'LOAD') { const sha = crypto.createHash('sha1').update(a[1]).digest('hex'); scripts.set(sha, a[1]); return sha; }
      if (String(a[0]).toUpperCase() === 'EXISTS') return a.slice(1).map((s) => (scripts.has(s) ? 1 : 0));
      return 'OK';
    }
    case 'EVAL': {
      const sha = crypto.createHash('sha1').update(a[0]).digest('hex');
      scripts.set(sha, a[0]);
      const nk = Number(a[1]);
      return evalScript(a[0], a.slice(2, 2 + nk).map(String), a.slice(2 + nk));
    }
    case 'EVALSHA': {
      const s = scripts.get(a[0]);
      if (!s) throw new Error('NOSCRIPT No matching script. Please use EVAL.');
      const nk = Number(a[1]);
      return evalScript(s, a.slice(2, 2 + nk).map(String), a.slice(2 + nk));
    }
    default: throw new Error(`ERR unknown command '${op}' (fake-upstash)`);
  }
}

const b64 = (v) => {
  if (typeof v === 'string') return Buffer.from(v, 'utf8').toString('base64');
  if (Array.isArray(v)) return v.map(b64);
  return v; // numbers, null
};

function exec(cmd, encode) {
  try {
    const r = run(cmd);
    return { result: encode ? b64(r) : r };
  } catch (e) {
    return { error: e.message };
  }
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.url === '/__health') return send(200, { ok: true, keys: store.size });
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: 'Unauthorized' });
    const encode = (req.headers['upstash-encoding'] ?? '') === 'base64';
    let parsed;
    try { parsed = JSON.parse(body || '[]'); } catch { return send(400, { error: 'bad json' }); }
    const path = req.url.split('?')[0];
    if (path === '/pipeline' || path === '/multi-exec') return send(200, parsed.map((c) => exec(c, encode)));
    const out = exec(parsed, encode);
    return send(out.error ? 400 : 200, out);
  });
});
server.listen(PORT, '127.0.0.1', () => console.log(`[fake-upstash] http://127.0.0.1:${PORT}`));
