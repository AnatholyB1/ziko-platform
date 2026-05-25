// apps/web/src/app/[locale]/(coach)/coach/invitations/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function InvitationsLoading() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <SkeletonText className="w-40 h-7" />
        <SkeletonBlock className="w-40 h-10 rounded-xl" />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-4">
        <SkeletonBlock className="w-20 h-9 rounded-full" />
        <SkeletonBlock className="w-16 h-9 rounded-full" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E2E0DA] overflow-hidden">
        <div className="flex gap-6 px-4 py-3 bg-[#F7F6F3]">
          <SkeletonText className="w-20" />
          <SkeletonText className="w-28" />
          <SkeletonText className="w-16" />
          <SkeletonText className="w-16 ml-auto" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 px-4 py-3 border-t border-[#E2E0DA]"
          >
            <SkeletonText className="w-16 font-mono" />
            <SkeletonText className="w-28" />
            <SkeletonBlock className="w-16 h-6 rounded-full" />
            <SkeletonBlock className="w-8 h-6 rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
