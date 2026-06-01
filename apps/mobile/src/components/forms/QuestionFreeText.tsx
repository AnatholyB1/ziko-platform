import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { useThemeStore } from '../../stores/themeStore';
import type { FormQuestion } from './types';

interface QuestionFreeTextProps {
  question: FormQuestion;
  value: string;
  onChange: (value: string) => void;
}

export function QuestionFreeText({ question, value, onChange }: QuestionFreeTextProps) {
  const theme = useThemeStore((s) => s.theme);

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
          Texte libre
        </Text>
      </View>

      <TextInput
        multiline
        value={value}
        onChangeText={onChange}
        placeholder="Écris ta réponse ici…"
        placeholderTextColor="rgba(107,105,99,0.6)"
        style={{
          marginHorizontal: 20,
          marginTop: 16,
          padding: 16,
          backgroundColor: theme.surface,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: theme.border,
          minHeight: 148,
          fontSize: 16,
          color: theme.text,
          textAlignVertical: 'top',
        }}
      />

      <Text
        style={{
          fontSize: 12,
          fontWeight: '400',
          color: theme.muted,
          textAlign: 'right',
          marginRight: 20,
          marginTop: 4,
        }}
      >
        {value.length} / 500 caractères
      </Text>
    </View>
  );
}
