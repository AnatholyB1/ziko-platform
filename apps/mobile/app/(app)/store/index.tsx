import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { usePluginRegistry, useTranslation, showAlert } from '@ziko/plugin-sdk';
import { useThemeStore } from '../../../src/stores/themeStore';
import type { PluginManifest } from '@ziko/plugin-sdk';

// ── Types ─────────────────────────────────────────────────
interface RegistryPlugin {
  plugin_id: string;
  manifest: PluginManifest;
  is_active: boolean;
}

interface ReviewAgg {
  plugin_id: string;
  avg: number;
  count: number;
}

// ── Constants ─────────────────────────────────────────────

// v2 categories — matches design and PluginCategory type
const STORE_CATS = [
  { id: 'all',      label: 'Tous' },
  { id: 'training', label: 'Training' },
  { id: 'nutrition',label: 'Nutrition' },
  { id: 'health',   label: 'Santé' },
  { id: 'coaching', label: 'Coaching' },
  { id: 'social',   label: 'Social' },
] as const;

// Plugin accent colors by id
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

// Plugins shown in the "À la une" horizontal row
const FEATURED_IDS = new Set(['habits', 'ai-programs']);

// ── Main screen ───────────────────────────────────────────
export default function PluginStoreScreen() {
  const user = useAuthStore((s) => s.user);
  const { registerPlugin } = usePluginRegistry();
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();

  const [plugins, setPlugins] = useState<RegistryPlugin[]>([]);
  const [userPlugins, setUserPlugins] = useState<string[]>([]);
  const [reviews, setReviews] = useState<ReviewAgg[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  // ── Load data ──────────────────
  const load = useCallback(async () => {
    const [regRes, reviewsRes] = await Promise.all([
      supabase.from('plugins_registry').select('*').eq('is_active', true),
      supabase.from('plugin_reviews').select('plugin_id, rating'),
    ]);

    setPlugins((regRes.data ?? []) as RegistryPlugin[]);

    // Aggregate reviews client-side
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

  // ── Filter ──────────────────────
  const filtered = useMemo(() => {
    let list = plugins;
    if (category !== 'all') list = list.filter((p) => p.manifest.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.manifest.name.toLowerCase().includes(q) ||
        p.manifest.description?.toLowerCase().includes(q) ||
        p.manifest.category?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [plugins, category, search]);

  const installed = filtered.filter((p) => userPlugins.includes(p.plugin_id));
  const available = filtered.filter((p) => !userPlugins.includes(p.plugin_id));

  const getRating = (pid: string) => reviews.find((r) => r.plugin_id === pid);

  // ── Render ─────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text }}>{t('store.title')}</Text>
        <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>{t('store.discover')}</Text>
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface,
          borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, height: 44,
        }}>
          <Ionicons name="search" size={18} color="#7A7670" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('store.searchPlugin')}
            placeholderTextColor="#B0ADA8"
            style={{ flex: 1, marginLeft: 10, fontSize: 14, color: theme.text }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#B0ADA8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}>
        {CATEGORIES.map((cat) => {
          const categoryMeta = getCategoryMeta(theme);
          const meta = categoryMeta[cat];
          const active = cat === category;
          return (
            <TouchableOpacity key={cat} onPress={() => setCategory(cat)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                height: 36, paddingHorizontal: 14, borderRadius: 20,
                backgroundColor: active ? theme.text : theme.surface,
                borderWidth: 1, borderColor: active ? theme.text : theme.border,
              }}>
              <Ionicons name={meta.icon as any} size={14} color={active ? theme.surface : meta.color} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: active ? theme.surface : theme.text }}>
                {t(meta.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Installed section */}
        {installed.length > 0 && (
          <>
            <SectionTitle icon="checkmark-circle" label={t('store.installedCount', { count: String(installed.length) })} />
            {installed.map((p) => (
              <PluginCard key={p.plugin_id} plugin={p} installed rating={getRating(p.plugin_id)}
                onPress={() => router.push(`/(app)/store/${p.plugin_id}` as any)}
                onInstall={() => {
                  const mainRoute = p.manifest.routes.find((r) => r.showInTabBar) ?? p.manifest.routes[0];
                  if (mainRoute) router.push(mainRoute.path as any);
                }}
                onUninstall={() => uninstallPlugin(p.plugin_id)}
              />
            ))}
            <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 16 }} />
          </>
        )}

        {/* Available section */}
        {available.length > 0 && (
          <>
            <SectionTitle icon="sparkles" label={t('store.availableCount', { count: String(available.length) })} />
            {available.map((p) => (
              <PluginCard key={p.plugin_id} plugin={p} installed={false} rating={getRating(p.plugin_id)}
                onPress={() => router.push(`/(app)/store/${p.plugin_id}` as any)}
                onInstall={() => installPlugin(p.plugin_id, p.manifest)}
              />
            ))}
          </>
        )}

        {filtered.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Ionicons name="search-outline" size={48} color="#E2E0DA" />
            <Text style={{ color: theme.muted, fontSize: 15, marginTop: 12 }}>{t('store.noPlugins')}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Featured row ──────────────────────────────────────────
function FeaturedRow({
  plugins,
  installed,
  onInstall,
  onUninstall,
}: {
  plugins: RegistryPlugin[];
  installed: string[];
  onInstall: (p: RegistryPlugin) => void;
  onUninstall: (p: RegistryPlugin) => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const featured = plugins.filter((p) => FEATURED_IDS.has(p.plugin_id));
  if (featured.length === 0) return null;

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{
        fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase',
        color: theme.muted, marginBottom: 10,
      }}>
        À la une
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
        {featured.map((p) => {
          const m = p.manifest;
          const color = PLUGIN_COLORS[p.plugin_id] ?? theme.primary;
          const isInstalled = installed.includes(p.plugin_id);
          return (
            <View key={p.plugin_id} style={{
              width: 230, backgroundColor: (theme as any).cardDark, borderRadius: 20,
              padding: 14, gap: 10,
            }}>
              {/* Icon + name row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 11,
                  backgroundColor: color + '30', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={(m.icon || 'grid') as any} size={20} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: (theme as any).cardDarkText }}>{m.name}</Text>
                  <Text style={{ fontSize: 10.5, color: 'rgba(255,250,246,.55)' }}>
                    {m.price === 'free' ? 'Gratuit' : `${m.price} \u20ac`}
                  </Text>
                </View>
              </View>
              {/* Description */}
              <Text numberOfLines={2} style={{
                fontSize: 11.5, color: 'rgba(255,250,246,.7)', lineHeight: 16,
              }}>
                {m.description}
              </Text>
              {/* Toggle button */}
              <TouchableOpacity
                onPress={() => isInstalled ? onUninstall(p) : onInstall(p)}
                activeOpacity={0.8}
                style={{
                  alignSelf: 'flex-start', borderRadius: 999,
                  paddingHorizontal: 14, paddingVertical: 8,
                  backgroundColor: isInstalled
                    ? 'rgba(255,250,246,.12)'
                    : theme.primary,
                }}
              >
                <Text style={{
                  fontSize: 11.5, fontWeight: '700',
                  color: isInstalled ? (theme as any).cardDarkText : '#fff',
                }}>
                  {isInstalled ? '\u2713 Install\u00e9' : 'Installer'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Plugin row ────────────────────────────────────────────
const PluginRow = React.memo(function PluginRow({
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
  const theme = useThemeStore((s) => s.theme);
  const m = plugin.manifest;
  const color = PLUGIN_COLORS[plugin.plugin_id] ?? theme.primary;
  const isPremium = m.price !== 'free';

  return (
    <View style={{
      backgroundColor: theme.surface, borderRadius: 16, padding: 12,
      flexDirection: 'row', alignItems: 'center', gap: 12,
      borderWidth: 1, borderColor: theme.border, marginBottom: 8,
    }}>
      {/* Icon */}
      <View style={{
        width: 44, height: 44, borderRadius: 12, flex: 0,
        backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={(m.icon || 'grid') as any} size={20} color={color} />
      </View>

      {/* Info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Name + PRO badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{m.name}</Text>
          {isPremium && (
            <View style={{
              backgroundColor: (theme as any).warn + '22', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6,
            }}>
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: (theme as any).warn }}>PRO</Text>
            </View>
          )}
        </View>
        {/* Description */}
        <Text numberOfLines={1} style={{ fontSize: 11, color: theme.muted, marginTop: 2, lineHeight: 15 }}>
          {m.description}
        </Text>
        {/* Rating + price */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
          {rating && (
            <Text style={{ fontSize: 10.5, color: theme.muted }}>
              ⭐ {rating.avg.toFixed(1)} ·{' '}
            </Text>
          )}
          <Text style={{
            fontSize: 10.5, fontWeight: '700',
            color: m.price === 'free' ? (theme as any).success : theme.primary,
          }}>
            {m.price === 'free' ? 'Gratuit' : `${m.price} €/mo`}
          </Text>
        </View>
      </View>

      {/* Toggle button */}
      <TouchableOpacity
        onPress={isInstalled ? onUninstall : onInstall}
        activeOpacity={0.75}
        style={{
          paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
          backgroundColor: isInstalled
            ? (theme as any).success + '18'
            : theme.primary,
        }}
      >
        <Text style={{
          fontSize: 11, fontWeight: '700',
          color: isInstalled ? (theme as any).success : '#fff',
        }}>
          {isInstalled ? '✓' : 'Installer'}
        </Text>
      </TouchableOpacity>
    </View>
  );
});
