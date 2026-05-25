import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';

// TODO: mettre à jour avec les infos de l'entité légale réelle avant soumission stores

type Tab = 'legal' | 'cgu' | 'privacy';

function LegalHeader() {
  const theme = useThemeStore((s) => s.theme);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
    }}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          width: 36, height: 36, borderRadius: 12,
          backgroundColor: 'rgba(28,26,23,0.06)',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="chevron-back" size={16} color={theme.text} />
      </TouchableOpacity>
      <Text style={{ fontSize: 22, fontWeight: '700', color: theme.text }}>Mentions légales</Text>
    </View>
  );
}

function SectionHeading({ children }: { children: string }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <Text style={{
      fontSize: 15, fontWeight: '700', color: theme.text,
      marginTop: 20, marginBottom: 6,
    }}>
      {children}
    </Text>
  );
}

function BodyText({ children }: { children: string }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20 }}>
      {children}
    </Text>
  );
}

function BulletItem({ children }: { children: string }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20, paddingLeft: 8 }}>
      {'• '}{children}
    </Text>
  );
}

function MutedText({ children }: { children: string }) {
  const theme = useThemeStore((s) => s.theme);
  return (
    <Text style={{ fontSize: 12, color: theme.muted, marginTop: 16 }}>
      {children}
    </Text>
  );
}

function MentionsLegalesContent() {
  return (
    <>
      <SectionHeading>Éditeur du site</SectionHeading>
      {/* TODO: entité légale réelle — SIRET et forme juridique à compléter avant soumission stores */}
      <BulletItem>Nom : Ziko</BulletItem>
      <BulletItem>Forme juridique : [À COMPLÉTER — ex : Ziko SAS, RCS Paris]</BulletItem>
      <BulletItem>SIRET : [À COMPLÉTER]</BulletItem>
      <BulletItem>Siège social : [À COMPLÉTER]</BulletItem>
      <BulletItem>Directeur de la publication : BRICON Anatholy</BulletItem>
      <BulletItem>Email de contact : contact@ziko-app.com</BulletItem>

      <SectionHeading>Hébergement</SectionHeading>
      <BulletItem>Hébergeur : Vercel Inc.</BulletItem>
      <BulletItem>Adresse : 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis</BulletItem>
      <BulletItem>Site : https://vercel.com</BulletItem>
      <BulletItem>Base de données : Supabase (Europe West region)</BulletItem>

      <SectionHeading>Propriété intellectuelle</SectionHeading>
      <BodyText>
        L'ensemble des contenus présents sur cette application (textes, images, graphismes, logos, icônes, sons, logiciels) est la propriété exclusive de Ziko ou de ses partenaires, et est protégé par les lois françaises et internationales relatives à la propriété intellectuelle. Toute reproduction non autorisée est interdite.
      </BodyText>

      <SectionHeading>Données personnelles</SectionHeading>
      <BodyText>
        Ziko s'engage à protéger la vie privée de ses utilisateurs conformément au RGPD du 27 avril 2016. Vous disposez d'un droit d'accès, de rectification, d'effacement et de portabilité de vos données personnelles. Contact : contact@ziko-app.com.
      </BodyText>

      <MutedText>Dernière mise à jour : mars 2026</MutedText>
    </>
  );
}

function CguContent() {
  const theme = useThemeStore((s) => s.theme);
  return (
    <>
      <SectionHeading>1. Objet</SectionHeading>
      <BodyText>
        Les présentes Conditions Générales d'Utilisation définissent les modalités d'utilisation de l'application mobile Ziko et du site ziko-app.com.
      </BodyText>

      <SectionHeading>2. Acceptation des CGU</SectionHeading>
      <BodyText>
        L'utilisation de l'application implique l'acceptation pleine et entière des présentes CGU. En créant un compte ou en utilisant l'application, vous déclarez avoir pris connaissance des présentes CGU et les accepter sans réserve.
      </BodyText>

      <SectionHeading>3. Description du service</SectionHeading>
      <BodyText>{'Ziko est une application de suivi fitness et de coaching par IA proposant :'}</BodyText>
      <View style={{ marginTop: 6 }}>
        <BulletItem>Suivi des séances d'entraînement et programmes personnalisés</BulletItem>
        <BulletItem>Nutrition (calories, macronutriments, hydratation)</BulletItem>
        <BulletItem>Gestion des habitudes quotidiennes et objectifs fitness</BulletItem>
        <BulletItem>Suivi du sommeil et de la récupération</BulletItem>
        <BulletItem>Coach IA personnalisé propulsé par Claude (Anthropic)</BulletItem>
        <BulletItem>Suivi cardio avec GPS (course, cyclisme)</BulletItem>
        <BulletItem>Journal d'humeur, d'énergie et de stress</BulletItem>
        <BulletItem>Fonctionnalités communautaires (défis, classements)</BulletItem>
      </View>

      <SectionHeading>4. Compte utilisateur</SectionHeading>
      <BodyText>
        Pour accéder au Service, vous devez créer un compte avec une adresse email valide. Vous êtes responsable de la confidentialité de vos identifiants. Tout accès non autorisé doit être signalé à contact@ziko-app.com.
      </BodyText>

      <SectionHeading>5. Coaching IA — Avertissement important</SectionHeading>
      <View style={{
        backgroundColor: 'rgba(255,92,26,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,92,26,0.3)',
        borderRadius: 12,
        padding: 12,
        marginTop: 4,
      }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, marginBottom: 6 }}>
          Le coaching IA n'est pas un avis médical
        </Text>
        <Text style={{ fontSize: 13, color: theme.text, lineHeight: 20 }}>
          Le coaching IA de Ziko est un outil d'assistance et de motivation. Il ne constitue en aucun cas un avis médical, un diagnostic, ou un traitement. L'IA n'est pas un professionnel de santé. Les recommandations peuvent être inexactes pour certaines conditions médicales. Consultez un professionnel de santé avant tout programme d'exercice.
        </Text>
      </View>

      <SectionHeading>6. Données personnelles</SectionHeading>
      <BodyText>
        Le traitement de vos données est régi par notre Politique de confidentialité (voir onglet 'Confidentialité').
      </BodyText>

      <SectionHeading>7. Propriété intellectuelle</SectionHeading>
      <BodyText>
        Les éléments du Service (code, design, textes, logos) sont la propriété de Ziko. Les données générées par l'utilisateur restent sa propriété. Ziko bénéficie d'une licence d'utilisation pour le fonctionnement du Service.
      </BodyText>

      <SectionHeading>8. Limitation de responsabilité</SectionHeading>
      <BodyText>
        Le Service est fourni "en l'état". Ziko ne saurait être tenu responsable des dommages directs ou indirects résultant d'une perte de données ou d'une interruption de service.
      </BodyText>

      <SectionHeading>9. Modification des CGU</SectionHeading>
      <BodyText>
        Ziko se réserve le droit de modifier les CGU. Les modifications seront notifiées par email ou via l'application.
      </BodyText>

      <SectionHeading>10. Droit applicable</SectionHeading>
      {/* TODO: préciser le tribunal compétent avant soumission stores */}
      <BodyText>
        Les présentes CGU sont soumises au droit français. En cas de litige, les parties tenteront une résolution amiable. À défaut, les tribunaux compétents [À COMPLÉTER — tribunal de Paris] seront seuls compétents.
      </BodyText>

      <MutedText>Dernière mise à jour : mars 2026</MutedText>
    </>
  );
}

function ConfidentialiteContent() {
  return (
    <>
      <SectionHeading>1. Introduction</SectionHeading>
      <BodyText>
        Ziko collecte et traite des données personnelles dans le cadre de l'application mobile Ziko et du site ziko-app.com. Ziko est responsable du traitement. Dernière mise à jour : mars 2026.
      </BodyText>

      <SectionHeading>2. Données collectées</SectionHeading>
      <BodyText>{'Nous collectons les catégories de données suivantes :'}</BodyText>
      <View style={{ marginTop: 6 }}>
        <BulletItem>Identification : email, nom, âge</BulletItem>
        <BulletItem>Santé : poids, mesures corporelles, qualité du sommeil, journal d'humeur et d'énergie</BulletItem>
        <BulletItem>Activité physique : séances, habitudes, objectifs, programmes personnalisés</BulletItem>
        <BulletItem>Géolocalisation GPS : sessions cardio (course, cyclisme) — avec consentement explicite uniquement</BulletItem>
        <BulletItem>Nutritionnelles : repas, calories, macros (protéines, glucides, lipides), hydratation</BulletItem>
        <BulletItem>Interactions IA : conversations avec le coach IA, contexte utilisateur (profil, historique de séances, objectifs)</BulletItem>
      </View>

      <SectionHeading>3. Finalités du traitement</SectionHeading>
      <View style={{ marginTop: 4 }}>
        <BulletItem>Fonctionnement de l'application : suivi de vos activités, nutrition, sommeil, habitudes</BulletItem>
        <BulletItem>Personnalisation du coaching IA : recommandations et programmes adaptés à votre profil</BulletItem>
        <BulletItem>Amélioration du service : analyse agrégée et anonymisée</BulletItem>
        <BulletItem>Gestion du compte : authentification, communication de service</BulletItem>
      </View>

      <SectionHeading>4. Base légale</SectionHeading>
      <View style={{ marginTop: 4 }}>
        <BulletItem>Consentement (Art. 6.1.a) : données de santé et géolocalisation GPS (données sensibles Art. 9 RGPD) — retirable à tout moment</BulletItem>
        <BulletItem>Exécution du contrat (Art. 6.1.b) : gestion du compte et authentification</BulletItem>
        <BulletItem>Intérêt légitime (Art. 6.1.f) : amélioration du service sur données agrégées anonymisées</BulletItem>
      </View>

      <SectionHeading>5. Sous-traitants</SectionHeading>
      <View style={{ marginTop: 4 }}>
        <BulletItem>Anthropic (San Francisco, USA) — coaching IA via API Claude</BulletItem>
        <BulletItem>Supabase (Singapour) — base de données et authentification</BulletItem>
        <BulletItem>Vercel (USA) — hébergement web</BulletItem>
        <BulletItem>Expo/EAS — distribution mobile App Store et Google Play</BulletItem>
      </View>
      <View style={{ marginTop: 6 }}>
        <BodyText>
          Transferts encadrés par clauses contractuelles types (CCT) de la Commission européenne et/ou Data Privacy Framework (DPF) UE-États-Unis.
        </BodyText>
      </View>

      <SectionHeading>6. Durée de conservation</SectionHeading>
      <View style={{ marginTop: 4 }}>
        <BulletItem>Compte actif : données conservées tant que le compte est actif</BulletItem>
        <BulletItem>Suppression de compte : effacement sous 30 jours</BulletItem>
        <BulletItem>Conversations IA : 12 mois puis anonymisation ou suppression</BulletItem>
        <BulletItem>GPS : supprimé avec la session ou lors de la suppression du compte</BulletItem>
      </View>

      <SectionHeading>7. Vos droits (RGPD)</SectionHeading>
      <View style={{ marginTop: 4 }}>
        <BulletItem>Accès (Art. 15) : obtenir une copie de vos données personnelles</BulletItem>
        <BulletItem>Rectification (Art. 16) : corriger des données inexactes</BulletItem>
        <BulletItem>Effacement (Art. 17) : demander la suppression de vos données</BulletItem>
        <BulletItem>Limitation (Art. 18) : suspendre temporairement le traitement</BulletItem>
        <BulletItem>Portabilité (Art. 20) : recevoir vos données en format lisible par machine</BulletItem>
        <BulletItem>Opposition (Art. 21) : vous opposer au traitement pour motifs légitimes</BulletItem>
      </View>
      <View style={{ marginTop: 8 }}>
        <BodyText>Pour exercer ces droits : contact@ziko-app.com. Délai de réponse : 30 jours.</BodyText>
      </View>
      <View style={{ marginTop: 6 }}>
        <BodyText>Réclamation CNIL : www.cnil.fr</BodyText>
      </View>

      <SectionHeading>8. Sécurité</SectionHeading>
      <View style={{ marginTop: 4 }}>
        <BulletItem>Chiffrement des données en transit (HTTPS/TLS)</BulletItem>
        <BulletItem>Row Level Security sur la base de données PostgreSQL</BulletItem>
        <BulletItem>Authentification sécurisée via Supabase Auth avec tokens JWT</BulletItem>
        <BulletItem>Privacy by design — accès limité au strict nécessaire</BulletItem>
      </View>

      <SectionHeading>9. Cookies</SectionHeading>
      <BodyText>
        L'application mobile n'utilise pas de cookies. Le site ziko-app.com utilise uniquement des cookies fonctionnels essentiels (session, langue) — pas de cookies publicitaires ni de tracking tiers.
      </BodyText>

      <SectionHeading>10. Modifications</SectionHeading>
      <BodyText>
        Toute modification substantielle sera notifiée par email ou notification in-app. La date de mise à jour figurant en haut de ce document sera actualisée.
      </BodyText>

      <MutedText>Dernière mise à jour : mars 2026</MutedText>
    </>
  );
}

export default function LegalScreen() {
  const theme = useThemeStore((s) => s.theme);
  const [tab, setTab] = useState<Tab>('legal');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'legal', label: 'Mentions légales' },
    { id: 'cgu', label: 'CGU' },
    { id: 'privacy', label: 'Confidentialité' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <LegalHeader />

      {/* Tab bar */}
      <View style={{
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        backgroundColor: theme.surface,
      }}>
        {tabs.map((t) => {
          const isActive = tab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setTab(t.id)}
              activeOpacity={0.7}
              style={{
                flex: 1,
                paddingVertical: 8,
                alignItems: 'center',
                borderBottomWidth: 2,
                borderBottomColor: isActive ? '#FF5C1A' : 'transparent',
              }}
            >
              <Text style={{
                fontSize: 12,
                fontWeight: '700',
                textAlign: 'center',
                color: isActive ? theme.text : theme.muted,
              }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        key={tab}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        {tab === 'legal' && <MentionsLegalesContent />}
        {tab === 'cgu' && <CguContent />}
        {tab === 'privacy' && <ConfidentialiteContent />}
      </ScrollView>
    </SafeAreaView>
  );
}
