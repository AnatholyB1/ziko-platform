// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sessions/loading.tsx
import { SkeletonText } from '@/components/coach/skeletons';

export default function SessionsLoading() {
  return (
    <div>
      {/* ExecutiveSummaryCard skeleton — 4 cellules stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-[#E2E0DA] p-4">
            <SkeletonText className="w-28 mb-2" />
            <SkeletonText className="w-16 h-5" />
          </div>
        ))}
      </div>

      {/* Sessions table (Date | Séance | Durée) */}
      <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden">
        <div className="flex gap-8 px-4 py-3 bg-[#F7F6F3]">
          <SkeletonText className="w-12" />
          <SkeletonText className="w-16" />
          <SkeletonText className="w-14" />
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
  );
}
