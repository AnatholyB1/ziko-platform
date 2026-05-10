import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../../src/stores/themeStore';
import { showAlert } from '@ziko/plugin-sdk';
import type { ThemePalette } from '@ziko/plugin-sdk';

type DeviceId = 'watch' | 'strava' | 'garmin';

interface DeviceConfig {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  lastSync: string;
  autoSync: boolean;
  battery: number | null;
  platform: string;
}

const DEVICE_CONFIGS: Record<DeviceId, DeviceConfig> = {
  watch: {
    name: 'Apple Watch Series 9',
    icon: 'watch-outline',
    tint: '#1C1A17',
    lastSync: 'Il y a 2 min',
    autoSync: true,
    battery: 82,
    platform: 'Apple Health',
  },
  strava: {
    name: 'Strava',
    icon: 'flash-outline',
    tint: '#FC4C02',
    lastSync: 'Hier 18:42',
    autoSync: false,
    battery: null,
    platform: 'Strava API',
  },
  garmin: {
    name: 'Garmin Fenix 7',
    icon: 'watch-outline',
    tint: '#374151',
    lastSync: 'Il y a 14 min',
    autoSync: true,
    battery: 64,
    platform: 'Garmin Connect',
  },
};

interface PermissionsState {
  activity: boolean;
  sleep: boolean;
  hr: boolean;
  workouts: boolean;
  location: boolean;
}

interface PermissionItem {
  key: keyof PermissionsState;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  sub: string;
}

const PERMISSION_ITEMS: PermissionItem[] = [
  {
    key: 'activity',
    icon: 'flash-outline',
    tint: '#FF5C1A',
    label: 'Activite',
    sub: 'Pas, calories, etages',
  },
  {
    key: 'sleep',
    icon: 'moon-outline',
    tint: '#7B5BD0',
    label: 'Sommeil',
    sub: 'Phases, duree, eveils',
  },
  {
    key: 'hr',
    icon: 'heart-outline',
    tint: '#E94B3C',
    label: 'Frequence cardiaque',
    sub: 'Repos + variabilite',
  },
  {
    key: 'workouts',
    icon: 'barbell-outline',
    tint: '#22C55E',
    label: 'Seances',
    sub: 'Import / export bidir.',
  },
  {
    key: 'location',
    icon: 'flag-outline',
    tint: '#3B82F6',
    label: 'Geolocalisation',
    sub: 'Pour les sorties outdoor',
  },
];

function ToggleRow({
  icon,
  tint,
  label,
  sub,
  value,
  onChange,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  theme: ThemePalette;
}) {
  return (
    <TouchableOpacity
      onPress={() => onChange(!value)}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 11,
        paddingHorizontal: 10,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          backgroundColor: `${tint}22`,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Ionicons name={icon} size={14} color={tint} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>{label}</Text>
        {sub ? (
          <Text style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>{sub}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: `${theme.text}20`, true: theme.success }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={`${theme.text}20`}
      />
    </TouchableOpacity>
  );
}

export default function DeviceDetailScreen() {
  const theme = useThemeStore((s) => s.theme);
  const params = useLocalSearchParams<{ device?: string }>();

  const deviceId: DeviceId =
    params.device === 'strava' || params.device === 'garmin' ? params.device : 'watch';
  const config = DEVICE_CONFIGS[deviceId];

  const [autoSync, setAutoSync] = useState(config.autoSync);
  const [permissions, setPermissions] = useState<PermissionsState>({
    activity: true,
    sleep: true,
    hr: true,
    workouts: true,
    location: false,
  });

  const handleDisconnect = () => {
    showAlert(
      'Deconnecter cet appareil',
      `Veux-tu vraiment deconnecter ${config.name} ? Tes donnees seront conservees.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Deconnecter',
          style: 'destructive',
          onPress: () => router.back(),
        },
      ]
    );
  };

  const handleSyncNow = () => {
    showAlert('Synchronisation', `${config.name} synchronise maintenant...`);
  };

  const batteryColor =
    config.battery !== null && config.battery <= 20 ? '#E94B3C' : theme.success;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={theme.muted} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: theme.text }}>
          {config.name}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        {/* Status card */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            marginBottom: 14,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: `${config.tint}22`,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Ionicons name={config.icon} size={26} color={config.tint} />
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: theme.success,
                }}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color: theme.success,
                  letterSpacing: 0.9,
                  textTransform: 'uppercase',
                }}
              >
                Connecte
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: theme.muted }}>
              Derniere sync · {config.lastSync}
            </Text>
            <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>
              {config.platform}
            </Text>

            {config.battery !== null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <View
                  style={{
                    width: 28,
                    height: 12,
                    borderWidth: 1.2,
                    borderColor: theme.muted,
                    borderRadius: 3,
                    padding: 1,
                  }}
                >
                  <View
                    style={{
                      height: '100%',
                      width: `${config.battery}%`,
                      backgroundColor: batteryColor,
                      borderRadius: 1,
                    }}
                  />
                </View>
                <Text style={{ fontSize: 11, color: theme.muted, fontWeight: '700' }}>
                  {config.battery}%
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Sync now button */}
        <TouchableOpacity
          onPress={handleSyncNow}
          activeOpacity={0.8}
          style={{
            width: '100%',
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 14,
            backgroundColor: theme.text,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 20,
          }}
        >
          <Ionicons name="flash-outline" size={14} color="#FFFFFF" />
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' }}>
            Synchroniser maintenant
          </Text>
        </TouchableOpacity>

        {/* Auto-sync section */}
        <Text
          style={{
            fontSize: 10.5,
            fontWeight: '800',
            color: theme.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            paddingHorizontal: 4,
            paddingBottom: 8,
            paddingTop: 4,
          }}
        >
          Synchronisation
        </Text>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            overflow: 'hidden',
            marginBottom: 20,
          }}
        >
          <ToggleRow
            icon="flash-outline"
            tint={theme.success}
            label="Sync auto"
            sub="Toutes les 15 min en arriere-plan"
            value={autoSync}
            onChange={setAutoSync}
            theme={theme}
          />
          <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 12 }} />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 11,
              paddingHorizontal: 10,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                backgroundColor: `${theme.info}22`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="settings-outline" size={14} color={theme.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>Frequence</Text>
              <Text style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>
                Quand l'app est ouverte · 15 min sinon
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={theme.muted} />
          </View>
        </View>

        {/* Permissions section */}
        <Text
          style={{
            fontSize: 10.5,
            fontWeight: '800',
            color: theme.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            paddingHorizontal: 4,
            paddingBottom: 8,
            paddingTop: 4,
          }}
        >
          Donnees partagees
        </Text>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            overflow: 'hidden',
            marginBottom: 20,
          }}
        >
          {PERMISSION_ITEMS.map((item, i) => (
            <React.Fragment key={item.key}>
              {i > 0 && (
                <View
                  style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 12 }}
                />
              )}
              <ToggleRow
                icon={item.icon}
                tint={item.tint}
                label={item.label}
                sub={item.sub}
                value={permissions[item.key]}
                onChange={(v) => setPermissions((prev) => ({ ...prev, [item.key]: v }))}
                theme={theme}
              />
            </React.Fragment>
          ))}
        </View>

        {/* Data types synced info chips */}
        <Text
          style={{
            fontSize: 10.5,
            fontWeight: '800',
            color: theme.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            paddingHorizontal: 4,
            paddingBottom: 8,
            paddingTop: 4,
          }}
        >
          Dernieres donnees importees
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {[
            { label: '8 432 pas', icon: 'walk-outline' as const, color: '#FF5C1A' },
            { label: '7h12 sommeil', icon: 'moon-outline' as const, color: '#7B5BD0' },
            { label: '62 bpm', icon: 'heart-outline' as const, color: '#E94B3C' },
            { label: '487 kcal', icon: 'flame-outline' as const, color: '#22C55E' },
          ].map((chip) => (
            <View
              key={chip.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: `${chip.color}15`,
                borderWidth: 1,
                borderColor: `${chip.color}30`,
              }}
            >
              <Ionicons name={chip.icon} size={12} color={chip.color} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: chip.color }}>
                {chip.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Disconnect button */}
        <TouchableOpacity
          onPress={handleDisconnect}
          activeOpacity={0.8}
          style={{
            width: '100%',
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: '#E94B3C14',
            borderWidth: 1,
            borderColor: '#E94B3C30',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#E94B3C' }}>
            Deconnecter cet appareil
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
