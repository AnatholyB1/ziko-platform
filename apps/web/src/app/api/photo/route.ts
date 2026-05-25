import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path');
  if (!path) {
    return new NextResponse('Missing path', { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Authorize: path must belong to the authenticated user.
  if (!path.startsWith(`${user.id}/`)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { data, error } = await supabase.storage
    .from('coach-kyc')
    .createSignedUrl(path, 300); // 5-minute window

  if (error || !data?.signedUrl) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Proxy bytes so _next/image can optimize and cache the result.
  const upstream = await fetch(data.signedUrl, { cache: 'no-store' });
  if (!upstream.ok) {
    return new NextResponse('Storage fetch failed', { status: 502 });
  }

  const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
  const buffer = await upstream.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
