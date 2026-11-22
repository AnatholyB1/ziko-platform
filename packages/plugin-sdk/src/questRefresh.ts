/**
 * Rafraichissement des quetes apres une ecriture qui alimente leurs metriques (UAT run 9, defaut 2).
 *
 * La progression d'une quete n'est mesuree que par `ziko_sync_quests`. Avant ce module, la synchro n'avait lieu qu'a
 * l'ouverture de l'ecran Recompenses : apres un log d'eau / repas / humeur / habitude la progression restait figee.
 * Les sites d'ecriture appellent `requestQuestRefresh()` (sans dependance a la plateforme) ; l'application enregistre
 * UN gestionnaire (`setQuestRefreshHandler`) qui lance la synchro (debounce) puis invalide les requetes de quetes.
 * Logique pure : minuteurs injectables, aucun import React / natif (testable en node).
 */

export interface QuestRefresherDeps<T = unknown> {
  /** Lance la synchro serveur ; peut lever (le rafraichissement ne doit jamais casser une ecriture). */
  sync: () => Promise<T>;
  /** Invalide les requetes de quetes / solde apres une synchro (meme si elle a echoue : l'ecran refera la synchro). */
  invalidate: (result: T | null) => void;
  delayMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export const QUEST_REFRESH_DELAY_MS = 1500;

export interface QuestRefresher {
  /** Planifie une synchro ; les appels rapproches sont regroupes (debounce). */
  schedule: () => void;
  /** Synchro immediate (annule le minuteur en attente). Si une synchro est en cours, elle est rejouee ensuite. */
  flush: () => Promise<void>;
  cancel: () => void;
  isPending: () => boolean;
}

export function createQuestRefresher<T>(deps: QuestRefresherDeps<T>): QuestRefresher {
  const delay = deps.delayMs ?? QUEST_REFRESH_DELAY_MS;
  const setT = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearT = deps.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let timer: unknown = null;
  let running: Promise<void> | null = null;
  let rerun = false;

  const run = async (): Promise<void> => {
    if (running) { rerun = true; return running; }
    running = (async () => {
      do {
        rerun = false;
        let result: T | null = null;
        try { result = await deps.sync(); } catch { result = null; }
        try { deps.invalidate(result); } catch { /* jamais bloquant */ }
      } while (rerun);
    })().finally(() => { running = null; });
    return running;
  };

  const cancel = () => { if (timer !== null) { clearT(timer); timer = null; } };
  return {
    schedule() {
      cancel();
      timer = setT(() => { timer = null; void run(); }, delay);
    },
    flush() { cancel(); return run(); },
    cancel,
    isPending: () => timer !== null,
  };
}

// ── Registre : les plugins appellent requestQuestRefresh sans connaitre l'application ──────────────
let handler: (() => void) | null = null;

export function setQuestRefreshHandler(fn: (() => void) | null): void {
  handler = fn;
}

/** A appeler apres une ecriture reussie sur eau / repas / poids / mesure / humeur / habitude. Sans effet sans gestionnaire. */
export function requestQuestRefresh(): void {
  try { handler?.(); } catch { /* jamais bloquant */ }
}

// ── Quetes terminees par une synchro en arriere-plan : l'ecran Recompenses les annonce a son prochain affichage ──
export interface PendingQuestCompletion { id: string; title: string; coins: number }
let pending: PendingQuestCompletion[] = [];

export function pushQuestCompletions(list: PendingQuestCompletion[]): void {
  for (const c of list) if (!pending.some((p) => p.id === c.id)) pending.push(c);
}

/** Vide et renvoie les completions en attente (une seule annonce par quete). */
export function takeQuestCompletions(): PendingQuestCompletion[] {
  const out = pending;
  pending = [];
  return out;
}
