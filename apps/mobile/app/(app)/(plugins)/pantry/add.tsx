import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import PantryItemForm from '@ziko/plugin-pantry/screens/PantryItemForm';
import { supabase } from '../../../../src/lib/supabase';

export default function PantryAddRoute() {
  const { scan } = useLocalSearchParams<{ scan?: string }>();
  return <PantryItemForm supabase={supabase} mode="add" autoScan={scan === '1'} />;
}
