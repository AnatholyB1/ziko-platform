'use client';

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default';
import { VideoOff } from 'lucide-react';
import { AnnotatedTimeSlider } from './AnnotatedTimeSlider';

interface Annotation {
  id: string;
  timestamp_s: number;
  content: string;
  coach_id: string;
  created_at: string;
}

interface VideoPlayerProps {
  src: string;
  annotations: Annotation[];
  children?: React.ReactNode;
}

export function VideoPlayer({ src, annotations, children }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      gsap.from(containerRef.current, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.out' });
    }
  }, []);

  if (!src) {
    return (
      <div
        ref={containerRef}
        className="aspect-video bg-[#F7F6F3] border border-[#E2E0DA] rounded-lg flex flex-col items-center justify-center gap-2"
      >
        <VideoOff size={32} className="text-[#6B6963]" />
        <p className="text-[14px] font-semibold text-[#1C1A17]">
          Impossible de charger la vidéo
        </p>
        <p className="text-[12px] text-[#6B6963]">
          L&apos;URL a peut-être expiré. Rechargez la page.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <MediaPlayer src={src} className="w-full">
        <div className="flex gap-6 items-start">
          <div className="flex-[2] min-w-0">
            <MediaProvider className="aspect-video bg-black rounded-lg" />
            <DefaultVideoLayout icons={defaultLayoutIcons} />
            <AnnotatedTimeSlider annotations={annotations} />
          </div>
          {children}
        </div>
      </MediaPlayer>
    </div>
  );
}
