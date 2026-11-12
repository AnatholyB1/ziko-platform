import React, { useCallback } from 'react';
import GamificationPlugin from '@ziko/plugin-gamification/screens/GamificationPlugin';
import type { ShopItem } from '@ziko/plugin-gamification/store';
import { supabase } from '../lib/supabase';
import { useThemeStore, coachStorage } from '../stores/themeStore';

type Tab = 'Niveau' | 'Succès' | 'Boutique' | 'Quêtes';

/** Vrai si un branding de coach est applique (cle `coach:branding` avec une couleur primaire). */
function isCoachBrandingActive(): boolean {
  try {
    const raw = coachStorage.getString('coach:branding');
    if (!raw) return false;
    return !!(JSON.parse(raw) as { primary_color?: string })?.primary_color;
  } catch {
    return false;
  }
}

/**
 * Ecran Recompenses commun aux routes `gamification/dashboard` et `gamification/shop`.
 * Q6 : le branding du coach prime sur un theme achete (le theme reste equipe en base et
 * s'appliquera au delien) ; les bannieres ne sont pas concernees.
 */
export default function RewardsRoute({ initialTab = 'Niveau' }: { initialTab?: Tab }) {
  const { setTheme, setBanner } = useThemeStore();
  const coachBrandingActive = isCoachBrandingActive();

  const handleEquip = useCallback((item: ShopItem) => {
    if (item.category === 'theme') {
      if (!isCoachBrandingActive()) setTheme(item.name);
    } else if (item.category === 'banner') {
      setBanner(item.name);
    }
  }, [setTheme, setBanner]);

  return (
    <GamificationPlugin
      supabase={supabase}
      initialTab={initialTab}
      onEquip={handleEquip}
      coachBrandingActive={coachBrandingActive}
    />
  );
}
