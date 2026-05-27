'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

const PRESETS = ['#FF5C1A', '#3B82F6', '#8B5CF6', '#22C55E', '#1C1A17'] as const;

export interface ColorPickerInputProps {
  value: string;
  onChange: (hex: string) => void;
}

export function ColorPickerInput({ value, onChange }: ColorPickerInputProps) {
  const isValid = HEX_REGEX.test(value);
  const prevValidRef = useRef<boolean>(false);

  useEffect(() => {
    const wasValid = prevValidRef.current;
    if (!wasValid && isValid) {
      gsap.fromTo(
        '.color-swatch',
        { scale: 0.85, opacity: 0.5 },
        { scale: 1, opacity: 1, duration: 0.2, ease: 'back.out(1.4)' },
      );
    }
    prevValidRef.current = isValid;
  }, [isValid]);

  function handlePresetClick(e: React.MouseEvent<HTMLButtonElement>, hex: string) {
    onChange(hex);
    gsap.to(e.currentTarget, {
      scale: 0.85,
      duration: 0.08,
      yoyo: true,
      repeat: 1,
      ease: 'power3.out',
    });
  }

  return (
    <div className="bg-white rounded-2xl p-8 border border-border shadow-sm branding-section">
      <h2 className="text-base font-bold text-text mb-5">Couleur principale</h2>
      <p className="text-xs text-muted mb-5">
        Cette couleur sera appliquée comme accent dans l&apos;app de vos athlètes.
      </p>

      <div className="flex items-center gap-3">
        <div
          className={
            'color-swatch w-10 h-10 rounded-lg border flex-shrink-0 transition-colors duration-150' +
            (isValid
              ? ' ring-2 ring-offset-1 ring-primary border-transparent'
              : ' border-border')
          }
          style={{ backgroundColor: isValid ? value : '#F0EFE9' }}
          aria-hidden="true"
        />
        <input
          type="text"
          className="h-11 w-36 px-3 bg-white border border-border rounded-xl text-sm font-normal text-text placeholder:text-muted font-mono"
          placeholder="#FF5C1A"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Code couleur hexadécimal"
        />
      </div>

      <div className="flex gap-2 mt-3">
        {PRESETS.map((hex) => (
          <button
            key={hex}
            type="button"
            className="w-6 h-6 rounded-full cursor-pointer border-2 border-transparent hover:border-border transition-colors"
            style={{ backgroundColor: hex }}
            onClick={(e) => handlePresetClick(e, hex)}
            aria-label={hex}
          />
        ))}
      </div>
      <p className="text-xs text-muted mt-1">Ou entrez un code hex personnalisé</p>
    </div>
  );
}
