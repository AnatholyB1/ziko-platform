import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routerCalls } from './stubs/expo-router';
import JournalPlugin from '../../../../../plugins/journal/src/screens/JournalPlugin';
import { clearDraft, localDateKey } from '../../../../../plugins/journal/src/logic';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const CHECK = ['pre_workout', 'post_workout', 'morning', 'evening', 'general'];

function fakeSupabase(rows: any[], opts: { user?: 'ok' | 'null' } = {}) {
  const inserted: any[] = [];
  const updated: any[] = [];
  return {
    inserted,
    updated,
    auth: { getUser: async () => ({ data: { user: opts.user === 'null' ? null : { id: 'u1' } } }) },
    from: () => {
      const filters: [string, any][] = [];
      let op: 'select' | 'insert' | 'update' = 'select';
      let patch: any;
      const chain: any = {
        select: () => chain,
        eq: (c: string, v: any) => (filters.push([c, v]), chain),
        gte: () => chain,
        order: () => chain,
        limit: () => chain,
        insert: (r: any) => ((op = 'insert'), (patch = r), chain),
        update: (p: any) => ((op = 'update'), (patch = p), chain),
        then: (res: any) => {
          if (op === 'insert') {
            if (!CHECK.includes(patch.context)) return res({ data: null, error: { message: 'check violation' } });
            inserted.push(patch);
            return res({ data: null, error: null });
          }
          if (op === 'update') {
            updated.push(patch);
            return res({ data: null, error: null });
          }
          const ctx = filters.find(([c]) => c === 'context');
          const out = rows.filter((r) => (ctx ? r.context === ctx[1] : true));
          return res({ data: out, error: null });
        },
      };
      return chain;
    },
  };
}

async function mount(props: any, keepDraft = false) {
  if (!keepDraft) clearDraft();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <JournalPlugin {...props} />
      </QueryClientProvider>,
    );
  });
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  return container;
}

const press = async (el: Element | undefined) => {
  await act(async () => {
    (el as HTMLElement).click();
  });
  for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
};
const button = (c: HTMLElement, text: string) =>
  Array.from(c.querySelectorAll('button')).find((b) => b.textContent?.includes(text));

describe('JournalPlugin render', () => {
  it('formulaire en Ionicons, 0 emoji a l ecran (JR-1)', async () => {
    const c = await mount({ supabase: fakeSupabase([]) });
    for (const icon of ['sad-outline', 'sad', 'remove-circle', 'happy', 'happy-outline', 'battery-half', 'pulse', 'sunny', 'barbell', 'fitness', 'moon', 'ellipse']) {
      expect(c.querySelector(`[data-icon="${icon}"]`), icon).not.toBeNull();
    }
    expect(c.textContent).toContain('Super');
    expect(/\p{Extended_Pictographic}/u.test(c.textContent ?? '')).toBe(false);
    expect(c.textContent).toContain('Enregistrer');
  });

  it('enregistre avec une session valide : 1 ligne, aucune alerte "non connecte" (JR-2)', async () => {
    const sb = fakeSupabase([]);
    const c = await mount({ supabase: sb });
    await press(button(c, 'Enregistrer'));
    expect(sb.inserted).toHaveLength(1);
    expect(sb.inserted[0]).toMatchObject({ user_id: 'u1', context: 'general', date: localDateKey() });
    expect(c.textContent).toContain('Entrée enregistrée');
    expect(c.textContent).not.toContain('Utilisateur non connecté');
  });

  it('utilisateur d abord indisponible puis valide : l enregistrement reussit (cache a vie supprime)', async () => {
    let calls = 0;
    const sb = fakeSupabase([]);
    const requireUser = async () => {
      calls++;
      if (calls <= 2) {
        const e = new Error('Session expirée');
        e.name = 'SessionExpiredError';
        throw e;
      }
      return { id: 'u1' };
    };
    const c = await mount({ supabase: sb, requireUser });
    await press(button(c, 'Enregistrer'));
    expect(sb.inserted).toHaveLength(1);
    expect(c.textContent).not.toContain('Utilisateur non connecté');
  });

  it('session expiree : bandeau, saisie conservee, Se reconnecter appelle onReauth (JR-6)', async () => {
    const sb = fakeSupabase([]);
    const expired = async () => {
      const e = new Error('Session expirée');
      e.name = 'SessionExpiredError';
      throw e;
    };
    const onReauth = vi.fn();
    const c = await mount({ supabase: sb, requireUser: expired, onReauth });
    await press(button(c, 'Soir'));
    await press(button(c, 'Enregistrer'));
    expect(sb.inserted).toHaveLength(0);
    expect(c.textContent).toContain('Session expirée');
    expect(c.textContent).toContain('ta saisie est conservée');
    expect(c.textContent).not.toContain('Utilisateur non connecté');
    await press(button(c, 'Se reconnecter'));
    expect(onReauth).toHaveBeenCalled();

    // Retour de l'ecran de connexion : nouveau montage, saisie intacte (brouillon), enregistrement OK.
    const sb2 = fakeSupabase([]);
    const c2 = await mount({ supabase: sb2 }, true);
    await press(button(c2, 'Enregistrer'));
    expect(sb2.inserted).toHaveLength(1);
    expect(sb2.inserted[0].context).toBe('evening');
  });

  it('humeur deja notee depuis l accueil : bandeau + Mettre a jour (JR-4)', async () => {
    const today = localDateKey();
    const sb = fakeSupabase([{ id: 'q1', mood: 4, energy: null, stress: null, notes: null, context: 'general', date: today }]);
    const c = await mount({ supabase: sb });
    expect(c.textContent).toContain("Humeur déjà notée aujourd'hui depuis l'accueil : Bien");
    expect(button(c, 'Mettre à jour')).toBeDefined();
    await press(button(c, 'Mettre à jour'));
    expect(sb.updated).toHaveLength(1);
    expect(sb.inserted).toHaveLength(0);
  });

  it('le moment Avant seance s ecrit pre_workout', async () => {
    const sb = fakeSupabase([]);
    const c = await mount({ supabase: sb });
    await press(button(c, 'Avant séance'));
    await press(button(c, 'Enregistrer'));
    expect(sb.inserted[0].context).toBe('pre_workout');
  });

  it('historique vide : etat vide + Noter ma journee', async () => {
    const c = await mount({ supabase: fakeSupabase([]) });
    await press(button(c, 'Historique'));
    expect(c.textContent).toContain("Aucune entrée pour l'instant");
    expect(c.textContent).toContain('Noter ma journée');
  });

  it('en-tete PluginHeader avec retour', async () => {
    routerCalls.length = 0;
    const c = await mount({ supabase: fakeSupabase([]) });
    expect(c.textContent).toContain('Journal');
  });
});
