import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, usePluginRegistry } from '@ziko/plugin-sdk';

// Icon map: plugin id → Ionicons name
const PLUGIN_ICONS: Record<string, string> = {
  nutrition:      'nutrition-outline',
  hydration:      'water-outline',
  sleep:          'moon-outline',
  habits:         'checkmark-circle-outline',
  stats:          'bar-chart-outline',
  stretching:     'body-outline',
  measurements:   'scale-outline',
  timer:          'timer-outline',
  journal:        'journal-outline',
  cardio:         'bicycle-outline',
  supplements:    'flask-outline',
  wearables:      'watch-outline',
  rpe:            'calculator-outline',
  gamification:   'trophy-outline',
  'ai-programs':  'sparkles-outline',
  persona:        'person-circle-outline',
  community:      'people-outline',
  pantry:         'leaf-outline',
};

const PLUGIN_TINTS: Record<string, string> = {
  nutrition:      '#2E9E5B',
  hydration:      '#2E7BF6',
  sleep:          '#7B5BD0',
  habits:         '#FF5C1A',
  stats:          '#2E7BF6',
  stretching:     '#7B5BD0',
  measurements:   '#E8A33A',
  timer:          '#1C1A17',
  journal:        '#FF5C1A',
  cardio:         '#E94B3C',
  supplements:    '#7B5BD0',
  wearables:      '#E91E63',
  rpe:            '#7B5BD0',
  gamification:   '#E8A33A',
  'ai-programs':  '#FF5C1A',
  persona:        '#FF6584',
  community:      '#2E7BF6',
  pantry:         '#2E9E5B',
};

export default function ModulesScreen() {
  const theme = useThemeStore((s) => s.theme);
  const installedPlugins = usePluginRegistry((s) => s.installedPlugins);
  const enabledPlugins   = usePluginRegistry((s) => s.enabledPlugins);
  const manifests        = usePluginRegistry((s) => s.manifests);
  const enablePlugin     = usePluginRegistry((s) => s.enablePlugin);
  const disablePlugin    = usePluginRegistry((s) => s.disablePlugin);

  const enabledCount = enabledPlugins.length;
  const totalCount   = installedPlugins.length;

  const handleToggle = (pluginId: string, current: boolean) => {
    if (current) {
      disablePlugin(pluginId);
    } else {
      enablePlugin(pluginId);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingTop: 10 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 34, height: 34, borderRadius: 11,
            backgroundColor: theme.text + '10',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={16} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text, letterSpacing: -0.4, flex: 1 }}>Modules</Text>
        <View style={{
          paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
          backgroundColor: '#FF5C1A' + '18',
        }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#FF5C1A' }}>
            {enabledCount}/{totalCount}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 60 }}>
        <Text style={{ fontSize: 12, color: theme.muted, marginBottom: 14, lineHeight: 18 }}>
          Active uniquement les modules que tu utilises. Les désactivés sont masqués dans toute l'app.
        </Text>

        <View style={{
          backgroundColor: theme.surface, borderRadius: 16,
          borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
        }}>
          {installedPlugins.map((pluginId, i) => {
            const manifest = manifests[pluginId];
            const isEnabled = enabledPlugins.includes(pluginId);
            const icon = PLUGIN_ICONS[pluginId] ?? 'grid-outline';
            const tint = PLUGIN_TINTS[pluginId] ?? '#FF5C1A';
            const name = manifest?.name ?? pluginId;

            return (
              <React.Fragment key={pluginId}>
                {i > 0 && (
                  <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 12 }} />
                )}
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  padding: 12, paddingHorizontal: 14,
                }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 10,
                    backgroundColor: tint + '18',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name={icon as any} size={16} color={tint} />
                  </View>
                  <Text style={{
                    flex: 1, fontSize: 14, fontWeight: '600',
                    color: isEnabled ? theme.text : theme.muted,
                  }}>{name}</Text>
                  <Switch
                    value={isEnabled}
                    onValueChange={(v) => handleToggle(pluginId, !v)}
                    trackColor={{ false: theme.border, true: '#2E9E5B' }}
                    thumbColor="#fff"
                  />
                </View>
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
