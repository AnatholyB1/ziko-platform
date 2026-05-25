'use client';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

export function CompareButton({ ids }: { ids: string[] }) {
  const router = useRouter();
  const locale = useLocale();
  if (ids.length < 2) return null;

  const handleCompare = () => {
    router.push(`/${locale}/coach/clients/compare?ids=${ids.join(',')}`);
  };

  return (
    <button
      onClick={handleCompare}
      className="fixed bottom-4 right-6 z-40 bg-primary text-white rounded-xl px-6 py-3 text-sm font-bold shadow-lg hover:bg-primary/90 transition-colors"
      aria-label={`Comparer ${ids.length} clients sélectionnés`}
    >
      Comparer ({ids.length})
    </button>
  );
}
