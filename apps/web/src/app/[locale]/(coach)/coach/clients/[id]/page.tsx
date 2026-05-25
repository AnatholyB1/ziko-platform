import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

export default async function ClientDefaultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  redirect(`/${locale}/coach/clients/${id}/sessions`);
}
