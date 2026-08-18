import { Inter } from 'next/font/google';
import { setRequestLocale, getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { Analytics } from '@vercel/analytics/next';
import { routing } from '@/i18n/routing';
import '../globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const messages = await getMessages();
  const clientMessages = {
    Login: (messages as Record<string, unknown>).Login,
    CoachRedeem: (messages as Record<string, unknown>).CoachRedeem,
    CoachInvitations: (messages as Record<string, unknown>).CoachInvitations,
    Settings: (messages as Record<string, unknown>).Settings,
    Onboarding: (messages as Record<string, unknown>).Onboarding,
  };

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-text min-h-screen flex flex-col`}>
        <NextIntlClientProvider messages={clientMessages}>
          {children}
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
