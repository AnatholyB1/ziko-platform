'use client';
import gsap from 'gsap';

const TONES = [
  {
    id: 'Motivant',
    name: 'Motivant',
    description: 'Encourage, célèbre les progrès, ton positif',
  },
  {
    id: 'Analytique',
    name: 'Analytique',
    description: 'Données précises, feedback objectif, ton factuel',
  },
  {
    id: 'Bienveillant',
    name: 'Bienveillant',
    description: 'Empathique, soutenant, ton doux',
  },
  {
    id: 'Exigeant',
    name: 'Exigeant',
    description: 'Standards élevés, direct, ton assertif',
  },
] as const;

export interface ToneSelectorProps {
  value: string | null;
  onChange: (tone: string) => void;
}

export function ToneSelector({ value, onChange }: ToneSelectorProps) {
  function handleClick(e: React.MouseEvent<HTMLButtonElement>, toneId: string) {
    onChange(toneId);
    gsap.to(e.currentTarget, {
      scale: 0.97,
      duration: 0.08,
      yoyo: true,
      repeat: 1,
      ease: 'power3.out',
    });
  }

  return (
    <div className="bg-white rounded-2xl p-8 border border-border shadow-sm branding-section">
      <h2 className="text-base font-bold text-text mb-2">Ton de coaching</h2>
      <p className="text-xs text-muted mb-5">
        Le ton guide le style de communication de votre coach IA avec vos athlètes.
      </p>

      <div className="grid grid-cols-2 gap-3" role="radiogroup">
        {TONES.map((tone) => {
          const isActive = value === tone.id;
          return (
            <button
              key={tone.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={(e) => handleClick(e, tone.id)}
              className={
                'tone-pill p-4 rounded-xl border text-left transition-all duration-150 cursor-pointer w-full flex flex-col gap-1' +
                (isActive
                  ? ' bg-white border-primary ring-1 ring-primary ring-offset-0'
                  : ' bg-white border-border hover:border-primary/40 hover:bg-background')
              }
            >
              <span className="text-xs font-bold text-text">{tone.name}</span>
              <span className="text-xs font-normal text-muted">{tone.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
