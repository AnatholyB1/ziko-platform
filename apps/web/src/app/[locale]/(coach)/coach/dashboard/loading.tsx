import { SkeletonBlock, SkeletonText } from '@/components/coach/skeletons';

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8">
      {/* WelcomeCard skeleton */}
      <div className="bg-white rounded-2xl p-8 border border-[#E2E0DA] shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <SkeletonText className="w-56 h-6" />
          <SkeletonBlock className="w-20 h-6 rounded-full" />
        </div>
        <SkeletonText className="w-72 mb-3" />
        <SkeletonText className="w-64" />
      </div>

      {/* AlertsPanel skeleton — 3 cartes */}
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-5 border border-[#E2E0DA]"
          >
            <div className="flex items-start gap-3">
              <SkeletonBlock className="w-8 h-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonText className="w-40" />
                <SkeletonText className="w-64" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
