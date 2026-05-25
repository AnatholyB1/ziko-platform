// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/loading.tsx
// Affiché lors du chargement initial de /clients/[id]/* (avant que le layout résolve).
// Imite : ClientDetailHeader + ClientTabStrip + contenu tab + ClientNotesPanel.
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function ClientDetailLoading() {
  return (
    <div className="flex-1 bg-[#F7F6F3] min-h-screen">
      {/* Header area — imite p-8 pb-0 du layout */}
      <div className="p-8 pb-0">
        {/* ClientDetailHeader skeleton */}
        <div className="flex items-center gap-4 mb-6">
          <SkeletonBlock className="w-14 h-14 rounded-full shrink-0" />
          <div className="space-y-2">
            <SkeletonText className="w-40 h-5" />
            <SkeletonText className="w-24" />
          </div>
        </div>

        {/* ClientTabStrip skeleton — 8 onglets */}
        <div className="flex gap-1 border-b border-[#E2E0DA]">
          <SkeletonBlock className="w-24 h-9 rounded-t-lg rounded-b-none" />
          <SkeletonBlock className="w-20 h-9 rounded-t-lg rounded-b-none" />
          <SkeletonBlock className="w-[88px] h-9 rounded-t-lg rounded-b-none" />
          <SkeletonBlock className="w-20 h-9 rounded-t-lg rounded-b-none" />
          <SkeletonBlock className="w-28 h-9 rounded-t-lg rounded-b-none" />
          <SkeletonBlock className="w-[72px] h-9 rounded-t-lg rounded-b-none" />
          <SkeletonBlock className="w-[88px] h-9 rounded-t-lg rounded-b-none" />
          <SkeletonBlock className="w-20 h-9 rounded-t-lg rounded-b-none" />
        </div>
      </div>

      {/* Content area — imite flex gap-6 p-8 pt-6 du layout */}
      <div className="flex gap-6 p-8 pt-6">
        {/* Tab content (flex-1) */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* ExecutiveSummaryCard skeleton — 4 stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#E2E0DA] p-4">
                <SkeletonText className="w-28 mb-2" />
                <SkeletonText className="w-16 h-5" />
              </div>
            ))}
          </div>

          {/* Table skeleton */}
          <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden">
            <div className="flex gap-8 px-4 py-3 bg-[#F7F6F3]">
              <SkeletonText className="w-16" />
              <SkeletonText className="w-24" />
              <SkeletonText className="w-16" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-8 px-4 py-3 border-t border-[#E2E0DA]">
                <SkeletonText className="w-20" />
                <SkeletonText className="w-32" />
                <SkeletonText className="w-14" />
              </div>
            ))}
          </div>
        </div>

        {/* Notes panel — hidden sous lg, skeleton visible sur lg+ */}
        <div className="hidden lg:block w-72 shrink-0">
          <div className="bg-white rounded-2xl border border-[#E2E0DA] p-4">
            <SkeletonText className="w-28 mb-4" />
            <SkeletonBlock className="w-full h-32 rounded-xl mb-3" />
            <div className="flex gap-2 flex-wrap">
              {[0, 1, 2].map((i) => (
                <SkeletonBlock key={i} className="w-16 h-6 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
