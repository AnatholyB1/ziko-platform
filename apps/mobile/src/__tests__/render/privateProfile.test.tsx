import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import PrivateProfileNotice from '../../components/PrivateProfileNotice';

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

describe('profil prive non-ami (P21, run5)', () => {
  it('affiche la mention explicite "Ce profil est prive" (jamais de faux zeros)', async () => {
    const c = await mount(<PrivateProfileNotice name="Camille Dupont" />);
    expect(c.textContent).toContain('Ce profil est privé');
    expect(c.textContent).toContain('amis de Camille');
    expect(c.textContent).not.toContain('Pas encore de niveau');
    expect(c.textContent).not.toMatch(/\b0\b/);
  });
  it('sans nom : texte generique', async () => {
    const c = await mount(<PrivateProfileNotice />);
    expect(c.textContent).toContain('Ce profil est privé');
    expect(c.textContent).toContain('Seuls ses amis');
  });
  it("garde statique : l'ecran profil bascule sur la mention quand is_private, et masque stats/badges/seances", () => {
    const src = readFileSync(resolve(__dirname, '../../../app/(app)/profile/[userId].tsx'), 'utf8');
    expect(src).toMatch(/profile\.is_private \? \(\s*<PrivateProfileNotice/);
    const iPriv = src.indexOf('profile.is_private ?');
    expect(src.indexOf('amis</Text>')).toBeGreaterThan(iPriv); // stats dans la branche "non prive"
    expect(src.indexOf('Aucun badge pour le moment')).toBeGreaterThan(iPriv);
  });
});
