import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type EmptyStateVariant = 'no-data' | 'error' | 'offline' | 'no-results';

interface EmptyStateProps {
  variant: EmptyStateVariant;
  title: string;
  message?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

const VARIANT_CONFIG: Record<EmptyStateVariant, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  'no-data':    { icon: 'file-tray-outline', color: '#E2E0DA' },
  'error':      { icon: 'warning-outline',   color: '#F59E0B' },
  'offline':    { icon: 'wifi-outline',      color: '#6B6963' },
  'no-results': { icon: 'search-outline',    color: '#E2E0DA' },
};

export function EmptyState({ variant, title, message, ctaLabel, onCta }: EmptyStateProps) {
  const config = VARIANT_CONFIG[variant];

  return (
    <View style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      paddingHorizontal: 24,
    }}>
      <View style={{
        width: 80,
        height: 80,
        borderRadius: 999,
        backgroundColor: '#F7F6F3',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E0DA',
      }}>
        <Ionicons name={config.icon} size={36} color={config.color} />
      </View>

      <Text style={{
        fontWeight: '700',
        fontSize: 17,
        color: '#1C1A17',
        textAlign: 'center',
        marginBottom: 4,
      }}>
        {title}
      </Text>

      {message ? (
        <Text style={{
          fontSize: 14,
          color: '#6B6963',
          textAlign: 'center',
          lineHeight: 20,
        }}>
          {message}
        </Text>
      ) : null}

      {ctaLabel && onCta ? (
        <TouchableOpacity
          onPress={onCta}
          activeOpacity={0.8}
          style={{
            backgroundColor: '#FF5C1A',
            borderRadius: 12,
            paddingHorizontal: 24,
            paddingVertical: 12,
            marginTop: 16,
          }}
        >
          <Text style={{ fontWeight: '700', color: '#FFFFFF', fontSize: 14 }}>
            {ctaLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default EmptyState;
