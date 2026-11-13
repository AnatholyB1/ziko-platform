/**
 * Phase 26 (v1.20) - logique pure de la Ligue cote mobile.
 * Prouve : factions = taxonomie v1.8 + repli (icones Ionicons, pas d'emoji) ; suggestion par objectif ; carte d'entree
 * sans score/rang ; parsing defensif de l'etat ; compteur de faction masque sous 10 ; copie sans mot punitif ; defi de
 * groupe = total + ma contribution seulement.
 * Ne prouve PAS : le calcul du score/palier (en base : harnais scripts/uat/p26-league-sql) ni le rendu natif.
 */
import { describe, it, expect } from 'vitest';
import {
  COPY,
  DIVISIONS,
  FACTIONS,
  FORBIDDEN_WORDS,
  LEAGUE_UNLOCK_TIER,
  collectiveView,
  divisionName,
  entryView,
  factionByKey,
  factionChangeState,
  historyLine,
  memberCountLabel,
  parseCollective,
  parseLeagueState,
  suggestFaction,
  weekDot,
  weekView,
  type CollectiveProgress,
  type LeagueState,
} from './rules';

const raw = (o: Record<string, unknown> = {}) => ({
  unlocked: true, tier: 3, track: 'habits', division: 2, start_division: 1, peak_division: 2, faction: 'running',
  current_week: { week_start: '2026-11-09', asked: 21, done: 8 },
  recent_weeks: [{ week_start: '2026-11-02', score: 90, outcome: 'hold' }, { week_start: '2026-10-26', score: 20, outcome: 'hold' }],
  history_weeks: { habits: 6, performance: 0 }, pending_celebration: null, ...o,
});

describe('factions (LEAG-01)', () => {
  it('5 sports v1.8 + faction de repli, cles stables', () => {
    expect(FACTIONS.map((f) => f.key)).toEqual(['powerlifting', 'hyrox', 'running', 'bodybuilding', 'weight_loss', 'wellness']);
    expect(FACTIONS.map((f) => f.label).slice(0, 5)).toEqual(['Powerlifting', 'Hyrox', 'Running', 'Bodybuilding', 'Perte de poids']);
  });
  it('icones = noms Ionicons en minuscules (aucun emoji)', () => {
    for (const f of FACTIONS) expect(f.icon).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });
  it('suggestion par objectif ; Hyrox jamais suggeree ; repli wellness', () => {
    expect(suggestFaction('strength')).toBe('powerlifting');
    expect(suggestFaction('endurance')).toBe('running');
    expect(suggestFaction('muscle_gain')).toBe('bodybuilding');
    expect(suggestFaction('body_comp')).toBe('bodybuilding');
    expect(suggestFaction('fat_loss')).toBe('weight_loss');
    expect(suggestFaction('weight_loss')).toBe('weight_loss');
    for (const g of ['health', 'wellness', 'maintenance', '', null, undefined, 'inconnu']) expect(suggestFaction(g as any)).toBe('wellness');
    for (const g of ['strength', 'endurance', 'muscle_gain', 'fat_loss', 'health', null]) expect(suggestFaction(g as any)).not.toBe('hyrox');
  });
  it('factionByKey : cle inconnue -> null', () => {
    expect(factionByKey('running')?.label).toBe('Running');
    expect(factionByKey('crossfit')).toBeNull();
    expect(factionByKey(null)).toBeNull();
  });
});

describe('paliers', () => {
  it('5 noms, borne', () => {
    expect(DIVISIONS).toEqual(['Bronze', 'Argent', 'Or', 'Platine', 'Diamant']);
    expect(divisionName(1)).toBe('Bronze');
    expect(divisionName(5)).toBe('Diamant');
    expect(divisionName(0)).toBe('Bronze');
    expect(divisionName(99)).toBe('Diamant');
    expect(divisionName(NaN)).toBe('Bronze');
  });
});

describe('parseLeagueState', () => {
  it('verrouille : pas de piste, pas de palier (pas de progression exposee)', () => {
    const s = parseLeagueState({ unlocked: false, required_tier: 3, tier: 2 })!;
    expect(s).toEqual({ unlocked: false, tier: 2, required_tier: 3 });
  });
  it('etat debloque normalise', () => {
    const s = parseLeagueState(raw())!;
    expect(s.track).toBe('habits');
    expect(s.division).toBe(2);
    expect(s.recent_weeks).toHaveLength(2);
    expect(s.pending_celebration).toBeNull();
  });
  it('forme inattendue -> null (ecran d erreur, jamais de donnees inventees)', () => {
    expect(parseLeagueState(null)).toBeNull();
    expect(parseLeagueState({})).toBeNull();
    expect(parseLeagueState({ unlocked: true, track: 'cohort' })).toBeNull();
  });
  it('palier borne 1..5 ; au plus 4 semaines', () => {
    expect(parseLeagueState(raw({ division: 9 }))!.division).toBe(5);
    expect(parseLeagueState(raw({ division: -3 }))!.division).toBe(1);
    const many = Array.from({ length: 9 }, (_, i) => ({ week_start: `2026-0${(i % 9) + 1}-01`, score: 50, outcome: 'hold' }));
    expect(parseLeagueState(raw({ recent_weeks: many }))!.recent_weeks).toHaveLength(4);
  });
  it('celebration en attente reconnue', () => {
    const s = parseLeagueState(raw({ pending_celebration: { id: 't1', to_track: 'performance', reason: 'Belle régularité', created_at: '2026-11-10' } }))!;
    expect(s.pending_celebration).toMatchObject({ id: 't1', to_track: 'performance' });
  });
});

describe('carte d entree (E3/E4)', () => {
  const st = (o: Record<string, unknown> = {}) => parseLeagueState(raw(o));
  it('sans donnees : accroche neutre', () => expect(entryView(null).subtitle).toBe('Ta régularité, à ton rythme'));
  it('verrouille : niveau requis, sans compteur', () => {
    expect(entryView(parseLeagueState({ unlocked: false, required_tier: 3, tier: 1 }))).toEqual({ subtitle: `Se débloque au niveau ${LEAGUE_UNLOCK_TIER}`, badge: null });
  });
  it('sans faction : Choisis ta faction', () => expect(entryView(st({ faction: null })).subtitle).toBe('Choisis ta faction'));
  it('faction + palier', () => expect(entryView(st()).subtitle).toBe('Running · Argent'));
  it('celebration en attente : puce Nouveau', () => {
    expect(entryView(st({ pending_celebration: { id: 't', to_track: 'performance', reason: '', created_at: '' } })).badge).toBe('Nouveau');
  });
  it('jamais de chiffre de score ni de rang dans le sous-titre', () => {
    for (const s of [st(), st({ faction: null }), st({ division: 5 })]) expect(entryView(s).subtitle).not.toMatch(/\d/);
  });
});

describe('cette semaine (S7)', () => {
  it('libelle et ratio relatifs a ce qui est demande', () => {
    const s = parseLeagueState(raw())!;
    const w = weekView(s);
    expect(w.label).toBe('Cette semaine : 8 sur 21 habitudes');
    expect(w.ratio).toBeCloseTo(8 / 21);
  });
  it('piste performance : unite seances ; fait plafonne a demande ; demande 0 -> ratio 0', () => {
    expect(weekView(parseLeagueState(raw({ track: 'performance', current_week: { week_start: 'x', asked: 3, done: 5 } }))!).label).toBe('Cette semaine : 3 sur 3 séances');
    expect(weekView(parseLeagueState(raw({ current_week: { week_start: 'x', asked: 0, done: 0 } }))!).ratio).toBe(0);
  });
  it('pastilles : coche >= 80, sinon cercle muted (jamais d alerte)', () => {
    expect(weekDot(80)).toEqual({ icon: 'checkmark-circle', tone: 'success' });
    expect(weekDot(79.9)).toEqual({ icon: 'ellipse', tone: 'muted' });
    expect(weekDot(0)).toEqual({ icon: 'ellipse', tone: 'muted' });
  });
  it('historique de l autre piste : ligne muted, absente si vide ; jamais de comparaison', () => {
    expect(historyLine(parseLeagueState(raw())!)).toBeNull();
    const s = parseLeagueState(raw({ track: 'performance', history_weeks: { habits: 5, performance: 2 } }))!;
    expect(historyLine(s)).toBe('Historique Habitudes : 5 semaines');
    expect(historyLine(parseLeagueState(raw({ track: 'performance', history_weeks: { habits: 1, performance: 0 } }))!)).toBe('Historique Habitudes : 1 semaine');
  });
});

describe('vie privee (D-12)', () => {
  it('compteur de faction : entier >= 10 seulement', () => {
    expect(memberCountLabel(12)).toBe('12 membres');
    expect(memberCountLabel(10)).toBe('10 membres');
    for (const v of [9, 0, null, undefined, '12', 11.5, NaN]) expect(memberCountLabel(v)).toBeNull();
  });
});

describe('defi de groupe (S9)', () => {
  const base = (o: Partial<CollectiveProgress> = {}): CollectiveProgress => ({
    id: 'c', title: 'Eau', metric: 'hydration_ml', target_total: 10000, total: 4000, joined_count: 3, my_contribution: 1500, my_status: 'joined', role: 'athlete', end_date: '2026-11-22', ...o,
  });
  it('total du groupe, ratio, participants, MA contribution', () => {
    const v = collectiveView(base());
    expect(v.groupLine).toBe('Groupe : 4000 / 10000 ml');
    expect(v.ratio).toBeCloseTo(0.4);
    expect(v.participantsLine).toBe('3 participants');
    expect(v.mineLine).toBe('Ma contribution : 1500');
  });
  it('ratio plafonne a 1 ; 1 participant au singulier', () => {
    expect(collectiveView(base({ total: 99999 })).ratio).toBe(1);
    expect(collectiveView(base({ joined_count: 1 })).participantsLine).toBe('1 participant');
  });
  it('invite ou coach : pas de ligne de contribution', () => {
    expect(collectiveView(base({ my_status: 'invited', my_contribution: null })).mineLine).toBeNull();
    expect(collectiveView(base({ role: 'coach', my_status: null, my_contribution: null })).mineLine).toBeNull();
  });
  it('parseCollective : metrique de sante ou forme invalide rejetee', () => {
    expect(parseCollective({ id: 'c', title: 'x', metric: 'weight_kg' })).toBeNull();
    expect(parseCollective({ id: 'c' })).toBeNull();
    expect(parseCollective(null)).toBeNull();
    expect(parseCollective({ id: 'c', title: 'x', metric: 'habit_logs', target_total: 30, total: 3, joined_count: 2, my_contribution: null, my_status: 'invited', role: 'athlete', end_date: '2026-11-22' })?.my_contribution).toBeNull();
  });
  it('la vue ne porte aucun identifiant ni nom d une autre personne', () => {
    expect(Object.keys(collectiveView(base())).sort()).toEqual(['groupLine', 'mineLine', 'participantsLine', 'ratio']);
  });
});

describe('changement de faction (D-02)', () => {
  const now = new Date('2026-11-13T10:00:00Z');
  it('autorise sans echeance ou echeance passee', () => {
    expect(factionChangeState(null, now)).toEqual({ allowed: true });
    expect(factionChangeState('2026-11-01T00:00:00Z', now)).toEqual({ allowed: true });
    expect(factionChangeState('pas une date', now)).toEqual({ allowed: true });
  });
  it('refuse avec une date lisible, ton neutre', () => {
    const r = factionChangeState('2026-12-02T10:00:00Z', now);
    expect(r).toEqual({ allowed: false, message: 'Tu pourras changer le 02/12.' });
  });
});

describe('copie : aucun mot punitif (S1)', () => {
  const strings: string[] = (Object.values(COPY) as string[]).concat(['Ligue verrouillée', ...DIVISIONS, ...FACTIONS.map((f) => f.label)]);
  it('aucune chaine de la surface ne contient un mot interdit', () => {
    for (const s of strings) for (const w of FORBIDDEN_WORDS) expect(s.toLowerCase()).not.toContain(w);
  });
  it('la celebration ne parle d aucune perte et conserve l historique', () => {
    expect(COPY.celebrationBody).toContain('Ta piste Habitudes reste dans ton historique');
    expect(COPY.celebrationBody).not.toMatch(/perd|perte|quitt/i);
  });
  it('pas de bouton Refuser dans la copie de celebration (decision IA seule)', () => {
    expect(Object.keys(COPY)).not.toContain('refuse');
    expect(COPY.continue).toBe('Continuer');
  });
  it('aucun emoji dans la copie', () => {
    for (const s of strings) expect(s).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
