'use client';

export type FilterChip<T extends string> = { key: T; label: string };

export function FilterChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: FilterChip<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {options.map((opt) => {
        const selected = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.key)}
            className={
              selected
                ? 'border border-primary bg-primary/10 text-primary text-sm font-semibold rounded-full px-4 py-1.5'
                : 'border border-border bg-white text-text text-sm font-normal rounded-full px-4 py-1.5 cursor-pointer hover:bg-background'
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
