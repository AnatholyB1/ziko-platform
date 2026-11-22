// Phase 24 (v1.20) - client HTTP de la periodisation (backend Hono /ai/workshop/{sequence,relaunch/*}).
// Aucun credit n'est en jeu : ces appels sont automatiques et absorbes cote serveur.
import type { RelaunchView, SequenceItem } from './periodization';

export type ProposeResult =
  | { status: 'proposed'; draft_id: string | null; already?: boolean }
  | { status: 'pending'; draft_id: string | null; skipped: 'daily_cap' | 'ai_error' | 'busy' };

export interface PeriodizationClientConfig {
  apiUrl: string;
  getToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export class PeriodizationHttpError extends Error {
  constructor(public status: number, public body: any) {
    super(`periodization http ${status}`);
  }
}

export function createPeriodizationClient(cfg: PeriodizationClientConfig) {
  const f = cfg.fetchImpl ?? fetch;
  const base = `${cfg.apiUrl}/ai/workshop`;

  async function request<T>(method: string, path: string): Promise<T> {
    const token = await cfg.getToken();
    if (!token) throw new PeriodizationHttpError(401, null);
    const res = await f(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      /* empty body */
    }
    if (!res.ok) throw new PeriodizationHttpError(res.status, json);
    return json as T;
  }

  return {
    /** Detection de fin de programme (sans IA), idempotent. */
    check: () => request<{ relaunch: RelaunchView | null; closed_program_id: string | null; has_sequence: boolean }>('POST', '/relaunch/check'),
    /** UN appel IA automatique cote serveur (absorbe, plafonne), idempotent. */
    propose: (relaunchId: string) => request<ProposeResult>('POST', `/relaunch/${relaunchId}/propose`),
    dismiss: (relaunchId: string) => request<{ ok: true }>('POST', `/relaunch/${relaunchId}/dismiss`),
    getSequence: () =>
      request<{ sequence: { id: string; name: string; goal: string | null } | null; items: SequenceItem[]; relaunch: RelaunchView | null }>('GET', '/sequence'),
  };
}
