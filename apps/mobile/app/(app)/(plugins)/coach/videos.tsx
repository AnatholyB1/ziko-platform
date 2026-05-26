import React from 'react';
import VideoListScreen from '@ziko/plugin-coach/screens/VideoListScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function CoachVideosRoute() {
  return <VideoListScreen supabase={supabase} />;
}
