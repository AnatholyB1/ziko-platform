import React, { useEffect, useRef } from 'react';
import { usePluginRegistry } from '@ziko/plugin-sdk';
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
      .from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();
    const role = profileRow?.role ?? 'client';
    if (role === 'client' || role === 'both') {
      await supabase
        .from('user_plugins')
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
  const { registerPlugin, unregisterPlugin } = usePluginRegistry();
  const loadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadInstalledPlugins() {
      if (!user) return;

      for (const pluginId of MANDATORY_PLUGIN_IDS) {
        if (cancelled) return;
        if (loadedRef.current.has(pluginId)) continue;
        const loader = PLUGIN_LOADERS[pluginId];
        if (!loader) continue;
        try {
          const mod = await loader();
          if (cancelled) return;
          const manifest: PluginManifest = mod.default;
          registerPlugin(manifest);
          aiBridge.registerPlugin(manifest);
          loadedRef.current.add(pluginId);
        } catch (err) {
          console.warn(`[PluginLoader] Failed to load mandatory plugin "${pluginId}":`, err);
        }
      }

      if (cancelled) return;
      await autoInstallCoachPlugin(user.id);
      if (cancelled) return;

      const { data: userPlugins, error } = await supabase
        .from('user_plugins')
        .select('plugin_id, is_enabled')
        .eq('user_id', user.id)
        .eq('is_enabled', true);

      if (cancelled || error || !userPlugins) return;

      for (const up of userPlugins) {
        if (cancelled) return;
        const pluginId = up.plugin_id as string;
        if (loadedRef.current.has(pluginId)) continue;

        const loader = PLUGIN_LOADERS[pluginId];
        if (!loader) continue;

        try {
          const mod = await loader();
          if (cancelled) return;
          const manifest: PluginManifest = mod.default;
          registerPlugin(manifest);
          aiBridge.registerPlugin(manifest);
          loadedRef.current.add(pluginId);
        } catch (err) {
          console.warn(`[PluginLoader] Failed to load plugin "${pluginId}":`, err);
        }
      }
    }

    loadInstalledPlugins();

    // Cleanup on signout
    return () => {
      cancelled = true;
      for (const pluginId of loadedRef.current) {
        unregisterPlugin(pluginId);
        aiBridge.unregisterPlugin(pluginId);
      }
      loadedRef.current.clear();
    };
  }, [user?.id]);

  return <>{children}</>;
}
