import React, { useRef } from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import { useThemeStore } from '../../stores/themeStore';
import type { FormQuestion } from './types';

interface QuestionScaleProps {
  question: FormQuestion;
  value: number | null;
  onChange: (value: number) => void;
}

export function QuestionScale({ question, value, onChange }: QuestionScaleProps) {
  const theme = useThemeStore((s) => s.theme);
  const scaleAnimValues = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(1))
  ).current;

  const handlePress = (val: number) => {
    const idx = val - 1;
    Animated.sequence([
      Animated.timing(scaleAnimValues[idx], {
        toValue: 1.08,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnimValues[idx], {
        toValue: 1,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
    onChange(val);
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
          Échelle 1–10
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: 20,
          marginTop: 16,
          gap: 3,
        }}
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => {
          const isSelected = value === val;
          return (
            <Animated.View
              key={val}
              style={{
                flexGrow: 1,
                transform: [{ scale: scaleAnimValues[val - 1] }],
              }}
            >
              <TouchableOpacity
                onPress={() => handlePress(val)}
                activeOpacity={1}
                style={{
                  height: 44,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...(isSelected
                    ? {
                        backgroundColor: theme.primary,
                        shadowColor: '#FF5C1A',
                        shadowOpacity: 0.3,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 4,
                      }
                    : {
                        backgroundColor: theme.surface,
                        borderWidth: 1,
                        borderColor: theme.border,
                      }),
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: isSelected ? '700' : '400',
                    color: isSelected ? '#FFFFFF' : theme.text,
                  }}
                >
                  {val}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginHorizontal: 20,
          marginTop: 8,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: '400',
            color: theme.muted,
          }}
        >
          Pas du tout
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontWeight: '400',
            color: theme.muted,
          }}
        >
          Totalement
        </Text>
      </View>
    </View>
  );
}
