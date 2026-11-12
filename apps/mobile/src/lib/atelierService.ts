// Phase 23 (v1.20) - client HTTP de l'atelier IA (backend Hono /ai/workshop/*).
// Le flux SSE passe par XMLHttpRequest (React Native ne streame pas fetch) comme AIBridge ; la fabrique
// XHR est injectable pour les tests. L'edition manuelle (PATCH) ne consomme AUCUN credit.
import { parseSseBuffer, type AtelierEvent, type AtelierOp, type AtelierProgram } from './atelier';

export interface AtelierInfo {
  cost: number;
  balance: number | null;
  free_left: number | null;
  within_free_quota: boolean | null;
  context: { sessions: number; programs: number; records: number };
  latest_draft: { id: string; name: string | null; revision: number; updated_at: string } | null;
}

export interface DraftPayload {
  id: string;
  conversation_id: string | null;
  revision: number;
  status: 'draft' | 'saved';
  saved_program_id: string | null;
  program: AtelierProgram | null;
}

export class AtelierHttpError extends Error {
  constructor(public status: number, public body: any) {
    super(`atelier http ${status}`);
  }
}

export interface AtelierClientConfig {
  apiUrl: string;
  getToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
  xhrFactory?: () => XMLHttpRequest;
}

export function createAtelierClient(cfg: AtelierClientConfig) {
  const f = cfg.fetchImpl ?? fetch;
  const base = `${cfg.apiUrl}/ai/workshop`;

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await cfg.getToken();
    if (!token) throw new AtelierHttpError(401, null);
    const res = await f(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      /* empty body */
    }
    if (!res.ok) throw new AtelierHttpError(res.status, json);
    return json as T;
  }

  return {
    getInfo: () => request<AtelierInfo>('GET', '/info'),
    getDraft: (id: string) => request<{ draft: DraftPayload; messages: Array<{ role: string; content: string }> }>('GET', `/drafts/${id}`),
    /** Edition manuelle : zero credit. 409 => AtelierHttpError(409, { draft }) : recharger. */
    patchDraft: (id: string, expectedRevision: number, ops: AtelierOp[]) =>
      request<{ draft: DraftPayload }>('PATCH', `/drafts/${id}`, { expected_revision: expectedRevision, ops }),
    publishDraft: (id: string) => request<{ program_id: string }>('POST', `/drafts/${id}/publish`),

    /** Un tour de conversation. Resout a la fin du flux ; rejette AtelierHttpError(status) si le serveur refuse (402, 502...). */
    async streamTurn(args: { message: string; draftId: string | null; signal?: AbortSignal; onEvent: (e: AtelierEvent) => void }): Promise<void> {
      const token = await cfg.getToken();
      if (!token) throw new AtelierHttpError(401, null);
      const xhr = (cfg.xhrFactory ?? (() => new XMLHttpRequest()))();
      return new Promise<void>((resolve, reject) => {
        let settled = false;
        let processed = 0;
        let buffer = '';
        const feed = (text: string) => {
          buffer += text;
          const { events, rest } = parseSseBuffer(buffer);
          buffer = rest;
          events.forEach(args.onEvent);
        };
        xhr.open('POST', `${base}/stream`);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.onprogress = () => {
          if (xhr.status >= 400) return;
          const text = xhr.responseText.slice(processed);
          processed = xhr.responseText.length;
          if (text) feed(text);
        };
        xhr.onload = () => {
          if (settled) return;
          settled = true;
          if (xhr.status >= 200 && xhr.status < 300) {
            const text = xhr.responseText.slice(processed);
            if (text) feed(text + '\n\n');
            resolve();
          } else {
            let body: any = null;
            try {
              body = JSON.parse(xhr.responseText);
            } catch {
              /* not json */
            }
            reject(new AtelierHttpError(xhr.status, body));
          }
        };
        xhr.onerror = () => {
          if (settled) return;
          settled = true;
          reject(new AtelierHttpError(0, null));
        };
        xhr.ontimeout = xhr.onerror;
        args.signal?.addEventListener(
          'abort',
          () => {
            if (settled) return;
            settled = true;
            xhr.abort();
            reject(new AtelierHttpError(-1, 'aborted'));
          },
          { once: true },
        );
        xhr.send(JSON.stringify({ message: args.message, draft_id: args.draftId ?? undefined }));
      });
    },
  };
}
