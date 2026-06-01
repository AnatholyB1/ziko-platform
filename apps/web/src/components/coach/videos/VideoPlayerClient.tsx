'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { AnnotationPanel } from './AnnotationPanel';

export interface Annotation {
  id: string;
  timestamp_s: number;
  content: string;
  coach_id: string;
  created_at: string;
  type?: 'text' | 'voice';
  audio_path?: string | null;
}

export interface VideoRecord {
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

function formatMmSs(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function VideoPlayerClient({
  clientId,
  videoId,
  signedUrl,
  annotations: initialAnnotations,
  video,
  accessToken,
  apiUrl,
}: VideoPlayerClientProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);

  const title = video?.title ?? 'Vidéo';
  const dateStr = video?.created_at ? formatDate(video.created_at) : '';
  const durationStr = video?.duration_s ? formatMmSs(video.duration_s) : '';

  return (
    <div className="px-6 pt-6 pb-6">
      {/* Back navigation */}
      <Link
        href={`/coach/clients/${clientId}/videos`}
        className="inline-flex items-center gap-1 text-[12px] text-[#6B6963] hover:text-[#1C1A17] transition-colors duration-100"
      >
        <ArrowLeft size={14} />
        Retour aux vidéos
      </Link>

      {/* Page header */}
      <h1 className="mt-2 text-[22px] font-semibold text-[#1C1A17] leading-snug">{title}</h1>
      {(dateStr || durationStr) && (
        <p className="text-[12px] text-[#6B6963] mt-0.5">
          {[dateStr, durationStr].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* 2/3 + 1/3 layout — both columns are inside MediaPlayer via VideoPlayer children */}
      <div className="mt-6 flex gap-6 items-start">
        <VideoPlayer src={signedUrl} annotations={annotations}>
          {/* Annotation panel — inside MediaPlayer tree (Risk 2 mitigation) */}
          <div className="flex-1 min-w-0 max-w-sm min-w-[280px] sticky top-6">
            <AnnotationPanel
              videoId={videoId}
              annotations={annotations}
              accessToken={accessToken}
              apiUrl={apiUrl}
              onAnnotationsChange={setAnnotations}
              status={video?.status}
            />
          </div>
        </VideoPlayer>
      </div>
    </div>
  );
}
