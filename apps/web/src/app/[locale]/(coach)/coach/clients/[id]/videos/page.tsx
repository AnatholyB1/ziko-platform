import { VideoListClient } from '@/components/coach/videos/VideoListClient';

export default async function VideosPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  return <VideoListClient clientId={id} />;
}
