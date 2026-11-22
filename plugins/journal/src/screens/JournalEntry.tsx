import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useThemeStore } from '@ziko/plugin-sdk';
import { PluginHeader } from '@ziko/ui';
import JournalForm, { type JournalAuthProps } from './JournalForm';

/** Ecran « Nouvelle entree » : meme formulaire que l'onglet Aujourd'hui (une seule logique d'enregistrement). */
export default function JournalEntry({ supabase, requireUser, onReauth }: JournalAuthProps) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <PluginHeader title="Nouvelle entrée" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <JournalForm supabase={supabase} requireUser={requireUser} onReauth={onReauth} onSaved={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}
