'use client';
import { useEffect, useRef } from 'react';
import {
  IoPersonOutline,
  IoHomeOutline,
  IoBarChartOutline,
  IoSparklesOutline,
  IoWaterOutline,
  IoCheckmarkCircle,
  IoFlashOutline,
  IoTimeOutline,
  IoEllipsisHorizontal,
} from 'react-icons/io5';
import gsap from 'gsap';
import { createClientSupabase } from '@/lib/supabase/client';

// ── Derived palette swatches ────────────────────────────
const PALETTE_SWATCHES = [
  { label: 'Principal',   alpha: '',    pct: '100%', dark: true  },
  { label: 'Hover',       alpha: 'E6',  pct: '90%',  dark: true  },
  { label: 'Medium',      alpha: '66',  pct: '40%',  dark: false },
  { label: 'Bordure',     alpha: '33',  pct: '20%',  dark: false },
  { label: 'Fond léger',  alpha: '1A',  pct: '10%',  dark: false },
  { label: 'Fond subtil', alpha: '0D',  pct: '5%',   dark: false },
] as const;

function dc(hex: string, alpha: string) {
  return alpha ? hex + alpha : hex;
}

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
  const validColor =
    primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : null;
  const accent = validColor ?? '#FF5C1A';

  const logoUrl: string | null = logoPath
    ? createClientSupabase().storage.from('coach-logos').getPublicUrl(logoPath).data.publicUrl
    : null;

  const toneLabel = tone ? (TONE_LABELS[tone] ?? null) : null;
  const coachName = displayName || 'Votre nom';

  // Logo appear animation
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

  // Color change pulse on the accent bar
  const prevColorRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevColorRef.current !== null && prevColorRef.current !== validColor) {
      gsap.fromTo(
        '.phone-accent-bar',
        { scaleX: 0.6, opacity: 0.4 },
        { scaleX: 1, opacity: 1, duration: 0.25, ease: 'power2.out', transformOrigin: 'left' },
      );
    }
    prevColorRef.current = validColor;
  }, [validColor]);

  return (
    <div className="sticky top-10">
      <p className="text-xs font-bold text-muted uppercase tracking-wide mb-3">Aperçu athlète</p>

      {/* ── Phone frame ──────────────────────────────────── */}
      <div className="preview-card mx-auto max-w-[280px]">
        {/* Outer shell */}
        <div className="bg-[#1C1A17] rounded-[2.2rem] p-[6px] shadow-2xl">
          {/* Inner screen */}
          <div className="bg-[#F7F6F3] rounded-[1.9rem] overflow-hidden">

            {/* Status bar */}
            <div className="flex items-center justify-between px-5 pt-3 pb-1">
              <span className="text-[11px] font-bold text-[#1C1A17]">9:41</span>
              <div className="flex items-center gap-1">
                <div className="flex gap-[2px] items-end h-3">
                  {[2, 3, 4, 5].map((h) => (
                    <div key={h} className="w-[3px] rounded-sm bg-[#1C1A17]" style={{ height: h * 2.5 }} />
                  ))}
                </div>
                <svg width="14" height="10" viewBox="0 0 14 10" className="text-[#1C1A17]">
                  <path d="M7 2C5 2 3.3 2.7 2 3.9L0 1.8C1.9.7 4.3 0 7 0s5.1.7 7 1.8L12 3.9C10.7 2.7 9 2 7 2z" fill="currentColor" opacity=".4"/>
                  <path d="M7 5.5C5.8 5.5 4.7 6 4 6.8L2 4.7C3.2 3.7 5 3 7 3s3.8.7 5 1.7L10 6.8C9.3 6 8.2 5.5 7 5.5z" fill="currentColor" opacity=".7"/>
                  <circle cx="7" cy="8.5" r="1.5" fill="currentColor"/>
                </svg>
                <svg width="24" height="12" viewBox="0 0 24 12" className="text-[#1C1A17]">
                  <rect x="0" y="1" width="21" height="10" rx="3" stroke="currentColor" strokeWidth="1.2" fill="none" opacity=".35"/>
                  <rect x="1.5" y="2.5" width="16" height="7" rx="1.5" fill="currentColor"/>
                  <path d="M22 4.5v3a1.5 1.5 0 000-3z" fill="currentColor" opacity=".4"/>
                </svg>
              </div>
            </div>

            {/* Top accent bar */}
            <div
              className="phone-accent-bar h-[3px] mx-4 rounded-full transition-colors duration-200 mb-3"
              style={{ backgroundColor: accent }}
            />

            {/* Screen header */}
            <div className="flex items-center justify-between px-4 mb-3">
              <span className="text-[13px] font-bold text-[#1C1A17]">Mon coach</span>
              <div className="w-6 h-6 rounded-full bg-white border border-[#E2E0DA] flex items-center justify-center">
                <IoEllipsisHorizontal size={12} className="text-[#6B6963]" />
              </div>
            </div>

            {/* ── Coach card ─────────────────────────────── */}
            <div className="mx-3 bg-white rounded-2xl border border-[#E2E0DA] shadow-sm overflow-hidden mb-3">
              {/* Card top accent */}
              <div className="h-[2px] w-full" style={{ backgroundColor: accent }} />

              <div className="p-4">
                {/* Avatar + name row */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-full border-2 overflow-hidden flex-shrink-0 flex items-center justify-center"
                    style={{ borderColor: dc(accent, '33'), backgroundColor: dc(accent, '0D') }}
                  >
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="preview-logo w-full h-full object-contain bg-white"
                        src={logoUrl}
                        alt="Logo coach"
                      />
                    ) : (
                      <IoPersonOutline size={22} style={{ color: accent }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-[#1C1A17] truncate">{coachName}</p>
                    <p className="text-[10px] text-[#6B6963]">Coach certifié</p>
                    {toneLabel && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold mt-0.5"
                        style={{ backgroundColor: dc(accent, '15'), color: accent }}
                      >
                        {toneLabel}
                      </span>
                    )}
                  </div>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: dc(accent, '15') }}
                  >
                    <IoFlashOutline size={13} style={{ color: accent }} />
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-[#E2E0DA] mb-3" />

                {/* Stats row */}
                <div className="flex gap-2 mb-3">
                  {[
                    { label: 'Séances', value: '24' },
                    { label: 'Semaines', value: '8' },
                    { label: 'Objectifs', value: '3' },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="flex-1 rounded-xl py-2 px-1 text-center"
                      style={{ backgroundColor: dc(accent, '0D') }}
                    >
                      <p className="text-[11px] font-bold" style={{ color: accent }}>{stat.value}</p>
                      <p className="text-[8px] text-[#6B6963]">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* CTA button */}
                <button
                  type="button"
                  className="w-full h-8 rounded-xl text-[10px] font-bold text-white flex items-center justify-center gap-1.5 transition-opacity"
                  style={{ backgroundColor: accent }}
                >
                  <IoFlashOutline size={11} />
                  Commencer une séance
                </button>
              </div>
            </div>

            {/* ── Next workout card ───────────────────────── */}
            <div className="mx-3 bg-white rounded-2xl border border-[#E2E0DA] shadow-sm overflow-hidden mb-3">
              <div className="p-3 flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: dc(accent, '15') }}
                >
                  <IoTimeOutline size={15} style={{ color: accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-[#1C1A17]">Prochain entraînement</p>
                  <p className="text-[9px] text-[#6B6963]">Lundi · Full body · 45 min</p>
                </div>
                <IoCheckmarkCircle size={16} style={{ color: accent }} />
              </div>
              <div
                className="h-[2px] mx-3 mb-3 rounded-full"
                style={{ background: `linear-gradient(to right, ${accent}, ${dc(accent, '40')})` }}
              />
            </div>

            {/* ── Tab bar ─────────────────────────────────── */}
            <div className="bg-white border-t border-[#E2E0DA] px-2 pt-2 pb-4">
              <div className="flex items-center justify-around">
                {[
                  { icon: IoHomeOutline, label: 'Accueil', active: false },
                  { icon: IoBarChartOutline, label: 'Stats', active: false },
                  { icon: IoSparklesOutline, label: 'Coach', active: true },
                  { icon: IoWaterOutline, label: 'Hydrat.', active: false },
                  { icon: IoPersonOutline, label: 'Profil', active: false },
                ].map(({ icon: Icon, label, active }) => (
                  <div key={label} className="flex flex-col items-center gap-0.5 flex-1">
                    <Icon
                      size={18}
                      style={{ color: active ? accent : '#7A7670' }}
                    />
                    <span
                      className="text-[8px] font-medium"
                      style={{ color: active ? accent : '#7A7670' }}
                    >
                      {label}
                    </span>
                    {active && (
                      <div
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: accent }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Derived palette ──────────────────────────────── */}
      <div className="mt-5">
        <p className="text-xs font-bold text-muted uppercase tracking-wide mb-2">Palette dérivée</p>
        <div className="grid grid-cols-6 rounded-xl overflow-hidden border border-border">
          {PALETTE_SWATCHES.map((s) => (
            <div
              key={s.alpha}
              className="flex flex-col items-center gap-1 py-3"
              style={{ backgroundColor: dc(accent, s.alpha) }}
            >
              <span
                className="text-[10px] font-bold leading-none opacity-90"
                style={{ color: s.dark ? '#FFFFFF' : '#1C1A17' }}
              >
                {s.pct}
              </span>
              <span
                className="text-[9px] font-normal leading-none opacity-60 hidden sm:block"
                style={{ color: s.dark ? '#FFFFFF' : '#1C1A17' }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted mt-1.5 leading-relaxed">
          Mobile&nbsp;: principal · fond léger (8%) · bordure (20%) · fond subtil (5%).
          Web&nbsp;: tous les variants via Tailwind&nbsp;<code className="font-mono">/XX</code>.
        </p>
      </div>

      <p className="text-xs font-normal text-muted mt-3 text-center">
        Aperçu non contractuel — la mise en page peut varier.
      </p>
    </div>
  );
}
