/**
 * Phase 23 (v1.20) - client HTTP de l'atelier (fetch et XHR factices).
 * Prouve : le flux SSE est decoupe en evenements meme coupe en plein milieu, 402/502 rejettent avec le statut
 * (pas d'evenement), l'abandon annule la requete, le PATCH manuel ne passe que par /drafts/:id (aucun /stream).
 * Ne prouve PAS le comportement reel d'XMLHttpRequest sous React Native ni du reseau mobile.
 */
import { describe, it, expect, vi } from 'vitest';
import { createAtelierClient, AtelierHttpError } from '../atelierService';
import type { AtelierEvent } from '../atelier';

class FakeXhr {
  static last: FakeXhr;
  status = 0;
  responseText = '';
  headers: Record<string, string> = {};
  method = '';
  url = '';
  sent: string | null = null;
  aborted = false;
  onprogress: (() => void) | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  constructor() { FakeXhr.last = this; }
  open(m: string, u: string) { this.method = m; this.url = u; }
  setRequestHeader(k: string, v: string) { this.headers[k] = v; }
  send(b: string) { this.sent = b; }
  abort() { this.aborted = true; }
  push(text: string) { this.status = 200; this.responseText += text; this.onprogress?.(); }
  finish(status = 200) { this.status = status; this.onload?.(); }
}

const client = (over: Partial<Parameters<typeof createAtelierClient>[0]> = {}) =>
  createAtelierClient({ apiUrl: 'http://api', getToken: async () => 'tok', xhrFactory: () => new FakeXhr() as any, ...over });

describe('streamTurn', () => {
  it('parses events across chunk boundaries and resolves at the end', async () => {
    const events: AtelierEvent[] = [];
    const p = client().streamTurn({ message: 'go', draftId: null, onEvent: (e) => events.push(e) });
    await Promise.resolve();
    await Promise.resolve();
    const x = FakeXhr.last;
    expect(x.url).toBe('http://api/ai/workshop/stream');
    expect(x.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(x.sent!)).toEqual({ message: 'go' });
    x.push('data: {"type":"meta","draft_id":"d1","conversation_id":"c1","cost":4}\n\ndata: {"type":"chu');
    x.push('nk","content":"Salut"}\n\ndata: {"type":"tool","id":"t","name":"workshop_load_skill","state":"start","label":"Skill"}\n\n');
    x.push('data: {"type":"done"}\n\ndata: [DONE]\n\n');
    x.finish(200);
    await p;
    expect(events.map((e) => e.type)).toEqual(['meta', 'chunk', 'tool', 'done']);
    expect(events[1]).toEqual({ type: 'chunk', content: 'Salut' });
  });

  it('sends the draft id for follow-up turns', async () => {
    const p = client().streamTurn({ message: 'x', draftId: 'd9', onEvent: () => {} });
    await Promise.resolve();
    await Promise.resolve();
    expect(JSON.parse(FakeXhr.last.sent!)).toEqual({ message: 'x', draft_id: 'd9' });
    FakeXhr.last.finish(200);
    await p;
  });

  it('rejects with the status and body on 402 and 502, and emits no event', async () => {
    const onEvent = vi.fn();
    const p = client().streamTurn({ message: 'x', draftId: null, onEvent });
    await Promise.resolve();
    await Promise.resolve();
    FakeXhr.last.responseText = '{"error":"insufficient_credits","balance":1,"required":4}';
    FakeXhr.last.finish(402);
    await expect(p).rejects.toMatchObject({ status: 402, body: { error: 'insufficient_credits', required: 4 } });
    const p2 = client().streamTurn({ message: 'x', draftId: null, onEvent });
    await Promise.resolve();
    await Promise.resolve();
    FakeXhr.last.responseText = '{"error":"ai_unavailable"}';
    FakeXhr.last.finish(502);
    await expect(p2).rejects.toBeInstanceOf(AtelierHttpError);
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('network error rejects with status 0; abort cancels the request', async () => {
    const p = client().streamTurn({ message: 'x', draftId: null, onEvent: () => {} });
    await Promise.resolve();
    await Promise.resolve();
    FakeXhr.last.onerror?.();
    await expect(p).rejects.toMatchObject({ status: 0 });

    const ac = new AbortController();
    const p2 = client().streamTurn({ message: 'x', draftId: null, signal: ac.signal, onEvent: () => {} });
    await Promise.resolve();
    await Promise.resolve();
    ac.abort();
    await expect(p2).rejects.toMatchObject({ status: -1 });
    expect(FakeXhr.last.aborted).toBe(true);
  });

  it('refuses without a token', async () => {
    await expect(client({ getToken: async () => null }).streamTurn({ message: 'x', draftId: null, onEvent: () => {} })).rejects.toMatchObject({ status: 401 });
  });
});

describe('REST calls', () => {
  const okJson = (body: unknown, status = 200) => vi.fn(async () => ({ ok: status < 400, status, json: async () => body })) as any;

  it('patchDraft hits PATCH /drafts/:id only (never /stream: zero credit) with expected_revision', async () => {
    const f = okJson({ draft: { id: 'd1', revision: 3 } });
    const res = await client({ fetchImpl: f }).patchDraft('d1', 2, [{ op: 'update_exercise', week: 1, session: 0, index: 0, patch: { sets: 6 } }]);
    expect(res.draft.revision).toBe(3);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('http://api/ai/workshop/drafts/d1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body).expected_revision).toBe(2);
    expect(f.mock.calls.every((c: any[]) => !String(c[0]).includes('/stream'))).toBe(true);
  });

  it('409 on a stale revision surfaces the current draft', async () => {
    const f = okJson({ error: 'conflict', draft: { id: 'd1', revision: 5 } }, 409);
    await expect(client({ fetchImpl: f }).patchDraft('d1', 2, [])).rejects.toMatchObject({ status: 409, body: { draft: { revision: 5 } } });
  });

  it('getInfo, getDraft and publishDraft call the expected routes', async () => {
    const f = okJson({ cost: 4 });
    const c = client({ fetchImpl: f });
    await c.getInfo();
    await c.getDraft('d1');
    await c.publishDraft('d1');
    expect(f.mock.calls.map((x: any[]) => `${x[1].method} ${x[0]}`)).toEqual([
      'GET http://api/ai/workshop/info',
      'GET http://api/ai/workshop/drafts/d1',
      'POST http://api/ai/workshop/drafts/d1/publish',
    ]);
  });
});
