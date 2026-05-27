'use client';
import { useState, useEffect } from 'react';
import gsap from 'gsap';
import { createClientSupabase } from '@/lib/supabase/client';
import { ColorPickerInput } from '@/components/coach/ColorPickerInput';
import { LogoUpload } from '@/components/coach/LogoUpload';
import { ToneSelector } from '@/components/coach/ToneSelector';
import { BrandingPreviewCard } from '@/components/coach/BrandingPreviewCard';
import { IoSparklesOutline, IoCheckmarkCircle } from 'react-icons/io5';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface BrandingClientProps {
  userId: string;
  isPro: boolean;
  displayName: string;
  initialBranding: {
    primary_color: string;
    logo_url: string | null;
    tone: string | null;
  } | null;
}

export function BrandingClient({
  userId,
  isPro,
  displayName,
  initialBranding,
}: BrandingClientProps) {
  const [primaryColor, setPrimaryColor] = useState<string>(
    initialBranding?.primary_color ?? '',
  );
  const [logoPath, setLogoPath] = useState<string | null>(
    initialBranding?.logo_url ?? null,
  );
  const [tone, setTone] = useState<string | null>(
    initialBranding?.tone ?? null,
  );
  const [jwt, setJwt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  // Fetch JWT once on mount
  useEffect(() => {
    createClientSupabase()
      .auth.getSession()
      .then((result) => {
        setJwt(result.data.session?.access_token ?? null);
      });
  }, []);

  // GSAP page entrance on mount
  useEffect(() => {
    gsap.from('.branding-section', {
      y: 20,
      opacity: 0,
      duration: 0.25,
      ease: 'power2.out',
      stagger: 0.06,
      delay: 0.05,
    });
    gsap.from('.preview-card', {
      y: 16,
      opacity: 0,
      duration: 0.3,
      ease: 'power2.out',
      delay: 0.2,
    });
  }, []);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toastVisible) return;
    const timer = setTimeout(() => {
      gsap.to('.success-toast, .error-toast', {
        y: 10,
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          setToastVisible(false);
          setToast(null);
        },
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, [toastVisible]);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setToastVisible(true);
    // Fire entrance after state is applied — microtask flush
    setTimeout(() => {
      gsap.from('.success-toast, .error-toast', {
        y: 20,
        opacity: 0,
        duration: 0.25,
        ease: 'power2.out',
      });
    }, 0);
  }

  async function handleSave() {
    if (saving) return;

    // Save button press feedback
    gsap.to('.save-btn', {
      scale: 0.97,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      ease: 'power3.out',
    });

    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/coach/branding`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          primary_color: primaryColor || undefined,
          logo_url: logoPath,
          tone,
        }),
      });

      if (!res.ok) throw new Error('save_failed');

      showToast('success', 'Direction artistique enregistrée.');
    } catch {
      showToast('error', "Erreur lors de l'enregistrement. Réessayez.");
      // Error shake on save button
      gsap.fromTo(
        '.save-btn',
        { x: -4 },
        {
          x: 0,
          duration: 0.3,
          ease: 'none',
          keyframes: [{ x: -4 }, { x: 4 }, { x: -3 }, { x: 3 }, { x: 0 }],
        },
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left column — form controls */}
        <div className="flex flex-col gap-6">
          <ColorPickerInput value={primaryColor} onChange={setPrimaryColor} />
          <LogoUpload
            userId={userId}
            currentPath={logoPath}
            onUploaded={(path) => setLogoPath(path)}
            onRemoved={() => setLogoPath(null)}
          />
          <ToneSelector value={tone} onChange={setTone} />

          {/* Action row */}
          <div className="flex justify-end pt-2">
            {isPro ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !jwt}
                aria-busy={saving}
                className="save-btn h-11 px-6 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <p className="text-sm text-muted">
                  Passez en Pro pour sauvegarder votre direction artistique.
                </p>
                <button
                  type="button"
                  className="h-11 px-6 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                  onClick={() => {
                    window.location.href = '/coach/settings?tab=subscription';
                  }}
                >
                  <IoSparklesOutline size={16} />
                  Passer en Pro
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right column — sticky preview */}
        <div className="lg:sticky lg:top-10">
          <BrandingPreviewCard
            primaryColor={primaryColor}
            logoPath={logoPath}
            displayName={displayName}
            tone={tone}
          />
        </div>
      </div>

      {/* Toast — portal-like fixed overlay */}
      {toastVisible && toast !== null && (
        <div
          role="status"
          aria-live="polite"
          className={
            'fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-white rounded-2xl px-5 py-4 border border-border shadow-lg ' +
            (toast.type === 'success' ? 'success-toast' : 'error-toast')
          }
        >
          <IoCheckmarkCircle
            size={20}
            className={toast.type === 'success' ? 'text-green-500' : 'text-red-500'}
          />
          <span className="text-sm font-normal text-text">{toast.message}</span>
        </div>
      )}
    </>
  );
}
