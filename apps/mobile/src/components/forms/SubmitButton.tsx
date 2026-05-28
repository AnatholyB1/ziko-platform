import React, { useRef } from 'react';
import { View, Text, Animated, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useThemeStore } from '../../stores/themeStore';

interface SubmitButtonProps {
  onPress: () => void;
  isAllAnswered: boolean;
  isLoading: boolean;
  label: string;
}

export function SubmitButton({ onPress, isAllAnswered, isLoading, label }: SubmitButtonProps) {
  const theme = useThemeStore((s) => s.theme);
  const ctaScaleAnim = useRef(new Animated.Value(1)).current;

  const isDisabled = !isAllAnswered || isLoading;

  const handlePressIn = () => {
    Animated.timing(ctaScaleAnim, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(ctaScaleAnim, {
      toValue: 1,
      tension: 160,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const buttonOpacity = isLoading ? 0.7 : isAllAnswered ? 1.0 : 0.4;

  return (
    <View>
      <Animated.View style={{ transform: [{ scale: ctaScaleAnim }] }}>
        <TouchableOpacity
          onPress={isDisabled ? undefined : onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={isDisabled}
          activeOpacity={0.9}
          style={{
            width: 350,
            height: 56,
            borderRadius: 12,
            backgroundColor: theme.primary,
            opacity: buttonOpacity,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isLoading ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: '#FFFFFF',
                  marginLeft: 8,
                }}
              >
                Envoi en cours…
              </Text>
            </>
          ) : (
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: '#FFFFFF',
                textAlign: 'center',
              }}
            >
              {label}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {isDisabled && !isLoading && (
        <Text
          style={{
            fontSize: 12,
            fontWeight: '400',
            color: theme.muted,
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          Toutes les réponses sont requises
        </Text>
      )}
    </View>
  );
}
