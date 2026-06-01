import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NotificationPermissionModalProps {
  visible: boolean;
  onActivate: () => void;
  onSkip: () => void;
}

const EXAMPLE_CARDS = [
  {
    icon: 'person-circle-outline' as const,
    title: "Coach t'a assigné un programme",
    subtitle: 'Push/Pull/Legs — démarre maintenant',
  },
  {
    icon: 'flame-outline' as const,
    title: 'Streak à risque — il te reste 3h',
    subtitle: '21 jours de suite, ne t\'arrête pas !',
  },
  {
    icon: 'trophy-outline' as const,
    title: 'Niveau 12 débloqué !',
    subtitle: 'Tu as gagné 500 XP cette semaine',
  },
];

export function NotificationPermissionModal({
  visible,
  onActivate,
  onSkip,
}: NotificationPermissionModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: '#F7F6F3', paddingBottom: 100 }}>
        {/* Safe area top padding */}
        <View style={{ paddingTop: 60 }}>
          {/* Headline */}
          <Text
            style={{
              fontWeight: '700',
              fontSize: 24,
              color: '#1C1A17',
              textAlign: 'center',
              marginBottom: 32,
              marginHorizontal: 20,
            }}
          >
            {'🔔 Reste dans la zone — Ne rate plus une séance'}
          </Text>

          {/* Example notification cards */}
          {EXAMPLE_CARDS.map((card) => (
            <View
              key={card.icon}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
                padding: 16,
                marginBottom: 12,
                marginHorizontal: 20,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Ionicons
                name={card.icon}
                size={28}
                color="#FF5C1A"
                style={{ marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontWeight: '600', fontSize: 14, color: '#1C1A17' }}
                >
                  {card.title}
                </Text>
                <Text
                  style={{ fontSize: 12, color: '#6B6963', marginTop: 2 }}
                >
                  {card.subtitle}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA section — absolute positioned at bottom */}
        <View
          style={{
            position: 'absolute',
            bottom: 40,
            left: 0,
            right: 0,
            paddingHorizontal: 20,
          }}
        >
          {/* Activer button */}
          <TouchableOpacity
            onPress={onActivate}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#FF5C1A',
              borderRadius: 12,
              paddingVertical: 16,
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontWeight: '700',
                fontSize: 16,
                color: '#FFFFFF',
                textAlign: 'center',
              }}
            >
              Activer
            </Text>
          </TouchableOpacity>

          {/* Plus tard button */}
          <TouchableOpacity
            onPress={onSkip}
            activeOpacity={0.8}
            style={{
              backgroundColor: 'transparent',
              borderRadius: 12,
              paddingVertical: 14,
            }}
          >
            <Text
              style={{
                fontWeight: '500',
                fontSize: 15,
                color: '#6B6963',
                textAlign: 'center',
              }}
            >
              Plus tard
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
