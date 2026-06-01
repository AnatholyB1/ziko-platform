import React, { useRef, useEffect } from 'react';
import { View, Animated } from 'react-native';
import { useThemeStore } from '../../stores/themeStore';

interface FormProgressBarProps {
  current: number;
  total: number;
}

const TRACK_WIDTH = 350;

export function FormProgressBar({ current, total }: FormProgressBarProps) {
  const theme = useThemeStore((s) => s.theme);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: total > 0 ? current / total : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [current, total, progressAnim]);

  const fillWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRACK_WIDTH],
  });

  return (
    <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
      <View
        style={{
          width: TRACK_WIDTH,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.border,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            height: 4,
            backgroundColor: theme.primary,
            width: fillWidth,
          }}
        />
      </View>
    </View>
  );
}
