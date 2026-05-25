// apps/web/src/app/[locale]/(coach)/coach/imports/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function ImportsLoading() {
  return (
    <div className="flex-1 p-8 bg-[#F7F6F3] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <SkeletonText className="w-32 h-7" />
        <SkeletonBlock className="w-36 h-10 rounded-xl" />
      </div>

      {/* Liste imports */}
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-[#E2E0DA] p-4 flex items-center gap-4"
          >
            <SkeletonBlock className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonText className="w-48" />
              <SkeletonText className="w-28" />
            </div>
            <SkeletonBlock className="w-20 h-7 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
