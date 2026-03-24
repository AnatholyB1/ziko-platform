import React from 'react';
import CardioTracker from '@ziko/plugin-cardio/screens/CardioTracker';
import { supabase } from '../../../../src/lib/supabase';

export default function CardioTrackerRoute() {
  return <CardioTracker supabase={supabase} />;
}
