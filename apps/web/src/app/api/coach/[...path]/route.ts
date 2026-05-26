import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const supabase = await createServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  const upstreamUrl = `${API_URL}/coach/${path.join('/')}${req.nextUrl.search}`;

  const isMultipart = req.headers.get('Content-Type')?.includes('multipart/form-data') ?? false;

  const headers: Record<string, string> = {};
  if (!isMultipart) {
    headers['Content-Type'] = req.headers.get('Content-Type') ?? 'application/json';
  } else {
    // Forward the original Content-Type verbatim (includes boundary parameter)
    headers['Content-Type'] = req.headers.get('Content-Type')!;
  }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const body = ['GET', 'HEAD'].includes(req.method)
    ? undefined
    : isMultipart
      ? await req.arrayBuffer()
      : await req.text();

  const upstream = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    body,
  });

  const upstreamContentType = upstream.headers.get('Content-Type') ?? 'application/json';

  // For SSE streaming, pipe the body directly without buffering
  if (upstreamContentType.includes('text/event-stream')) {
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  const data = await upstream.text();
  return new NextResponse(data, {
    status: upstream.status,
    headers: { 'Content-Type': upstreamContentType },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
