import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { showAlert } from '@ziko/plugin-sdk';
import { verifySignupCode, resendSignupCode } from '../lib/emailSignup';

interface Props {
  email: string;
  initialCooldown?: number;
  onVerified: () => void;
  onSkip?: () => void;
}

/** 6-digit code entry for the backend email verification, with a resend cooldown. */
export function EmailCodeForm({ email, initialCooldown = 60, onVerified, onSkip }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(initialCooldown);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const handleVerify = async () => {
    setBusy(true);
    try {
      const r = await verifySignupCode(code);
      if (r.status === 'verified') onVerified();
      else showAlert('Vérification impossible', r.message);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    const r = await resendSignupCode();
    if (r.status === 'sent') {
      setCooldown(r.cooldown);
      showAlert('Code envoyé', 'Un nouveau code vient de t’être envoyé.');
    } else if (r.status === 'cooldown') {
      setCooldown(r.retryAfter);
    } else {
      showAlert('Envoi impossible', r.message);
    }
  };

  return (
    <View>
      <Text style={{ fontSize: 26, fontWeight: '800', color: '#1C1A17', marginBottom: 10 }}>
        Vérifie ton email
      </Text>
      <Text style={{ fontSize: 14, color: '#6B6963', lineHeight: 21, marginBottom: 20 }}>
        {`Nous avons envoyé un code à 6 chiffres à ${email}. Saisis-le pour confirmer ton adresse.`}
      </Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="123456"
        placeholderTextColor="#6B6963"
        style={{
          backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E0DA',
          paddingHorizontal: 14, paddingVertical: 14, color: '#1C1A17', fontSize: 20,
          letterSpacing: 6, textAlign: 'center', marginBottom: 14,
        }}
      />
      <TouchableOpacity
        onPress={handleVerify}
        disabled={code.length < 6 || busy}
        style={{
          paddingVertical: 14, borderRadius: 14, alignItems: 'center',
          backgroundColor: code.length < 6 || busy ? '#E2E0DA' : '#FF5C1A',
        }}
      >
        <Text style={{ fontWeight: '700', fontSize: 14.5, color: '#fff' }}>Valider</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handleResend}
        disabled={cooldown > 0}
        style={{ paddingVertical: 14, alignItems: 'center' }}
      >
        <Text style={{ fontSize: 13, color: cooldown > 0 ? '#6B6963' : '#FF5C1A', fontWeight: '700' }}>
          {cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : 'Renvoyer le code'}
        </Text>
      </TouchableOpacity>
      {onSkip && (
        <TouchableOpacity onPress={onSkip} style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 12.5, color: '#6B6963' }}>Plus tard</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
