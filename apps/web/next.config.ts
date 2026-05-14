import createNextIntlPlugin from 'next-intl/plugin';
import withBundleAnalyzer from '@next/bundle-analyzer';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const analyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  // Emit JSON artifacts for CI grep (in addition to HTML)
  openAnalyzer: false,
  analyzerMode: 'static',
  generateStatsFile: true,
  statsFilename: 'stats.json',
});

const nextConfig = {};

export default analyzer(withNextIntl(nextConfig));
