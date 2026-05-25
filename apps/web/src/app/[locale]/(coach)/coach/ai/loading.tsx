// apps/web/src/app/[locale]/(coach)/coach/ai/loading.tsx
import { SkeletonBlock } from '@/components/coach/skeletons';

export default function AILoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex-1 flex flex-col justify-end gap-4 p-6 overflow-hidden">
        {/* 2 messages user (droite) */}
        <div className="flex justify-end">
          <SkeletonBlock className="w-64 h-12 rounded-2xl rounded-tr-sm" />
        </div>
        <div className="flex justify-end">
          <SkeletonBlock className="w-80 h-16 rounded-2xl rounded-tr-sm" />
        </div>
        {/* 1 message assistant (gauche) */}
        <div className="flex items-start gap-3">
          <SkeletonBlock className="w-8 h-8 rounded-full shrink-0" />
          <SkeletonBlock className="w-72 h-24 rounded-2xl rounded-tl-sm" />
        </div>
      </div>

      {/* Barre de saisie */}
      <div className="border-t border-[#E2E0DA] p-4">
        <SkeletonBlock className="w-full h-12 rounded-2xl" />
      </div>
    </div>
  );
}
