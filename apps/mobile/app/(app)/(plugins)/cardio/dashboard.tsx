import React from 'react';
import CardioPlugin from '@ziko/plugin-cardio/screens/CardioPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function CardioDashboardRoute() {
  return <CardioPlugin supabase={supabase} />;
}
