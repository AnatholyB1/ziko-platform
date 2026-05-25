// apps/web/src/app/[locale]/(coach)/coach/settings/loading.tsx
import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function SettingsLoading() {
  return (
    <div className="flex-1 p-8 bg-[#F7F6F3] min-h-screen max-w-2xl">
      <SkeletonText className="w-32 h-7 mb-8" />

      {/* 3 sections formulaire */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-[#E2E0DA] p-6 mb-4"
        >
          <SkeletonText className="w-36 h-4 mb-5" />
          <div className="space-y-3">
            <SkeletonBlock className="w-full h-10 rounded-xl" />
            <SkeletonBlock className="w-full h-10 rounded-xl" />
          </div>
        </div>
      ))}

      {/* Bouton save */}
      <SkeletonBlock className="w-32 h-10 rounded-xl" />
    </div>
  );
}
