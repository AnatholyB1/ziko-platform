import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  Alert, TextInput, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { usePluginRegistry } from '@ziko/plugin-sdk';
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
const { width: SCREEN_W } = Dimensions.get('window');

const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
  all:       { label: 'Tout',        color: '#1C1A17', icon: 'apps' },
  coaching:  { label: 'Coaching',    color: '#FF5C1A', icon: 'fitness' },
  nutrition: { label: 'Nutrition',   color: '#4CAF50', icon: 'leaf' },
  analytics: { label: 'Analytics',   color: '#FF9800', icon: 'stats-chart' },
  persona:   { label: 'Personnalité',color: '#FF6584', icon: 'person-circle' },
  social:    { label: 'Social',      color: '#00BCD4', icon: 'people' },
};

const CATEGORIES = Object.keys(CATEGORY_META);

// ── Main screen ───────────────────────────────────────────
export default function PluginStoreScreen() {
  const user = useAuthStore((s) => s.user);
  const { registerPlugin } = usePluginRegistry();

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
    Alert.alert(
      `Installer ${manifest.name} ?`,
      perms.length > 0
        ? `Ce plugin nécessite :\n${perms.map((p) => `• ${p}`).join('\n')}`
        : 'Aucune permission spéciale requise.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Installer', onPress: async () => {
            const { error } = await supabase.from('user_plugins').upsert({ user_id: user.id, plugin_id: pluginId, is_enabled: true });
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
    Alert.alert('Désinstaller ?', 'Ce plugin sera retiré de votre appareil.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Désinstaller', style: 'destructive', onPress: async () => {
          await supabase.from('user_plugins').delete().eq('user_id', user.id).eq('plugin_id', pluginId);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#1C1A17' }}>Store</Text>
        <Text style={{ color: '#7A7670', fontSize: 13, marginTop: 2 }}>Découvre et installe des plugins</Text>
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
          borderRadius: 14, borderWidth: 1, borderColor: '#E2E0DA', paddingHorizontal: 14, height: 44,
        }}>
          <Ionicons name="search" size={18} color="#7A7670" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un plugin…"
            placeholderTextColor="#B0ADA8"
            style={{ flex: 1, marginLeft: 10, fontSize: 14, color: '#1C1A17' }}
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
          const meta = CATEGORY_META[cat];
          const active = cat === category;
          return (
            <TouchableOpacity key={cat} onPress={() => setCategory(cat)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                height: 36, paddingHorizontal: 14, borderRadius: 20,
                backgroundColor: active ? '#1C1A17' : '#FFFFFF',
                borderWidth: 1, borderColor: active ? '#1C1A17' : '#E2E0DA',
              }}>
              <Ionicons name={meta.icon as any} size={14} color={active ? '#FFFFFF' : meta.color} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#FFFFFF' : '#1C1A17' }}>
                {meta.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5C1A" />}
      >
        {/* Installed section */}
        {installed.length > 0 && (
          <>
            <SectionTitle icon="checkmark-circle" label={`Installés (${installed.length})`} />
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
            <View style={{ height: 1, backgroundColor: '#E2E0DA', marginVertical: 16 }} />
          </>
        )}

        {/* Available section */}
        {available.length > 0 && (
          <>
            <SectionTitle icon="sparkles" label={`Disponibles (${available.length})`} />
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
            <Text style={{ color: '#7A7670', fontSize: 15, marginTop: 12 }}>Aucun plugin trouvé</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Section title ──────────────────────────────────────────
function SectionTitle({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 4 }}>
      <Ionicons name={icon as any} size={18} color="#FF5C1A" />
      <Text style={{ color: '#1C1A17', fontWeight: '700', fontSize: 16 }}>{label}</Text>
    </View>
  );
}

// ── Star display ──────────────────────────────────────────
function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Ionicons
        key={i}
        name={i <= Math.round(rating) ? 'star' : 'star-outline'}
        size={size}
        color={i <= Math.round(rating) ? '#FFB800' : '#D4D2CD'}
      />
    );
  }
  return <View style={{ flexDirection: 'row', gap: 1 }}>{stars}</View>;
}

// ── Plugin card ───────────────────────────────────────────
function PluginCard({ plugin, installed, rating, onPress, onInstall, onUninstall }: {
  plugin: RegistryPlugin;
  installed: boolean;
  rating?: ReviewAgg;
  onPress: () => void;
  onInstall: () => void;
  onUninstall?: () => void;
}) {
  const m = plugin.manifest;
  const catMeta = CATEGORY_META[m.category] ?? CATEGORY_META.coaching;
  const color = catMeta.color;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}
      style={{
        backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 10,
        borderWidth: 1, borderColor: installed ? '#FF5C1A33' : '#E2E0DA',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8,
        elevation: 2,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {/* Icon */}
        <View style={{
          width: 56, height: 56, borderRadius: 16, backgroundColor: color + '18',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={(m.icon || 'grid') as any} size={26} color={color} />
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: '#1C1A17', fontWeight: '700', fontSize: 16 }}>{m.name}</Text>
            {installed && (
              <View style={{ backgroundColor: '#FF5C1A18', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                <Text style={{ color: '#FF5C1A', fontSize: 10, fontWeight: '700' }}>INSTALLÉ</Text>
              </View>
            )}
          </View>

          {/* Category + rating */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <View style={{ backgroundColor: color + '18', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
              <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{catMeta.label}</Text>
            </View>
            {rating && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Stars rating={rating.avg} size={11} />
                <Text style={{ color: '#7A7670', fontSize: 11 }}>{rating.avg.toFixed(1)} ({rating.count})</Text>
              </View>
            )}
          </View>

          {/* Description */}
          <Text numberOfLines={2} style={{ color: '#7A7670', fontSize: 13, marginTop: 6, lineHeight: 18 }}>
            {m.description}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 12, gap: 8 }}>
        {/* Price tag */}
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#4CAF50', fontWeight: '700', fontSize: 13 }}>
            {m.price === 'free' ? 'Gratuit' : `${m.price} €`}
          </Text>
        </View>

        {installed ? (
          <>
            <TouchableOpacity onPress={onInstall}
              style={{ backgroundColor: '#FF5C1A', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 9 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Ouvrir</Text>
            </TouchableOpacity>
            {onUninstall && (
              <TouchableOpacity onPress={onUninstall}
                style={{ backgroundColor: '#F4F3F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }}>
                <Ionicons name="trash-outline" size={16} color="#F44336" />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <TouchableOpacity onPress={onInstall}
            style={{ backgroundColor: '#FF5C1A', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 9 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Installer</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}
