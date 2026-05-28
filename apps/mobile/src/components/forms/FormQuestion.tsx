import React from 'react';
import { View, Text } from 'react-native';
import { useThemeStore } from '../../stores/themeStore';
import type { FormQuestion } from './types';
import { QuestionFreeText } from './QuestionFreeText';
import { QuestionScale } from './QuestionScale';
import { QuestionYesNo } from './QuestionYesNo';
import { QuestionSingleChoice } from './QuestionSingleChoice';

type QuestionValue = string | number | null;

interface FormQuestionProps {
  question: FormQuestion;
  value: QuestionValue;
  onChange: (value: QuestionValue) => void;
  index: number;
  total: number;
}

export function FormQuestion({ question, value, onChange, index, total }: FormQuestionProps) {
  const theme = useThemeStore((s) => s.theme);

  const renderRenderer = () => {
    switch (question.type) {
      case 'text':
        return (
          <QuestionFreeText
            question={question}
            value={typeof value === 'string' ? value : ''}
            onChange={(v: string) => onChange(v)}
          />
        );
      case 'scale':
        return (
          <QuestionScale
            question={question}
            value={typeof value === 'number' ? value : null}
            onChange={(v: number) => onChange(v)}
          />
        );
      case 'yes_no':
        return (
          <QuestionYesNo
            question={question}
            value={value === 'yes' || value === 'no' ? value : null}
            onChange={(v: 'yes' | 'no') => onChange(v)}
          />
        );
      case 'choice':
        return (
          <QuestionSingleChoice
            question={question}
            value={typeof value === 'string' ? value : null}
            onChange={(v: string) => onChange(v)}
          />
        );
      default:
        return (
          <Text style={{ fontSize: 14, color: theme.muted, marginHorizontal: 20 }}>
            Type de question inconnu
          </Text>
        );
    }
  };

  return (
    <View>
      <Text
        style={{
          fontSize: 12,
          fontWeight: '400',
          color: theme.muted,
          marginLeft: 20,
          marginBottom: 8,
        }}
      >
        Question {index + 1} / {total}
      </Text>
      {renderRenderer()}
    </View>
  );
}
