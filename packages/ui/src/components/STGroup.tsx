import React from 'react';
import { View, Text } from 'react-native';
import { useThemeStore } from '@ziko/plugin-sdk';
import { shadow } from '../design-system';

interface STGroupProps {
  title: string;
  children: React.ReactNode;
}

export function STGroup({ title, children }: STGroupProps) {
  const theme = useThemeStore((s) => s.theme);

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 1.1,
          textTransform: 'uppercase',
          color: theme.muted,
          paddingHorizontal: 4,
          paddingBottom: 8,
          paddingTop: 4,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: theme.surface,
          borderRadius: 12,
          overflow: 'hidden',
          ...shadow.card,
        }}
      >
        {React.Children.map(children, (child, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <View
                style={{
                  height: 1,
                  backgroundColor: '#E2E0DA',
                  marginHorizontal: 12,
                }}
              />
            )}
            {child}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}
