import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface ProfileHeroProps {
  avatarColor: string;
  initials: string;
  onBack?: () => void;
  onSettings?: () => void;
  onMore?: () => void;
}

export function ProfileHero({
  avatarColor,
  initials,
  onBack,
  onSettings,
  onMore,
}: ProfileHeroProps) {
  return (
    <View style={{ height: 160, overflow: 'hidden', position: 'relative' }}>
      <LinearGradient
        colors={[avatarColor, '#1C1A17']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Top-left radial overlay */}
      <View
        style={{
          position: 'absolute',
          top: -40,
          left: -40,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: 'rgba(255,255,255,0.1)',
        }}
      />

      {/* Bottom-right radial overlay */}
      <View
        style={{
          position: 'absolute',
          bottom: -40,
          right: -40,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: 'rgba(255,92,26,0.2)',
        }}
      />

      {/* Floating nav buttons */}
      <View
        style={{
          position: 'absolute',
          top: 44,
          left: 12,
          right: 12,
          zIndex: 3,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        {onBack ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onBack}
            accessibilityLabel="Retour"
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: 'rgba(0,0,0,0.32)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36, height: 36 }} />
        )}

        {onSettings ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onSettings}
            accessibilityLabel="Paramètres"
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: 'rgba(0,0,0,0.32)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="settings-outline" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        ) : onMore ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onMore}
            accessibilityLabel="Plus d'options"
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: 'rgba(0,0,0,0.32)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36, height: 36 }} />
        )}
      </View>
    </View>
  );
}
