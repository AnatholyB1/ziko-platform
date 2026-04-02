import React from 'react';
import { View, Text } from 'react-native';

const GRADE_COLORS: Record<string, string> = {
  'a': '#1A7F37', 'a-plus': '#1A7F37',
  'b': '#78B346', 'c': '#F5A623',
  'd': '#E3692B', 'e': '#CC1F24',
};

const GRADE_LABELS: Record<string, string> = {
  'a-plus': 'A+', 'a': 'A', 'b': 'B', 'c': 'C', 'd': 'D', 'e': 'E',
};

const PREFIX: Record<'nutriscore' | 'ecoscore', string> = {
  nutriscore: 'NS', ecoscore: 'ES',
};

const SIZE_STYLES = {
  sm: { height: 20, paddingHorizontal: 4, fontSize: 12 },
  md: { height: 24, paddingHorizontal: 8, fontSize: 12 },
  lg: { height: 28, paddingHorizontal: 8, fontSize: 12 },
};

interface ScoreBadgeProps {
  grade: string | null;
  type: 'nutriscore' | 'ecoscore';
  size: 'sm' | 'md' | 'lg';
}

export default function ScoreBadge({ grade, type, size }: ScoreBadgeProps) {
  if (!grade) return null;

  const normalized = grade.toLowerCase();
  const color = GRADE_COLORS[normalized];

  if (!color) return null;

  const label = GRADE_LABELS[normalized] ?? grade.toUpperCase();
  const { height, paddingHorizontal, fontSize } = SIZE_STYLES[size];

  return (
    <View
      style={{
        height,
        paddingHorizontal,
        backgroundColor: color,
        borderRadius: height / 2,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
      }}
    >
      <Text style={{ color: '#fff', fontSize, fontWeight: '700' }}>
        {PREFIX[type]} {label}
      </Text>
    </View>
  );
}
