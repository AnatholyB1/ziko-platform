import React from 'react';
import JournalEntry from '@ziko/plugin-journal/screens/JournalEntry';
import { supabase } from '../../../../src/lib/supabase';

export default function JournalEntryRoute() {
  return <JournalEntry supabase={supabase} />;
}
