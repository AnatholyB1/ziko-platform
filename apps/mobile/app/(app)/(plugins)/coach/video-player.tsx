import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import VideoPlayerScreen from '@ziko/plugin-coach/screens/VideoPlayerScreen';
import { supabase } from '../../../../src/lib/supabase';

export default function CoachVideoPlayerRoute() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  return <VideoPlayerScreen supabase={supabase} videoId={videoId ?? ''} />;
}
