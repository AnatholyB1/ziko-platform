'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  IoGridOutline,
  IoPeopleOutline,
  IoBarChartOutline,
  IoSparklesOutline,
  IoSettingsOutline,
} from 'react-icons/io5';

export function MobileNav() {
  const pathname = usePathname();
  const locale = useLocale();

  const items = [
    { href: `/${locale}/coach/dashboard`, label: 'Dashboard', Icon: IoGridOutline },
    { href: `/${locale}/coach/clients`, label: 'Clients', Icon: IoPeopleOutline },
    { href: `/${locale}/coach/programs`, label: 'Programmes', Icon: IoBarChartOutline },
    { href: `/${locale}/coach/ai`, label: 'IA', Icon: IoSparklesOutline },
    { href: `/${locale}/coach/settings`, label: 'Réglages', Icon: IoSettingsOutline },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border z-40"
      aria-label="Navigation mobile"
    >
      <div className="flex items-center justify-around h-16">
        {items.map(({ href, label, Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`flex flex-col items-center gap-0.5 px-3 py-3 min-w-[44px] rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                isActive ? 'text-primary' : 'text-muted hover:text-text'
              }`}
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
