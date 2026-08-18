import createNextIntlPlugin from 'next-intl/plugin';
import withBundleAnalyzer from '@next/bundle-analyzer';
import { withBotId } from 'botid/next/config';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const analyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  // v16 dropped generateStatsFile/statsFilename. Use 'json' mode to emit a
  // machine-readable artifact for the D-02 step 3 RN-leak grep.
  openAnalyzer: false,
  analyzerMode: 'json',
});

const nextConfig = {
  transpilePackages: ['@vidstack/react'],
};

// analyzer-outside, next-intl-inside — unchanged composition order; withBotId slots
// between the two so its Next-runtime hooks still see the fully-resolved next-intl
// config, and the analyzer still wraps the final result.
export default analyzer(withBotId(withNextIntl(nextConfig)));
