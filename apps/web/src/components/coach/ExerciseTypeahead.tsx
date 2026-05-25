'use client';
import { useState, useEffect, useRef, type KeyboardEvent } from 'react';

export interface ExerciseResult {
  id: string;
  name: string;
  category?: string;
}

export interface AddedExercise {
  exercise_id: string | null;
  exercise_name: string;
  category?: string;
}

export interface ExerciseTypeaheadProps {
  onAdd: (exercise: AddedExercise) => void;
  apiUrl: string;
  accessToken: string;
}

export function ExerciseTypeahead({ onAdd, apiUrl, accessToken }: ExerciseTypeaheadProps) {
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = inputValue.trim();
    if (!query) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${apiUrl}/coach/programs/exercises?q=${encodeURIComponent(query)}&limit=10`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (res.ok) {
          const json = await res.json();
          setResults(json.exercises ?? json ?? []);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setOpen(true);
        setHighlightedIndex(-1);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, apiUrl, accessToken]);

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const query = inputValue.trim();
  // Total options: results + optional "Create" entry
  const showCreate = query.length > 0;
  const totalOptions = results.length + (showCreate ? 1 : 0);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % totalOptions);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + totalOptions) % totalOptions);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        selectResult(results[highlightedIndex]);
      } else if (highlightedIndex === results.length && showCreate) {
        handleCreate();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const selectResult = (result: ExerciseResult) => {
    onAdd({ exercise_id: result.id, exercise_name: result.name, category: result.category });
    setInputValue('');
    setResults([]);
    setOpen(false);
    setHighlightedIndex(-1);
  };

  const handleCreate = async () => {
    if (!query) return;
    try {
      const res = await fetch(`${apiUrl}/coach/programs/exercises`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: query, is_user_defined: true }),
      });
      if (res.ok) {
        const json = await res.json();
        const newId: string | null = json.id ?? json.exercise?.id ?? null;
        onAdd({ exercise_id: newId, exercise_name: query });
      } else {
        // Fallback: add with null id
        onAdd({ exercise_id: null, exercise_name: query });
      }
    } catch {
      onAdd({ exercise_id: null, exercise_name: query });
    }
    setInputValue('');
    setResults([]);
    setOpen(false);
    setHighlightedIndex(-1);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="exercise-listbox"
        aria-activedescendant={open && highlightedIndex >= 0 ? `exercise-option-${highlightedIndex}` : undefined}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (query && results.length > 0) setOpen(true); }}
        placeholder="Rechercher ou créer un exercice…"
        className="w-full text-sm font-normal text-muted focus:text-text placeholder:text-muted bg-transparent outline-none py-2"
      />

      {open && (
        <div
          id="exercise-listbox"
          role="listbox"
          className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto z-50"
        >
          {loading ? (
            <>
              {[0, 1, 2].map((i) => (
                <div key={i} className="animate-pulse bg-border h-10 rounded-lg mx-3 my-1" />
              ))}
            </>
          ) : (
            <>
              {results.length === 0 && !showCreate && (
                <p className="px-4 py-3 text-sm text-muted italic">Aucun exercice trouvé</p>
              )}
              {results.map((result, idx) => (
                <button
                  key={result.id}
                  id={`exercise-option-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={highlightedIndex === idx}
                  className={`w-full text-left px-4 py-2.5 text-sm font-normal text-text flex items-center gap-2 transition-colors ${
                    highlightedIndex === idx ? 'bg-background' : 'hover:bg-background'
                  }`}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => selectResult(result)}
                >
                  {/* Fitness icon */}
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" className="text-muted shrink-0">
                    <path
                      d="M6.5 6.5h-3a1 1 0 00-1 1v9a1 1 0 001 1h3M17.5 6.5h3a1 1 0 011 1v9a1 1 0 01-1 1h-3M6.5 9.5H17.5M6.5 14.5H17.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="flex-1 truncate">{result.name}</span>
                  {result.category && (
                    <span className="text-xs text-muted bg-background rounded-full px-2 py-0.5 shrink-0">
                      {result.category}
                    </span>
                  )}
                </button>
              ))}
              {showCreate && (
                <button
                  id={`exercise-option-${results.length}`}
                  type="button"
                  role="option"
                  aria-selected={highlightedIndex === results.length}
                  className={`w-full text-left px-4 py-2.5 text-sm font-bold text-primary flex items-center gap-2 transition-colors ${
                    highlightedIndex === results.length ? 'bg-primary/5' : 'hover:bg-primary/5'
                  }`}
                  onMouseEnter={() => setHighlightedIndex(results.length)}
                  onClick={handleCreate}
                >
                  {/* Add circle icon */}
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" className="shrink-0">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Créer l&apos;exercice &laquo; {query} &raquo;
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
