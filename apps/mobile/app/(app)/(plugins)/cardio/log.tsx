import React from 'react';
import CardioLog from '@ziko/plugin-cardio/screens/CardioLog';
import { supabase } from '../../../../src/lib/supabase';

export default function CardioLogRoute() {
  return <CardioLog supabase={supabase} />;
}
