import React, { useEffect, useRef } from 'react';
import { usePluginRegistry } from '@ziko/plugin-sdk';
import type { PluginManifest } from '@ziko/plugin-sdk';
import { supabase } from '../lib/supabase';
import { aiBridge } from '../lib/ai';
import { useAuthStore } from '../stores/authStore';

// Static plugin loaders — Metro bundler requires statically-analyzable imports
const PLUGIN_LOADERS: Record<string, () => Promise<{ default: PluginManifest }>> = {
  nutrition: () => import('@ziko/plugin-nutrition/manifest') as any,
  persona:   () => import('@ziko/plugin-persona/manifest') as any,
  habits:    () => import('@ziko/plugin-habits/manifest') as any,
  stats:     () => import('@ziko/plugin-stats/manifest') as any,
};

/** Load persona settings from Supabase and inject dynamic system prompt */
async function applyPersonaDynamicPrompt(manifest: PluginManifest, userId: string): Promise<PluginManifest> {
  if (manifest.id !== 'persona') return manifest;
  try {
    const { buildPersonaSystemPrompt } = await import('@ziko/plugin-persona/store');
    const { data } = await supabase
      .from('persona_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (data) {
      const prompt = buildPersonaSystemPrompt({
        agentName: data.agent_name ?? 'Ziko',
        traits: data.traits ?? [],
        backstory: data.backstory ?? '',
        coachingStyle: data.coaching_style ?? 'motivational',
        habits: data.habits ?? [],
        isLoaded: true,
      } as any);
      return { ...manifest, aiSystemPromptAddition: prompt };
    }
  } catch (e) {
    console.warn('[PluginLoader] Failed to apply persona prompt:', e);
  }
  return manifest;
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

    async function loadInstalledPlugins() {
      if (!user) return;
      const { data: userPlugins, error } = await supabase
        .from('user_plugins')
        .select('plugin_id, is_enabled')
        .eq('user_id', user.id)
        .eq('is_enabled', true);

      if (error || !userPlugins) return;

      for (const up of userPlugins) {
        const pluginId = up.plugin_id as string;
        if (loadedRef.current.has(pluginId)) continue;

        const loader = PLUGIN_LOADERS[pluginId];
        if (!loader) continue;

        try {
          const mod = await loader();
          let manifest: PluginManifest = mod.default;
          manifest = await applyPersonaDynamicPrompt(manifest, user.id);
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
      for (const pluginId of loadedRef.current) {
        unregisterPlugin(pluginId);
        aiBridge.unregisterPlugin(pluginId);
      }
      loadedRef.current.clear();
    };
  }, [user?.id]);

  return <>{children}</>;
}
