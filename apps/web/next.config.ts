import createNextIntlPlugin from 'next-intl/plugin';
import withBundleAnalyzer from '@next/bundle-analyzer';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const analyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  // v16 dropped generateStatsFile/statsFilename. Use 'json' mode to emit a
  // machine-readable artifact for the D-02 step 3 RN-leak grep.
  openAnalyzer: false,
  analyzerMode: 'json',
});

const nextConfig = {};

export default analyzer(withNextIntl(nextConfig));
