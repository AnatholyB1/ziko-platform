import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore, showAlert } from '@ziko/plugin-sdk';
import { RechargeSheet } from './RechargeSheet';

// ── Data ──────────────────────────────────────────────────────

const PW_FEATURES = [
  { l: 'Coach IA', detail: 'Conversations illimitées', free: '5/jour', pro: true },
  { l: 'Crédits IA', detail: 'Recharge mensuelle auto', free: '15', pro: '300' },
  { l: 'Plugins', detail: 'Accès à tous les modules', free: '3', pro: true },
  { l: 'Programmes adaptatifs', detail: 'Générés par IA', free: false, pro: true },
  { l: 'Analytics avancées', detail: 'Tendances & insights', free: false, pro: true },
  { l: 'Priorité support', detail: 'Réponse < 4h', free: false, pro: true },
];

const PW_PLANS = [
  {
    id: 'month',
    label: 'Mensuel',
    sub: 'Résiliable à tout moment',
    price: '9,99€',
    per: '/mois',
    best: false,
  },
  {
    id: 'year',
    label: 'Annuel',
    sub: 'Économisez 40% — soit 5,99€/mois',
    price: '71,88€',
    per: '/an',
    best: true,
  },
  {
    id: 'lifetime',
    label: 'À vie',
    sub: 'Paiement unique, accès permanent',
    price: '149€',
    per: 'une fois',
    best: false,
  },
];

// ── PWCell helper ─────────────────────────────────────────────

function PWCell({ v, primary, dim }: { v: boolean | string; primary?: boolean; dim?: boolean }) {
  const theme = useThemeStore((s) => s.theme);
  if (v === true) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="checkmark" size={16} color={primary ? theme.primary : '#FFFAF6'} />
      </View>
    );
  }
  if (v === false) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 14, color: 'rgba(255,250,246,0.25)' }}>—</Text>
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{
        fontSize: 12,
        fontWeight: '700',
        color: primary ? theme.primary : dim ? 'rgba(255,250,246,0.5)' : '#FFFAF6',
        textAlign: 'center',
      }}>
        {v}
      </Text>
    </View>
  );
}

// ── PaywallScreen ─────────────────────────────────────────────

interface PaywallScreenProps {
  onClose: () => void;
}

export function PaywallScreen({ onClose }: PaywallScreenProps) {
  const theme = useThemeStore((s) => s.theme);
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState('year');
  const [rechargeVisible, setRechargeVisible] = useState(false);

  const handleStart = () => {
    showAlert(
      'Essai gratuit',
      '7 jours gratuits — puis renouvellement automatique selon le plan choisi. Annulable à tout moment.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Commencer',
          onPress: () => showAlert('Bientôt disponible', 'Les abonnements seront disponibles prochainement.', [{ text: 'OK' }]),
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.text }}>
      {/* Glow overlay */}
      <View
        style={{
          position: 'absolute',
          top: -80,
          left: '50%',
          marginLeft: -160,
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: theme.primary,
          opacity: 0.28,
        }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Close button */}
        <View style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          alignItems: 'flex-end',
        }}>
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 36, height: 36, borderRadius: 12,
              backgroundColor: 'rgba(255,250,246,0.08)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={18} color="#FFFAF6" />
          </TouchableOpacity>
        </View>

        {/* Scrollable content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero icon */}
          <View style={{
            width: 64, height: 64, borderRadius: 18,
            backgroundColor: theme.primary,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.7,
            shadowRadius: 20,
            elevation: 12,
            marginBottom: 18,
          }}>
            <Ionicons name="flash" size={30} color="#fff" />
          </View>

          {/* Badge */}
          <View style={{
            alignSelf: 'flex-start',
            paddingHorizontal: 10, paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: `${theme.primary}38`,
            marginBottom: 12,
          }}>
            <Text style={{
              fontSize: 10, fontWeight: '800', color: theme.primary,
              letterSpacing: 1, textTransform: 'uppercase',
            }}>
              Ziko Premium
            </Text>
          </View>

          {/* Headline */}
          <Text style={{
            fontSize: 32, fontWeight: '800', color: '#FFFAF6',
            lineHeight: 34, letterSpacing: -0.5,
          }}>
            {'Passe au niveau\nsupérieur'}
            <Text style={{ color: theme.primary }}>.</Text>
          </Text>
          <Text style={{
            fontSize: 14, color: 'rgba(255,250,246,0.65)',
            marginTop: 10, lineHeight: 21,
          }}>
            Coach IA illimité, tous les modules, programmes adaptatifs. Annule à tout moment.
          </Text>

          {/* Features comparison */}
          <View style={{
            marginTop: 26,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: 'rgba(255,250,246,0.08)',
            backgroundColor: 'rgba(255,250,246,0.04)',
            overflow: 'hidden',
          }}>
            {/* Column headers */}
            <View style={{
              flexDirection: 'row',
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}>
              <View style={{ flex: 1 }} />
              <View style={{ width: 56, alignItems: 'center' }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: 'rgba(255,250,246,0.5)', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  Free
                </Text>
              </View>
              <View style={{ width: 56, alignItems: 'center' }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  Pro
                </Text>
              </View>
            </View>

            {PW_FEATURES.map((f) => (
              <View
                key={f.l}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(255,250,246,0.06)',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFAF6' }}>{f.l}</Text>
                  {f.detail ? (
                    <Text style={{ fontSize: 10.5, color: 'rgba(255,250,246,0.45)', marginTop: 1 }}>
                      {f.detail}
                    </Text>
                  ) : null}
                </View>
                <View style={{ width: 56 }}>
                  <PWCell v={f.free} dim />
                </View>
                <View style={{ width: 56 }}>
                  <PWCell v={f.pro} primary />
                </View>
              </View>
            ))}
          </View>

          {/* Plan selector */}
          <Text style={{
            fontSize: 16, fontWeight: '800', color: '#FFFAF6',
            marginTop: 26, marginBottom: 10,
          }}>
            Choisis ton plan
          </Text>

          <View style={{ gap: 8 }}>
            {PW_PLANS.map((p) => {
              const active = plan === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setPlan(p.id)}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? theme.primary : 'rgba(255,250,246,0.12)',
                    backgroundColor: active
                      ? `${theme.primary}1F`
                      : 'rgba(255,250,246,0.04)',
                  }}
                >
                  {/* Radio */}
                  <View style={{
                    width: 22, height: 22, borderRadius: 11,
                    borderWidth: active ? 6 : 1.5,
                    borderColor: active ? theme.primary : 'rgba(255,250,246,0.3)',
                    backgroundColor: active ? '#fff' : 'transparent',
                  }} />

                  {/* Label */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFAF6' }}>
                        {p.label}
                      </Text>
                      {p.best && (
                        <View style={{
                          paddingHorizontal: 7, paddingVertical: 2,
                          borderRadius: 999,
                          backgroundColor: theme.primary,
                        }}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.6 }}>
                            POPULAIRE
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 11, color: 'rgba(255,250,246,0.55)', marginTop: 2 }}>
                      {p.sub}
                    </Text>
                  </View>

                  {/* Price */}
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFAF6' }}>{p.price}</Text>
                    <Text style={{ fontSize: 10, color: 'rgba(255,250,246,0.5)' }}>{p.per}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{
            fontSize: 11, color: 'rgba(255,250,246,0.4)',
            marginTop: 14, lineHeight: 17,
          }}>
            Essai 7 jours gratuits · Annule sans frais avant la fin · Renouvellement auto sauf annulation 24h avant.
          </Text>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={{
          paddingHorizontal: 18,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 22),
          backgroundColor: theme.text,
        }}>
          {/* Recharge credits link */}
          <TouchableOpacity
            onPress={() => setRechargeVisible(true)}
            style={{ alignItems: 'center', marginBottom: 10 }}
          >
            <Text style={{ fontSize: 12, color: 'rgba(255,250,246,0.5)', textDecorationLine: 'underline' }}>
              Recharger des crédits à la carte
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleStart}
            style={{
              width: '100%', padding: 16, borderRadius: 16,
              backgroundColor: theme.primary,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="flash" size={14} color="#fff" />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
              Commencer 7 jours gratuits
            </Text>
          </TouchableOpacity>

          <Text style={{
            textAlign: 'center', marginTop: 10, fontSize: 11,
            color: 'rgba(255,250,246,0.45)',
          }}>
            Restaurer un achat · CGU · Confidentialité
          </Text>
        </View>
      </SafeAreaView>

      {/* Recharge Sheet */}
      <RechargeSheet
        visible={rechargeVisible}
        onClose={() => setRechargeVisible(false)}
        onOpenPaywall={() => {
          setRechargeVisible(false);
          // Already on paywall, just scroll up
        }}
      />
    </View>
  );
}
