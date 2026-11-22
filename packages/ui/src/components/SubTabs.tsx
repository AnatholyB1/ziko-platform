import React, { useState } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useThemeStore, tabsSideMargin } from '@ziko/plugin-sdk';

interface SubTabsProps {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}

export function SubTabs({ tabs, active, onChange }: SubTabsProps) {
  const theme = useThemeStore((s) => s.theme);
  const { width: screenW } = useWindowDimensions();
  // XCUT-05 : gouttiere 16 si la barre est collee aux bords de l'ecran.
  const [side, setSide] = useState(0);

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width + side * 2;
        const next = tabsSideMargin(w, screenW);
        if (next !== side) setSide(next);
      }}
      style={{
        marginHorizontal: side,
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
