import React from 'react';
import CardioDetail from '@ziko/plugin-cardio/screens/CardioDetail';
import { supabase } from '../../../../src/lib/supabase';

export default function CardioDetailRoute() {
  return <CardioDetail supabase={supabase} />;
}
