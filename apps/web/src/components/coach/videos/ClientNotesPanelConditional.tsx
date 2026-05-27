'use client';
import { usePathname } from 'next/navigation';
import { ClientNotesPanel } from '@/components/coach/ClientNotesPanel';

type ClientTag = { id: string; tag: string };

interface ClientNotesPanelConditionalProps {
  clientId: string;
  initialNote: string;
  initialTags: ClientTag[];
  apiUrl: string;
}

export function ClientNotesPanelConditional(props: ClientNotesPanelConditionalProps) {
  const pathname = usePathname();
  if (pathname.includes('/videos')) return null;
  return <ClientNotesPanel {...props} />;
}
