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
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.border }}>
      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <TouchableOpacity
            key={tab}
            onPress={() => onChange(tab)}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              alignItems: 'center',
              position: 'relative',
            }}
          >
            <Text
              style={{
                fontWeight: isActive ? '700' : '500',
                color: isActive ? theme.text : theme.muted,
                fontSize: 14,
              }}
            >
              {tab}
            </Text>
            {isActive && (
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  height: 2,
                  width: '100%',
                  backgroundColor: theme.primary,
                }}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
