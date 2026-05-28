import React, { useRef, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Animated,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { supabase } from '../lib/supabase';
import { showAlert } from '@ziko/plugin-sdk';
import type { PendingForm, FormAnswer } from './forms/types';
import { FormQuestion as FormQuestionRenderer } from './forms/FormQuestion';
import { FormProgressBar } from './forms/FormProgressBar';
import { SubmitButton } from './forms/SubmitButton';

interface PendingFormsResponse {
  forms: PendingForm[];
}

type QuestionType = 'text' | 'scale' | 'yes_no' | 'choice';

const QUESTION_TYPE_META: Record<QuestionType, { icon: string; label: string }> = {
  text: { icon: 'create-outline', label: 'Texte libre' },
  scale: { icon: 'stats-chart-outline', label: 'Échelle 1–10' },
  yes_no: { icon: 'checkmark-circle-outline', label: 'Oui / Non' },
  choice: { icon: 'radio-button-on-outline', label: 'Choix unique' },
};

export function PendingFormsOverlay() {
  const userId = useAuthStore((s) => s.user?.id);
  const theme = useThemeStore((s) => s.theme);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [localForms, setLocalForms] = useState<PendingForm[]>([]);
  const [currentFormIndex, setCurrentFormIndex] = useState(0);
  const [formView, setFormView] = useState<'header' | 'questions'>('header');
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data } = useQuery<PendingFormsResponse>({
    queryKey: ['pending-forms', userId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/athlete/forms/pending`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error('fetch failed');
      return res.json();
    },
    staleTime: 0,
    enabled: !!userId,
  });

  // When query returns forms and overlay is not yet showing, populate local state
  useEffect(() => {
    if (data?.forms && data.forms.length > 0 && localForms.length === 0) {
      setLocalForms(data.forms);
      setCurrentFormIndex(0);
      setFormView('header');
    }
  }, [data?.forms]);

  // Fade-in when forms become available
  useEffect(() => {
    if (localForms.length > 0) {
      Animated.spring(fadeAnim, {
        toValue: 1,
        tension: 60,
        friction: 9,
        useNativeDriver: true,
      }).start();
    }
  }, [localForms.length]);

  // Reset answers and view when form index advances
  useEffect(() => {
    setAnswers({});
    setFormView('header');
  }, [currentFormIndex]);

  const dismissOverlay = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setLocalForms([]);
      setCurrentFormIndex(0);
      setFormView('header');
      fadeAnim.setValue(0);
    });
  };

  const setAnswer = (questionId: string, value: string | number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const isVisible = localForms.length > 0;
  const currentForm = localForms[currentFormIndex];

  const answeredCount = currentForm
    ? currentForm.questions.filter((q) => {
        const v = answers[q.id];
        if (v === undefined || v === null) return false;
        if (q.type === 'text') return typeof v === 'string' && v.trim().length > 0;
        if (q.type === 'scale') return typeof v === 'number' && v >= 1 && v <= 10;
        if (q.type === 'yes_no') return v === 'yes' || v === 'no';
        if (q.type === 'choice') return typeof v === 'string' && v.length > 0;
        return false;
      }).length
    : 0;

  const isAllAnswered = currentForm
    ? currentForm.questions.every((q) => {
        const v = answers[q.id];
        if (v === undefined || v === null) return false;
        if (q.type === 'text') return typeof v === 'string' && v.trim().length > 0;
        if (q.type === 'scale') return typeof v === 'number' && v >= 1 && v <= 10;
        if (q.type === 'yes_no') return v === 'yes' || v === 'no';
        if (q.type === 'choice') return typeof v === 'string' && v.length > 0;
        return false;
      })
    : false;

  const handleSubmit = async () => {
    if (!currentForm || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const answersArray: FormAnswer[] = currentForm.questions.map((q) => ({
        question_id: q.id,
        value: answers[q.id],
      }));
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/athlete/forms/${currentForm.instance_id}/submit`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ answers: answersArray }),
        },
      );
      if (!res.ok) throw new Error('submit failed');
      const isLast = currentFormIndex === localForms.length - 1;
      if (isLast) {
        dismissOverlay();
      } else {
        setCurrentFormIndex((i) => i + 1);
      }
    } catch {
      showAlert('Erreur', 'La soumission a échoué. Vérifie ta connexion.', [
        { text: 'Réessayer', onPress: handleSubmit },
        { text: 'Annuler', style: 'cancel' },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Deduplicated question types for icon rows
  const uniqueQuestionTypes: QuestionType[] = currentForm
    ? Array.from(new Set(currentForm.questions.map((q) => q.type as QuestionType)))
    : [];

  const counterPillStyle =
    currentFormIndex === 0
      ? { backgroundColor: '#F0EFE9', color: theme.muted }
      : { backgroundColor: 'rgba(255,92,26,0.15)', color: theme.primary };

  return (
    <Modal
      visible={isVisible}
      animationType="none"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
          backgroundColor: theme.background,
        }}
      >
        {/* Orange accent strip */}
        <View
          style={{
            height: 4,
            backgroundColor: theme.primary,
          }}
        />

        {formView === 'header' && (
          <View style={{ flex: 1, paddingBottom: 100 }}>
            {/* Counter pill */}
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <View
                style={{
                  backgroundColor: counterPillStyle.backgroundColor,
                  paddingHorizontal: 12,
                  height: 32,
                  borderRadius: 9999,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: counterPillStyle.color,
                  }}
                >
                  {`Formulaire ${currentFormIndex + 1} / ${localForms.length}`}
                </Text>
              </View>
            </View>

            {/* Lock icon pill — absolute top-right */}
            <View
              style={{
                position: 'absolute',
                right: 20,
                top: 24,
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#F0EFE9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={theme.muted}
                accessibilityLabel="Formulaire obligatoire"
              />
            </View>

            {/* Form icon block */}
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                backgroundColor: theme.primary,
                alignSelf: 'center',
                marginTop: 32,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="clipboard-outline" size={36} color="#FFFFFF" />
            </View>

            {/* Form title */}
            <Text
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: theme.text,
                textAlign: 'center',
                marginHorizontal: 20,
                marginTop: 16,
                lineHeight: 28,
              }}
            >
              {currentForm?.form_title}
            </Text>

            {/* Question count badge */}
            <View
              style={{
                alignSelf: 'center',
                marginTop: 16,
                paddingHorizontal: 14,
                height: 30,
                borderRadius: 8,
                backgroundColor: '#F0EFE9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '400',
                  color: theme.muted,
                }}
              >
                {`${currentForm?.question_count} questions`}
              </Text>
            </View>

            {/* Body copy */}
            <Text
              style={{
                fontSize: 16,
                fontWeight: '400',
                color: theme.muted,
                textAlign: 'center',
                marginHorizontal: 20,
                marginTop: 12,
              }}
            >
              {'Ton coach a besoin de tes réponses\navant de continuer.'}
            </Text>

            {/* Divider */}
            <View
              style={{
                height: 1,
                backgroundColor: theme.border,
                marginHorizontal: 20,
                marginTop: 32,
              }}
            />

            {/* "Ce formulaire contient :" section header */}
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: theme.text,
                marginHorizontal: 20,
                marginTop: 12,
              }}
            >
              {'Ce formulaire contient :'}
            </Text>

            {/* Icon rows — one per distinct question type */}
            {uniqueQuestionTypes.map((type) => {
              const meta = QUESTION_TYPE_META[type];
              return (
                <View
                  key={type}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginHorizontal: 20,
                    marginTop: 8,
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: '#F0EFE9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={meta.icon as any} size={14} color={theme.muted} />
                  </View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '400',
                      color: theme.text,
                      marginLeft: 8,
                    }}
                  >
                    {meta.label}
                  </Text>
                </View>
              );
            })}

            {/* CTA absolute bottom */}
            <TouchableOpacity
              onPress={() => setFormView('questions')}
              activeOpacity={0.85}
              style={{
                position: 'absolute',
                bottom: 40,
                left: 20,
                right: 20,
                height: 56,
                borderRadius: 12,
                backgroundColor: theme.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: '#FFFFFF',
                  textAlign: 'center',
                }}
              >
                Remplir le formulaire
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {formView === 'questions' && currentForm && (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Counter pill */}
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <View
                style={{
                  backgroundColor: counterPillStyle.backgroundColor,
                  paddingHorizontal: 12,
                  height: 32,
                  borderRadius: 9999,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: counterPillStyle.color,
                  }}
                >
                  {`Formulaire ${currentFormIndex + 1} / ${localForms.length}`}
                </Text>
              </View>
            </View>

            {/* Questions ScrollView */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 120 }}
              keyboardShouldPersistTaps="handled"
            >
              <FormProgressBar
                current={answeredCount}
                total={currentForm.questions.length}
              />
              {currentForm.questions.map((q, i) => (
                <FormQuestionRenderer
                  key={q.id}
                  question={q}
                  value={answers[q.id] ?? null}
                  onChange={(v) => {
                    if (v !== null) {
                      setAnswer(q.id, v);
                    }
                  }}
                  index={i}
                  total={currentForm.questions.length}
                />
              ))}
            </ScrollView>

            {/* Absolute bottom submit CTA */}
            <View
              style={{
                position: 'absolute',
                bottom: 40,
                left: 20,
                right: 20,
              }}
            >
              <SubmitButton
                label="Valider le formulaire"
                isAllAnswered={isAllAnswered}
                isLoading={isSubmitting}
                onPress={handleSubmit}
              />
            </View>
          </KeyboardAvoidingView>
        )}
      </Animated.View>
    </Modal>
  );
}
