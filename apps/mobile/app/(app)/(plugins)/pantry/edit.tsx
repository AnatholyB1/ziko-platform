import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import PantryItemForm from '@ziko/plugin-pantry/screens/PantryItemForm';
import { supabase } from '../../../../src/lib/supabase';

export default function PantryEditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PantryItemForm supabase={supabase} mode="edit" itemId={id} />;
}
