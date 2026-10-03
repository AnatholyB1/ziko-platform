import { getTranslations } from 'next-intl/server';
import { IoInformationCircleOutline } from 'react-icons/io5';
import { getReloginNoticeState } from '@/lib/reloginNotice';

type Props = { locale: string };

export async function ReloginNoticeBanner({ locale }: Props) {
  const state = getReloginNoticeState(new Date(), process.env.NEXT_PUBLIC_ZIKO_RELOGIN_CUTOVER_DATE);
  if (!state.visible || !state.cutover || !state.phase) return null;

  const t = await getTranslations({ locale, namespace: 'reloginNotice' });
  const date = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(state.cutover);

  return (
    <div
      role="status"
      className="flex items-start gap-2 bg-primary/10 border-b border-border text-sm px-4 py-3 flex-shrink-0"
    >
      <IoInformationCircleOutline className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
      <p>{t(state.phase, { date })}</p>
    </div>
  );
}
