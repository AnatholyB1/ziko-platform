'use client';

// Stub — implemented in Task 2

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

interface VideoPlayerClientProps {
  clientId: string;
  videoId: string;
  signedUrl: string;
  annotations: Annotation[];
  video: VideoRecord | null;
  accessToken: string;
  apiUrl: string;
}

export function VideoPlayerClient(_props: VideoPlayerClientProps) {
  return <div />;
}
