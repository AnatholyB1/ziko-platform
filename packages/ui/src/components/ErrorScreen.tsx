import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ErrorScreenVariant = 'generic' | 'network' | 'auth' | 'not-found';

interface ErrorScreenProps {
  variant: ErrorScreenVariant;
  onRetry?: () => void;
  onGoBack?: () => void;
}

const VARIANT_CONFIG: Record<ErrorScreenVariant, { icon: keyof typeof Ionicons.glyphMap; title: string; message: string }> = {
  'generic':   { icon: 'alert-circle-outline',  title: 'Une erreur est survenue',  message: "Quelque chose s'est mal passé. Réessaie." },
  'network':   { icon: 'cloud-offline-outline',  title: 'Pas de connexion',         message: 'Vérifie ta connexion internet et réessaie.' },
  'auth':      { icon: 'lock-closed-outline',    title: 'Session expirée',          message: 'Reconnecte-toi pour continuer.' },
  'not-found': { icon: 'compass-outline',        title: 'Page introuvable',         message: "Ce contenu n'existe plus ou a été déplacé." },
};

export function ErrorScreen({ variant, onRetry, onGoBack }: ErrorScreenProps) {
  const config = VARIANT_CONFIG[variant];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F6F3' }}>
      <View style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}>
        <View style={{
          width: 96,
          height: 96,
          borderRadius: 999,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#1C1A17',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 3,
        }}>
          <Ionicons name={config.icon} size={40} color="#6B6963" />
        </View>

        <Text style={{
          fontWeight: '800',
          fontSize: 20,
          color: '#1C1A17',
          textAlign: 'center',
          marginTop: 20,
          marginBottom: 8,
        }}>
          {config.title}
        </Text>

        <Text style={{
          fontSize: 15,
          color: '#6B6963',
          textAlign: 'center',
          lineHeight: 22,
        }}>
          {config.message}
        </Text>

        {onRetry ? (
          <TouchableOpacity
            onPress={onRetry}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#FF5C1A',
              borderRadius: 14,
              paddingHorizontal: 32,
              paddingVertical: 14,
              marginTop: 24,
            }}
          >
            <Text style={{ fontWeight: '700', color: '#FFFFFF', fontSize: 15 }}>
              Réessayer
            </Text>
          </TouchableOpacity>
        ) : null}

        {onGoBack ? (
          <TouchableOpacity
            onPress={onGoBack}
            activeOpacity={0.7}
            style={{ marginTop: 8, paddingVertical: 8 }}
          >
            <Text style={{ fontWeight: '600', color: '#6B6963', fontSize: 14 }}>
              Retour
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export default ErrorScreen;
