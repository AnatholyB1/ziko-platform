import React from 'react';
import PantryItemForm from '@ziko/plugin-pantry/screens/PantryItemForm';
import { supabase } from '../../../../src/lib/supabase';

export default function PantryAddRoute() {
  return <PantryItemForm supabase={supabase} mode="add" />;
}
