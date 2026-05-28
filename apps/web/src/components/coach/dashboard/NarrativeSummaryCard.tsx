'use client';

interface NarrativeSummaryCardProps {
  narrative: string | undefined;
  sport: string;
  isLoading: boolean;
}

export function NarrativeSummaryCard({ narrative, sport, isLoading }: NarrativeSummaryCardProps) {
  if (!sport) return null;

  return (
    <div className="bg-white rounded-2xl border border-border p-6 mb-4 w-full">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base leading-none">🧠</span>
        <h3 className="text-[15px] font-semibold text-text">Analyse IA — {sport}</h3>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-3 bg-[#E2E0DA] rounded animate-pulse w-full" />
          <div className="h-3 bg-[#E2E0DA] rounded animate-pulse w-3/4" />
        </div>
      ) : (
        <p className="text-sm text-muted leading-relaxed max-w-prose">
          {narrative ?? "Analyse IA disponible dès la sélection d'un sport."}
        </p>
      )}
    </div>
  );
}
