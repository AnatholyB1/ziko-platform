import React from 'react';
import ShoppingList from '@ziko/plugin-pantry/screens/ShoppingList';
import { supabase } from '../../../../src/lib/supabase';
import { CREDIT_COSTS } from '../../../../src/lib/creditCosts';

export default function ShoppingRoute() {
  return <ShoppingList supabase={supabase} recipeCreditCost={CREDIT_COSTS.recipes} />;
}
