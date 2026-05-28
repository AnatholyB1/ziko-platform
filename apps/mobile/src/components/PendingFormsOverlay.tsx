import React, { useRef, useEffect, useState } from 'react';
import { Modal, View, Text, Animated, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { supabase } from '../lib/supabase';
import type { PendingForm, FormAnswer } from './forms/types';

interface PendingFormsResponse {
  forms: PendingForm[];
}

export function PendingFormsOverlay() {
  const userId = useAuthStore((s) => s.user?.id);
  const theme = useThemeStore((s) => s.theme);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [localForms, setLocalForms] = useState<PendingForm[]>([]);
  const [currentFormIndex, setCurrentFormIndex] = useState(0);
  const [formView, setFormView] = useState<'header' | 'questions'>('header');

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

  const isVisible = localForms.length > 0;
  const currentForm = localForms[currentFormIndex];

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

        {/* Placeholder content — replaced in Plan 04-02 and 04-03 */}
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 16,
              color: theme.text,
              fontWeight: '500',
            }}
          >
            {`Formulaire ${currentFormIndex + 1} / ${localForms.length}`}
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}
