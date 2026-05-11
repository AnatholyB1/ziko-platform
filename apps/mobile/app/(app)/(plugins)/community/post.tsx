import PostDetailScreen from '@ziko/plugin-community/screens/PostDetailScreen';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../../../src/lib/supabase';

export default function PostDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PostDetailScreen supabase={supabase} postId={id} onBack={() => router.back()} />;
}
