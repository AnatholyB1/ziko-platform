import React from 'react';
import MeasurementsDashboard from '@ziko/plugin-measurements/screens/MeasurementsDashboard';
import { supabase } from '../../../../src/lib/supabase';

export default function MeasurementsDashboardRoute() {
  return <MeasurementsDashboard supabase={supabase} />;
}
