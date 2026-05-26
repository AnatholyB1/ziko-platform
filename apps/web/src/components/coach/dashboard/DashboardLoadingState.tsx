'use client';

export function DashboardLoadingState() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-border p-6 animate-pulse">
          <div className="h-4 bg-[#E2E0DA] rounded w-2/5 mb-4" />
          <div className="h-[240px] bg-[#F0EFE9] rounded-lg" />
          <div className="border-t border-border mt-3 pt-3 flex items-center gap-2">
            <div className="w-4 h-4 bg-[#E2E0DA] rounded-full" />
            <div className="h-3 bg-[#E2E0DA] rounded w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
