import { Inter } from 'next/font/google';
import { setRequestLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { routing } from '@/i18n/routing';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
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

  return (
    <NextIntlClientProvider>
      <div className={`${inter.className} bg-background text-text min-h-screen flex flex-col`}>
        <Header />
        <div className="flex-1">
          {children}
        </div>
        <Footer />
      </div>
    </NextIntlClientProvider>
  );
}
