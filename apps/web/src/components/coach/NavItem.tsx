'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { IconType } from 'react-icons';

export interface NavItemProps {
  label: string;
  href: string;
  icon: IconType;
  disabled?: boolean;
  badgeCount?: number;
}

export function NavItem({ label, href, icon: Icon, disabled = false, badgeCount }: NavItemProps) {
  const pathname = usePathname();
  const isActive = !disabled && pathname.startsWith(href);

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="h-11 flex items-center gap-3 px-3 rounded-lg text-sm text-muted font-normal cursor-default"
      >
        <Icon size={20} />
        <span>{label}</span>
        <span className="ml-auto text-sm font-bold text-muted bg-border rounded-full px-2 py-1">
          Bientôt
        </span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={
        isActive
          ? 'h-11 flex items-center gap-3 px-3 rounded-lg text-sm text-primary font-bold bg-primary/5 border-l-4 border-primary rounded-l-none relative'
          : 'h-11 flex items-center gap-3 px-3 rounded-lg text-sm text-text font-normal hover:bg-background transition-colors relative'
      }
    >
      <span className="relative shrink-0">
        <Icon size={20} />
        {badgeCount && badgeCount > 0 ? (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs font-semibold rounded-full flex items-center justify-center leading-none">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        ) : null}
      </span>
      <span>{label}</span>
    </Link>
  );
}
