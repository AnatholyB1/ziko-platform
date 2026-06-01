export default function Loading() {
  return (
    <div aria-busy="true">
      {/* Page header — renders immediately, not skeletonized */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text">Exercices</h1>
          <p className="text-sm text-muted mt-1">Votre bibliothèque personnelle</p>
        </div>
        <div
          className="h-9 w-36 bg-border rounded-xl animate-pulse"
          aria-hidden="true"
        />
      </div>

      {/* Skeleton filter bar */}
      <div className="flex gap-2 mb-4 flex-wrap" aria-hidden="true">
        {[64, 48, 56, 48].map((w, i) => (
          <div
            key={i}
            className="h-6 bg-border rounded-full animate-pulse"
            style={{ width: `${w}px` }}
          />
        ))}
      </div>

      {/* Skeleton rows ×4 */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-border rounded-2xl p-4 animate-pulse flex items-center gap-4 mb-3 min-h-[56px]"
          aria-hidden="true"
        >
          {/* Left icon slot skeleton */}
          <div className="h-9 w-9 bg-border rounded-lg shrink-0" />
          {/* Title skeleton */}
          <div className="h-4 bg-border rounded w-48 flex-1" />
          {/* Category badge skeleton */}
          <div className="h-5 bg-border rounded-full w-20" />
          {/* Media badge skeleton */}
          <div className="h-5 bg-border rounded w-16" />
          {/* Action buttons skeleton */}
          <div className="h-8 w-8 bg-border rounded-lg" />
          <div className="h-8 w-8 bg-border rounded-lg" />
        </div>
      ))}
    </div>
  );
}
