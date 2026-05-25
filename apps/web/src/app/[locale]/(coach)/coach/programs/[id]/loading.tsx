// apps/web/src/app/[locale]/(coach)/coach/programs/[id]/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function ProgramEditorLoading() {
  return (
    <div className="flex-1 p-8 bg-[#F7F6F3] min-h-screen">
      {/* Header du programme */}
      <div className="flex items-center gap-4 mb-6">
        <SkeletonText className="w-48 h-7" />
        <SkeletonBlock className="w-20 h-6 rounded-full" />
      </div>

      {/* Zone éditeur */}
      <div className="bg-white rounded-2xl border border-[#E2E0DA] p-6 mb-4">
        <SkeletonText className="w-32 mb-4" />
        <SkeletonBlock className="w-full h-48 rounded-xl" />
      </div>

      {/* Accordion semaines */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-[#E2E0DA] p-4 mb-3"
        >
          <div className="flex items-center justify-between">
            <SkeletonText className="w-24" />
            <SkeletonBlock className="w-6 h-6 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
