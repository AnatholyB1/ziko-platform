import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const ALLOWED_BUCKETS = ['profile-photos', 'scan-photos', 'exports', 'coach-kyc', 'coach-exercises'] as const;
type AllowedBucket = (typeof ALLOWED_BUCKETS)[number];

export async function GET(request: NextRequest) {
  const bucket = request.nextUrl.searchParams.get('bucket');
  const path = request.nextUrl.searchParams.get('path');

  if (!bucket || !path) {
    return NextResponse.json({ error: 'bucket and path are required' }, { status: 400 });
  }

  if (!ALLOWED_BUCKETS.includes(bucket as AllowedBucket)) {
    return NextResponse.json(
      { error: `Invalid bucket. Allowed: ${ALLOWED_BUCKETS.join(', ')}` },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'Path must start with your user ID' }, { status: 403 });
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);

  if (error || !data) {
    console.error('[api/storage/upload-url] createSignedUploadUrl error:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }

  return NextResponse.json({ upload_url: data.signedUrl, path: data.path, token: data.token });
}
