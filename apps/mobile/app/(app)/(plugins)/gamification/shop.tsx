import React, { useCallback } from 'react';
import ShopScreen from '@ziko/plugin-gamification/screens/ShopScreen';
import { supabase } from '../../../../src/lib/supabase';
import { useThemeStore } from '../../../../src/stores/themeStore';
import { useGamificationStore } from '@ziko/plugin-gamification/store';
import type { ShopItem } from '@ziko/plugin-gamification/store';

export default function ShopScreenRoute() {
  const { setTheme, setBanner } = useThemeStore();

  const handleEquip = useCallback((item: ShopItem) => {
    if (item.category === 'theme') {
      setTheme(item.name);
    } else if (item.category === 'banner') {
      setBanner(item.name);
    }
  }, []);

  return <ShopScreen supabase={supabase} onEquip={handleEquip} />;
}
