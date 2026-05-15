// [VERIFIED: Context7 /amannn/next-intl middleware composition + /supabase/ssr]
// D-10: Supabase refresh ALWAYS first. (coach) routes return supabase response.
// Non-coach paths delegate to next-intl for locale routing.
import createIntlMiddleware from 'next-intl/middleware';
import { type NextRequest } from 'next/server';
import { routing } from './src/i18n/routing';
import { updateSession } from './src/lib/supabase/middleware';

const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // Step 1: refresh Supabase cookies on every matched request.
  const supaResponse = await updateSession(request);

  // Step 2: (coach) routes — supabase response is authoritative.
  if (request.nextUrl.pathname.match(/^\/(fr|en)\/coach(\/|$)/)) {
    return supaResponse;
  }

  // Step 3: non-coach paths (landing, legal, /) → next-intl handles locale.
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    '/',
    '/(fr|en)/:path*',
    '/((?!_next|_vercel|api|.*\\..*).*)',
  ],
};
