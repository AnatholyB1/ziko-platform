import React from 'react';
import CardioDashboard from '@ziko/plugin-cardio/screens/CardioDashboard';
import { supabase } from '../../../../src/lib/supabase';

export default function CardioDashboardRoute() {
  return <CardioDashboard supabase={supabase} />;
}
