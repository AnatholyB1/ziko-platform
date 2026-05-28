'use client';

export function PreviewLoadingOverlay() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center rounded-md"
      style={{ backgroundColor: 'rgba(247,246,243,0.80)' }}
      role="status"
      aria-label="Mise à jour du dashboard en cours"
    >
      <div
        className="animate-spin rounded-full"
        style={{
          width: 24,
          height: 24,
          border: '2px solid #FF5C1A',
          borderTopColor: 'transparent',
        }}
      />
      <p className="text-xs text-[#6B6963] mt-2">Mise à jour du dashboard...</p>
    </div>
  );
}
