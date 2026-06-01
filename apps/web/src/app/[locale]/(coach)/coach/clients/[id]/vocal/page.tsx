import { VocalRetourPanel } from '@/components/coach/vocal/VocalRetourPanel';

export default async function VocalPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  return <VocalRetourPanel clientId={id} />;
}
