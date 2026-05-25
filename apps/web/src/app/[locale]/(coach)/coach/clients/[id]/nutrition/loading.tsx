// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/nutrition/loading.tsx
import { SkeletonText } from '@/components/coach/skeletons';

export default function NutritionLoading() {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden mt-4">
      {/* Table header (Date | Repas | Aliment | Calories | Protéines) */}
      <div className="flex gap-4 px-4 py-3 bg-[#F7F6F3]">
        <SkeletonText className="w-16" />
        <SkeletonText className="w-14" />
        <SkeletonText className="w-24" />
        <SkeletonText className="w-16" />
        <SkeletonText className="w-16" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-t border-[#E2E0DA]">
          <SkeletonText className="w-20" />
          <SkeletonText className="w-16" />
          <SkeletonText className="w-28" />
          <SkeletonText className="w-12" />
          <SkeletonText className="w-12" />
        </div>
      ))}
    </div>
  );
}
