'use client'
import { Info } from 'lucide-react';

export function CompareExcludeNote() {
  return (
    <div className="bg-white rounded-2xl border border-border p-6 flex flex-col items-center justify-center min-h-[120px]">
      <div className="w-8 h-8 rounded-full bg-[#F0EFE9] flex items-center justify-center mb-2">
        <Info className="w-4 h-4 text-muted" />
      </div>
      <p className="text-[15px] font-semibold text-text mb-1">Non disponible en mode comparaison</p>
      <p className="text-sm text-muted text-center max-w-[240px]">Ce widget ne peut pas afficher deux séries de données.</p>
    </div>
  );
}
