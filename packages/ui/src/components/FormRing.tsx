import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface FormRingProps {
  score: number;
  parts: { value: number; max: number; color: string }[];
  size?: number;
}

export function FormRing({ score, parts, size = 120 }: FormRingProps) {
  const STROKE = 11;
  const r = (size - STROKE) / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(28,26,23,0.06)"
          strokeWidth={STROKE}
          fill="none"
        />
        {parts.map((p, i) => {
          const portion = (Math.min(p.value / p.max, 1) / parts.length) * 0.92;
          const len = C * portion;
          const gap = C - len;
          const dashOffset = -(offset * C) - (C * 0.25);
          const el = (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={p.color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={[len, gap]}
              strokeDashoffset={dashOffset}
              fill="none"
            />
          );
          offset += portion + 0.02;
          return el;
        })}
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#1C1A17' }}>{score}</Text>
      </View>
    </View>
  );
}
