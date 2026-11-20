#!/usr/bin/env node
// Faux API Anthropic Messages (UAT local uniquement). Port 8211 par defaut.
// POST /v1/messages (JSON ou SSE si stream:true). Reponses deterministes en francais.
//
// Appel d'outil force (3 facons):
//  1. Marqueur dans le dernier message utilisateur:  [[tool:nom_outil {"arg":1}]]  (args JSON optionnels)
//  2. File d'attente via  POST /__script  {"tool":"nom","input":{...},"count":1}  (GET /__script liste, DELETE vide)
//  3. Variable d'env FAKE_ANTHROPIC_TOOL / FAKE_ANTHROPIC_TOOL_INPUT (JSON) = outil systematique (si propose)
// L'outil n'est emis que s'il figure dans `tools` de la requete (sinon texte), sauf marqueur ::force
// Apres un tool_result, le faux repond un texte de confirmation (pas de boucle).
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = parseInt(process.env.FAKE_ANTHROPIC_PORT ?? '8211', 10);
const queue = [];
const log = [];

const id = (p) => `${p}_${crypto.randomBytes(9).toString('hex')}`;
const textOf = (content) =>
  typeof content === 'string'
    ? content
    : (content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');

function decide(req) {
  const msgs = req.messages ?? [];
  const last = msgs[msgs.length - 1];
  const hasToolResult = Array.isArray(last?.content) && last.content.some((b) => b.type === 'tool_result');
  const toolNames = (req.tools ?? []).map((t) => t.name);
  if (hasToolResult) {
    // Tour 2 : le SDK (stopWhen: stepCountIs) renvoie le tool_result ; le faux le RESTITUE dans sa reponse
    // et dans le journal (`GET /__script` -> log[].tool_results) pour lire les codes d'erreur (ex. {"ok":false,"error":"..."}).
    const names = new Map();
    for (const m of msgs) {
      if (m.role === 'assistant' && Array.isArray(m.content)) {
        for (const b of m.content) if (b.type === 'tool_use') names.set(b.id, b.name);
      }
    }
    const results = last.content
      .filter((b) => b.type === 'tool_result')
      .map((b) => ({
        tool: names.get(b.tool_use_id) ?? 'inconnu',
        is_error: !!b.is_error,
        content: textOf(b.content) || JSON.stringify(b.content ?? null),
      }));
    // Enchainement : une entree de file `afterResult:true` emet un 2e outil apres ce resultat (tour 3, etc.).
    const q = queue[0];
    if (q?.afterResult && (toolNames.includes(q.tool) || q.force)) {
      const pick = { tool: q.tool, input: q.input ?? {} };
      if (--q.count <= 0) queue.shift();
      return { kind: 'tool', tool: pick.tool, input: pick.input, tool_results: results };
    }
    if (process.env.FAKE_ANTHROPIC_ECHO_RESULT === '0') {
      return { kind: 'text', text: "C'est fait (reponse simulee par le faux Anthropic UAT). L'action demandee a ete executee.", tool_results: results };
    }
    const shown = results.map((r) => `${r.tool}${r.is_error ? ' [erreur]' : ''} -> ${r.content.slice(0, 600)}`).join(' | ');
    return { kind: 'text', text: `C'est fait (reponse simulee par le faux Anthropic UAT). Resultat de l'outil : ${shown}`, tool_results: results };
  }
  const userText = last?.role === 'user' ? textOf(last.content) : '';
  const m = userText.match(/\[\[tool:([A-Za-z0-9_\-]+)(?:\s+(\{[\s\S]*?\}))?\s*(::force)?\]\]/);
  let pick = null;
  if (m) pick = { tool: m[1], input: m[2] ? JSON.parse(m[2]) : {}, force: !!m[3] };
  else if (queue.length && queue[0].text !== undefined && !queue[0].afterResult) {
    // Text script (e.g. a JSON body for routes that parse model text): consumed by the next non-tool-result request.
    const q = queue[0];
    if (--q.count <= 0) queue.shift();
    return { kind: 'text', text: String(q.text) };
  } else if (queue.length && !queue[0].afterResult) {
    const q = queue[0];
    if (q.skip > 0) {
      // `skip`: let the next N requests that offer this tool get the default text first.
      if (toolNames.includes(q.tool)) q.skip--;
    } else if (toolNames.includes(q.tool) || q.force) {
      pick = { tool: q.tool, input: q.input ?? {}, force: q.force };
      if (--q.count <= 0) queue.shift();
    }
  } else if (process.env.FAKE_ANTHROPIC_TOOL) {
    pick = { tool: process.env.FAKE_ANTHROPIC_TOOL, input: JSON.parse(process.env.FAKE_ANTHROPIC_TOOL_INPUT ?? '{}') };
  }
  if (pick && (toolNames.includes(pick.tool) || pick.force)) {
    return { kind: 'tool', tool: pick.tool, input: pick.input };
  }
  // sortie structuree forcee (tool_choice tool) sans script: appelle l'outil impose avec {}
  if (req.tool_choice?.type === 'tool' && req.tool_choice.name) {
    return { kind: 'tool', tool: req.tool_choice.name, input: {} };
  }
  const note = pick ? ` (outil "${pick.tool}" demande mais non propose dans cette requete)` : '';
  return { kind: 'text', text: `Reponse simulee du coach IA (faux Anthropic UAT)${note}. Tu as ecrit: "${userText.slice(0, 120)}".` };
}

function nonStream(req, d) {
  const base = { id: id('msg'), type: 'message', role: 'assistant', model: req.model ?? 'claude-fake', stop_sequence: null };
  if (d.kind === 'tool') {
    return { ...base, content: [{ type: 'tool_use', id: id('toolu'), name: d.tool, input: d.input }], stop_reason: 'tool_use', usage: { input_tokens: 25, output_tokens: 15 } };
  }
  return { ...base, content: [{ type: 'text', text: d.text }], stop_reason: 'end_turn', usage: { input_tokens: 25, output_tokens: Math.ceil(d.text.length / 4) } };
}

function sse(res, req, d) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  ev('message_start', { message: { id: id('msg'), type: 'message', role: 'assistant', model: req.model ?? 'claude-fake', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 25, output_tokens: 1 } } });
  if (d.kind === 'tool') {
    ev('content_block_start', { index: 0, content_block: { type: 'tool_use', id: id('toolu'), name: d.tool, input: {} } });
    const json = JSON.stringify(d.input);
    const mid = Math.max(1, Math.floor(json.length / 2));
    ev('content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: json.slice(0, mid) } });
    ev('content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: json.slice(mid) } });
    ev('content_block_stop', { index: 0 });
    ev('message_delta', { delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 15 } });
  } else {
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
    const words = d.text.split(/(?<=\s)/);
    for (const w of words) ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: w } });
    ev('content_block_stop', { index: 0 });
    ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: Math.ceil(d.text.length / 4) } });
  }
  ev('message_stop', {});
  res.end();
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const json = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    const path = req.url.split('?')[0];
    if (path === '/__health') return json(200, { ok: true, queue: queue.length, calls: log.length });
    if (path === '/__script') {
      if (req.method === 'GET') return json(200, { queue, log: log.slice(-20) });
      if (req.method === 'DELETE') { queue.length = 0; return json(200, { ok: true }); }
      const s = JSON.parse(body || '{}');
      queue.push({ tool: s.tool, input: s.input ?? {}, count: s.count ?? 1, force: !!s.force, afterResult: !!s.afterResult, skip: s.skip ?? 0, ...(s.text !== undefined ? { text: s.text } : {}) });
      return json(200, { ok: true, queued: queue.length });
    }
    if (path === '/v1/messages' && req.method === 'POST') {
      let r;
      try { r = JSON.parse(body); } catch { return json(400, { type: 'error', error: { type: 'invalid_request_error', message: 'bad json' } }); }
      const d = decide(r);
      log.push({ at: new Date().toISOString(), model: r.model, stream: !!r.stream, tools: (r.tools ?? []).length, decision: d.kind === 'tool' ? `tool:${d.tool}` : 'text', ...(d.tool_results ? { tool_results: d.tool_results } : {}) });
      if (r.stream) return sse(res, r, d);
      return json(200, nonStream(r, d));
    }
    json(404, { type: 'error', error: { type: 'not_found_error', message: `fake-anthropic: ${req.method} ${path}` } });
  });
});
server.listen(PORT, '127.0.0.1', () => console.log(`[fake-anthropic] http://127.0.0.1:${PORT}`));
