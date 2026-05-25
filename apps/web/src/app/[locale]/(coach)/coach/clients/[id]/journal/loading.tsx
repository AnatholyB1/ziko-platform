// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/journal/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function JournalLoading() {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden mt-4">
      {/* Date | Humeur | Énergie | Stress | Notes */}
      <div className="flex gap-6 px-4 py-3 bg-[#F7F6F3]">
        <SkeletonText className="w-12" />
        <SkeletonText className="w-16" />
        <SkeletonText className="w-16" />
        <SkeletonText className="w-14" />
        <SkeletonText className="w-20" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 px-4 py-3 border-t border-[#E2E0DA]">
          <SkeletonText className="w-20" />
          {/* Mood score circles */}
          <SkeletonBlock className="w-7 h-7 rounded-full" />
          <SkeletonBlock className="w-7 h-7 rounded-full" />
          <SkeletonBlock className="w-7 h-7 rounded-full" />
          <SkeletonText className="w-32" />
        </div>
      ))}
    </div>
  );
}
