// Le faux Anthropic doit permettre de scripter 2 tours : outil (tour 1) puis reponse qui RESTITUE le resultat
// de l'outil (tour 2), pour lire les codes d'erreur des outils (run3 : P16). Processus reel, HTTP reel.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

const PORT = 18211 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
let proc: ChildProcess;

async function post(p: string, body: unknown) {
  const r = await fetch(`${BASE}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return r.json() as Promise<any>;
}

beforeAll(async () => {
  proc = spawn(process.execPath, [path.resolve(__dirname, 'fake-anthropic.mjs')], {
    env: { ...process.env, FAKE_ANTHROPIC_PORT: String(PORT) },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${BASE}/__health`)).ok) return; } catch { /* pas encore pret */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('fake-anthropic did not start');
});
afterAll(() => { proc?.kill(); });

const tools = [{ name: 'measurements_set_goal', input_schema: { type: 'object' } }, { name: 'second_tool', input_schema: { type: 'object' } }];

describe('fake-anthropic : 2 tours (outil puis reponse avec le resultat)', () => {
  it('tour 1 emet l outil ; tour 2 restitue le tool_result (code d erreur lisible) et le journalise', async () => {
    await post('/__script', { tool: 'measurements_set_goal', input: { measure_key: 'weight' } });
    const turn1 = await post('/v1/messages', { model: 'm', tools, messages: [{ role: 'user', content: 'fixe un objectif' }] });
    expect(turn1.stop_reason).toBe('tool_use');
    const use = turn1.content[0];
    expect(use).toMatchObject({ type: 'tool_use', name: 'measurements_set_goal', input: { measure_key: 'weight' } });

    const turn2 = await post('/v1/messages', {
      model: 'm',
      tools,
      messages: [
        { role: 'user', content: 'fixe un objectif' },
        { role: 'assistant', content: [use] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: use.id, content: '{"ok":false,"error":"goal_exists"}' }] },
      ],
    });
    expect(turn2.stop_reason).toBe('end_turn');
    expect(turn2.content[0].text).toContain('measurements_set_goal');
    expect(turn2.content[0].text).toContain('goal_exists');

    const state = await (await fetch(`${BASE}/__script`)).json();
    const last = state.log[state.log.length - 1];
    expect(last.tool_results).toEqual([{ tool: 'measurements_set_goal', is_error: false, content: '{"ok":false,"error":"goal_exists"}' }]);
  });

  it('afterResult : enchaine un 2e outil apres le resultat du 1er, puis texte', async () => {
    await post('/__script', { tool: 'measurements_set_goal', input: {} });
    await post('/__script', { tool: 'second_tool', input: { a: 1 }, afterResult: true });
    const t1 = await post('/v1/messages', { model: 'm', tools, messages: [{ role: 'user', content: 'go' }] });
    const u1 = t1.content[0];
    const msgs: any[] = [{ role: 'user', content: 'go' }, { role: 'assistant', content: [u1] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: u1.id, content: '{"ok":true}' }] }];
    const t2 = await post('/v1/messages', { model: 'm', tools, messages: msgs });
    expect(t2.content[0]).toMatchObject({ type: 'tool_use', name: 'second_tool', input: { a: 1 } });
    msgs.push({ role: 'assistant', content: [t2.content[0]] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: t2.content[0].id, content: '{"ok":false,"error":"not_found"}' }] });
    const t3 = await post('/v1/messages', { model: 'm', tools, messages: msgs });
    expect(t3.stop_reason).toBe('end_turn');
    expect(t3.content[0].text).toContain('not_found');
  });
});
