'use client';
import {
  IoGridOutline,
  IoPeopleOutline,
  IoMailOutline,
  IoBarChartOutline,
  IoBarbellOutline,
  IoDocumentTextOutline,
  IoCloudUploadOutline,
  IoSparklesOutline,
  IoColorPaletteOutline,
  IoSettingsOutline,
} from 'react-icons/io5';
import { useLocale } from 'next-intl';
import { NavItem } from './NavItem';

function getNavItems(locale: string) {
  return [
    { label: 'Dashboard', href: `/${locale}/coach/dashboard`, icon: IoGridOutline, disabled: false },
    { label: 'Clients', href: `/${locale}/coach/clients`, icon: IoPeopleOutline, disabled: false },
    { label: 'Invitations', href: `/${locale}/coach/invitations`, icon: IoMailOutline, disabled: false },
    { label: 'Programmes', href: `/${locale}/coach/programs`, icon: IoBarChartOutline, disabled: false },
    { label: 'Exercices', href: `/${locale}/coach/exercises`, icon: IoBarbellOutline, disabled: false },
    { label: 'Formulaires', href: `/${locale}/coach/forms`, icon: IoDocumentTextOutline, disabled: false },
    { label: 'Imports', href: `/${locale}/coach/imports`, icon: IoCloudUploadOutline, disabled: false },
    { label: 'IA', href: `/${locale}/coach/ai`, icon: IoSparklesOutline, disabled: false },
    { label: 'Direction artistique', href: `/${locale}/coach/branding`, icon: IoColorPaletteOutline, disabled: false },
    { label: 'Paramètres', href: `/${locale}/coach/settings`, icon: IoSettingsOutline, disabled: false },
  ];
}

interface CoachSidebarProps {
  unreadAlertCount?: number;
}

export function CoachSidebar({ unreadAlertCount }: CoachSidebarProps) {
  const locale = useLocale();
  const navItems = getNavItems(locale);

  return (
    <aside className="bg-white border-r border-border h-screen sticky top-0 w-60 hidden lg:flex lg:flex-col">
      <div className="h-14 px-4 flex items-center">
        <span className="text-3xl font-bold text-primary">ZIKO</span>
      </div>
      <nav className="flex flex-col gap-1 px-2 py-4" aria-label="Navigation coach">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            badgeCount={item.label === 'IA' ? unreadAlertCount : undefined}
          />
        ))}
      </nav>
    </aside>
  );
}
