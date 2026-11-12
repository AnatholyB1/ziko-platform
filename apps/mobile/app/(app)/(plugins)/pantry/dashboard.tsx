import React from 'react';
import PantryPlugin from '@ziko/plugin-pantry/screens/PantryPlugin';
import { supabase } from '../../../../src/lib/supabase';
import { CREDIT_COSTS } from '../../../../src/lib/creditCosts';

export default function PantryPluginRoute() {
  return <PantryPlugin supabase={supabase} recipeCreditCost={CREDIT_COSTS.recipes} />;
}
