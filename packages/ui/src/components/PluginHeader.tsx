import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';

interface PluginHeaderProps {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}

export function PluginHeader({ title, onBack, right }: PluginHeaderProps) {
  const theme = useThemeStore((s) => s.theme);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 14,
        paddingTop: 10,
      }}
    >
      <TouchableOpacity
        onPress={onBack}
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          backgroundColor: theme.text + '10',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="chevron-back" size={16} color={theme.text} />
      </TouchableOpacity>
      <Text
        style={{
          fontSize: 20,
          fontWeight: '800',
          letterSpacing: -0.4,
          flex: 1,
          color: theme.text,
        }}
      >
        {title}
      </Text>
      {right && <View>{right}</View>}
    </View>
  );
}
