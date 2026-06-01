import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
import { VideoPlayerClient } from '@/components/coach/videos/VideoPlayerClient';

interface Annotation {
  id: string;
  timestamp_s: number;
  content: string;
  coach_id: string;
  created_at: string;
}

interface VideoRecord {
  id: string;
  title: string;
  status: string;
  created_at: string;
  duration_s?: number;
}

export default async function VideoPlayerPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; videoId: string }>;
}) {
  const { id: clientId, videoId } = await params;

  await getCachedCoachUser();
  const supabase = await createServerSupabase();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const jwt = session?.access_token ?? '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

  let signedUrl = '';
  let annotations: Annotation[] = [];
  let video: VideoRecord | null = null;

  if (jwt) {
    try {
      const [signedRes, annotRes, videoRes] = await Promise.all([
        fetch(`${apiUrl}/coach/videos/${videoId}/signed-url`, {
          headers: { Authorization: `Bearer ${jwt}` },
          cache: 'no-store',
        }),
        fetch(`${apiUrl}/coach/videos/${videoId}/annotations`, {
          headers: { Authorization: `Bearer ${jwt}` },
          cache: 'no-store',
        }),
        fetch(`${apiUrl}/coach/videos/${videoId}`, {
          headers: { Authorization: `Bearer ${jwt}` },
          cache: 'no-store',
        }),
      ]);
      if (signedRes.ok) {
        const data = await signedRes.json();
        signedUrl = data.signedUrl ?? '';
      }
      if (annotRes.ok) {
        annotations = (await annotRes.json()) ?? [];
      }
      if (videoRes.ok) {
        const data = await videoRes.json();
        video = data.video ?? data ?? null;
      }
    } catch (err) {
      console.error('[videos/[videoId]/page] fetch error:', err);
    }
  }

  return (
    <VideoPlayerClient
      clientId={clientId}
      videoId={videoId}
      signedUrl={signedUrl}
      annotations={annotations}
      video={video}
      accessToken={jwt}
      apiUrl={apiUrl}
    />
  );
}
