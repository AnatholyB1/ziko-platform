import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';

// ── Header maison ──────────────────────────────────────────────
function HelpHeader({ onBack }: { onBack: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
    }}>
      <TouchableOpacity
        onPress={onBack}
        style={{
          width: 36, height: 36, borderRadius: 12,
          backgroundColor: 'rgba(28,26,23,0.06)',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="chevron-back" size={16} color={theme.text} />
      </TouchableOpacity>
      <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text }}>Centre d'aide</Text>
    </View>
  );
}

// ── Données FAQ ────────────────────────────────────────────────
const FAQ_GROUPS = [
  {
    title: 'DÉMARRAGE',
    items: [
      {
        id: 'start_1',
        q: 'Comment créer mon programme ?',
        a: "Va dans l'onglet Séances, appuie sur 'Nouveau programme' et laisse le Coach IA générer un plan adapté à ton niveau et tes objectifs. Tu peux aussi créer un programme manuellement en ajoutant des séances jour par jour.",
      },
      {
        id: 'start_2',
        q: 'Configurer mon profil',
        a: "Dans l'onglet Profil, appuie sur 'Modifier' pour mettre à jour ton nom, ta bio et ton objectif. Renseigne ton âge, ton poids et ta taille dans les paramètres pour que le Coach IA te donne des recommandations précises.",
      },
      {
        id: 'start_3',
        q: 'Connecter mes appareils',
        a: "Va dans Paramètres > Intégrations pour connecter Apple Health, Apple Watch ou d'autres appareils. Sur iOS, autorise l'accès à la Santé dans Réglages > Confidentialité > Santé.",
      },
    ],
  },
  {
    title: 'SÉANCES',
    items: [
      {
        id: 'session_1',
        q: 'Comment enregistrer une séance ?',
        a: "Appuie sur le bouton + dans l'onglet Séances. Sélectionne ou crée ton programme, puis commence la séance. Enregistre chaque série avec le poids et les répétitions. Termine avec le bouton 'Finir la séance'.",
      },
      {
        id: 'session_2',
        q: "Qu'est-ce que le RPE ?",
        a: "Le RPE (Rate of Perceived Exertion) est une échelle de 1 à 10 qui mesure ton effort perçu. RPE 10 = effort maximal. Le plugin RPE t'aide à calculer ton 1RM estimé et tes zones d'entraînement. Utilise-le pour calibrer tes charges de manière intelligente.",
      },
      {
        id: 'session_3',
        q: 'Synchronisation avec ma montre',
        a: "Les montres Apple Watch se synchronisent via Apple Health. Assure-toi que l'intégration Apple Health est active dans Paramètres > Intégrations. Les données de santé (pas, FC, sommeil) sont importées automatiquement.",
      },
    ],
  },
  {
    title: 'ABONNEMENT',
    items: [
      {
        id: 'sub_1',
        q: 'Gérer mon abonnement',
        a: "Ton abonnement est géré directement par l'App Store (iOS) ou le Play Store (Android). Pour modifier ou annuler, ouvre les Réglages de ton téléphone > [Ton nom] > Abonnements (iOS) ou Play Store > Abonnements (Android).",
      },
      {
        id: 'sub_2',
        q: 'Annuler mon abonnement',
        a: "Pour annuler, va dans les Réglages de ton iPhone > [Ton nom] > Abonnements > Ziko > Annuler l'abonnement. Sur Android : Play Store > Menu > Abonnements > Ziko > Annuler. L'accès Premium reste actif jusqu'à la fin de la période payée.",
      },
      {
        id: 'sub_3',
        q: 'Politique de remboursement',
        a: "Les remboursements sont traités par Apple ou Google selon leurs politiques respectives. Pour iOS, contacte le support Apple via reportaproblem.apple.com. Pour Android, contacte le support Google Play dans les 48h suivant l'achat.",
      },
    ],
  },
  {
    title: 'COMPTE',
    items: [
      {
        id: 'account_1',
        q: 'Supprimer mon compte',
        a: "Va dans Paramètres > Compte > Supprimer le compte. Tes données seront effacées dans les 30 jours suivant la suppression, conformément à notre politique de confidentialité. Cette action est irréversible.",
      },
      {
        id: 'account_2',
        q: 'Exporter mes données',
        a: "L'export de données est disponible sur la version web de Ziko (ziko-app.com). Connecte-toi et accède à la section 'Mon compte' pour télécharger une copie de tes données au format JSON.",
      },
      {
        id: 'account_3',
        q: 'Confidentialité',
        a: "Ziko respecte le RGPD. Tes données de santé ne sont jamais revendues. Tu peux contrôler la visibilité de ton profil dans Paramètres > Sécurité & Confidentialité. Pour exercer tes droits RGPD (accès, rectification, suppression), contacte contact@ziko-app.com.",
      },
      {
        id: 'account_4',
        q: 'Contacter le support',
        a: "Pour toute question, envoie un email à support@ziko.app. Délai de réponse : 48h ouvrées. Pour les bugs, utilise le bouton rapport de bug (icône dans l'interface) qui envoie automatiquement le contexte technique.",
      },
    ],
  },
];

// ── Écran principal ────────────────────────────────────────────
export default function HelpScreen() {
  const theme = useThemeStore((s) => s.theme);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <HelpHeader onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 100 }}>
        {FAQ_GROUPS.map((group) => (
          <View key={group.title} style={{ marginBottom: 24 }}>
            {/* Section label */}
            <Text style={{
              fontSize: 12, fontWeight: '700', letterSpacing: 1.1,
              textTransform: 'uppercase', color: theme.muted,
              paddingHorizontal: 4, paddingBottom: 8, paddingTop: 4,
            }}>
              {group.title}
            </Text>

            {/* Card */}
            <View style={{
              backgroundColor: theme.surface, borderRadius: 12,
              shadowColor: '#1C1A17', shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
              overflow: 'hidden',
            }}>
              {group.items.map((item, index) => {
                const isOpen = expanded.has(item.id);
                const isLast = index === group.items.length - 1;
                return (
                  <View key={item.id}>
                    {/* Séparateur (sauf premier) */}
                    {index > 0 && (
                      <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 16 }} />
                    )}

                    {/* Ligne question */}
                    <TouchableOpacity
                      onPress={() => toggle(item.id)}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 12,
                        paddingVertical: 14, paddingHorizontal: 16,
                      }}
                    >
                      <Text style={{
                        flex: 1, fontSize: 14, fontWeight: '600', color: theme.text,
                        lineHeight: 20,
                      }}>
                        {item.q}
                      </Text>
                      <Ionicons
                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={theme.muted}
                      />
                    </TouchableOpacity>

                    {/* Réponse dépliable */}
                    {isOpen && (
                      <View style={{
                        paddingHorizontal: 16,
                        paddingBottom: 14,
                      }}>
                        <Text style={{
                          fontSize: 13, color: theme.muted, lineHeight: 20,
                        }}>
                          {item.a}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
