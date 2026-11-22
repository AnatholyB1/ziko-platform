import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { vi } from 'vitest';

const showAlert = vi.fn();
vi.mock('@ziko/plugin-sdk', () => ({ showAlert: (...a: any[]) => showAlert(...a) }));

import PluginStoreButton from '../../components/PluginStoreButton';

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

const base = { primary: '#CF4509', muted: '#6B6963' };

describe('PluginStoreButton (P25 MC-11, run5)', () => {
  beforeEach(() => showAlert.mockClear());

  it('module obligatoire : libelle "Obligatoire", bouton PRESSABLE, le tap affiche l\'alerte explicative sans desinstaller', async () => {
    const onUninstall = vi.fn();
    const c = await mount(<PluginStoreButton {...base} isInstalled mandatory onInstall={vi.fn()} onUninstall={onUninstall} />);
    const btn = c.querySelector('button')!;
    expect(btn.textContent).toContain('Obligatoire');
    expect(btn.hasAttribute('disabled')).toBe(false);
    expect(btn.getAttribute('aria-disabled')).not.toBe('true');
    await act(async () => {
      btn.click();
    });
    expect(showAlert).toHaveBeenCalledTimes(1);
    expect(showAlert.mock.calls[0][0]).toBe('Module obligatoire');
    expect(showAlert.mock.calls[0][1]).toContain('ne peut pas être désinstallé');
    expect(onUninstall).not.toHaveBeenCalled();
  });

  it('garde statique : le stub RN ignore accessibilityState, donc on interdit "disabled" dans le bouton et la carte', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const btn = fs.readFileSync(path.resolve(__dirname, '../../components/PluginStoreButton.tsx'), 'utf8');
    const store = fs.readFileSync(path.resolve(__dirname, '../../../app/(app)/store/index.tsx'), 'utf8');
    const code = btn.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/disabled|accessibilityState/);
    expect(store).not.toMatch(/accessibilityState=\{mandatory/);
  });

  it('module normal : installer / desinstaller sans alerte obligatoire', async () => {
    const onInstall = vi.fn();
    const onUninstall = vi.fn();
    const a = await mount(<PluginStoreButton {...base} isInstalled={false} mandatory={false} onInstall={onInstall} onUninstall={onUninstall} />);
    await act(async () => {
      a.querySelector('button')!.click();
    });
    expect(onInstall).toHaveBeenCalledTimes(1);
    const b = await mount(<PluginStoreButton {...base} isInstalled mandatory={false} onInstall={onInstall} onUninstall={onUninstall} />);
    await act(async () => {
      b.querySelector('button')!.click();
    });
    expect(onUninstall).toHaveBeenCalledTimes(1);
    expect(showAlert).not.toHaveBeenCalled();
  });
});
