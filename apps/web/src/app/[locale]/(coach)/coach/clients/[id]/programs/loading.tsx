// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/programs/loading.tsx
// Onglet "Programmes" du client — affiche programme actif + historique.
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function ClientProgramsLoading() {
  return (
    <div className="space-y-4">
      {/* Programme actif */}
      <div className="bg-white rounded-2xl border border-[#E2E0DA] p-5">
        <SkeletonText className="w-20 h-3 mb-3" />
        <SkeletonText className="w-48 h-5 mb-2" />
        <SkeletonText className="w-28 mb-4" />
        {/* Barre compliance */}
        <div className="flex items-center gap-3">
          <SkeletonBlock className="flex-1 h-2 rounded-full" />
          <SkeletonText className="w-10" />
        </div>
      </div>

      {/* Historique — 2 lignes */}
      <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden">
        <div className="flex gap-6 px-4 py-3 bg-[#F7F6F3]">
          <SkeletonText className="w-28" />
          <SkeletonText className="w-20" />
          <SkeletonText className="w-20" />
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-6 px-4 py-3 border-t border-[#E2E0DA]">
            <SkeletonText className="w-36" />
            <SkeletonText className="w-20" />
            <SkeletonText className="w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
