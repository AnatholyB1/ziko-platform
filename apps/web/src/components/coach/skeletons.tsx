// apps/web/src/components/coach/skeletons.tsx
// Server Component — pas de 'use client'.
// Couleur #E2E0DA = token 'border' du design system Ziko.

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[#E2E0DA] rounded-xl ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[#E2E0DA] rounded h-3 ${className}`}
      aria-hidden="true"
    />
  );
}

// Ligne de tableau : avatar circle + N colonnes de largeurs croissantes
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  const colWidths = ['w-32', 'w-24', 'w-28', 'w-16', 'w-20'];
  return (
    <div
      className="flex items-center gap-6 px-4 py-3 border-t border-[#E2E0DA]"
      aria-hidden="true"
    >
      <div className="animate-pulse bg-[#E2E0DA] rounded-full w-8 h-8 shrink-0" />
      {Array.from({ length: cols }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse bg-[#E2E0DA] rounded h-3 ${colWidths[i] ?? 'w-20'}`}
        />
      ))}
    </div>
  );
}
