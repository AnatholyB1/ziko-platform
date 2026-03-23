import React from 'react';
import TDEECalculatorScreen from '@ziko/plugin-nutrition/screens/TDEECalculatorScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function TDEECalculatorRoute() {
  return <TDEECalculatorScreen supabase={supabase} />;
}
