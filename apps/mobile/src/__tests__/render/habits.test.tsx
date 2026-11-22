import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { routerCalls } from './stubs/expo-router';
import HabitsPlugin from '../../../../../plugins/habits/src/screens/HabitsPlugin';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function fakeSupabase(habits: any, logs: any = [], opts: { userNull?: boolean; error?: boolean } = {}) {
  return {
    auth: {
      getUser: async () => ({ data: { user: opts.userNull ? null : { id: 'u1' } } }),
    },
    from: (table: string) => {
      const rows = table === 'ziko_habits' ? habits : logs;
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        gte: () => chain,
        then: (res: any) => res(opts.error ? { data: null, error: new Error('boom') } : { data: rows, error: null }),
      };
      return chain;
    },
  };
}

async function mount(supabase: any) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <HabitsPlugin supabase={supabase} />
      </QueryClientProvider>,
    );
  });
  // let user + habits + logs queries settle
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  return { container, root };
}

describe('HabitsPlugin render', () => {
  it('renders the default-seeded habits without throwing', async () => {
    const habits = [
      { id: 'h1', user_id: 'u1', name: 'Water', emoji: '💧', color: '#2196F3', type: 'count', target: 8, unit: 'glasses', source: 'hydration_auto', reminder_time: '09:00:00', is_active: true, sort_order: 0 },
      { id: 'h2', user_id: 'u1', name: 'Workout', emoji: '🏋️', color: '#FF5C1A', type: 'boolean', target: 1, unit: null, source: 'workout_auto', reminder_time: null, is_active: true, sort_order: 1 },
    ];
    const { container } = await mount(fakeSupabase(habits, [{ id: 'l1', habit_id: 'h1', user_id: 'u1', date: new Date().toISOString().split('T')[0], value: 8 }]));
    expect(container.textContent).toContain('Water');
  });
  it('renders with no habits', async () => {
    const { container } = await mount(fakeSupabase([]));
    expect(container.textContent).toContain('Aucune habitude');
  });
  it('renders with null columns and a non-array payload', async () => {
    const habits = [{ id: 'h1', user_id: 'u1', name: null, emoji: null, color: null, reminder_time: null, is_active: true }];
    const { container } = await mount(fakeSupabase(habits));
    expect(container.textContent).toContain('Habitude');
    const weird = await mount(fakeSupabase({ not: 'an array' }, 'nope'));
    expect(weird.container.textContent).toContain('Aucune habitude');
  });

  it('a failing fetch keeps a way back (no dead-end error screen)', async () => {
    routerCalls.length = 0;
    const { container } = await mount(fakeSupabase([], [], { error: true }));
    await act(async () => { await new Promise((r) => setTimeout(r, 1500)); });
    expect(container.textContent).toContain('Retour');
    const back = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Retour');
    await act(async () => back!.click());
    expect(routerCalls.some((c) => c.method === 'back' || c.method === 'replace')).toBe(true);
  });

  it('the loading state keeps the header back button', async () => {
    const supabase = fakeSupabase([]);
    // hang the habits query
    const never = new Promise(() => undefined);
    supabase.from = (t: string) => {
      const chain: any = { select: () => chain, eq: () => chain, gte: () => chain, then: (res: any) => (t === 'ziko_habits' ? never.then(res) : res({ data: [], error: null })) };
      return chain;
    };
    const { container } = await mount(supabase);
    expect(container.querySelector('[data-testid="spinner"]')).not.toBeNull();
    expect(container.querySelector('[data-icon="chevron-back"]')).not.toBeNull();
  });
});

describe('habit reminders never take the screen down', () => {
  it('scheduleAllReminders resolves even when the native module throws', async () => {
    const mod = await import('expo-notifications');
    const spy = vi.spyOn(mod, 'scheduleNotificationAsync').mockRejectedValue(new Error('native boom'));
    const { scheduleAllReminders } = await import('../../../../../plugins/habits/src/notifications');
    await expect(
      scheduleAllReminders([{ id: 'h', name: 'x', emoji: '', reminder_time: '09:00:00', is_active: true } as any], 'Ziko'),
    ).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
