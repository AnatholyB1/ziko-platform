// v1.20 Phase 26 (LEAG-03/04) - regles pures de la Ligue cote backend (aucune I/O, aucune horloge, aucun modele).
//
// Le score de regularite, les paliers et le pre-filtre de la transition vivent en BASE (migrations 2603/2604) : ce
// fichier ne fait que (1) borner ce que le modele voit (liste blanche : aucune donnee de sante), (2) valider ce qu'il
// renvoie, (3) porter les constantes copiees pour les prompts/messages. Une reponse du modele ne saute jamais le
// pre-filtre : ziko_league_apply_transition le re-verifie.

export const LEAGUE_UNLOCK_TIER = 3;
/** Appels IA automatiques (transition) absorbes par la plateforme : plafond par jour et par personne. */
export const LEAGUE_AI_DAILY_CAP = 1;
export const TRANSITION_REASON_MAX = 300;

export type LeagueTrack = 'habits' | 'performance';

export interface WeekEvidence {
  week_start: string;
  score: number;
}

/** Contexte BORNE envoye au modele : scalaires de ziko_athlete_state + scores de regularite. Rien d'autre. */
export interface TransitionEvidence {
  weeks: WeekEvidence[];
  average_score: number;
  tier: number;
  readiness: string | null;
  experience_level: string | null;
}

export interface LeagueClaim {
  proceed: boolean;
  reason: string;
  evidence: TransitionEvidence | null;
}

const READINESS = ['fragile', 'building', 'ready'] as const;
const EXPERIENCE = ['beginner', 'intermediate', 'advanced'] as const;

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/**
 * Reconstruit la preuve a partir de la reponse de la base en ne gardant QUE les champs de la liste blanche
 * (et des valeurs de forme connue) : meme si la fonction SQL evoluait, aucune autre cle n'atteint le modele.
 */
export function sanitizeEvidence(raw: unknown): TransitionEvidence | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const weeksRaw = Array.isArray(r.weeks) ? r.weeks : [];
  const weeks: WeekEvidence[] = [];
  for (const w of weeksRaw) {
    const o = (w ?? {}) as Record<string, unknown>;
    const score = num(o.score);
    if (typeof o.week_start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.week_start) && score !== null) {
      weeks.push({ week_start: o.week_start, score: Math.min(100, Math.max(0, score)) });
    }
  }
  const avg = num(r.average_score);
  const tier = num(r.tier);
  if (weeks.length === 0 || avg === null || tier === null) return null;
  return {
    weeks: weeks.slice(0, 8),
    average_score: Math.min(100, Math.max(0, avg)),
    tier: Math.max(1, Math.floor(tier)),
    readiness: (READINESS as readonly string[]).includes(String(r.readiness)) ? String(r.readiness) : null,
    experience_level: (EXPERIENCE as readonly string[]).includes(String(r.experience_level)) ? String(r.experience_level) : null,
  };
}

/** Reponse de ziko_league_ai_claim -> LeagueClaim, ou null si la forme est inattendue (echec ferme : pas d'appel IA). */
export function parseClaim(data: unknown): LeagueClaim | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.proceed !== 'boolean' || typeof d.reason !== 'string') return null;
  const evidence = d.proceed ? sanitizeEvidence(d.evidence) : null;
  if (d.proceed && !evidence) return null;
  return { proceed: d.proceed, reason: d.reason, evidence };
}

export const LEAGUE_SYSTEM_PROMPT =
  "Tu décides, pour l'application Ziko, si une personne qui suit la piste Habitudes de la Ligue est prête à passer " +
  'en piste Performance. Tu ne décides QUE de ce passage (jamais un retour, jamais une descente) et tu ne vois que ' +
  'des scores de régularité hebdomadaires et quelques indicateurs de coaching. Passe-la en piste Performance ' +
  "seulement si sa régularité est solide et stable ET si son état (disposition, expérience) laisse penser qu'elle " +
  "y trouvera de l'élan plutôt que de la pression. Dans le doute, réponds transition=false : rester en piste " +
  "Habitudes n'a aucune conséquence négative. La raison est une phrase en français, bienveillante, qui parle de sa " +
  "régularité (jamais de poids, de corps, d'âge ni de santé), au maximum 200 caractères. Réponds uniquement avec " +
  'la structure demandée.';

export function buildTransitionPrompt(evidence: TransitionEvidence): string {
  return [
    `semaines_recentes (du plus récent au plus ancien, score de régularité 0..100): ${evidence.weeks
      .map((w) => `${w.week_start}=${w.score}`)
      .join(', ')}`,
    `moyenne: ${evidence.average_score}`,
    `palier_de_confiance (tier): ${evidence.tier}`,
    `disposition (readiness): ${evidence.readiness ?? 'inconnue'}`,
    `experience_declaree: ${evidence.experience_level ?? 'inconnue'}`,
  ].join('\n');
}

export interface TransitionDecision {
  transition: boolean;
  reason: string;
}

const HEALTH_WORDS = /(?<![\p{L}])(?:poids|kilos?|kg|maigr\p{L}*|gros\p{L}*|imc|corpul\p{L}*|sant[eé]|[aâ]ge|ans|malad\p{L}*|blessur\p{L}*|r[eè]gles|enceinte|diab\p{L}*|tension|cardiaque)(?![\p{L}])/iu;

const FALLBACK_REASON ='Ta régularité des dernières semaines est solide : une nouvelle piste t\'attend.';

/** Valide la sortie du modele : booleen strict ; raison nettoyee et bornee (repli neutre si vide). */
export function normalizeDecision(raw: unknown): TransitionDecision | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.transition !== 'boolean') return null;
  const cleaned = typeof o.reason === 'string' ? o.reason.replace(/\s+/g, ' ').trim() : '';
  // Une raison qui evoquerait le corps / la sante est ecartee (le prompt l'interdit ; ceci est la ceinture).
  const reason = (cleaned && !HEALTH_WORDS.test(cleaned) ? cleaned : FALLBACK_REASON).slice(0, TRANSITION_REASON_MAX);
  return { transition: o.transition, reason };
}
