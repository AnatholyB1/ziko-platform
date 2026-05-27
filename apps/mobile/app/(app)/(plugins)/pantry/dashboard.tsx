import React from 'react';
import PantryPlugin from '@ziko/plugin-pantry/screens/PantryPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function PantryPluginRoute() {
  return <PantryPlugin supabase={supabase} />;
}
