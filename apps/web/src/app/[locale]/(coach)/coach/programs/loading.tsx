// apps/web/src/app/[locale]/(coach)/coach/programs/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function ProgramsLoading() {
  return (
    <div className="flex-1 p-8 bg-[#F7F6F3] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <SkeletonText className="w-32 h-7" />
        <SkeletonBlock className="w-36 h-10 rounded-xl" />
      </div>

      {/* Grille 6 program cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-[#E2E0DA] p-5"
          >
            <SkeletonText className="w-40 h-4 mb-3" />
            <SkeletonText className="w-24 mb-4" />
            <div className="flex gap-2">
              <SkeletonBlock className="w-16 h-6 rounded-full" />
              <SkeletonBlock className="w-20 h-6 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
