// apps/web/src/app/[locale]/(coach)/coach/clients/[id]/sleep/loading.tsx
import { SkeletonText } from '@/components/coach/skeletons';

export default function SleepLoading() {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden mt-4">
      {/* Date | Coucher | Réveil | Durée | Qualité */}
      <div className="flex gap-6 px-4 py-3 bg-[#F7F6F3]">
        <SkeletonText className="w-12" />
        <SkeletonText className="w-16" />
        <SkeletonText className="w-16" />
        <SkeletonText className="w-14" />
        <SkeletonText className="w-16" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-6 px-4 py-3 border-t border-[#E2E0DA]">
          <SkeletonText className="w-20" />
          <SkeletonText className="w-14" />
          <SkeletonText className="w-14" />
          <SkeletonText className="w-12" />
          <SkeletonText className="w-10" />
        </div>
      ))}
    </div>
  );
}
