'use client';
import { useState, type KeyboardEvent } from 'react';

export function SpecialtyTagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const trimmed = input.trim();
    if (!trimmed || value.length >= 20 || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInput('');
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    }
    if (e.key === 'Backspace' && !input && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 p-2 bg-white border border-border rounded-lg min-h-11">
      {value.map((tag) => (
        <span
          key={tag}
          className="bg-primary/10 text-primary text-sm font-bold px-3 py-1 rounded-full border border-primary/20 flex items-center gap-1"
        >
          {tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            aria-label={`Retirer ${tag}`}
            className="text-primary/60 hover:text-primary ml-1"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={add}
        placeholder={value.length === 0 ? 'Ex : Hyrox, perte de poids…' : ''}
        className="flex-1 min-w-[120px] text-base font-normal text-text placeholder:text-muted outline-none bg-transparent"
        disabled={value.length >= 20}
      />
    </div>
  );
}
