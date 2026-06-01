'use client';

const MUSCLE_OPTIONS = [
  'Quadriceps',
  'Ischio-jambiers',
  'Fessiers',
  'Mollets',
  'Dos',
  'Pectoraux',
  'Épaules',
  'Biceps',
  'Triceps',
  'Abdominaux',
  'Corps entier',
] as const;

interface MuscleChipSelectorProps {
  value: string[];
  onChange: (muscles: string[]) => void;
  disabled?: boolean;
}

export function MuscleChipSelector({ value, onChange, disabled = false }: MuscleChipSelectorProps) {
  function toggle(muscle: string) {
    if (value.includes(muscle)) {
      onChange(value.filter((m) => m !== muscle));
    } else {
      onChange([...value, muscle]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {MUSCLE_OPTIONS.map((muscle) => {
        const active = value.includes(muscle);
        return (
          <button
            key={muscle}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => toggle(muscle)}
            className={
              active
                ? 'bg-primary/10 text-primary border border-primary rounded-full px-2.5 py-1 text-xs font-bold'
                : 'bg-background text-muted border border-border rounded-full px-2.5 py-1 text-xs font-normal hover:border-primary hover:text-primary'
            }
          >
            {muscle}
          </button>
        );
      })}
    </div>
  );
}
