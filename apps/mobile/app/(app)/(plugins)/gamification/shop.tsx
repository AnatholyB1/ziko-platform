import React from 'react';
import ShopScreen from '@ziko/plugin-gamification/screens/ShopScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function ShopScreenRoute() {
  return <ShopScreen supabase={supabase} />;
}
