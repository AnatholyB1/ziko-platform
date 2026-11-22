/**
 * Review A #1 : ai_programs_generate passe par la RPC ziko_set_active_program (un seul programme actif)
 * et ne stocke jamais du texte brut comme programme. generateText est mocke (aucun appel Anthropic).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateText = vi.fn();
vi.mock('ai', () => ({ generateText: (...a: unknown[]) => generateText(...a) }));

const calls: { insert?: any; rpc?: any[]; deleted?: boolean } = {};
let rpcError: { message: string } | null = null;
const db = {
  from: vi.fn(() => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      order: vi.fn(() => chain),
      in: vi.fn(() => chain),
      single: vi.fn(async () => ({ data: { id: 'new-id', name: 'P', goal: 'g', days_per_week: 3 }, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      insert: vi.fn((row: any) => { calls.insert = row; return chain; }),
      delete: vi.fn(() => { calls.deleted = true; return chain; }),
      then: (res: any) => res({ data: null, error: null }),
    };
    return chain;
  }),
  rpc: vi.fn(async (...a: any[]) => { (calls.rpc ??= []).push(a); return { error: rpcError }; }),
};
vi.mock('./db.js', () => ({ clientForUser: () => db }));

import { ai_programs_generate, parseProgramJson } from './ai-programs.js';

beforeEach(() => {
  generateText.mockReset();
  db.rpc.mockClear();
  for (const k of Object.keys(calls)) delete (calls as any)[k];
  rpcError = null;
});

describe('parseProgramJson', () => {
  it('parse JSON, fences et JSON entoure de texte', () => {
    expect(parseProgramJson('{"name":"A"}')).toEqual({ name: 'A' });
    expect(parseProgramJson('```json\n{"name":"B"}\n```')).toEqual({ name: 'B' });
    expect(parseProgramJson('Voici: {"name":"C"} fin')).toEqual({ name: 'C' });
  });
  it("rejette tout ce qui n'est pas un objet JSON", () => {
    expect(parseProgramJson('pas du json')).toBeNull();
    expect(parseProgramJson('[1,2]')).toBeNull();
    expect(parseProgramJson('{ oups')).toBeNull();
  });
});

describe('ai_programs_generate', () => {
  it('insere inactif puis active via la RPC (kind ai)', async () => {
    generateText.mockResolvedValue({ text: '{"name":"Prog","weeks":[]}' });
    const out: any = await ai_programs_generate({ goal: 'muscle', days_per_week: 3 }, 'u1', 'tok');
    expect(calls.insert.is_active).toBe(false);
    expect(calls.rpc?.[0]).toEqual(['ziko_set_active_program', { p_kind: 'ai', p_program_id: 'new-id' }]);
    expect(out.success).toBe(true);
    expect(out.program.is_active).toBe(true);
  });
  it('JSON invalide : erreur, aucun insert de {raw}', async () => {
    generateText.mockResolvedValue({ text: 'desole je ne peux pas' });
    await expect(ai_programs_generate({ goal: 'muscle', days_per_week: 3 }, 'u1', 'tok')).rejects.toThrow(/illisible/);
    expect(calls.insert).toBeUndefined();
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('echec de la RPC : ligne orpheline supprimee et erreur remontee', async () => {
    generateText.mockResolvedValue({ text: '{"name":"Prog"}' });
    rpcError = { message: 'boom' };
    await expect(ai_programs_generate({ goal: 'muscle', days_per_week: 3 }, 'u1', 'tok')).rejects.toThrow(/boom/);
    expect(calls.deleted).toBe(true);
  });
});
