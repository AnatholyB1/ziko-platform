'use client';
import { useEffect, useRef } from 'react';
import { IoPersonOutline } from 'react-icons/io5';
import gsap from 'gsap';
import { createClientSupabase } from '@/lib/supabase/client';

const TONE_LABELS: Record<string, string> = {
  motivant: 'Motivant',
  analytique: 'Analytique',
  bienveillant: 'Bienveillant',
  exigeant: 'Exigeant',
};

export interface BrandingPreviewCardProps {
  primaryColor: string | null;
  logoPath: string | null;
  displayName: string;
  tone: string | null;
}

export function BrandingPreviewCard({
  primaryColor,
  logoPath,
  displayName,
  tone,
}: BrandingPreviewCardProps) {
  // Derive valid accent color
  const validColor =
    primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : null;

  // Derive logo URL — computed during render, never stored in state
  const logoUrl: string | null = logoPath
    ? createClientSupabase().storage.from('coach-logos').getPublicUrl(logoPath).data.publicUrl
    : null;

  // Tone label
  const toneLabel = tone ? (TONE_LABELS[tone] ?? null) : null;

  // GSAP logo appear — fires when logoPath transitions from null to non-null
  const prevLogoPathRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevLogoPathRef.current === null && logoPath !== null) {
      gsap.from('.preview-logo', {
        scale: 0.8,
        opacity: 0,
        duration: 0.2,
        ease: 'back.out(1.4)',
      });
    }
    prevLogoPathRef.current = logoPath;
  }, [logoPath]);

  return (
    <div className="sticky top-10">
      <p className="text-xs font-bold text-muted uppercase tracking-wide mb-3">Aperçu athlète</p>

      <div className="preview-card bg-white rounded-2xl border border-border shadow-md overflow-hidden">
        {/* Accent bar */}
        <div
          className="preview-accent-bar h-1 w-full transition-colors duration-150"
          style={{ backgroundColor: validColor ?? '#E2E0DA' }}
        />

        {/* Card body */}
        <div className="p-6 flex flex-col gap-4">
          {/* Top row */}
          <div className="flex items-center gap-4">
            {/* Logo circle */}
            <div className="w-14 h-14 rounded-full border-2 border-border overflow-hidden flex-shrink-0 flex items-center justify-center bg-[#F0EFE9]">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="preview-logo w-full h-full object-contain bg-white"
                  src={logoUrl}
                  alt="Logo coach"
                />
              ) : (
                <IoPersonOutline size={24} className="text-muted" />
              )}
            </div>

            {/* Coach info */}
            <div className="flex flex-col">
              <span className="text-base font-bold text-text">
                {displayName || 'Votre nom'}
              </span>
              <div className="mt-1">
                {tone && toneLabel ? (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: validColor ? `${validColor}15` : '#F0EFE9',
                      color: validColor ?? '#6B6963',
                    }}
                  >
                    {toneLabel}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#F0EFE9] text-muted">
                    Ton non défini
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Bottom row */}
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: validColor ?? '#E2E0DA' }}
            />
            <span className="text-xs font-normal text-muted">Direction artistique active</span>
          </div>
        </div>
      </div>

      <p className="text-xs font-normal text-muted mt-3 text-center">
        Aperçu non contractuel — la mise en page peut varier selon l&apos;app.
      </p>
    </div>
  );
}
