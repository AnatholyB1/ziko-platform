import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, usePluginRegistry } from '@ziko/plugin-sdk';

const PLUGIN_COLORS: Record<string, string> = {
  habits: '#FF5C1A', nutrition: '#FF5C1A', persona: '#FF6584', stats: '#E8A33A',
  gamification: '#FF5C1A', community: '#2E7BF6', stretching: '#FF5C1A', sleep: '#7B5BD0',
  measurements: '#2E9E5B', timer: '#FF5C1A', 'ai-programs': '#2E7BF6', journal: '#FF5C1A',
  hydration: '#2E7BF6', cardio: '#E94B3C', supplements: '#2E9E5B', wearables: '#E91E63', rpe: '#7B5BD0',
};

interface PluginsDrawerProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  installedPluginIds?: string[];
}

export function PluginsDrawer({ visible, onClose, onNavigate, installedPluginIds }: PluginsDrawerProps) {
  const manifests = usePluginRegistry((s) => s.manifests);
  const registryPlugins = usePluginRegistry((s) => s.installedPlugins);
  const pluginIds = installedPluginIds ?? registryPlugins;
  const theme = useThemeStore((s) => s.theme);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
        />
        <View
          style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            paddingBottom: 36,
            maxHeight: '75%',
          }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.border,
              alignSelf: 'center',
              marginBottom: 12,
            }}
          />
          <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>
            Tous les modules
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 16,
                paddingTop: 16,
              }}
            >
              {pluginIds.map((id) => {
                const manifest = manifests[id];
                if (!manifest) return null;
                const color = PLUGIN_COLORS[id] ?? theme.primary;
                const mainRoute =
                  manifest.routes.find((r) => r.showInTabBar) ?? manifest.routes[0];
                const destination = mainRoute?.path ?? '/(app)/store';
                return (
                  <TouchableOpacity
                    key={id}
                    activeOpacity={0.75}
                    onPress={() => {
                      onClose();
                      onNavigate(destination);
                    }}
                    style={{ width: '20%', alignItems: 'center', gap: 6 }}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 16,
                        backgroundColor: color + '18',
                        borderWidth: 1,
                        borderColor: theme.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name={manifest.icon as any} size={24} color={color} />
                    </View>
                    <Text
                      numberOfLines={2}
                      style={{
                        fontSize: 10,
                        fontWeight: '600',
                        color: theme.muted,
                        textAlign: 'center',
                      }}
                    >
                      {manifest.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
