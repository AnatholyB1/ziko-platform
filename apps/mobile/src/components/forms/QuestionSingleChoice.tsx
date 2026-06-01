import React, { useRef } from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import { useThemeStore } from '../../stores/themeStore';
import type { FormQuestion } from './types';

interface QuestionSingleChoiceProps {
  question: FormQuestion;
  value: string | null;
  onChange: (value: string) => void;
}

export function QuestionSingleChoice({ question, value, onChange }: QuestionSingleChoiceProps) {
  const theme = useThemeStore((s) => s.theme);
  const choices = question.choices ?? [];
  const choiceScaleAnims = useRef(
    choices.map(() => new Animated.Value(1))
  ).current;

  const handlePress = (choice: string, index: number) => {
    const anim = choiceScaleAnims[index];
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
    onChange(choice);
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
          Choix unique
        </Text>
      </View>

      <View
        style={{
          marginHorizontal: 20,
          marginTop: 16,
          gap: 10,
        }}
      >
        {choices.length === 0 ? (
          <Text style={{ fontSize: 14, color: theme.muted }}>Aucune option</Text>
        ) : (
          choices.map((choice, index) => {
            const isSelected = value === choice;
            return (
              <Animated.View
                key={choice}
                style={{
                  transform: [{ scale: choiceScaleAnims[index] }],
                }}
              >
                <TouchableOpacity
                  onPress={() => handlePress(choice, index)}
                  activeOpacity={1}
                  style={{
                    height: 64,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingLeft: 16,
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
                  {/* Radio outer */}
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
                    {choice}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })
        )}
      </View>
    </View>
  );
}
