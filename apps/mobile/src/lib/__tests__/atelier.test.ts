/**
 * Phase 23 (v1.20) - ATEL-01/05/10 : logique pure de l'ecran Atelier IA (A10-A15).
 * Prouve : cout REEL affiche (jamais "1 credit" en dur), steppers bornes, operations d'edition manuelle,
 * decoupage SSE, reducteur de tour (puce outil AVANT le texte, brouillon mis a jour sans regresser de revision),
 * echec reseau = message conserve + Reessayer, credits epuises = saisie desactivee.
 * Ne prouve PAS le rendu (aucune capture emulateur) ni le comportement RN reel d'XMLHttpRequest.
 */
import { describe, it, expect } from 'vitest';
import {
  ATELIER_COPY,
  applyEvent,
  buildEditOps,
  classifyHttpStatus,
  contextBanner,
  costLabel,
  creditBarLabel,
  dayLabel,
  draftSubtitle,
  exerciseLine,
  failTurn,
  initialAtelierState,
  inputDisabled,
  parseSseBuffer,
  placeholderFor,
  prepareRetry,
  sessionLine,
  sessionTitle,
  startTurn,
  stepValue,
  type AtelierProgram,
} from '../atelier';

const program: AtelierProgram = {
  name: 'Pic de force, 8 semaines',
  goal: 'powerlifting',
  split_type: 'custom',
  days_per_week: 3,
  weeks_count: 8,
  weeks: [
    {
      w: 1,
      sessions: [
        { name: 'Squat lourd', day_of_week: 1, exercises: [{ name: 'Squat', sets: 5, reps: 3, pct_1rm: 85 }, { name: 'Squat pause', sets: 3, reps: 5 }, { name: 'Gainage', sets: 3, reps: '30s' }] },
      ],
    },
  ],
};

describe('libelles', () => {
  it('shows the REAL cost, never a hardcoded "1 credit par message"', () => {
    expect(costLabel(4, 0)).toBe('4 crédits par message');
    expect(costLabel(4, 1)).toBe("1 message gratuit aujourd'hui, puis 4 crédits par message");
    expect(costLabel(1, 0)).toBe('1 crédit par message');
    expect(costLabel(null, null)).toBe('Consomme des crédits IA');
    expect(costLabel(4, 0)).not.toMatch(/^1 crédit/);
  });

  it('credit bar and context banner use real numbers', () => {
    expect(creditBarLabel(14)).toBe('14 crédits');
    expect(creditBarLabel(1)).toBe('1 crédit');
    expect(creditBarLabel(0)).toBe('0 crédit');
    expect(contextBanner({ sessions: 42, programs: 3 })).toBe('Contexte : 42 séances, 3 programmes');
    expect(contextBanner({ sessions: 1, programs: 1 })).toBe('Contexte : 1 séance, 1 programme');
  });

  it('draft lines follow the mockup ("Squat 5x3 à 85 %")', () => {
    expect(exerciseLine(program.weeks[0].sessions[0].exercises[0])).toBe('Squat 5x3 à 85 %');
    expect(sessionLine(program.weeks[0].sessions[0])).toBe('Squat 5x3 à 85 %, Squat pause 3x5 +1');
    expect(sessionTitle(program.weeks[0].sessions[0])).toBe('Lundi · Squat lourd');
    expect(dayLabel(7)).toBe('Dimanche');
    expect(draftSubtitle(program)).toBe('3 séances par semaine · 8 semaines');
  });

  it('contract microcopy is verbatim', () => {
    expect(ATELIER_COPY.errorBody).toBe("Ton message est conservé et aucun crédit n'a été retiré.");
    expect(ATELIER_COPY.creditsOut).toBe("Plus de crédits IA. Tu en gagnes en t'entraînant, ou tu peux en obtenir.");
  });
});

describe('steppers et operations (A12, zero credit)', () => {
  const ex = { name: 'Squat', sets: 5, reps: 3, pct_1rm: 85 };
  it('steps with bounds', () => {
    expect(stepValue('sets', ex, 1)).toBe(6);
    expect(stepValue('sets', { ...ex, sets: 1 }, -1)).toBe(1);
    expect(stepValue('sets', { ...ex, sets: 20 }, 1)).toBe(20);
    expect(stepValue('pct_1rm', ex, 1)).toBe(87.5);
    expect(stepValue('pct_1rm', { ...ex, pct_1rm: 120 }, 1)).toBe(120);
    expect(stepValue('reps', { ...ex, reps: '8-12' }, 1)).toBe(9);
    expect(stepValue('pct_1rm', { name: 'x', sets: 3, reps: 5 }, 1)).toBe(72.5);
  });

  it('builds a single update op, week scoped or all weeks, none when empty', () => {
    expect(buildEditOps({ week: 3, allWeeks: false, session: 0, index: 1, patch: { sets: 6 } })).toEqual([
      { op: 'update_exercise', week: 3, session: 0, index: 1, patch: { sets: 6 } },
    ]);
    expect(buildEditOps({ week: 3, allWeeks: true, session: 0, index: 1, patch: { rest_seconds: 180, sets: undefined } })[0]).toMatchObject({ week: 'all', patch: { rest_seconds: 180 } });
    expect(buildEditOps({ week: 1, allWeeks: false, session: 0, index: 0, patch: {} })).toEqual([]);
  });
});

describe('SSE', () => {
  it('splits complete events, keeps the partial rest, ignores [DONE] and junk', () => {
    const { events, rest } = parseSseBuffer('data: {"type":"chunk","content":"a"}\n\ndata: [DONE]\n\ndata: {bad\n\ndata: {"type":"chu');
    expect(events).toEqual([{ type: 'chunk', content: 'a' }]);
    expect(rest).toBe('data: {"type":"chu');
  });
});

describe('reducteur de tour', () => {
  it('tool chip appears BEFORE the text, then draft updates (A10/A-6)', () => {
    let s = startTurn(initialAtelierState, 'Programme powerlifting');
    expect(s.status).toBe('streaming');
    s = applyEvent(s, { type: 'meta', draft_id: 'd1', conversation_id: 'c1', cost: 4 });
    s = applyEvent(s, { type: 'tool', id: 't1', name: 'workshop_web_search', state: 'start', label: 'Recherche web' });
    expect(s.messages[1].tools).toEqual([{ id: 't1', name: 'workshop_web_search', label: 'Recherche web', state: 'start' }]);
    expect(s.messages[1].text).toBe('');
    s = applyEvent(s, { type: 'tool', id: 't1', name: 'workshop_web_search', state: 'done', label: 'Recherche web' });
    expect(s.messages[1].tools).toHaveLength(1);
    expect(s.messages[1].tools[0].state).toBe('done');
    s = applyEvent(s, { type: 'chunk', content: 'Voici ' });
    s = applyEvent(s, { type: 'chunk', content: 'ton plan.' });
    s = applyEvent(s, { type: 'draft', revision: 1, program });
    s = applyEvent(s, { type: 'done' });
    expect(s.messages[1].text).toBe('Voici ton plan.');
    expect(s.draftId).toBe('d1');
    expect(s.draft?.revision).toBe(1);
    expect(s.status).toBe('idle');
  });

  it('never regresses to an older draft revision', () => {
    let s = startTurn(initialAtelierState, 'x');
    s = applyEvent(s, { type: 'draft', revision: 3, program });
    s = applyEvent(s, { type: 'draft', revision: 2, program: { ...program, name: 'old' } });
    expect(s.draft?.revision).toBe(3);
    expect(s.draft?.program.name).toBe(program.name);
  });

  it('network failure before any output: message kept for Reessayer, empty reply removed (A14)', () => {
    let s = startTurn(initialAtelierState, 'Ajoute une semaine de décharge');
    s = failTurn(s);
    expect(s.status).toBe('error');
    expect(s.failedMessage).toBe('Ajoute une semaine de décharge');
    expect(s.messages.map((m) => m.role)).toEqual(['user']);
    const r = prepareRetry(s);
    expect(r.message).toBe('Ajoute une semaine de décharge');
    const again = startTurn(r.state, r.message!);
    expect(again.messages.filter((m) => m.role === 'user')).toHaveLength(1);
    expect(again.status).toBe('streaming');
  });

  it('failure after partial output keeps the partial reply and offers no resend', () => {
    let s = startTurn(initialAtelierState, 'go');
    s = applyEvent(s, { type: 'chunk', content: 'Debut' });
    s = applyEvent(s, { type: 'error', error: 'stream_interrupted' });
    expect(s.status).toBe('error');
    expect(s.messages[1].text).toBe('Debut');
    expect(s.failedMessage).toBeNull();
  });

  it('402 => credits state: input disabled, draft untouched, message handed back (A15)', () => {
    let s = startTurn({ ...initialAtelierState, draft: { revision: 2, program } }, 'encore');
    s = failTurn(s, 'credits');
    expect(s.status).toBe('credits');
    expect(s.draft?.revision).toBe(2);
    expect(s.failedMessage).toBe('encore');
    expect(s.messages).toHaveLength(0);
    expect(inputDisabled('credits')).toBe(true);
    expect(inputDisabled('streaming')).toBe(true);
    expect(inputDisabled('idle')).toBe(false);
    expect(inputDisabled('error')).toBe(false);
  });

  it('classifies HTTP statuses and picks the right placeholder', () => {
    expect(classifyHttpStatus(402)).toBe('credits');
    expect(classifyHttpStatus(502)).toBe('network');
    expect(classifyHttpStatus(0)).toBe('network');
    expect(placeholderFor('idle', false)).toBe('Décris ton objectif');
    expect(placeholderFor('idle', true)).toBe('Demande une modification…');
    expect(placeholderFor('streaming', true)).toBe("L'IA répond…");
  });
});
