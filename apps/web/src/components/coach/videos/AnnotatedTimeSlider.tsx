'use client';

import React from 'react';
import { TimeSlider, useMediaState, useMediaRemote } from '@vidstack/react';

interface Annotation {
  id: string;
  timestamp_s: number;
  content: string;
  coach_id: string;
  created_at: string;
}

interface AnnotatedTimeSliderProps {
  annotations: Annotation[];
}

function formatMmSs(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export function AnnotatedTimeSlider({ annotations }: AnnotatedTimeSliderProps) {
  // CRITICAL: must be inside <MediaPlayer> subtree (Risk 2 from RESEARCH.md)
  const duration = useMediaState('duration') ?? 0;
  const remote = useMediaRemote();

  return (
    <div className="relative w-full mt-1" data-testid="annotated-slider">
      <TimeSlider.Root className="group flex items-center w-full h-5 cursor-pointer">
        <TimeSlider.Track className="relative z-0 h-[3px] w-full bg-[#E2E0DA] rounded-full">
          <TimeSlider.TrackFill className="absolute h-full bg-[#FF5C1A] rounded-full" />
          <TimeSlider.Progress className="absolute h-full bg-[#E2E0DA] opacity-50 rounded-full" />
        </TimeSlider.Track>
        <TimeSlider.Thumb className="absolute w-4 h-4 rounded-full bg-[#FF5C1A] border-2 border-white shadow opacity-0 group-hocus:opacity-100 transition-opacity" />
        <TimeSlider.Preview className="flex flex-col items-center gap-1">
          <TimeSlider.Value className="rounded bg-[#1C1A17] text-white text-xs px-1.5 py-0.5" />
        </TimeSlider.Preview>
      </TimeSlider.Root>

      {/* Annotation dot overlay — CRITICAL: do not render dots when duration === 0 (Risk 3 — all dots cluster at left:0%) */}
      {duration > 0 &&
        annotations.map((a) => (
          <button
            key={a.id}
            title={`${formatMmSs(a.timestamp_s)} — ${a.content.slice(0, 60)}${a.content.length > 60 ? '...' : ''}`}
            onClick={() => remote.seek(a.timestamp_s)}
            style={{ left: `${(a.timestamp_s / duration) * 100}%` }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#FF5C1A] border-2 border-white shadow z-10 hover:scale-[1.4] transition-transform duration-100 cursor-pointer"
            aria-label={`Aller à ${formatMmSs(a.timestamp_s)}`}
          />
        ))}
    </div>
  );
}
