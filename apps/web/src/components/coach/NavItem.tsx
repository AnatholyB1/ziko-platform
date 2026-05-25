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
        role="link"
        aria-disabled="true"
        tabIndex={-1}
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
      aria-label={
        badgeCount && badgeCount > 0
          ? `${label} — ${badgeCount} alerte${badgeCount > 1 ? 's' : ''} non lue${badgeCount > 1 ? 's' : ''}`
          : label
      }
      className={
        isActive
          ? 'h-11 flex items-center gap-3 px-3 rounded-lg text-sm text-primary font-bold bg-primary/10 relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2'
          : 'h-11 flex items-center gap-3 px-3 rounded-lg text-sm text-text font-normal hover:bg-background transition-colors relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2'
      }
    >
      <span className="relative shrink-0">
        <Icon size={20} />
        {badgeCount && badgeCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs font-semibold rounded-full flex items-center justify-center leading-none"
          >
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        ) : null}
      </span>
      <span aria-hidden="true">{label}</span>
    </Link>
  );
}
