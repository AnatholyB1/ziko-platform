import { redirect } from 'next/navigation';

const CODE_RE = /^[A-Z2-9]{6}$/;

// Legacy short-link redirect: /[locale]/r/[code] → /[locale]/redeem?code=[code]
export default async function RedeemShortLinkPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  const upperCode = code.toUpperCase();
  if (!CODE_RE.test(upperCode)) redirect(`/${locale}/redeem`);
  redirect(`/${locale}/redeem?code=${upperCode}`);
}
