import React, { useRef, useEffect } from 'react';
import { Animated, TouchableOpacity } from 'react-native';

interface STToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
}

export function STToggle({ value, onChange }: STToggleProps) {
  const thumbAnim = useRef(new Animated.Value(value ? 18 : 2)).current;
  const bgAnim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(thumbAnim, {
      toValue: value ? 18 : 2,
      duration: 200,
      useNativeDriver: false,
    }).start();
    Animated.timing(bgAnim, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const bgColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(28,26,23,0.12)', '#22C55E'],
  });

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => onChange(!value)}
      style={{ width: 40, height: 24 }}
    >
      <Animated.View
        style={{
          width: 40,
          height: 24,
          borderRadius: 999,
          backgroundColor: bgColor,
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: 2,
            left: thumbAnim,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: '#FFFFFF',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.2,
            shadowRadius: 3,
            elevation: 2,
          }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}
