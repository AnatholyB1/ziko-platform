import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '@ziko/plugin-sdk';
import { useAuthStore } from '../stores/authStore';
import { isEmailVerified, sendVerificationCode } from '../lib/emailVerification';
import { EmailCodeForm } from './EmailCodeForm';

/**
 * Non-blocking reminder shown while the account email is unverified. Renders nothing until the
 * profile is loaded, so existing/verified users never see a flash.
 * Gating of sensitive actions is NOT done here (see DEPLOY-CHECKLIST-v1.17.md, follow-up list).
 */
export function EmailVerifyBanner() {
  const profile = useAuthStore((s) => s.profile);
  const email = useAuthStore((s) => s.user?.email);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [open, setOpen] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  if (!profile || !email || isEmailVerified(profile)) return null;

  const start = async () => {
    const r = await sendVerificationCode();
    if (r.status === 'sent') setCooldown(r.cooldown);
    else if (r.status === 'cooldown') setCooldown(r.retryAfter);
    else {
      showAlert('Envoi impossible', r.message);
      return;
    }
    setOpen(true);
  };

  if (open) {
    return (
      <View style={{
        backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E0DA',
        padding: 16, marginBottom: 16,
      }}>
        <EmailCodeForm
          email={email}
          initialCooldown={cooldown}
          onVerified={() => { setOpen(false); refreshProfile().catch(() => {}); }}
          onSkip={() => setOpen(false)}
        />
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={start}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16,
        backgroundColor: 'rgba(255,92,26,0.08)', borderWidth: 1, borderColor: 'rgba(255,92,26,0.20)',
        borderRadius: 16, padding: 12,
      }}
    >
      <Ionicons name="mail-unread-outline" size={18} color="#FF5C1A" />
      <Text style={{ flex: 1, fontSize: 12.5, color: '#1C1A17', fontWeight: '600' }}>
        Confirme ton adresse email pour sécuriser ton compte.
      </Text>
      <Text style={{ fontSize: 12.5, color: '#FF5C1A', fontWeight: '700' }}>Confirmer</Text>
    </TouchableOpacity>
  );
}
