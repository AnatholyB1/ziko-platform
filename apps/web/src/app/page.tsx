import { redirect } from 'next/navigation';

// Fallback root page — middleware handles / → /fr in normal flow,
// but this ensures a redirect even if middleware is bypassed (e.g. static cache, CDN).
export default function RootPage() {
  redirect('/fr');
}
