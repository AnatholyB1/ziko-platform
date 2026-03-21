import React from 'react';
import MeasurementsLog from '@ziko/plugin-measurements/screens/MeasurementsLog';
import { supabase } from '../../../../src/lib/supabase';

export default function MeasurementsLogRoute() {
  return <MeasurementsLog supabase={supabase} />;
}
