// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/habits/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function HabitsLoading() {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden mt-4">
      {/* Table header (Habitude | Type | Taux 30j) */}
      <div className="flex gap-8 px-4 py-3 bg-[#F7F6F3]">
        <SkeletonText className="w-20" />
        <SkeletonText className="w-12" />
        <SkeletonText className="w-28" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-8 px-4 py-3 border-t border-[#E2E0DA]">
          {/* emoji placeholder + nom */}
          <div className="flex items-center gap-2 w-44">
            <SkeletonBlock className="w-6 h-6 rounded" />
            <SkeletonText className="w-32" />
          </div>
          <SkeletonText className="w-16" />
          <SkeletonText className="w-10" />
        </div>
      ))}
    </div>
  );
}
