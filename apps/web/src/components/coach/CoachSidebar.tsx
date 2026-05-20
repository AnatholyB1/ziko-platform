'use client';
import {
  IoGridOutline,
  IoPeopleOutline,
  IoMailOutline,
  IoBarChartOutline,
  IoSparklesOutline,
  IoSettingsOutline,
} from 'react-icons/io5';
import { NavItem } from './NavItem';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/fr/coach/dashboard', icon: IoGridOutline, disabled: false },
  { label: 'Clients', href: '/fr/coach/clients', icon: IoPeopleOutline, disabled: false },
  { label: 'Invitations', href: '/fr/coach/invitations', icon: IoMailOutline, disabled: false },
  { label: 'Programmes', href: '/fr/coach/programs', icon: IoBarChartOutline, disabled: false },
  { label: 'IA', href: '/fr/coach/ai', icon: IoSparklesOutline, disabled: true },
  { label: 'Paramètres', href: '/fr/coach/settings', icon: IoSettingsOutline, disabled: false },
];

export function CoachSidebar() {
  return (
    <aside className="bg-white border-r border-border h-screen sticky top-0 w-60 flex flex-col">
      <div className="h-14 px-4 flex items-center">
        <span className="text-3xl font-bold text-primary">ZIKO</span>
      </div>
      <nav className="flex flex-col gap-1 px-2 py-4" aria-label="Navigation coach">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>
    </aside>
  );
}
