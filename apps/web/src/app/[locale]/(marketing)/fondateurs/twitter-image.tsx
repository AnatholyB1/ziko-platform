// ENTRY-04 names the Twitter card explicitly. Twitter would otherwise fall back to
// og:image, but re-exporting the OpenGraph image's own generator removes any
// dependency on that fallback behavior and guarantees the two cards can never drift.
export { default, size, contentType, alt, generateStaticParams } from './opengraph-image'
