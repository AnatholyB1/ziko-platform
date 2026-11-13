/**
 * Phase 26 (v1.20) - regles pures de la Ligue (backend).
 * Prouve : la preuve envoyee au modele est une LISTE BLANCHE (aucune cle de sante, meme si la base en renvoyait),
 * la forme de la reponse du claim est verifiee (echec ferme), la decision du modele est validee et bornee.
 * Ne prouve PAS : la qualite de la decision du vrai modele, ni le pre-filtre SQL (harnais scripts/uat/p26-league-sql).
 */
import { describe, it, expect } from 'vitest';
import {
  LEAGUE_AI_DAILY_CAP,
  LEAGUE_SYSTEM_PROMPT,
  LEAGUE_UNLOCK_TIER,
  TRANSITION_REASON_MAX,
  buildTransitionPrompt,
  normalizeDecision,
  parseClaim,
  sanitizeEvidence,
} from './rules.js';

const GOOD = {
  weeks: [
    { week_start: '2026-11-02', score: 95 },
    { week_start: '2026-10-26', score: '88.5' },
    { week_start: '2026-10-19', score: 100 },
    { week_start: '2026-10-12', score: 80 },
  ],
  average_score: 90.88,
  tier: 3,
  readiness: 'building',
  experience_level: 'beginner',
};

describe('constantes', () => {
  it('palier de deblocage 3 et 1 appel IA automatique par jour', () => {
    expect(LEAGUE_UNLOCK_TIER).toBe(3);
    expect(LEAGUE_AI_DAILY_CAP).toBe(1);
  });
});

describe('sanitizeEvidence', () => {
  it('garde uniquement les champs de la liste blanche', () => {
    const e = sanitizeEvidence({ ...GOOD, weight_kg: 82, age: 17, sleep_hours: 4, email: 'a@b.c', height_cm: 180 });
    expect(Object.keys(e!).sort()).toEqual(['average_score', 'experience_level', 'readiness', 'tier', 'weeks']);
    expect(JSON.stringify(e)).not.toMatch(/weight|age"|sleep|email|height/);
  });
  it('ignore les cles parasites dans chaque semaine', () => {
    const e = sanitizeEvidence({ ...GOOD, weeks: [{ week_start: '2026-11-02', score: 90, weight_kg: 80, volume: 9000 }] });
    expect(e!.weeks).toEqual([{ week_start: '2026-11-02', score: 90 }]);
  });
  it('borne les scores et convertit les chaines numeriques', () => {
    const e = sanitizeEvidence({ ...GOOD, weeks: [{ week_start: '2026-11-02', score: '250' }, { week_start: '2026-10-26', score: -5 }], average_score: 300 });
    expect(e!.weeks.map((w) => w.score)).toEqual([100, 0]);
    expect(e!.average_score).toBe(100);
  });
  it('rejette les dates mal formees et les semaines sans score', () => {
    const e = sanitizeEvidence({ ...GOOD, weeks: [{ week_start: 'demain', score: 90 }, { week_start: '2026-11-02' }, { week_start: '2026-10-26', score: 70 }] });
    expect(e!.weeks).toEqual([{ week_start: '2026-10-26', score: 70 }]);
  });
  it('valeurs inconnues de readiness/experience -> null (jamais recopiees)', () => {
    const e = sanitizeEvidence({ ...GOOD, readiness: 'depressed', experience_level: 'pro-athlete' });
    expect(e!.readiness).toBeNull();
    expect(e!.experience_level).toBeNull();
  });
  it('renvoie null si la forme est inutilisable', () => {
    expect(sanitizeEvidence(null)).toBeNull();
    expect(sanitizeEvidence('x')).toBeNull();
    expect(sanitizeEvidence({ ...GOOD, weeks: [] })).toBeNull();
    expect(sanitizeEvidence({ ...GOOD, tier: undefined })).toBeNull();
    expect(sanitizeEvidence({ ...GOOD, average_score: 'abc' })).toBeNull();
  });
  it('au plus 8 semaines', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ week_start: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, score: 80 }));
    expect(sanitizeEvidence({ ...GOOD, weeks: many })!.weeks.length).toBe(8);
  });
});

describe('parseClaim', () => {
  it('proceed=true exige une preuve exploitable (echec ferme sinon)', () => {
    expect(parseClaim({ proceed: true, reason: 'eligible', evidence: GOOD })?.proceed).toBe(true);
    expect(parseClaim({ proceed: true, reason: 'eligible' })).toBeNull();
    expect(parseClaim({ proceed: true, reason: 'eligible', evidence: { weeks: [] } })).toBeNull();
  });
  it('proceed=false : pas de preuve conservee', () => {
    const c = parseClaim({ proceed: false, reason: 'daily_cap', evidence: GOOD });
    expect(c).toEqual({ proceed: false, reason: 'daily_cap', evidence: null });
  });
  it('forme inattendue -> null', () => {
    expect(parseClaim(null)).toBeNull();
    expect(parseClaim({ proceed: 'yes', reason: 'x' })).toBeNull();
    expect(parseClaim({ proceed: false })).toBeNull();
  });
});

describe('prompt', () => {
  const prompt = buildTransitionPrompt(sanitizeEvidence(GOOD)!);
  it('ne contient aucune donnee de sante ni identite', () => {
    expect(prompt).not.toMatch(/poids|weight|taille|height|\bâge\b|\bage\b|sommeil|sleep|email|nom\b|@/i);
  });
  it('contient les scores, la moyenne, le palier, la disposition', () => {
    expect(prompt).toContain('2026-11-02=95');
    expect(prompt).toContain('moyenne: 90.88');
    expect(prompt).toContain('tier): 3');
    expect(prompt).toContain('building');
  });
  it('le prompt systeme borne la decision : sens montant seulement, doute => non, ton non culpabilisant', () => {
    expect(LEAGUE_SYSTEM_PROMPT).toMatch(/QUE de ce passage/);
    expect(LEAGUE_SYSTEM_PROMPT).toMatch(/Dans le doute, réponds transition=false/);
    expect(LEAGUE_SYSTEM_PROMPT).toMatch(/aucune conséquence négative/);
    expect(LEAGUE_SYSTEM_PROMPT).not.toMatch(/relégation|punition|perte/i);
  });
});

describe('normalizeDecision', () => {
  it('booleen strict', () => {
    expect(normalizeDecision({ transition: 'true', reason: 'x' })).toBeNull();
    expect(normalizeDecision(null)).toBeNull();
    expect(normalizeDecision({ reason: 'x' })).toBeNull();
  });
  it('raison nettoyee et bornee a 300', () => {
    const d = normalizeDecision({ transition: true, reason: `  Belle   régularité ${'x'.repeat(500)} ` });
    expect(d!.reason.length).toBeLessThanOrEqual(TRANSITION_REASON_MAX);
    expect(d!.reason.startsWith('Belle régularité')).toBe(true);
  });
  it('raison vide -> repli neutre (la decision reste valide)', () => {
    const d = normalizeDecision({ transition: true, reason: '   ' });
    expect(d!.transition).toBe(true);
    expect(d!.reason.length).toBeGreaterThan(10);
  });
  it('raison evoquant le corps ou la sante -> ecartee, repli neutre', () => {
    for (const bad of ['Tu as perdu du poids, bravo', 'Ton âge te le permet', 'Après ta blessure tu es prêt', 'ton IMC est bon', 'Ta santé est solide']) {
      const d = normalizeDecision({ transition: true, reason: bad });
      expect(d!.reason).not.toBe(bad);
      expect(d!.reason).toMatch(/régularité/);
    }
  });
  it('une raison sur la regularite passe telle quelle (pas de faux positif sur "groupe", "semaines")', () => {
    const r = 'Tes semaines régulières en groupe montrent un vrai rythme.';
    expect(normalizeDecision({ transition: false, reason: r })!.reason).toBe(r);
  });
});
