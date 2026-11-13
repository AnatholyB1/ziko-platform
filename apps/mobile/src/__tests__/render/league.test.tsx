import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { vi } from 'vitest';
import {
  CelebrationCard,
  CollectiveCard,
  ErrorCard,
  FactionCard,
  LeagueEntryCard,
  LockedCard,
  NoCollective,
  SkeletonCards,
  TrackCard,
  WeekCard,
  type LeagueColors,
} from '../../../../../plugins/community/src/league/cards';
import { FORBIDDEN_WORDS, parseLeagueState, type CollectiveProgress } from '../../../../../plugins/community/src/league/rules';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(el: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(el); });
  return container;
}

const C: LeagueColors = { surface: '#FFFFFF', border: '#E2E0DA', text: '#1C1A17', muted: '#6B6963', primary: '#FF5C1A', action: '#CF4509', success: '#2E7D32' };
const noop = () => {};
const btn = (c: HTMLElement, label: string) => Array.from(c.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLElement | undefined;
const state = (o: Record<string, unknown> = {}) => parseLeagueState({
  unlocked: true, tier: 3, track: 'habits', division: 2, start_division: 1, peak_division: 2, faction: 'running',
  current_week: { week_start: '2026-11-09', asked: 21, done: 8 },
  recent_weeks: [{ week_start: '2026-11-02', score: 90, outcome: 'hold' }, { week_start: '2026-10-26', score: 20, outcome: 'hold' }],
  history_weeks: { habits: 6, performance: 0 }, pending_celebration: null, ...o,
})!;
const item = (o: Partial<CollectiveProgress> = {}): CollectiveProgress => ({
  id: 'c1', title: 'Defi eau du groupe', metric: 'hydration_ml', target_total: 10000, total: 4000, joined_count: 3,
  my_contribution: 1500, my_status: 'joined', role: 'athlete', end_date: '2026-11-22', ...o,
});

describe('LeagueEntryCard (E1..E4)', () => {
  it('sous-titre faction + palier, appelle onPress, aucun chiffre ni rang', async () => {
    const onPress = vi.fn();
    const c = await mount(<LeagueEntryCard state={state()} c={C} onPress={onPress} />);
    expect(c.textContent).toContain('Ligue');
    expect(c.textContent).toContain('Running · Argent');
    expect(c.textContent).not.toMatch(/\d/);
    (c.querySelector('button') as HTMLElement).click();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('verrouille : Se debloque au niveau 3', async () => {
    const c = await mount(<LeagueEntryCard state={parseLeagueState({ unlocked: false, required_tier: 3, tier: 1 })} c={C} onPress={noop} />);
    expect(c.textContent).toContain('Se débloque au niveau 3');
  });
  it('celebration en attente : puce Nouveau', async () => {
    const c = await mount(<LeagueEntryCard state={state({ pending_celebration: { id: 't', to_track: 'performance', reason: 'x', created_at: '' } })} c={C} onPress={noop} />);
    expect(c.textContent).toContain('Nouveau');
  });
});

describe('etats (S2)', () => {
  it('verrouillee : message neutre, aucune barre ni compteur', async () => {
    const c = await mount(<LockedCard c={C} />);
    expect(c.textContent).toContain('Ligue verrouillée');
    expect(c.textContent).toContain("Elle s'ouvre au niveau 3. Continue à ton rythme.");
    expect(c.textContent).not.toMatch(/\d+\s*(%|\/|sur)/);
  });
  it('erreur : Reessayer appelle onRetry', async () => {
    const onRetry = vi.fn();
    const c = await mount(<ErrorCard c={C} onRetry={onRetry} />);
    expect(c.textContent).toContain('Impossible de charger la Ligue');
    btn(c, 'Réessayer')!.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
  it('chargement : squelettes sans texte (pas de spinner plein ecran)', async () => {
    const c = await mount(<SkeletonCards c={C} />);
    expect(c.textContent).toBe('');
  });
});

describe('FactionCard (S4/S5)', () => {
  it('sans faction : 6 tuiles, la suggeree est marquee, tap = onPick(cle)', async () => {
    const onPick = vi.fn();
    const c = await mount(<FactionCard c={C} mine={null} suggested="powerlifting" memberCount={null} onPick={onPick} onChange={noop} />);
    for (const l of ['Powerlifting', 'Hyrox', 'Running', 'Bodybuilding', 'Perte de poids', 'Forme et bien-être']) expect(c.textContent).toContain(l);
    expect(c.textContent?.match(/Suggérée/g)).toHaveLength(1);
    expect(c.textContent).toContain('Choisis une faction pour commencer');
    btn(c, 'Running')!.click();
    expect(onPick).toHaveBeenCalledWith('running');
  });
  it('membre : ligne faction + Changer ; compteur seulement si fourni', async () => {
    const onChange = vi.fn();
    let c = await mount(<FactionCard c={C} mine="hyrox" suggested="wellness" memberCount={null} onPick={noop} onChange={onChange} />);
    expect(c.textContent).toContain('Hyrox');
    expect(c.textContent).not.toMatch(/membres/);
    btn(c, 'Changer')!.click();
    expect(onChange).toHaveBeenCalled();
    c = await mount(<FactionCard c={C} mine="hyrox" suggested="wellness" memberCount={14} onPick={noop} onChange={noop} />);
    expect(c.textContent).toContain('14 membres');
    c = await mount(<FactionCard c={C} mine="hyrox" suggested="wellness" memberCount={7} onPick={noop} onChange={noop} />);
    expect(c.textContent).not.toMatch(/membres/);
  });
});

describe('TrackCard / WeekCard (S6..S8)', () => {
  it('piste, palier, 5 points, aide, jamais de score d un autre ; historique de l autre piste en muted', async () => {
    const c = await mount(<TrackCard c={C} state={state({ track: 'performance', history_weeks: { habits: 6, performance: 1 } })} />);
    expect(c.textContent).toContain('Piste Performance');
    expect(c.textContent).toContain('Argent');
    expect(c.textContent).toContain("ne descend jamais de plus d'un cran");
    expect(c.textContent).toContain('Historique Habitudes : 6 semaines');
    expect(c.textContent).not.toContain('Piste Habitudes');
  });
  it('une seule piste est affichee a la fois', async () => {
    const c = await mount(<TrackCard c={C} state={state()} />);
    expect(c.textContent).toContain('Piste Habitudes');
    expect(c.textContent).not.toContain('Piste Performance');
  });
  it('cette semaine : X sur Y, pas de pourcentage', async () => {
    const c = await mount(<WeekCard c={C} state={state()} />);
    expect(c.textContent).toContain('Cette semaine : 8 sur 21 habitudes');
    expect(c.textContent).not.toContain('%');
  });
});

describe('CollectiveCard (S9)', () => {
  const props = { c: C, busy: false, onJoin: noop, onDecline: noop, onLeave: noop };
  it('invite : Rejoindre (plein) + Pas cette fois ; pas de contribution ; appelle les handlers', async () => {
    const onJoin = vi.fn(); const onDecline = vi.fn();
    const c = await mount(<CollectiveCard {...props} onJoin={onJoin} onDecline={onDecline} item={item({ my_status: 'invited', my_contribution: null })} />);
    expect(c.textContent).toContain('Groupe : 4000 / 10000 ml');
    expect(c.textContent).toContain('3 participants');
    expect(c.textContent).not.toContain('Ma contribution');
    btn(c, 'Rejoindre')!.click(); btn(c, 'Pas cette fois')!.click();
    expect(onJoin).toHaveBeenCalled(); expect(onDecline).toHaveBeenCalled();
  });
  it('accepte : Ma contribution + Quitter ce defi, pas de Rejoindre', async () => {
    const onLeave = vi.fn();
    const c = await mount(<CollectiveCard {...props} onLeave={onLeave} item={item()} />);
    expect(c.textContent).toContain('Ma contribution : 1500');
    expect(btn(c, 'Rejoindre')).toBeUndefined();
    btn(c, 'Quitter ce défi')!.click();
    expect(onLeave).toHaveBeenCalled();
  });
  it('coach : total et participants, aucun bouton, aucune liste de personnes', async () => {
    const c = await mount(<CollectiveCard {...props} item={item({ role: 'coach', my_status: null, my_contribution: null })} />);
    expect(c.querySelectorAll('button')).toHaveLength(0);
    expect(c.textContent).not.toContain('Ma contribution');
  });
  it('1 participant (total masque, UAT run 6) : pas de "0 / 10000", mention du masquage + ma contribution', async () => {
    const c = await mount(<CollectiveCard {...props} item={item({ total: 0, total_hidden: true, joined_count: 1, my_contribution: 4000 })} />);
    expect(c.textContent).toContain('Total masqué (moins de 3 participants)');
    expect(c.textContent).not.toContain('Groupe : 0');
    expect(c.textContent).toContain('Ma contribution : 4000');
  });
  it('sans defi : message et icone', async () => {
    const c = await mount(<NoCollective c={C} />);
    expect(c.textContent).toContain("Aucun défi de groupe pour l'instant");
  });
});

describe('CelebrationCard (C1..C3)', () => {
  it('titre, texte, raison de l IA en citation, un SEUL bouton Continuer (pas de Refuser)', async () => {
    const onContinue = vi.fn();
    const c = await mount(<CelebrationCard c={C} reason="Ta régularité est solide." onContinue={onContinue} />);
    expect(c.textContent).toContain('Nouvelle piste : Performance');
    expect(c.textContent).toContain('Ta piste Habitudes reste dans ton historique.');
    expect(c.textContent).toContain('« Ta régularité est solide. »');
    expect(c.querySelectorAll('button')).toHaveLength(1);
    btn(c, 'Continuer')!.click();
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
  it('sans raison : pas de citation vide', async () => {
    const c = await mount(<CelebrationCard c={C} reason="" onContinue={noop} />);
    expect(c.textContent).not.toContain('«');
  });
});

describe('copie rendue : aucun mot punitif, aucun emoji', () => {
  it('toutes les cartes confondues', async () => {
    const nodes = [
      <LeagueEntryCard key="a" state={state()} c={C} onPress={noop} />, <LockedCard key="b" c={C} />, <ErrorCard key="c" c={C} onRetry={noop} />,
      <FactionCard key="d" c={C} mine={null} suggested="wellness" memberCount={null} onPick={noop} onChange={noop} />,
      <TrackCard key="e" c={C} state={state()} />, <WeekCard key="f" c={C} state={state()} />,
      <CollectiveCard key="g" c={C} busy={false} onJoin={noop} onDecline={noop} onLeave={noop} item={item({ my_status: 'invited' })} />,
      <NoCollective key="h" c={C} />, <CelebrationCard key="i" c={C} reason="" onContinue={noop} />,
    ];
    const parts: string[] = [];
    for (const n of nodes) parts.push((await mount(n)).textContent ?? '');
    const text = parts.join(' ').toLowerCase();
    for (const w of FORBIDDEN_WORDS) expect(text).not.toContain(w);
    expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
