import { describe, it, expect } from 'vitest';
import {
  deriveRelation, normalizeRelation, relationView, shouldSearch, resultCountLabel,
  requestSentToast, requestFailedBanner, initialsOf, SEARCH_DEBOUNCE_MS, SEARCH_MIN_CHARS,
} from './friendRelation';

const row = (requester_id: string, addressee_id: string, status: string) => ({ requester_id, addressee_id, status });

describe('deriveRelation (SOC-04 : une seule notion, 4 etats)', () => {
  it('none quand aucune ligne', () => {
    expect(deriveRelation('me', 'x', [])).toBe('none');
    expect(deriveRelation('me', 'x', [row('a', 'b', 'accepted')])).toBe('none');
  });
  it('sent : j\'ai demande, en attente', () => {
    expect(deriveRelation('me', 'x', [row('me', 'x', 'pending')])).toBe('sent');
  });
  it('received : il a demande, en attente', () => {
    expect(deriveRelation('me', 'x', [row('x', 'me', 'pending')])).toBe('received');
  });
  it('friend : acceptee dans un sens ou dans l\'autre', () => {
    expect(deriveRelation('me', 'x', [row('me', 'x', 'accepted')])).toBe('friend');
    expect(deriveRelation('me', 'x', [row('x', 'me', 'accepted')])).toBe('friend');
  });
  it('doublon croise herite : received l\'emporte sur sent (Accepter, pas Envoyee)', () => {
    expect(deriveRelation('me', 'x', [row('me', 'x', 'pending'), row('x', 'me', 'pending')])).toBe('received');
    expect(deriveRelation('me', 'x', [row('x', 'me', 'pending'), row('me', 'x', 'pending')])).toBe('received');
  });
  it('doublon croise : friend l\'emporte sur tout', () => {
    expect(deriveRelation('me', 'x', [row('me', 'x', 'pending'), row('x', 'me', 'accepted')])).toBe('friend');
  });
  it('statut inconnu (blocked) => none', () => {
    expect(deriveRelation('me', 'x', [row('me', 'x', 'blocked')])).toBe('none');
  });
  it('ignore les paires sans rapport avec le couple', () => {
    expect(deriveRelation('me', 'x', [row('me', 'y', 'accepted'), row('z', 'me', 'pending')])).toBe('none');
  });
});

describe('normalizeRelation', () => {
  it('accepte les 3 etats serveur et retombe sur none', () => {
    expect(normalizeRelation('friend')).toBe('friend');
    expect(normalizeRelation('sent')).toBe('sent');
    expect(normalizeRelation('received')).toBe('received');
    expect(normalizeRelation('self')).toBe('none');
    expect(normalizeRelation(undefined)).toBe('none');
  });
});

describe('relationView : memes etats sur liste et profil (AM-6)', () => {
  it('Ajouter (primaire)', () => {
    expect(relationView('none', 'Marco')).toMatchObject({ label: 'Ajouter', kind: 'primary', showDecline: false });
  });
  it('Envoyee en liste, Demande envoyee sur le profil, annulable (a11y)', () => {
    expect(relationView('sent', 'Marco Delmas', 'list').label).toBe('Envoyée');
    const p = relationView('sent', 'Marco Delmas', 'profile');
    expect(p.label).toBe('Demande envoyée');
    expect(p.a11yLabel).toBe('Demande envoyée à Marco Delmas, appuyer pour annuler');
    expect(p.kind).toBe('neutral');
  });
  it('Accepter + Refuser', () => {
    expect(relationView('received', 'Manon')).toMatchObject({ label: 'Accepter', showDecline: true, kind: 'primary' });
  });
  it('Ami (vert, coche)', () => {
    expect(relationView('friend', 'Manon')).toMatchObject({ label: 'Ami', icon: 'checkmark-circle', kind: 'success' });
  });
  it('mot + icone distincts pour chaque etat (pas la couleur seule)', () => {
    const icons = (['none', 'sent', 'received', 'friend'] as const).map((r) => relationView(r, 'A').icon);
    expect(new Set(icons).size).toBe(4);
  });
});

describe('recherche en direct (D-01)', () => {
  it('debounce 250 ms, 2 caracteres minimum', () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(250);
    expect(SEARCH_MIN_CHARS).toBe(2);
  });
  it('shouldSearch : < 2 caracteres utiles => liste des amis inchangee', () => {
    expect(shouldSearch('')).toBe(false);
    expect(shouldSearch('a')).toBe(false);
    expect(shouldSearch(' a ')).toBe(false);
    expect(shouldSearch('ma')).toBe(true);
    expect(shouldSearch(null)).toBe(false);
  });
  it('compteur', () => {
    expect(resultCountLabel(1)).toBe('1 résultat');
    expect(resultCountLabel(4)).toBe('4 résultats');
    expect(resultCountLabel(0)).toBe('0 résultats');
  });
});

describe('textes propres (SOC-08, AM-7)', () => {
  it('toast', () => {
    expect(requestSentToast('Marco Delmas')).toBe('Demande envoyée à Marco Delmas');
    expect(requestSentToast(null)).toBe('Demande envoyée');
  });
  it('bandeau d\'echec', () => {
    const b = requestFailedBanner('Maëlys');
    expect(b.title).toBe('Demande non envoyée');
    expect(b.message).toBe("Vérifie ta connexion puis réessaie. Rien n'a été envoyé à Maëlys.");
  });
  it('aucune sequence d\'echappement unicode litterale dans les textes produits', () => {
    const all = [
      requestSentToast('Éloïse'), requestFailedBanner('Éloïse').message, requestFailedBanner(null).message,
      ...(['none', 'sent', 'received', 'friend'] as const).flatMap((r) => [
        relationView(r, 'Éloïse', 'list').label, relationView(r, 'Éloïse', 'profile').label, relationView(r, 'Éloïse').a11yLabel,
      ]),
    ];
    for (const t of all) expect(t).not.toMatch(/\\u[0-9a-fA-F]{4}/);
  });
  it('initiales (avatar sans photo)', () => {
    expect(initialsOf('Marco Delmas')).toBe('MD');
    expect(initialsOf('manon')).toBe('M');
    expect(initialsOf('  ')).toBe('?');
    expect(initialsOf(null)).toBe('?');
  });
});

import { relativeDayLabel, daysLeftLabel, streakLabel } from './friendRelation';

describe('libelles profil', () => {
  const now = new Date(2026, 10, 12, 15, 0, 0); // jeudi 12 nov 2026
  it('relativeDayLabel', () => {
    expect(relativeDayLabel(new Date(2026, 10, 12, 8), now)).toBe("Aujourd'hui");
    expect(relativeDayLabel(new Date(2026, 10, 11, 20), now)).toBe('Hier');
    expect(relativeDayLabel(new Date(2026, 10, 9, 10), now)).toBe('Lundi');
    expect(relativeDayLabel(new Date(2026, 9, 28, 10), now)).toBe('28 oct.');
    expect(relativeDayLabel(null, now)).toBe('');
    expect(relativeDayLabel('nope', now)).toBe('');
  });
  it('daysLeftLabel', () => {
    expect(daysLeftLabel('2026-11-24', now)).toBe('12 jours restants');
    expect(daysLeftLabel('2026-11-13', now)).toBe('1 jour restant');
    expect(daysLeftLabel('2026-11-12', now)).toBe('Dernier jour');
    expect(daysLeftLabel('2026-11-01', now)).toBe('Terminé');
    expect(daysLeftLabel(null, now)).toBe('');
  });
  it('streakLabel', () => {
    expect(streakLabel(5)).toBe('5 jours');
    expect(streakLabel(1)).toBe('1 jour');
    expect(streakLabel(0)).toBe('aucune série');
  });
});
