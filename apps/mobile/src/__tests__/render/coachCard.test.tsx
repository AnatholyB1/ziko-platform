import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { vi } from 'vitest';
import CoachCard from '../../../../../plugins/coach/src/screens/CoachCard';
import { resolveLinkedView } from '../../../../../plugins/coach/src/screens/coachLinked';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(el: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(el);
  });
  return container;
}

const link = { id: 'l1', created_at: '2026-10-03T09:00:00Z' };

describe('CoachCard (COACH-01, CO-1, CO-3, CO-4)', () => {
  it('lien SANS preview : nom generique, badge COACH LIE, Profil indisponible, Reessayer (jamais vide)', async () => {
    const onRetry = vi.fn();
    const view = resolveLinkedView({ link, preview: null })!;
    const c = await mount(<CoachCard view={view} avatarUri={null} actionColor="#CF4509" onRetry={onRetry} />);
    expect(c.textContent).toContain('Ton coach');
    expect(c.textContent).toContain('COACH LIÉ');
    expect(c.textContent).toContain('Profil indisponible');
    expect(c.textContent).toContain('Ton coach depuis le');
    expect(c.textContent).not.toContain('IDENTITÉ VÉRIFIÉE');
    const btn = Array.from(c.querySelectorAll('button')).find((b) => b.textContent === 'Réessayer')!;
    await act(async () => {
      btn.click();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('lien + profil verifie : nom, badge, specialites, stats, pas de bandeau degrade', async () => {
    const view = resolveLinkedView({
      link,
      preview: { display_name: 'Marie Durand', specialties: ['Force', 'Mobilité'], kyc_status: 'verified' },
    })!;
    const c = await mount(
      <CoachCard
        view={view}
        avatarUri={null}
        actionColor="#CF4509"
        stats={[{ value: '12', label: 'Séances' }, { value: '60%', label: "Habitudes aujourd'hui" }]}
      />,
    );
    expect(c.textContent).toContain('Marie Durand');
    expect(c.textContent).toContain('IDENTITÉ VÉRIFIÉE');
    expect(c.textContent).toContain('Force');
    expect(c.textContent).toContain('Mobilité');
    expect(c.textContent).toContain('12');
    expect(c.textContent).not.toContain('Profil indisponible');
    expect(c.querySelector('[data-icon="shield-checkmark"]')).not.toBeNull();
  });

  it('profil non verifie : pas de badge', async () => {
    const view = resolveLinkedView({ link, preview: { display_name: 'Paul', kyc_status: 'pending' } })!;
    const c = await mount(<CoachCard view={view} avatarUri={null} actionColor="#CF4509" />);
    expect(c.textContent).toContain('Paul');
    expect(c.textContent).not.toContain('IDENTITÉ VÉRIFIÉE');
    expect(c.querySelector('[data-icon="shield-checkmark"]')).toBeNull();
  });
});
