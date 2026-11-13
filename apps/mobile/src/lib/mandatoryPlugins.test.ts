import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MANDATORY_PLUGIN_IDS,
  isMandatoryPlugin,
  uninstallDecision,
  MANDATORY_ALERT_TITLE,
} from './mandatoryPlugins';

const root = resolve(__dirname, '../../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('plugins obligatoires (MCOA-02)', () => {
  it('coach est obligatoire (liste statique ET manifeste), pas habits', () => {
    expect(MANDATORY_PLUGIN_IDS).toContain('coach');
    expect(isMandatoryPlugin('coach')).toBe(true);
    expect(isMandatoryPlugin('habits')).toBe(false);
    expect(isMandatoryPlugin('inconnu', { mandatory: true })).toBe(true);
  });

  it('desinstallation refusee avec alerte pour coach (meme si le registre n a pas le flag), permise sinon', () => {
    const d = uninstallDecision('coach', undefined);
    expect(d.allowed).toBe(false);
    expect(d.allowed === false && d.title).toBe(MANDATORY_ALERT_TITLE);
    expect(uninstallDecision('habits', { mandatory: false })).toEqual({ allowed: true });
  });

  it('la liste statique reste synchronisee avec le manifeste coach (mandatory: true)', () => {
    const manifest = read('plugins/coach/src/manifest.ts');
    expect(manifest).toMatch(/id: 'coach'/);
    expect(manifest).toMatch(/mandatory: true/);
    expect(MANDATORY_PLUGIN_IDS).toContain('coach');
  });

  it('les deux chemins de desinstallation du store passent par uninstallDecision avant tout delete', () => {
    for (const f of ['apps/mobile/app/(app)/store/index.tsx', 'apps/mobile/app/(app)/store/[id].tsx']) {
      const src = read(f);
      expect(src).toContain('uninstallDecision');
      const guard = src.indexOf('uninstallDecision(');
      const del = src.indexOf(".delete()");
      expect(guard).toBeGreaterThan(-1);
      expect(del).toBeGreaterThan(guard);
    }
  });

  it('PluginLoader consomme la liste partagee (plus de copie locale)', () => {
    const src = read('apps/mobile/src/lib/PluginLoader.tsx');
    expect(src).toContain("from './mandatoryPlugins'");
    expect(src).not.toMatch(/const MANDATORY_PLUGIN_IDS/);
  });
});

describe('migrations P25 (statique : le SQL n est PAS execute ici)', () => {
  const guard = read('supabase/migrations/202612012501_coach_link_guard.sql');
  const plugins = read('supabase/migrations/202612012503_mandatory_plugin_guard.sql');

  it('garde du lien : identite immuable, athlete = revoked_at seulement, retire = fige, revoked_by non falsifiable', () => {
    expect(guard).toMatch(/coach_id IS DISTINCT FROM OLD\.coach_id/);
    expect(guard).toMatch(/client_id IS DISTINCT FROM OLD\.client_id/);
    expect(guard).toMatch(/revoked coach link is immutable/);
    expect(guard).toMatch(/athlete may only revoke the link/);
    expect(guard).toMatch(/NEW\.revoked_by := CASE/);
    expect(guard).toMatch(/BEFORE UPDATE ON public\.ziko_coach_client_links/);
  });
  it('policies UPDATE scindees, chacune limitee aux lignes actives et a son propre id', () => {
    expect(guard).toMatch(/USING \(auth\.uid\(\) = client_id AND revoked_at IS NULL\)/);
    expect(guard).toMatch(/USING \(auth\.uid\(\) = coach_id AND revoked_at IS NULL\)/);
    expect(guard).toMatch(/DROP POLICY IF EXISTS "coach_client_links_participant_revoke"/);
  });
  it('plugin obligatoire : DELETE et UPDATE gardes, seulement quand l appelant est le proprietaire', () => {
    expect(plugins).toMatch(/BEFORE DELETE ON public\.ziko_user_plugins/);
    expect(plugins).toMatch(/BEFORE UPDATE ON public\.ziko_user_plugins/);
    expect(plugins).toMatch(/v_uid IS NULL OR v_uid <> OLD\.user_id/);
    expect(plugins).toMatch(/manifest ->> 'mandatory'/);
  });
  it('aucune des migrations P25 ne supprime de ligne de lien (historique conserve)', () => {
    expect(guard).not.toMatch(/DELETE FROM/i);
  });
});
