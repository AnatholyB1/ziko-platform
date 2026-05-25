'use client';

import { useState, useEffect } from 'react';
import { IoFlashOutline } from 'react-icons/io5';

export function CreditWidget() {
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    async function fetchCredits() {
      try {
        const res = await fetch('/api/credits/balance');
        if (res.ok) {
          const data = await res.json();
          setCredits(typeof data.balance === 'number' ? data.balance : null);
        }
      } catch {
        // Show '--' if fetch fails — handled by null state
      }
    }
    fetchCredits();
  }, []);

  const isZero = credits === 0;
  const isLow = credits !== null && credits > 0 && credits <= 10;

  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="flex items-center gap-1.5">
        <IoFlashOutline size={14} className={isZero ? 'text-danger' : 'text-primary'} />
        <span className={`font-semibold ${isZero ? 'text-danger' : isLow ? 'text-warning' : 'text-text'}`}>
          {credits ?? '--'}
        </span>
        <span className="text-muted">crédits</span>
      </div>
      <div className="flex items-center gap-1 bg-surface-alt rounded px-2 py-1">
        <span className="text-muted">Analyser:</span>
        <span className="font-semibold text-text">2cr</span>
        <span className="mx-1 text-border">·</span>
        <span className="text-muted">Générer:</span>
        <span className="font-semibold text-text">3cr</span>
        <span className="mx-1 text-border">·</span>
        <span className="text-muted">Surveiller:</span>
        <span className="font-semibold text-text">1cr</span>
      </div>
    </div>
  );
}
