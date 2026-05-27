'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Film, ChevronRight, AlertCircle, Video } from 'lucide-react';
import { gsap } from 'gsap';
import { createBrowserClient } from '@supabase/ssr';

interface VideoRecord {
  id: string;
  title: string;
  status: 'uploading' | 'ready' | 'annotated';
  created_at: string;
}

interface VideoListClientProps {
  clientId: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: VideoRecord['status'] }) {
  if (status === 'uploading') {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[#FEF3C7] text-[#92400E] flex-shrink-0">
        En cours d&apos;envoi
      </span>
    );
  }
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[#DCFCE7] text-[#166534] flex-shrink-0">
        Prête à annoter
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[#FFF0E8] text-[#C2410C] flex-shrink-0">
      Annotée
    </span>
  );
}

export function VideoListClient({ clientId }: VideoListClientProps) {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_KEY!,
      );
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const jwt = session?.access_token ?? '';
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

      const res = await fetch(`${apiUrl}/coach/clients/${clientId}/videos`, {
        headers: { Authorization: `Bearer ${jwt}` },
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data: VideoRecord[] = await res.json();
      setVideos(data);
    } catch (err) {
      console.error('[VideoListClient] fetch error:', err);
      setError('Impossible de charger les vidéos.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Page entrance animation
  useEffect(() => {
    if (!loading && listRef.current) {
      gsap.from(listRef.current, { y: 16, opacity: 0, duration: 0.2, ease: 'power2.out' });
    }
  }, [loading]);

  // List item stagger after data loads
  useEffect(() => {
    if (!loading && videos.length > 0) {
      gsap.from('.video-list-item', {
        y: 8,
        opacity: 0,
        duration: 0.15,
        stagger: 0.04,
        ease: 'power2.out',
      });
    }
  }, [loading, videos.length]);

  if (loading) {
    return (
      <div className="px-6 pt-6 pb-6" aria-label="Chargement des vidéos...">
        <div className="h-7 w-48 rounded bg-[#E2E0DA] animate-pulse mb-1" />
        <div className="h-4 w-20 rounded bg-[#E2E0DA] animate-pulse mb-6" />
        <div className="bg-white rounded-lg border border-[#E2E0DA] shadow-sm overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`px-4 py-3 flex items-center gap-4 min-h-[56px]${i < 2 ? ' border-b border-[#E2E0DA]' : ''}`}
            >
              <div className="w-6 h-6 rounded bg-[#E2E0DA] animate-pulse flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-1">
                <div className="w-48 h-[14px] rounded bg-[#E2E0DA] animate-pulse" />
                <div className="w-24 h-[12px] rounded bg-[#E2E0DA] animate-pulse mt-1" />
              </div>
              <div className="w-20 h-6 rounded bg-[#E2E0DA] animate-pulse flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 pt-6 pb-6">
        <div className="bg-white rounded-lg border border-[#E2E0DA] shadow-sm overflow-hidden py-8 px-6 text-center">
          <AlertCircle className="mx-auto text-[#EF4444]" size={24} />
          <p className="mt-3 text-sm font-semibold text-[#1C1A17]">
            Impossible de charger les vidéos
          </p>
          <p className="mt-1 text-xs text-[#6B6963]">
            Vérifiez votre connexion et réessayez.
          </p>
          <button
            type="button"
            onClick={fetchVideos}
            className="mt-4 border border-[#E2E0DA] text-[#6B6963] bg-white text-sm px-4 py-2 rounded-md hover:border-[#1C1A17] hover:text-[#1C1A17] transition-colors duration-100"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={listRef} className="px-6 pt-6 pb-6">
      <h1 className="text-[22px] font-semibold text-[#1C1A17] leading-[1.3]">
        Vidéos
      </h1>
      <p className="text-xs text-[#6B6963] mt-1 mb-6">
        {videos.length === 1 ? '1 vidéo' : `${videos.length} vidéos`}
      </p>

      {videos.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#E2E0DA] shadow-sm overflow-hidden py-16 flex flex-col items-center gap-3 text-center">
          <Video size={40} className="text-[#6B6963] opacity-40" />
          <h2 className="text-[18px] font-semibold text-[#1C1A17] leading-[1.35]">
            Aucune vidéo pour l&apos;instant
          </h2>
          <p className="text-sm text-[#6B6963] max-w-[320px] leading-[1.5]">
            L&apos;athlète peut envoyer ses vidéos depuis l&apos;application mobile — elles
            apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-[#E2E0DA] shadow-sm overflow-hidden">
          {videos.map((video, index) => {
            const isClickable = video.status === 'ready' || video.status === 'annotated';
            return (
              <div
                key={video.id}
                className={`video-list-item px-4 py-3 flex items-center gap-4 min-h-[56px]${
                  index < videos.length - 1 ? ' border-b border-[#E2E0DA]' : ''
                }${
                  isClickable
                    ? ' cursor-pointer hover:bg-[#F0EFE9] transition-colors duration-100'
                    : ' cursor-default'
                }`}
                onClick={
                  isClickable
                    ? () => router.push(`/coach/clients/${clientId}/videos/${video.id}`)
                    : undefined
                }
              >
                <Film size={24} className="text-[#6B6963] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1C1A17] truncate">
                    {video.title}
                  </p>
                  <p className="text-xs text-[#6B6963] mt-0.5">
                    {formatDate(video.created_at)}
                  </p>
                </div>
                <StatusBadge status={video.status} />
                {isClickable && (
                  <ChevronRight size={16} className="text-[#6B6963] flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
