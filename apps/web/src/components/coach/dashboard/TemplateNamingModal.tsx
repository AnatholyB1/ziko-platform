'use client';

import { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { createBrowserClient } from '@supabase/ssr';
import type { Widget } from '@/types/dashboard';
import { useCoachMemory } from '@/hooks/useCoachMemory';
import type { CoachMemoryTemplate } from '@/hooks/useCoachMemory';

interface TemplateNamingModalProps {
  currentWidgets: Widget[];
  onClose: () => void;
  onSuccess: () => void;
}

export function TemplateNamingModal({
  currentWidgets,
  onClose,
  onSuccess,
}: TemplateNamingModalProps) {
  const [templateName, setTemplateName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [focused, setFocused] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: memory } = useCoachMemory();

  // GSAP entrance on mount
  useEffect(() => {
    if (modalRef.current) {
      gsap.fromTo(
        modalRef.current,
        { opacity: 0, scale: 0.97, y: 8 },
        { opacity: 1, scale: 1, y: 0, duration: 0.2, ease: 'power2.out' },
      );
    }
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  function handleClose() {
    if (isSaving) return;
    gsap.to(modalRef.current, {
      opacity: 0,
      scale: 0.97,
      y: 4,
      duration: 0.15,
      ease: 'power2.in',
      onComplete: () => onClose(),
    });
  }

  async function handleSave() {
    const trimmedName = templateName.trim();
    if (!trimmedName) return;

    // Client-side duplicate check using cached memory data
    const isDuplicate = memory?.templates.some((t) => t.name === trimmedName);
    if (isDuplicate) {
      setError('Ce nom est déjà utilisé. Choisissez un nom différent.');
      inputRef.current?.focus();
      return;
    }

    setIsSaving(true);
    setError(null);

    const newTemplate: CoachMemoryTemplate = {
      id: crypto.randomUUID(),
      name: trimmedName,
      widgets: currentWidgets,
      created_at: new Date().toISOString(),
    };

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_KEY!,
      );
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/coach/dashboards/memory`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + session.access_token,
          },
          credentials: 'include',
          body: JSON.stringify({
            templates: [...(memory?.templates ?? []), newTemplate],
          }),
        },
      );

      if (res.ok) {
        // Trigger success callback (shows toast in parent), then animate out
        onSuccess();
        gsap.to(modalRef.current, {
          opacity: 0,
          scale: 0.97,
          y: 4,
          duration: 0.15,
          ease: 'power2.in',
          onComplete: () => onClose(),
        });
        return;
      }

      if (res.status === 409) {
        setError('Ce nom est déjà utilisé. Choisissez un nom différent.');
        inputRef.current?.focus();
        return;
      }

      // 5xx or other errors
      setError("Erreur lors de l'enregistrement. Réessayer ?");
    } catch {
      setError("Erreur lors de l'enregistrement. Réessayer ?");
    } finally {
      setIsSaving(false);
    }
  }

  function handleBackdropKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape' && !isSaving) {
      handleClose();
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && templateName.trim() && !isSaving) {
      handleSave();
    }
  }

  const isButtonDisabled = !templateName.trim() || isSaving;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-40"
      style={{ background: 'rgba(0,0,0,0.40)' }}
      onKeyDown={handleBackdropKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) handleClose();
      }}
    >
      {/* Modal container */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-modal-title"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 50,
          width: 480,
          background: '#FFFFFF',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(28,26,23,0.10)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 24px 20px',
            borderBottom: '1px solid #E2E0DA',
          }}
        >
          <h2
            id="template-modal-title"
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: '#1C1A17',
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            Enregistrer comme modèle
          </h2>
          <p
            style={{
              fontSize: 14,
              color: '#6B6963',
              marginTop: 8,
              marginBottom: 0,
              lineHeight: 1.5,
            }}
          >
            Ce modèle sera disponible lorsque vous créerez un dashboard pour un autre athlète.
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px 16px' }}>
          <label
            htmlFor="template-name-input"
            style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: '#1C1A17',
              marginBottom: 8,
            }}
          >
            Nom du modèle
          </label>

          <input
            ref={inputRef}
            id="template-name-input"
            type="text"
            value={templateName}
            onChange={(e) => {
              setTemplateName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleInputKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxLength={60}
            readOnly={isSaving}
            placeholder="Ex. : Programme force 4j"
            aria-describedby={error ? 'template-name-error' : undefined}
            aria-invalid={!!error}
            style={{
              display: 'block',
              width: '100%',
              height: 40,
              padding: '10px 12px',
              background: focused ? '#FFFFFF' : '#F0EFE9',
              border: `1px solid ${error ? '#EF4444' : focused ? '#FF5C1A' : '#E2E0DA'}`,
              borderRadius: 8,
              fontSize: 14,
              color: '#1C1A17',
              boxSizing: 'border-box',
              outline: 'none',
              opacity: isSaving ? 0.6 : 1,
              transition: 'border-color 150ms ease, background 150ms ease',
            }}
          />

          {/* Character counter */}
          <div style={{ textAlign: 'right', marginTop: 4 }}>
            <span style={{ fontSize: 12, color: '#6B6963' }}>
              {templateName.length}/60
            </span>
          </div>

          {/* Error text */}
          {error && (
            <p
              id="template-name-error"
              style={{
                fontSize: 14,
                color: '#EF4444',
                marginTop: 4,
                marginBottom: 0,
                lineHeight: 1.5,
              }}
            >
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '20px 24px',
            borderTop: '1px solid #E2E0DA',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          {/* Cancel button */}
          <button
            onClick={handleClose}
            disabled={isSaving}
            style={{
              height: 36,
              paddingLeft: 16,
              paddingRight: 16,
              border: '1px solid #E2E0DA',
              borderRadius: 8,
              background: 'transparent',
              fontSize: 14,
              fontWeight: 600,
              color: '#1C1A17',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.4 : 1,
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => {
              if (!isSaving) {
                (e.target as HTMLButtonElement).style.background = '#F0EFE9';
              }
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            Annuler
          </button>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={isButtonDisabled}
            aria-busy={isSaving}
            aria-disabled={isButtonDisabled}
            style={{
              height: 36,
              paddingLeft: 16,
              paddingRight: 16,
              background: '#FF5C1A',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              color: '#FFFFFF',
              cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
              opacity: isButtonDisabled ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 160,
              transition: 'opacity 150ms ease',
            }}
          >
            {isSaving ? (
              <span
                style={{
                  width: 16,
                  height: 16,
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: '#FFFFFF',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                  display: 'inline-block',
                }}
              />
            ) : (
              'Enregistrer le modèle'
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
