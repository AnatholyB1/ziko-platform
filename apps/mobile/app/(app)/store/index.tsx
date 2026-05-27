import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { usePluginRegistry, useTranslation, showAlert } from '@ziko/plugin-sdk';
import type { PluginManifest } from '@ziko/plugin-sdk';
import { ErrorScreen } from '@ziko/ui';

// ── Design tokens ──────────────────────────────────────────
const BG      = '#F7F6F3';
const SURFACE = '#FFFFFF';
const BORDER  = '#E2E0DA';
const TEXT    = '#1C1A17';
const MUTED   = '#6B6963';
const PRIMARY = '#FF5C1A';

const SHADOW = {
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

// ── Types ─────────────────────────────────────────────────
interface RegistryPlugin {
  plugin_id: string;
  manifest: PluginManifest;
  is_active: boolean;
  is_featured?: boolean;
}

interface ReviewAgg {
  plugin_id: string;
  avg: number;
  count: number;
}

// ── Constants ─────────────────────────────────────────────
const STORE_CATS = [
  { id: 'all',        label: 'Tous' },
  { id: 'health',     label: 'Santé' },
  { id: 'training',   label: 'Entraînement' },
  { id: 'nutrition',  label: 'Nutrition' },
  { id: 'coaching',   label: 'Coaching' },
  { id: 'social',     label: 'Social' },
];

const PLUGIN_COLORS: Record<string, string> = {
  habits:        '#FF5C1A',
  nutrition:     '#FF5C1A',
  persona:       '#FF6584',
  stats:         '#E8A33A',
  gamification:  '#FF5C1A',
  community:     '#2E7BF6',
  stretching:    '#FF5C1A',
  sleep:         '#7B5BD0',
  measurements:  '#2E9E5B',
  timer:         '#FF5C1A',
  'ai-programs': '#2E7BF6',
  journal:       '#FF5C1A',
  hydration:     '#2E7BF6',
  cardio:        '#E94B3C',
  supplements:   '#2E9E5B',
  wearables:     '#E91E63',
  rpe:           '#7B5BD0',
};

// Fallback featured set when DB flag is not available
const FEATURED_IDS = new Set(['habits', 'ai-programs', 'cardio']);

// ── Main screen ───────────────────────────────────────────
export default function PluginStoreScreen() {
  const user = useAuthStore((s) => s.user);
  const { registerPlugin } = usePluginRegistry();
  const { t } = useTranslation();

  const [plugins, setPlugins] = useState<RegistryPlugin[]>([]);
  const [userPlugins, setUserPlugins] = useState<string[]>([]);
  const [reviews, setReviews] = useState<ReviewAgg[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loadError, setLoadError] = useState(false);

  // ── Load data ──────────────────
  const load = useCallback(async () => {
    setLoadError(false);
    const [regRes, reviewsRes] = await Promise.all([
      supabase.from('plugins_registry').select('*').eq('is_active', true),
      supabase.from('plugin_reviews').select('plugin_id, rating'),
    ]);

    if (regRes.error) { setLoadError(true); return; }

    setPlugins((regRes.data ?? []) as RegistryPlugin[]);

    const map: Record<string, { sum: number; count: number }> = {};
    for (const r of (reviewsRes.data ?? []) as { plugin_id: string; rating: number }[]) {
      if (!map[r.plugin_id]) map[r.plugin_id] = { sum: 0, count: 0 };
      map[r.plugin_id].sum += r.rating;
      map[r.plugin_id].count += 1;
    }
    setReviews(Object.entries(map).map(([pid, v]) => ({ plugin_id: pid, avg: v.sum / v.count, count: v.count })));

    if (user) {
      const { data: up } = await supabase.from('user_plugins').select('plugin_id').eq('user_id', user.id);
      setUserPlugins((up ?? []).map((u: any) => u.plugin_id));
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // ── Install / Uninstall ────────
  const installPlugin = async (pluginId: string, manifest: PluginManifest) => {
    if (!user) return;
    const perms = manifest.requiredPermissions ?? [];
    showAlert(
      t('store.installConfirm', { name: manifest.name }),
      perms.length > 0
        ? t('store.permRequired', { perms: perms.map((p) => `• ${p}`).join('\n') })
        : t('store.noPerm'),
      [
        { text: t('general.cancel'), style: 'cancel' },
        {
          text: t('store.install'), onPress: async () => {
            const { error } = await supabase
              .from('user_plugins')
              .upsert({ user_id: user.id, plugin_id: pluginId, is_enabled: true });
            if (!error) {
              setUserPlugins((prev) => [...prev, pluginId]);
              registerPlugin(manifest);
            }
          },
        },
      ],
    );
  };

  const uninstallPlugin = async (pluginId: string) => {
    if (!user) return;
    showAlert(t('store.uninstall') + ' ?', t('store.uninstallConfirm'), [
      { text: t('general.cancel'), style: 'cancel' },
      {
        text: t('store.uninstall'), style: 'destructive', onPress: async () => {
          await supabase
            .from('user_plugins')
            .delete()
            .eq('user_id', user.id)
            .eq('plugin_id', pluginId);
          setUserPlugins((prev) => prev.filter((id) => id !== pluginId));
        },
      },
    ]);
  };

  // ── Featured plugins ───────────────────────────────────
  const featuredPlugins = useMemo(() => {
    // Prefer DB is_featured flag, fallback to hardcoded set
    const byFlag = plugins.filter((p) => p.is_featured);
    return byFlag.length > 0 ? byFlag : plugins.filter((p) => FEATURED_IDS.has(p.plugin_id));
  }, [plugins]);

  // ── Filtered list ──────────────────────────────────────
  const filtered = useMemo(() => {
    if (activeCategory === 'all') return plugins;
    return plugins.filter((p) => {
      const cat = p.manifest.category;
      const mapped = cat === 'analytics' || cat === 'persona' ? 'coaching' : cat;
      return mapped === activeCategory;
    });
  }, [plugins, activeCategory]);

  const getRating = (pid: string) => reviews.find((r) => r.plugin_id === pid);

  if (loadError) {
    return <ErrorScreen variant="network" onRetry={() => load()} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
      >
        {/* ── Header ───────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: TEXT }}>Modules</Text>
          <Text style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>Étends ton expérience</Text>
        </View>

        {/* ── Category chips ───────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 20 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {STORE_CATS.map((cat) => {
            const active = cat.id === activeCategory;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setActiveCategory(cat.id)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
                  backgroundColor: active ? PRIMARY : SURFACE,
                  borderWidth: active ? 0 : 1, borderColor: BORDER,
                  marginRight: 4,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#FFFFFF' : MUTED }}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Featured dark cards (only when showing all, no filter) ── */}
        {activeCategory === 'all' && featuredPlugins.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{
              fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase',
              color: MUTED, marginBottom: 12, paddingHorizontal: 20,
            }}>
              À la une
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {featuredPlugins.map((p) => {
                const m = p.manifest;
                const color = PLUGIN_COLORS[p.plugin_id] ?? PRIMARY;
                const isInstalled = userPlugins.includes(p.plugin_id);
                return (
                  <View
                    key={p.plugin_id}
                    style={{
                      width: 260,
                      backgroundColor: '#1C1A17',
                      borderRadius: 20,
                      padding: 20,
                      overflow: 'hidden',
                      ...SHADOW,
                    }}
                  >
                    {/* Category chip */}
                    <View style={{
                      alignSelf: 'flex-start',
                      backgroundColor: 'rgba(255,92,26,0.2)',
                      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: PRIMARY }}>
                        {m.category ?? 'Module'}
                      </Text>
                    </View>

                    {/* Plugin name */}
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFAF6', marginTop: 8 }}>
                      {m.name}
                    </Text>

                    {/* Description */}
                    <Text
                      numberOfLines={2}
                      style={{ fontSize: 12, color: 'rgba(255,250,246,0.65)', marginTop: 4, lineHeight: 18 }}
                    >
                      {m.description}
                    </Text>

                    {/* Install CTA */}
                    <TouchableOpacity
                      onPress={() => isInstalled ? uninstallPlugin(p.plugin_id) : installPlugin(p.plugin_id, m)}
                      activeOpacity={0.8}
                      style={{
                        marginTop: 16,
                        alignSelf: 'flex-start',
                        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
                        backgroundColor: isInstalled ? 'rgba(255,250,246,0.15)' : PRIMARY,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFAF6' }}>
                        {isInstalled ? 'Installé \u2713' : 'Installer'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Plugin list ───────────────────── */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{
            fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase',
            color: MUTED, marginBottom: 12,
          }}>
            {activeCategory === 'all'
              ? 'Tous les modules'
              : STORE_CATS.find((c) => c.id === activeCategory)?.label ?? ''}
          </Text>

          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 48 }}>
              <Ionicons name="search-outline" size={40} color={BORDER} />
              <Text style={{ color: MUTED, fontSize: 14, marginTop: 12 }}>Aucun module trouvé</Text>
            </View>
          ) : (
            filtered.map((p) => (
              <PluginCard
                key={p.plugin_id}
                plugin={p}
                isInstalled={userPlugins.includes(p.plugin_id)}
                rating={getRating(p.plugin_id)}
                onInstall={() => installPlugin(p.plugin_id, p.manifest)}
                onUninstall={() => uninstallPlugin(p.plugin_id)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Plugin card ───────────────────────────────────────────
const PluginCard = React.memo(function PluginCard({
  plugin,
  isInstalled,
  rating,
  onInstall,
  onUninstall,
}: {
  plugin: RegistryPlugin;
  isInstalled: boolean;
  rating?: ReviewAgg;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  const m = plugin.manifest;
  const color = PLUGIN_COLORS[plugin.plugin_id] ?? PRIMARY;

  return (
    <View style={{
      backgroundColor: SURFACE,
      borderRadius: 16,
      borderWidth: 1, borderColor: BORDER,
      padding: 14,
      marginBottom: 8,
      ...SHADOW,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {/* Icon 48×48 */}
        <View style={{
          width: 48, height: 48, borderRadius: 14,
          backgroundColor: BG,
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Ionicons name={(m.icon || 'grid') as any} size={22} color={color} />
        </View>

        {/* Info */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: TEXT }}>{m.name}</Text>
          <Text numberOfLines={2} style={{ fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 17 }}>
            {m.description}
          </Text>
          {rating ? (
            <Text style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
              {'\u2605'} {rating.avg.toFixed(1)} · {rating.count} avis
            </Text>
          ) : null}
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={isInstalled ? onUninstall : onInstall}
          activeOpacity={0.8}
          style={{
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
            backgroundColor: isInstalled ? '#E2E0DA' : PRIMARY,
            flexShrink: 0,
          }}
        >
          <Text style={{
            fontSize: 12, fontWeight: '700',
            color: isInstalled ? MUTED : '#FFFFFF',
          }}>
            {isInstalled ? 'Installé' : 'Installer'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});
