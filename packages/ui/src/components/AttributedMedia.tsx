import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTranslation } from '@ziko/plugin-sdk';

interface AttributedMediaProps {
  uri: string | null;
  size?: number;
  borderRadius?: number;
  showBadge?: boolean;
  credit?: string;
  fallbackIconSize?: number;
}

export function AttributedMedia({
  uri,
  size,
  borderRadius,
  showBadge = true,
  credit = '© Gym visual — https://gymvisual.com/',
  fallbackIconSize = 48,
}: AttributedMediaProps) {
  const { t } = useTranslation();
  const edge = Math.min(size ?? 180, 180);

  return (
    <View
      style={{
        width: edge,
        height: edge,
        borderRadius: borderRadius ?? 14,
        overflow: 'hidden',
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <>
          <Ionicons name="barbell-outline" size={fallbackIconSize} color="#6B6963" />
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: '#6B6963',
              marginTop: 8,
            }}
          >
            {t('exercise.mediaUnavailable')}
          </Text>
        </>
      )}

      {showBadge && uri ? (
        <View
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
            backgroundColor: 'rgba(28,26,23,0.55)',
          }}
        >
          <Text
            style={{
              fontSize: 9,
              fontWeight: '700',
              color: '#FFFAF6',
              letterSpacing: 0,
            }}
            numberOfLines={1}
          >
            {credit}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default AttributedMedia;
