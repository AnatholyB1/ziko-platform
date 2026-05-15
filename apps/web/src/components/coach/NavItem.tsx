'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { IconType } from 'react-icons';

export interface NavItemProps {
  label: string;
  href: string;
  icon: IconType;
  disabled?: boolean;
}

export function NavItem({ label, href, icon: Icon, disabled = false }: NavItemProps) {
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
          ? 'h-11 flex items-center gap-3 px-3 rounded-lg text-sm text-primary font-bold bg-primary/5 border-l-4 border-primary rounded-l-none'
          : 'h-11 flex items-center gap-3 px-3 rounded-lg text-sm text-text font-normal hover:bg-background transition-colors'
      }
    >
      <Icon size={20} />
      <span>{label}</span>
    </Link>
  );
}
