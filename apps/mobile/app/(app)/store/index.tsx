import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { usePluginRegistry } from '@ziko/plugin-sdk';
import type { PluginManifest } from '@ziko/plugin-sdk';

interface RegistryPlugin {
  plugin_id: string;
  manifest: PluginManifest;
  is_active: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  nutrition: '#4CAF50',
  coaching: '#6C63FF',
  persona: '#FF6584',
  analytics: '#FF9800',
  social: '#00BCD4',
};

export default function PluginStoreScreen() {
  const user = useAuthStore((s) => s.user);
  const { installedPlugins, registerPlugin } = usePluginRegistry();
  const [plugins, setPlugins] = useState<RegistryPlugin[]>([]);
  const [userPlugins, setUserPlugins] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const { data: reg } = await supabase.from('plugins_registry').select('*').eq('is_active', true);
    setPlugins((reg ?? []) as RegistryPlugin[]);

    if (user) {
      const { data: up } = await supabase.from('user_plugins').select('plugin_id').eq('user_id', user.id);
      setUserPlugins((up ?? []).map((u: any) => u.plugin_id));
    }
  };

  useEffect(() => { load(); }, [user]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const installPlugin = async (pluginId: string, manifest: PluginManifest) => {
    if (!user) return;
    Alert.alert(
      `Install ${manifest.name}?`,
      manifest.requiredPermissions.length > 0
        ? `This plugin requires:\n${manifest.requiredPermissions.map((p) => `• ${p}`).join('\n')}`
        : 'This plugin has no special permissions.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Install', onPress: async () => {
            const { error } = await supabase.from('user_plugins').upsert({ user_id: user.id, plugin_id: pluginId, is_enabled: true });
            if (!error) {
              setUserPlugins([...userPlugins, pluginId]);
              registerPlugin(manifest);
            }
          },
        },
      ],
    );
  };

  const uninstallPlugin = async (pluginId: string) => {
    if (!user) return;
    Alert.alert('Uninstall Plugin', 'This will remove the plugin and its data from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Uninstall', style: 'destructive', onPress: async () => {
          await supabase.from('user_plugins').delete().eq('user_id', user.id).eq('plugin_id', pluginId);
          setUserPlugins(userPlugins.filter((id) => id !== pluginId));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F14' }}>
      <View style={{ padding: 20, paddingBottom: 12 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#F0F0F5' }}>Plugin Store</Text>
        <Text style={{ color: '#8888A8', fontSize: 14, marginTop: 4 }}>Extend Ziko with powerful features</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />}
      >
        {userPlugins.length > 0 && (
          <>
            <Text style={{ color: '#F0F0F5', fontWeight: '700', fontSize: 16, marginBottom: 12 }}>Installed</Text>
            {plugins.filter((p) => userPlugins.includes(p.plugin_id)).map((p) => (
              <PluginCard key={p.plugin_id} plugin={p} installed onPress={() => {
                const mainRoute = p.manifest.routes.find((r) => r.showInTabBar) ?? p.manifest.routes[0];
                if (mainRoute) router.push(mainRoute.path as any);
              }}
                action={
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => {
                      const mainRoute = p.manifest.routes.find((r) => r.showInTabBar) ?? p.manifest.routes[0];
                      if (mainRoute) router.push(mainRoute.path as any);
                    }} style={{ backgroundColor: '#6C63FF22', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
                      <Text style={{ color: '#6C63FF', fontWeight: '600', fontSize: 13 }}>Open</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => uninstallPlugin(p.plugin_id)}
                      style={{ backgroundColor: '#F4433622', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
                      <Text style={{ color: '#F44336', fontWeight: '600', fontSize: 13 }}>Uninstall</Text>
                    </TouchableOpacity>
                  </View>
                } />
            ))}
            <View style={{ height: 1, backgroundColor: '#2E2E40', marginVertical: 20 }} />
          </>
        )}

        <Text style={{ color: '#F0F0F5', fontWeight: '700', fontSize: 16, marginBottom: 12 }}>Available</Text>
        {plugins.filter((p) => !userPlugins.includes(p.plugin_id)).map((p) => (
          <PluginCard key={p.plugin_id} plugin={p} installed={false} onPress={() => router.push(`/(app)/store/${p.plugin_id}` as any)}
            action={<TouchableOpacity onPress={() => installPlugin(p.plugin_id, p.manifest)}
              style={{ backgroundColor: '#6C63FF', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                {p.manifest.price === 'free' ? 'Install Free' : `€${p.manifest.price}`}
              </Text>
            </TouchableOpacity>} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function PluginCard({ plugin, installed, onPress, action }: {
  plugin: RegistryPlugin;
  installed: boolean;
  onPress: () => void;
  action: React.ReactNode;
}) {
  const m = plugin.manifest;
  const color = CATEGORY_COLORS[m.category] ?? '#6C63FF';
  return (
    <TouchableOpacity onPress={onPress}
      style={{ backgroundColor: '#1A1A24', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: installed ? '#6C63FF44' : '#2E2E40' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
        <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="grid" size={22} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#F0F0F5', fontWeight: '700', fontSize: 15 }}>{m.name}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
            <View style={{ backgroundColor: color + '22', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
              <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{m.category}</Text>
            </View>
            <View style={{ backgroundColor: '#252535', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
              <Text style={{ color: '#8888A8', fontSize: 11 }}>{m.price === 'free' ? 'Free' : `€${m.price}`}</Text>
            </View>
          </View>
          <Text style={{ color: '#8888A8', fontSize: 13, marginTop: 8, lineHeight: 18 }}>{m.description}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
        {action}
      </View>
    </TouchableOpacity>
  );
}
