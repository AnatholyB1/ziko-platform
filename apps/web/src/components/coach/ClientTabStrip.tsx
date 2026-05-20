'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
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
    <nav
      className="flex gap-1 border-b border-border"
      role="tablist"
      aria-label="Données client"
    >
      {TABS.map((tab) => {
        const href = `/${locale}/coach/clients/${id}/${tab.key}`;
        const isActive = pathname.endsWith(`/${tab.key}`);
        return (
          <Link
            key={tab.key}
            href={href}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tab-panel-${tab.key}`}
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
    </nav>
  );
}
