'use client';
import { useState, type KeyboardEvent } from 'react';

type ClientTag = { id: string; tag: string; };

export function ClientTagInput({
  clientId,
  initialTags,
  apiUrl,
}: {
  clientId: string;
  initialTags: ClientTag[];
  apiUrl: string;
}) {
  const [tags, setTags] = useState<ClientTag[]>(initialTags);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const MAX_TAGS = 20;

  const addTag = async (rawTag: string) => {
    const tag = rawTag.trim().replace(/,$/, '');
    if (!tag || tags.some(t => t.tag === tag) || tags.length >= MAX_TAGS) {
      setInput('');
      return;
    }
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/coach/clients/${clientId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tag }),
      });
      if (res.ok) {
        const json = await res.json();
        setTags(prev => [...prev, json.tag]);
      } else {
        setError("Impossible d'ajouter ce tag.");
      }
    } catch {
      setError('Erreur réseau.');
    }
    setInput('');
  };

  const removeTag = async (tagId: string) => {
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/coach/clients/${clientId}/tags/${tagId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setTags(prev => prev.filter(t => t.id !== tagId));
      }
    } catch {
      setError('Erreur réseau.');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1].id);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {tags.map(t => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 text-xs font-normal px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
          >
            {t.tag}
            <button
              onClick={() => removeTag(t.id)}
              className="hover:text-primary/60"
              aria-label={`Supprimer le tag ${t.tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {tags.length < MAX_TAGS && (
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => input.trim() && addTag(input)}
          placeholder={tags.length === 0 ? 'Ex : Hyrox, récup…' : ''}
          className="border border-border rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
