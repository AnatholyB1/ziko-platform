import React from 'react';
import { router } from 'expo-router';
import { PaywallScreen } from '@ziko/ui';

export default function PaywallRoute() {
  return <PaywallScreen onClose={() => router.back()} />;
}
