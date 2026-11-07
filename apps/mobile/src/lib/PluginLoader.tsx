import React, { useEffect, useRef } from 'react';
import { usePluginRegistry, isPluginUnlocked, isPluginIdUnlocked } from '@ziko/plugin-sdk';
import type { PluginManifest } from '@ziko/plugin-sdk';
import { supabase } from '../lib/supabase';
import { aiBridge } from '../lib/ai';
import { useAuthStore } from '../stores/authStore';

// Static plugin loaders — Metro bundler requires statically-analyzable imports
const PLUGIN_LOADERS: Record<string, () => Promise<{ default: PluginManifest }>> = {
  nutrition:     () => import('@ziko/plugin-nutrition/manifest') as any,
  persona:       () => import('@ziko/plugin-persona/manifest') as any,
  habits:        () => import('@ziko/plugin-habits/manifest') as any,
  stats:         () => import('@ziko/plugin-stats/manifest') as any,
  gamification:  () => import('@ziko/plugin-gamification/manifest') as any,
  community:     () => import('@ziko/plugin-community/manifest') as any,
  stretching:    () => import('@ziko/plugin-stretching/manifest') as any,
  sleep:         () => import('@ziko/plugin-sleep/manifest') as any,
  measurements:  () => import('@ziko/plugin-measurements/manifest') as any,
  timer:         () => import('@ziko/plugin-timer/manifest') as any,
  'ai-programs': () => import('@ziko/plugin-ai-programs/manifest') as any,
  journal:       () => import('@ziko/plugin-journal/manifest') as any,
  hydration:     () => import('@ziko/plugin-hydration/manifest') as any,
  cardio:        () => import('@ziko/plugin-cardio/manifest') as any,
  wearables:     () => import('@ziko/plugin-wearables/manifest') as any,
  supplements:   () => import('@ziko/plugin-supplements/manifest') as any,
  rpe:           () => import('@ziko/plugin-rpe/manifest') as any,
  pantry:        () => import('@ziko/plugin-pantry/manifest') as any,
  coach:         () => import('@ziko/plugin-coach/manifest') as any,
};

// Plugins pre-loaded unconditionally regardless of user_plugins — keep in
// sync with any manifest.ts declaring `mandatory: true`.
const MANDATORY_PLUGIN_IDS: string[] = ['coach'];

/** Auto-install the coach plugin for athletes (role 'client' or 'both') — idempotent */
async function autoInstallCoachPlugin(userId: string): Promise<void> {
  try {
    const { data: profileRow } = await supabase
      .from('ziko_user_profiles')
      .select('role')
      .eq('id', userId)
      .single();
    const role = profileRow?.role ?? 'client';
    if (role === 'client' || role === 'both') {
      await supabase
        .from('ziko_user_plugins')
        .upsert(
          { user_id: userId, plugin_id: 'coach', is_enabled: true },
          { onConflict: 'user_id,plugin_id' }
        );
    }
  } catch (err) {
    console.warn('[PluginLoader] autoInstallCoachPlugin failed:', err);
  }
}

interface PluginLoaderProps {
  children: React.ReactNode;
}

export function PluginLoader({ children }: PluginLoaderProps) {
  const user = useAuthStore((s) => s.user);
  // Progressive unlock (Phase 46): gating order is mandatory -> minLevel -> is_enabled.
  const effectiveLevel = useAuthStore((s) => s.effectiveLevel);
  const levelLoaded = useAuthStore((s) => s.levelLoaded);
  const { registerPlugin, unregisterPlugin } = usePluginRegistry();
  const loadedRef = useRef<Set<string>>(new Set());
  const manifestCacheRef = useRef<Map<string, PluginManifest>>(new Map());
  const coachInstalledForRef = useRef<string | null>(null);
  const runRef = useRef(0);

  // Signout / user switch: unregister everything.
  useEffect(() => {
    return () => {
      for (const pluginId of loadedRef.current) {
        unregisterPlugin(pluginId);
        aiBridge.unregisterPlugin(pluginId);
      }
      loadedRef.current.clear();
      manifestCacheRef.current.clear();
      coachInstalledForRef.current = null;
    };
  }, [user?.id]);

  // Re-evaluated whenever the level changes, so a level-up registers newly
  // unlocked plugins without a restart. Already-installed plugins above the
  // level are skipped / unregistered (their ziko_user_plugins rows and data are
  // left untouched).
  useEffect(() => {
    if (!user) return;

    const run = ++runRef.current;
    const isStale = () => run !== runRef.current;

    async function getManifest(pluginId: string): Promise<PluginManifest | null> {
      const cached = manifestCacheRef.current.get(pluginId);
      if (cached) return cached;
      const loader = PLUGIN_LOADERS[pluginId];
      if (!loader) return null;
      const mod = await loader();
      const manifest: PluginManifest = mod.default;
      manifestCacheRef.current.set(pluginId, manifest);
      return manifest;
    }

    function register(manifest: PluginManifest) {
      registerPlugin(manifest);
      aiBridge.registerPlugin(manifest);
      loadedRef.current.add(manifest.id);
    }

    async function syncPlugins() {
      if (!user) return;

      for (const pluginId of MANDATORY_PLUGIN_IDS) {
        if (isStale()) return;
        if (loadedRef.current.has(pluginId)) continue;
        try {
          const manifest = await getManifest(pluginId);
          if (isStale() || !manifest) return;
          register(manifest);
        } catch (err) {
          console.warn(`[PluginLoader] Failed to load mandatory plugin "${pluginId}":`, err);
        }
      }

      if (isStale()) return;
      if (coachInstalledForRef.current !== user.id) {
        await autoInstallCoachPlugin(user.id);
        coachInstalledForRef.current = user.id;
      }
      if (isStale()) return;

      // Do not act on the fail-safe default level before the first read.
      if (!levelLoaded) return;

      // Re-lock: every plugin above the (possibly lower) level. Walk the
      // registry's installed ids too, not only loadedRef, so plugins registered
      // outside the loader (plugin store install) are caught as well.
      const registry = usePluginRegistry.getState();
      const candidates = new Set<string>([...loadedRef.current, ...registry.installedPlugins]);
      for (const pluginId of candidates) {
        const manifest = registry.manifests[pluginId] ?? manifestCacheRef.current.get(pluginId);
        const locked = manifest
          ? !isPluginUnlocked(manifest, effectiveLevel)
          : !isPluginIdUnlocked(pluginId, effectiveLevel);
        if (locked) {
          unregisterPlugin(pluginId);
          aiBridge.unregisterPlugin(pluginId);
          loadedRef.current.delete(pluginId);
        }
      }

      const { data: userPlugins, error } = await supabase
        .from('ziko_user_plugins')
        .select('plugin_id, is_enabled')
        .eq('user_id', user.id)
        .eq('is_enabled', true);

      if (isStale() || error || !userPlugins) return;

      for (const up of userPlugins) {
        if (isStale()) return;
        const pluginId = up.plugin_id as string;
        if (loadedRef.current.has(pluginId)) continue;

        try {
          const manifest = await getManifest(pluginId);
          if (isStale() || !manifest) continue;
          if (!isPluginUnlocked(manifest, effectiveLevel)) continue;
          register(manifest);
        } catch (err) {
          console.warn(`[PluginLoader] Failed to load plugin "${pluginId}":`, err);
        }
      }
    }

    syncPlugins();

    return () => {
      // Mark this run stale; registered plugins are kept (cleanup is user-scoped above).
      runRef.current++;
    };
  }, [user?.id, effectiveLevel, levelLoaded]);

  return <>{children}</>;
}
