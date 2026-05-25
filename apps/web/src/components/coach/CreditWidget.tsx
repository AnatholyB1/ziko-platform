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

  const flashColor = isZero ? '#EF4444' : '#FF5C1A';
  const balanceColor = isZero ? '#EF4444' : isLow ? '#F59E0B' : '#1C1A17';

  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="flex items-center gap-1.5">
        <IoFlashOutline size={14} color={flashColor} />
        <span className="font-semibold" style={{ color: balanceColor }}>
          {credits ?? '--'}
        </span>
        <span className="text-[#6B6963]">crédits</span>
      </div>
      <div className="flex items-center gap-1 bg-[#F0EFE9] rounded px-2 py-1">
        <span className="text-[#6B6963]">Analyser:</span>
        <span className="font-semibold text-[#1C1A17]">2cr</span>
        <span className="mx-1 text-[#E2E0DA]">·</span>
        <span className="text-[#6B6963]">Générer:</span>
        <span className="font-semibold text-[#1C1A17]">3cr</span>
        <span className="mx-1 text-[#E2E0DA]">·</span>
        <span className="text-[#6B6963]">Surveiller:</span>
        <span className="font-semibold text-[#1C1A17]">1cr</span>
      </div>
    </div>
  );
}
