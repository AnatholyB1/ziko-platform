'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'sessions', label: 'Séances' },
  { key: 'measurements', label: 'Mesures' },
  { key: 'habits', label: 'Habitudes' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'sleep', label: 'Sommeil' },
  { key: 'cardio', label: 'Cardio' },
  { key: 'journal', label: 'Journal' },
  { key: 'programs', label: 'Programmes' },
];

export function ClientTabStrip({ id, locale }: { id: string; locale: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Données client">
      <div className="relative">
        <div
          className="flex gap-1 border-b border-border overflow-x-auto scrollbar-none flex-nowrap"
        >
        {TABS.map((tab) => {
          const href = `/${locale}/coach/clients/${id}/${tab.key}`;
          const isActive = pathname.endsWith(`/${tab.key}`);
          return (
            <Link
              key={tab.key}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={`px-4 py-3 text-sm font-normal transition-colors border-b-2 ${
                isActive
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-muted hover:text-text hover:border-border'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
        </div>
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent" />
      </div>
    </nav>
  );
}
