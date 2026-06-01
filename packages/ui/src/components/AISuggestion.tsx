import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';

interface AISuggestionProps {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  tintColor?: string;
}

export function AISuggestion({ text, actionLabel, onAction, tintColor }: AISuggestionProps) {
  const theme = useThemeStore((s) => s.theme);
  const tint = tintColor ?? theme.primary;

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 16,
        borderLeftWidth: 3,
        borderLeftColor: tint,
        padding: 14,
        shadowColor: '#1C1A17',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.06,
          textTransform: 'uppercase',
          color: tint,
          marginBottom: 4,
        }}
      >
        COACH IA · SUGGESTION
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Ionicons name="sparkles" size={16} color={tint} style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, fontSize: 14, color: theme.text, lineHeight: 20 }}>{text}</Text>
      </View>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: tint }}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
