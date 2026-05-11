import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../src/stores/themeStore';
import { showAlert } from '@ziko/plugin-sdk';

const FAQ_ITEMS = [
  {
    cat: "General",
    q: "Qu'est-ce que Ziko ?",
    a: "Ziko est une application de fitness extensible avec des plugins, un coaching IA et un suivi complet de tes entrainements, nutrition, sommeil et bien plus.",
  },
  {
    cat: "General",
    q: "L'app fonctionne-t-elle hors connexion ?",
    a: "Les fonctions de base (timer, logs locaux) fonctionnent hors connexion. La synchronisation et l'IA necessitent une connexion internet.",
  },
  {
    cat: "General",
    q: "Comment mettre a jour l'application ?",
    a: "Les mises a jour sont disponibles sur l'App Store (iOS) ou le Play Store (Android). Active les mises a jour automatiques pour ne rien rater.",
  },
  {
    cat: "Credits IA",
    q: "C'est quoi les credits IA ?",
    a: "Les credits IA te permettent d'utiliser le coach intelligent. Tu en gagnes en completant tes habitudes, seances et defis. Tu peux aussi en obtenir en parrainant des amis.",
  },
  {
    cat: "Credits IA",
    q: "Comment gagner des credits gratuitement ?",
    a: "Complete tes habitudes quotidiennes (+5 credits), enregistre une seance (+10), atteins ton objectif hydratation (+3), ou parraine un ami (+50 credits par inscription).",
  },
  {
    cat: "Credits IA",
    q: "Les credits expirent-ils ?",
    a: "Non, tes credits n'expirent jamais. Tu peux les accumuler sans limite et les utiliser quand tu veux.",
  },
  {
    cat: "Plugins",
    q: "Comment activer un plugin ?",
    a: "Va dans Profil > Modules et active les plugins que tu veux utiliser. Ils apparaitront automatiquement dans la navigation et le dashboard.",
  },
  {
    cat: "Plugins",
    q: "Puis-je desactiver un plugin sans perdre mes donnees ?",
    a: "Oui. Desactiver un plugin le masque simplement dans l'interface. Toutes tes donnees sont conservees et accessibles si tu le reactives.",
  },
  {
    cat: "Plugins",
    q: "Combien de plugins puis-je activer simultanement ?",
    a: "Il n'y a pas de limite. Tu peux activer tous les 17 plugins en meme temps, mais nous recommandons de n'activer que ceux que tu utilises vraiment.",
  },
  {
    cat: "Compte",
    q: "Comment supprimer mon compte ?",
    a: "Va dans Profil > Parametres > Zone dangereuse > Supprimer le compte. Cette action est irreversible et supprime toutes tes donnees.",
  },
  {
    cat: "Compte",
    q: "Mes donnees sont-elles securisees ?",
    a: "Oui. Toutes les donnees sont chiffrees au repos (AES-256) et en transit (TLS 1.3). Nous respectons le RGPD et ne vendons jamais tes donnees.",
  },
  {
    cat: "Compte",
    q: "Comment changer mon mot de passe ?",
    a: "Sur l'ecran de connexion, appuie sur \"Mot de passe oublie\". Un lien de reinitialisation sera envoye a ton adresse email.",
  },
];

export default function HelpScreen() {
  const theme = useThemeStore((s) => s.theme);
  const [search, setSearch] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filtered = FAQ_ITEMS.filter(
    (f) =>
      !search ||
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={theme.muted} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: theme.text }}>
          Aide & support
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        {/* Search */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: theme.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.border,
            marginBottom: 16,
          }}
        >
          <Ionicons name="search-outline" size={16} color={theme.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Cherche une question..."
            placeholderTextColor={theme.muted}
            style={{ flex: 1, fontSize: 13.5, color: theme.text }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={theme.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Quick contact */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
          <TouchableOpacity
            onPress={() => showAlert('Chat support', 'Notre équipe te répondra en moins d\'1h.')}
            style={{
              flex: 1,
              backgroundColor: theme.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 14,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: `${theme.info}22`,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
              }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={15} color={theme.info} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>
              Chat support
            </Text>
            <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>Réponse &lt; 1h</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => showAlert('Email', 'Contacte-nous à support@ziko.app')}
            style={{
              flex: 1,
              backgroundColor: theme.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 14,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: `${theme.primary}22`,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
              }}
            >
              <Ionicons name="help-circle-outline" size={15} color={theme.primary} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>Email</Text>
            <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>support@ziko.app</Text>
          </TouchableOpacity>
        </View>

        {/* FAQ label */}
        <Text
          style={{
            fontSize: 10.5,
            fontWeight: '800',
            color: theme.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            paddingHorizontal: 4,
            paddingBottom: 8,
            paddingTop: 4,
          }}
        >
          Questions frequentes
        </Text>

        {/* FAQ list */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            overflow: 'hidden',
            marginBottom: 20,
          }}
        >
          {filtered.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: theme.muted }}>Aucun resultat. </Text>
              <TouchableOpacity
                onPress={() => showAlert('Support', 'Contacte-nous a support@ziko.app')}
              >
                <Text style={{ fontSize: 12, color: theme.primary, fontWeight: '700' }}>
                  Contacter le support ?
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            filtered.map((f, i) => {
              const isOpen = openIndex === i;
              return (
                <View
                  key={i}
                  style={{
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: theme.border,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setOpenIndex(isOpen ? null : i)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 14,
                      paddingHorizontal: 12,
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{ flex: 1, fontSize: 13, fontWeight: '600', color: theme.text }}
                    >
                      {f.q}
                    </Text>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={theme.muted}
                    />
                  </TouchableOpacity>
                  {isOpen && (
                    <View style={{ paddingHorizontal: 12, paddingBottom: 14 }}>
                      <Text
                        style={{
                          fontSize: 12.5,
                          color: theme.muted,
                          lineHeight: 19,
                        }}
                      >
                        {f.a}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        <Text style={{ textAlign: 'center', fontSize: 11, color: theme.muted }}>
          Tu n'as pas trouve ? On repond en moins d'1h.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
