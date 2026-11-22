import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GamificationPlugin from '../../../../../plugins/gamification/src/screens/GamificationPlugin';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// ── Faux Supabase a etat (les RPC mutent les tables, comme la base) ─────────────
const DEFS = [
  ['first_session', 'Première séance', 'sessions', 1, 1],
  ['ten_sessions', '10 séances', 'sessions', 10, 1],
  ['fifty_sessions', '50 séances', 'sessions', 50, 2],
  ['hundred_sessions', '100 séances', 'sessions', 100, 3],
  ['streak_7', 'Streak 7 jours', 'streak', 7, 1],
  ['streak_30', 'Streak 30 jours', 'streak', 30, 2],
  ['streak_100', 'Streak 100 jours', 'streak', 100, 3],
  ['first_pr', 'Premier PR', 'prs', 1, 1],
  ['ten_prs', '10 PRs battus', 'prs', 10, 2],
  ['profile_complete', 'Profil complet', 'profile_complete', 1, 1],
  ['first_friend', 'Premier ami', 'friends', 1, 1],
].map(([slug, name, ct, cv, tier]) => ({ slug, name, description: `Condition ${slug}`, icon: '🏋️', condition_type: ct, condition_value: cv, tier }));

interface World {
  coins: number;
  level: number;
  earned: { badge_slug: string; earned_at: string }[];
  counters: Record<string, number>;
  shop: any[];
  inventory: { item_id: string; is_equipped: boolean }[];
  tx: any[];
  failNetwork: boolean;
  awardOnCheck: string[]; // slugs que la prochaine verification attribue
  calls: string[];
}

function fakeSupabase(w: World) {
  const rpc = async (fn: string, args: any) => {
    w.calls.push(fn);
    if (w.failNetwork) return { data: null, error: { message: 'Network request failed' } };
    switch (fn) {
      case 'ziko_ensure_gamification_profile':
        return { data: { user_id: 'u1', xp: 1240, level: w.level, coins: w.coins, current_streak: 5, longest_streak: 5, last_activity_date: null, equipped_title: 'Athlète', equipped_badge: null, equipped_banner_name: null, equipped_theme: null }, error: null };
      case 'ziko_check_and_award_badges': {
        const out = w.awardOnCheck.map((slug) => {
          w.earned.push({ badge_slug: slug, earned_at: new Date().toISOString() });
          return { slug, name: DEFS.find((d) => d.slug === slug)!.name, coins: 25 };
        });
        w.awardOnCheck = [];
        return { data: out, error: null };
      }
      case 'ziko_get_badge_progress':
        return { data: { counters: w.counters, badges: DEFS.map((d) => ({ slug: d.slug, current: w.counters[d.condition_type] ?? 0, reward_coins: 25 })) }, error: null };
      case 'ziko_purchase_shop_item': {
        const it = w.shop.find((s) => s.id === args.p_item_id);
        if (!it || w.coins < it.price) return { data: { success: false, error: 'Pas assez de pièces' }, error: null };
        w.coins -= it.price;
        w.inventory.push({ item_id: it.id, is_equipped: false });
        w.tx.unshift({ id: `tx${w.tx.length}`, amount: -it.price, source: 'purchase', description: `🛒 Achat : ${it.name}`, created_at: new Date().toISOString() });
        return { data: { success: true }, error: null };
      }
      case 'ziko_equip_item': {
        const it = w.shop.find((s) => s.id === args.p_item_id);
        w.inventory = w.inventory.map((i) => {
          const cat = w.shop.find((s) => s.id === i.item_id)?.category;
          if (i.item_id === it.id) return { ...i, is_equipped: true };
          return cat === it.category ? { ...i, is_equipped: false } : i;
        });
        return { data: { success: true, category: it.category }, error: null };
      }
      default:
        return { data: null, error: null };
    }
  };
  const tables: Record<string, () => any> = {
    ziko_level_definitions: () => [
      { level: 1, xp_required: 0, title: 'Débutant', reward_coins: 0 },
      { level: 7, xp_required: 1000, title: 'Athlète', reward_coins: 0 },
      { level: 8, xp_required: 1500, title: 'Pro', reward_coins: 0 },
    ],
    ziko_badge_definitions: () => DEFS,
    ziko_user_badges: () => w.earned,
    ziko_shop_items: () => w.shop,
    ziko_user_inventory: () => w.inventory,
    ziko_coin_transactions: () => w.tx,
    ziko_user_profiles: () => ({ name: 'Anatholy' }),
  };
  return {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }), getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    rpc,
    from: (table: string) => {
      const chain: any = {
        select: () => chain, eq: () => chain, order: () => chain, range: () => chain, limit: () => chain,
        maybeSingle: async () => ({ data: tables[table]?.() ?? null, error: null }),
        then: (ok: any, bad: any) => {
          const res = w.failNetwork ? { data: null, error: { message: 'Network request failed' } } : { data: tables[table]?.() ?? [], error: null };
          return Promise.resolve(res).then(ok, bad);
        },
      };
      return chain;
    },
  };
}

const item = (id: string, category: string, name: string, price: number, level = 1) => ({ id, category, name, description: null, price, level_required: level, is_active: true, icon: null, metadata: {} });

function world(over: Partial<World> = {}): World {
  return {
    coins: 340, level: 7,
    earned: ['first_session', 'ten_sessions', 'first_pr', 'profile_complete'].map((s, i) => ({ badge_slug: s, earned_at: `2026-09-0${i + 3}T10:00:00Z` })),
    counters: { sessions: 42, streak: 5, prs: 6, friends: 0, profile_complete: 1 },
    shop: [], inventory: [], tx: [], failNetwork: false, awardOnCheck: [], calls: [],
    ...over,
  };
}

async function settle() {
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 8)); });
}

// Demonte tous les arbres a la fin de chaque test : les minuteurs en attente (toast 3,2 s, etc.) sont nettoyes avant la
// fin de l'environnement (sinon « window is not defined » en tache de fond, flake observe sous charge).
const mountedRoots: Root[] = [];
afterEach(async () => {
  const roots = mountedRoots.splice(0);
  await act(async () => { roots.forEach((r) => r.unmount()); });
});

async function mount(w: World, props: Record<string, unknown> = {}) {
  const slow = w.failNetwork; // l'ecran retente une fois (300 ms) avant la carte d'erreur
  const container = document.createElement('div');
  document.body.appendChild(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRoot(container);
  mountedRoots.push(root);
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <GamificationPlugin supabase={fakeSupabase(w)} {...props} />
      </QueryClientProvider>,
    );
  });
  await settle();
  if (slow) await act(async () => { await new Promise((r) => setTimeout(r, 700)); });
  await settle();
  return { container, root };
}

const buttons = (c: HTMLElement) => [...c.querySelectorAll('button')] as HTMLElement[];
const byText = (c: HTMLElement, t: string) => buttons(c).find((b) => b.textContent?.trim() === t || b.textContent?.includes(t));
async function click(c: HTMLElement, t: string) {
  const b = byText(c, t);
  if (!b) throw new Error(`button not found: ${t}`);
  await act(async () => { b.click(); });
  await settle();
}

describe('Recompenses : onglets et solde (R-1)', () => {
  it('shows exactly Niveau, Succes, Boutique, Quetes in order, with the balance chip', async () => {
    const { container } = await mount(world());
    const tabs = buttons(container).map((b) => b.textContent?.trim()).filter((t) => ['Niveau', 'Succès', 'Boutique', 'Quêtes'].includes(t as string));
    expect(tabs).toEqual(['Niveau', 'Succès', 'Boutique', 'Quêtes']);
    expect(container.textContent).toContain('340');
    // la puce reste sur chaque onglet
    for (const t of ['Succès', 'Boutique', 'Quêtes']) {
      await click(container, t);
      expect(container.textContent).toContain('340');
    }
  });

  it('Niveau: real level data and the honest empty state for gains', async () => {
    const { container } = await mount(world());
    expect(container.textContent).toContain('1240 / 1500 XP');
    expect(container.textContent).toContain('260 XP pour le niveau 8');
    expect(container.textContent).toContain('5 jours');
    expect(container.textContent).toContain('4 / 11');
    expect(container.textContent).toContain("Aucun gain pour l'instant");
  });
});

describe('Succes (R-2, R-3, R-4, R-10)', () => {
  it('R-2: 11 rows = 7 to unlock (with n / N) + 4 unlocked', async () => {
    const { container } = await mount(world(), { initialTab: 'Succès' });
    const t = container.textContent ?? '';
    expect(t).toContain('4 sur 11 débloqués');
    expect(t).toContain('À débloquer');
    expect(t).toContain('Débloqués');
    for (const d of DEFS) expect(t).toContain(d.name);
    expect(t).toContain('42 / 50');
    expect(t).toContain('5 / 7');
    expect(t).toContain('0 / 1'); // Premier ami
    expect(t).toContain('Débloqué le 3 sept.');
    expect(t).not.toContain('🏋'); // l'emoji stocke n'est jamais rendu
  });

  it('R-3: a badge awarded by the check moves to Debloques without a reload, with a toast', async () => {
    const w = world({ earned: [], counters: { sessions: 1, streak: 0, prs: 0, friends: 0, profile_complete: 0 }, awardOnCheck: ['first_session'] });
    const { container } = await mount(w, { initialTab: 'Succès' });
    expect(w.calls).toContain('ziko_check_and_award_badges');
    expect(container.textContent).toContain('1 sur 11 débloqués');
    expect(container.textContent).toContain('Succès débloqué : Première séance (+25 pièces)');
  });

  it('R-4: the sheet shows a real date when unlocked and none when locked', async () => {
    const { container } = await mount(world(), { initialTab: 'Succès' });
    await click(container, 'Première séance');
    expect(container.textContent).toContain('DÉBLOQUÉ');
    expect(container.textContent).toContain('Débloqué le 3 septembre 2026');
    await click(container, 'Fermer');
    await click(container, 'Streak 7 jours');
    expect(container.textContent).toContain('VERROUILLÉ');
    expect(container.textContent).toContain("Encore 2 jours d'entraînement ou de check-in.");
    expect(container.textContent).not.toMatch(/Débloqué le \d+ (?!sept\.)[a-zéû]+ 20\d\d/);
    expect(container.textContent).toContain('+25 pièces');
  });

  it('R-10: network failure shows the error card and ZERO invented items', async () => {
    const { container } = await mount(world({ failNetwork: true }), { initialTab: 'Succès' });
    expect(container.textContent).toContain('Succès indisponibles');
    expect(container.textContent).toContain('Réessayer');
    for (const fake of ['Marathonien', 'Hercule', 'Aqua-pro', 'Méditant', 'PR Hunter', 'Premier pas']) expect(container.textContent).not.toContain(fake);
    for (const d of DEFS) expect(container.textContent).not.toContain(d.name);
  });
});

describe('Boutique (R-5, R-6, R-7, R-8)', () => {
  const badges = Array.from({ length: 12 }, (_, i) => item(`b${i}`, 'badge', `Badge ${String(i).padStart(2, '0')}`, 50 + i));
  const shop = [...badges, item('th1', 'theme', 'Bleu Océan', 500), item('th2', 'theme', 'Vert Forêt', 300), item('th3', 'theme', 'Noir Carbone', 900, 10), item('ti1', 'title', 'Machine', 300), item('ti2', 'title', 'Bête', 200)];

  it('R-5: category counters are real and a 12-item category shows all 12', async () => {
    const { container } = await mount(world({ shop }), { initialTab: 'Boutique' });
    expect(buttons(container).find((b) => b.textContent === 'Badges12')).toBeTruthy();
    expect(buttons(container).find((b) => b.textContent === 'Thèmes3')).toBeTruthy();
    await click(container, 'Badges');
    const shown = badges.filter((b) => container.textContent?.includes(b.name));
    expect(shown).toHaveLength(12);
  });

  it('R-6/R-7: insufficient balance disables the CTA with the contract copy; a valid purchase debits the chip', async () => {
    const w = world({ shop, coins: 340 });
    const { container } = await mount(w, { initialTab: 'Boutique' });
    // theme list: Bleu Océan 500 > 340 solde
    expect(container.textContent).toContain('Il manque 160 pièces');
    expect(container.textContent).toContain('Niveau 10'); // verrou de niveau
    await click(container, 'Bleu Océan');
    expect(container.textContent).toContain('Pièces insuffisantes');
    expect(container.textContent).toContain("Il te manque 160 pièces. Gagne-en en t'entraînant.");
    await click(container, 'Fermer');

    await click(container, 'Vert Forêt'); // 300 <= 340 -> achetable (apercu possible sur tout objet non possede)
    expect(container.textContent).toContain('Solde après achat');
    expect(container.textContent).toContain('40 pièces');
    await click(container, 'Acheter pour 300 pièces');
    expect(container.textContent).toContain('Vert Forêt acheté. Équipe-le dans Mes objets.');
    // solde = ancien - prix, lu dans la puce de l'en-tete
    expect(container.textContent).toContain('40');
    expect(w.coins).toBe(40);
    await click(container, 'Mes objets');
    expect(container.textContent).toContain('Vert Forêt');
  });

  it('R-8: equipping B removes EQUIPE from A in the same render (exactly one per category)', async () => {
    const w = world({ shop, inventory: [{ item_id: 'ti1', is_equipped: true }, { item_id: 'ti2', is_equipped: false }] });
    const { container } = await mount(w, { initialTab: 'Boutique' });
    await click(container, 'Mes objets');
    expect((container.textContent?.match(/ÉQUIPÉ/g) ?? []).length).toBe(1);
    await click(container, 'Équiper');
    expect((container.textContent?.match(/ÉQUIPÉ/g) ?? []).length).toBe(1);
    expect(w.inventory.filter((i) => i.is_equipped)).toHaveLength(1);
    expect(w.inventory.find((i) => i.is_equipped)!.item_id).toBe('ti2');
    expect(container.textContent).toContain('Un seul titre est affiché à la fois. Les autres restent à toi.');
  });

  it('Q6: with a coach branding active, equipping a theme tells the athlete the coach colours stay', async () => {
    const w = world({ shop, inventory: [{ item_id: 'th2', is_equipped: false }] });
    const { container } = await mount(w, { initialTab: 'Boutique', coachBrandingActive: true });
    await click(container, 'Mes objets');
    expect(container.textContent).toContain('Les couleurs de ton coach restent affichées');
  });

  it('Shop failure: error card, no fallback items', async () => {
    const { container } = await mount(world({ shop, failNetwork: true }), { initialTab: 'Boutique' });
    expect(container.textContent).toContain('Boutique indisponible');
    expect(container.textContent).not.toContain('Machine');
  });
});

describe('Historique (R-9) et Quetes (REWD-10)', () => {
  it('Historique: rows come from the table, emoji stripped, newest first; empty copy otherwise', async () => {
    const tx = [
      { id: 'a', amount: 25, source: 'workout', description: '💰 Séance terminée : +25 pièces', created_at: new Date().toISOString() },
      { id: 'b', amount: -300, source: 'purchase', description: '🛒 Achat : Machine', created_at: '2026-10-01T10:00:00Z' },
    ];
    const { container } = await mount(world({ tx }));
    await click(container, 'Tout voir');
    const t = container.textContent ?? '';
    expect(t).toContain('Historique des gains');
    expect(t.indexOf('Séance terminée : +25 pièces')).toBeLessThan(t.indexOf('Achat : Machine'));
    expect(t).toContain('+25 pièces');
    expect(t).toContain('−300 pièces');
    expect(t).not.toContain('💰');
    expect(t).not.toContain('🛒');

    const empty = await mount(world({ tx: [] }));
    await click(empty.container, 'Tout voir');
    expect(empty.container.textContent).toContain("Aucun gain pour l'instant");
  });

  it('Quetes: honest empty state, none of the former static quests', async () => {
    const { container } = await mount(world(), { initialTab: 'Quêtes' });
    expect(container.textContent).toContain('Pas de quête active');
    for (const gone of ['Battre un PR cette semaine', '5 séances en 7 jours', '3 jours hydratation parfaite', 'Squat à 145kg']) {
      expect(container.textContent).not.toContain(gone);
    }
  });
});
