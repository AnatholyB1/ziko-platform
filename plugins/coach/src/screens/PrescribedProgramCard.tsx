import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STATUS_LABEL, type PrescribedView } from './prescribedProgram';

export interface PrescribedProgramCardProps {
  loading: boolean;
  error: boolean;
  view: PrescribedView | null;
  /** Couleur de fond du bouton plein (getActionPrimary). */
  actionColor: string;
  resuming: boolean;
  onRetry: () => void;
  onOpen: (programId: string) => void;
  onResume: (view: PrescribedView) => void;
}

const CARD = {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  borderWidth: 1,
  borderColor: '#E2E0DA',
  padding: 16,
  marginTop: 16,
  shadowColor: '#1C1A17',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};

/** Carte "Programme de ton coach" (P25, MCOA-04) : chargement, erreur, vide, actif / remplace / disponible. */
export default function PrescribedProgramCard({
  loading,
  error,
  view,
  actionColor,
  resuming,
  onRetry,
  onOpen,
  onResume,
}: PrescribedProgramCardProps) {
  return (
  <View style={CARD}>
    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1A17' }}>Programme de ton coach</Text>

    {loading && (
      <View accessibilityLabel="Chargement du programme" style={{ marginTop: 12, gap: 8 }}>
        <View style={{ height: 16, width: '60%', borderRadius: 8, backgroundColor: '#E2E0DA' }} />
        <View style={{ height: 14, width: '40%', borderRadius: 7, backgroundColor: '#E2E0DA' }} />
      </View>
    )}

    {!loading && error && (
      <View style={{ marginTop: 12 }}>
        <Text style={{ fontSize: 14, color: '#6B6963' }}>Impossible de charger le programme</Text>
        <TouchableOpacity
          onPress={() => onRetry()}
          accessibilityRole="button"
          style={{ marginTop: 8, minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: actionColor }}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    )}

    {!loading && !error && !view && (
      <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="clipboard-outline" size={20} color="#6B6963" />
        <Text style={{ flex: 1, fontSize: 14, color: '#6B6963' }}>
          Ton coach n'a pas encore prescrit de programme.
        </Text>
      </View>
    )}

    {!loading && !error && view && (
      <View style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons
            name={view.status === 'active' ? 'checkmark-circle' : view.status === 'replaced' ? 'swap-horizontal' : 'time-outline'}
            size={16}
            color={view.status === 'active' ? '#16A34A' : '#6B6963'}
          />
          <Text style={{ fontSize: 14, color: view.status === 'active' ? '#16A34A' : '#6B6963' }}>
            {STATUS_LABEL[view.status]}
          </Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1C1A17', marginTop: 8 }}>{view.name}</Text>
        {view.subtitle ? (
          <Text style={{ fontSize: 14, color: '#6B6963', marginTop: 2 }}>{view.subtitle}</Text>
        ) : null}

        <TouchableOpacity
          onPress={() => onOpen(view.id)}
          accessibilityRole="button"
          style={{ marginTop: 16, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#E2E0DA', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#1C1A17' }}>Voir le programme</Text>
        </TouchableOpacity>

        {view.status !== 'active' && (
          <TouchableOpacity
            onPress={() => onResume(view)}
            disabled={resuming}
            accessibilityRole="button"
            style={{ marginTop: 8, minHeight: 48, borderRadius: 14, backgroundColor: actionColor, alignItems: 'center', justifyContent: 'center' }}
          >
            {resuming ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Reprendre ce programme</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    )}
  </View>
  );
}
