import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useThemeStore } from '@ziko/plugin-sdk';

interface SubTabsProps {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}

export function SubTabs({ tabs, active, onChange }: SubTabsProps) {
  const theme = useThemeStore((s) => s.theme);

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 4,
        padding: 4,
        backgroundColor: 'rgba(28,26,23,0.05)',
        borderRadius: 12,
        marginBottom: 16,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <TouchableOpacity
            key={tab}
            onPress={() => onChange(tab)}
            style={[
              {
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 8,
                borderRadius: 8,
                alignItems: 'center',
              },
              isActive && {
                backgroundColor: '#FFFFFF',
                shadowColor: '#1C1A17',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 4,
                elevation: 1,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: isActive ? theme.text : theme.muted,
              }}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
