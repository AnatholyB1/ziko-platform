import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { STToggle } from './STToggle';

interface STRowProps {
  icon: string;
  tint: string;
  label: string;
  sub?: string;
  right?: string;
  danger?: boolean;
  onPress?: () => void;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
}

export function STRow({
  icon,
  tint,
  label,
  sub,
  right,
  danger,
  onPress,
  toggleValue,
  onToggle,
}: STRowProps) {
  const theme = useThemeStore((s) => s.theme);

  return (
    <TouchableOpacity
      activeOpacity={onPress || onToggle ? 0.7 : 1}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 8,
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
        }}
      >
        <Ionicons name={icon as any} size={15} color={tint} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '700',
            color: danger ? '#E94B3C' : theme.text,
          }}
        >
          {label}
        </Text>
        {sub ? (
          <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>
            {sub}
          </Text>
        ) : null}
      </View>
      {onToggle !== undefined ? (
        <STToggle value={toggleValue ?? false} onChange={onToggle} />
      ) : right ? (
        <Text
          style={{
            fontSize: 12,
            color: theme.muted,
            fontWeight: '400',
            marginRight: 4,
          }}
        >
          {right}
        </Text>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={14} color={theme.muted} />
      ) : null}
    </TouchableOpacity>
  );
}
