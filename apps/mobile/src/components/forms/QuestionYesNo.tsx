import React, { useRef } from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import { useThemeStore } from '../../stores/themeStore';
import type { FormQuestion } from './types';

interface QuestionYesNoProps {
  question: FormQuestion;
  value: 'yes' | 'no' | null;
  onChange: (value: 'yes' | 'no') => void;
}

const OPTIONS: { label: string; optionValue: 'yes' | 'no' }[] = [
  { label: 'Oui', optionValue: 'yes' },
  { label: 'Non', optionValue: 'no' },
];

export function QuestionYesNo({ question, value, onChange }: QuestionYesNoProps) {
  const theme = useThemeStore((s) => s.theme);
  const yesScaleAnim = useRef(new Animated.Value(1)).current;
  const noScaleAnim = useRef(new Animated.Value(1)).current;

  const scaleAnims = { yes: yesScaleAnim, no: noScaleAnim };

  const handlePress = (optionValue: 'yes' | 'no') => {
    const anim = scaleAnims[optionValue];
    Animated.sequence([
      Animated.timing(anim, {
        toValue: 0.97,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(anim, {
        toValue: 1,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
    onChange(optionValue);
  };

  return (
    <View>
      <Text
        style={{
          fontSize: 20,
          fontWeight: '700',
          color: theme.text,
          lineHeight: 26,
          marginHorizontal: 20,
        }}
      >
        {question.label}
      </Text>

      <View
        style={{
          alignSelf: 'flex-start',
          marginLeft: 20,
          marginTop: 8,
          backgroundColor: '#F0EFE9',
          borderRadius: 6,
          paddingHorizontal: 10,
          paddingVertical: 4,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: '400',
            color: theme.muted,
          }}
        >
          Oui / Non
        </Text>
      </View>

      <View
        style={{
          marginHorizontal: 20,
          marginTop: 16,
          gap: 8,
        }}
      >
        {OPTIONS.map(({ label, optionValue }) => {
          const isSelected = value === optionValue;
          return (
            <Animated.View
              key={optionValue}
              style={{
                transform: [{ scale: scaleAnims[optionValue] }],
              }}
            >
              <TouchableOpacity
                onPress={() => handlePress(optionValue)}
                activeOpacity={1}
                style={{
                  height: 80,
                  borderRadius: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  ...(isSelected
                    ? {
                        backgroundColor: 'rgba(255,92,26,0.08)',
                        borderWidth: 2,
                        borderColor: theme.primary,
                      }
                    : {
                        backgroundColor: theme.surface,
                        borderWidth: 1.5,
                        borderColor: theme.border,
                      }),
                }}
              >
                {/* Radio dot */}
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(isSelected
                      ? { backgroundColor: theme.primary }
                      : {
                          backgroundColor: theme.surface,
                          borderWidth: 2,
                          borderColor: theme.border,
                        }),
                  }}
                >
                  {isSelected && (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#FFFFFF',
                      }}
                    />
                  )}
                </View>

                {/* Label */}
                <Text
                  style={{
                    marginLeft: 14,
                    fontSize: 16,
                    fontWeight: isSelected ? '700' : '400',
                    color: isSelected ? theme.primary : theme.text,
                  }}
                >
                  {label}
                </Text>

                {/* Checkmark */}
                {isSelected && (
                  <Text
                    style={{
                      marginLeft: 'auto',
                      fontSize: 16,
                      fontWeight: '700',
                      color: theme.primary,
                    }}
                  >
                    ✓
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
