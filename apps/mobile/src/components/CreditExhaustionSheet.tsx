import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, useTranslation } from '@ziko/plugin-sdk';
import { useCreditStore } from '../stores/creditStore';

// Libelles via les cles partagees `credits.earn.<source>` (fr/en) de @ziko/plugin-sdk.
const EARN_ACTIVITIES = [
  { source: 'workout',     icon: 'barbell-outline' as const },
  { source: 'habit',       icon: 'checkmark-circle-outline' as const },
  { source: 'meal',        icon: 'restaurant-outline' as const },
  { source: 'measurement', icon: 'body-outline' as const },
  { source: 'stretch',     icon: 'fitness-outline' as const },
  { source: 'cardio',      icon: 'bicycle-outline' as const },
] as const;

function formatCountdown(resetTimestamp: string): string {
  const diffMs = new Date(resetTimestamp).getTime() - Date.now();
  if (diffMs <= 0) return '0h 0m';
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export default function CreditExhaustionSheet() {
  const exhaustionVisible = useCreditStore((s) => s.exhaustionVisible);
  const exhaustionData = useCreditStore((s) => s.exhaustionData);
  const hideSheet = useCreditStore((s) => s.hideExhaustionSheet);
  const theme = useThemeStore((s) => s.theme);
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!exhaustionData?.reset_timestamp) return;
    const update = () => setCountdown(formatCountdown(exhaustionData.reset_timestamp));
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [exhaustionData?.reset_timestamp]);

  if (!exhaustionVisible || !exhaustionData) return null;

  return (
    <Modal
      visible={true}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={hideSheet}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={hideSheet}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        }}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <MotiView
            from={{ translateY: 300 }}
            animate={{ translateY: 0 }}
            transition={{ type: 'timing', duration: 300 }}
            style={{
              backgroundColor: theme.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 24,
              paddingTop: 24,
              paddingBottom: 40,
            }}
          >
            {/* Title */}
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Ionicons name="flash" size={32} color="#FFB800" />
              <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800', marginTop: 8 }}>
                {t('credits.exhausted.title')}
              </Text>
              {/* earn_hint renvoye par l'API est un texte anglais fixe : on affiche la cle partagee localisee. */}
              <Text style={{ color: theme.muted, fontSize: 14, marginTop: 4, textAlign: 'center' }}>
                {t('credits.exhausted.hint')}
              </Text>
            </View>

            {/* Earn activities checklist (EARN-09) */}
            <View style={{ marginBottom: 20 }}>
              {EARN_ACTIVITIES.map(({ source, icon }) => {
                const label = t(`credits.earn.${source}`);
                const done = exhaustionData.earned_today?.includes(source) ?? false;
                return (
                  <View key={source} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                    <Ionicons
                      name={done ? 'checkmark-circle' : ('ellipse-outline' as any)}
                      size={22}
                      color={done ? theme.success : theme.muted}
                    />
                    <Ionicons name={icon as any} size={18} color={done ? theme.muted : theme.text} />
                    <Text style={{
                      color: done ? theme.muted : theme.text,
                      fontSize: 15,
                      textDecorationLine: done ? 'line-through' : 'none',
                      flex: 1,
                    }}>
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Reset countdown */}
            <View style={{
              backgroundColor: theme.background,
              borderRadius: 12,
              padding: 12,
              alignItems: 'center',
              marginBottom: 20,
            }}>
              <Text style={{ color: theme.muted, fontSize: 13 }}>
                {t('credits.exhausted.reset', { countdown })}
              </Text>
            </View>

            {/* Close button */}
            <TouchableOpacity
              onPress={hideSheet}
              style={{
                backgroundColor: theme.primary,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{t('general.close')}</Text>
            </TouchableOpacity>
          </MotiView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
