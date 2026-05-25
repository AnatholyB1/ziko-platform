// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/cardio/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function CardioLoading() {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden mt-4">
      {/* Type | Date | Distance | Durée | Allure */}
      <div className="flex gap-6 px-4 py-3 bg-[#F7F6F3]">
        <SkeletonText className="w-12" />
        <SkeletonText className="w-12" />
        <SkeletonText className="w-16" />
        <SkeletonText className="w-14" />
        <SkeletonText className="w-14" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 px-4 py-3 border-t border-[#E2E0DA]">
          <SkeletonBlock className="w-6 h-6 rounded" />
          <SkeletonText className="w-20" />
          <SkeletonText className="w-16" />
          <SkeletonText className="w-14" />
          <SkeletonText className="w-12" />
        </div>
      ))}
    </div>
  );
}
