import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';

// ── Data ──────────────────────────────────────────────────────

const PW_PACKS = [
  { id: 'p20',  credits: 20,  price: '1,99€',  perUnit: '0,10€', popular: false, save: null },
  { id: 'p50',  credits: 50,  price: '3,99€',  perUnit: '0,08€', popular: true,  save: null },
  { id: 'p150', credits: 150, price: '9,99€',  perUnit: '0,07€', popular: false, save: '-13%' },
  { id: 'p500', credits: 500, price: '24,99€', perUnit: '0,05€', popular: false, save: '-38%' },
];

// ── RechargeSheet ─────────────────────────────────────────────

export function RechargeSheet({
  visible,
  onClose,
  onOpenPaywall,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenPaywall?: () => void;
}) {
  const theme = useThemeStore((s) => s.theme);
  const insets = useSafeAreaInsets();
  const [pick, setPick] = useState('p50');

  const selectedPack = PW_PACKS.find((p) => p.id === pick) ?? PW_PACKS[1];

  const handleBuy = () => {
    showAlert(
      'Achat en cours',
      `${selectedPack.credits} crédits pour ${selectedPack.price}. Fonctionnalité disponible bientôt.`,
      [{ text: 'OK' }],
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(28,26,23,0.5)', justifyContent: 'flex-end' }}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={{
            backgroundColor: theme.background,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 18,
            paddingBottom: Math.max(insets.bottom, 22),
            maxHeight: '90%',
          }}>
            {/* Handle */}
            <View style={{
              width: 36, height: 4, borderRadius: 2,
              backgroundColor: 'rgba(28,26,23,0.18)',
              alignSelf: 'center',
              marginTop: 10,
              marginBottom: 14,
            }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 11, fontWeight: '800', color: theme.primary,
                  letterSpacing: 0.8, textTransform: 'uppercase',
                }}>
                  Crédits IA
                </Text>
                <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, marginTop: 4, lineHeight: 26 }}>
                  Recharge ton solde
                </Text>
                <Text style={{ fontSize: 12, color: theme.muted, marginTop: 4 }}>
                  Solde actuel :{' '}
                  <Text style={{ color: theme.text, fontWeight: '700' }}>47</Text>{' '}
                  crédits
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={{
                  padding: 8, borderRadius: 12,
                  backgroundColor: 'rgba(28,26,23,0.06)',
                }}
              >
                <Ionicons name="close" size={16} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Packs */}
              <View style={{ gap: 10, marginTop: 18 }}>
                {PW_PACKS.map((p) => {
                  const active = pick === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => setPick(p.id)}
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                        borderWidth: active ? 2 : 1,
                        borderColor: active ? theme.primary : theme.border,
                        backgroundColor: active
                          ? `${theme.primary}0F`
                          : theme.surface,
                      }}
                    >
                      {/* Icon */}
                      <View style={{
                        width: 44, height: 44, borderRadius: 12,
                        backgroundColor: active ? theme.primary : `${theme.primary}1F`,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons
                          name="flash"
                          size={20}
                          color={active ? '#fff' : theme.primary}
                        />
                      </View>

                      {/* Labels */}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>
                            {p.credits} crédits
                          </Text>
                          {p.popular && (
                            <View style={{
                              paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
                              backgroundColor: theme.primary,
                            }}>
                              <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.6 }}>
                                POPULAIRE
                              </Text>
                            </View>
                          )}
                          {p.save && (
                            <View style={{
                              paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
                              backgroundColor: `${theme.success}24`,
                            }}>
                              <Text style={{ fontSize: 9, fontWeight: '800', color: theme.success }}>
                                {p.save}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>
                          {p.perUnit} / crédit
                        </Text>
                      </View>

                      {/* Price */}
                      <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>
                        {p.price}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Upsell card */}
              <View style={{
                padding: 12, marginTop: 14,
                borderRadius: 14,
                flexDirection: 'row',
                gap: 10,
                alignItems: 'flex-start',
                backgroundColor: `${theme.primary}0F`,
                borderWidth: 1,
                borderColor: `${theme.primary}38`,
              }}>
                <View style={{
                  width: 28, height: 28, borderRadius: 8,
                  backgroundColor: theme.primary,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="sparkles" size={14} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.text }}>
                    Tu utilises beaucoup l'IA ?
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2, lineHeight: 16 }}>
                    Premium inclut 300 crédits/mois pour 9,99€. Souvent plus rentable.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    if (onOpenPaywall) onOpenPaywall();
                  }}
                  style={{
                    paddingHorizontal: 11, paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: theme.text,
                  }}
                >
                  <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>Voir</Text>
                </TouchableOpacity>
              </View>

              {/* CTA */}
              <TouchableOpacity
                onPress={handleBuy}
                style={{
                  width: '100%', padding: 14, borderRadius: 14,
                  marginTop: 16, backgroundColor: theme.primary,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                  Acheter — {selectedPack.price}
                </Text>
              </TouchableOpacity>

              <Text style={{
                textAlign: 'center', marginTop: 8, fontSize: 10.5, color: theme.muted,
              }}>
                Achat unique · Crédits ajoutés instantanément · Pas d'expiration
              </Text>

              <View style={{ height: 8 }} />
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
