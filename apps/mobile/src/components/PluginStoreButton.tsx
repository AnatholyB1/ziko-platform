// Bouton d'action d'une carte du store. Un module OBLIGATOIRE (cadenas) reste PRESSABLE : le tap explique
// pourquoi il ne se desinstalle pas (run5 P25 MC-11 : `accessibilityState.disabled` rendait le bouton inerte,
// donc aucune alerte). Ne jamais le desactiver.
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '@ziko/plugin-sdk';
import { MANDATORY_ALERT_MESSAGE, MANDATORY_ALERT_TITLE } from '../lib/mandatoryPlugins';

export default function PluginStoreButton({
  isInstalled,
  mandatory,
  onInstall,
  onUninstall,
  primary,
  muted,
}: {
  isInstalled: boolean;
  mandatory: boolean;
  onInstall: () => void;
  onUninstall: () => void;
  primary: string;
  muted: string;
}) {
  const onPress = () => {
    if (mandatory) {
      showAlert(MANDATORY_ALERT_TITLE, MANDATORY_ALERT_MESSAGE);
      return;
    }
    (isInstalled ? onUninstall : onInstall)();
  };
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityHint={mandatory ? 'Module obligatoire, non désinstallable' : undefined}
      style={{
        minHeight: 44, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
        backgroundColor: isInstalled ? '#E2E0DA' : primary,
        flexShrink: 0,
      }}
    >
      {mandatory ? <Ionicons name="lock-closed-outline" size={14} color={muted} /> : null}
      <Text style={{ fontSize: 12, fontWeight: '700', color: isInstalled ? muted : '#FFFFFF' }}>
        {isInstalled ? (mandatory ? 'Obligatoire' : 'Installé') : 'Installer'}
      </Text>
    </TouchableOpacity>
  );
}
