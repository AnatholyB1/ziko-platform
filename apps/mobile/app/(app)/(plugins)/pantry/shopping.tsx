import React from 'react';
import ShoppingList from '@ziko/plugin-pantry/screens/ShoppingList';
import { supabase } from '../../../../src/lib/supabase';

export default function ShoppingRoute() {
  return <ShoppingList supabase={supabase} />;
}
