'use client';

import { BarChart2 } from 'lucide-react';

export function DashboardEmptyState({ prompt = false }: { prompt?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-12 h-12 rounded-full bg-[#F0EFE9] flex items-center justify-center mb-4">
        <BarChart2 className="w-6 h-6 text-muted" />
      </div>
      <p className="text-[15px] font-semibold text-text mb-2">
        {prompt ? 'Sélectionnez un sport' : 'Aucune donnée disponible'}
      </p>
      <p className="text-sm text-muted max-w-[320px] leading-relaxed">
        {prompt
          ? 'Sélectionnez un sport pour afficher le dashboard.'
          : "Aucune séance trouvée pour cette période. Encouragez votre client à enregistrer ses entraînements."}
      </p>
    </div>
  );
}
