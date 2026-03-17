import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../src/lib/supabase';
import type { PluginManifest } from '@ziko/plugin-sdk';

export default function PluginDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [manifest, setManifest] = useState<PluginManifest | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase.from('plugins_registry').select('manifest').eq('plugin_id', id).single()
      .then(({ data }) => { if (data) setManifest(data.manifest as PluginManifest); });
  }, [id]);

  if (!manifest) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F14', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#8888A8' }}>Loading…</Text>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F14' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color="#8888A8" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: '#F0F0F5' }}>{manifest.name}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 100 }}>
        <View style={{ backgroundColor: '#1A1A24', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2E2E40' }}>
          <Text style={{ color: '#8888A8', fontSize: 13 }}>Description</Text>
          <Text style={{ color: '#F0F0F5', fontSize: 15, marginTop: 6, lineHeight: 22 }}>{manifest.description}</Text>
        </View>

        {manifest.aiSkills?.length > 0 && (
          <View style={{ backgroundColor: '#1A1A24', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2E2E40' }}>
            <Text style={{ color: '#F0F0F5', fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
              🤖 AI Skills
            </Text>
            {manifest.aiSkills.map((skill) => (
              <View key={skill.name} style={{ marginBottom: 10 }}>
                <Text style={{ color: '#6C63FF', fontWeight: '600', fontSize: 14 }}>{skill.name}</Text>
                <Text style={{ color: '#8888A8', fontSize: 13, marginTop: 2 }}>{skill.description}</Text>
              </View>
            ))}
          </View>
        )}

        {manifest.requiredPermissions?.length > 0 && (
          <View style={{ backgroundColor: '#1A1A24', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2E2E40' }}>
            <Text style={{ color: '#F0F0F5', fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
              🔐 Required Permissions
            </Text>
            {manifest.requiredPermissions.map((perm) => (
              <View key={perm} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#8888A8" />
                <Text style={{ color: '#8888A8', fontSize: 13 }}>{perm}</Text>
              </View>
            ))}
          </View>
        )}

        {manifest.routes?.length > 0 && (
          <View style={{ backgroundColor: '#1A1A24', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2E2E40' }}>
            <Text style={{ color: '#F0F0F5', fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
              📍 Added Routes
            </Text>
            {manifest.routes.map((route) => (
              <View key={route.path} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Ionicons name="link-outline" size={14} color="#8888A8" />
                <Text style={{ color: '#8888A8', fontSize: 13 }}>{route.title}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
