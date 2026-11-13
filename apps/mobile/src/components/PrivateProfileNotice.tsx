// Etat explicite d'un profil prive vu par un non-ami (run5 P21 : aucune mention "Profil prive", l'ecran
// affichait 0 ami / 0 abonne / "Pas encore de niveau"). Le serveur (ziko_get_public_profile, migration
// 202612012702) renvoie le contrat vide avec is_private = true : on n'affiche JAMAIS de faux zeros.
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@ziko/plugin-sdk';

export const PRIVATE_PROFILE_TITLE = 'Ce profil est privé';
export const PRIVATE_PROFILE_BODY =
  "Seuls ses amis voient ses statistiques, ses badges et ses entraînements. Envoie une demande d'ami pour le suivre.";

export default function PrivateProfileNotice({ name }: { name?: string }) {
  const theme = useThemeStore((s) => s.theme);
  const first = (name ?? '').split(' ')[0];
  return (
    <View
      accessibilityRole="summary"
      style={{
        marginTop: 20,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        alignItems: 'center',
        gap: 8,
        shadowColor: '#1C1A17',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      <Ionicons name="lock-closed-outline" size={28} color={theme.muted} />
      <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text, textAlign: 'center' }}>{PRIVATE_PROFILE_TITLE}</Text>
      <Text style={{ fontSize: 14, lineHeight: 20, color: theme.muted, textAlign: 'center' }}>
        {first ? PRIVATE_PROFILE_BODY.replace('Seuls ses amis', `Seuls les amis de ${first}`) : PRIVATE_PROFILE_BODY}
      </Text>
    </View>
  );
}
