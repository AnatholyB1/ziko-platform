import React from 'react';
import MeasurementsPlugin from '@ziko/plugin-measurements/screens/MeasurementsPlugin';
import { supabase } from '../../../../src/lib/supabase';

export default function MeasurementsDashboardRoute() {
  return <MeasurementsPlugin supabase={supabase} />;
}
