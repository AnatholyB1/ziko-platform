// apps/web/src/app/[locale]/(coach)/coach/clients/loading.tsx
import { SkeletonBlock, SkeletonText, SkeletonRow } from '@/components/coach/skeletons';

export default function ClientsLoading() {
  return (
    <div className="flex-1 p-8 bg-[#F7F6F3] min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <SkeletonText className="w-24 h-7" />
        <SkeletonBlock className="w-8 h-6 rounded-full" />
      </div>

      {/* Search + filter chips */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 mb-4">
        <SkeletonBlock className="w-64 h-10 rounded-xl" />
        <div className="flex gap-2">
          <SkeletonBlock className="w-20 h-11 rounded-full" />
          <SkeletonBlock className="w-32 h-11 rounded-full" />
          <SkeletonBlock className="w-36 h-11 rounded-full" />
          <SkeletonBlock className="w-[136px] h-11 rounded-full" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-6 px-4 py-3 bg-[#F7F6F3]">
          <SkeletonBlock className="w-4 h-4 rounded" />
          <SkeletonText className="w-16" />
          <SkeletonText className="w-28" />
          <SkeletonText className="w-20" />
          <SkeletonText className="w-24" />
          <SkeletonText className="w-12" />
        </div>
        {/* 6 rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} cols={4} />
        ))}
      </div>
    </div>
  );
}
