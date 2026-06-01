import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../src/stores/themeStore';
import { showAlert } from '@ziko/plugin-sdk';

const FAQ_ITEMS = [
  {
    cat: 'General',
    q: "Qu'est-ce que Ziko ?",
    a: "Ziko est une application de fitness extensible avec des plugins, un coaching IA et un suivi complet de tes entrainements, nutrition, sommeil et bien plus.",
  },
  {
    cat: 'General',
    q: "L'app fonctionne-t-elle hors connexion ?",
    a: "Les fonctions de base (timer, logs locaux) fonctionnent hors connexion. La synchronisation et l'IA necessitent une connexion internet.",
  },
  {
    cat: 'General',
    q: "Comment mettre a jour l'application ?",
    a: "Les mises a jour sont disponibles sur l'App Store (iOS) ou le Play Store (Android). Active les mises a jour automatiques pour ne rien rater.",
  },
  {
    cat: 'Credits IA',
    q: "C'est quoi les credits IA ?",
    a: "Les credits IA te permettent d'utiliser le coach intelligent. Tu en gagnes en completant tes habitudes, seances et defis. Tu peux aussi en obtenir en parrainant des amis.",
  },
  {
    cat: 'Credits IA',
    q: "Comment gagner des credits gratuitement ?",
    a: "Complete tes habitudes quotidiennes (+5 credits), enregistre une seance (+10), atteins ton objectif hydratation (+3), ou parraine un ami (+50 credits par inscription).",
  },
  {
    cat: 'Credits IA',
    q: "Les credits expirent-ils ?",
    a: "Non, tes credits n'expirent jamais. Tu peux les accumuler sans limite et les utiliser quand tu veux.",
  },
  {
    cat: 'Plugins',
    q: "Comment activer un plugin ?",
    a: "Va dans Profil > Modules et active les plugins que tu veux utiliser. Ils apparaitront automatiquement dans la navigation et le dashboard.",
  },
  {
    cat: 'Plugins',
    q: "Puis-je desactiver un plugin sans perdre mes donnees ?",
    a: "Oui. Desactiver un plugin le masque simplement dans l'interface. Toutes tes donnees sont conservees et accessibles si tu le reactives.",
  },
  {
    cat: 'Plugins',
    q: "Combien de plugins puis-je activer simultanement ?",
    a: "Il n'y a pas de limite. Tu peux activer tous les 17 plugins en meme temps, mais nous recommandons de n'activer que ceux que tu utilises vraiment.",
  },
  {
    cat: 'Compte',
    q: "Comment supprimer mon compte ?",
    a: "Va dans Profil > Parametres > Zone dangereuse > Supprimer le compte. Cette action est irreversible et supprime toutes tes donnees.",
  },
  {
    cat: 'Compte',
    q: "Mes donnees sont-elles securisees ?",
    a: "Oui. Toutes les donnees sont chiffrees au repos (AES-256) et en transit (TLS 1.3). Nous respectons le RGPD et ne vendons jamais tes donnees.",
  },
  {
    cat: 'Compte',
    q: "Comment changer mon mot de passe ?",
    a: 'Sur l\'ecran de connexion, appuie sur "Mot de passe oublie". Un lien de reinitialisation sera envoye a ton adresse email.',
  },
];

// ── STGroup / STRow ────────────────────────────────────────

const STGroup = ({ children }: { children: React.ReactNode }) => (
  <View
    style={{
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#E2E0DA',
      overflow: 'hidden',
      marginBottom: 12,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    }}
  >
    {children}
  </View>
);

interface STRowProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  right?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
  sublabel?: string;
}

const STRow = ({ label, icon, right, onPress, isLast, sublabel }: STRowProps) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: isLast ? 0 : 1,
      borderBottomColor: '#E2E0DA',
      gap: 12,
    }}
  >
    {icon && (
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          backgroundColor: '#FF5C1A15',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={16} color="#FF5C1A" />
      </View>
    )}
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 14, fontWeight: '500', color: '#1C1A17' }}>{label}</Text>
      {sublabel ? (
        <Text style={{ fontSize: 12, color: '#6B6963', marginTop: 1 }}>{sublabel}</Text>
      ) : null}
    </View>
    {right !== undefined ? (
      right
    ) : onPress ? (
      <Ionicons name="chevron-forward" size={16} color="#6B6963" />
    ) : null}
  </TouchableOpacity>
);

// ── FAQ expandable ─────────────────────────────────────────

export default function HelpScreen() {
  const theme = useThemeStore((s) => s.theme);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 6,
          gap: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            backgroundColor: '#1C1A170F',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back-outline" size={18} color="#1C1A17" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 24, fontWeight: '800', color: '#1C1A17' }}>Aide</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
        {/* Group: Aide & Support */}
        <Text
          style={{
            fontSize: 10.5,
            fontWeight: '800',
            color: '#6B6963',
            letterSpacing: 1.0,
            textTransform: 'uppercase',
            marginBottom: 8,
            marginTop: 16,
            paddingHorizontal: 4,
          }}
        >
          Aide & Support
        </Text>
        <STGroup>
          <STRow
            label="FAQ"
            icon="help-circle-outline"
            onPress={() => {}}
          />
          <STRow
            label="Contacter le support"
            sublabel="support@ziko.app · Réponse < 1h"
            icon="chatbubble-ellipses-outline"
            onPress={() => showAlert('Email', 'Contacte-nous à support@ziko.app')}
          />
          <STRow
            label="Signaler un bug"
            icon="bug-outline"
            onPress={() => showAlert('Signaler un bug', 'Merci ! Envoie un email à support@ziko.app avec une description du problème.')}
            isLast
          />
        </STGroup>

        {/* FAQ accordion */}
        <Text
          style={{
            fontSize: 10.5,
            fontWeight: '800',
            color: '#6B6963',
            letterSpacing: 1.0,
            textTransform: 'uppercase',
            marginBottom: 8,
            marginTop: 4,
            paddingHorizontal: 4,
          }}
        >
          Questions fréquentes
        </Text>
        <STGroup>
          {FAQ_ITEMS.map((f, i) => {
            const isOpen = openIndex === i;
            const isLast = i === FAQ_ITEMS.length - 1;
            return (
              <View
                key={i}
                style={{
                  borderBottomWidth: isLast ? 0 : 1,
                  borderBottomColor: '#E2E0DA',
                }}
              >
                <TouchableOpacity
                  onPress={() => setOpenIndex(isOpen ? null : i)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: '#1C1A17' }}>
                    {f.q}
                  </Text>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color="#6B6963"
                  />
                </TouchableOpacity>
                {isOpen && (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
                    <Text style={{ fontSize: 12.5, color: '#6B6963', lineHeight: 19 }}>
                      {f.a}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </STGroup>

        {/* Group: Légal */}
        <Text
          style={{
            fontSize: 10.5,
            fontWeight: '800',
            color: '#6B6963',
            letterSpacing: 1.0,
            textTransform: 'uppercase',
            marginBottom: 8,
            marginTop: 4,
            paddingHorizontal: 4,
          }}
        >
          Légal
        </Text>
        <STGroup>
          <STRow
            label="Conditions d'utilisation"
            icon="document-text-outline"
            onPress={() => showAlert("Conditions d'utilisation", "Disponibles sur ziko.app/terms")}
          />
          <STRow
            label="Politique de confidentialité"
            icon="shield-checkmark-outline"
            onPress={() => showAlert('Politique de confidentialité', 'Disponible sur ziko.app/privacy')}
          />
          <STRow
            label="Mentions légales"
            icon="information-circle-outline"
            onPress={() => showAlert('Mentions légales', 'Ziko SAS — SIRET disponible sur ziko.app/legal')}
            isLast
          />
        </STGroup>

        {/* Group: App */}
        <Text
          style={{
            fontSize: 10.5,
            fontWeight: '800',
            color: '#6B6963',
            letterSpacing: 1.0,
            textTransform: 'uppercase',
            marginBottom: 8,
            marginTop: 4,
            paddingHorizontal: 4,
          }}
        >
          App
        </Text>
        <STGroup>
          <STRow
            label="Version"
            icon="apps-outline"
            right={
              <Text style={{ fontSize: 13, color: '#6B6963' }}>1.0.0</Text>
            }
          />
          <STRow
            label="Build"
            icon="code-slash-outline"
            right={
              <Text style={{ fontSize: 13, color: '#6B6963' }}>100</Text>
            }
            isLast
          />
        </STGroup>
      </ScrollView>
    </SafeAreaView>
  );
}
