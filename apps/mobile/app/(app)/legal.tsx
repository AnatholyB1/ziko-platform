import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../src/stores/themeStore';
import type { ThemePalette } from '@ziko/plugin-sdk';

type DocKey = 'cgu' | 'privacy' | 'cookies' | 'licenses';

const DOCS: { key: DocKey; title: string; date: string }[] = [
  { key: 'cgu', title: 'Conditions generales', date: 'MaJ 12 oct. 2025' },
  { key: 'privacy', title: 'Politique de confidentialite', date: 'MaJ 12 oct. 2025' },
  { key: 'cookies', title: 'Cookies & traceurs', date: 'MaJ 1er sept. 2025' },
  { key: 'licenses', title: 'Licences open source', date: '247 dependances' },
];

const DOC_SECTIONS = [
  {
    h: '1. Preambule',
    p: 'Le present document definit les conditions dans lesquelles Ziko SAS met a disposition son application mobile et ses services associes.',
  },
  {
    h: '2. Acceptation',
    p: "L'utilisation de Ziko vaut acceptation pleine et entiere des presentes conditions. Si tu n'acceptes pas, tu ne peux pas utiliser le service.",
  },
  {
    h: '3. Donnees personnelles',
    p: 'Conformement au RGPD, tes donnees sont collectees pour la stricte finalite du service. Tu disposes d\'un droit d\'acces, de rectification et de suppression.',
  },
  {
    h: '4. Securite',
    p: 'Les donnees sont chiffrees au repos (AES-256) et en transit (TLS 1.3). Les mots de passe sont hashes avec Argon2id.',
  },
  {
    h: '5. Conservation',
    p: 'Tes donnees sont conservees tant que ton compte est actif, puis 12 mois apres suppression pour les seules obligations legales (facturation).',
  },
  {
    h: '6. Propriete intellectuelle',
    p: "L'ensemble des elements graphiques, sons et textes restent la propriete exclusive de Ziko SAS, a l'exception du contenu utilisateur.",
  },
  {
    h: '7. Responsabilite',
    p: 'Ziko fournit des recommandations a titre informatif. Consulte un professionnel de sante avant tout programme intense.',
  },
  {
    h: '8. Modifications',
    p: 'Ces conditions peuvent evoluer. Tu seras notifie 30 jours avant l\'entree en vigueur de toute modification substantielle.',
  },
];

function LegalDocScreen({
  title,
  date,
  onBack,
  theme,
}: {
  title: string;
  date: string;
  onBack: () => void;
  theme: ThemePalette;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={onBack} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={theme.muted} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: theme.text }}>{title}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
        <Text
          style={{
            fontSize: 11,
            color: theme.muted,
            fontWeight: '700',
            letterSpacing: 0.6,
            marginBottom: 18,
          }}
        >
          {date}
        </Text>
        {DOC_SECTIONS.map((s, i) => (
          <View key={i} style={{ marginBottom: 18 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: theme.text,
                marginBottom: 6,
              }}
            >
              {s.h}
            </Text>
            <Text style={{ fontSize: 13, color: theme.muted, lineHeight: 21 }}>{s.p}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function LegalScreen() {
  const theme = useThemeStore((s) => s.theme);
  const [activeDoc, setActiveDoc] = useState<DocKey | null>(null);

  const currentDoc = activeDoc ? DOCS.find((d) => d.key === activeDoc) : null;

  if (currentDoc) {
    return (
      <LegalDocScreen
        title={currentDoc.title}
        date={currentDoc.date}
        onBack={() => setActiveDoc(null)}
        theme={theme}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="chevron-back" size={24} color={theme.muted} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: theme.text }}>
          Mentions legales
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        {/* Doc list */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            overflow: 'hidden',
          }}
        >
          {DOCS.map((doc, i) => (
            <TouchableOpacity
              key={doc.key}
              onPress={() => setActiveDoc(doc.key)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 14,
                paddingHorizontal: 12,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: theme.border,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  backgroundColor: `${theme.text}10`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Ionicons name="document-text-outline" size={14} color={theme.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13.5, fontWeight: '600', color: theme.text }}>
                  {doc.title}
                </Text>
                <Text style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>{doc.date}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={theme.muted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Company info */}
        <Text
          style={{
            marginTop: 20,
            fontSize: 11.5,
            color: theme.muted,
            textAlign: 'center',
            lineHeight: 20,
          }}
        >
          {'Ziko SAS · 12 rue de la Republique, 75011 Paris\nSIRET 902 481 327 00018 · TVA FR47902481327'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
