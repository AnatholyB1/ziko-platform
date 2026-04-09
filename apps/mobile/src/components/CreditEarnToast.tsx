import React, { useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';
import { useCreditStore } from '../stores/creditStore';

export default function CreditEarnToast() {
  const toastVisible = useCreditStore((s) => s.toastVisible);
  const hideToast = useCreditStore((s) => s.hideEarnToast);
  const theme = useThemeStore((s) => s.theme);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (toastVisible) {
      // Clear any existing timer to prevent flicker on rapid calls (Pitfall 2)
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        hideToast();
        timerRef.current = null;
      }, 2500);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toastVisible]);

  if (!toastVisible) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 999,
      }}
    >
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300 }}
        style={{
          backgroundColor: theme.surface,
          borderRadius: 24,
          paddingHorizontal: 20,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: theme.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Ionicons name="flash" size={18} color="#FFB800" />
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>
          +1 AI credit earned!
        </Text>
      </MotiView>
    </View>
  );
}
