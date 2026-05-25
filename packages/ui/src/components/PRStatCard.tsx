import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { shadow } from '../design-system';

interface PRStatCardProps {
  icon: string;
  tint: string;
  value: number | string;
  label: string;
}

export function PRStatCard({ icon, tint, value, label }: PRStatCardProps) {
  const theme = useThemeStore((s) => s.theme);

  return (
    <View
      style={{
        padding: 16,
        borderRadius: 12,
        backgroundColor: theme.surface,
        ...shadow.card,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: tint + '24',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <Ionicons name={icon as any} size={16} color={tint} />
      </View>
      <Text
        style={{
          fontSize: 22,
          fontWeight: '700',
          lineHeight: 22,
          color: theme.text,
        }}
      >
        {value}
      </Text>
      <Text style={{ fontSize: 12, color: theme.muted, marginTop: 4 }}>
        {label}
      </Text>
    </View>
  );
}
